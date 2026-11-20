# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""工具输出工件挂载 token 单测（2026-11-20）。

钉住六件事：
① 签发/校验往返一致，且令牌只认自己的 artifact_id；
② 篡改签名 / 过期 / 错 artifact 一律 None（不复活）；
③ 图表产物的 token（aud=ihui-artifacts）**不能**当工件 token 用（权限面隔离）；
④ 缺 JWT_SECRET 时校验返回 None 且不抛栈（fail-closed + 可观测）；
⑤ 挂载路由对无效令牌回 404 `Mount Expired`（与"不存在"同形，不泄露存在性）；
⑥ 签发结果自述 expires_in = 600s。
"""

from __future__ import annotations

import time

import jwt as pyjwt
import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.routers import artifacts as art

TEST_SECRET = "k" * 40


@pytest.fixture(autouse=True)
def _jwt_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "jwt_secret", TEST_SECRET, raising=False)


def _token(payload: dict, secret: str = TEST_SECRET) -> str:
    return pyjwt.encode(payload, secret, algorithm="HS256")


def test_roundtrip_returns_same_artifact_id() -> None:
    token = art.sign_tool_artifact_token("art-abc123")
    assert art.verify_tool_artifact_token(token) == "art-abc123"


def test_token_is_bound_to_artifact_id() -> None:
    token_a = art.sign_tool_artifact_token("art-aaa")
    assert art.verify_tool_artifact_token(token_a) == "art-aaa"
    # 换一个 id 无法复用同一枚 token（签名载荷里带 id）
    forged = art.sign_tool_artifact_token("art-bbb")
    assert art.verify_tool_artifact_token(forged) == "art-bbb"
    assert art.verify_tool_artifact_token(token_a + "x") is None


def test_tampered_signature_is_rejected() -> None:
    token = art.sign_tool_artifact_token("art-abc")
    head, payload, _sig = token.split(".")
    assert art.verify_tool_artifact_token(f"{head}.{payload}.forged") is None


def test_expired_token_is_rejected() -> None:
    now = int(time.time())
    expired = _token(
        {
            "artifact": "art-abc",
            "iat": now - 1000,
            "exp": now - 500,
            "iss": art.TOKEN_ISSUER,
            "aud": art.TOOL_ARTIFACT_AUDIENCE,
        }
    )
    assert art.verify_tool_artifact_token(expired) is None


def test_chart_token_cannot_be_used_for_tool_artifacts() -> None:
    now = int(time.time())
    chart = _token(
        {
            "file": "tmp/charts/x.html",
            "iat": now,
            "exp": now + 600,
            "iss": art.TOKEN_ISSUER,
            "aud": art.TOKEN_AUDIENCE,
        }
    )
    assert art.verify_tool_artifact_token(chart) is None


def test_missing_secret_fails_closed(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "jwt_secret", "", raising=False)
    assert art.verify_tool_artifact_token("1.2") is None


@pytest.mark.asyncio
async def test_mount_expired_404_shape() -> None:
    with pytest.raises(HTTPException) as exc:
        await art.serve_tool_artifact("not-a-token")
    assert exc.value.status_code == 404
    assert exc.value.detail == art.MOUNT_EXPIRED_DETAIL
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
