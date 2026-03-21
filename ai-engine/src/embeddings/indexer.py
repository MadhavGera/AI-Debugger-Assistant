"""
RepositoryIndexer: Clone → chunk → embed via OpenAI → store in ChromaDB.
"""
import os
from sentence_transformers import SentenceTransformer
_st_model = SentenceTransformer('all-MiniLM-L6-v2')
import asyncio
import shutil
import hashlib
from pathlib import Path
from typing import List, Dict, Any

import git
import chardet
import structlog
import chromadb
from langchain.text_splitter import RecursiveCharacterTextSplitter, Language

logger = structlog.get_logger()

CLONE_BASE = os.getenv("CLONE_BASE", "/tmp/repos")
CHROMA_HOST = os.getenv("CHROMA_HOST", "localhost")
CHROMA_PORT = int(os.getenv("CHROMA_PORT", "8000"))

SUPPORTED_EXTENSIONS = {
    ".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".go",
    ".rs", ".cpp", ".c", ".h", ".cs", ".rb", ".php",
    ".swift", ".kt", ".scala", ".sql", ".sh",
    ".yaml", ".yml", ".json", ".toml", ".md",
}
IGNORED_PATHS = {
    "node_modules", ".git", "dist", "build", ".next", "__pycache__",
    ".venv", "venv", "coverage", ".nyc_output", "vendor", "target",
}
LANG_MAP = {
    ".py": Language.PYTHON, ".js": Language.JS, ".ts": Language.JS,
    ".jsx": Language.JS, ".tsx": Language.JS, ".java": Language.JAVA,
    ".go": Language.GO, ".rs": Language.RUST, ".cpp": Language.CPP,
    ".c": Language.C, ".cs": Language.CSHARP, ".rb": Language.RUBY,
    ".swift": Language.SWIFT, ".kt": Language.KOTLIN, ".scala": Language.SCALA,
}
MAX_FILE_SIZE_KB = 500


def _get_chroma_client():
    return chromadb.HttpClient(
        host=CHROMA_HOST,
        port=CHROMA_PORT,
        tenant=chromadb.DEFAULT_TENANT,
        database=chromadb.DEFAULT_DATABASE,
    )


def _embed(texts):
    return _st_model.encode(texts, convert_to_numpy=True).tolist()



class RepositoryIndexer:
    def __init__(self):
        pass  # lazy init

    async def index(self, owner: str, repo: str, token: str, repo_id: str) -> Dict[str, Any]:
        clone_path = Path(CLONE_BASE) / repo_id
        log = logger.bind(owner=owner, repo=repo, repo_id=repo_id)
        try:
            log.info("Cloning repository")
            await self._clone_repo(owner, repo, token, clone_path)
            log.info("Scanning code files")
            files = self._scan_files(clone_path)
            log.info(f"Found {len(files)} code files")
            log.info("Chunking code files")
            chunks = await self._chunk_files(files, clone_path)
            log.info(f"Generated {len(chunks)} chunks")
            log.info("Storing embeddings in ChromaDB")
            await self._store_embeddings(repo_id, chunks)
            return {"file_count": len(files), "chunk_count": len(chunks)}
        finally:
            if clone_path.exists():
                shutil.rmtree(clone_path, ignore_errors=True)
                log.info("Cleaned up cloned repo")

    async def _clone_repo(self, owner: str, repo: str, token: str, path: Path) -> None:
        if path.exists():
            shutil.rmtree(path)
        path.mkdir(parents=True, exist_ok=True)
        clone_url = f"https://x-access-token:{token}@github.com/{owner}/{repo}.git"
        await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: git.Repo.clone_from(clone_url, str(path), depth=1, multi_options=["--no-tags"]),
        )

    def _scan_files(self, base_path: Path) -> List[Path]:
        files = []
        for file_path in base_path.rglob("*"):
            if not file_path.is_file():
                continue
            if set(file_path.parts).intersection(IGNORED_PATHS):
                continue
            if file_path.suffix not in SUPPORTED_EXTENSIONS:
                continue
            if file_path.stat().st_size / 1024 > MAX_FILE_SIZE_KB:
                continue
            files.append(file_path)
        return files

    async def _chunk_files(self, files: List[Path], base_path: Path) -> List[Dict[str, Any]]:
        chunks = []
        for file_path in files:
            try:
                content = self._read_file(file_path)
                if not content or len(content.strip()) < 20:
                    continue
                rel_path = str(file_path.relative_to(base_path))
                ext = file_path.suffix
                lang = LANG_MAP.get(ext)
                if lang:
                    splitter = RecursiveCharacterTextSplitter.from_language(
                        language=lang, chunk_size=1000, chunk_overlap=200,
                    )
                else:
                    splitter = RecursiveCharacterTextSplitter(
                        chunk_size=1000, chunk_overlap=200,
                        separators=["\n\n", "\n", " ", ""],
                    )
                file_chunks = splitter.create_documents(
                    [content], metadatas=[{"file_path": rel_path, "extension": ext}],
                )
                for i, chunk in enumerate(file_chunks):
                    content_before = content[: content.find(chunk.page_content)]
                    start_line = content_before.count("\n") + 1
                    end_line = start_line + chunk.page_content.count("\n")
                    chunk_id = hashlib.md5(
                        f"{rel_path}:{i}:{chunk.page_content[:50]}".encode()
                    ).hexdigest()
                    chunks.append({
                        "id": chunk_id, "content": chunk.page_content,
                        "file_path": rel_path, "start_line": start_line,
                        "end_line": end_line, "language": ext.lstrip("."),
                        "chunk_index": i,
                    })
            except Exception as e:
                logger.warning(f"Failed to process {file_path}: {e}")
        return chunks

    def _read_file(self, path: Path) -> str:
        raw = path.read_bytes()
        detected = chardet.detect(raw)
        encoding = detected.get("encoding") or "utf-8"
        try:
            return raw.decode(encoding, errors="ignore")
        except Exception:
            return raw.decode("utf-8", errors="ignore")

    async def _store_embeddings(self, repo_id: str, chunks: List[Dict[str, Any]]) -> None:
        client = _get_chroma_client()
        collection_name = f"repo_{repo_id.replace('-', '_')}"
        try:
            client.delete_collection(collection_name)
        except Exception:
            pass
        collection = client.get_or_create_collection(
            name=collection_name, metadata={"hnsw:space": "cosine"},
        )
        BATCH_SIZE = 50
        for i in range(0, len(chunks), BATCH_SIZE):
            batch = chunks[i: i + BATCH_SIZE]
            texts = [c["content"] for c in batch]
            embeddings = await asyncio.get_event_loop().run_in_executor(
                None, lambda t=texts: _embed(t)
            )
            collection.upsert(
                ids=[c["id"] for c in batch],
                embeddings=embeddings,
                documents=texts,
                metadatas=[{
                    "file_path": c["file_path"], "start_line": c["start_line"],
                    "end_line": c["end_line"], "language": c["language"],
                    "chunk_index": c["chunk_index"],
                } for c in batch],
            )
            logger.info(f"Stored batch {i//BATCH_SIZE + 1}/{(len(chunks)-1)//BATCH_SIZE + 1}")