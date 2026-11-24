# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""SAG2 存储工厂接入与诚实降级链的接线测试（零真实数据库）。

覆盖：环境变量契约、默认纯内存、PG runner 缺失/构造失败/DDL 失败的显式降级、
PG 生效时 add_document→candidate_query 链路、status() 后端兼容、运行时 DB
故障回退内存镜像真实候选、API status 信封不变且自然带出新字段。
"""

from __future__ import annotations

import asyncio
import re
from typing import Any

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api.v1 import sag2_lexical as api_module
from app.services.sag2_lexical.index import LexicalIndex
from app.services.sag2_lexical.pg_store import PgTsVectorStore
from app.services.sag2_lexical.service import Sag2LexicalService
from app.services.sag2_lexical.store_factory import (
    BACKEND_MEMORY,
    BACKEND_POSTGRES,
    ENV_STORE_BACKEND,
    build_store,
    build_store_with_status,
    resolve_store_status,
)

# 与 pg_store._SQL_INSERT_CHUNK 的 16 列顺序一致；最小自建夹具，不复制整份 FakeRunner。
_ROW_KEYS = (
    "path", "chunk_id", "title", "heading", "seq", "content", "hash",
    "doc_hash", "start_offset", "end_offset", "start_line", "end_line",
    "chunk_key", "title_tokens", "heading_tokens", "content_tokens",
)


class _MiniRunner:
    """最小内存表：只模拟 pg_store 需要的 DDL/DML/ts_rank_cd SELECT 契约。"""

    def __init__(self, *, fail_on_rank: bool = False) -> None:
        self.calls: list[tuple[str, tuple[Any, ...]]] = []
        self.documents: dict[str, tuple[Any, ...]] = {}
        self.chunks: list[dict[str, Any]] = []
        self.fail_on_rank = fail_on_rank

    def __call__(self, sql: str, params: tuple[Any, ...]) -> list[dict[str, Any]]:
        self.calls.append((sql, params))
        head = sql.strip().upper()
        if self.fail_on_rank and "TS_RANK_CD" in head:
            raise RuntimeError("simulated DB failure")
        if head.startswith("CREATE"):
            return []
        if head.startswith("SELECT") and "FROM SAG2_DOCUMENTS" in head:
            row = self.documents.get(str(params[0]))
            if row is None:
                return []
            return [{
                "path": row[0], "doc_hash": row[1],
                "chunk_count": row[2], "version": row[3],
            }]
        if head.startswith("DELETE FROM SAG2_CHUNKS"):
            self.chunks = [c for c in self.chunks if c["path"] != str(params[0])]
            return []
        if head.startswith("DELETE FROM SAG2_DOCUMENTS"):
            self.documents.pop(str(params[0]), None)
            return []
        if head.startswith("INSERT INTO SAG2_CHUNKS"):
            self.chunks.append(dict(zip(_ROW_KEYS, params, strict=True)))
            return []
        if head.startswith("INSERT INTO SAG2_DOCUMENTS"):
            self.documents[str(params[0])] = params
            return []
        if "TS_RANK_CD" in head:
            return self._rank(params)
        return []

    def _rank(self, params: tuple[Any, ...]) -> list[dict[str, Any]]:
        excluded = {str(item) for item in params[1]}
        limit = int(params[2])
        terms = re.findall(r"'([^']*)'", str(params[0]))
        rows: list[dict[str, Any]] = []
        for chunk in self.chunks:
            tokens = str(chunk["content_tokens"]).split()
            tf = sum(tokens.count(term) for term in terms)
            if tf > 0:
                row = dict(chunk)
                row["rank"] = float(tf)
                rows.append(row)
        rows = [r for r in rows if str(r["chunk_key"]) not in excluded]
        rows.sort(key=lambda r: (-float(r["rank"]), str(r["chunk_key"])))
        return rows[:limit]


class _AlwaysFailRunner:
    """所有调用都抛错：模拟 DB 完全不可用（构造期 / DDL 期）。"""

    def __init__(self) -> None:
        self.calls: list[tuple[str, tuple[Any, ...]]] = []

    def __call__(self, sql: str, params: tuple[Any, ...]) -> list[dict[str, Any]]:
        self.calls.append((sql, params))
        raise RuntimeError("DB is down")


# ---------------------------------------------------------------------------
# 环境变量契约 / 默认纯内存
# ---------------------------------------------------------------------------


def test_default_zero_env_is_pure_memory(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(ENV_STORE_BACKEND, raising=False)
    store, status = build_store_with_status()
    assert isinstance(store, LexicalIndex)
    assert not isinstance(store, PgTsVectorStore)
    assert status["backend"] == BACKEND_MEMORY
    assert status["effective_backend"] == BACKEND_MEMORY
    assert status["requested_backend"] == BACKEND_MEMORY
    assert status["degraded"] is False
    assert status["reason"] == ""
    assert status["degrade_reason"] == ""
    read_back = resolve_store_status(store)
    assert read_back["degraded"] is False
    assert read_back["effective_backend"] == BACKEND_MEMORY


def test_build_store_leaves_self_proving_status_on_object(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv(ENV_STORE_BACKEND, raising=False)
    store = build_store()
    assert isinstance(store, LexicalIndex)
    assert resolve_store_status(store)["backend"] == BACKEND_MEMORY


def test_explicit_backend_overrides_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(ENV_STORE_BACKEND, BACKEND_POSTGRES)
    store, status = build_store_with_status(BACKEND_MEMORY)
    assert isinstance(store, LexicalIndex)
    assert status["requested_backend"] == BACKEND_MEMORY
    assert status["degraded"] is False


# ---------------------------------------------------------------------------
# 诚实降级：runner 缺失 / DDL 失败 / 构造异常 / 未知后端
# ---------------------------------------------------------------------------


def test_pg_without_runner_degrades_honestly(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(ENV_STORE_BACKEND, BACKEND_POSTGRES)
    store, status = build_store_with_status()
    assert isinstance(store, LexicalIndex)
    assert status["requested_backend"] == BACKEND_POSTGRES
    assert status["effective_backend"] == BACKEND_MEMORY
    assert status["degraded"] is True
    assert status["reason"]
    assert status["degrade_reason"]
    assert resolve_store_status(store)["degraded"] is True
    assert resolve_store_status(store)["reason"]


def test_pg_ddl_failure_degrades_honestly(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(ENV_STORE_BACKEND, BACKEND_POSTGRES)
    runner = _AlwaysFailRunner()
    store, status = build_store_with_status(runner=runner)
    assert isinstance(store, LexicalIndex)
    assert status["degraded"] is True
    assert status["reason"]
    assert runner.calls, "必须真尝试过 DDL，而不是静默跳过"
    assert resolve_store_status(store)["degraded"] is True


def test_pg_construction_exception_degrades_honestly(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(ENV_STORE_BACKEND, BACKEND_POSTGRES)

    def boom(*args: Any, **kwargs: Any) -> PgTsVectorStore:
        raise RuntimeError("constructor exploded")

    monkeypatch.setattr(
        "app.services.sag2_lexical.store_factory.PgTsVectorStore", boom
    )
    store, status = build_store_with_status(runner=_MiniRunner())
    assert isinstance(store, LexicalIndex)
    assert status["degraded"] is True
    assert "构造失败" in status["reason"]


def test_unknown_backend_degrades_honestly(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(ENV_STORE_BACKEND, "sqlite-fts5")
    store, status = build_store_with_status()
    assert isinstance(store, LexicalIndex)
    assert status["requested_backend"] == "sqlite-fts5"
    assert status["degraded"] is True
    assert "未知后端" in status["reason"]


# ---------------------------------------------------------------------------
# PG 生效 + 运行时降级不伪装成功
# ---------------------------------------------------------------------------


def test_pg_effective_add_document_then_candidate_query(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(ENV_STORE_BACKEND, BACKEND_POSTGRES)
    runner = _MiniRunner()
    store, status = build_store_with_status(runner=runner)
    assert isinstance(store, PgTsVectorStore)
    assert status["requested_backend"] == BACKEND_POSTGRES
    assert status["effective_backend"] == BACKEND_POSTGRES
    assert status["degraded"] is False
    assert store.degraded is False

    outcome = store.add_document("kb/a.txt", "公司收购了B公司。公司总部设在深圳。")
    assert outcome.changed is True
    assert outcome.chunk_count >= 1
    hits = store.candidate_query(["收购"], 10)
    assert hits, "PG 生效时 add_document→candidate_query 链路必须跑通"
    assert any("ts_rank_cd" in sql for sql, _ in runner.calls)
    for sql, _params in runner.calls:
        assert "kb/a.txt" not in sql, "用户输入只走参数绑定，不得拼进 SQL"


def test_runtime_db_failure_returns_real_mirror_candidates(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(ENV_STORE_BACKEND, BACKEND_POSTGRES)
    runner = _MiniRunner(fail_on_rank=True)
    store, status = build_store_with_status(runner=runner)
    assert isinstance(store, PgTsVectorStore)
    assert status["degraded"] is False  # 构造/DDL 阶段成功，故障发生在查询期
    store.add_document("kb/a.txt", "公司收购了B公司。公司总部设在深圳。")
    hits = store.candidate_query(["收购"], 10)
    assert hits, "DB 报错必须回退内存镜像真实候选，不得返回空列表伪装「无匹配」"
    assert store.degraded is True
    assert store.degrade_reason
    assert resolve_store_status(store)["degraded"] is True
    assert any("ts_rank_cd" in sql for sql, _ in runner.calls)


# ---------------------------------------------------------------------------
# 服务层接线 / status() 后端兼容 / API 信封
# ---------------------------------------------------------------------------


def test_service_status_keeps_all_original_keys(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv(ENV_STORE_BACKEND, raising=False)
    service = Sag2LexicalService()
    original = LexicalIndex().status()
    payload = service.status()
    for key, value in original.items():
        assert key in payload
        assert payload[key] == value, "原有键连值都不变（严格后端兼容）"
    assert "judge_provider" in payload
    assert payload["effective_backend"] == BACKEND_MEMORY
    assert payload["requested_backend"] == BACKEND_MEMORY
    assert payload["degraded"] is False
    assert payload["degrade_reason"] == ""


def test_service_accepts_factory_product_via_injection(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(ENV_STORE_BACKEND, BACKEND_POSTGRES)
    store, status = build_store_with_status()  # 无 runner ⇒ 降级
    service = Sag2LexicalService(index=store, store_status=status)
    payload = service.status()
    assert payload["requested_backend"] == BACKEND_POSTGRES
    assert payload["effective_backend"] == BACKEND_MEMORY
    assert payload["degraded"] is True
    assert payload["degrade_reason"]
    for key in LexicalIndex().status():
        assert key in payload


def test_api_status_envelope_unchanged_and_exposes_new_fields() -> None:
    isolated = Sag2LexicalService()
    original = api_module.sag2_lexical_service
    api_module.sag2_lexical_service = isolated

    async def scenario() -> dict[str, Any]:
        app = FastAPI()
        app.include_router(api_module.router, prefix="/api/v1/ai/sag2")
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.get("/api/v1/ai/sag2/status")
            return resp.json()

    try:
        payload = asyncio.run(scenario())
    finally:
        api_module.sag2_lexical_service = original

    assert payload["code"] == 0
    assert payload["message"] == "ok"
    data = payload["data"]
    for key in (
        "version", "documents", "chunks", "terms", "avg_chunk_length",
        "ready", "backend", "judge_provider",
    ):
        assert key in data
    assert data["effective_backend"] == BACKEND_MEMORY
    assert data["degraded"] is False

# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
