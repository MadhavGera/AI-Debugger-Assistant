"""
VectorSearcher: Embed query via SentenceTransformer -> cosine search in ChromaDB.
"""
import os
import asyncio
from typing import List, Dict, Any, Optional

import structlog
import chromadb
from sentence_transformers import SentenceTransformer

logger = structlog.get_logger()

CHROMA_HOST = os.getenv("CHROMA_HOST", "localhost")
CHROMA_PORT = int(os.getenv("CHROMA_PORT", "8000"))

_st_model = SentenceTransformer("all-MiniLM-L6-v2")


class VectorSearcher:
    def __init__(self):
        self.chroma_client = chromadb.HttpClient(
            host=CHROMA_HOST,
            port=CHROMA_PORT,
            tenant=chromadb.DEFAULT_TENANT,
            database=chromadb.DEFAULT_DATABASE,
        )

    def _embed_query(self, text: str) -> List[float]:
        return _st_model.encode([text])[0].tolist()

    def _enrich_query(self, error_text: str) -> str:
        lines = error_text.split("\n")
        key_lines = [l.strip() for l in lines if l.strip() and len(l.strip()) > 5][:5]
        identifiers = []
        for line in lines:
            for part in line.strip().split():
                if "." in part and not part.startswith("http"):
                    identifiers.append(part.split("(")[0])
        enriched = "\n".join(key_lines)
        if identifiers:
            enriched += "\n\nRelated identifiers: " + ", ".join(identifiers[:10])
        return enriched

    async def search(
        self,
        repo_id: str,
        query: str,
        top_k: int = 8,
        min_score: float = 0.3,
    ) -> List[Dict[str, Any]]:
        collection_name = f"repo_{repo_id.replace('-', '_')}"
        try:
            collection = self.chroma_client.get_collection(collection_name)
        except Exception:
            logger.warning(f"Collection not found: {collection_name}")
            return []

        enriched = self._enrich_query(query)
        query_embedding = await asyncio.get_event_loop().run_in_executor(
            None, lambda: self._embed_query(enriched)
        )
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=min(top_k * 2, 20),
            include=["documents", "metadatas", "distances"],
        )
        chunks = []
        for doc, meta, dist in zip(
            results.get("documents", [[]])[0],
            results.get("metadatas", [[]])[0],
            results.get("distances", [[]])[0],
        ):
            sim = 1 - (dist / 2)
            if sim < min_score:
                continue
            chunks.append({
                "content": doc,
                "file_path": meta.get("file_path", ""),
                "start_line": meta.get("start_line", 0),
                "end_line": meta.get("end_line", 0),
                "language": meta.get("language", ""),
                "relevance_score": round(sim, 4),
            })
        chunks.sort(key=lambda x: x["relevance_score"], reverse=True)
        return chunks[:top_k]