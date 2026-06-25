"""Edu gateway router - aggregates all 21 edu domain routers under a single prefix.

Java source: ihui-ai-edu-gateway-service Spring Cloud Gateway routes
(replaced by Nginx + FastAPI middleware; this module is informational only).

Original 21 routes from Java gateway application.yml:

| Java route           | New IHUI-AI route          |
|----------------------|----------------------------|
| /auth/**             | /api/v1/edu/auth/**        |
| /member/**           | /api/v1/edu/member/**      |
| /user-center/**      | /api/v1/edu/usercenter/**  |
| /setting/**          | /api/v1/edu/setting/**     |
| /content/**          | /api/v1/edu/content/**     |
| /learn/**            | /api/v1/edu/learn/**       |
| /live/**             | /api/v1/edu/live/**        |
| /member/             | /api/v1/edu/member/        |
| /user-center/        | /api/v1/edu/usercenter/    |
| /schedule/**         | /api/v1/edu/schedule/**   |
| /setting/            | /api/v1/edu/setting/       |
| /oss/**              | /api/v1/edu/oss/**         |
| /comment/**          | /api/v1/edu/behavior/**   |
| /message/**          | /api/v1/edu/message/**     |
| /ask/**              | /api/v1/edu/ask/**         |
| /circle/**           | /api/v1/edu/circle/**      |
| /content/            | /api/v1/edu/content/       |
| /resource/**         | /api/v1/edu/resource/**    |
| /notification/**     | /api/v1/edu/notification/**|
| /point/**            | /api/v1/edu/point/**       |
| /exam/**             | /api/v1/edu/exam/**        |
| /search/**           | /api/v1/edu/search/**      |
| /visit-tracking/**   | /api/v1/edu/visit-tracking/**|
| /pay/**              | /api/v1/edu/pay/**         |
| /order-api/**        | /api/v1/edu/order/**       |

This gateway service is replaced by direct FastAPI routing in app/api/v1/edu/.
The actual port-level load balancing is handled by:
- Nginx (deploy/docker/nginx.conf) - production
- main.py FastAPI middleware - development
"""

from fastapi import APIRouter

router = APIRouter()


@router.get("/routes", summary="List all edu routes (replaces Java Spring Cloud Gateway)")
def list_routes():
    """List the mapping of Java routes to IHUI-AI FastAPI routes."""
    return {
        "migration_strategy": "Spring Cloud Gateway replaced by Nginx + FastAPI",
        "total_routes": 23,
        "routes": [
            {"java": "/auth/**",             "ihui_ai": "/api/v1/edu/auth/**",         "domain": "auth"},
            {"java": "/member/**",           "ihui_ai": "/api/v1/edu/member/**",       "domain": "member"},
            {"java": "/user-center/**",      "ihui_ai": "/api/v1/edu/usercenter/**",   "domain": "usercenter"},
            {"java": "/setting/**",          "ihui_ai": "/api/v1/edu/setting/**",      "domain": "setting"},
            {"java": "/content/**",          "ihui_ai": "/api/v1/edu/content/**",      "domain": "content"},
            {"java": "/learn/**",            "ihui_ai": "/api/v1/edu/learn/**",        "domain": "learn"},
            {"java": "/live/**",             "ihui_ai": "/api/v1/edu/live/**",         "domain": "live"},
            {"java": "/schedule/**",         "ihui_ai": "/api/v1/edu/schedule/**",     "domain": "schedule"},
            {"java": "/oss/**",              "ihui_ai": "/api/v1/edu/oss/**",          "domain": "oss"},
            {"java": "/comment/**",          "ihui_ai": "/api/v1/edu/behavior/**",     "domain": "behavior"},
            {"java": "/message/**",          "ihui_ai": "/api/v1/edu/message/**",      "domain": "message"},
            {"java": "/ask/**",              "ihui_ai": "/api/v1/edu/ask/**",          "domain": "ask"},
            {"java": "/circle/**",           "ihui_ai": "/api/v1/edu/circle/**",       "domain": "circle"},
            {"java": "/resource/**",         "ihui_ai": "/api/v1/edu/resource/**",     "domain": "resource"},
            {"java": "/notification/**",     "ihui_ai": "/api/v1/edu/notification/**", "domain": "notification"},
            {"java": "/point/**",            "ihui_ai": "/api/v1/edu/point/**",        "domain": "point"},
            {"java": "/exam/**",             "ihui_ai": "/api/v1/edu/exam/**",         "domain": "exam"},
            {"java": "/search/**",           "ihui_ai": "/api/v1/edu/search/**",       "domain": "search"},
            {"java": "/visit-tracking/**",   "ihui_ai": "/api/v1/edu/visit-tracking/**","domain": "visit_tracking"},
            {"java": "/pay/**",              "ihui_ai": "/api/v1/edu/pay/**",          "domain": "pay"},
            {"java": "/order-api/**",        "ihui_ai": "/api/v1/edu/order/**",        "domain": "order"},
        ],
        "note": "Gateway service frozen. Real routing handled by app/api/v1/edu/__init__.py.",
    }