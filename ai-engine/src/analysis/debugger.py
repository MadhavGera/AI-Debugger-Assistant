"""
AIDebugger: LangChain-powered analysis engine with support for:
  - Google Gemini (gemini-1.5-pro / gemini-2.0-flash)
  - OpenAI GPT-4.1 / gpt-4o-mini
  - Auto-selects based on which API keys are present
"""
import os
import json
from typing import List, Dict, Any

import structlog
from langchain.prompts import ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate
from langchain.output_parsers import PydanticOutputParser
from pydantic import BaseModel, Field
from tenacity import retry, stop_after_attempt, wait_exponential

logger = structlog.get_logger()


# ── Structured Output Schema ───────────────────────────────
class AffectedFile(BaseModel):
    path: str = Field(description="File path relative to repo root")
    reason: str = Field(description="Why this file is relevant to the bug")
    relevance_score: float = Field(description="0.0 to 1.0 relevance score")
    fix_description: str = Field(description="What needs to change in this file")


class CodeFix(BaseModel):
    file_path: str = Field(description="File to modify")
    original_code: str = Field(description="Original code snippet to replace")
    fixed_code: str = Field(description="Fixed code snippet")
    explanation: str = Field(description="Why this change fixes the bug")


class DebugAnalysis(BaseModel):
    root_cause: str = Field(description="Concise root cause of the bug (1-2 sentences)")
    explanation: str = Field(description="Detailed technical explanation (3-5 sentences)")
    affected_files: List[AffectedFile] = Field(description="Files involved in the bug")
    suggested_fix: str = Field(description="High-level description of the fix")
    code_fixes: List[CodeFix] = Field(description="Specific code changes to apply")
    confidence: float = Field(description="Confidence in the analysis (0.0 to 1.0)", ge=0, le=1)


SYSTEM_PROMPT = """You are an expert software debugger and code analyst. You analyze software errors and generate precise, working fixes.

Your analysis must be:
- ACCURATE: Base your analysis only on the provided code context
- SPECIFIC: Point to exact files and line ranges
- ACTIONABLE: Generate code fixes that actually work
- CONSERVATIVE: Only modify what is necessary to fix the bug

When generating code fixes:
- Preserve the existing code style and indentation exactly
- Make minimal changes — only what is needed to fix the bug
- Never introduce new dependencies not already in the codebase
- Add null/undefined checks when accessing potentially missing values
- Handle edge cases the original code missed

Output ONLY valid JSON matching the schema. No markdown, no explanations outside JSON."""

HUMAN_PROMPT = """## Error to Debug

**Type**: {error_type}
**Repository**: {repo_full_name}

**Error**:
```
{error_text}
```

## Relevant Code Context (retrieved via semantic search)

{code_context}

## Instructions

Analyze the error using the code context above. Generate root cause, explanation, affected files, code fixes, and confidence score.

{format_instructions}"""


class AIDebugger:
    def __init__(self):
        # All models are lazy — never instantiated until first use
        self._openai_primary = None
        self._openai_fallback = None
        self._gemini_primary = None
        self._gemini_fallback = None

        self.parser = PydanticOutputParser(pydantic_object=DebugAnalysis)
        self.prompt = ChatPromptTemplate.from_messages([
            SystemMessagePromptTemplate.from_template(SYSTEM_PROMPT),
            HumanMessagePromptTemplate.from_template(HUMAN_PROMPT),
        ])

    # ── Model getters (lazy) ───────────────────────────────
    def _get_openai_primary(self):
        if self._openai_primary is None:
            from langchain_openai import ChatOpenAI
            key = os.getenv("OPENAI_API_KEY", "")
            if not key or key.startswith("sk-..."):
                raise ValueError("OPENAI_API_KEY not set")
            self._openai_primary = ChatOpenAI(
                model="gpt-4.1", temperature=0.1,
                openai_api_key=key, max_tokens=4096,
            )
        return self._openai_primary

    def _get_openai_fallback(self):
        if self._openai_fallback is None:
            from langchain_openai import ChatOpenAI
            key = os.getenv("OPENAI_API_KEY", "")
            if not key or key.startswith("sk-..."):
                raise ValueError("OPENAI_API_KEY not set")
            self._openai_fallback = ChatOpenAI(
                model="gpt-4o-mini", temperature=0.1,
                openai_api_key=key, max_tokens=4096,
            )
        return self._openai_fallback

    def _get_gemini_primary(self):
        if self._gemini_primary is None:
            from langchain_google_genai import ChatGoogleGenerativeAI
            key = os.getenv("GEMINI_API_KEY", "")
            if not key:
                raise ValueError("GEMINI_API_KEY not set")
            self._gemini_primary = ChatGoogleGenerativeAI(
                model="gemini-1.5-pro",
                temperature=0.1,
                google_api_key=key,
                max_output_tokens=4096,
                convert_system_message_to_human=True,  # Gemini requirement
            )
        return self._gemini_primary

    def _get_gemini_fallback(self):
        if self._gemini_fallback is None:
            from langchain_google_genai import ChatGoogleGenerativeAI
            key = os.getenv("GEMINI_API_KEY", "")
            if not key:
                raise ValueError("GEMINI_API_KEY not set")
            self._gemini_fallback = ChatGoogleGenerativeAI(
                model="gemini-2.0-flash",
                temperature=0.1,
                google_api_key=key,
                max_output_tokens=4096,
                convert_system_message_to_human=True,
            )
        return self._gemini_fallback

    def _has_openai(self) -> bool:
        key = os.getenv("OPENAI_API_KEY", "")
        return bool(key) and not key.startswith("sk-...")

    def _has_gemini(self) -> bool:
        return bool(os.getenv("GEMINI_API_KEY", ""))

    # ── Build ordered model chain based on available keys ─
    def _get_model_chain(self) -> List[tuple]:
        """
        Returns [(model_getter, model_name), ...] in priority order.
        Priority: OpenAI GPT-4.1 > Gemini 1.5 Pro > GPT-4o-mini > Gemini Flash
        Falls back through the chain until one works.
        """
        chain = []
        if self._has_openai():
            chain.append((self._get_openai_primary, "gpt-4.1"))
        if self._has_gemini():
            chain.append((self._get_gemini_primary, "gemini-1.5-pro"))
        if self._has_openai():
            chain.append((self._get_openai_fallback, "gpt-4o-mini"))
        if self._has_gemini():
            chain.append((self._get_gemini_fallback, "gemini-2.0-flash"))
        if not chain:
            raise ValueError(
                "No AI API keys configured. Set OPENAI_API_KEY or GEMINI_API_KEY in your .env file."
            )
        return chain

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def analyze(
        self,
        error_text: str,
        error_type: str,
        code_chunks: List[Dict[str, Any]],
        repo_full_name: str,
    ) -> Dict[str, Any]:
        """Run full AI analysis and return structured result."""

        code_context = self._format_code_context(code_chunks)
        messages = self.prompt.format_messages(
            error_type=error_type,
            repo_full_name=repo_full_name,
            error_text=error_text[:3000],
            code_context=code_context,
            format_instructions=self.parser.get_format_instructions(),
        )

        model_chain = self._get_model_chain()
        last_error = None
        response = None
        model_name = "unknown"

        for get_model, name in model_chain:
            try:
                logger.info(f"Trying model: {name}")
                response = await get_model().ainvoke(messages)
                model_name = name
                logger.info(f"Model {name} responded successfully")
                break
            except Exception as e:
                logger.warning(f"Model {name} failed: {e}")
                last_error = e
                continue

        if response is None:
            raise ValueError(f"All models failed. Last error: {last_error}")

        # Parse structured output
        try:
            analysis = self.parser.parse(response.content)
            result = analysis.model_dump()
        except Exception as e:
            logger.warning(f"Pydantic parser failed: {e} — trying JSON extraction")
            result = self._extract_json_fallback(response.content)

        # Enrich affected files with retrieved chunk snippets
        result["affected_files"] = self._enrich_affected_files(
            result.get("affected_files", []), code_chunks
        )
        result["model"] = model_name
        result["tokens_used"] = (
            response.response_metadata.get("token_usage", {}).get("total_tokens", 0)
            if hasattr(response, "response_metadata") else 0
        )

        logger.info(
            "Analysis complete",
            confidence=result.get("confidence"),
            model=model_name,
            affected_files=len(result.get("affected_files", [])),
        )
        return result

    def _format_code_context(self, chunks: List[Dict[str, Any]]) -> str:
        sections = []
        for i, chunk in enumerate(chunks, 1):
            section = (
                f"### [{i}] {chunk['file_path']} "
                f"(lines {chunk['start_line']}-{chunk['end_line']}) "
                f"— relevance: {chunk['relevance_score']:.2f}\n\n"
                f"```{chunk['language']}\n{chunk['content']}\n```"
            )
            sections.append(section)
        return "\n\n".join(sections)

    def _enrich_affected_files(
        self,
        affected_files: List[Any],
        chunks: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        chunk_map: Dict[str, List[Dict]] = {}
        for chunk in chunks:
            chunk_map.setdefault(chunk["file_path"], []).append(chunk)

        enriched = []
        for f in affected_files:
            if hasattr(f, "model_dump"):
                f = f.model_dump()
            elif not isinstance(f, dict):
                f = dict(f)
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

    def _extract_json_fallback(self, content: str) -> Dict[str, Any]:
        import re
        match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", content, re.DOTALL)
        if match:
            return json.loads(match.group(1))
        start = content.find("{")
        end = content.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(content[start:end])
        raise ValueError("Could not extract JSON from AI response")