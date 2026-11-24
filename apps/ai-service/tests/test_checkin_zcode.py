# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""checkin_zcode 单测(2026-11-12 立,第七平台波谷额度领取引擎)。

纯函数面:parse_preview / _classify / device_mid_for / plan_token_of(键位优先序)。
行为面(httpx.MockTransport 假上游,零真实网络):
- preview 空清单 ⇒ ok+skip_already,**一次 POST 都不发**(负对照);
- preview 两计划 ⇒ 逐 claim,全成功 credits_delta = grant_units 合计;
- 401 ⇒ SessionDead 永久冷却且**不再发 claim**;
- preview 非 0 码(窗口未开)⇒ 失败但**零冷却**(补跑腿当天必须还能重试);
- probe 只读:任何路径都不许打到 claim 端点。
契约形态用真客户端信封形状(取证见 checkin_zcode 头注),夹具与断言一比一对齐。
"""

from __future__ import annotations

import json
from typing import Any

import httpx
import pytest

from app.services.checkin_zcode import (
    PATH_CLAIM,
    PATH_PREVIEW,
    _classify,
    device_mid_for,
    parse_preview,
    plan_token_of,
    zcode_claim_account,
    zcode_probe_status,
)


def _preview_body(plans: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "code": 0,
        "msg": "",
        "data": {
            "server_time": 1763000000,
            "plans": [
                {
                    "plan_id": p["plan_id"],
                    "name": p.get("name", p["plan_id"]),
                    "entitlements": [
                        {
                            "entitlement_id": f"e-{p['plan_id']}",
                            "show_name": "GLM-5.3-Flash 波谷额度",
                            "grant_units": p.get("grant_units", 300000000),
                            "unit_type": "tokens",
                            "period": "daily",
                        }
                    ],
                }
                for p in plans
            ],
        },
    }


def test_parse_preview_forms() -> None:
    p = parse_preview(_preview_body([{"plan_id": "off-peak-daily", "grant_units": 300000000}]))
    assert p["code"] == 0
    assert p["plans"] == [{"plan_id": "off-peak-daily", "name": "off-peak-daily", "grant_units": 300000000}]
    empty = parse_preview(_preview_body([]))
    assert empty["plans"] == []
    nonent = parse_preview({"code": 0, "data": {"plans": [{"name": "x"}, {"plan_id": "  "}]}})
    assert nonent["plans"] == []  # 无 plan_id / 空 plan_id 不成条目(claim 无锚点)
    assert parse_preview(None)["message"] == "响应非 JSON"
    assert parse_preview({"code": "0", "data": {}})["code"] is None  # 字符串码不冒充 int 码


def test_classify_auth_and_soft() -> None:
    assert _classify(401, None) == {"type": "SessionDead", "cooldown_seconds": -1}
    assert _classify(200, 1000) == {"type": "SessionDead", "cooldown_seconds": -1}
    assert _classify(200, 1001) == {"type": "SessionDead", "cooldown_seconds": -1}
    assert _classify(502, None) == {"type": "SoftRate", "cooldown_seconds": 300}
    # 窗口未开(普通 4xx/软业务码)必须**零冷却** ⇒ 补跑轮今日仍可见"无确定结果"并重试
    assert _classify(400, 5001) is None
    assert _classify(200, 0) is None


def test_device_mid_prefers_stored_then_derives_stably() -> None:
    mid = device_mid_for({"pool_device_id": " real-mid "}, "uid-1")
    assert mid == "real-mid"
    a = device_mid_for({}, "uid-1")
    b = device_mid_for({}, "uid-1")
    c = device_mid_for({}, "uid-2")
    assert a == b and a != c  # 确定性 + 账号间互异
    seg = a.split("-")
    assert [len(s) for s in seg] == [8, 4, 4, 4, 12] and seg[2].startswith("4") and seg[3][0] in "89ab"
    with pytest.raises(ValueError):
        device_mid_for({}, "")


def test_plan_token_key_priority_zcodejwt_over_oauth() -> None:
    # 导入槽 token=oauth access;device_map 带 plan 票 ⇒ 必须取 plan 票
    assert plan_token_of("oauth-access", {"zcode_plan_jwt": " plan-jwt "}) == "plan-jwt"
    assert plan_token_of("oauth-access", {"zcodejwttoken": "legacy-jwt"}) == "legacy-jwt"
    assert plan_token_of("oauth-access", {}) == "oauth-access"  # 键缺位原样透交,不静默清空


def _transport(sink: list[httpx.Request], preview_plans: list[dict[str, Any]] | None = None, claim_code: int = 0) -> httpx.AsyncClient:
    async def handler(request: httpx.Request) -> httpx.Response:
        sink.append(request)
        path = request.url.path
        if path.endswith(PATH_PREVIEW):
            assert request.method == "GET"
            return httpx.Response(200, json=_preview_body(preview_plans or []))
        if path.endswith(PATH_CLAIM):
            assert request.method == "POST"
            body = json.loads(request.content.decode())
            pid = body["plan_id"]
            return httpx.Response(200, json={"code": claim_code, "data": {"plan": {"plan_id": pid, "ends_at": 1763040000}}})
        if path.endswith("/billing/balance"):
            return httpx.Response(404, json={"code": 9999, "msg": "not expected here"})
        raise AssertionError(f"意外端点: {path}")

    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


async def test_claim_flow_empty_preview_claims_nothing() -> None:
    sink: list[httpx.Request] = []
    async with _transport(sink, []) as client:
        r = await zcode_claim_account("n1", "jwt", {"pool_uid": "u1"}, client=client)
    assert r["ok"] is True and r["action"] == "skip_already"
    assert [q.url.path for q in sink] == [PATH_PREVIEW]  # **一次 POST 都没发**(假阳性守卫)


async def test_claim_flow_claims_each_plan() -> None:
    sink: list[httpx.Request] = []
    plans = [{"plan_id": "pa", "grant_units": 300}, {"plan_id": "pb", "grant_units": 200}]
    async with _transport(sink, plans) as client:
        r = await zcode_claim_account("n1", "jwt", {"pool_uid": "u1"}, client=client)
    assert r["ok"] is True and r["action"] == "claim_ok"
    assert r["credits"] == 500 and r["credits_delta"] == 500
    claims = [q for q in sink if q.url.path.endswith(PATH_CLAIM)]
    assert [json.loads(q.content)["plan_id"] for q in claims] == ["pa", "pb"]
    auth = sink[0].headers["authorization"]
    assert auth == "Bearer jwt" and sink[0].headers["X-Device-Mid"] and sink[0].headers["X-ZCode-App-Version"]


async def test_claim_uses_plan_jwt_when_present() -> None:
    sink: list[httpx.Request] = []
    async with _transport(sink, [{"plan_id": "pa", "grant_units": 1}]) as client:
        r = await zcode_claim_account(
            "n1", "oauth-access", {"pool_uid": "u1", "zcode_plan_jwt": "pj"}, client=client
        )
    assert r["ok"] is True
    assert sink[0].headers["authorization"] == "Bearer pj"


async def test_401_preview_is_permanent_cool_and_no_write() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"code": 1000})

    sink_claims: list[str] = []
    async def counting(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith(PATH_CLAIM):
            sink_claims.append(request.url.path)
        return await handler(request)

    async with httpx.AsyncClient(transport=httpx.MockTransport(counting)) as client:
        r = await zcode_claim_account("n1", "jwt", {"pool_uid": "u1"}, client=client)
    assert r["ok"] is False and r["classified_error"] == {"type": "SessionDead", "cooldown_seconds": -1}
    assert sink_claims == []  # 鉴权失败后绝不继续写侧(死票反复打 claim=封号前兆)


async def test_window_closed_business_code_no_cooldown() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"code": 5001, "msg": "not in claim window"})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        r = await zcode_claim_account("n1", "jwt", {"pool_uid": "u1"}, client=client)
    assert r["ok"] is False
    assert r["classified_error"] is None  # 零冷却 ⇒ 补跑轮今日仍会重试
    assert "not in claim window" in r["message"] or r["code"] == 5001


async def test_probe_never_touches_claim_endpoint() -> None:
    sink: list[httpx.Request] = []
    async with _transport(sink, [{"plan_id": "pa", "grant_units": 10}]) as client:
        ok, checked, units, msg = await zcode_probe_status("n1", "jwt", {"pool_uid": "u1"}, client=client)
    assert ok is True and checked is False and units == 10 and "可领" in msg
    assert [q.url.path for q in sink] == [PATH_PREVIEW]
    sink2: list[httpx.Request] = []
    async with _transport(sink2, []) as client:
        ok2, checked2, _, _ = await zcode_probe_status("n1", "jwt", {"pool_uid": "u1"}, client=client)
    assert ok2 is True and checked2 is True and [q.url.path for q in sink2] == [PATH_PREVIEW]


async def test_missing_token_reports_undetermined_not_zero() -> None:
    r = await zcode_claim_account("n1", "", {}, client=httpx.AsyncClient())
    assert r["ok"] is False and "zcodejwttoken" in r["message"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
