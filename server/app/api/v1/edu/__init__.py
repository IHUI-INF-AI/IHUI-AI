"""edu 业务域聚合路由 - 迁移自 edu Java 23 个 Spring Cloud 微服务.

Source: G:\\code\\edu\\service\\service\\ihui-ai-edu-*-service (via junction)
Target: /api/v1/edu/<domain>/...

This module aggregates 23 edu domain routers into a single APIRouter for
clean registration in app/api/v1/router.py. Each domain router is implemented
in its own module (auth.py, ask.py, etc.) following the same pattern as
app/api/v1/learn/, app/api/v1/auth/, etc.
"""

from fastapi import APIRouter

# Aggregate edu APIRouter
edu_router = APIRouter(prefix="/edu", tags=["Edu"])

# Lazy include pattern: import sub-routers inside try/except to avoid
# hard failures during phase A bootstrap. As each domain is filled in
# (phase B), the corresponding import is promoted from optional to required.

_SUB_ROUTER_IMPORTS = [
    # (module_path, attr_name, prefix_segment, tag)
    # phase B5 - 基础层
    ("app.api.v1.edu.auth",          "router", "/auth",          "Edu-Auth"),
    ("app.api.v1.edu.member",        "router", "/member",        "Edu-Member"),
    ("app.api.v1.edu.usercenter",    "router", "/usercenter",    "Edu-UserCenter"),
    ("app.api.v1.edu.setting",       "router", "/setting",       "Edu-Setting"),
    # phase B6 - 核心层
    ("app.api.v1.edu.content",       "router", "/content",       "Edu-Content"),
    ("app.api.v1.edu.learn",         "router", "/learn",         "Edu-Learn"),
    ("app.api.v1.edu.exam",          "router", "/exam",          "Edu-Exam"),
    ("app.api.v1.edu.resource",      "router", "/resource",      "Edu-Resource"),
    # phase B7 - 新增层(edu 独有)
    ("app.api.v1.edu.ask",           "router", "/ask",           "Edu-Ask"),
    ("app.api.v1.edu.circle",        "router", "/circle",        "Edu-Circle"),
    # phase B8 - 交易/通知
    ("app.api.v1.edu.pay",           "router", "/pay",           "Edu-Pay"),
    ("app.api.v1.edu.order",         "router", "/order",         "Edu-Order"),
    ("app.api.v1.edu.point",         "router", "/point",         "Edu-Point"),
    ("app.api.v1.edu.message",       "router", "/message",       "Edu-Message"),
    ("app.api.v1.edu.notification",  "router", "/notification",  "Edu-Notification"),
    # phase B9 - 支撑层
    ("app.api.v1.edu.live",          "router", "/live",          "Edu-Live"),
    ("app.api.v1.edu.oss",           "router", "/oss",           "Edu-OSS"),
    ("app.api.v1.edu.search",        "router", "/search",        "Edu-Search"),
    ("app.api.v1.edu.schedule",      "router", "/schedule",      "Edu-Schedule"),
    ("app.api.v1.edu.behavior",      "router", "/behavior",      "Edu-Behavior"),
    ("app.api.v1.edu.visit_tracking","router", "/visit-tracking","Edu-Visit-Tracking"),
    # phase B - gateway (just route table)
    ("app.api.v1.edu.gateway",       "router", "",               "Edu-Gateway"),
]


def register_routers(parent_router: APIRouter) -> None:
    """Attach edu sub-routers to a parent APIRouter (e.g. main api_router).

    Uses try/except ImportError so that partially-filled phase B does not
    break the whole application boot. As domains get implemented, the
    corresponding imports naturally succeed.
    """
    attached = []
    skipped = []
    for module_path, attr_name, prefix, tag in _SUB_ROUTER_IMPORTS:
        try:
            mod = __import__(module_path, fromlist=[attr_name])
            router = getattr(mod, attr_name)
            parent_router.include_router(router, prefix=prefix, tags=[tag])
            attached.append(tag)
        except (ImportError, AttributeError) as e:
            skipped.append(f"{tag} ({type(e).__name__}: {e})")
    return {"attached": attached, "skipped": skipped}