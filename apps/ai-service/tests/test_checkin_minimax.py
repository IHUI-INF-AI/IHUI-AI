# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""MiniMax Code 签到引擎单测(纯函数;签名固定向量防公式抄错假绿)。

固定向量由本机实测参数生成:unix=1791993684000 钉死,
yy / x-signature 为确定性输出(与桌面端拦截器同算法)。
"""

from app.services import checkin_minimax as mm


def test_device_params_order_and_client_tail():
    params = mm.build_device_params("314069474482810883", device_id="61982068", uuid_str="uuid-x")
    assert list(params.keys()) == mm.DEVICE_PARAM_ORDER
    assert params["client"] == "desktop"
    assert params["user_id"] == "314069474482810883"
    assert params["unix"].isdigit() and len(params["unix"]) == 13  # epoch 毫秒


def test_sign_headers_fixed_vector():
    params = mm.build_device_params(
        "314069474482810883", device_id="61982068", uuid_str="7c8128f1-3649-4435-887e-b14bf0c4d8bb"
    )
    params["unix"] = "1791993684000"  # 钉死时间 ⇒ 期望值 deterministic
    _q, headers = mm.sign_headers("/minimax-cloud/api/v1/signin/status", params, "GET", None)
    assert headers["yy"] == "4e28d38acbd1ee9d8181e9459a0b9b71"
    assert headers["x-signature"] == "0b61b4a2c8b6f5b747b01e070fb4d777"
    assert headers["x-timestamp"] == "1791993684"
    _q2, headers2 = mm.sign_headers("/minimax-cloud/api/v1/signin/claim", params, "POST", {})
    assert headers2["x-signature"] == "f584fc34c95b4e41812b1c58040204b9"
    # Authorization 占位不参与签名(签名值不含 token)
    assert headers2["Authorization"] == ""


def test_encode_uri_component_js_replica():
    # JS encodeURIComponent:仅放行 A-Za-z0-9-_.!~*'();中文与 & = / 均 %XX 大写
    assert mm.encode_uri_component("/a b&c=d") == "%2Fa%20b%26c%3Dd"
    assert mm.encode_uri_component("abc-_.!~*'()") == "abc-_.!~*'()"
    assert mm.encode_uri_component("签到") == "%E7%AD%BE%E5%88%B0"


def test_parse_claim_result_three_states():
    ok, action, credits = mm.parse_claim_result({"data": {"claim_result": 0, "points": 1000, "day_no": 4}})
    assert (ok, action, credits) == (True, "claim_ok", 1000)
    ok, action, credits = mm.parse_claim_result({"data": {"claim_result": 2, "points": 1000}})
    assert (ok, action, credits) == (True, "skip_already", None)
    ok, action, _c = mm.parse_claim_result({"data": {"claim_result": 9, "message": "x"}})
    assert (ok, action) == (False, "checkin")
    assert mm.parse_claim_result({"data": None})[0] is False


def test_parse_status_days():
    body = {"data": {"days": [
        {"day_no": 1, "status": 3}, {"day_no": 2, "status": 3},
        {"day_no": 3, "status": 0},
    ]}}
    assert mm.parse_status_days(body) == 2
    assert mm.parse_status_days({}) == 0
    assert mm.parse_status_days({"data": {"days": "x"}}) == 0


def test_minimax_host_default_and_override():
    assert mm.minimax_host({}) == mm.MINIMAX_HOST_CN
    assert mm.minimax_host({"host": "https://agent.minimax.io/"}) == "https://agent.minimax.io"


def test_classify_error_tiers():
    assert mm.minimax_classify_error(401) == ("SessionDead", -1)
    assert mm.minimax_classify_error(429) == ("SoftRate", 60)
    assert mm.minimax_classify_error(503) == ("Server", 600)
    assert mm.minimax_classify_error(None) == ("Unknown", 0)
    # 第五件套(2026-10-16)钉死:本平台 403 保持 SessionDead 永久冷却,
    # 比 Challenge(30min)更保守 —— WAF 误伤时 fail-closed 停手,不自动恢复
    assert mm.minimax_classify_error(403) == ("SessionDead", -1)


async def test_checkin_4xx_with_claim_result_already_is_idempotent_success(monkeypatch):
    """2026-10-17 加固:官方若对「今日已领」返 4xx + claim_result=2,
    旧逻辑被 status>=400 抢先误报「签到失败: HTTP 400」—— 与 WorkBuddy 同型
    缺陷面。修复:已签幂等判定优先于 status>=400。本用例钉死该行为。"""

    async def fake_request(path, token, user_id, *, method="POST", body=None,
                           host=None, timeout=30, client=None, device_id="", uuid_str=""):
        return 400, {"data": {"claim_result": 2, "message": "今日已领取"}}

    monkeypatch.setattr(mm, "_mm_request", fake_request)
    res = await mm.minimax_checkin_account(
        "mm-1", "tok", {"uid": "314069474482810883"}
    )
    assert res["ok"] is True
    assert res["status"] == "already"
    assert res["action"] == "skip_already"


async def test_checkin_4xx_without_already_still_fails(monkeypatch):
    """反向对照:4xx 且业务体非「已领」时仍按失败(不被加固误放行)。"""

    async def fake_request(path, token, user_id, *, method="POST", body=None,
                           host=None, timeout=30, client=None, device_id="", uuid_str=""):
        return 400, {"data": {"claim_result": 9, "message": "活动未开始"}}

    monkeypatch.setattr(mm, "_mm_request", fake_request)
    res = await mm.minimax_checkin_account(
        "mm-1", "tok", {"uid": "314069474482810883"}
    )
    assert res["ok"] is False
    assert "400" in str(res["message"])


def test_device_map_uid_keys():
    assert mm.minimax_device_map_uid({"uid": " 123 "}) == "123"
    assert mm.minimax_device_map_uid({"user_id": 456}) == "456"
    assert mm.minimax_device_map_uid({}) is None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
