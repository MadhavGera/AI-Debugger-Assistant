"""
VectorSearcher: Embeds an error query and retrieves the most
semantically relevant code chunks from ChromaDB using cosine similarity.
"""
import os
import asyncio
from typing import List, Dict, Any, Optional

import structlog
from langchain_openai import OpenAIEmbeddings
import chromadb

logger = structlog.get_logger()

CHROMA_HOST = os.getenv("CHROMA_HOST", "localhost")
CHROMA_PORT = int(os.getenv("CHROMA_PORT", "8001"))


class VectorSearcher:
    def __init__(self):
        self.embeddings = OpenAIEmbeddings(
            model_name="all-MiniLM-L6-v2"
        )
        self.chroma_client = chromadb.HttpClient(
            host=CHROMA_HOST,
            port=CHROMA_PORT,
        )

    async def search(
        self,
        repo_id: str,
        query: str,
        top_k: int = 8,
        min_score: float = 0.3,
    ) -> List[Dict[str, Any]]:
        """
        Embed the query and find the top-k most similar code chunks.

        Returns list of chunks with content, metadata, and relevance scores.
        """
        collection_name = f"repo_{repo_id.replace('-', '_')}"

        try:
            collection = self.chroma_client.get_collection(collection_name)
        except Exception:
            logger.warning(f"Collection not found: {collection_name}")
            return []

        # Pre-process query for better retrieval
        enriched_query = self._enrich_query(query)

        # Embed query
        query_embedding = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: self.embeddings.embed_query(enriched_query),
        )

        # Search ChromaDB
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=min(top_k * 2, 20),  # Over-fetch, then filter
            include=["documents", "metadatas", "distances"],
        )

        chunks = []
        docs = results.get("documents", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[]])[0]

        for doc, meta, dist in zip(docs, metadatas, distances):
            # ChromaDB cosine distance: 0 = identical, 2 = opposite
            # Convert to similarity score 0-1
            similarity = 1 - (dist / 2)

            if similarity < min_score:
                continue

            chunks.append({
                "content": doc,
                "file_path": meta.get("file_path", ""),
                "start_line": meta.get("start_line", 0),
                "end_line": meta.get("end_line", 0),
                "language": meta.get("language", ""),
                "relevance_score": round(similarity, 4),
            })

        # Sort by relevance, take top_k
        chunks.sort(key=lambda x: x["relevance_score"], reverse=True)
        return chunks[:top_k]

    def _enrich_query(self, error_text: str) -> str:
        """
        Extract key terms from the error to improve vector search.
        Adds code-relevant context to the query embedding.
        """
        lines = error_text.split("\n")
        # Take first 5 most informative lines
        key_lines = [l.strip() for l in lines if l.strip() and len(l.strip()) > 5][:5]

        # Extract function/class names from stack traces
        identifiers = []
        for line in lines:
            # Match "at FunctionName" or "File.method" patterns
            parts = line.strip().split()
            for part in parts:
                if "." in part and not part.startswith("http"):
                    identifiers.append(part.split("(")[0])

        enriched = "\n".join(key_lines)
        if identifiers:
            enriched += "\n\nRelated identifiers: " + ", ".join(identifiers[:10])

        return enriched

    async def get_file_content(
        self,
        repo_id: str,
        file_path: str,
    ) -> Optional[str]:
        """Retrieve all chunks for a specific file and reconstruct content."""
        collection_name = f"repo_{repo_id.replace('-', '_')}"

        try:
            collection = self.chroma_client.get_collection(collection_name)
        except Exception:
            return None

        results = collection.get(
            where={"file_path": file_path},
            include=["documents", "metadatas"],
        )

        if not results["documents"]:
            return None

        # Sort by chunk_index and join
        paired = list(zip(results["documents"], results["metadatas"]))
        paired.sort(key=lambda x: x[1].get("chunk_index", 0))

        return "\n".join(doc for doc, _ in paired)
