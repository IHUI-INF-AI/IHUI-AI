# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Trae 积分余额查询单测(风控第五件套查询路径,2026-10-16 立)。

覆盖:
- 2xx 非 JSON(WAF 挑战页)→ Challenge 熔断 + 出站全局暂停;
- 403 拦截墙 → Challenge 熔断(与签到主路 classify 同语义);
- 暂停期 before_request 抛 OutboundPaused 上抛(不再被吞成 error dict);
- 正常 200 JSON 解析回归。
"""

from __future__ import annotations

import httpx
import pytest

from app.services import checkin_credits as cc
from app.services.checkin_outbound import OutboundPaused, checkin_outbound_gate


def make_client(handler) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(handler), trust_env=False)


@pytest.fixture(autouse=True)
def _fast_gate(monkeypatch):
    monkeypatch.setenv("CHECKIN_OUTBOUND_MIN", "0")
    monkeypatch.setenv("CHECKIN_OUTBOUND_MAX", "0")
    checkin_outbound_gate.reset()
    yield
    checkin_outbound_gate.reset()


class TestChallengeFuse:
    @pytest.mark.asyncio
    async def test_non_json_challenge_page_fuses(self, monkeypatch):
        """2xx 非 JSON = 挑战页:熔断 + 全局暂停(原路径静默回 error dict)。"""

        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, text="<html>请完成安全验证</html>")

        client = make_client(handler)
        monkeypatch.setattr(cc, "get_http_client", lambda: client)
        result = await cc.query_remaining_credits("tok")
        assert result["remaining"] is None
        assert "挑战页" in str(result["error"])
        assert checkin_outbound_gate.paused_remaining() > 0
        await client.aclose()

    @pytest.mark.asyncio
    async def test_403_wall_fuses(self, monkeypatch):
        """403 = 拦截墙:熔断(与签到主路 403=Challenge 同语义)。"""

        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(403, text="blocked by waf")

        client = make_client(handler)
        monkeypatch.setattr(cc, "get_http_client", lambda: client)
        result = await cc.query_remaining_credits("tok")
        assert result["remaining"] is None
        assert "403" in str(result["error"])
        assert checkin_outbound_gate.paused_remaining() > 0
        await client.aclose()

    @pytest.mark.asyncio
    async def test_paused_gate_propagates_outbound_paused(self, monkeypatch):
        """暂停期 before_request 必须上抛 OutboundPaused(修复前被 except
        Exception 吞成 error dict,调度批不 break)。"""

        def handler(request: httpx.Request) -> httpx.Response:
            raise AssertionError("暂停期不得发出真实请求")

        client = make_client(handler)
        monkeypatch.setattr(cc, "get_http_client", lambda: client)
        checkin_outbound_gate.pause(seconds=60, reason="test")
        with pytest.raises(OutboundPaused):
            await cc.query_remaining_credits("tok")
        await client.aclose()


class TestNormalPath:
    @pytest.mark.asyncio
    async def test_200_json_parses_remaining(self, monkeypatch):
        """正常 200 JSON:按未过期包汇总剩余额度(回归护栏)。"""

        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                200,
                json={
                    "user_entitlement_pack_list": [
                        {
                            "entitlement_base_info": {
                                "quota": {"credits_limit": 100},
                                "expire_time": "2099-01-01T00:00:00Z",
                                "charge_amount": 0,
                            },
                            "usage": {"credits_amount": 30},
                        }
                    ]
                },
            )

        client = make_client(handler)
        monkeypatch.setattr(cc, "get_http_client", lambda: client)
        result = await cc.query_remaining_credits("tok")
        assert result["error"] is None
        assert result["remaining"] == 70
        assert checkin_outbound_gate.paused_remaining() == 0  # 正常路径不暂停
        await client.aclose()

    @pytest.mark.asyncio
    async def test_empty_jwt_short_circuits(self):
        result = await cc.query_remaining_credits("")
        assert result["remaining"] is None
        assert "jwt 为空" in str(result["error"])
