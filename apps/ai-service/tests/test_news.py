"""news 路由单元测试(2026-08-13 立,补齐 0 覆盖)。

策略:
- `_extract_json_array` 为纯函数,直接测(LLM 输出 fence / 推理前缀等脏场景)。
- 其余端点 monkeypatch 掉 `app.routers.news.get_shared_pool`(fake pool/conn)
  与 `app.routers.news.llm_gateway`(fake async complete),不连真实 DB / 不调真实 LLM。
- trigger-refresh / scheduler-status 依赖 news_scheduler,monkeypatch 单例。
"""

from __future__ import annotations

from datetime import datetime

import pytest
from fastapi import HTTPException

from app.routers import news as news_mod
from app.routers.news import (
    _extract_json_array,
    get_status,
    publish_recent,
    refresh_daily,
    scheduler_status,
    trigger_refresh,
)


# =============================================================================
# _extract_json_array 纯逻辑
# =============================================================================


def test_extract_plain_json_array():
    text = '[{"title": "a", "categoryName": "AI 模型发布"}]'
    result = _extract_json_array(text)
    assert result == [{"title": "a", "categoryName": "AI 模型发布"}]


def test_extract_json_fence_with_lang():
    text = '```json\n[{"title": "a"}]\n```'
    assert _extract_json_array(text) == [{"title": "a"}]


def test_extract_json_fence_without_lang():
    text = "```\n[{\"title\": \"b\"}]\n```"
    assert _extract_json_array(text) == [{"title": "b"}]


def test_extract_json_skips_reasoning_prefix():
    """带 [Advisor] 推理前缀 + 尾部多余文字 → 取第一个 [{ 到最后一个 ]。"""
    text = (
        '让我思考一下:\n[Advisor] 输出结果:\n'
        '[{"title": "c"}, {"title": "d"}] 这就是结果'
    )
    assert _extract_json_array(text) == [{"title": "c"}, {"title": "d"}]


def test_extract_json_fallback_first_bracket():
    """无 [{ 前缀时兜底取第一个 [ 到最后一个 ]。"""
    text = 'xxx ["title", 1] tail'
    assert _extract_json_array(text) == ["title", 1]


def test_extract_json_object_not_array():
    """顶层是对象而非数组 → 无法提取,抛 ValueError。"""
    with pytest.raises(ValueError):
        _extract_json_array('{"a": 1}')


def test_extract_json_garbage_raises():
    with pytest.raises(ValueError, match="无法从 LLM 输出提取 JSON 数组"):
        _extract_json_array("完全不是 JSON 的文本")


# =============================================================================
# fake pool / conn / llm 辅助
# =============================================================================


class _AcquireCtx:
    def __init__(self, conn):
        self._conn = conn

    async def __aenter__(self):
        return self._conn

    async def __aexit__(self, *exc):
        return False


class _FakePool:
    def __init__(self, conn):
        self._conn = conn

    def acquire(self):
        return _AcquireCtx(self._conn)


class _FakeConn:
    """按 SQL 子串路由到 handler,记录调用参数。"""

    def __init__(self):
        self._handlers: list[tuple[str, object]] = []
        self.calls: list[tuple[str, tuple]] = []

    def on(self, marker, handler):
        self._handlers.append((marker, handler))

    def _route(self, sql, args):
        self.calls.append((sql, args))
        for marker, handler in self._handlers:
            if marker in sql:
                return handler(sql, args)
        raise AssertionError(f"未注册的 SQL: {sql[:80]}")

    async def fetchval(self, sql, *args, **kwargs):
        return self._route(sql, (args, kwargs))

    async def fetch(self, sql, *args, **kwargs):
        return self._route(sql, (args, kwargs))

    async def fetchrow(self, sql, *args, **kwargs):
        return self._route(sql, (args, kwargs))


@pytest.fixture
def fake_db(monkeypatch):
    """注册 get_shared_pool → 可编程 FakePool/FakeConn。"""
    conn = _FakeConn()

    async def _get_pool():
        return _FakePool(conn)

    monkeypatch.setattr("app.routers.news.get_shared_pool", _get_pool)
    return conn


class _FakeLLM:
    """可编程 fake llm_gateway。"""

    def __init__(self):
        self.result = {"content": "[]", "model": "stepfun/step-3.5-flash", "usage": {}}
        self.error: Exception | None = None
        self.calls: list[tuple] = []

    async def complete(self, messages, model=None, temperature=None):
        self.calls.append((messages, model, temperature))
        if self.error is not None:
            raise self.error
        return self.result


@pytest.fixture
def fake_llm(monkeypatch):
    llm = _FakeLLM()
    monkeypatch.setattr("app.routers.news.llm_gateway", llm)
    return llm


def _base_categories():
    return [
        {"name": "AI 模型发布", "id": "cat-model"},
        {"name": "AI 产业动态", "id": "cat-industry"},
    ]


def _base_refresh_handlers(conn, items, cat_rows=None, titles=None, insert_ids=None):
    """注册 refresh_daily 需要的全部 SQL handler。"""
    conn.on("SELECT title FROM news_articles", lambda sql, a: titles or [])
    conn.on(
        "SELECT id, name FROM news_categories",
        lambda sql, a: _base_categories() if cat_rows is None else cat_rows,
    )
    ids = iter(insert_ids or ["id-1", "id-2"])
    conn.on("INSERT INTO news_articles", lambda sql, a: {"id": next(ids, "id-x")})


# =============================================================================
# GET /status
# =============================================================================


async def test_get_status_basic(fake_db):
    fake_db.on("status = 0", lambda sql, a: 5)
    fake_db.on("status = 1", lambda sql, a: 3)
    fake_db.on(
        "SELECT max(created_at)",
        lambda sql, a: datetime(2026, 8, 13, 1, 0, 0),
    )
    resp = await get_status()
    assert resp["lastGeneratedAt"] == "2026-08-13T01:00:00"
    assert resp["draftLast24h"] == 5
    assert resp["publishedLast24h"] == 3
    assert resp["allowedCategories"] == sorted(news_mod._ALLOWED_CATEGORIES)
    assert resp["defaultModel"] == news_mod.settings.litellm_model


async def test_get_status_last_generated_none(fake_db):
    fake_db.on("status = 0", lambda sql, a: 0)
    fake_db.on("status = 1", lambda sql, a: 0)
    fake_db.on("SELECT max(created_at)", lambda sql, a: None)
    resp = await get_status()
    assert resp["lastGeneratedAt"] is None


# =============================================================================
# POST /refresh-daily
# =============================================================================


async def test_refresh_daily_count_out_of_range():
    for bad in (0, -1, 13):
        with pytest.raises(HTTPException) as exc:
            await refresh_daily(count=bad)
        assert exc.value.status_code == 400
        assert "count 必须在 1-12 之间" in exc.value.detail


async def test_refresh_daily_empty_categories(fake_db, fake_llm):
    """news_categories 表为空 → 500,不调 LLM。"""
    _base_refresh_handlers(fake_db, [], cat_rows=[])
    with pytest.raises(HTTPException) as exc:
        await refresh_daily(count=6)
    assert exc.value.status_code == 500
    assert "news_categories 表为空" in exc.value.detail
    assert fake_llm.calls == []  # 未触达 LLM


async def test_refresh_daily_success(fake_db, fake_llm):
    """正常链路:LLM 输出 → 解析 → 写库;未知分类兜底、空标题跳过、content 兜底 summary。"""
    fake_llm.result = {
        "content": '```json\n'
        '['
        '  {"title": "AI 新模型发布", "summary": "sum1",'
        '   "categoryName": "AI 模型发布", "content": "## 背景"},'
        '  {"title": "行业动态", "summary": "sum2",'
        '   "categoryName": "未知分类X", "content": null},'
        '  {"title": "   ", "summary": "sum3",'
        '   "categoryName": "AI 模型发布", "content": "x"}'
        ']\n```',
        "model": "stepfun/step-3.5-flash",
        "usage": {"total_tokens": 123},
    }
    _base_refresh_handlers(
        fake_db,
        [],
        titles=[{"title": "已存在标题1"}, {"title": "已存在标题2"}],
        insert_ids=["id-1", "id-2"],
    )

    resp = await refresh_daily(count=6)

    assert resp["generated"] == 3
    assert resp["inserted"] == 2
    assert resp["skipped"] == 1
    assert resp["ids"] == ["id-1", "id-2"]
    assert resp["model"] == "stepfun/step-3.5-flash"
    assert resp["tokens"] == 123
    assert resp["stub"] is False

    # LLM 调用参数
    messages, model, temperature = fake_llm.calls[0]
    assert model == "stepfun/step-3.5-flash"
    assert temperature == 0.9
    # prompt 里带"今天日期"与"已存在标题"去重上下文
    prompt = messages[0]["content"]
    assert "2026-" in prompt or "已存在标题1" in prompt

    # 两条 INSERT 的 category_id 校验:未知分类兜底到 AI 产业动态
    inserts = [c for c in fake_db.calls if "INSERT INTO news_articles" in c[0]]
    assert len(inserts) == 2
    first_args = inserts[0][1][0]
    assert first_args[0] == "cat-model"  # AI 模型发布
    assert first_args[1] == "AI 新模型发布"
    assert first_args[3] == "## 背景"
    second_args = inserts[1][1][0]
    assert second_args[0] == "cat-industry"  # 未知分类 → AI 产业动态
    assert second_args[1] == "行业动态"
    assert second_args[3] == "sum2"  # content 为空 → 兜底 summary


async def test_refresh_daily_llm_failure(fake_db, fake_llm):
    fake_llm.error = RuntimeError("timeout")
    _base_refresh_handlers(fake_db, [])
    with pytest.raises(HTTPException) as exc:
        await refresh_daily(count=6)
    assert exc.value.status_code == 502
    assert "LLM 调用失败" in exc.value.detail


async def test_refresh_daily_llm_stub(fake_db, fake_llm):
    fake_llm.result = {"stub": True, "content": ""}
    _base_refresh_handlers(fake_db, [])
    with pytest.raises(HTTPException) as exc:
        await refresh_daily(count=6)
    assert exc.value.status_code == 503
    assert "stub 模式" in exc.value.detail


async def test_refresh_daily_parse_failure(fake_db, fake_llm):
    fake_llm.result = {"content": "这不是 JSON 也不是数组"}
    _base_refresh_handlers(fake_db, [])
    with pytest.raises(HTTPException) as exc:
        await refresh_daily(count=6)
    assert exc.value.status_code == 502
    assert "LLM 输出解析失败" in exc.value.detail


# =============================================================================
# POST /publish-recent
# =============================================================================


async def test_publish_recent_count_out_of_range():
    for bad in (0, -1, 169):
        with pytest.raises(HTTPException) as exc:
            await publish_recent(hours=bad)
        assert exc.value.status_code == 400
        assert "hours 必须在 1-168 之间" in exc.value.detail


async def test_publish_recent_success(fake_db):
    fake_db.on("UPDATE news_articles", lambda sql, a: 3)
    resp = await publish_recent(hours=24)
    assert resp == {"published": 3, "windowHours": 24}
    # 参数含当前时间 + str(hours)
    sql, (args, kwargs) = fake_db.calls[0]
    assert isinstance(args[0], datetime)
    assert args[1] == "24"


async def test_publish_recent_none_result(fake_db):
    fake_db.on("UPDATE news_articles", lambda sql, a: None)
    resp = await publish_recent(hours=12)
    assert resp == {"published": 0, "windowHours": 12}


# =============================================================================
# POST /trigger-refresh 与 GET /scheduler-status
# =============================================================================


async def test_trigger_refresh(monkeypatch):
    class _Sched:
        async def trigger_refresh(self):
            return {"status": "running", "count": 3}

    monkeypatch.setattr("app.services.news_scheduler.news_scheduler", _Sched())
    resp = await trigger_refresh()
    assert resp == {"status": "running", "count": 3}


async def test_scheduler_status(monkeypatch):
    class _Sched:
        def get_status(self):
            return {"running": True, "lastRun": "2026-08-13"}

        def list_history(self, limit):
            assert limit == 5
            return [{"triggered_at": "t1"}]

    monkeypatch.setattr("app.services.news_scheduler.news_scheduler", _Sched())
    resp = await scheduler_status()
    assert resp["running"] is True
    assert resp["lastRun"] == "2026-08-13"
    assert resp["history"] == [{"triggered_at": "t1"}]
