# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""日桶必须与宿主时区无关(2026-09-29 时区回归钉)。

起因:宿主 Windows 的时区在 2026-09-04 被静默从 UTC+8 改成 UTC,2026-09-29 才改回。
期间 `llm_usage_service.get_user_stats` 的 `datetime.fromtimestamp(ts)`(naive)把同一
份 epoch 数据分进了另一套日桶 —— 账面没有任何报错,只是"每日用量"悄悄换了日期边界。

为什么不是"改 TZ 环境变量就够":**在 Windows 上 `time.tzset` 根本不存在,而 CRT 的
localtime 也不读 `TZ`**(本机实测:设 UTC 与设 Asia/Shanghai,naive `fromtimestamp`
输出**逐字相同**)。所以只靠 `TZ` 的那条腿在本机**永远为真** —— 一条不可能失败的断言
比没有断言更糟。本文件因此两条腿都跑:
① `_HostZoneDateTime` 把"宿主时区"做成显式可调的自变量(拦截模块全局 `datetime`),
   并在 `test_simulator_actually_moves_host_wall_clock` 里**先证明模拟器本身会动**;
② 真实的 `os.environ["TZ"]` + `time.tzset()` 腿保留(Linux CI 上它是真判据),
   在不生效的平台上如实说明,不把"没量到"读成"已验证"。

全程纯内存:不 import redis、不碰 `db_pool.get_shared_pool`,只手工填
`LLMUsageService._records`。
"""

from __future__ import annotations

import datetime as _dt
import os
import time

import pytest

from app.services import llm_usage_service as mod
from app.services.llm_usage_service import LLMUsageService, UsageRecord

UTC = _dt.UTC
CN_TZ = _dt.timezone(_dt.timedelta(hours=8))

# 该瞬间的东八区日期与 UTC 日期**不同**:2026-09-28 17:30 UTC == 2026-09-29 01:30 北京。
EPOCH = _dt.datetime(2026, 9, 28, 17, 30, tzinfo=UTC).timestamp()
BEIJING_DAY = "2026-09-29"
UTC_DAY = "2026-09-28"

HOST_OFFSETS = {
    "UTC": _dt.timedelta(0),
    "Asia/Shanghai": _dt.timedelta(hours=8),
    "UTC-11": _dt.timedelta(hours=-11),
}


class _HostZoneDateTime(_dt.datetime):
    """模块全局 `datetime` 的替身:把"宿主时区"变成可注入的自变量。

    契约只有两条,且正是被测代码依赖的两条:
    - naive 路径(`fromtimestamp(ts)` / `now()`,**不传 tz**)按 `HOST_OFFSET` 渲染
      墙钟且不带 tzinfo —— 与 CPython 在真实机器上的行为同形(它是 utc 瞬间 + 本地偏移);
    - 显式传 tz 的路径**不受 `HOST_OFFSET` 影响** —— 这就是本文件要钉的东西。
    """

    HOST_OFFSET = _dt.timedelta(0)
    UTC_NOW: _dt.datetime = _dt.datetime(2026, 9, 29, 12, 0, tzinfo=UTC)

    @classmethod
    def _naive(cls, dt: _dt.datetime) -> _dt.datetime:
        """datetime 子类的构造器只收分量整数,不收 datetime 实例 —— 按分量重建。"""
        return cls(dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second, dt.microsecond)

    @classmethod
    def fromtimestamp(cls, ts, tz=None):  # type: ignore[no-untyped-def]
        instant = _dt.datetime.fromtimestamp(ts, UTC)
        if tz is None:
            return cls._naive((instant + cls.HOST_OFFSET).replace(tzinfo=None))
        return instant.astimezone(tz)

    @classmethod
    def now(cls, tz=None):  # type: ignore[no-untyped-def]
        if tz is None:
            return cls._naive((cls.UTC_NOW + cls.HOST_OFFSET).replace(tzinfo=None))
        return cls.UTC_NOW.astimezone(tz)


@pytest.fixture
def host_zone(request, monkeypatch):
    """在指定"宿主时区"下跑被测代码。"""
    monkeypatch.setattr(mod, "datetime", _HostZoneDateTime)
    monkeypatch.setattr(_HostZoneDateTime, "HOST_OFFSET", HOST_OFFSETS[request.param])
    return request.param


def _service_with_one_record() -> LLMUsageService:
    svc = LLMUsageService()
    svc._records.append(
        UsageRecord(
            id="r1",
            provider="openai",
            model="gpt-test",
            user_id="u1",
            input_tokens=100,
            output_tokens=20,
            estimated_cost=0.001,
            timestamp=EPOCH,
            session_id="s1",
        )
    )
    return svc


def _day_keys(svc: LLMUsageService) -> list[str]:
    return sorted(svc.get_user_stats("u1", days=3650)["daily_breakdown"])


# ---------------------------------------------------------------- ① 真判据


def test_simulator_actually_moves_host_wall_clock() -> None:
    """先证明这条腿有牙:naive 转换必须随模拟宿主偏移而变。

    缺了它,下面所有"两宿主同值"的断言都可能只是模拟器压根不动造成的假绿。
    """
    seen: list[str] = []
    for offset in HOST_OFFSETS.values():
        _HostZoneDateTime.HOST_OFFSET = offset
        try:
            seen.append(_HostZoneDateTime.fromtimestamp(EPOCH).strftime("%Y-%m-%d"))
        finally:
            _HostZoneDateTime.HOST_OFFSET = _dt.timedelta(0)
    # 只要求"至少两个宿主给出不同日期"——该瞬间 UTC+0 与 UTC-11 同属 09-28 是真实
    # 日历事实,不是模拟器失灵;判据是"会动",不是"每个偏移都必须给出新日期"。
    assert len(set(seen)) > 1, f"模拟器没能让 naive 转换随宿主变: {seen}"


@pytest.mark.parametrize("host_zone", list(HOST_OFFSETS), indirect=True)
def test_day_bucket_is_beijing_regardless_of_host(host_zone: str) -> None:
    """日桶恒为东八区那一天,与宿主时区无关(UTC 日界是错的,别宿主要求)。"""
    keys = _day_keys(_service_with_one_record())
    assert keys == [BEIJING_DAY], (
        f"宿主={host_zone}:日桶应钉在东八区 {BEIJING_DAY},实得 {keys}"
        f"(等于 {UTC_DAY} 说明仍在跟宿主时区走)"
    )


def test_day_bucket_two_host_zones_yield_same_key() -> None:
    """任务书口径:同一 epoch 在 TZ=UTC 与 TZ=Asia/Shanghai 下必须得到同一个 YYYY-MM-DD。"""
    monkey_keys: dict[str, str] = {}
    for name in ("UTC", "Asia/Shanghai"):
        _HostZoneDateTime.HOST_OFFSET = HOST_OFFSETS[name]
        try:
            mod.datetime = _HostZoneDateTime  # type: ignore[misc]
            keys = _day_keys(_service_with_one_record())
        finally:
            _HostZoneDateTime.HOST_OFFSET = _dt.timedelta(0)
            mod.datetime = _dt.datetime  # type: ignore[misc]
        monkey_keys[name] = ",".join(keys)
    assert (
        monkey_keys["UTC"] == monkey_keys["Asia/Shanghai"] == BEIJING_DAY
    ), f"两宿主日桶分叉: {monkey_keys}"


# ---------------------------------------------------------------- ② 请求的 TZ 腿


def test_tz_env_leg_pinned_and_reported(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    """按要求钉 `os.environ["TZ"]` 两值并调 `time.tzset()`;本机不生效则如实说明。

    这条腿在 Linux CI 上是真判据;Windows 上 CRT 不读 TZ(模块 docstring 已实测记录),
    所以它**不能**被当成本文件唯一的证明 —— 那由 ① 承担。
    """
    original = os.environ.get("TZ")
    has_tzset = hasattr(time, "tzset")
    observed: dict[str, str] = {}
    try:
        for tz_name in ("UTC", "Asia/Shanghai"):
            monkeypatch.setenv("TZ", tz_name)
            if has_tzset:
                time.tzset()
            observed[tz_name] = _day_keys(_service_with_one_record())[0]
            naive_wall = _dt.datetime.fromtimestamp(EPOCH).strftime("%Y-%m-%d")
            print(
                f"[TZ leg] TZ={tz_name}: 日桶={observed[tz_name]} "
                f"宿主 naive 墙钟日={naive_wall} tzset={'有' if has_tzset else '无'}"
            )
    finally:
        if original is None:
            monkeypatch.delenv("TZ", raising=False)
        else:
            monkeypatch.setenv("TZ", original)
        if has_tzset:
            time.tzset()

    assert observed["UTC"] == observed["Asia/Shanghai"] == BEIJING_DAY
    if not has_tzset:
        # 如实登记:这条腿在本机不足以证伪 naive 实现(① 那条可以)。
        print("[TZ leg] 本机无 time.tzset 且 CRT 不读 TZ —— 该腿不具备判别力,判据在 ① 侧")


# ---------------------------------------------------------------- 月度窗口不得被"顺手改齐"


def _quota_used_tokens(utc_now: _dt.datetime, host_offset: _dt.timedelta, records: list[UsageRecord]) -> int:
    svc = LLMUsageService()
    svc._records.extend(records)
    _HostZoneDateTime.HOST_OFFSET = host_offset
    _HostZoneDateTime.UTC_NOW = utc_now
    try:
        mod.datetime = _HostZoneDateTime  # type: ignore[misc]
        return int(svc.get_quota_info("u1")["used_tokens"])
    finally:
        mod.datetime = _dt.datetime  # type: ignore[misc]
        _HostZoneDateTime.HOST_OFFSET = _dt.timedelta(0)
        _HostZoneDateTime.UTC_NOW = _dt.datetime(2026, 9, 29, 12, 0, tzinfo=UTC)


def _rec(ts: float, tokens: int) -> UsageRecord:
    return UsageRecord(
        id=f"r{ts}",
        provider="openai",
        model="gpt-test",
        user_id="u1",
        input_tokens=tokens,
        output_tokens=0,
        estimated_cost=0.0,
        timestamp=ts,
        session_id="s1",
    )


@pytest.mark.parametrize("host_zone", list(HOST_OFFSETS), indirect=True)
def test_month_window_boundary_is_deliberately_utc(host_zone: str) -> None:
    """配额月窗仍按 **UTC** 起算 —— 这是记账边界,不是漏改,不得随日桶一起被"改齐"。

    2026-09-01 02:00 北京 == 2026-08-31 18:00 UTC:东八区月窗会把它算进 9 月,
    UTC 月窗不会(它早于 9 月 1 日 00:00 UTC)。两者只差在边界那 8 小时,而差的是账单。
    """
    inside = _rec(_dt.datetime(2026, 9, 2, 12, 0, tzinfo=UTC).timestamp(), 500)
    on_beijing_but_before_utc = _rec(
        _dt.datetime(2026, 8, 31, 18, 0, tzinfo=UTC).timestamp(), 111
    )
    used = _quota_used_tokens(
        _dt.datetime(2026, 9, 15, 12, 0, tzinfo=UTC), HOST_OFFSETS[host_zone], [inside, on_beijing_but_before_utc]
    )
    assert used == 500, (
        f"宿主={host_zone}:月窗应排除 {on_beijing_but_before_utc.timestamp()} 这条"
        f"(它在东八区属 9 月、在 UTC 属 8 月),实得 used={used}"
        " —— 把月窗改成东八区等于把月度配额/计费窗口挪早 8 小时,须持票人拍板"
    )


def test_cn_tz_pin_matches_repo_convention() -> None:
    """本模块的东八区常量与本仓既有写法同形(固定偏移,不是裸 "Asia/Shanghai" 字符串)。"""
    assert mod._CN_TZ == CN_TZ
    assert mod._CN_TZ.utcoffset(None) == _dt.timedelta(hours=8)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
