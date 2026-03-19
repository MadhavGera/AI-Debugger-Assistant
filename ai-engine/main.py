import os
import sys
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import structlog

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    stream=sys.stdout,
)

logger = structlog.get_logger()

# ── Lazy singletons — never instantiated at import time ────
_indexer = None
_searcher = None
_debugger = None
_patch_gen = None


def get_indexer():
    global _indexer
    if _indexer is None:
        from src.embeddings.indexer import RepositoryIndexer
        _indexer = RepositoryIndexer()
    return _indexer


def get_searcher():
    global _searcher
    if _searcher is None:
        from src.retrieval.searcher import VectorSearcher
        _searcher = VectorSearcher()
    return _searcher


def get_debugger():
    global _debugger
    if _debugger is None:
        from src.analysis.debugger import AIDebugger
        _debugger = AIDebugger()
    return _debugger


def get_patch_gen():
    global _patch_gen
    if _patch_gen is None:
        from src.patch.generator import PatchGenerator
        _patch_gen = PatchGenerator()
    return _patch_gen


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("AI Engine starting up...")
    try:
        get_patch_gen()
        logger.info("PatchGenerator ready")

        chroma_host = os.getenv("CHROMA_HOST", "chromadb")
        chroma_port = int(os.getenv("CHROMA_PORT", "8000"))
        try:
            import chromadb
            client = chromadb.HttpClient(host=chroma_host, port=chroma_port)
            client.heartbeat()
            get_indexer()
            get_searcher()
            logger.info(f"ChromaDB connected at {chroma_host}:{chroma_port}")
        except Exception as e:
            logger.warning(f"ChromaDB not reachable: {e} — will retry on first request")

        openai_key = os.getenv("OPENAI_API_KEY", "")
        gemini_key = os.getenv("GEMINI_API_KEY", "")
        if openai_key and not openai_key.startswith("sk-..."):
            logger.info("OpenAI API key found")
        if gemini_key:
            logger.info("Gemini API key found")
        if not openai_key and not gemini_key:
            logger.warning("No AI API keys set — analysis will fail")

        try:
            get_debugger()
            logger.info("AIDebugger ready")
        except Exception as e:
            logger.warning(f"AIDebugger init: {e}")

        logger.info("AI Engine startup complete — health endpoint active")
    except Exception as e:
        logger.error(f"Startup error (non-fatal, service still running): {e}")

    yield
    logger.info("AI Engine shutting down")


app = FastAPI(title="AI GitHub Debugger - AI Engine", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class IndexRequest(BaseModel):
    owner: str
    repo: str
    token: str
    repoId: str


class IndexResponse(BaseModel):
    success: bool
    repoId: str
    fileCount: int
    chunkCount: int
    message: str


class AnalyzeRequest(BaseModel):
    repoId: str
    repoFullName: str
    errorText: str
    errorType: str


class AnalyzeResponse(BaseModel):
    rootCause: str
    explanation: str
    affectedFiles: list
    suggestedFix: str
    patch: str
    patchPreview: list
    confidence: float
    model: str
    tokensUsed: int


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ai-engine", "version": "1.0.0"}


@app.post("/index", response_model=IndexResponse)
async def index_repository(req: IndexRequest):
    try:
        logger.info("Indexing repository", owner=req.owner, repo=req.repo)
        result = await get_indexer().index(
            owner=req.owner, repo=req.repo, token=req.token, repo_id=req.repoId,
        )
        return IndexResponse(
            success=True,
            repoId=req.repoId,
            fileCount=result["file_count"],
            chunkCount=result["chunk_count"],
            message=f"Indexed {result['file_count']} files into {result['chunk_count']} chunks",
        )
    except Exception as e:
        logger.error("Indexing failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze_error(req: AnalyzeRequest):
    try:
        logger.info("Analyzing error", repo=req.repoFullName, type=req.errorType)
        chunks = await get_searcher().search(repo_id=req.repoId, query=req.errorText, top_k=8)
        if not chunks:
            raise HTTPException(status_code=404, detail="No relevant code found. Index the repository first.")

        analysis = await get_debugger().analyze(
            error_text=req.errorText,
            error_type=req.errorType,
            code_chunks=chunks,
            repo_full_name=req.repoFullName,
        )
        patch_data = get_patch_gen().generate(analysis=analysis, code_chunks=chunks)

        return AnalyzeResponse(
            rootCause=analysis["root_cause"],
            explanation=analysis["explanation"],
            affectedFiles=analysis["affected_files"],
            suggestedFix=analysis["suggested_fix"],
            patch=patch_data["raw_patch"],
            patchPreview=patch_data["hunks"],
            confidence=analysis["confidence"],
            model=analysis["model"],
            tokensUsed=analysis.get("tokens_used", 0),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Analysis failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, workers=1, log_level="info")