# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""POST /api/session-import/parse 鉴权不松动回归测试。

该端点解析用户上传的外部 AI 工具会话导出文件(含隐私正文),路由不挂 per-route
Depends(见 session_import.py 头注),安全模型完全依赖 main.py 挂载的全局
JWTAuthMiddleware。缺口:conftest._isolate_jwt_auth 在套件层把中间件降级为放行,
而既有 test_session_import_route.py 用的正是该降级态 —— 有人把 session-import 加进
jwt_public_paths、或改坏路径匹配规则这类"匿名可读任意人上传内容"的回归,
全量 pytest 依然全绿。本文件用 real_jwt 标记绕开全局隔离,从两层钉死:
  1) 判定行为层:把**真实 JWTAuthMiddleware** 装到最小 app 上,逐 path 发匿名请求,
     以"中间件是否放行"为判据(不依赖任何生产侧可测接缝,改实现也照样有效);
  2) 真实装配层:对 app.main 的实际中间件栈发匿名 multipart → 401 且无解析字段。
"""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient
from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from app.core import jwt_auth
from app.core.config import settings
from app.core.jwt_auth import JWTAuthMiddleware

# conftest._isolate_jwt_auth 对本模块整体放行,jwt_secret 由 enforce_jwt 自行钉死
pytestmark = pytest.mark.real_jwt

PARSE_URL = "/api/session-import/parse"
JWT_TEST_SECRET = "test-jwt-secret-for-session-import-auth-only"
# 响应里出现任一项即代表匿名请求拿到了解析结果(隐私泄漏)
_PARSE_RESULT_FIELDS = ("conversations", "truncated", "warnings")

# 受保护路径族:前缀/兄弟路径一并钉住,防止有人改成"段前缀"匹配
SESSION_IMPORT_PATHS = (
    PARSE_URL,
    "/api/session-import",
    "/api/session-import/",
    "/api/session-import/export",
    "/session-import/parse",
)
# 白名单条目的兄弟路径:2026-08-01 P1 修复(精确 vs 目录前缀)不得回潮
SIBLING_PATHS = (
    "/api/health-admin",
    "/api/healthz",
    "/api/legacy",
    "/api/legacyX",
    "/api/artifacts/f",
    "/api/artifacts/fx",
    "/metrics-export",
)
# 名单内路径(取 config.py 默认值与 .env 覆盖值的交集,两端环境均成立)
KNOWN_PUBLIC_PATHS = (
    "/api/health",
    "/health",
    "/metrics",
    "/api/admin/news/status",
    "/api/voice/stt",
    "/api/voice/tts",
    "/api/video/token6688-callback",
    "/api/media/tasks/callback",
    "/api/legacy/agents-v1",
    "/api/artifacts/f/chart-1.html",
)


def _effective_whitelist() -> tuple[str, ...]:
    """中间件实际生效的免鉴权名单(settings.jwt_public_paths 解析结果,含 .env 覆盖值)。"""
    return jwt_auth.PUBLIC_PATHS


def _reference_rule(path: str, entries: tuple[str, ...]) -> bool:
    """测试侧独立实现的匹配契约:非目录条目精确匹配,目录条目(以 / 结尾)才前缀匹配。

    与生产实现无引用关系,故可当作 oracle 逐条对照中间件真实行为。
    """
    return path in entries or any(path.startswith(p) for p in entries if p.endswith("/"))


def _upload() -> tuple[dict[str, tuple[str, bytes, str]], dict[str, str]]:
    files = {
        "file": (
            "export.jsonl",
            b'{"role":"user","content":"\xe9\x9a\x90\xe7\xa7\x81\xe6\xad\xa3\xe6\x96\x87"}\n',
            "application/octet-stream",
        )
    }
    return files, {"source": "claude_code"}


async def _passed_through(request: Request) -> JSONResponse:
    """探测 handler:只有中间件放行才会被执行,据此区分 401(拦下)与 200(漏过)。"""
    return JSONResponse({"reached_handler": True})


def _probe_app() -> Starlette:
    """真实 JWTAuthMiddleware + 全路径兜底 handler 的最小 app(判定行为的唯一裁判)。"""
    return Starlette(
        routes=[Route("/{rest:path}", _passed_through, methods=["GET", "POST"])],
        middleware=[Middleware(JWTAuthMiddleware)],
    )


@pytest.fixture(autouse=True)
def _forbid_production_db(monkeypatch: pytest.MonkeyPatch) -> None:
    """AGENTS.md §5 测试隔离铁律:本文件用例零 DB 触达(建池即报错)。"""

    async def _no_pool(*args: object, **kwargs: object) -> None:
        raise AssertionError("鉴权回归用例不得创建 asyncpg 连接池(生产库禁连)")

    monkeypatch.setattr("asyncpg.create_pool", _no_pool)


@pytest.fixture
def enforce_jwt(monkeypatch: pytest.MonkeyPatch) -> None:
    """钉死测试密钥:jwt_secret 非空才会进入白名单判定与验签分支。"""
    monkeypatch.setattr(settings, "jwt_secret", JWT_TEST_SECRET)


@pytest.fixture
async def probe_client(enforce_jwt: None):
    transport = ASGITransport(app=_probe_app())
    async with AsyncClient(transport=transport, base_url="http://probe.test") as ac:
        yield ac


# ---------------------------------------------------------------------------
# 1. 判定行为层:匿名请求打到真实中间件,session-import 必须被拦
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("path", SESSION_IMPORT_PATHS + SIBLING_PATHS)
async def test_anonymous_request_to_session_import_requires_auth(
    probe_client: AsyncClient, path: str
) -> None:
    files, data = _upload()
    resp = await probe_client.post(path, files=files, data=data)
    assert resp.status_code == 401, f"{path} 必须走 JWT 鉴权(实得 {resp.status_code})"
    assert resp.json()["message"] == "Authentication required"
    assert "reached_handler" not in resp.json()


@pytest.mark.parametrize("path", KNOWN_PUBLIC_PATHS)
async def test_known_public_paths_still_pass(probe_client: AsyncClient, path: str) -> None:
    """白名单收缩/判定逻辑被改成恒拦,线上门禁与首页探活会当场挂 —— 这里反向兜住。"""
    resp = await probe_client.get(path)
    assert resp.status_code == 200, f"{path} 应在免鉴权白名单内"
    assert resp.json()["reached_handler"] is True


async def test_middleware_behavior_matches_reference_rule(
    probe_client: AsyncClient,
) -> None:
    """逐条对照:生效名单全量 + session-import 家族 + 兄弟路径,放行集合与匹配契约一致。"""
    entries = _effective_whitelist()
    assert entries, "白名单不应为空,否则下列断言无意义"
    files, data = _upload()
    samples = (*entries, *SESSION_IMPORT_PATHS, *SIBLING_PATHS, "/totally/unknown")
    for path in samples:
        resp = await probe_client.post(path, files=files, data=data)
        passed_through = resp.status_code == 200
        assert passed_through is _reference_rule(path, entries), path


def test_whitelist_has_no_catchall_entry() -> None:
    """禁止 ""、"/"、"/api" 这类吞掉一切的条目混进白名单(否则上面的 401 断言永真失效)。"""
    for entry in _effective_whitelist():
        assert entry.strip("/") != "", f"白名单存在空条目 {entry!r}"
        assert entry not in ("/", "/api", "/api/"), f"白名单存在通配条目 {entry!r}"


def test_effective_whitelist_reflects_settings() -> None:
    """中间件读到的名单必须等于 settings.jwt_public_paths 解析结果(含 .env 覆盖值)。"""
    effective = tuple(p.strip() for p in settings.jwt_public_paths.split(",") if p.strip())
    assert effective == _effective_whitelist(), "判定层名单与生效配置不一致"


# ---------------------------------------------------------------------------
# 2. 真实装配层:路由确实注册,全局中间件确实在 app 栈上
# ---------------------------------------------------------------------------


def _fastapi_app():
    """从 socketio.ASGIApp 包装层取真实 FastAPI 实例(解包链与 conftest 一致)。"""
    from app.main import app as root_app

    return getattr(root_app, "other_asgi_app", None) or root_app


async def test_route_and_global_middleware_are_wired(client: AsyncClient) -> None:
    """依赖 client 只为让 app.main 走 conftest 的惰性导入路径(它负责补清 vendor key)。"""
    fastapi_app = _fastapi_app()
    # 本 FastAPI 版本把 include_router 存成 _IncludedRouter 节点,app.routes 不是扁平列表,
    # 故取 OpenAPI 的 paths 作为公开的"已注册路由"视图(结果在实例上缓存,只算一次)。
    spec_paths = fastapi_app.openapi()["paths"]
    assert PARSE_URL in spec_paths, "路由前缀/路径漂移,判定层与 HTTP 层断言将失去意义"
    assert "post" in spec_paths[PARSE_URL], "POST 方法未注册"
    middleware_classes = [m.cls for m in fastapi_app.user_middleware]
    assert JWTAuthMiddleware in middleware_classes, "JWTAuthMiddleware 已不在 app 栈上"


# ---------------------------------------------------------------------------
# 3. 真实 app + 真实中间件:匿名上传 401 且不泄漏解析结果
# ---------------------------------------------------------------------------


async def test_anonymous_multipart_post_returns_401(client: AsyncClient, enforce_jwt: None) -> None:
    """无 Authorization 头的匿名上传 → 401,响应体不含任何解析结果字段。"""
    files, data = _upload()
    resp = await client.post(PARSE_URL, files=files, data=data)
    assert resp.status_code == 401, "匿名请求触达了解析路由(隐私泄漏)"
    assert resp.json()["message"] == "Authentication required"
    for field in _PARSE_RESULT_FIELDS:
        assert field not in resp.json(), f"匿名请求拿到了 {field}"
    assert "conversations" not in resp.text


async def test_invalid_bearer_token_returns_401(
    client: AsyncClient, enforce_jwt: None
) -> None:
    """带非法 token 时走到验签后 401:证明该路径不是白名单直通(与缺头是两条分支)。"""
    files, data = _upload()
    resp = await client.post(
        PARSE_URL,
        files=files,
        data=data,
        headers={"Authorization": "Bearer not-a-real-jwt"},
    )
    assert resp.status_code == 401
    assert resp.json()["message"] == "Invalid or expired token"
    for field in _PARSE_RESULT_FIELDS:
        assert field not in resp.json()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
