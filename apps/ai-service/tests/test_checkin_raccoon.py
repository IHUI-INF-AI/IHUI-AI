# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""checkin_raccoon 单元测试(httpx.MockTransport,不打真实网络)。

覆盖:balance/tasks/grant 三个纯解析器 / 错误分类 / token 形状 /
签到真领取(granted=true → checked, granted=false → already 幂等)/
移动端一次性奖励(claim_new_user)/ 401 / 业务码 / 网络异常 /
只读探针三态(daily>0 → True,daily=0 → False)/ 余额查询。
"""

from __future__ import annotations

from typing import Any

import httpx
import pytest

from app.services.checkin_raccoon import (
    NEW_USER_TASKS,
    PATH_BALANCE,
    PATH_GRANT_DESKTOP,
    PATH_GRANT_MOBILE,
    PATH_TASKS,
    _classify,
    _validate_token,
    parse_balance,
    parse_grant,
    parse_tasks,
    raccoon_checkin_account,
    raccoon_device_map_uid,
    raccoon_grant_login_reward,
    raccoon_probe_status,
    raccoon_query_credits,
)

TOKEN = "a.b.c" + "x" * 40  # 三段式形状,内容不参与解析


# ---------------------------------------------------------------------------
# fixtures / helpers
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _no_outbound_gap(monkeypatch: pytest.MonkeyPatch) -> None:
    """关掉出站随机间隔(默认 1.5–4.5s/请求),否则每个用例白等数秒。"""
    monkeypatch.setenv("CHECKIN_OUTBOUND_MIN", "0")
    monkeypatch.setenv("CHECKIN_OUTBOUND_MAX", "0")


def make_client(handler) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(handler), trust_env=False)


def _balance(available: int = 6300, daily: int = 300) -> dict[str, Any]:
    return {
        "code": 0,
        "message": "success",
        "data": {
            "available_points": available,
            "daily_points": daily,
            "monthly_points": 0,
            "reward_points": 6000,
            "topup_points": 0,
            "owner_id": 7969762,
        },
    }


def _grant(granted: bool, points: int | None = 300, source: str = "daily_login") -> dict[str, Any]:
    popup = (
        {"source": source, "display_name": "每日积分发放", "points": points, "expire_at": "2027-11-11T00:00:00+08:00"}
        if granted
        else None
    )
    return {"code": 0, "message": "success", "data": {"granted": granted, "popup": popup}}


def _tasks(states: dict[str, str]) -> dict[str, Any]:
    return {
        "code": 0,
        "message": "success",
        "data": {
            "new_user_task_states": [{"key": k, "status": v} for k, v in states.items()],
            "invite": {"invite_code": "abc123", "granted_points": 0},
        },
    }


def _handler(
    *,
    balance: dict[str, Any] | None = None,
    desktop: dict[str, Any] | None = None,
    mobile: dict[str, Any] | None = None,
    tasks: dict[str, Any] | None = None,
    seen: list[tuple[str, str, str]] | None = None,
):
    """按路径分发;`seen` 收集 (method, path, X-Client-Platform) 供断言。"""

    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if seen is not None:
            seen.append((request.method, path, request.headers.get("X-Client-Platform", "")))
        assert request.headers["authorization"].startswith("Bearer ")
        if path == PATH_BALANCE:
            return httpx.Response(200, json=balance if balance is not None else _balance())
        if path == PATH_TASKS:
            return httpx.Response(200, json=tasks if tasks is not None else _tasks({}))
        if path == PATH_GRANT_DESKTOP:
            assert request.method == "POST"
            return httpx.Response(200, json=desktop if desktop is not None else _grant(True))
        if path == PATH_GRANT_MOBILE:
            assert request.method == "POST"
            return httpx.Response(200, json=mobile if mobile is not None else _grant(True, 3000, "mobile_login"))
        return httpx.Response(404, json={"code": 404, "message": "no route"})

    return handler


# ---------------------------------------------------------------------------
# 纯函数
# ---------------------------------------------------------------------------


class TestParseBalance:
    def test_ok(self) -> None:
        p = parse_balance(_balance())
        assert p["code"] == 0
        assert p["available"] == 6300
        assert p["daily"] == 300
        assert p["owner_id"] == 7969762

    def test_non_dict(self) -> None:
        p = parse_balance(None)
        assert p["code"] is None and p["available"] is None
        assert p["message"] == "响应非 JSON"

    def test_bool_not_int(self) -> None:
        p = parse_balance({"code": 0, "data": {"available_points": True}})
        assert p["available"] is None


class TestParseGrant:
    def test_granted_true_popup(self) -> None:
        g = parse_grant(_grant(True, 3000, "mobile_login"))
        assert g["granted"] is True
        assert g["points"] == 3000
        assert g["source"] == "mobile_login"
        assert g["display_name"] == "每日积分发放"

    def test_granted_false_is_idempotent_not_error(self) -> None:
        g = parse_grant({"code": 0, "data": {"granted": False, "popup": None}})
        assert g["granted"] is False
        assert g["points"] is None
        assert g["source"] is None

    def test_granted_non_bool_undetermined(self) -> None:
        """真弹契约:granted 必为 bool;缺字段/字符串一律未判定,不按 falsy 猜已领。"""
        for bad in ({}, {"granted": "false"}, {"granted": 0}, {"granted": None}):
            assert parse_grant({"code": 0, "data": bad})["granted"] is None

    def test_non_dict(self) -> None:
        g = parse_grant(None)
        assert g["granted"] is None and g["message"] == "响应非 JSON"


class TestParseTasks:
    def test_only_registered_keys(self) -> None:
        p = parse_tasks(_tasks({"mobile_login": "unfinished", "brand_new": "completed"}))
        assert p["states"] == {"mobile_login": "unfinished"}
        assert "brand_new" in p["raw_keys"]

    def test_invite_code(self) -> None:
        assert parse_tasks(_tasks({}))["invite_code"] == "abc123"

    def test_invite_stats_full(self) -> None:
        """邀请块完整解析 —— 邀请没有领取接口,号池能做的就是把这四个数看住。"""
        p = parse_tasks(
            {
                "code": 0,
                "data": {
                    "new_user_task_states": [],
                    "invite": {
                        "invite_code": "code-xyz",
                        "granted_points": 4500,
                        "registered_invitee_count": 3,
                        "remaining_reward_invitees": 17,
                        "register_reward_points": 1500,
                    },
                },
            }
        )
        assert p["invite"] == {
            "code": "code-xyz",
            "granted_points": 4500,
            "registered_invitees": 3,
            "remaining_reward_invitees": 17,
            "register_reward_points": 1500,
        }
        assert p["invite_code"] == "code-xyz"

    def test_invite_partial_degrades_to_zero(self) -> None:
        """残缺 invite 块逐字段退化为 0,不把缺失当未知数以外的值。"""
        p = parse_tasks({"code": 0, "data": {"invite": {"invite_code": "abc"}}})
        assert p["invite"]["granted_points"] == 0
        assert p["invite"]["registered_invitees"] == 0
        assert p["invite"]["remaining_reward_invitees"] == 0
        assert p["invite"]["register_reward_points"] == 0

    def test_invite_absent_is_none_not_zero(self) -> None:
        """整块缺失 ⇒ 码为 None(未判定);数值字段仍为 0。"""
        p = parse_tasks({"code": 0, "data": {}})
        assert p["invite"]["code"] is None
        assert p["invite_code"] is None
        assert p["invite"]["registered_invitees"] == 0

    def test_invite_count_bool_rejected(self) -> None:
        """bool 是 int 子类,必须排除 —— 否则 True 会被当成 1 人。"""
        p = parse_tasks(
            {"code": 0, "data": {"invite": {"registered_invitee_count": True, "granted_points": False}}}
        )
        assert p["invite"]["registered_invitees"] == 0
        assert p["invite"]["granted_points"] == 0

    def test_registered_list_matches_upstream(self) -> None:
        assert NEW_USER_TASKS == ("register_pack", "desktop_login", "mobile_login")


class TestClassify:
    def test_session_dead(self) -> None:
        for status in (401, 403):
            assert _classify(status, 0) == {"type": "SessionDead", "cooldown_seconds": -1}

    def test_soft_rate(self) -> None:
        assert _classify(429, 0) == {"type": "SoftRate", "cooldown_seconds": 600}
        assert _classify(503, 0) == {"type": "SoftRate", "cooldown_seconds": 300}

    def test_business_error(self) -> None:
        assert _classify(200, 200813) == {"type": "BusinessError", "cooldown_seconds": 1800}

    def test_clean(self) -> None:
        assert _classify(200, 0) is None


class TestToken:
    def test_empty(self) -> None:
        assert _validate_token("") is not None

    def test_not_jwt(self) -> None:
        assert _validate_token("not-a-jwt-token") is not None

    def test_ok(self) -> None:
        assert _validate_token(TOKEN) is None


class TestDeviceMapUid:
    def test_forms(self) -> None:
        assert raccoon_device_map_uid({"uid": "pu-1"}) == "pu-1"
        assert raccoon_device_map_uid({"user_id": 123}) == "123"
        assert raccoon_device_map_uid({"uid": "  "}) is None
        assert raccoon_device_map_uid({}) is None
        assert raccoon_device_map_uid(None) is None


# ---------------------------------------------------------------------------
# 签到流程
# ---------------------------------------------------------------------------


class TestCheckinFlow:
    @pytest.mark.asyncio
    async def test_granted_true_is_checked_with_delta(self) -> None:
        seen: list[tuple[str, str, str]] = []
        result = await raccoon_checkin_account(
            "rc-1", TOKEN, {"uid": "pu-1"}, client=make_client(_handler(seen=seen))
        )
        assert result["ok"] is True
        assert result["status"] == "checked"
        assert result["action"] == "checkin"
        assert result["credits_delta"] == 300
        assert result["credits"] == 6600  # 基线 6300 + 300
        assert result["code"] == 0
        # 顺序:读基线 → 领取 → 回读余额校准(popup 只报一笔,同批可能多笔)→ 任务态
        assert [s[1] for s in seen] == [PATH_BALANCE, PATH_GRANT_DESKTOP, PATH_BALANCE, PATH_TASKS]
        assert ("POST", PATH_GRANT_DESKTOP, "desktop-windows") in seen

    @pytest.mark.asyncio
    async def test_granted_false_is_already_not_fail(self) -> None:
        result = await raccoon_checkin_account(
            "rc-1", TOKEN, {"uid": "pu-1"}, client=make_client(_handler(desktop=_grant(False)))
        )
        assert result["ok"] is True
        assert result["status"] == "already"
        assert result["action"] == "skip_already"
        assert result["credits_delta"] == 0
        assert result["credits"] == 6300

    @pytest.mark.asyncio
    async def test_claim_new_user_mobile_grant(self) -> None:
        seen: list[tuple[str, str, str]] = []
        result = await raccoon_checkin_account(
            "rc-1",
            TOKEN,
            {"uid": "pu-1"},
            claim_new_user=True,
            client=make_client(_handler(desktop=_grant(False), seen=seen)),
        )
        assert result["new_user_grant"]["granted"] is True
        assert result["new_user_grant"]["points"] == 3000
        assert result["credits_delta"] == 3000
        assert ("POST", PATH_GRANT_MOBILE, "mobile-android") in seen

    @pytest.mark.asyncio
    async def test_claim_new_user_off_by_default(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("IHUI_RACCOON_CLAIM_NEW_USER", raising=False)
        seen: list[tuple[str, str, str]] = []
        result = await raccoon_checkin_account(
            "rc-1", TOKEN, {"uid": "pu-1"}, client=make_client(_handler(seen=seen))
        )
        assert "new_user_grant" not in result
        assert all(s[1] != PATH_GRANT_MOBILE for s in seen)

    @pytest.mark.asyncio
    async def test_claim_new_user_via_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("IHUI_RACCOON_CLAIM_NEW_USER", "1")
        result = await raccoon_checkin_account(
            "rc-1", TOKEN, {"uid": "pu-1"}, client=make_client(_handler(desktop=_grant(False)))
        )
        assert result["new_user_grant"]["granted"] is True

    @pytest.mark.asyncio
    async def test_balance_401_is_session_dead(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(401, json={"code": 401, "message": "AUTH_ACCESS_TOKEN_MISSING"})

        result = await raccoon_checkin_account("rc-1", TOKEN, {"uid": "pu-1"}, client=make_client(handler))
        assert result["ok"] is False
        assert result["classified_error"] == {"type": "SessionDead", "cooldown_seconds": -1}

    @pytest.mark.asyncio
    async def test_grant_business_code_is_business_error(self) -> None:
        result = await raccoon_checkin_account(
            "rc-1",
            TOKEN,
            {"uid": "pu-1"},
            client=make_client(_handler(desktop={"code": 200813, "message": "device_link_required"})),
        )
        assert result["ok"] is False
        assert result["classified_error"] == {"type": "BusinessError", "cooldown_seconds": 1800}
        assert "200813" in result["message"]

    @pytest.mark.asyncio
    async def test_grant_not_bool_is_undetermined(self) -> None:
        result = await raccoon_checkin_account(
            "rc-1",
            TOKEN,
            {"uid": "pu-1"},
            client=make_client(_handler(desktop={"code": 0, "data": {}})),
        )
        assert result["ok"] is False
        assert "未判定" in result["message"]

    @pytest.mark.asyncio
    async def test_network_error(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            raise httpx.ConnectError("boom")

        result = await raccoon_checkin_account("rc-1", TOKEN, {"uid": "pu-1"}, client=make_client(handler))
        assert result["ok"] is False
        assert result["message"] == "网络异常"

    @pytest.mark.asyncio
    async def test_bad_token_short_circuits(self) -> None:
        result = await raccoon_checkin_account("rc-1", "bad", {"uid": "pu-1"})
        assert result["ok"] is False
        assert result["classified_error"]["type"] == "SessionDead"


# ---------------------------------------------------------------------------
# 只读面
# ---------------------------------------------------------------------------


class TestProbe:
    @pytest.mark.asyncio
    async def test_daily_positive_is_checked(self) -> None:
        ok, checked, credits, msg = await raccoon_probe_status(
            "rc-1", TOKEN, {"uid": "pu-1"}, client=make_client(_handler())
        )
        assert (ok, checked, credits) == (True, True, 6300)
        assert "daily=300" in msg

    @pytest.mark.asyncio
    async def test_daily_zero_is_not_checked(self) -> None:
        """2026-11-11 改:有领取接口后 daily=0 是「今日未领」,不再是「未判定」。"""
        ok, checked, credits, _ = await raccoon_probe_status(
            "rc-1", TOKEN, {"uid": "pu-1"}, client=make_client(_handler(balance=_balance(6000, 0)))
        )
        assert (ok, checked, credits) == (True, False, 6000)

    @pytest.mark.asyncio
    async def test_daily_missing_is_undetermined(self) -> None:
        body = _balance()
        body["data"].pop("daily_points")
        ok, checked, _, msg = await raccoon_probe_status(
            "rc-1", TOKEN, {"uid": "pu-1"}, client=make_client(_handler(balance=body))
        )
        assert ok is True and checked is None
        assert "未判定" in msg


class TestQueryCredits:
    @pytest.mark.asyncio
    async def test_ok(self) -> None:
        out = await raccoon_query_credits(TOKEN, {"uid": "pu-1"}, client=make_client(_handler()))
        assert out == {"error": None, "remaining": 6300}

    @pytest.mark.asyncio
    async def test_401(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(403, json={"code": 403})

        out = await raccoon_query_credits(TOKEN, {"uid": "pu-1"}, client=make_client(handler))
        assert out["remaining"] is None and "会话失效" in out["error"]


class TestGrantHelper:
    @pytest.mark.asyncio
    async def test_unknown_channel(self) -> None:
        out = await raccoon_grant_login_reward(TOKEN, "nope")
        assert out["granted"] is None
        assert "未知发放通道" in out["message"]

    @pytest.mark.asyncio
    async def test_mobile_channel_uses_mobile_platform(self) -> None:
        seen: list[tuple[str, str, str]] = []
        out = await raccoon_grant_login_reward(
            TOKEN, "mobile", client=make_client(_handler(seen=seen))
        )
        assert out["granted"] is True and out["points"] == 3000
        assert seen[0][2] == "mobile-android"


class TestBalanceReload:
    """发放后余额回读校准:popup 只报一笔,同批可能还有其它笔 ⇒ 按 popup 推算会报少。"""

    @pytest.mark.asyncio
    async def test_advanced_reload_is_authoritative(self) -> None:
        calls = {"n": 0}

        def handler(request: httpx.Request) -> httpx.Response:
            path = request.url.path
            if path == PATH_BALANCE:
                calls["n"] += 1
                # 基线 6300;回读 9900(popup 只报 3000,实际同批发了 3600)
                return httpx.Response(200, json=_balance(6300 if calls["n"] == 1 else 9900))
            if path == PATH_GRANT_DESKTOP:
                return httpx.Response(200, json=_grant(True, 3000, "desktop_login"))
            if path == PATH_TASKS:
                return httpx.Response(200, json=_tasks({}))
            return httpx.Response(404, json={"code": 404})

        r = await raccoon_checkin_account("rc-1", TOKEN, {"uid": "pu-1"}, client=make_client(handler))
        assert r["status"] == "checked"
        assert r["credits"] == 9900, "余额应以回读为准"
        assert r["credits_delta"] == 3600, "delta 应含同批其它笔,不只 popup 那一笔"
        assert r["creditsSource"] == "balance_reload"
        assert "余额回读 6300 → 9900" in r["message"]

    @pytest.mark.asyncio
    async def test_stale_reload_keeps_popup_estimate(self) -> None:
        # _handler 的 balance 恒定 6300 ⇒ 未推进,不得把 delta 抹成 0
        r = await raccoon_checkin_account("rc-1", TOKEN, {"uid": "pu-1"}, client=make_client(_handler()))
        assert r["credits_delta"] == 300
        assert r["credits"] == 6600
        assert r["creditsSource"] == "popup_estimate"
        assert "未推进" in r["message"]

    @pytest.mark.asyncio
    async def test_reload_failure_marks_warning_not_fail(self) -> None:
        calls = {"n": 0}

        def handler(request: httpx.Request) -> httpx.Response:
            path = request.url.path
            if path == PATH_BALANCE:
                calls["n"] += 1
                if calls["n"] == 1:
                    return httpx.Response(200, json=_balance())
                return httpx.Response(500, json={"code": 500, "message": "boom"})
            if path == PATH_GRANT_DESKTOP:
                return httpx.Response(200, json=_grant(True, 300))
            if path == PATH_TASKS:
                return httpx.Response(200, json=_tasks({}))
            return httpx.Response(404, json={"code": 404})

        r = await raccoon_checkin_account("rc-1", TOKEN, {"uid": "pu-1"}, client=make_client(handler))
        assert r["ok"] is True and r["status"] == "checked", "回读失败不应把整次签到判失败"
        assert r["credits"] == 6600
        assert r["creditsSource"] == "popup_estimate"
        assert "回读失败" in str(r.get("warning"))
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
