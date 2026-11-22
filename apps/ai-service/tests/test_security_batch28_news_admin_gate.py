# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""安全强化第 28 批:`/api/admin/news` 写面授权 —— 认证 ≠ 授权。

缺陷(现读):
  ai-service 的 news 路由族只有全局 JWT 中间件(必须登录),而 web 的 rewrites 把
  `/api/admin/news/:path*` **直连** ai-service 8803(apps/web/next.config.ts),连
  apps/api adminNewsRoutes 的 requireAdmin preHandler 都不经过。于是:
    · POST /publish-recent —— 任何登录用户可把最近 N 小时的 draft 批量推到已发布态
      (status=1 / is_published=true),直接影响站外可见内容;
    · POST /refresh-daily、/trigger-refresh —— 任何登录用户可触发生成与调度刷新
      (资源消耗 + 内容污染);
    · GET /scheduler-status —— 调度器运行态与历史对外可读。
  GET /status 刻意保留登录可读:它是 marketing 首页 magazine 板块的公开统计
  (今日生成/发布数),不承载调度细节,误伤会把首页统计整片打断。

修法:
  · rbac 新增 Permission.CONTENT_PUBLISH(只给 OWNER/ADMIN;MEMBER/VIEWER 不含);
  · news 的 4 个写/调度端点挂 require_permission(CONTENT_PUBLISH);status 不动。

用例:
  A 矩阵:CONTENT_PUBLISH 仅 OWNER/ADMIN 持有。
  B 依赖行为:匿名 401 / member 403 / admin·owner 200。
  C 接线锁:4 个端点的签名含该依赖;GET /status 不含(刻意公开面,防误伤)。
"""

from __future__ import annotations

import inspect

import pytest
from fastapi import Depends, FastAPI
from httpx import ASGITransport, AsyncClient
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.rbac import ROLE_PERMISSIONS, Permission, Role, require_permission
from app.routers import news as news_router

_DEP_SRC = "Depends(require_permission(Permission.CONTENT_PUBLISH))"


# ---------------------------------------------------------------------------
# A:角色矩阵
# ---------------------------------------------------------------------------


def test_content_publish_only_for_management_roles():
    assert Permission.CONTENT_PUBLISH in ROLE_PERMISSIONS[Role.OWNER]
    assert Permission.CONTENT_PUBLISH in ROLE_PERMISSIONS[Role.ADMIN]
    assert Permission.CONTENT_PUBLISH not in ROLE_PERMISSIONS[Role.MEMBER]
    assert Permission.CONTENT_PUBLISH not in ROLE_PERMISSIONS[Role.VIEWER]


# ---------------------------------------------------------------------------
# B:依赖行为(真实 require_permission 判据)
# ---------------------------------------------------------------------------


def _probe_app() -> FastAPI:
    app = FastAPI()

    class FakeJWT(BaseHTTPMiddleware):
        async def dispatch(self, request, call_next):
            uid = request.headers.get("x-test-user")
            rid = request.headers.get("x-test-role")
            if uid:
                request.state.user_id = uid
                request.state.role_id = int(rid) if rid else 0
            return await call_next(request)

    app.add_middleware(FakeJWT)

    @app.get("/probe")
    async def probe(p=Depends(require_permission(Permission.CONTENT_PUBLISH))):
        return {"user": p.user_id, "role": p.role.value}

    return app


@pytest.mark.parametrize(
    ("headers", "status"),
    [
        ({}, 401),  # 匿名
        ({"x-test-user": "m", "x-test-role": "0"}, 403),  # member
        ({"x-test-user": "a", "x-test-role": "1"}, 200),  # admin
        ({"x-test-user": "o", "x-test-role": "2"}, 200),  # owner
    ],
)
async def test_require_content_publish(headers, status):
    probe = _probe_app()
    async with AsyncClient(transport=ASGITransport(app=probe), base_url="http://t") as ac:
        resp = await ac.get("/probe", headers=headers)
    assert resp.status_code == status


# ---------------------------------------------------------------------------
# C:接线锁(端点真的挂上了,且 status 没被误伤)
# ---------------------------------------------------------------------------


def test_news_write_endpoints_are_wired():
    for fn in (
        news_router.refresh_daily,
        news_router.publish_recent,
        news_router.trigger_refresh,
        news_router.scheduler_status,
    ):
        src = inspect.getsource(fn)
        assert _DEP_SRC in src, f"{fn.__name__} 未挂 CONTENT_PUBLISH 依赖"


def test_news_status_stays_login_only():
    """GET /status 是首页公开统计面,不得挂发布权限(否则普通用户首页统计整片断)。"""
    src = inspect.getsource(news_router.get_status)
    assert _DEP_SRC not in src
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
