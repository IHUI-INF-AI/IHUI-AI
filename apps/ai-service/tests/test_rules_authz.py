# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""P0 水平越权收口(2026-09-26):POST /api/rules/auto-generate 身份来源回归。

立项事实:`app/routers/rules.py` 的 `AutoGenerateBody.user_id` 由客户端自报,端点直接
`rules_engine.auto_generate_rules(body.user_id)`,全文件零处与令牌主体比对 ⇒ 任何已登录
用户填别人的 UUID 就能读他人行为模式并生成规则草稿(认证 ≠ 授权)。本票把身份来源改成
`require_request_user_id`(与同日 /api/memory 九端点同一份出口),并删掉那个只装身份键
的请求模型 —— **"可传但忽略"的 user_id 在本仓判为没修**,所以判据里有第 5 组结构用例。

钉死的五件事:
  1. 无身份(不挂中间件的最小 app,jwt_secret 非空)→ 端点级依赖 401,且引擎零调用;
  2. 真实中间件下匿名请求同样 401(中间件层与端点层互为冗余);
  3. **A 的令牌 + body 里塞 B 的 id → 200,且引擎收到的 user_id == A**(不是 B):
     这是本票的核心断言,也是"归属由令牌决定"唯一能被机器看见的形态;
  4. 引擎抛异常 → 仍按现有契约回 {"code":500,...},不裸抛(收口不得顺手改响应形状);
  5. 请求模型面不再存在身份键(结构性,防"偷偷保留参数")。

测试隔离(AGENTS.md §5):引擎方法 monkeypatch 成内存记录器,建池即抛 AssertionError,
零生产 PG(8810)/ Redis(8811) 触达。范式逐条照抄 tests/test_memory_authz.py
(real_jwt + 自建 probe app + 真实中间件 + "未发出查询"式记录器)。
"""

from __future__ import annotations

import inspect
import time
from typing import Any

import jwt
import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from pydantic import BaseModel

from app.core import jwt_auth
from app.core.config import settings
from app.routers import rules as rules_router

pytestmark = pytest.mark.real_jwt

TEST_SECRET = "test-jwt-secret-for-rules-authz-only"
USER_A = "user-a-rules-authz"
USER_B = "user-b-rules-authz"

# probe app 加了 /api 前缀(与 main.py 的 include_router 口径一致);router 自身路径不含前缀。
PATH = "/api/rules/auto-generate"
ROUTER_PATH = "/rules/auto-generate"


def _token(user_id: str) -> str:
    now = int(time.time())
    return jwt.encode(
        {
            "sub": user_id,
            "type": "access",
            "iss": settings.jwt_issuer,
            "aud": "ihui-ai-users",
            "iat": now,
            "exp": now + 3600,
        },
        TEST_SECRET,
        algorithm="HS256",
    )


def _auth(user_id: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {_token(user_id)}"}


@pytest.fixture(autouse=True)
def _forbid_production_db(monkeypatch: pytest.MonkeyPatch) -> None:
    """AGENTS.md §5 铁律:本文件用例零 DB 触达(建池即报错)。"""

    async def _no_pool(*args: object, **kwargs: object) -> None:
        raise AssertionError("属主对齐回归不得创建 asyncpg 连接池(生产库禁连)")

    monkeypatch.setattr("asyncpg.create_pool", _no_pool)


@pytest.fixture(autouse=True)
def _enforce_jwt(monkeypatch: pytest.MonkeyPatch) -> None:
    """钉死测试密钥:非空 jwt_secret ⇒ auth_globally_enforced() 为真,不允许 dev 降级。"""
    monkeypatch.setattr(settings, "jwt_secret", TEST_SECRET)
    monkeypatch.setattr(jwt_auth.settings, "jwt_secret", TEST_SECRET)


_SEEN_USER_IDS: list[str] = []
"""引擎实际收到的 user_id 流水 —— 让"归属是谁"成为可断言的事实,而不是读代码的印象。

用例 3 断言它等于**令牌主体**;401 用例断言它**为空**。后者不是多余、前者更不是:
少了"非空"那一半,"为空"的断言在"记录器压根没接上"的世界里也永远成立,判据就成了
摆设(本仓记过多次"看起来有、其实没装车"那一型)。"""


@pytest.fixture(autouse=True)
def _stub_rules_engine(monkeypatch: pytest.MonkeyPatch) -> None:
    """引擎单例的 auto_generate_rules 换成内存记录器,返回形状与真引擎逐字段同构。"""
    _SEEN_USER_IDS.clear()

    async def _fake(user_id: str) -> list[dict[str, Any]]:
        _SEEN_USER_IDS.append(user_id)
        return [
            {
                "pattern": "每天上午询问部署流程",
                "draft_rule": {
                    "name": "deployment-help",
                    "description": "基于模式「每天上午询问部署流程」自动生成",
                    "content": "回答时先给部署步骤清单",
                    "scope": "global",
                },
                "confidence": 0.82,
            }
        ]

    monkeypatch.setattr(rules_router.rules_engine, "auto_generate_rules", _fake)


def _rules_app(*, with_middleware: bool) -> FastAPI:
    """最小装配:真实 rules router(+ 可选真实 JWTAuthMiddleware),前缀同 main.py。"""
    app = FastAPI()
    if with_middleware:
        app.add_middleware(jwt_auth.JWTAuthMiddleware)
    app.include_router(rules_router.router, prefix="/api")
    return app


@pytest.fixture
async def bare_client() -> Any:
    """不挂中间件的客户端:唯一裁判是端点级 Depends(生产态无身份 → 401)。"""
    transport = ASGITransport(app=_rules_app(with_middleware=False))
    async with AsyncClient(transport=transport, base_url="http://rules-authz-bare.test") as ac:
        yield ac


@pytest.fixture
async def probe_client() -> Any:
    """挂真实中间件的客户端:等价生产链路(A 的令牌 + body 里塞 B → 归属仍是 A)。"""
    transport = ASGITransport(app=_rules_app(with_middleware=True))
    async with AsyncClient(transport=transport, base_url="http://rules-authz.test") as ac:
        yield ac


# ---------------------------------------------------------------------------
# 反向用例①:缺身份 → 401(不得回退成"信任请求体里的 user_id")
# ---------------------------------------------------------------------------


async def test_missing_identity_is_401(bare_client: AsyncClient) -> None:
    """生产态(jwt_secret 非空)无任何身份 → 端点级 require_request_user_id 必 401。

    故意不挂中间件:这样 401 只可能来自端点级依赖,而不是"中间件顺手挡掉了"。
    该判定发生在依赖里 ⇒ 在本函数 try 块**之前**,故不会被 `except Exception`
    吞成 {"code":500}(那样状态码就丢了,401 结论也丢了)。
    """
    resp = await bare_client.post(PATH, json={"user_id": USER_B})
    assert resp.status_code == 401, f"缺端点级鉴权地板(实得 {resp.status_code})"
    assert _SEEN_USER_IDS == [], f"401 却已把请求打到引擎:{_SEEN_USER_IDS}"


async def test_anonymous_through_middleware_is_401(probe_client: AsyncClient) -> None:
    """真实中间件下匿名请求同样 401(中间件层与端点层互为冗余)。"""
    resp = await probe_client.post(PATH, json={"user_id": USER_B})
    assert resp.status_code == 401, f"仍可匿名抵达(实得 {resp.status_code})"
    assert _SEEN_USER_IDS == [], f"401 却已把请求打到引擎:{_SEEN_USER_IDS}"


# ---------------------------------------------------------------------------
# 核心用例:令牌主体 A + body 塞 B → 引擎只能看到 A
# ---------------------------------------------------------------------------


async def test_body_cannot_select_another_user(probe_client: AsyncClient) -> None:
    """本票存在的理由:归属由令牌决定,body 里写谁都不算。

    同时喂两种命名(下划线 = 本端点旧字段名,驼峰 = apps/api 转发面实际在发的字段名),
    确保"任何一种自报身份键都不得生效",而不是只让某一种写法碰巧失效。
    """
    resp = await probe_client.post(
        PATH, headers=_auth(USER_A), json={"user_id": USER_B, "userId": USER_B}
    )
    assert resp.status_code == 200, f"带合法令牌的请求被误拒(实得 {resp.status_code})"
    body = resp.json()
    assert body["code"] == 0
    assert _SEEN_USER_IDS == [USER_A], (
        f"引擎收到的 user_id 不是令牌主体:实得 {_SEEN_USER_IDS},期望 [{USER_A}]"
    )
    assert USER_B not in _SEEN_USER_IDS, "客户端自报身份仍在决定'是谁'(越权面未关)"


async def test_draft_shape_is_untouched(probe_client: AsyncClient) -> None:
    """本票只改身份来源,不改引擎返回形状(摊平由 apps/api 出口做,是兄弟票的事)。"""
    resp = await probe_client.post(PATH, headers=_auth(USER_A))
    assert resp.status_code == 200
    drafts = resp.json()["data"]
    assert isinstance(drafts, list) and len(drafts) == 1
    draft = drafts[0]
    assert set(draft) == {"pattern", "draft_rule", "confidence"}
    assert set(draft["draft_rule"]) == {"name", "description", "content", "scope"}


# ---------------------------------------------------------------------------
# 契约用例:引擎异常仍回 {"code":500,...},不裸抛
# ---------------------------------------------------------------------------


async def test_engine_failure_still_returns_500_envelope(
    probe_client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """收口不得顺手改错误契约:此前该端点把异常收敛成 code=500,现在必须还是。

    裸抛会变成 HTTP 500 + FastAPI 默认错误体,而 apps/api 侧读的是 {code,message,data}。
    """

    async def _boom(user_id: str) -> list[dict[str, Any]]:
        _SEEN_USER_IDS.append(user_id)
        raise RuntimeError("llm down")

    monkeypatch.setattr(rules_router.rules_engine, "auto_generate_rules", _boom)
    resp = await probe_client.post(PATH, headers=_auth(USER_A))
    assert resp.status_code == 200, f"异常被裸抛成了 HTTP 错误(实得 {resp.status_code})"
    body = resp.json()
    assert body["code"] == 500
    assert "llm down" in body["message"]
    assert body["data"] is None
    assert _SEEN_USER_IDS == [USER_A]


# ---------------------------------------------------------------------------
# 结构用例:身份键必须从模型可见参数里消失(不是"可传但忽略")
# ---------------------------------------------------------------------------


def test_no_identity_key_in_any_request_model() -> None:
    """判据字面化:rules 模块里不得再有携带 user_id 的请求模型,也不得再有 AutoGenerateBody。"""
    assert not hasattr(rules_router, "AutoGenerateBody"), (
        "该模型只剩一个身份键,本票要求整体删除而非留空壳"
    )
    offenders = [
        name
        for name, obj in vars(rules_router).items()
        if isinstance(obj, type)
        and issubclass(obj, BaseModel)
        and "user_id" in obj.model_fields
    ]
    assert offenders == [], f"以下模型仍把身份当可见字段:{offenders}"


def test_endpoint_signature_has_no_client_identity_param() -> None:
    """端点形参只能是令牌主体,不得有 body/user_id 之类"客户端可填"的身份入口。"""
    params = inspect.signature(rules_router.auto_generate_rules).parameters
    assert "user_id" not in params, "参数里还能收 user_id ⇒ 只是忽略了自报身份,没拆掉面"
    assert "body" not in params, "仍在收请求体模型 ⇒ 见上一条判据"
    principal = params.get("principal")
    assert principal is not None, "端点未挂令牌主体形参 ⇒ 归属无处可来"
    assert principal.default is not inspect.Parameter.empty
    dependency = principal.default
    call = getattr(dependency, "dependency", None)
    assert call is rules_router.require_request_user_id, (
        f"principal 默认值不是 require_request_user_id 依赖(实得 {call!r})"
    )


def test_route_is_registered_unchanged() -> None:
    """路由面未被本票挪动:仍是 POST /rules/auto-generate(前缀由装配处加)。"""
    paths = {(r.path, tuple(sorted(getattr(r, "methods", set())))) for r in rules_router.router.routes}
    assert (ROUTER_PATH, ("POST",)) in paths, f"路由被改名/改方法:{sorted(paths)}"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
