# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# -*- coding: utf-8 -*-
"""editor_state 入上下文索引侧的接线测试(2026-10-31 立,gap#4 对标 Trae T2§1.3)。

覆盖维度:
1. 门控 env 矩阵(默认 off + on/off 取值形态)
2. 默认关路径 = 与新增前逐字节等价(不重排 / 不改分 / 不写 metadata)
3. 默认开路径 = editor_state 真进了检索优先级(活动文件 > 同目录 > 其他)
4. 光标邻域加成与封顶
5. normalize_editor_state 的失效方向(丢弃而非猜)
6. EnrichRequest / enrich_endpoint 的入参透传(未传即 None,老调用方零影响)
7. 检索腿不碰 Redis / PG(测试隔离铁律)
"""

from __future__ import annotations

import sys
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.context_engine import (
    EDITOR_ACTIVE_FILE_BOOST,
    EDITOR_BOOST_CAP,
    EDITOR_CURSOR_NEIGHBOUR_BOOST,
    EDITOR_SAME_DIR_BOOST,
    ContextEngine,
    EnrichRequest,
    _editor_state_enabled_from_env,
    editor_proximity_boost,
    enrich_endpoint,
    normalize_editor_state,
)

GATE_ENV = "ENGINE_EDITOR_STATE_ENABLED"


@pytest.fixture(autouse=True)
def _gate_default_off(monkeypatch):
    """每条用例起点 = 门未设置(生产默认形态),杜绝跨用例 env 泄漏。"""
    monkeypatch.delenv(GATE_ENV, raising=False)


def _install_fake_indexer(monkeypatch, chunks: list[dict[str, Any]], calls: list[dict[str, Any]]):
    """把 codebase_indexer 换成假模块(零 httpx / 零 PG / 零 Redis)。

    `_search_codebase` 内部是延迟导入 `from .codebase_indexer import codebase_indexer`,
    故必须替换 sys.modules 里的模块对象本身,而不是替换属性。
    """

    async def _search(
        query: str,
        repo_id: str | None = None,
        language: str | None = None,
        top_k: int = 10,
        api_token: str | None = None,
        internal_user_id: str | None = None,
    ) -> list[dict[str, Any]]:
        calls.append(
            {
                "query": query,
                "repo_id": repo_id,
                "language": language,
                "top_k": top_k,
                "api_token": api_token,
                "internal_user_id": internal_user_id,
            }
        )
        return [dict(c) for c in chunks]

    fake = MagicMock()
    fake.codebase_indexer = MagicMock()
    fake.codebase_indexer.search = _search
    monkeypatch.setitem(sys.modules, "app.services.codebase_indexer", fake)
    return fake


def _chunk(file_path: str, score: float, start: int, end: int) -> dict[str, Any]:
    return {
        "file_path": file_path,
        "line_start": start,
        "line_end": end,
        "content": f"# {file_path}:{start}-{end}",
        "symbol_name": None,
        "symbol_type": None,
        "language": "python",
        "score": score,
    }


SAMPLE_CHUNKS = [
    _chunk("apps/api/src/routes/chat.ts", 0.91, 10, 40),
    _chunk("apps/web/src/components/editor/use-edit-intent.ts", 0.30, 60, 90),
    _chunk("apps/web/src/components/editor/CodeEditor.tsx", 0.55, 750, 810),
]

ACTIVE_FILE = "apps/web/src/components/editor/CodeEditor.tsx"
SAME_DIR_FILE = "apps/web/src/components/editor/use-edit-intent.ts"
UNRELATED_FILE = "apps/api/src/routes/chat.ts"


async def _run_search(engine: ContextEngine, monkeypatch, **kwargs) -> list[Any]:
    calls: list[dict[str, Any]] = []
    _install_fake_indexer(monkeypatch, SAMPLE_CHUNKS, calls)
    redis_spy = AsyncMock(side_effect=AssertionError("_search_codebase 不许碰 Redis"))
    monkeypatch.setattr(engine, "_get_redis", redis_spy)
    results = await engine._search_codebase("编辑器", **kwargs)
    assert redis_spy.await_count == 0
    return results


def _shape(results: list[Any]) -> list[tuple[str, float, dict[str, Any]]]:
    return [(r.content, r.score, dict(r.metadata)) for r in results]


# ════════════════════════════════════════════════════════════════════════
# 1. 门控 env
# ════════════════════════════════════════════════════════════════════════


def test_gate_defaults_off():
    assert _editor_state_enabled_from_env() is False


@pytest.mark.parametrize("value", ["on", "1", "true", "yes", "ON", " YES "])
def test_gate_on_values(monkeypatch, value):
    monkeypatch.setenv(GATE_ENV, value)
    assert _editor_state_enabled_from_env() is True


@pytest.mark.parametrize("value", ["", "0", "false", "no", "off", "maybe"])
def test_gate_invalid_values_are_off(monkeypatch, value):
    monkeypatch.setenv(GATE_ENV, value)
    assert _editor_state_enabled_from_env() is False


# ════════════════════════════════════════════════════════════════════════
# 2. 默认关路径:与新增前逐字节等价(灰度安全)
# ════════════════════════════════════════════════════════════════════════


async def test_off_path_is_byte_identical_to_legacy(monkeypatch):
    """门未设置时,带 editor_state 的调用结果必须与不带时逐字节相同。"""
    engine = ContextEngine()
    editor_state = {"active_file": "apps/web/src/components/editor/CodeEditor.tsx", "cursor_line": 780}

    legacy = _shape(await _run_search(engine, monkeypatch))
    with_editor = _shape(await _run_search(engine, monkeypatch, editor_state=editor_state))

    assert with_editor == legacy
    # 顺序仍是索引侧返回的语义序(未重排)、分值原样(未加权)、metadata 未新增键
    assert [c for c, _s, _m in legacy] == [c["content"] for c in SAMPLE_CHUNKS]
    assert [s for _c, s, _m in legacy] == [c["score"] for c in SAMPLE_CHUNKS]
    for _c, _s, meta in legacy:
        assert "editor_proximity" not in meta


async def test_off_path_indexer_call_shape_unchanged(monkeypatch):
    """默认关也不得多传参数给 codebase_indexer(其签名与脏标算法是单源,不碰)。"""
    engine = ContextEngine()
    calls: list[dict[str, Any]] = []
    _install_fake_indexer(monkeypatch, SAMPLE_CHUNKS, calls)
    await engine._search_codebase(
        "编辑器", top_k=3, user_id="u1", editor_state={"active_file": "a/b.py"}
    )
    assert calls == [
        {
            "query": "编辑器",
            "repo_id": None,
            "language": None,
            "top_k": 3,
            "api_token": None,
            "internal_user_id": "u1",
        }
    ]


# ════════════════════════════════════════════════════════════════════════
# 3. 默认开路径:editor_state 真进了优先级
# ════════════════════════════════════════════════════════════════════════


async def test_on_active_file_wins_over_semantic_order(monkeypatch):
    """光标邻域加成 = 0.35+0.15,把语义分最低的"正在编辑的文件"顶到第一位。"""
    engine = ContextEngine()
    monkeypatch.setenv(GATE_ENV, "on")
    results = await _run_search(
        engine,
        monkeypatch,
        editor_state={"active_file": ACTIVE_FILE, "cursor_line": 780},
    )
    assert results[0].metadata["file_path"] == ACTIVE_FILE
    assert results[0].metadata["editor_proximity"] == "active_file"
    # 0.55 + 0.35 + 0.15(光标 780 落在 750..810 的 ±40 行邻域内)→ 夹到 1.0
    assert results[0].score == pytest.approx(1.0)
    scores = [r.score for r in results]
    assert scores == sorted(scores, reverse=True)


async def test_on_three_tiers_are_distinct(monkeypatch):
    """不带光标时三档分明:活动文件档 > 同目录档 > 其他(其他一档分毫不动)。"""
    engine = ContextEngine()
    monkeypatch.setenv(GATE_ENV, "1")
    results = await _run_search(engine, monkeypatch, editor_state={"active_file": ACTIVE_FILE})
    by_path = {r.metadata["file_path"]: r for r in results}
    active = by_path[ACTIVE_FILE]
    same_dir = by_path[SAME_DIR_FILE]
    unrelated = by_path[UNRELATED_FILE]
    assert active.metadata["editor_proximity"] == "active_file"
    assert active.score == pytest.approx(0.55 + EDITOR_ACTIVE_FILE_BOOST)
    assert same_dir.metadata["editor_proximity"] == "same_dir"
    assert same_dir.score == pytest.approx(0.30 + EDITOR_SAME_DIR_BOOST)
    assert unrelated.score == pytest.approx(0.91)
    assert "editor_proximity" not in unrelated.metadata
    assert [r.metadata["file_path"] for r in results] == [
        UNRELATED_FILE,
        ACTIVE_FILE,
        SAME_DIR_FILE,
    ]


async def test_on_boost_capped_and_clamped(monkeypatch):
    """加成档叠加后封顶 0.5,落分再被夹到 [0,1](不许把 relevance 抬出预算语义)。"""
    engine = ContextEngine()
    monkeypatch.setenv(GATE_ENV, "true")
    results = await _run_search(
        engine, monkeypatch, editor_state={"active_file": ACTIVE_FILE, "cursor_line": 790}
    )
    assert all(r.score <= 1.0 for r in results)
    boost, tier = editor_proximity_boost(
        ACTIVE_FILE, 750, 810, {"active_file": ACTIVE_FILE, "cursor_line": 780}
    )
    assert tier == "active_file"
    assert boost == min(
        EDITOR_ACTIVE_FILE_BOOST + EDITOR_CURSOR_NEIGHBOUR_BOOST, EDITOR_BOOST_CAP
    )


@pytest.mark.parametrize(
    ("file_path", "line_start", "line_end", "editor", "expected_boost", "expected_tier"),
    [
        ("a/b.py", 10, 20, None, 0.0, ""),
        ("", 10, 20, {"active_file": "a/b.py"}, 0.0, ""),
        ("a/b.py", 10, 20, {"active_file": ""}, 0.0, ""),
        ("a/b.py", 10, 20, {"active_file": "./a/b.py"}, EDITOR_ACTIVE_FILE_BOOST, "active_file"),
        ("A\\B.PY", 10, 20, {"active_file": "a/b.py"}, EDITOR_ACTIVE_FILE_BOOST, "active_file"),
        ("a/c.py", 10, 20, {"active_file": "a/b.py"}, EDITOR_SAME_DIR_BOOST, "same_dir"),
        ("z/y.py", 10, 20, {"active_file": "a/b.py"}, 0.0, ""),
        # 光标在窗口内 ⇒ 追加邻域;窗口外(>40 行)⇒ 只有活动文件档
        ("a/b.py", 100, 120, {"active_file": "a/b.py", "cursor_line": 110}, 0.5, "active_file"),
        (
            "a/b.py",
            100,
            120,
            {"active_file": "a/b.py", "cursor_line": 999},
            EDITOR_ACTIVE_FILE_BOOST,
            "active_file",
        ),
        # 行号取不到 ⇒ 不猜,只给活动文件档
        (
            "a/b.py",
            None,
            None,
            {"active_file": "a/b.py", "cursor_line": 110},
            EDITOR_ACTIVE_FILE_BOOST,
            "active_file",
        ),
    ],
)
def test_editor_proximity_boost_matrix(
    file_path, line_start, line_end, editor, expected_boost, expected_tier
):
    boost, tier = editor_proximity_boost(file_path, line_start, line_end, editor)
    assert boost == pytest.approx(expected_boost)
    assert tier == expected_tier


# ════════════════════════════════════════════════════════════════════════
# 4. normalize_editor_state:失效方向是丢弃而不是猜
# ════════════════════════════════════════════════════════════════════════


@pytest.mark.parametrize(
    "raw",
    [None, "", "abc", 7, [], {}, {"cursor_line": 12}, {"active_file": "   "}, {"active_file": None}],
)
def test_normalize_rejects_usless_input(raw):
    assert normalize_editor_state(raw) is None


def test_normalize_keeps_three_keys_and_coerces_line():
    state = normalize_editor_state(
        {"active_file": " a/b.py ", "cursor_line": "42", "selection": "hello", "noise": 1}
    )
    assert state == {"active_file": "a/b.py", "cursor_line": 42, "selection": "hello"}
    assert "noise" not in state


@pytest.mark.parametrize("bad", [True, False, "abc", 4.5, None])
def test_normalize_ignores_unusable_cursor_line(bad):
    state = normalize_editor_state({"active_file": "a/b.py", "cursor_line": bad})
    assert "cursor_line" not in state


def test_normalize_ignores_blank_selection():
    state = normalize_editor_state({"active_file": "a/b.py", "selection": "   "})
    assert state == {"active_file": "a/b.py"}


# ════════════════════════════════════════════════════════════════════════
# 5. 透传链:端点 → enrich_context → retrieve_and_enrich → _search_codebase
# ════════════════════════════════════════════════════════════════════════


async def test_request_defaults_to_no_editor_state():
    req = EnrichRequest(query="q")
    assert req.editorState is None


async def test_endpoint_forwards_normalized_editor_state(monkeypatch):
    captured: dict[str, Any] = {}

    async def _fake_enrich(**kwargs):
        captured.update(kwargs)
        return {"enrichedContext": "", "tokenCount": 0, "sources": [], "conversationId": "", "taskType": "code"}

    monkeypatch.setattr(
        "app.services.context_engine.context_engine.enrich_context", _fake_enrich
    )
    out = await enrich_endpoint(
        EnrichRequest(
            query="补全",
            editorState={
                "active_file": "apps/web/src/components/editor/CodeEditor.tsx",
                "cursor_line": "780",
            },
        )
    )
    assert out["code"] == 0
    assert captured["editor_state"] == {
        "active_file": "apps/web/src/components/editor/CodeEditor.tsx",
        "cursor_line": 780,
    }


async def test_endpoint_without_editor_state_passes_none(monkeypatch):
    """老调用方(不带该键)必须拿到 editor_state=None —— 现状逐字节等价的入口证据。"""
    captured: dict[str, Any] = {}

    async def _fake_enrich(**kwargs):
        captured.update(kwargs)
        return {"enrichedContext": "", "tokenCount": 0, "sources": [], "conversationId": "", "taskType": "default"}

    monkeypatch.setattr(
        "app.services.context_engine.context_engine.enrich_context", _fake_enrich
    )
    await enrich_endpoint(EnrichRequest(query="补全"))
    assert captured["editor_state"] is None


async def test_retrieve_and_enrich_threads_editor_state(monkeypatch):
    engine = ContextEngine()
    mock_search = AsyncMock(return_value=[])
    with patch.object(engine, "_search_codebase", new=mock_search):
        await engine.retrieve_and_enrich([], "编辑器", top_k=5, user_id="u1")
        assert mock_search.await_args.kwargs["editor_state"] is None

        await engine.retrieve_and_enrich(
            [], "编辑器", top_k=5, user_id="u1", editor_state={"active_file": "a/b.py"}
        )
        assert mock_search.await_args.kwargs["editor_state"] == {"active_file": "a/b.py"}


async def test_enrich_context_threads_editor_state_into_rag(monkeypatch):
    engine = ContextEngine()
    captured: dict[str, Any] = {}

    async def _fake_retrieve(messages, query, top_k=5, include_codebase=True, user_id=None, editor_state=None):
        captured["editor_state"] = editor_state
        return []

    monkeypatch.setattr(engine, "retrieve_and_enrich", _fake_retrieve)
    await engine.enrich_context([], query="编辑器", user_id="u1")
    assert captured["editor_state"] is None
    await engine.enrich_context(
        [], query="编辑器", user_id="u1", editor_state={"active_file": "a/b.py"}
    )
    assert captured["editor_state"] == {"active_file": "a/b.py"}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
