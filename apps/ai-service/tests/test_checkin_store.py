# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""checkin_store 日参数收口用例 —— 2026-10-17 线上 500 根因修的防回潮锁。

根因:asyncpg 的 date 参数走**客户端编码**(date_codec 内部调 `.toordinal()`),
只吃 `datetime.date` 对象;`checkin.py` / `checkin_scheduler.py` 把
`datetime.now(_CN_TZ).date().isoformat()` 产出的 **str** 传进
`sum_credits_delta_for_day` / `upsert_credits_daily`,SQL 里服务端 `$3::date`
的 cast 救不了客户端 ⇒ 必抛 `DataError: str object has no attribute 'toordinal'`。
2026-10-17 实测:`POST /api/checkin/accounts/{18,19,22,23}/query_credits`
连炸 4 次 500(用户可见)、08:10 积分快照 job 整轮 0 成功(当天趋势缺格)。

本文件锁三层:
① `_coerce_day` 纯函数双向语义(str→date / date 透传);
② 两个 DB 入口**真会把 date 对象交给 asyncpg** —— monkeypatch pool 捕获实参,
   不连库、不mock掉被测函数本身(此前 47 绿测试全在 mock 这些函数,所以没抓住);
③ 两个调用点不得回退成 `.date().isoformat()` 产 str(源码形状锁,防下一个人"顺手"改回)。
"""

from __future__ import annotations

from datetime import date
from pathlib import Path

from app.services import checkin_store


class _FakeConn:
    def __init__(self) -> None:
        self.fetchrow_args: tuple[object, ...] | None = None
        self.execute_args: tuple[object, ...] | None = None

    async def fetchrow(self, _sql: str, *args: object) -> dict[str, int]:
        self.fetchrow_args = args
        return {"gained": 0}

    async def execute(self, _sql: str, *args: object) -> None:
        self.execute_args = args


class _FakePool:
    def __init__(self) -> None:
        self.conn = _FakeConn()

    def acquire(self):
        outer = self

        class _Ctx:
            async def __aenter__(self):
                return outer.conn

            async def __aexit__(self, *_a: object) -> bool:
                return False

        return _Ctx()


class _FakePoolFactory:
    """记录被调次数,顺带证明我们没真连库。"""

    def __init__(self) -> None:
        self.pool = _FakePool()
        self.calls = 0

    async def __call__(self):
        self.calls += 1
        return self.pool


async def test_coerce_day_str_to_date():
    """str 形态的日期被收口成 date(asyncpg 客户端编码唯一接受的形态)。"""
    assert checkin_store._coerce_day("2026-10-17") == date(2026, 10, 17)


async def test_coerce_day_date_passthrough():
    """已是 date 的对象原样透传,不做无谓转换。"""
    d = date(2026, 10, 17)
    assert checkin_store._coerce_day(d) is d


async def test_sum_credits_delta_binds_date_object(monkeypatch):
    """str 进来,交给 asyncpg 的第三个参数也必须是 date 对象。"""
    factory = _FakePoolFactory()
    monkeypatch.setattr(checkin_store, "get_shared_pool", factory)
    gained = await checkin_store.sum_credits_delta_for_day(18, "dev-anonymous", "2026-10-17")
    assert gained == 0
    assert factory.calls == 1
    bound = factory.pool.conn.fetchrow_args[2]
    assert isinstance(
        bound, date
    ), f"绑定参数必须是 date 对象(str 会在 asyncpg date_encode 抛 DataError),实得 {type(bound).__name__}"


async def test_upsert_credits_daily_binds_date_object(monkeypatch):
    """upsert 同型:第三个参数(day)必须是 date 对象。"""
    factory = _FakePoolFactory()
    monkeypatch.setattr(checkin_store, "get_shared_pool", factory)
    await checkin_store.upsert_credits_daily(18, "dev-anonymous", "2026-10-17", 100, 5)
    bound = factory.pool.conn.execute_args[2]
    assert isinstance(
        bound, date
    ), f"绑定参数必须是 date 对象(str 会在 asyncpg date_encode 抛 DataError),实得 {type(bound).__name__}"


async def test_sum_and_upsert_accept_date_directly(monkeypatch):
    """调用方直接传 date 对象时两条路都通(根因修后的正形态)。"""
    factory = _FakePoolFactory()
    monkeypatch.setattr(checkin_store, "get_shared_pool", factory)
    today = date(2026, 10, 17)
    assert await checkin_store.sum_credits_delta_for_day(18, "dev-anonymous", today) == 0
    await checkin_store.upsert_credits_daily(18, "dev-anonymous", today, 100, 0)
    assert factory.pool.conn.execute_args[2] is today


def test_callers_do_not_regress_to_isoformat_str():
    """源码形状锁:两个调用点不得回退成 `.date().isoformat()` 产 str。

    注意只锁这个形态本身 —— `checkin.py` 里趋势接口的 `(today - timedelta(...))
    .isoformat()` 是给前端的展示列表(其 SQL 出口用 to_char 产 str,by_day 的
    key 也是 str),不绑 date 参数,不得误伤。
    """
    root = Path(__file__).resolve().parents[1]  # apps/ai-service
    for rel in ("app/routers/checkin.py", "app/services/checkin_scheduler.py"):
        src = (root / rel).read_text(encoding="utf-8")
        assert (
            ".date().isoformat()" not in src
        ), f"{rel} 回退成 .date().isoformat() 产 str ⇒ 2026-10-17 的 500 回归"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
