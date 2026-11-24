# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""CORS 必须处于短路型中间件的**外层**(2026-10-14 立,根治桌面端签到页 "Failed to fetch")。

为什么单独一条测试:app/main.py 的 CORS 注册点被刻意放到 create_app() 最末尾,
靠的是 Starlette `add_middleware` 的 LIFO 语义(后注册者在外层)。这个前提**没有任何
运行时报错**会提示它被破坏 —— 任何人往后加一句 add_middleware,就会把 CORS 挤回内层,
而 JWTAuthMiddleware / RateLimitMiddleware 的 401/429 短路响应随即失去 Access-Control-* 头。
服务端每一层看都是"200/401 正常",只有浏览器会把它翻译成 TypeError: Failed to fetch,
且预检 OPTIONS 因被 JWT 中间件放行而一直返回 200 —— 即"看起来一切正常"的静默失效。

失效现场(2026-10-14 实测):桌面端本地 dev 窗口 origin 为 http://localhost:8801,
按 apps/web/src/lib/api-base-url.ts 判定,签到请求跨源直连 http://127.0.0.1:8803。
未登录时 ai-service 返回 401 且不带 CORS 头 → 页面报「加载失败: Failed to fetch」。

判据一律走 conftest 的 `client` fixture(ASGITransport 承载真实 app 与真实中间件链),
本文件不自建 app、不复制任何判定常量。
"""

from __future__ import annotations

import pytest

# conftest 的 autouse `_isolate_jwt_auth` 会清空 jwt_secret 让鉴权整体放行
# (不带 token 的 HTTP 用例否则全 401)。本文件要的恰恰是**鉴权真的短路**的那条响应,
# 故用仓库既有的 real_jwt marker 绕开中和夹具,并在下面把 secret 钉成固定非空值
# (不依赖 .env 现值 —— 否则 .env 一改,本用例会静默退化成"没判定")。
pytestmark = pytest.mark.real_jwt

# 与 apps/web/src/lib/api-base-url.ts 的 LOCAL_AI_SERVICE_BASE + 窗口 origin 保持一致;
# 取值出处是 apps/ai-service/.env 的 CORS_ORIGIN。
DEV_WINDOW_ORIGIN = "http://localhost:8801"

# packages/api-client/src/client.ts 给**每个**请求注入的头(缺一个预检就 400):
#   X-Requested-With  —— 配合后端 CSRF 防护(2026-08-02)
#   x-device-fingerprint —— 设备维度风控(2026-08-02)
#   traceparent          —— D147 端生成 trace id(2026-09-28)
# Authorization / Content-Type 是常规项,一并列出以覆盖真实出站组合。
API_CLIENT_REQUEST_HEADERS = (
    "authorization,content-type,x-requested-with,x-device-fingerprint,traceparent"
)


@pytest.fixture
def _jwt_enforced(monkeypatch):
    """把 jwt_secret 钉成非空常量,确保中间件走"验证 → 无凭据即 401"那条短路分支。"""
    from app.core.config import settings

    monkeypatch.setattr(settings, "jwt_secret", "cors-ordering-probe-secret")
    monkeypatch.setattr(settings, "node_env", "production")


async def test_unauthorized_cross_origin_response_carries_cors_headers(client, _jwt_enforced):
    """未登录的跨源 GET:401 必须带 Access-Control-Allow-Origin。

    这是本次事故的原始形态。若 CORS 不在最外层,这里会拿到一个没有任何 CORS 头的
    401 —— 浏览器侧表现为 "Failed to fetch",而本用例只表现为断言失败(可诊断)。
    """
    resp = await client.get(
        "/api/checkin/accounts",
        headers={"Origin": DEV_WINDOW_ORIGIN},
    )

    # 前置条件本身要判:拿不到 401 就说明鉴权没短路,后面的断言是"没判定"而非"判过"。
    assert resp.status_code == 401, (
        f"未带凭据应短路为 401,实得 {resp.status_code} ⇒ 鉴权中间件没生效,"
        "本用例失去意义(检查 real_jwt marker 与 _jwt_enforced)"
    )
    assert resp.headers.get("access-control-allow-origin") == DEV_WINDOW_ORIGIN, (
        "401 短路响应缺少 Access-Control-Allow-Origin ⇒ CORS 中间件不在最外层,"
        "桌面端/浏览器跨源直连会把一切失败伪装成 TypeError: Failed to fetch"
        f"(实际响应头:{dict(resp.headers)})"
    )
    # allow_credentials=True 且请求带 credentials: 'include'(api-client 默认),
    # 缺这一项浏览器同样判不可读。
    assert resp.headers.get("access-control-allow-credentials") == "true", (
        "401 响应缺少 Access-Control-Allow-Credentials ⇒ 跨源带凭据请求仍会被浏览器拒绝"
    )


async def test_preflight_admits_every_header_the_client_injects(client, _jwt_enforced):
    """预检必须放行 api-client 实际注入的全部请求头。

    FastAPI 的 CORSMiddleware 与 @fastify/cors 不同:给了显式 allow_headers 清单后,
    清单外的头会让预检直接 400(而非回显),于是真实请求根本发不出去。
    """
    resp = await client.options(
        "/api/checkin/accounts",
        headers={
            "Origin": DEV_WINDOW_ORIGIN,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": API_CLIENT_REQUEST_HEADERS,
        },
    )

    assert resp.status_code == 200, (
        f"预检被拒({resp.status_code})⇒ allow_headers 清单缺项,"
        f"待放行头:{API_CLIENT_REQUEST_HEADERS}"
    )
    allowed = {
        h.strip().lower()
        for h in (resp.headers.get("access-control-allow-headers") or "").split(",")
    }
    for header in API_CLIENT_REQUEST_HEADERS.split(","):
        assert header in allowed, f"预检回带清单缺少 {header!r}(实际:{sorted(allowed)})"

# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
