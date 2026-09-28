# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

# PROJECT_PLAN #81 最小一环:报表模板端到端(注册 → 会话派发 → 落盘 → 产物服务)。
#
# 判据链(全部走真会话同款入口,不 mock 工具层):
# 1. 注册面:generate_report 同时出现在 _TOOLS(LLM schema 来源)与 _TOOL_HANDLERS;
# 2. 派发面:agent_loop 用的 mcp_server.call_tool(...) 入口产出磁盘文件;
# 3. 服务面:产物 relative_path 经 /api/artifacts/token(JWT)→ /api/artifacts/f/<token>
#    可取回 HTML(与前端 tool-call-card.tsx 的既有换 token 链路同形);
# 4. 授权面:.owner sidecar 生效,非属主换 token 403;
# 5. 负面:sections 非法 JSON / 路径逃逸 / XSS 转义。
#
# 测试不连生产 PG/Redis(§5 测试隔离铁律):本链路全程零 DB,Redis 不可用时
# artifacts_store 自行降级进程内,与本报表工具无交集。

from __future__ import annotations

import json
import time
import uuid
from pathlib import Path

import jwt as pyjwt
import pytest
from httpx import ASGITransport, AsyncClient

from app.core import jwt_auth
from app.core.config import settings
from app.main import app
from app.services import mcp_server as mcp_module
from app.services.mcp_server import mcp_server

pytestmark = pytest.mark.real_jwt

JWT_SECRET = "test-report-jwt-secret"
OWNER_USER_ID = f"report-owner-{uuid.uuid4().hex[:8]}"

_PROJECT_ROOT = Path(__file__).resolve().parents[3]
ARTIFACTS_DIR = _PROJECT_ROOT / "tmp" / "artifacts"


@pytest.fixture(autouse=True)
def _enable_jwt_and_whitelist(monkeypatch):
    """与 test_artifacts 同款:开真实 JWT 校验 + 保证产物文件端点在白名单。"""
    monkeypatch.setattr(settings, "jwt_secret", JWT_SECRET)
    monkeypatch.setattr(settings, "jwt_issuer", "ihui-ai")
    if "/api/artifacts/f/" not in jwt_auth.PUBLIC_PATHS:
        jwt_auth.PUBLIC_PATHS = jwt_auth.PUBLIC_PATHS + ("/api/artifacts/f/",)


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


def _make_user_token(user_id: str) -> str:
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


def _auth_header(user_id: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {_make_user_token(user_id)}"}


def _sections_payload() -> str:
    return json.dumps(
        [
            {"heading": "本周进展", "items": ["上线 X 功能", "修复 Y 缺陷 <script>alert(1)</script>"]},
            {"heading": "下周计划", "items": ["推进 Z 事项"]},
        ],
        ensure_ascii=False,
    )


class TestRegistry:
    def test_tool_registered_in_both_tables(self):
        """注册对账:LLM schema 表与 handler 表必须同时有 generate_report。"""
        assert "generate_report" in {t.name for t in mcp_module._TOOLS}
        assert "generate_report" in mcp_module._TOOL_HANDLERS

    def test_schema_shape(self):
        tool = next(t for t in mcp_module._TOOLS if t.name == "generate_report")
        assert tool.input_schema["type"] == "object"
        assert set(tool.input_schema["required"]) == {"title", "sections"}


class TestEndToEndOnDisk:
    async def test_call_tool_lands_usable_file(self):
        """真派发入口 call_tool → 磁盘落 .html + .owner,内容为合法 HTML 且已转义。"""
        result = await mcp_server.call_tool(
            "generate_report",
            {
                "title": "2026-W39 运营周报",
                "sections": _sections_payload(),
                "period": "2026-09-21 ~ 2026-09-27",
                "summary": "本周整体平稳。",
                "__user_id": OWNER_USER_ID,
            },
            user_id=OWNER_USER_ID,
        )
        assert result.get("ok") is True, f"call_tool 失败: {result}"
        rel = result["relative_path"]
        assert rel.startswith("tmp/artifacts/") and rel.endswith(".html")
        path = _PROJECT_ROOT / Path(rel)
        try:
            assert path.is_file()
            content = path.read_text(encoding="utf-8")
            assert "2026-W39 运营周报" in content
            assert "<title>" in content and "下周计划" in content
            # XSS 负面:条目里的 script 标签必须被转义,不得原样入文
            assert "<script>alert(1)</script>" not in content
            assert "&lt;script&gt;" in content
            # 归属 sidecar 与 chart 链路同契约
            sidecar = Path(str(path) + ".owner")
            assert sidecar.is_file()
            assert json.loads(sidecar.read_text(encoding="utf-8"))["user_id"] == OWNER_USER_ID
        finally:
            Path(str(_PROJECT_ROOT / rel) + ".owner").unlink(missing_ok=True)
            path.unlink(missing_ok=True)

    async def test_invalid_sections_returns_structured_error(self):
        result = await mcp_server.call_tool(
            "generate_report",
            {"title": "坏输入", "sections": "not-a-json", "__user_id": OWNER_USER_ID},
        )
        assert result.get("ok") is False
        assert result.get("errorCode") == "INVALID_SECTIONS"

    async def test_path_escape_rejected(self):
        result = await mcp_server.call_tool(
            "generate_report",
            {
                "title": "逃逸尝试",
                "sections": _sections_payload(),
                "output_dir": "../../outside-project",
                "__user_id": OWNER_USER_ID,
            },
        )
        assert result.get("ok") is False
        assert result.get("errorCode") == "INVALID_SECTIONS"


class TestArtifactServingChain:
    async def test_owner_can_issue_token_and_serve(self, client):
        """属主全链:call_tool 落盘 → /api/artifacts/token → /api/artifacts/f/<token>。"""
        result = await mcp_server.call_tool(
            "generate_report",
            {"title": "产物服务链验证", "sections": _sections_payload(), "__user_id": OWNER_USER_ID},
            user_id=OWNER_USER_ID,
        )
        assert result["ok"] is True
        rel = result["relative_path"]
        try:
            token_resp = await client.get(
                "/api/artifacts/token", params={"file": rel}, headers=_auth_header(OWNER_USER_ID)
            )
            assert token_resp.status_code == 200, token_resp.text
            token = token_resp.json()["token"]
            serve = await client.get(f"/api/artifacts/f/{token}")
            assert serve.status_code == 200
            assert "text/html" in serve.headers["content-type"]
            assert "产物服务链验证" in serve.text
        finally:
            path = _PROJECT_ROOT / Path(rel)
            Path(str(path) + ".owner").unlink(missing_ok=True)
            path.unlink(missing_ok=True)

    async def test_non_owner_forbidden(self, client):
        """越权负面:别人的 .owner 挡住 token 签发(与 chart 授权模型一致)。"""
        result = await mcp_server.call_tool(
            "generate_report",
            {"title": "他人产物", "sections": _sections_payload(), "__user_id": OWNER_USER_ID},
            user_id=OWNER_USER_ID,
        )
        assert result["ok"] is True
        rel = result["relative_path"]
        try:
            resp = await client.get(
                "/api/artifacts/token",
                params={"file": rel},
                headers=_auth_header(f"stranger-{uuid.uuid4().hex[:8]}"),
            )
            assert resp.status_code == 403
        finally:
            path = _PROJECT_ROOT / Path(rel)
            Path(str(path) + ".owner").unlink(missing_ok=True)
            path.unlink(missing_ok=True)
