# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍​‌​​‌​​​‍​‌​‌​‌​‌‍​‌​​‌​​‌‍​​‌​‌‌​‌‍​‌​​​​​‌‍​‌​​‌​​‌‍​‌‌​‌‌‌‍​‌‌​​‌‌​​‌‌‌‌​‌​‍​‌‌​‌‌​​​‌​​​‌‌‌‍​‌​​​​​‌‍​‌​​‌​​‌‍​‌‌​‌‌‌‍​‌‌​​‌‌‌​‌​​‌‌‌​‍​‌‌​​‌‌​​​‌​​‌​‌‍​‌​‌‌‌​‌‌‌​‌‌‌​‌‍​‌​‌‌​‌‌‌‍​‌​​‌‌​​‍​‌​​​​‌‌‍​‌​‌‌​‌‌‌‍​‌‌​​​​‌‍​‌‌​‌​​‌‍​‌‌‌‌​‌​‍​‌‌​‌​​​‍​‌‌‌​​‌‌‍​​‌​‌‌‌​‍​‌‌‌​‌​​‍​‌‌​‌‌‌‌‍​‌‌‌​​​​‍​‌​‌‌​‌‌‌‍​‌​‌​​​​‍​‌​‌​​‌​‍​‌​​‌‌‌‌‍​‌​‌​‌‌​‍​‌​​​‌​‌‍​‌​​‌‌‌​‍​‌​​​​​‌‍​‌​​‌‌‌​‍​‌​​​​‌‌‍​‌​​​‌​‌‍​​‌​‌‌​‌‍​​‌‌​​‌​‍​​‌‌​​​​‍​​‌‌​​‌​‍​​‌‌​‌‌​⁠

"""Artifact 静态文件服务测试。

测试覆盖:
- token 签发端点:未认证 401 / 认证成功 200(返回 token + url)
- token 签发:路径逃逸(../、绝对路径、盘符、以 / 开头)、白名单外、非 .html 全部 400
- 文件访问端点:合法 token 200 text/html / 伪造 token 403 / 过期 token 403 /
  携带逃逸路径的 token 400 / 文件不存在 404
"""

from __future__ import annotations

import time
import uuid
from pathlib import Path

import jwt as pyjwt
import pytest
from httpx import ASGITransport, AsyncClient

from app.core import jwt_auth
from app.core.config import settings
from app.main import app
from app.routers.artifacts import sign_artifact_token

# conftest._isolate_jwt_auth 会清空 jwt_secret,本模块自行管理 JWT,跳过全局隔离。
pytestmark = pytest.mark.real_jwt

JWT_SECRET = "test-artifact-jwt-secret"

# apps/ai-service/tests -> parents: [0]=tests [1]=ai-service [2]=apps [3]=IHUI-AI
_PROJECT_ROOT = Path(__file__).resolve().parents[3]
CHARTS_DIR = _PROJECT_ROOT / "tmp" / "charts"
ARTIFACTS_DIR = _PROJECT_ROOT / "tmp" / "artifacts"


def _make_user_token(user_id: str = "user-1") -> str:
    """构造 apps/api 同规则的合法 access token(带 aud/iss/type)。"""
    now = int(time.time())
    payload = {
        "userId": user_id,
        "roleId": 1,
        "iat": now,
        "exp": now + 3600,
        "iss": "ihui-ai",
        "aud": "ihui-ai-users",
        "type": "access",
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm="HS256")


@pytest.fixture(autouse=True)
def _enable_jwt_and_whitelist(monkeypatch):
    """开启真实 JWT 校验 + 确保 /api/artifacts/f/ 在 JWT 白名单中。

    .env 已同步 JWT_PUBLIC_PATHS(含 /api/artifacts/f/);此处再兜底一次,
    防止测试环境 .env 未生效时白名单缺失导致文件访问端点被 401 拦截。
    """
    monkeypatch.setattr(settings, "jwt_secret", JWT_SECRET)
    monkeypatch.setattr(settings, "jwt_issuer", "ihui-ai")
    if "/api/artifacts/f/" not in jwt_auth.PUBLIC_PATHS:
        jwt_auth.PUBLIC_PATHS = jwt_auth.PUBLIC_PATHS + ("/api/artifacts/f/",)


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.fixture
def sample_chart():
    """在 tmp/charts 下创建临时 .html 产物,返回 (绝对路径, 相对路径)。"""
    CHARTS_DIR.mkdir(parents=True, exist_ok=True)
    name = f"test_{uuid.uuid4().hex[:8]}.html"
    path = CHARTS_DIR / name
    path.write_text(
        "<!DOCTYPE html><html><body><div id='chart'>CHART_MARKER</div></body></html>",
        encoding="utf-8",
    )
    try:
        yield path, f"tmp/charts/{name}"
    finally:
        path.unlink(missing_ok=True)


def _auth_header() -> dict[str, str]:
    return {"Authorization": f"Bearer {_make_user_token()}"}


class TestIssueToken:
    async def test_requires_jwt(self, client):
        resp = await client.get("/api/artifacts/token", params={"file": "tmp/charts/x.html"})
        assert resp.status_code == 401

    async def test_issue_success(self, client, sample_chart):
        _, rel = sample_chart
        resp = await client.get(
            "/api/artifacts/token", params={"file": rel}, headers=_auth_header()
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["token"]
        assert data["url"].startswith("/api/artifacts/f/")
        assert data["expires_in"] == 1800

    async def test_rejects_path_traversal(self, client):
        evil_paths = [
            "../secret.html",
            "tmp/charts/../../.env",
            "/etc/passwd",
            "C:/Windows/win.ini",
            "tmp/charts/x.html/..",
        ]
        for evil in evil_paths:
            resp = await client.get(
                "/api/artifacts/token", params={"file": evil}, headers=_auth_header()
            )
            assert resp.status_code == 400, f"应拒绝路径逃逸: {evil}"

    async def test_rejects_outside_whitelist(self, client):
        resp = await client.get(
            "/api/artifacts/token",
            params={"file": "tmp/other/x.html"},
            headers=_auth_header(),
        )
        assert resp.status_code == 400

    async def test_rejects_non_html(self, client):
        resp = await client.get(
            "/api/artifacts/token",
            params={"file": "tmp/charts/secret.txt"},
            headers=_auth_header(),
        )
        assert resp.status_code == 400


class TestServeArtifact:
    async def test_serve_success(self, client, sample_chart):
        _, rel = sample_chart
        token_resp = await client.get(
            "/api/artifacts/token", params={"file": rel}, headers=_auth_header()
        )
        token = token_resp.json()["token"]
        resp = await client.get(f"/api/artifacts/f/{token}")
        assert resp.status_code == 200
        assert "text/html" in resp.headers["content-type"]
        assert "CHART_MARKER" in resp.text

    async def test_serve_no_auth_header_needed(self, client, sample_chart):
        # iframe 不带 Authorization,签名 token 端点必须在 JWT 白名单内直接放行
        _, rel = sample_chart
        token_resp = await client.get(
            "/api/artifacts/token", params={"file": rel}, headers=_auth_header()
        )
        token = token_resp.json()["token"]
        resp = await client.get(f"/api/artifacts/f/{token}", headers={})
        assert resp.status_code == 200

    async def test_serve_forged_token(self, client):
        resp = await client.get("/api/artifacts/f/forged.token.value")
        assert resp.status_code == 403

    async def test_serve_expired_token(self, client, sample_chart):
        _, rel = sample_chart
        now = int(time.time())
        expired = pyjwt.encode(
            {
                "file": rel,
                "iat": now - 7200,
                "exp": now - 3600,
                "iss": "ihui-ai",
                "aud": "ihui-artifacts",
            },
            JWT_SECRET,
            algorithm="HS256",
        )
        resp = await client.get(f"/api/artifacts/f/{expired}")
        assert resp.status_code == 403

    async def test_serve_path_traversal_token(self, client):
        # 攻击者自行构造携带逃逸路径的 token,服务端必须在读取前拒绝
        evil_token = sign_artifact_token("../../.env")
        resp = await client.get(f"/api/artifacts/f/{evil_token}")
        assert resp.status_code == 400

    async def test_serve_missing_file(self, client):
        token = sign_artifact_token("tmp/charts/nonexistent_xyz.html")
        resp = await client.get(f"/api/artifacts/f/{token}")
        assert resp.status_code == 404

    async def test_serve_artifacts_dir_allowed(self, client):
        # 白名单第二个目录 tmp/artifacts 同样可服务
        ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
        name = f"test_{uuid.uuid4().hex[:8]}.html"
        path = ARTIFACTS_DIR / name
        path.write_text("<html><body>ARTIFACT_MARKER</body></html>", encoding="utf-8")
        try:
            token = sign_artifact_token(f"tmp/artifacts/{name}")
            resp = await client.get(f"/api/artifacts/f/{token}")
            assert resp.status_code == 200
            assert "ARTIFACT_MARKER" in resp.text
        finally:
            path.unlink(missing_ok=True)
# ⁠​‌​​‌​​‌‍​‌​​‌​​​‍​‌​‌​‌​‌‍​‌​​‌​​‌‍​​‌​‌‌​‌‍​‌​​​​​‌‍​‌​​‌​​‌‍​‌‌​‌‌‌‍​‌‌​​‌‌​​‌‌‌‌​‌​‍​‌‌​‌‌​​​‌​​​‌‌‌‍​‌​​​​​‌‍​‌​​‌​​‌‍​‌‌​‌‌‌‍​‌‌​​‌‌‌​‌​​‌‌‌​‍​‌‌​​‌‌​​​‌​​‌​‌‍​‌​‌‌‌​‌‌‌​‌‌‌​‌‍​‌​‌‌​‌‌‌‍​‌​​‌‌​​‍​‌​​​​‌‌‍​‌​‌‌​‌‌‌‍​‌‌​​​​‌‍​‌‌​‌​​‌‍​‌‌‌‌​‌​‍​‌‌​‌​​​‍​‌‌‌​​‌‌‍​​‌​‌‌‌​‍​‌‌‌​‌​​‍​‌‌​‌‌‌‌‍​‌‌‌​​​​‍​‌​‌‌​‌‌‌‍​‌​‌​​​​‍​‌​‌​​‌​‍​‌​​‌‌‌‌‍​‌​‌​‌‌​‍​‌​​​‌​‌‍​‌​​‌‌‌​‍​‌​​​​​‌‍​‌​​‌‌‌​‍​‌​​​​‌‌‍​‌​​​‌​‌‍​​‌​‌‌​‌‍​​‌‌​​‌​‍​​‌‌​​​​‍​​‌‌​​‌​‍​​‌‌​‌‌​⁠
