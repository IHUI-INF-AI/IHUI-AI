# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""checkin_pool_writeback 鉴权头 × internal_ticket 回归(2026-10-26,G-242 PART-LIVE)。

票面:回写请求直拼 X-Internal-Service-Token 常驻密钥头。改后:经
app.core.internal_ticket.internal_service_headers 唯一出口取头。

本模块的特殊格:回写是**机器侧动作**,调用链(checkin_scheduler.checkin_one /
internal_checkin_pool.pool_cred_flush)只给 device_map,拿不到 apps/api 用户主体
⇒ 出口按其自身口径不签票、只发旧头。这里钉住的是"不伪造主体"(验票侧会对主体做
存在+活跃校验,编一个 sub 出来只会把票变成必拒的坏票);要真带票须先把
owner_user_id 从调用方串进来(那两枚不在本席射程,已上报)。

全程纯单元:只测头构造(纯函数),不连生产 PG(8810)/Redis(8811)、不真发外呼。
"""

from __future__ import annotations

import pytest

from app.core.config import settings
from app.core.internal_ticket import INTERNAL_TICKET_HEADER, INTERNAL_TOKEN_HEADER
from app.services import checkin_pool_writeback as wb

SECRET = "unit-test-shared-jwt-secret-0123456789-abcdefgh"
LEGACY = "legacy-callback-secret"


@pytest.fixture(autouse=True)
def _jwt_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "jwt_secret", SECRET, raising=False)
    monkeypatch.delenv("JWT_SECRET", raising=False)


def test_正向_机机凭据与端点自有头都在且经唯一出口() -> None:
    headers = wb._auth_headers(LEGACY)
    assert headers[INTERNAL_TOKEN_HEADER] == LEGACY  # 旧头仍发(兼容窗)
    assert headers["X-Internal-Secret"] == LEGACY  # 端点自己的机机凭据,经 extra 原样带
    assert headers["Content-Type"] == "application/json"


def test_反向_无主体不伪造票即使_jwt_secret_在() -> None:
    """没有真实 apps/api 用户主体 ⇒ 宁可不票,不发必拒坏票。"""
    headers = wb._auth_headers(LEGACY)
    assert INTERNAL_TICKET_HEADER not in headers


def test_零副作用_同输入等价输出() -> None:
    assert wb._auth_headers(LEGACY) == wb._auth_headers(LEGACY)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
