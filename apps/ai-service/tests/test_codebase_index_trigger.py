# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""索引触发链测试(2026-09-07 立)。

审计发现 index_repository 全仓零调用方 → 语义/混合检索在生产运行时永远空表。
修复 = ① index_codebase MCP 工具 ② search_codebase 懒索引 ③ 内部服务鉴权通道。
本文件验证三者的行为契约。
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.services import mcp_server
from app.services.codebase_indexer import CodebaseIndexer


def _make_indexer() -> CodebaseIndexer:
    idx = CodebaseIndexer.__new__(CodebaseIndexer)
    idx._tree_sitter_available = False
    idx._api_base_url = "http://localhost:8801"
    return idx


class TestInternalAuthHeaders:
    """_internal_auth_headers:Bearer 优先 / 内部通道回退 / 无凭证空表。"""

    def test_bearer_priority(self):
        idx = _make_indexer()
        headers = idx._internal_auth_headers("tok-123", "some-user")
        assert headers == {"Authorization": "Bearer tok-123"}

    def test_internal_channel_fallback(self, monkeypatch):
        monkeypatch.setenv("AI_CALLBACK_SECRET", "svc-secret")
        idx = _make_indexer()
        headers = idx._internal_auth_headers(None, "6b8cd0f6-546f-44c8-853a-5f96edbe08be")
        assert headers == {
            "x-internal-service-token": "svc-secret",
            "x-user-id": "6b8cd0f6-546f-44c8-853a-5f96edbe08be",
        }

    def test_internal_channel_rejects_bad_user_id(self, monkeypatch):
        monkeypatch.setenv("AI_CALLBACK_SECRET", "svc-secret")
        idx = _make_indexer()
        # 注入字符不在白名单 → 拒绝,返回空(防 X-User-Id 欺骗)
        assert idx._internal_auth_headers(None, "bad user!") == {}
        assert idx._internal_auth_headers(None, "") == {}

    def test_no_credentials_empty(self, monkeypatch):
        monkeypatch.delenv("AI_CALLBACK_SECRET", raising=False)
        idx = _make_indexer()
        assert idx._internal_auth_headers(None, None) == {}
        # 有 secret 无 user_id 也不发
        monkeypatch.setenv("AI_CALLBACK_SECRET", "svc-secret")
        assert idx._internal_auth_headers(None, None) == {}


class TestIndexCodebaseTool:
    """_tool_index_codebase:参数透传与结果映射。"""

    @pytest.mark.asyncio
    async def test_missing_path_rejected(self):
        out = await mcp_server._tool_index_codebase({})
        assert out["ok"] is False
        assert "path" in out["error"]

    @pytest.mark.asyncio
    async def test_success_passthrough(self, tmp_path):
        fake_result = SimpleNamespace(
            repo_id="repo-x",
            files_scanned=10,
            files_indexed=3,
            files_unchanged=6,
            files_deleted=1,
            chunks_created=30,
            chunks_vectorized=30,
            merkle_root="abc",
            errors=[],
        )
        captured: dict = {}

        async def fake_index(repo_path, repo_id=None, incremental=True, internal_user_id=None):
            captured.update(
                repo_path=repo_path,
                repo_id=repo_id,
                incremental=incremental,
                internal_user_id=internal_user_id,
            )
            return fake_result

        with patch("app.services.codebase_indexer.codebase_indexer") as mock_idx:
            mock_idx.index_repository = fake_index
            out = await mcp_server._tool_index_codebase(
                {
                    "path": str(tmp_path),
                    "repo_id": "repo-x",
                    "force_full": True,
                    "__user_id": "user-abc-123",
                }
            )
        assert out["ok"] is True
        assert out["files_indexed"] == 3
        assert out["files_unchanged"] == 6
        assert captured["repo_path"] == str(tmp_path)
        assert captured["repo_id"] == "repo-x"
        assert captured["incremental"] is False  # force_full=True
        assert captured["internal_user_id"] == "user-abc-123"

    @pytest.mark.asyncio
    async def test_error_surface(self):
        with patch("app.services.codebase_indexer.codebase_indexer") as mock_idx:
            mock_idx.index_repository = AsyncMock(side_effect=RuntimeError("boom"))
            out = await mcp_server._tool_index_codebase({"path": "whatever"})
        assert out["ok"] is False
        assert "boom" in out["error"]


class TestLazyIndexAndResearch:
    """_lazy_index_and_research:护栏(目录校验/文件数上限/冷却)与重搜。"""

    @pytest.mark.asyncio
    async def test_nonexistent_dir_returns_empty(self):
        idx = _make_indexer()
        out = await mcp_server._lazy_index_and_research(idx, "q", "Z:/no/such/dir", 5)
        assert out == []

    @pytest.mark.asyncio
    async def test_indexes_then_researches(self, tmp_path, monkeypatch):
        (tmp_path / "a.py").write_text("def f():\n    pass\n")
        idx = _make_indexer()
        idx._collect_code_files = lambda root: [("a.py", "python")]
        idx.index_repository = AsyncMock(return_value=SimpleNamespace(errors=[]))
        idx.search = AsyncMock(return_value=[{"filePath": "a.py", "score": 0.9}])
        monkeypatch.setattr(mcp_server, "_LAZY_INDEX_LAST_RUN", {})
        out = await mcp_server._lazy_index_and_research(idx, "query", str(tmp_path), 5)
        assert out == [{"filePath": "a.py", "score": 0.9}]
        idx.index_repository.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_cooldown_skips_reindex(self, tmp_path, monkeypatch):
        (tmp_path / "a.py").write_text("def f():\n    pass\n")
        idx = _make_indexer()
        idx._collect_code_files = lambda root: [("a.py", "python")]
        idx.index_repository = AsyncMock(return_value=SimpleNamespace(errors=[]))
        idx.search = AsyncMock(return_value=[])
        monkeypatch.setattr(mcp_server, "_LAZY_INDEX_LAST_RUN", {})
        await mcp_server._lazy_index_and_research(idx, "q1", str(tmp_path), 5)
        await mcp_server._lazy_index_and_research(idx, "q2", str(tmp_path), 5)
        # 冷却期内第二次不触发索引
        assert idx.index_repository.await_count == 1

    @pytest.mark.asyncio
    async def test_oversized_repo_skipped(self, tmp_path, monkeypatch):
        (tmp_path / "a.py").write_text("pass\n")
        idx = _make_indexer()
        idx._collect_code_files = lambda root: [(f"f{i}.py", "python") for i in range(mcp_server._LAZY_INDEX_MAX_FILES + 1)]
        idx.index_repository = AsyncMock()
        monkeypatch.setattr(mcp_server, "_LAZY_INDEX_LAST_RUN", {})
        out = await mcp_server._lazy_index_and_research(idx, "q", str(tmp_path), 5)
        assert out == []
        idx.index_repository.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_index_failure_silent(self, tmp_path, monkeypatch):
        (tmp_path / "a.py").write_text("def f():\n    pass\n")
        idx = _make_indexer()
        idx._collect_code_files = lambda root: [("a.py", "python")]
        idx.index_repository = AsyncMock(side_effect=RuntimeError("embed down"))
        monkeypatch.setattr(mcp_server, "_LAZY_INDEX_LAST_RUN", {})
        out = await mcp_server._lazy_index_and_research(idx, "q", str(tmp_path), 5)
        assert out == []


class TestRegistryConsistency:
    """index_codebase 必须同时登记 schema(_TOOLS)与 handler(_TOOL_HANDLERS)。"""

    def test_index_codebase_registered_both(self):
        names_in_tools = {t.name for t in mcp_server._TOOLS}
        assert "index_codebase" in names_in_tools
        assert "index_codebase" in mcp_server._TOOL_HANDLERS
        # 数量守门测试依赖两侧同步
        assert len(mcp_server._TOOLS) == len(mcp_server._TOOL_HANDLERS)
