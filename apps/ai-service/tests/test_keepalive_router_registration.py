# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""注册面锁:账号保活中心的 6 条端点必须挂在 app/routers/ 下。

为什么单独锁这一件事(2026-10-26 迁):
router 原先住在 ``app/services/keepalive/router.py``,与实现同包看着更"内聚",
但 ``scripts/check-api-routes.mjs`` 的**注册面只枚举 `app/routers/**` 与 `app/api/**`** ——
放在 services 里那 6 条端点对该门是不可见的,只落"未判定(前缀假设命中)"桶,
既不判红也不记绿。注册面看不见 = 以后谁改挂载、删端点、换前缀,没有任何尺子会响
(§0.3 不把"没判"当"判过")。

本锁钉三件事,任何一件被改动都必须在这里显式改,不许悄悄退化:
  ① router 的模块路径是 ``app.routers.keepalive``,且 services 包里**没有**第二个 router;
  ② 前缀恰好 ``/api/keepalive``;
  ③ 6 条 (方法, 路径) 恰好是声明的那 6 条 —— 少一条是多删了功能,多一条是没登记。
"""

from __future__ import annotations

import importlib.util

from app.routers import keepalive as keepalive_router

EXPECTED_ENDPOINTS: set[tuple[str, str]] = {
    ("GET", "/api/keepalive/status"),
    ("GET", "/api/keepalive/overview"),
    ("GET", "/api/keepalive/accounts"),
    ("GET", "/api/keepalive/events"),
    ("GET", "/api/keepalive/stats"),
    ("POST", "/api/keepalive/run"),
}


def _declared() -> set[tuple[str, str]]:
    """router 上真实注册的 (方法, 完整路径) 集合。

    取 ``r.path`` 而不是 ``router.prefix + r.path``:FastAPI 在 ``add_api_route`` 时
    就把 ``APIRouter(prefix=...)`` 拼进了 route.path(实测 ``r.path`` 已是
    ``/api/keepalive/events`` 这种全路径)。前缀本身另有 test_prefix_is_api_keepalive 单锁一维,
    两处职责不重叠。
    """
    return {(m, r.path) for r in keepalive_router.router.routes for m in getattr(r, "methods", set())}


def test_router_module_lives_under_app_routers() -> None:
    """① 落点:必须在 app/routers/ 下,否则门 8 的注册面看不见。"""
    assert keepalive_router.__name__ == "app.routers.keepalive", (
        f"router 模块落点漂了:{keepalive_router.__name__}。门 8 只枚举 app/routers/** 与 app/api/**,"
        "搬回 app/services/ 会让 6 条端点从注册面消失"
    )


def test_no_second_router_under_services() -> None:
    """① 反向:services 包里不许再留一份 router(两份注册面 = 迟早漂移)。"""
    assert importlib.util.find_spec("app.services.keepalive.router") is None, (
        "app/services/keepalive/router.py 又出现了 —— 同一组端点两份 import 路径,"
        "迟早一份被改另一份没改。删掉它,只留 app/routers/keepalive.py"
    )


def test_prefix_is_api_keepalive() -> None:
    """② 前缀:router 自带完整前缀,main.py 挂载时不再加 prefix。"""
    assert keepalive_router.router.prefix == "/api/keepalive"


def test_exactly_six_declared_endpoints() -> None:
    """③ 端点面:6 条,一条不多一条不少。"""
    got = _declared()
    assert got == EXPECTED_ENDPOINTS, (
        f"端点面变了。多出来:{sorted(got - EXPECTED_ENDPOINTS)}(删了功能却没改锁?),"
        f"缺:{sorted(EXPECTED_ENDPOINTS - got)}(功能没了锁还没红?)"
    )
