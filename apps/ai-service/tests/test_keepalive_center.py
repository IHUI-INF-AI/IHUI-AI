# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""账号保活中心测试(2026-10-26 立)。

覆盖顺序刻意与"出事顺序"一致:先钉判定策略(重试/告警/临期),再钉探针解析
(到期时间三种形态),最后钉调度中心的两条硬约束 —— **单账号隔离**与**退避跳过**。
这两条一旦破,表现都是"日志里静默少了几行",肉眼极难发现,所以必须有测试。
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta

import pytest

from app.services.keepalive import center as center_mod
from app.services.keepalive import store as store_mod
from app.services.keepalive.alerts import build_notification, group_by_owner, is_uuid
from app.services.keepalive.center import KeepaliveCenter, resolve_config, snapshot_of
from app.services.keepalive.models import (
    HEALTH_CRITICAL,
    HEALTH_HEALTHY,
    HEALTH_UNKNOWN,
    HEALTH_WARNING,
    KIND_ERROR,
    KIND_EXPIRED,
    KIND_NETWORK,
    KIND_OK,
    KIND_SKIPPED,
    KIND_UNSUPPORTED,
    SOURCE_PUBLISH_COOKIE,
    AccountRef,
    AccountReport,
    PolicyConfig,
    ProbeOutcome,
    RoundSummary,
    StateSnapshot,
    describe_exc,
)
from app.services.keepalive.policy import (
    backoff_seconds,
    classify_message,
    decide,
    health_of,
    is_expiring,
)
from app.services.keepalive.probes import as_utc, parse_expiry, run_bounded

NOW = datetime(2026, 10, 26, 12, 0, tzinfo=UTC)
CFG = PolicyConfig()


# ---------------------------------------------------------------------------
# 退避
# ---------------------------------------------------------------------------
def test_backoff_doubles_then_caps() -> None:
    assert backoff_seconds(1, CFG) == CFG.retry_base_seconds
    assert backoff_seconds(2, CFG) == CFG.retry_base_seconds * 2
    assert backoff_seconds(3, CFG) == CFG.retry_base_seconds * 4
    # 封顶:再翻倍也不能超过 cap
    assert backoff_seconds(20, CFG) == CFG.retry_cap_seconds


def test_backoff_treats_zero_as_first_attempt() -> None:
    assert backoff_seconds(0, CFG) == backoff_seconds(1, CFG)


# ---------------------------------------------------------------------------
# decide:成功 / 失败 / 特殊类型
# ---------------------------------------------------------------------------
def test_success_clears_failures_and_alert_state() -> None:
    prev = StateSnapshot(
        consecutive_failures=3,
        last_fail_at=NOW - timedelta(hours=6),
        alerted_at=NOW - timedelta(hours=1),
    )
    update = decide(prev, ProbeOutcome(ok=True, kind=KIND_OK, message="ok"), NOW, CFG)
    assert update.consecutive_failures == 0
    assert update.next_retry_at is None
    assert update.last_ok_at == NOW
    # 恢复后必须重新获得"再喊一次"的资格,否则下一次真出事会被旧戳静音
    assert update.alerted_at is None
    assert update.alert_now is False


def test_retryable_failure_sets_backoff() -> None:
    update = decide(
        StateSnapshot(),
        ProbeOutcome(ok=False, kind=KIND_NETWORK, message="timeout", retryable=True),
        NOW,
        CFG,
    )
    assert update.consecutive_failures == 1
    assert update.next_retry_at == NOW + timedelta(seconds=CFG.retry_base_seconds)


def test_failure_beyond_retry_max_stops_backoff() -> None:
    prev = StateSnapshot(consecutive_failures=CFG.retry_max)
    update = decide(
        prev,
        ProbeOutcome(ok=False, kind=KIND_NETWORK, message="timeout", retryable=True),
        NOW,
        CFG,
    )
    # 超过最大重试次数后不再排下一轮退避:等正常轮次即可,不该无限自我重试
    assert update.consecutive_failures == CFG.retry_max + 1
    assert update.next_retry_at is None


def test_alert_only_after_threshold_for_retryable_errors() -> None:
    prev = StateSnapshot(consecutive_failures=CFG.alert_after_failures - 2)
    first = decide(
        prev,
        ProbeOutcome(ok=False, kind=KIND_NETWORK, message="timeout", retryable=True),
        NOW,
        CFG,
    )
    assert first.alert_now is False, "第 1/2 次失败不该惊动人"
    second = decide(
        snapshot_of(first),
        ProbeOutcome(ok=False, kind=KIND_NETWORK, message="timeout", retryable=True),
        NOW,
        CFG,
    )
    assert second.alert_now is True


def test_expired_alerts_immediately() -> None:
    """凭证过期重试不会自愈 —— 当轮就该喊,而不是攒够 3 轮。"""
    update = decide(
        StateSnapshot(),
        ProbeOutcome(ok=False, kind=KIND_EXPIRED, message="cookie 已过期", retryable=False),
        NOW,
        CFG,
    )
    assert update.alert_now is True
    assert update.alerted_at == NOW


def test_alert_is_deduplicated_within_window() -> None:
    prev = StateSnapshot(
        consecutive_failures=CFG.alert_after_failures,
        alerted_at=NOW - timedelta(hours=1),
    )
    update = decide(
        prev,
        ProbeOutcome(ok=False, kind=KIND_EXPIRED, message="过期", retryable=False),
        NOW,
        CFG,
    )
    assert update.alert_now is False, "1 小时前刚喊过,不该再刷屏"
    assert update.alerted_at == prev.alerted_at


def test_unsupported_does_not_touch_failure_count() -> None:
    prev = StateSnapshot(consecutive_failures=2, last_ok_at=NOW - timedelta(days=1))
    update = decide(
        prev,
        ProbeOutcome(ok=False, kind=KIND_UNSUPPORTED, message="无需保活"),
        NOW,
        CFG,
    )
    assert update.consecutive_failures == 2
    assert update.alert_now is False
    assert update.warn_now is False


def test_expiring_success_emits_warning() -> None:
    expires = NOW + timedelta(days=1)
    update = decide(
        StateSnapshot(),
        ProbeOutcome(ok=True, kind=KIND_OK, message="ok", expires_at=expires),
        NOW,
        CFG,
    )
    assert update.warn_now is True
    assert update.expires_at == expires


# ---------------------------------------------------------------------------
# 健康度
# ---------------------------------------------------------------------------
def test_health_unknown_without_any_history() -> None:
    assert health_of(StateSnapshot(), NOW, CFG) == HEALTH_UNKNOWN


def test_health_healthy_after_success() -> None:
    assert health_of(StateSnapshot(last_ok_at=NOW), NOW, CFG) == HEALTH_HEALTHY


def test_health_warning_on_single_failure() -> None:
    state = StateSnapshot(consecutive_failures=1, last_ok_at=NOW - timedelta(hours=1))
    assert health_of(state, NOW, CFG) == HEALTH_WARNING


def test_health_critical_at_alert_threshold() -> None:
    state = StateSnapshot(
        consecutive_failures=CFG.alert_after_failures, last_ok_at=NOW - timedelta(days=2)
    )
    assert health_of(state, NOW, CFG) == HEALTH_CRITICAL


def test_health_critical_when_expired() -> None:
    state = StateSnapshot(last_ok_at=NOW, expires_at=NOW - timedelta(hours=1))
    assert health_of(state, NOW, CFG) == HEALTH_CRITICAL


def test_health_warning_when_expiring_soon() -> None:
    state = StateSnapshot(last_ok_at=NOW, expires_at=NOW + timedelta(days=2))
    assert health_of(state, NOW, CFG) == HEALTH_WARNING


def test_health_warning_when_only_failures_seen() -> None:
    """从没成功过、也还没到告警阈值 —— 不能算健康。"""
    state = StateSnapshot(consecutive_failures=1, last_fail_at=NOW)
    assert health_of(state, NOW, CFG) == HEALTH_WARNING


def test_health_critical_immediately_on_expired_kind() -> None:
    """上一次失败是 expired 类(含凭证解不开)⇒ 当轮就 critical,不必等三轮。

    expired 的定义是"只能重录/重扫,重试无用"。这类死症陪着 consecutive_failures
    先黄三轮,等于给一个不会自愈的问题配倒计时。
    """
    state = StateSnapshot(consecutive_failures=1, last_fail_at=NOW, last_error_kind=KIND_EXPIRED)
    assert health_of(state, NOW, CFG) == HEALTH_CRITICAL


def test_health_not_forced_critical_by_retryable_kind() -> None:
    """可重试的 network 类不享受"当轮 critical":它真的可能下一轮就好了。"""
    state = StateSnapshot(consecutive_failures=1, last_fail_at=NOW, last_error_kind=KIND_NETWORK)
    assert health_of(state, NOW, CFG) == HEALTH_WARNING


# ---------------------------------------------------------------------------
# 轮次汇总口径
# ---------------------------------------------------------------------------
def _report(kind: str, *, ok: bool = False, action: str = "probed") -> AccountReport:
    return AccountReport(
        ref=f"publish_cookie:{kind}",
        source=SOURCE_PUBLISH_COOKIE,
        platform="zhihu",
        display="x",
        outcome=ProbeOutcome(ok=ok, kind=kind, message="m"),
        action=action,
    )


def test_summary_counts_probed_unsupported_separately_from_failed() -> None:
    """真探到 unsupported 的账号不许计入 failed(回归 2026-10-26 首轮实测)。

    原实现只在 skipped 分支累加 unsupported,于是"无需保活"的账号落进 failed,
    首轮日志读成 `ok=1 failed=26`,其中 2 个根本没病。
    """
    summary = RoundSummary()
    summary.add(_report(KIND_OK, ok=True))
    summary.add(_report(KIND_UNSUPPORTED))
    summary.add(_report(KIND_EXPIRED))

    assert summary.total == 3
    assert summary.ok == 1
    assert summary.unsupported == 1
    assert summary.failed == 1
    assert summary.skipped == 0
    assert summary.by_source[SOURCE_PUBLISH_COOKIE]["unsupported"] == 1


def test_summary_counts_backoff_skip_without_failing() -> None:
    """退避中没探的账号记 skipped,不记 failed。"""
    summary = RoundSummary()
    summary.add(_report(KIND_SKIPPED, action="skipped_backoff"))
    assert summary.skipped == 1
    assert summary.failed == 0
    assert summary.ok == 0


def test_describe_exc_omits_dangling_colon_for_message_less_exception() -> None:
    """没有 message 的异常只留类名 —— 免得告警出现 "InvalidTag: " 这种半截串。"""

    class InvalidTag(Exception):
        pass

    assert describe_exc(InvalidTag()) == "InvalidTag"
    assert describe_exc(RuntimeError("boom")) == "RuntimeError: boom"


def test_is_expiring_boundaries() -> None:
    assert is_expiring(None, NOW, 3) is False
    assert is_expiring(NOW + timedelta(days=2), NOW, 3) is True
    assert is_expiring(NOW + timedelta(days=5), NOW, 3) is False


# ---------------------------------------------------------------------------
# 消息分类
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    ("message", "kind", "retryable"),
    [
        ("Cookie 保活后未检测到目标 cookie,可能已过期", KIND_EXPIRED, False),
        ("Playwright 未安装: No module named 'playwright'", KIND_ERROR, False),
        # 2026-10-26 语义修正:密文解不开是密钥层面的死症,重试一万次还是同一个
        # InvalidTag —— 归 expired(只能重录,重试无用)而不是可退避的 error。
        ("加载凭证失败: InvalidToken: 解密失败", KIND_EXPIRED, False),
        ("加载凭证失败: InvalidTag: ", KIND_EXPIRED, False),
        ("凭证无法解密(ValueError),需重新扫码录入该账号", KIND_EXPIRED, False),
        ("保活异常: TimeoutError: Page.goto: Timeout 30000ms exceeded", KIND_NETWORK, True),
        ("net::ERR_CONNECTION_RESET", KIND_NETWORK, True),
        ("某个从未见过的报错", KIND_ERROR, True),
    ],
)
def test_classify_message(message: str, kind: str, retryable: bool) -> None:
    outcome = classify_message(False, message)
    assert outcome.kind == kind
    assert outcome.retryable is retryable


def test_classify_message_ok_and_unsupported() -> None:
    assert classify_message(True, "Cookie 保活成功").kind == KIND_OK
    assert classify_message(False, "无需保活", unsupported=True).kind == KIND_UNSUPPORTED


# ---------------------------------------------------------------------------
# 到期解析
# ---------------------------------------------------------------------------
def test_parse_expiry_iso() -> None:
    assert parse_expiry({"expires_at": "2026-11-01T00:00:00Z"}) == datetime(
        2026, 11, 1, tzinfo=UTC
    )


def test_parse_expiry_unix_seconds_and_millis_agree() -> None:
    seconds = 1793491200
    assert parse_expiry({"expires_at": seconds}) == parse_expiry(
        {"expires_at": seconds * 1000}
    )


def test_parse_expiry_accepts_numeric_string_and_jwt_exp() -> None:
    assert parse_expiry({"exp": "1793491200"}) is not None


def test_parse_expiry_returns_none_for_unknown() -> None:
    assert parse_expiry({}) is None
    assert parse_expiry({"username": "x"}) is None
    assert parse_expiry({"expires_at": ""}) is None
    assert parse_expiry({"expires_at": "not-a-date"}) is None
    assert parse_expiry({"expires_at": True}) is None


def test_as_utc_normalizes_naive() -> None:
    naive = datetime(2026, 10, 26, 12, 0)
    assert as_utc(naive) == NOW
    assert as_utc(None) is None


# ---------------------------------------------------------------------------
# 配置自检
# ---------------------------------------------------------------------------
def test_config_disabled_names_missing_keys(monkeypatch: pytest.MonkeyPatch) -> None:
    for key in ("KEEPALIVE_ENABLED", "COOKIE_REFRESH_ENABLED", "CHECKIN_CRON_ENABLED"):
        monkeypatch.delenv(key, raising=False)
    cfg = resolve_config()
    assert cfg.enabled is False
    assert "KEEPALIVE_ENABLED" in cfg.enabled_reason
    assert "COOKIE_REFRESH_ENABLED" in cfg.enabled_reason


def test_config_explicit_true(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("KEEPALIVE_ENABLED", "true")
    cfg = resolve_config()
    assert cfg.enabled is True
    assert "KEEPALIVE_ENABLED=true" in cfg.enabled_reason


def test_config_explicit_false_overrides_legacy(monkeypatch: pytest.MonkeyPatch) -> None:
    """显式关就是要关 —— 不能被旧开关悄悄拉起来。"""
    monkeypatch.setenv("KEEPALIVE_ENABLED", "false")
    monkeypatch.setenv("COOKIE_REFRESH_ENABLED", "true")
    cfg = resolve_config()
    assert cfg.enabled is False


def test_config_inherits_legacy_switch(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("KEEPALIVE_ENABLED", raising=False)
    monkeypatch.setenv("CHECKIN_CRON_ENABLED", "true")
    cfg = resolve_config()
    assert cfg.enabled is True
    assert "继承" in cfg.enabled_reason


def test_config_bad_number_falls_back(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("KEEPALIVE_INTERVAL_HOURS", "abc")
    assert resolve_config().interval_hours == 6.0


# ---------------------------------------------------------------------------
# 调度中心:单账号隔离 + 退避跳过
# ---------------------------------------------------------------------------
class _FakeProbe:
    source = "fake"

    def __init__(self, refs: list[AccountRef], outcomes: dict[str, object]) -> None:
        self._refs = refs
        self._outcomes = outcomes
        self.calls: list[str] = []

    async def list_accounts(self, owner: str | None) -> list[AccountRef]:
        return [r for r in self._refs if not owner or r.owner == owner]

    async def probe(self, ref: AccountRef) -> ProbeOutcome:
        self.calls.append(ref.ref)
        outcome = self._outcomes[ref.ref]
        if isinstance(outcome, Exception):
            raise outcome
        assert isinstance(outcome, ProbeOutcome)
        return outcome


class _BrokenListProbe:
    """列账号就炸的探针:不能拖垮其他来源。"""

    source = "broken"

    async def list_accounts(self, owner: str | None) -> list[AccountRef]:
        raise RuntimeError("db down")

    async def probe(self, ref: AccountRef) -> ProbeOutcome:  # pragma: no cover
        raise AssertionError("不该被调用")


def _ref(account_id: int) -> AccountRef:
    return AccountRef(
        source=SOURCE_PUBLISH_COOKIE,
        account_id=account_id,
        owner="u1",
        display=f"账号{account_id}",
        platform="zhihu",
    )


@pytest.fixture
def patched_store(monkeypatch: pytest.MonkeyPatch) -> dict[str, object]:
    """把 DB 换成内存字典,并记录落库调用。"""
    states: dict[str, StateSnapshot] = {}
    calls: dict[str, object] = {"upserts": [], "events": []}

    async def _fetch(refs: list[str]) -> dict[str, StateSnapshot]:
        return {r: states[r] for r in refs if r in states}

    async def _upsert(**kwargs: object) -> None:
        ref = str(kwargs["ref"])
        update = kwargs["update"]
        assert hasattr(update, "consecutive_failures")
        states[ref] = snapshot_of(update)  # type: ignore[arg-type]
        calls["upserts"].append(ref)  # type: ignore[union-attr]

    async def _record(**kwargs: object) -> None:
        calls["events"].append(kwargs.get("ref"))  # type: ignore[union-attr]

    async def _prune(**kwargs: object) -> int:
        return 0

    monkeypatch.setattr(store_mod, "fetch_states", _fetch)
    monkeypatch.setattr(store_mod, "upsert_state", _upsert)
    monkeypatch.setattr(store_mod, "record_event", _record)
    monkeypatch.setattr(store_mod, "prune_events", _prune)
    return calls


async def test_one_broken_account_does_not_stop_the_round(
    patched_store: dict[str, object],
) -> None:
    refs = [_ref(1), _ref(2), _ref(3)]
    probe = _FakeProbe(
        refs,
        {
            "publish_cookie:1": ProbeOutcome(ok=True, kind=KIND_OK, message="ok"),
            "publish_cookie:2": RuntimeError("浏览器崩了"),
            "publish_cookie:3": ProbeOutcome(ok=True, kind=KIND_OK, message="ok"),
        },
    )
    center = KeepaliveCenter(probes=[probe])
    summary = await center.run_round()

    assert probe.calls == ["publish_cookie:1", "publish_cookie:2", "publish_cookie:3"]
    assert summary.total == 3
    assert summary.ok == 2
    assert summary.failed == 1, "炸掉的那个记失败,不能吞掉"
    # 第三个账号仍然被探活了 —— 这就是"隔离"的全部意义
    assert summary.reports[2].outcome.ok is True


async def test_broken_list_probe_does_not_block_others(
    patched_store: dict[str, object],
) -> None:
    good = _FakeProbe(
        [_ref(1)], {"publish_cookie:1": ProbeOutcome(ok=True, kind=KIND_OK, message="ok")}
    )
    center = KeepaliveCenter(probes=[_BrokenListProbe(), good])
    summary = await center.run_round()
    assert summary.total == 1
    assert summary.ok == 1


async def test_backoff_account_is_skipped_not_failed(
    patched_store: dict[str, object], monkeypatch: pytest.MonkeyPatch
) -> None:
    future = datetime.now(UTC) + timedelta(minutes=30)
    states = {"publish_cookie:1": StateSnapshot(consecutive_failures=1, next_retry_at=future)}

    async def _fetch(refs: list[str]) -> dict[str, StateSnapshot]:
        return {r: states[r] for r in refs if r in states}

    monkeypatch.setattr(store_mod, "fetch_states", _fetch)
    probe = _FakeProbe(
        [_ref(1)], {"publish_cookie:1": ProbeOutcome(ok=True, kind=KIND_OK, message="ok")}
    )
    center = KeepaliveCenter(probes=[probe])
    summary = await center.run_round()

    assert probe.calls == [], "退避中的账号不该被再次探活"
    assert summary.skipped == 1
    assert summary.failed == 0
    assert summary.reports[0].action == "skipped_backoff"
    assert summary.reports[0].outcome.kind == KIND_SKIPPED


async def test_force_bypasses_backoff(
    patched_store: dict[str, object], monkeypatch: pytest.MonkeyPatch
) -> None:
    future = datetime.now(UTC) + timedelta(minutes=30)
    states = {"publish_cookie:1": StateSnapshot(consecutive_failures=1, next_retry_at=future)}

    async def _fetch(refs: list[str]) -> dict[str, StateSnapshot]:
        return {r: states[r] for r in refs if r in states}

    monkeypatch.setattr(store_mod, "fetch_states", _fetch)
    probe = _FakeProbe(
        [_ref(1)], {"publish_cookie:1": ProbeOutcome(ok=True, kind=KIND_OK, message="ok")}
    )
    summary = await KeepaliveCenter(probes=[probe]).run_round(force=True)
    assert probe.calls == ["publish_cookie:1"]
    assert summary.ok == 1


async def test_round_persists_state_and_event(
    patched_store: dict[str, object],
) -> None:
    probe = _FakeProbe(
        [_ref(1)], {"publish_cookie:1": ProbeOutcome(ok=True, kind=KIND_OK, message="ok")}
    )
    await KeepaliveCenter(probes=[probe]).run_round()
    assert patched_store["upserts"] == ["publish_cookie:1"]
    assert patched_store["events"] == ["publish_cookie:1"]


async def test_owner_filter_limits_accounts(
    patched_store: dict[str, object],
) -> None:
    other = AccountRef(
        source=SOURCE_PUBLISH_COOKIE, account_id=9, owner="u2", platform="zhihu"
    )
    probe = _FakeProbe(
        [_ref(1), other],
        {
            "publish_cookie:1": ProbeOutcome(ok=True, kind=KIND_OK, message="ok"),
            "publish_cookie:9": ProbeOutcome(ok=True, kind=KIND_OK, message="ok"),
        },
    )
    summary = await KeepaliveCenter(probes=[probe]).run_round(owner="u1")
    assert probe.calls == ["publish_cookie:1"]
    assert summary.total == 1


# ---------------------------------------------------------------------------
# 状态行投影
# ---------------------------------------------------------------------------
def test_row_to_snapshot_tolerates_nulls() -> None:
    row = {
        "consecutive_failures": None,
        "last_ok_at": None,
        "last_fail_at": None,
        "expires_at": None,
        "warned_at": None,
        "alerted_at": None,
        "next_retry_at": None,
    }
    snapshot = store_mod.row_to_snapshot(row)
    assert snapshot.consecutive_failures == 0
    assert snapshot.next_retry_at is None


def test_status_is_json_safe() -> None:
    status = center_mod.keepalive_center.status()
    assert status["config"]["enabled"] in (True, False)
    assert isinstance(status["probes"], list)
    assert status["last_round"] is None or isinstance(status["last_round"], dict)


def test_checkin_listing_never_decrypts() -> None:
    """形状锁:签到账号列表阶段**不得解密**。

    2026-10-26 实测:复用 ``list_enabled_accounts_full`` 会在列表阶段逐行解密,
    一枚坏密文(密钥轮换过)整批抛 ValueError ⇒ 上游跳过整个来源 ⇒ 一个坏账号让
    全部签到账号失去保活,而日志只写"列账号失败"。这条锁把那个改动挡在门外:
    一旦有人把解密挪回列表阶段,本用例当场红。
    """
    import inspect

    from app.services.keepalive.probes import CheckinProbe

    src = inspect.getsource(CheckinProbe.list_accounts)
    # 剥掉 docstring(docstring 里会点名这些函数解释"为什么不用"),只判可执行代码
    parts = src.split('"""')
    code = "".join(part for i, part in enumerate(parts) if i % 2 == 0)
    assert "list_enabled_accounts_full" not in code
    assert "get_decrypted_jwt" not in code
    assert "_decrypt" not in code


# ---------------------------------------------------------------------------
# 并发调度 run_bounded:同平台串行 / 跨平台并行 / 并发上限
# ---------------------------------------------------------------------------
def _platform_ref(account_id: int, platform: str) -> AccountRef:
    return AccountRef(
        source=SOURCE_PUBLISH_COOKIE,
        account_id=account_id,
        owner="u1",
        display=f"号{account_id}",
        platform=platform,
    )


class _Meter:
    """记录调用期间的瞬时并发度与违规(同一 key 同时活跃)。"""

    def __init__(self) -> None:
        self.active = 0
        self.max_active = 0
        self.per_key: dict[str, int] = {}
        self.same_key_overlap: list[str] = []

    def enter(self, key: str) -> None:
        self.active += 1
        self.max_active = max(self.max_active, self.active)
        self.per_key[key] = self.per_key.get(key, 0) + 1
        if self.per_key[key] > 1:
            self.same_key_overlap.append(key)

    def leave(self, key: str) -> None:
        self.per_key[key] -= 1
        self.active -= 1


async def test_run_bounded_serializes_same_platform() -> None:
    """同平台账号必须一前一后 —— 这是风控语义,不是性能选项。"""
    meter = _Meter()
    refs = [_platform_ref(i, "zhihu") for i in (1, 2, 3)]

    async def call(ref: AccountRef) -> ProbeOutcome:
        meter.enter(ref.platform)
        await asyncio.sleep(0.01)
        meter.leave(ref.platform)
        return ProbeOutcome(ok=True, kind=KIND_OK, message="ok")

    out = await run_bounded(refs, call, concurrency=4, serialize_by="platform")
    assert len(out) == 3
    assert meter.same_key_overlap == [], "同平台账号不得并发访问"
    assert meter.max_active == 1


async def test_run_bounded_parallel_across_platforms() -> None:
    meter = _Meter()
    refs = [_platform_ref(i, f"p{i}") for i in (1, 2, 3, 4)]

    async def call(ref: AccountRef) -> ProbeOutcome:
        meter.enter(ref.platform)
        await asyncio.sleep(0.02)
        meter.leave(ref.platform)
        return ProbeOutcome(ok=True, kind=KIND_OK, message="ok")

    await run_bounded(refs, call, concurrency=4, serialize_by="platform")
    assert meter.max_active > 1, "不同平台应当并行,否则提速无从谈起"
    assert meter.max_active <= 4


async def test_run_bounded_respects_concurrency_cap() -> None:
    meter = _Meter()
    refs = [_platform_ref(i, f"p{i}") for i in range(1, 9)]

    async def call(ref: AccountRef) -> ProbeOutcome:
        meter.enter(ref.platform)
        await asyncio.sleep(0.01)
        meter.leave(ref.platform)
        return ProbeOutcome(ok=True, kind=KIND_OK, message="ok")

    await run_bounded(refs, call, concurrency=2, serialize_by=None)
    assert meter.max_active <= 2


async def test_run_bounded_empty_and_single() -> None:
    async def call(ref: AccountRef) -> ProbeOutcome:  # pragma: no cover
        return ProbeOutcome(ok=True, kind=KIND_OK, message="ok")

    assert await run_bounded([], call, concurrency=4) == {}
    out = await run_bounded([_platform_ref(1, "zhihu")], call, concurrency=4)
    assert list(out) == ["publish_cookie:1"]


# ---------------------------------------------------------------------------
# 告警聚合(站内信通道)
# ---------------------------------------------------------------------------
_REAL_UUID = "30763d9f-a4c4-4f0c-84c3-16d6b8a67c35"


def test_is_uuid_rejects_non_uuid_owners() -> None:
    assert is_uuid(_REAL_UUID) is True
    # 这两个值在库里真实存在,直接插 notifications(uuid + FK)会炸
    assert is_uuid("probe-user") is False
    assert is_uuid("system:relay-pool") is False
    assert is_uuid("") is False
    assert is_uuid(None) is False


def test_group_by_owner_drops_non_uuid() -> None:
    alerts = [
        {"owner": _REAL_UUID, "ref": "a:1"},
        {"owner": _REAL_UUID, "ref": "a:2"},
        {"owner": "probe-user", "ref": "a:3"},
        {"owner": "system:relay-pool", "ref": "a:4"},
    ]
    grouped = group_by_owner(alerts)
    assert list(grouped) == [_REAL_UUID]
    assert len(grouped[_REAL_UUID]) == 2


def test_build_notification_aggregates_one_per_owner() -> None:
    items = [
        {"ref": "a:1", "platform": "zhihu", "display": "主号", "kind": "expired", "message": "过期"},
        {"ref": "a:2", "platform": "weibo", "display": "小号", "kind": "error", "message": "解密失败"},
    ]
    title, content, data = build_notification(items)
    assert "2" in title
    assert "zhihu" in content and "weibo" in content
    assert data["source"] == "keepalive"
    assert data["refs"] == ["a:1", "a:2"]
    assert data["count"] == 2


def test_build_notification_caps_line_count() -> None:
    items = [
        {"ref": f"a:{i}", "platform": "p", "display": f"n{i}", "kind": "expired", "message": "x"}
        for i in range(12)
    ]
    _title, content, data = build_notification(items)
    assert data["count"] == 12
    assert "另有 4 个账号" in content, "超出部分要报数量,不能静默截断"


def test_inapp_alert_defaults_on(monkeypatch: pytest.MonkeyPatch) -> None:
    """站内信告警默认开:默认关等于"算出了告警但没有出口"。"""
    monkeypatch.delenv("KEEPALIVE_ALERT_INAPP", raising=False)
    assert resolve_config().alert_inapp is True


def test_inapp_alert_can_be_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("KEEPALIVE_ALERT_INAPP", "false")
    assert resolve_config().alert_inapp is False


# ---------------------------------------------------------------------------
# 中心:批量路径与批量失败回退
# ---------------------------------------------------------------------------
class _BatchProbe(_FakeProbe):
    def __init__(self, refs: list[AccountRef]) -> None:
        super().__init__(refs, {})
        self.batched = False

    async def probe_many(self, refs: list[AccountRef]) -> dict[str, ProbeOutcome]:
        self.batched = True
        return {r.ref: ProbeOutcome(ok=True, kind=KIND_OK, message="batch") for r in refs}


class _ExplodingBatchProbe(_FakeProbe):
    async def probe_many(self, refs: list[AccountRef]) -> dict[str, ProbeOutcome]:
        raise RuntimeError("batch scheduler broken")


async def test_center_prefers_batch_path(patched_store: dict[str, object]) -> None:
    probe = _BatchProbe([_ref(1), _ref(2)])
    summary = await KeepaliveCenter(probes=[probe]).run_round()
    assert probe.batched is True
    assert probe.calls == [], "走批量时不该再逐个调用 probe()"
    assert summary.ok == 2


async def test_batch_failure_falls_back_to_individual(
    patched_store: dict[str, object],
) -> None:
    """批量调度炸了要退回逐个 —— 否则会被记成"N 个账号同时挂了"。"""
    probe = _ExplodingBatchProbe(
        [_ref(1)], {"publish_cookie:1": ProbeOutcome(ok=True, kind=KIND_OK, message="ok")}
    )
    summary = await KeepaliveCenter(probes=[probe]).run_round()
    assert probe.calls == ["publish_cookie:1"]
    assert summary.ok == 1
    assert summary.failed == 0

# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
