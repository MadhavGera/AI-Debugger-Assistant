with open('/app/src/retrieval/searcher.py') as f:
    c = f.read()

search_method = """
    async def search(self, repo_id: str, query: str, top_k: int = 8, min_score: float = 0.3):
        import asyncio
        collection_name = f"repo_{repo_id.replace('-', '_')}"
        try:
            collection = self.chroma_client.get_collection(collection_name)
        except Exception:
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
"""

if "async def search" not in c:
    c = c.rstrip() + "\n" + search_method + "\n"
    with open('/app/src/retrieval/searcher.py', 'w') as f:
        f.write(c)
    print("search method added successfully")
else:
    print("search method already exists")

# Verify
import subprocess
result = subprocess.run(['grep', '-n', 'def ', '/app/src/retrieval/searcher.py'], capture_output=True, text=True)
print(result.stdout)