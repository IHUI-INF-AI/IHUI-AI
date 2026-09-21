# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D7 auto_context 单元测试:注入命中 / 全局开关 / 防重复 / 索引缺失降级 / 空查询。"""

from __future__ import annotations

import importlib

import pytest


@pytest.fixture()
def ac(monkeypatch):
    """每用例重载模块(隔离防重复缓存与 env)。"""
    monkeypatch.delenv("IHUI_AUTO_CONTEXT_DISABLE", raising=False)
    import app.core.auto_context as auto_context

    importlib.reload(auto_context)
    return auto_context


def _fake_indexer(monkeypatch, results):
    from app.services import codebase_indexer as ci

    class _Fake:
        async def search(self, query, repo_id=None, language=None, top_k=10, api_token=None):
            return results[:top_k]

    monkeypatch.setattr(ci, "codebase_indexer", _Fake(), raising=False)


@pytest.mark.asyncio
async def test_auto_retrieve_hits(ac, monkeypatch):
    _fake_indexer(
        monkeypatch,
        [
            {
                "file_path": "apps/web/src/a.tsx",
                "line_start": 10,
                "line_end": 20,
                "content": "export function foo() {}",
                "score": 0.9,
            }
        ],
    )
    chunks = await ac.auto_retrieve("如何实现用户认证逻辑", session_id="s1")
    assert len(chunks) == 1
    assert chunks[0]["file_path"] == "apps/web/src/a.tsx"
    block = ac.format_auto_context_block(chunks)
    assert block is not None and "[auto-context]" in block and "a.tsx:10" in block


@pytest.mark.asyncio
async def test_auto_retrieve_disabled_by_env(ac, monkeypatch):
    monkeypatch.setenv("IHUI_AUTO_CONTEXT_DISABLE", "1")
    _fake_indexer(monkeypatch, [{"file_path": "a.ts", "content": "x"}])
    assert await ac.auto_retrieve("用户认证逻辑怎么写", session_id="s1") == []


@pytest.mark.asyncio
async def test_auto_retrieve_dedup_same_session(ac, monkeypatch):
    _fake_indexer(monkeypatch, [{"file_path": "a.ts", "content": "x"}])
    q = "用户认证逻辑怎么写"
    first = await ac.auto_retrieve(q, session_id="s1")
    second = await ac.auto_retrieve(q, session_id="s1")
    assert len(first) == 1
    assert second == []  # 60s 窗口内同会话同 query 不重复注入
    other = await ac.auto_retrieve(q, session_id="s2")
    assert len(other) == 1  # 不同会话不受影响


@pytest.mark.asyncio
async def test_auto_retrieve_short_query_skipped(ac, monkeypatch):
    _fake_indexer(monkeypatch, [{"file_path": "a.ts", "content": "x"}])
    assert await ac.auto_retrieve("hi", session_id="s1") == []


@pytest.mark.asyncio
async def test_auto_retrieve_index_failure_degrades(ac, monkeypatch):
    from app.services import codebase_indexer as ci

    class _Boom:
        async def search(self, *a, **k):
            raise RuntimeError("index down")

    monkeypatch.setattr(ci, "codebase_indexer", _Boom(), raising=False)
    assert await ac.auto_retrieve("用户认证逻辑怎么写", session_id="s1") == []


def test_format_block_empty(ac):
    assert ac.format_auto_context_block([]) is None
    assert ac.format_auto_context_block(None) is None  # type: ignore[arg-type]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
