"""
AIDebugger: Uses OpenRouter API directly (no LangChain required).
"""
import os
import json
import httpx
from typing import List, Dict, Any

import structlog
from tenacity import retry, stop_after_attempt, wait_exponential

logger = structlog.get_logger()

OPENROUTER_API_KEY = os.getenv("OPENAI_API_KEY") or os.getenv("OPENROUTER_API_KEY")
OPENROUTER_BASE = "https://openrouter.ai/api/v1"
PRIMARY_MODEL = os.getenv("LLM_MODEL", "openai/gpt-3.5-turbo")

SYSTEM_PROMPT = """You are an expert software debugger. Analyze the error and code context provided, then return ONLY a valid JSON object with exactly these fields:
{
  "root_cause": "concise root cause (1-2 sentences)",
  "explanation": "detailed technical explanation (3-5 sentences)",
  "affected_files": [{"path": "file path", "reason": "why relevant", "relevance_score": 0.9, "fix_description": "what to change"}],
  "suggested_fix": "high-level fix description",
  "code_fixes": [{"file_path": "path", "original_code": "old code", "fixed_code": "new code", "explanation": "why this fixes it"}],
  "confidence": 0.85
}
Output ONLY the JSON. No markdown, no explanation outside the JSON."""


class AIDebugger:
    def __init__(self):
        if not OPENROUTER_API_KEY:
            logger.warning("No API key found (OPENAI_API_KEY or OPENROUTER_API_KEY)")
        logger.info("AIDebugger ready")

    @retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=1, min=2, max=6))
    async def analyze(
        self,
        error_text: str,
        error_type: str,
        code_chunks: List[Dict[str, Any]],
        repo_full_name: str,
    ) -> Dict[str, Any]:
        code_context = self._format_code_context(code_chunks)
        user_message = f"""## Error to Debug

**Type**: {error_type}
**Repository**: {repo_full_name}

**Error**:
```
{error_text[:3000]}
```

## Relevant Code Context

{code_context}

Analyze and return the JSON object as instructed."""

        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                f"{OPENROUTER_BASE}/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "http://localhost:3000",
                },
                json={
                    "model": PRIMARY_MODEL,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_message},
                    ],
                    "max_tokens": 4096,
                    "temperature": 0.1,
                },
            )
            response.raise_for_status()
            data = response.json()

        content = data["choices"][0]["message"]["content"]
        model_used = data.get("model", PRIMARY_MODEL)
        tokens_used = data.get("usage", {}).get("total_tokens", 0)

        try:
            analysis = self._extract_json(content)
        except Exception as e:
            logger.warning(f"JSON parse failed: {e}")
            analysis = {
                "root_cause": "Could not parse AI response",
                "explanation": content[:500],
                "affected_files": [],
                "suggested_fix": "See explanation",
                "code_fixes": [],
                "confidence": 0.1,
            }

        analysis["affected_files"] = self._enrich_affected_files(
            analysis.get("affected_files", []), code_chunks
        )
        analysis["model"] = model_used
        analysis["tokens_used"] = tokens_used
        analysis.setdefault("code_fixes", [])

        logger.info("Analysis complete",
                    confidence=analysis.get("confidence"),
                    model=model_used,
                    files=len(analysis["affected_files"]))
        return analysis

    def _format_code_context(self, chunks: List[Dict[str, Any]]) -> str:
        sections = []
        for i, chunk in enumerate(chunks, 1):
            sections.append(
                f"### [{i}] {chunk['file_path']} "
                f"(lines {chunk['start_line']}-{chunk['end_line']}) "
                f"— relevance: {chunk['relevance_score']:.2f}\n\n"
                f"```{chunk['language']}\n{chunk['content']}\n```"
            )
        return "\n\n".join(sections)

    def _enrich_affected_files(self, affected_files, chunks):
        chunk_map = {}
        for chunk in chunks:
            chunk_map.setdefault(chunk["file_path"], []).append(chunk)
        enriched = []
        for f in affected_files:
            if hasattr(f, "model_dump"):
                f = f.model_dump()
            path = f.get("path", "")
            f["snippets"] = [
                {
                    "filePath": c["file_path"],
                    "content": c["content"][:500],
                    "startLine": c["start_line"],
                    "endLine": c["end_line"],
                }
                for c in chunk_map.get(path, [])[:3]
            ]
            enriched.append(f)
        return enriched

    def _extract_json(self, content: str) -> Dict[str, Any]:
        import re
        match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", content, re.DOTALL)
        if match:
            return json.loads(match.group(1))
        start = content.find("{")
        end = content.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(content[start:end])
        raise ValueError("No JSON found in response")