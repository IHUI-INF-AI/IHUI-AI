# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""checkin_qoder 单元测试（httpx.MockTransport，不打真实网络）。

覆盖: uid 解析 / Cosy 头构造 / 可领判据 / 领取成功 / 已领取 / 未下发 /
401 自刷新重试 / 双 401 SessionDead / 网络异常 / 余额解析 / refresh 契约。
"""

from __future__ import annotations

import base64
import datetime
import json
import time

import httpx
import pytest

import app.services.checkin_qoder as qoder_mod
from app.services.checkin_outbound import CHALLENGE_COOLDOWN_SECONDS, checkin_outbound_gate
from app.services.checkin_qoder import (
    CLIENT_TYPE_DEFAULT,
    PATH_CAMPAIGNS,
    PATH_CLAIM,
    PATH_QUOTA,
    PATH_REFRESH,
    QODER_BASES,
    _claimable_campaigns,
    build_cosy_headers,
    qoder_checkin_account,
    qoder_classify_error,
    qoder_device_map_uid,
    qoder_extract_uid,
    qoder_jwt_exp,
    qoder_probe_status,
    qoder_query_credits,
    qoder_refresh_token,
    qoder_session_expiry,
)

UID = "990011"


# ---------------------------------------------------------------------------
# fixtures / helpers
# ---------------------------------------------------------------------------


def _b64(obj) -> str:
    return base64.urlsafe_b64encode(json.dumps(obj).encode("utf-8")).decode().rstrip("=")


def make_qoder_jwt(uid: str = UID, exp_offset: float = 3600.0 * 24 * 30) -> str:
    """构造未签名的 Qoder 测试 JWT(payload.sub = uid;exp 远期避免触发自刷新)。"""
    payload = {"sub": uid, "exp": int(time.time() + exp_offset)}
    return f"{_b64({'alg': 'none'})}.{_b64(payload)}.sig"


def make_client(handler) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(handler), trust_env=False)


@pytest.fixture
def jwt() -> str:
    return make_qoder_jwt()


# ---------------------------------------------------------------------------
# 固定测试时钟(2026-11-06 立):去掉「测试结论由运行时刻决定」
#
# 生产判据(见 app/services/checkin_qoder.py 的 _claimable_campaigns)要求两件事同时成立:
#   ① CLAIMED 落在 [startAt, endAt) 内;② startAt 与 now 同属一个 Asia/Shanghai 自然日。
# 只要 now 取自机器时钟,用「now - 3600」造窗口在 00:00–00:59 就会让 startAt 落到前一天,
# ② 不成立 ⇒ 与本任务无关的假红(实测:00:55 红、01:00 绿)。
# 因此所有需要窗口语义的用例一律锚在 TEST_NOW,并把被测模块的 time.time 一并钉住;
# 结论只由注入值决定,与机器时钟/时区无关。
# ---------------------------------------------------------------------------
_CN = datetime.timezone(datetime.timedelta(hours=8))


def _cn_ts(day: str, hour: int, minute: int = 0) -> float:
    """'+08 的某个钟点'("2026-11-01", 10, 0) → 固定 epoch 秒。"""
    y, m, d = (int(x) for x in day.split("-"))
    return datetime.datetime(y, m, d, hour, minute, tzinfo=_CN).timestamp()


TEST_DAY = "2026-11-06"
TEST_NOW = _cn_ts(TEST_DAY, 11, 0)  # +08 11:00:当天窗口已开(10:00)、尚未跨日


@pytest.fixture(autouse=True)
def frozen_now(monkeypatch) -> float:
    """把被测模块的墙上时钟钉到 TEST_NOW(全文件默认生效)。

    qoder_checkin_account / qoder_probe_status 里只有两处 time.time()(第 465/576 行),
    它们把 now 交给 _claimable_campaigns 做「窗口起点同自然日」判定。钉住后,
    「窗口内 CLAIMED」的用例不再因为跑在 00:00–00:59 而跨日假红。
    JWT/session 过期仍走相对偏移(make_qoder_jwt/_iso_utc),与墙钟无关。
    """

    class _FrozenTime:
        @staticmethod
        def time() -> float:
            return TEST_NOW

    monkeypatch.setattr(qoder_mod, "time", _FrozenTime)
    return TEST_NOW


def _campaign(
    cid: str,
    status: str,
    amount: int = 100,
    start=-3600,
    end=3600,
    now: float = TEST_NOW,
) -> dict:
    """窗口按固定时钟 now(默认 TEST_NOW)的相对偏移给 —— 默认即 10:00→12:00 的同日窗口。"""
    return {
        "campaignId": cid,
        "campaignKey": "daily-100",
        "actionType": "CLAIM_BENEFIT",
        "claimStatus": status,
        "startAt": now + start,
        "endAt": now + end,
        "benefit": {"kind": "CREDITS", "amount": amount},
    }


def _abs_campaign(
    cid: str,
    status: str,
    start: float,
    end: float,
    action: str = "CLAIM_BENEFIT",
    amount: int = 100,
) -> dict:
    """窗口用绝对 epoch 给的 campaign(对照 _campaign 的 TEST_NOW 相对偏移版本)。"""
    return {
        "campaignId": cid,
        "campaignKey": "daily-100",
        "actionType": action,
        "claimStatus": status,
        "startAt": start,
        "endAt": end,
        "benefit": {"kind": "CREDITS", "amount": amount},
    }


def _today_window() -> tuple[float, float, float]:
    """TEST_DAY(+08)10:00 → 次日 09:59 的窗口,及窗口内 2 小时后的 now。

    窗口形状(10:00 → 次日 09:59,即 86340 秒)是**上游业务事实**,不是测试编的形状:
    checkin_qoder.py 模块注释写明「每天 10:00(UTC+8)刷新」,`_claimable_campaigns`
    注释里还留着实测 startAt=1793498400(+08 2026-11-01 10:00)、
    endAt=1793584740(+08 2026-11-02 09:59)。
    但「锚在哪一天」纯属**测试假设** —— 这里钉死在 TEST_DAY,不读机器时钟,
    所以凌晨/跨日/跨年跑都得到同一读数。
    """
    start = _cn_ts(TEST_DAY, 10, 0)
    return start, start + 86340.0, start + 7200.0


# ---------------------------------------------------------------------------
# 纯函数
# ---------------------------------------------------------------------------


class TestJwtParsing:
    def test_extract_uid_sub(self):
        assert qoder_extract_uid(make_qoder_jwt()) == UID

    def test_extract_uid_fallback_keys(self):
        payload = {"uid": 42}
        token = f"x.{_b64(payload)}.y"
        assert qoder_extract_uid(token) == "42"

    def test_extract_uid_invalid(self):
        assert qoder_extract_uid("not-a-jwt") is None
        assert qoder_extract_uid("") is None

    def test_jwt_exp_future(self):
        exp_dt, remaining = qoder_jwt_exp(make_qoder_jwt(exp_offset=7200))
        assert exp_dt is not None and remaining is not None and remaining > 1.5

    def test_jwt_exp_missing(self):
        token = f"x.{_b64({'sub': UID})}.y"
        assert qoder_jwt_exp(token) == (None, None)


class TestDeviceMapUid:
    """device_map uid 读取面(真机实证 2026-10-12:token 是 opaque 非 JWT,
    uid 只能从 device_map 落库值取 —— 桌面端从 user.id 提取)。"""

    def test_uid_key_priority(self):
        assert qoder_device_map_uid({"uid": "u-1", "user_id": "u-2"}) == "u-1"
        assert qoder_device_map_uid({"user_id": "u-2"}) == "u-2"
        assert qoder_device_map_uid({"userId": 42}) == "42"

    def test_missing_or_blank(self):
        assert qoder_device_map_uid({}) is None
        assert qoder_device_map_uid({"uid": "  "}) is None
        assert qoder_device_map_uid({"uid": None}) is None


# ---------------------------------------------------------------------------
# 会话 expiresAt 过期预检(真机实证 2026-10-11:auth.v1.dat 含 ISO 8601 expiresAt)
# ---------------------------------------------------------------------------


def _iso_utc(hours: float) -> str:
    """now(UTC)+hours → auth.v1.dat 同款 ISO 8601 字符串(Z 后缀,真 UTC 时刻)。"""
    dt = datetime.datetime.now(datetime.UTC) + datetime.timedelta(hours=hours)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


class TestSessionExpiry:
    def test_future_iso(self):
        """未来 expiresAt(ISO 8601)→ remaining > 0,数值与偏移吻合。"""
        dm = {"expires_at": _iso_utc(48)}
        exp_dt, remaining = qoder_session_expiry(dm)
        assert exp_dt is not None and remaining is not None
        assert 47.0 < remaining < 49.0

    def test_past_iso(self):
        """过去 expiresAt → remaining < 0(过期)。"""
        dm = {"expires_at": _iso_utc(-24)}
        exp_dt, remaining = qoder_session_expiry(dm)
        assert exp_dt is not None and remaining is not None
        assert remaining < 0

    def test_missing(self):
        """缺失(含桌面端现状 expires_at=0)→ (None, None),绝不误判过期。"""
        assert qoder_session_expiry({}) == (None, None)
        assert qoder_session_expiry({"expires_at": 0}) == (None, None)
        assert qoder_session_expiry({"expires_at": None}) == (None, None)

    def test_bad_format(self):
        """坏格式 → (None, None),不抛栈。"""
        assert qoder_session_expiry({"expires_at": "not-a-date"}) == (None, None)
        assert qoder_session_expiry({"expires_at": "2026-13-99T99:99:99Z"}) == (None, None)
        assert qoder_session_expiry({"expires_at": True}) == (None, None)
        assert qoder_session_expiry({"expires_at": ["x"]}) == (None, None)

    def test_epoch_seconds_form(self):
        """刷新链路写回的 epoch 秒数形态 → 与 qoder_jwt_exp 同语义。"""
        dm = {"expires_at": time.time() + 3600.0}
        exp_dt, remaining = qoder_session_expiry(dm)
        assert exp_dt is not None and remaining is not None
        assert 0.5 < remaining < 1.5

    def test_session_key_alias_and_negative_epoch(self):
        """auth.v1.dat 原文键 expiresAt 也可解析;epoch 负值视为缺失。"""
        dm = {"expiresAt": _iso_utc(10)}
        _, remaining = qoder_session_expiry(dm)
        assert remaining is not None and 9.0 < remaining < 11.0
        assert qoder_session_expiry({"expires_at": -5}) == (None, None)

    def test_refresh_token_expiry_fallback(self):
        """expiresAt 缺失时回落 refreshTokenExpiresAt(snake/camel 两形态)。"""
        future = _iso_utc(72)
        _, remaining = qoder_session_expiry({"refresh_token_expires_at": future})
        assert remaining is not None and remaining > 70.0
        _, remaining = qoder_session_expiry({"refreshTokenExpiresAt": future})
        assert remaining is not None and remaining > 70.0

    def test_session_expiry_preferred_over_refresh(self):
        """两者都在时优先更紧迫的会话 expiresAt。"""
        dm = {
            "expires_at": _iso_utc(5),
            "refresh_token_expires_at": _iso_utc(720),
        }
        _, remaining = qoder_session_expiry(dm)
        assert remaining is not None and 4.0 < remaining < 6.0

    def test_aware_offset_iso(self):
        """带时区偏移的 ISO 8601(+08:00)→ 转本地后语义一致。"""
        dm = {"expires_at": "2026-10-31T12:56:16+08:00"}
        exp_dt, remaining = qoder_session_expiry(dm)
        assert exp_dt is not None and remaining is not None
        assert exp_dt.tzinfo is None  # 与 qoder_jwt_exp 同为 naive 本地语义


class TestCosyHeaders:
    def test_full_mapping(self):
        dm = {
            "cosy": {
                "client_type": "10",
                "machine_id": "mid-1",
                "machine_token": "mtok",
                "machine_code": "mcode",
                "machine_type": "PC",
                "machine_hostname": "host-1",
                "machine_os": "x86_64_windows",
                "version": "1.2.3",
            }
        }
        h = build_cosy_headers(dm)
        assert h["Cosy-ClientType"] == "10"
        assert h["Cosy-MachineId"] == "mid-1"
        assert h["Cosy-MachineToken"] == "mtok"
        assert h["Cosy-MachineCode"] == "mcode"
        assert h["Cosy-MachineType"] == "PC"
        assert h["Cosy-MachineHostname"] == "host-1"
        assert h["Cosy-MachineOS"] == "x86_64_windows"
        assert h["Cosy-Version"] == "1.2.3"

    def test_defaults_fill_client_type_and_os(self):
        h = build_cosy_headers({})
        assert h["Cosy-ClientType"] == CLIENT_TYPE_DEFAULT
        assert "_windows" in h["Cosy-MachineOS"] or "_macos" in h["Cosy-MachineOS"] or "_linux" in h["Cosy-MachineOS"]

    def test_empty_values_skipped(self):
        h = build_cosy_headers({"cosy": {"machine_id": "  ", "machine_token": ""}})
        assert "Cosy-MachineId" not in h
        assert "Cosy-MachineToken" not in h

    def test_non_ascii_hostname_sanitized(self):
        """根因回归(2026-10-23 真机证据):中文 machine_hostname "服务器" 若原样
        进 Cosy-MachineHostname,httpx 在 HTTP/1.1 下 encode('ascii') 会抛
        UnicodeEncodeError,被 _api_call 误吞成"网络异常",致 id=5 每日签到全挂。
        清洗后必须:中文被剔除(不残留非 ASCII)、空值不出头、ASCII 值原样保留,
        且构造出的头一定能被 httpx 正常发出去(无编码异常)。"""
        from app.services.checkin_qoder import _ascii_header_value

        # 纯中文 → 空 → 不出头
        h = build_cosy_headers({"cosy": {"machine_hostname": "服务器", "machine_id": "mid-1"}})
        assert "Cosy-MachineHostname" not in h
        assert h["Cosy-MachineId"] == "mid-1"

        # 中英混合 → 只留 ASCII 部分
        h2 = build_cosy_headers({"cosy": {"machine_hostname": "服务器-PC01"}})
        assert h2["Cosy-MachineHostname"] == "-PC01"
        assert "Cosy-MachineHostname" in h2

        # 直接单测清洗函数
        assert _ascii_header_value("服务器") == ""
        assert _ascii_header_value("LICHUNCHUAN") == "LICHUNCHUAN"
        assert _ascii_header_value("服务器") != "服务器"
        assert _ascii_header_value(None) == ""
        assert _ascii_header_value(10) == "10"

        # 全头族均为 ASCII(httpx 能无异常编码 ⇒ 不再触发 UnicodeEncodeError)
        full = build_cosy_headers(
            {
                "cosy": {
                    "client_type": "10",
                    "machine_os": "x86_64_windows",
                    "machine_hostname": "服务器",
                    "machine_id": "a0358379-dd23",
                    "machine_token": "mtok",
                    "machine_code": "mcode",
                    "machine_type": "PC",
                    "version": "1.2.3",
                }
            }
        )
        for _k, v in full.items():
            v.encode("ascii")  # 不抛 ⇒ 合法 HTTP 头值


class TestClaimable:
    def test_claimable_extracted(self):
        camps = [_campaign("c1", "CLAIMABLE"), {"actionType": "OTHER", "claimStatus": "CLAIMABLE"}]
        claimable, already = _claimable_campaigns(camps, TEST_NOW)
        assert len(claimable) == 1 and claimable[0]["campaignId"] == "c1"
        assert already is False

    def test_already_claimed_in_window(self):
        # 窗口锚到 TEST_DAY 的 10:00,而不是机器时钟的「今天」:已领判据(2026-11 起)
        # 还要求「窗口起点与 now 同属一个自然日」,相对当前时刻造 startAt 会在跨零点时
        # 落到昨天。断言本身没变(窗口内 CLAIMED ⇒ 已领),只是去掉了对时钟的依赖。
        start, end, now = _today_window()
        claimable, already = _claimable_campaigns([_abs_campaign("c1", "CLAIMED", start, end)], now)
        assert claimable == [] and already is True

    def test_claimed_outside_window_not_already(self):
        camps = [_campaign("c1", "CLAIMED", start=-7200, end=-3600)]
        claimable, already = _claimable_campaigns(camps, TEST_NOW)
        assert claimable == [] and already is False


class TestClaimableWindowBoundary:
    """窗口边界逐秒钉死:证明判据卡在 `startAt <= now < endAt`,不是靠放宽时间通过。

    窗口形状取产品实测形态「当天 10:00 → 次日 09:59」(见 _today_window 注释)。
    """

    START = _cn_ts(TEST_DAY, 10, 0)
    END = START + 86340.0  # 次日 09:59

    @pytest.mark.parametrize(
        "delta,expected",
        [(-1, False), (0, True), (1, True)],
        ids=["start-1s", "start", "start+1s"],
    )
    def test_window_open_boundary(self, delta, expected):
        """开窗前 1 秒未领;边界那一秒起算已领(start+1s 仍已领 ⇒ 没被抄成 `<`)。"""
        camp = _abs_campaign("b", "CLAIMED", self.START, self.END)
        claimable, already = _claimable_campaigns([camp], self.START + delta)
        assert claimable == [] and already is expected

    def test_window_end_boundary_exclusive(self):
        """收窗是右开区间:end-1 仍在窗口内,end 那一秒已经关窗。

        用同日窗口(10:00→12:00)隔离右端判据,避免与「起点同自然日」叠在一起看不出是哪条挡的。
        """
        start, end = self.START, self.START + 7200.0
        camp = _abs_campaign("b2", "CLAIMED", start, end)
        assert _claimable_campaigns([camp], end - 1)[1] is True
        assert _claimable_campaigns([camp], end)[1] is False


class TestInjectedClockStability:
    """同一份窗口数据在 03:00 / 11:00 / 23:59 三个注入时刻下的结论由业务规则决定。

    被测模块的 now 被 frozen_now 钉住(此处再按参数注入具体时刻),与机器时钟无关;
    结论差异只来自「窗口此刻是否已开」这一条真实业务规则。
    """

    WINDOW = _abs_campaign(
        "c-1", "CLAIMED", _cn_ts(TEST_DAY, 10, 0), _cn_ts(TEST_DAY, 10, 0) + 86340.0
    )

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "hour,expected_status",
        [(3, "fail"), (11, "already"), (23, "already")],
        ids=["0300-before-open", "1100-in-window", "2359-in-window"],
    )
    async def test_verdict_at_injected_instants(self, jwt, monkeypatch, hour, expected_status):
        now = _cn_ts(TEST_DAY, hour, 0)

        class _Clock:
            @staticmethod
            def time() -> float:
                return now

        monkeypatch.setattr(qoder_mod, "time", _Clock)

        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json={"campaigns": [dict(self.WINDOW)]})

        result = await qoder_checkin_account("acc1", jwt, {}, client=make_client(handler))
        assert result["status"] == expected_status
        if expected_status == "fail":
            assert "未下发" in result["message"]  # 03:00 窗口未开,不得误报「今日已领」

    def test_helpers_no_longer_read_wall_clock(self):
        """回归闸:造数 helper 必须只依赖 TEST_NOW(再读墙钟就会回到 00:00–00:59 假红)。"""
        assert _campaign("c", "CLAIMED")["startAt"] == TEST_NOW - 3600
        start, end, now = _today_window()
        assert start == _cn_ts(TEST_DAY, 10, 0)
        assert end == _cn_ts(TEST_DAY, 10, 0) + 86340.0
        assert now == TEST_NOW + 3600


class TestClaimableWindowDay:
    """已领判据必须「窗口起点所属 Asia/Shanghai 自然日 == now 所在自然日」。

    Qoder 一个领取窗口是「当天 10:00 → 次日 09:59」,横跨两个自然日;只看
    「CLAIMED 落在窗口内」会让每天 00:00–09:59 跑的检查把昨天那一轮当成今天已领
    (实证:2026-10-31 06:03 账号 13 记 skip_already,同日 10:06 却 claim_ok +100)。
    本类所有用例都用固定 epoch(见 _cn_ts),不依赖当前时钟。
    """

    # 实测窗口(2026-11-01 那一轮):startAt=1793498400(+08 10:00)、endAt=1793584740(+08 次日 09:59)
    WIN_START = 1793498400.0
    WIN_END = 1793584740.0

    def test_0600_probe_yesterday_window_claimed_is_not_already(self):
        """① 06:00 探针 + 只有昨天 10:00 开窗的 CLAIMED ⇒ 未领(复现原 bug)。"""
        prev_start = _cn_ts("2026-10-31", 10, 0)  # 1793412000
        prev_end = _cn_ts("2026-11-01", 9, 59)  # 1793498340
        now = _cn_ts("2026-11-01", 6, 0)  # 1793484000,确实落在昨天窗口内
        assert prev_start <= now < prev_end  # 前置:旧判据在这里必然误判
        camp = _abs_campaign("prev", "CLAIMED", prev_start, prev_end)
        claimable, already = _claimable_campaigns([camp], now)
        assert claimable == [] and already is False

    def test_1200_today_window_claimed_is_already(self):
        """② 12:00 + 今天 10:00 开窗的 CLAIMED ⇒ 已领(主签到 10:05 路径不变)。"""
        now = _cn_ts("2026-11-01", 12, 0)  # 1793505600
        camp = _abs_campaign("today", "CLAIMED", self.WIN_START, self.WIN_END)
        claimable, already = _claimable_campaigns([camp], now)
        assert claimable == [] and already is True

    def test_1200_today_window_claimable_hit(self):
        """③ 12:00 + 今天 10:00 开窗的 CLAIMABLE ⇒ 可领命中,且不算已领。"""
        now = _cn_ts("2026-11-01", 12, 0)
        camp = _abs_campaign("today", "CLAIMABLE", self.WIN_START, self.WIN_END)
        claimable, already = _claimable_campaigns([camp], now)
        assert len(claimable) == 1 and claimable[0]["campaignId"] == "today"
        assert already is False

    def test_cross_year_window_claimed_is_not_already(self):
        """④ 跨年边界:12-31 10:00 开窗、次年 01-01 06:00 检查 ⇒ 未领;同日 12:00 仍判已领。"""
        start = _cn_ts("2026-12-31", 10, 0)  # 1798682400
        end = _cn_ts("2027-01-01", 9, 59)  # 1798768740
        camp = _abs_campaign("ny", "CLAIMED", start, end)
        for now, expected in (
            (_cn_ts("2027-01-01", 6, 0), False),  # 1798754400:窗口内但起点属去年
            (_cn_ts("2026-12-31", 12, 0), True),  # 1798689600:同一天,正常判已领
        ):
            claimable, already = _claimable_campaigns([camp], now)
            assert claimable == [] and already is expected

    def test_non_claim_benefit_claimed_ignored(self):
        """⑤ actionType != CLAIM_BENEFIT 的 CLAIMED 不参与已领(回归,原行为)。"""
        now = _cn_ts("2026-11-01", 12, 0)
        camp = _abs_campaign("other", "CLAIMED", self.WIN_START, self.WIN_END, action="OTHER")
        claimable, already = _claimable_campaigns([camp], now)
        assert claimable == [] and already is False

    @pytest.mark.asyncio
    async def test_probe_0600_not_report_today_claimed(self, monkeypatch):
        """用户可见面:06:00 探针在只有昨天窗口 CLAIMED 时不得回「今日已领取」。"""
        prev_start = _cn_ts("2026-10-31", 10, 0)
        prev_end = _cn_ts("2026-11-01", 9, 59)
        now = _cn_ts("2026-11-01", 6, 0)
        payload = {"campaigns": [_abs_campaign("prev", "CLAIMED", prev_start, prev_end)]}

        async def fake_api(
            path, method="GET", token="", body=None, device_map=None, timeout=30.0, client=None
        ):
            return 200, payload

        class _FrozenTime:
            @staticmethod
            def time() -> float:
                return now

        monkeypatch.setattr(qoder_mod, "_api_call", fake_api)
        monkeypatch.setattr(qoder_mod, "time", _FrozenTime)
        ok, checked_in, _credits, message = await qoder_probe_status("n", "tok", {})
        assert ok is True and checked_in is False and message == ""


class TestClassify:
    def test_contract(self):
        assert qoder_classify_error(401, None) == ("SessionDead", -1)
        assert qoder_classify_error(429, None) == ("SoftRate", 60)
        assert qoder_classify_error(503, None) == ("Server", 600)
        assert qoder_classify_error(400, None) == ("Client", 600)
        assert qoder_classify_error(None, "x") == ("Unknown", 0)

    def test_challenge_403(self):
        """第五件套:403 拦截墙 → Challenge 即时熔断(不再走 4xx 三连击)。"""
        assert qoder_classify_error(403, None) == ("Challenge", CHALLENGE_COOLDOWN_SECONDS)


# ---------------------------------------------------------------------------
# 编排流程(MockTransport)
# ---------------------------------------------------------------------------


class TestCheckinFlow:
    @pytest.mark.asyncio
    async def test_claim_success(self, jwt):
        calls = []

        def handler(request: httpx.Request) -> httpx.Response:
            calls.append((request.method, request.url.path, dict(request.headers)))
            if request.url.path == PATH_CAMPAIGNS:
                return httpx.Response(200, json={"campaigns": [_campaign("c-1", "CLAIMABLE")]})
            if request.url.path == PATH_CLAIM.replace("{cid}", "c-1"):
                return httpx.Response(
                    200,
                    json={"data": {"status": "CLAIMED", "replayed": False,
                                   "benefit": {"kind": "CREDITS", "amount": 100}}},
                )
            return httpx.Response(404)

        dm = {"cosy": {"machine_id": "mid"}}
        result = await qoder_checkin_account("acc1", jwt, dm, client=make_client(handler))
        assert result["ok"] is True
        assert result["status"] == "success"
        assert result["action"] == "claim_ok"
        assert result["credits"] == 100 and result["credits_delta"] == 100
        # 风控头逐条确认(Cosy-MachineId 落库值必须进请求头)
        camp_headers = next(h for m, p, h in calls if p == PATH_CAMPAIGNS)
        assert camp_headers["cosy-machineid"] == "mid"  # httpx 头名小写
        assert camp_headers["authorization"].startswith("Bearer ")
        assert camp_headers["cosy-clienttype"] == CLIENT_TYPE_DEFAULT

    @pytest.mark.asyncio
    async def test_challenge_page_non_json_fuses(self, jwt):
        """第五件套:活动查询拿到 2xx 非 JSON(WAF 挑战页)→ Challenge 熔断
        + 出站全局暂停,绝不继续 claim。"""
        calls = []

        def handler(request: httpx.Request) -> httpx.Response:
            calls.append(request.url.path)
            if request.url.path == PATH_CAMPAIGNS:
                return httpx.Response(200, text="<html>请完成安全验证</html>")
            return httpx.Response(404)

        dm = {"cosy": {"machine_id": "mid"}}
        result = await qoder_checkin_account("acc1", jwt, dm, client=make_client(handler))
        assert result["ok"] is False
        assert result["classified_error"] == {
            "type": "Challenge",
            "cooldown_seconds": CHALLENGE_COOLDOWN_SECONDS,
        }
        assert calls == [PATH_CAMPAIGNS]  # 未继续 claim
        assert checkin_outbound_gate.paused_remaining() > 0  # 全局暂停已触发
        checkin_outbound_gate.reset()

    @pytest.mark.asyncio
    async def test_query_credits_challenge_page_fuses(self, jwt):
        """第五件套(查询路径):余额查询 2xx 非 JSON → Challenge 熔断 + 暂停。"""

        def handler(request: httpx.Request) -> httpx.Response:
            if request.url.path == PATH_QUOTA:
                return httpx.Response(200, text="<html>challenge</html>")
            return httpx.Response(404)

        result = await qoder_query_credits(jwt, {"cosy": {"machine_id": "mid"}}, client=make_client(handler))
        assert result["remaining"] is None
        assert "挑战页" in str(result["error"])
        assert checkin_outbound_gate.paused_remaining() > 0
        checkin_outbound_gate.reset()

    @pytest.mark.asyncio
    async def test_query_credits_403_fuses(self, jwt):
        """第五件套(查询路径):余额查询 403 → Challenge 熔断(对齐主路语义)。"""

        def handler(request: httpx.Request) -> httpx.Response:
            if request.url.path == PATH_QUOTA:
                return httpx.Response(403, text="blocked")
            return httpx.Response(404)

        result = await qoder_query_credits(jwt, {"cosy": {"machine_id": "mid"}}, client=make_client(handler))
        assert result["remaining"] is None
        assert "403" in str(result["error"])
        assert checkin_outbound_gate.paused_remaining() > 0
        checkin_outbound_gate.reset()

    @pytest.mark.asyncio
    async def test_already_claimed(self, jwt):
        def handler(request: httpx.Request) -> httpx.Response:
            if request.url.path == PATH_CAMPAIGNS:
                return httpx.Response(200, json={"campaigns": [_campaign("c-1", "CLAIMED")]})
            return httpx.Response(404)

        result = await qoder_checkin_account("acc1", jwt, {}, client=make_client(handler))
        assert result["ok"] is True
        assert result["status"] == "already"
        assert result["action"] == "skip_already"

    @pytest.mark.asyncio
    async def test_pending_no_benefits(self, jwt):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json={"campaigns": []})

        result = await qoder_checkin_account("acc1", jwt, {}, client=make_client(handler))
        assert result["ok"] is False
        assert result["classified_error"] is None  # 业务语义不落冷却
        assert "未下发" in result["message"]

    @pytest.mark.asyncio
    async def test_401_refresh_then_retry(self, jwt):
        state = {"campaigns_calls": 0, "refreshed_token": make_qoder_jwt()}

        def handler(request: httpx.Request) -> httpx.Response:
            if request.url.path == PATH_REFRESH:
                body = json.loads(request.content.decode())
                assert body["refresh_token"] == "rt-1"
                return httpx.Response(
                    200, json={"token": state["refreshed_token"], "refreshToken": "rt-2"}
                )
            if request.url.path == PATH_CAMPAIGNS:
                state["campaigns_calls"] += 1
                if state["campaigns_calls"] == 1:
                    return httpx.Response(401)  # 首次 401 → 触发强制刷新重试
                return httpx.Response(200, json={"campaigns": [_campaign("c-1", "CLAIMABLE")]})
            if request.url.path == PATH_CLAIM.replace("{cid}", "c-1"):
                return httpx.Response(200, json={"data": {"status": "CLAIMED",
                                                          "benefit": {"amount": 100}}})
            return httpx.Response(404)

        dm = {"refresh_token": "rt-1"}
        result = await qoder_checkin_account("acc1", jwt, dm, client=make_client(handler))
        assert result["ok"] is True and result["status"] == "success"
        assert state["campaigns_calls"] == 2
        # 新 token / 新 refreshToken 写回 device_map(调用方 save_device_map 落库)
        assert dm["refresh_token"] == "rt-2"
        assert dm["expires_at"] is not None
        assert result["warning"] is None

    @pytest.mark.asyncio
    async def test_double_401_session_dead(self, jwt):
        def handler(request: httpx.Request) -> httpx.Response:
            if request.url.path == PATH_REFRESH:
                return httpx.Response(200, json={"token": make_qoder_jwt(), "refreshToken": "rt-2"})
            return httpx.Response(401)

        result = await qoder_checkin_account("acc1", jwt, {"refresh_token": "rt-1"},
                                             client=make_client(handler))
        assert result["ok"] is False
        assert result["classified_error"] == {"type": "SessionDead", "cooldown_seconds": -1}

    @pytest.mark.asyncio
    async def test_network_error(self, jwt):
        def handler(request: httpx.Request) -> httpx.Response:
            raise httpx.ConnectError("boom")

        result = await qoder_checkin_account("acc1", jwt, {}, client=make_client(handler))
        assert result["ok"] is False
        assert "网络异常" in result["message"]

    @pytest.mark.asyncio
    async def test_endpoint_fallback_on_404(self, jwt):
        seen_hosts = []

        def handler(request: httpx.Request) -> httpx.Response:
            seen_hosts.append(str(request.url.host))
            if str(request.url.host) == "openapi.qoder.com.cn":
                return httpx.Response(404)
            return httpx.Response(200, json={"campaigns": [_campaign("c-1", "CLAIMED")]})

        result = await qoder_checkin_account("acc1", jwt, {}, client=make_client(handler))
        assert result["status"] == "already"
        assert seen_hosts == ["openapi.qoder.com.cn", "openapi.qoder.sh"]

    @pytest.mark.asyncio
    async def test_unparseable_token(self):
        result = await qoder_checkin_account("acc1", "garbage", {})
        assert result["ok"] is False
        assert "无法解析账号 uid" in result["message"]

    @pytest.mark.asyncio
    async def test_opaque_token_uid_from_device_map(self):
        """真机实证 2026-10-12:opaque token(非 JWT)时 uid 从 device_map 落库值取,
        链路不再死在「无法从 token 解析 uid」。mock 网络返回已领取。"""

        def handler(request: httpx.Request) -> httpx.Response:
            assert request.headers["authorization"] == "Bearer opaque27"
            # 窗口用 TEST_NOW 的相对偏移造(原来读 time.time(),00:00–00:00:59 跑时
            # startAt=now-60 会落到昨天,「今日已领」判定翻成 False → 假红)
            return httpx.Response(200, json={"campaigns": [_campaign("c-1", "CLAIMED")]})

        result = await qoder_checkin_account(
            "acc1", "opaque27", {"uid": "019f17c6-0eca"}, client=make_client(handler)
        )
        assert result["ok"] is True
        assert result["user_id"] == "019f17c6-0eca"
        assert result["status"] == "already"


# ---------------------------------------------------------------------------
# 刷新与余额
# ---------------------------------------------------------------------------


class TestRefreshAndQuota:
    @pytest.mark.asyncio
    async def test_refresh_contract(self, jwt):
        def handler(request: httpx.Request) -> httpx.Response:
            if request.url.path == PATH_REFRESH:
                return httpx.Response(
                    200, json={"token": make_qoder_jwt(), "refreshToken": "rt-new"}
                )
            return httpx.Response(404)

        out = await qoder_refresh_token("rt-old", {}, client=make_client(handler))
        assert out is not None
        assert out["refresh_token"] == "rt-new"
        assert out["expires_at"] is not None

    @pytest.mark.asyncio
    async def test_refresh_empty_token(self):
        assert await qoder_refresh_token("", {}) is None

    @pytest.mark.asyncio
    async def test_quota_add_on_top_level(self, jwt):
        def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.path == PATH_QUOTA
            return httpx.Response(200, json={"addOnQuota": {"remaining": 500}})

        out = await qoder_query_credits(jwt, {}, client=make_client(handler))
        assert out == {"remaining": 500, "packs": [], "error": None}

    @pytest.mark.asyncio
    async def test_quota_nested_data(self, jwt):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json={"data": {"addOnQuota": {"remaining": 300}}})

        out = await qoder_query_credits(jwt, {}, client=make_client(handler))
        assert out["remaining"] == 300

    @pytest.mark.asyncio
    async def test_quota_parse_failure(self, jwt):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json={"unexpected": True})

        out = await qoder_query_credits(jwt, {}, client=make_client(handler))
        assert out["remaining"] is None
        assert "异常" in out["error"]

    @pytest.mark.asyncio
    async def test_quota_http_error(self, jwt):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(500, json={"detail": "x"})

        out = await qoder_query_credits(jwt, {}, client=make_client(handler))
        assert out["remaining"] is None and out["error"] is not None

    @pytest.mark.asyncio
    async def test_quota_401_refresh_then_retry(self, jwt):
        """401 → refresh 换新 token 重试一次;新 refresh_token/expires_at 写回 device_map。"""
        quota_tokens: list[str] = []

        def handler(request: httpx.Request) -> httpx.Response:
            if request.url.path == PATH_REFRESH:
                return httpx.Response(
                    200,
                    json={
                        # exp 偏移不同 ⇒ token 字符串与原 token 必不相同
                        "token": make_qoder_jwt(exp_offset=3600.0 * 24 * 60),
                        "refreshToken": "rt-2",
                    },
                )
            assert request.url.path == PATH_QUOTA
            quota_tokens.append(request.headers.get("authorization") or "")
            if len(quota_tokens) == 1:
                return httpx.Response(401)
            return httpx.Response(200, json={"addOnQuota": {"remaining": 777}})

        device_map: dict = {"refresh_token": "rt-1"}
        out = await qoder_query_credits(jwt, device_map, client=make_client(handler))
        assert out == {"remaining": 777, "packs": [], "error": None}
        assert len(quota_tokens) == 2
        assert quota_tokens[0].endswith(jwt)
        assert quota_tokens[1] != quota_tokens[0]
        assert device_map["refresh_token"] == "rt-2"
        assert "expires_at" in device_map

    @pytest.mark.asyncio
    async def test_quota_401_refresh_failure(self, jwt):
        """401 且 refresh 也失败(如 refresh_token 空)→ 返回错误,不无限重试。"""
        calls: list[str] = []

        def handler(request: httpx.Request) -> httpx.Response:
            calls.append(request.url.path)
            return httpx.Response(401)

        out = await qoder_query_credits(jwt, {}, client=make_client(handler))
        assert out["remaining"] is None
        assert "HTTP 401" in out["error"]
        assert calls.count(PATH_QUOTA) == 1  # 无 refresh_token ⇒ 不重试
        assert PATH_REFRESH not in calls


# ---------------------------------------------------------------------------
# 端点契约(常量钉住,防漂移)
# ---------------------------------------------------------------------------


class TestConstants:
    def test_bases_order_cn_first(self):
        assert QODER_BASES == ("https://openapi.qoder.com.cn", "https://openapi.qoder.sh")

    def test_paths(self):
        assert PATH_CAMPAIGNS == "/sash/api/v1/me/campaigns"
        assert PATH_CLAIM == "/sash/api/v1/me/campaigns/{cid}/claim"
        assert PATH_REFRESH == "/api/v1/deviceToken/refresh"
        assert PATH_QUOTA == "/api/v2/quota/usage"
# ⁠[IHUI-AI-PROVENANCE-TAIL]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
