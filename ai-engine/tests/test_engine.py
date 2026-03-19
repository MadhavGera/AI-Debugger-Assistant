"""
AI Engine Test Suite
Run: pytest tests/ -v
"""
import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient

# ── Import app after mocking external deps ────────────────
@pytest.fixture(scope="session", autouse=True)
def mock_external_services():
    """Mock all external services for testing."""
    with patch("chromadb.HttpClient") as mock_chroma, \
         patch("langchain_openai.OpenAIEmbeddings") as mock_embed, \
         patch("langchain_openai.ChatOpenAI") as mock_llm:

        # ChromaDB mock
        mock_collection = MagicMock()
        mock_collection.query.return_value = {
            "documents": [["def get_users():\n    return users.map(lambda u: u)"]],
            "metadatas": [[{
                "file_path": "src/users.py",
                "start_line": 10,
                "end_line": 25,
                "language": "py",
                "chunk_index": 0,
            }]],
            "distances": [[0.15]],
        }
        mock_chroma.return_value.get_collection.return_value = mock_collection
        mock_chroma.return_value.get_or_create_collection.return_value = mock_collection

        # Embeddings mock
        mock_embed.return_value.embed_documents = MagicMock(return_value=[[0.1, 0.2, 0.3]])
        mock_embed.return_value.embed_query = MagicMock(return_value=[0.1, 0.2, 0.3])

        # LLM mock
        mock_response = MagicMock()
        mock_response.content = """{
            "root_cause": "users variable is None before iteration",
            "explanation": "The users list is fetched asynchronously but the map call happens before the data arrives, causing a NoneType iteration error.",
            "affected_files": [
                {
                    "path": "src/users.py",
                    "reason": "Contains the map call on potentially None users",
                    "relevance_score": 0.92,
                    "fix_description": "Add None check before map"
                }
            ],
            "suggested_fix": "Add a guard clause checking if users is not None before calling map",
            "code_fixes": [
                {
                    "file_path": "src/users.py",
                    "original_code": "return users.map(lambda u: u)",
                    "fixed_code": "return (users or []).map(lambda u: u)",
                    "explanation": "Use or [] to default to empty list if users is None"
                }
            ],
            "confidence": 0.88
        }"""
        mock_response.response_metadata = {"token_usage": {"total_tokens": 1250}}
        mock_llm.return_value.ainvoke = AsyncMock(return_value=mock_response)

        yield


from main import app

client = TestClient(app)


# ============================================================
# HEALTH CHECK
# ============================================================
class TestHealth:
    def test_health_returns_ok(self):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["service"] == "ai-engine"


# ============================================================
# VECTOR SEARCHER UNIT TESTS
# ============================================================
class TestVectorSearcher:
    def test_enrich_query_extracts_identifiers(self):
        from src.retrieval.searcher import VectorSearcher
        searcher = VectorSearcher()

        error = """TypeError: Cannot read property 'map' of undefined
  at UserList.render (UserList.jsx:12:15)
  at processChild (react-dom.development.js:3990)"""

        enriched = searcher._enrich_query(error)
        assert "UserList.render" in enriched or "UserList" in enriched
        assert len(enriched) > len(error.split("\n")[0])

    def test_enrich_query_handles_short_error(self):
        from src.retrieval.searcher import VectorSearcher
        searcher = VectorSearcher()
        enriched = searcher._enrich_query("NullPointerException")
        assert "NullPointerException" in enriched

    @pytest.mark.asyncio
    async def test_search_returns_chunks_with_scores(self):
        from src.retrieval.searcher import VectorSearcher
        searcher = VectorSearcher()

        results = await searcher.search(
            repo_id="test-repo-123",
            query="TypeError: cannot read property map of undefined",
            top_k=5,
        )

        assert isinstance(results, list)
        assert len(results) > 0
        assert "content" in results[0]
        assert "file_path" in results[0]
        assert "relevance_score" in results[0]
        assert 0 <= results[0]["relevance_score"] <= 1

    @pytest.mark.asyncio
    async def test_search_filters_low_relevance(self):
        from src.retrieval.searcher import VectorSearcher
        searcher = VectorSearcher()

        # All results below min_score threshold
        with patch.object(searcher, 'chroma_client') as mock_client:
            mock_col = MagicMock()
            mock_col.query.return_value = {
                "documents": [["some code"]],
                "metadatas": [[{"file_path": "file.py", "start_line": 1, "end_line": 5, "language": "py", "chunk_index": 0}]],
                "distances": [[1.5]],  # 1 - (1.5/2) = 0.25 < 0.3 threshold
            }
            mock_client.get_collection.return_value = mock_col

            results = await searcher.search(
                repo_id="test", query="test query", min_score=0.3
            )
            assert results == []


# ============================================================
# PATCH GENERATOR UNIT TESTS
# ============================================================
class TestPatchGenerator:
    def test_generates_unified_diff(self):
        from src.patch.generator import PatchGenerator
        gen = PatchGenerator()

        analysis = {
            "root_cause": "None check missing",
            "suggested_fix": "Add guard clause",
            "code_fixes": [
                {
                    "file_path": "src/users.py",
                    "original_code": "return users.map(lambda u: u.name)",
                    "fixed_code": "return (users or []).map(lambda u: u.name)",
                    "explanation": "Protect against None",
                }
            ],
        }
        chunks = [{"file_path": "src/users.py", "content": "...", "start_line": 1, "end_line": 5}]

        result = gen.generate(analysis=analysis, code_chunks=chunks)

        assert "raw_patch" in result
        assert "hunks" in result
        assert "src/users.py" in result["raw_patch"]
        assert "---" in result["raw_patch"]
        assert "+++" in result["raw_patch"]

    def test_handles_identical_code(self):
        from src.patch.generator import PatchGenerator
        gen = PatchGenerator()

        analysis = {
            "root_cause": "test",
            "suggested_fix": "test fix",
            "code_fixes": [
                {
                    "file_path": "src/file.py",
                    "original_code": "x = 1",
                    "fixed_code": "x = 1",  # identical
                    "explanation": "no change",
                }
            ],
        }
        chunks = [{"file_path": "src/file.py", "content": "x = 1", "start_line": 1, "end_line": 1}]

        result = gen.generate(analysis=analysis, code_chunks=chunks)
        # Should fall back to comment patch
        assert "raw_patch" in result
        assert "hunks" in result

    def test_fallback_when_no_code_fixes(self):
        from src.patch.generator import PatchGenerator
        gen = PatchGenerator()

        analysis = {"root_cause": "test", "suggested_fix": "add null check", "code_fixes": []}
        chunks = [{"file_path": "src/main.py", "content": "def main():\n    pass", "start_line": 1, "end_line": 2}]

        result = gen.generate(analysis=analysis, code_chunks=chunks)
        assert result["raw_patch"] is not None
        assert len(result["hunks"]) > 0

    def test_parse_diff_to_hunk_structure(self):
        from src.patch.generator import PatchGenerator
        gen = PatchGenerator()

        diff_lines = [
            "--- a/src/file.py",
            "+++ b/src/file.py",
            "@@ -10,4 +10,4 @@",
            " context line",
            "-old line",
            "+new line",
            " another context",
        ]
        hunk = gen._parse_diff_to_hunk(diff_lines, "src/file.py")

        assert hunk is not None
        assert hunk["filePath"] == "src/file.py"
        line_types = [l["type"] for l in hunk["lines"]]
        assert "addition" in line_types
        assert "deletion" in line_types
        assert "context" in line_types


# ============================================================
# AI DEBUGGER UNIT TESTS
# ============================================================
class TestAIDebugger:
    def test_format_code_context(self):
        from src.analysis.debugger import AIDebugger
        debugger = AIDebugger()

        chunks = [
            {
                "content": "def get_user(id):\n    return db.find(id)",
                "file_path": "src/users.py",
                "start_line": 5,
                "end_line": 8,
                "language": "py",
                "relevance_score": 0.92,
            }
        ]
        ctx = debugger._format_code_context(chunks)
        assert "src/users.py" in ctx
        assert "lines 5-8" in ctx
        assert "0.92" in ctx
        assert "get_user" in ctx

    def test_json_fallback_extraction(self):
        from src.analysis.debugger import AIDebugger
        debugger = AIDebugger()

        content = '''Some text before
```json
{"root_cause": "test", "explanation": "test exp", "affected_files": [], "suggested_fix": "fix it", "code_fixes": [], "confidence": 0.8}
```
Some text after'''
        result = debugger._extract_json_fallback(content)
        assert result["root_cause"] == "test"
        assert result["confidence"] == 0.8

    @pytest.mark.asyncio
    async def test_full_analysis_pipeline(self):
        from src.analysis.debugger import AIDebugger
        debugger = AIDebugger()

        chunks = [
            {
                "content": "return users.map(lambda u: u)",
                "file_path": "src/users.py",
                "start_line": 10,
                "end_line": 12,
                "language": "py",
                "relevance_score": 0.89,
            }
        ]

        result = await debugger.analyze(
            error_text="TypeError: 'NoneType' object is not iterable",
            error_type="message",
            code_chunks=chunks,
            repo_full_name="testuser/my-repo",
        )

        assert "root_cause" in result
        assert "explanation" in result
        assert "affected_files" in result
        assert "suggested_fix" in result
        assert "confidence" in result
        assert "model" in result
        assert 0 <= result["confidence"] <= 1


# ============================================================
# ANALYZE ENDPOINT INTEGRATION TEST
# ============================================================
class TestAnalyzeEndpoint:
    def test_analyze_returns_structured_response(self):
        response = client.post("/analyze", json={
            "repoId": "test-repo-123",
            "repoFullName": "testuser/my-repo",
            "errorText": "TypeError: 'NoneType' object is not iterable\n  at users.py:12",
            "errorType": "stacktrace",
        })

        assert response.status_code == 200
        data = response.json()

        assert "rootCause" in data
        assert "explanation" in data
        assert "affectedFiles" in data
        assert "suggestedFix" in data
        assert "patch" in data
        assert "patchPreview" in data
        assert "confidence" in data
        assert "model" in data
        assert isinstance(data["affectedFiles"], list)
        assert isinstance(data["patchPreview"], list)
        assert 0 <= data["confidence"] <= 1

    def test_analyze_requires_all_fields(self):
        response = client.post("/analyze", json={
            "repoId": "test-repo-123",
            # Missing errorText and errorType
        })
        assert response.status_code == 422

    def test_index_endpoint_structure(self):
        with patch("src.embeddings.indexer.RepositoryIndexer.index") as mock_index:
            mock_index.return_value = {"file_count": 42, "chunk_count": 189}

            response = client.post("/index", json={
                "owner": "testuser",
                "repo": "my-repo",
                "token": "ghp_testtoken",
                "repoId": "test-repo-123",
            })

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["fileCount"] == 42
            assert data["chunkCount"] == 189
