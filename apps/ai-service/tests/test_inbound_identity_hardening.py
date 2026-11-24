# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""入站身份裁决硬化(2026-11-01 安全强化)的接线锁。

覆盖三件事,每一件都对应一类真实可利用缺陷,不是"代码看起来更好":
1. 已验签主体对明文 `x-user-id` 的**优先级**:攻击者持合法 JWT 冒充他人 ⇒ 拿到的仍是自己;
2. 中间件覆写的三个分支(有该头⇒覆写 / 无该头⇒不造 / 无主体⇒不动);
3. 反回潮形状锁:三族 v1 路由不得再出现 `Header(alias="X-User-Id")`,prompt 注册表
   路由必须带着管理员依赖 —— 摘掉新字段即翻红。
"""

from __future__ import annotations

import inspect
from pathlib import Path

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.api.v1 import external_import, knowledge_fs, knowledge_write
from app.core import jwt_auth
from app.core.inbound_identity import inbound_actor_or_401, resolve_inbound_actor
from app.routers import prompts


def _http_request(headers: dict[str, str], state: dict[str, object]) -> Request:
    """按 Starlette 契约造一枚只读请求(scope 形状与真实 ASGI 一致)。"""
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/v1/ai/knowledge-fs/read",
        "headers": [(k.lower().encode("latin-1"), v.encode("latin-1")) for k, v in headers.items()],
        "state": dict(state),
    }
    return Request(scope)


class _FakePrincipal:
    """capability_gate.Principal 的最小同形替身(只用到 kind/sub 两维)。"""

    def __init__(self, kind: str, sub: str | None) -> None:
        self.kind = kind
        self.sub = sub
        self.role = 1
        self.scopes: frozenset[str] = frozenset()


# --------------------------------------------------------------------------- 主体优先级


def test_verified_jwt_subject_beats_client_asserted_header() -> None:
    """核心缺陷:登录用户 A 带 `X-User-Id: <受害者>` 冒充他人 ⇒ 裁决必须给 A。"""
    req = _http_request(
        {"x-user-id": "victim-uuid", "authorization": "Bearer <jwt>"},
        {"user_id": "attacker-uuid"},
    )
    assert resolve_inbound_actor(req) == "attacker-uuid"


def test_no_verified_principal_never_falls_back_to_the_header() -> None:
    """中间件没注入主体(白名单路径/未鉴权)⇒ None,绝不回落成"调用者自称的那个人"。"""
    req = _http_request({"x-user-id": "whoever-uuid"}, {})
    assert resolve_inbound_actor(req) is None


def test_signed_internal_principal_is_taken_from_payload_not_plaintext_header() -> None:
    """内网可信头:取**签名载荷**的 sub;随行明文头一律不信。"""
    req = _http_request(
        {"x-user-id": "spoofed-uuid", "x-ihui-principal": "v1.aaa.bbb"},
        {},
    )
    import app.services.capability_gate as gate

    original = gate.verify_principal_header
    gate.verify_principal_header = lambda value: _FakePrincipal("internal", "real-delegate-uuid")
    try:
        assert resolve_inbound_actor(req) == "real-delegate-uuid"
    finally:
        gate.verify_principal_header = original


def test_unverifiable_principal_header_is_not_a_identity_channel() -> None:
    """签名校验失败(返回 None)⇒ 不得把该头当身份通道,也不得因此放开。"""
    req = _http_request({"x-user-id": "spoofed", "x-ihui-principal": "v1.junk.sig"}, {})
    import app.services.capability_gate as gate

    original = gate.verify_principal_header
    gate.verify_principal_header = lambda value: None
    try:
        assert resolve_inbound_actor(req) is None
    finally:
        gate.verify_principal_header = original


def test_orphan_principal_shape_does_not_grant_identity() -> None:
    """principal 有 kind 但 sub 为空 ⇒ 依旧 None(主体必须绑得起来)。"""
    req = _http_request({"x-ihui-principal": "v1.a.b"}, {"user_id": "jwt-subject"})
    import app.services.capability_gate as gate

    original = gate.verify_principal_header
    gate.verify_principal_header = lambda value: _FakePrincipal("internal", None)
    try:
        # sub 缺失时不采纳 principal,继续走 JWT 主体(而不是拒绝也不是冒充)
        assert resolve_inbound_actor(req) == "jwt-subject"
    finally:
        gate.verify_principal_header = original


# --------------------------------------------------------------------------- 401 出口


def test_inbound_actor_or_401_shape_is_the_existing_route_contract() -> None:
    req = _http_request({"x-user-id": "victim"}, {})
    actor, deny = inbound_actor_or_401(req)
    assert actor is None
    assert deny["code"] == 401
    ok_req = _http_request({}, {"user_id": "me"})
    actor_ok, deny_ok = inbound_actor_or_401(ok_req)
    assert actor_ok == "me" and deny_ok == {}


# --------------------------------------------------------------------------- 中间件覆写


def test_bind_overwrites_an_existing_user_id_header() -> None:
    req = _http_request({"x-user-id": "victim-uuid"}, {})
    jwt_auth._bind_inbound_user_header(req, "verified-uuid")
    assert req.headers["x-user-id"] == "verified-uuid"


def test_bind_does_not_invent_a_header_that_was_absent() -> None:
    """给没带该头的请求造一枚"身份"是另一种放开(可能把匿名通道变成看似已归属)。"""
    req = _http_request({"accept": "*/*"}, {})
    jwt_auth._bind_inbound_user_header(req, "verified-uuid")
    assert "x-user-id" not in req.headers


def test_bind_is_a_noop_without_a_verified_subject() -> None:
    req = _http_request({"x-user-id": "victim-uuid"}, {})
    jwt_auth._bind_inbound_user_header(req, None)
    assert req.headers["x-user-id"] == "victim-uuid"


def test_bind_survives_non_latin1_subject_without_touching_headers() -> None:
    """主体含无法 latin-1 编码的字符 ⇒ 整条覆写放弃,不写半坏的头。"""
    req = _http_request({"x-user-id": "victim"}, {})
    jwt_auth._bind_inbound_user_header(req, "主体é")
    assert req.headers["x-user-id"] == "victim"


# --------------------------------------------------------------------------- 反回潮形状锁


@pytest.mark.parametrize("module", [knowledge_fs, knowledge_write, external_import], ids=lambda m: m.__name__)
def test_v1_routers_do_not_read_the_plaintext_user_id_header(module) -> None:
    """形状锁判**声明形态**,不判散文 —— 注释里引用旧写法是交代,不是回潮。"""
    src = Path(module.__file__).read_text(encoding="utf-8")
    assert 'x_user_id: str | None = Header' not in src, (
        f"{module.__name__} 又把明文头声明成身份入参"
    )


@pytest.mark.parametrize("module", [knowledge_fs, knowledge_write, external_import], ids=lambda m: m.__name__)
def test_v1_routers_import_the_single_identity_outlet(module) -> None:
    src = Path(module.__file__).read_text(encoding="utf-8")
    assert "inbound_identity" in src, f"{module.__name__} 没接进唯一出口(必然漂移)"


# --------------------------------------------------------------------------- prompt 注册表


def test_prompt_registry_router_carries_the_admin_dependency() -> None:
    assert prompts._require_prompt_admin in [
        dep.dependency for dep in prompts.router.dependencies
    ], "整族端点的角色闸被摘掉了 —— 任何登录用户即可改写全平台 system prompt"


def test_prompt_admin_gate_rejects_role_zero_and_accepts_admin() -> None:
    with pytest.raises(HTTPException) as caught:
        prompts._require_prompt_admin(_http_request({}, {"role_id": 0}))
    assert caught.value.status_code == 403
    prompts._require_prompt_admin(_http_request({}, {"role_id": 1}))


def test_prompt_admin_gate_fail_closes_when_role_is_absent() -> None:
    """取不到角色 ⇒ 按普通用户 0 处理(拒绝),绝不"默认放开"。"""
    with pytest.raises(HTTPException):
        prompts._require_prompt_admin(_http_request({}, {}))


def test_identity_outlet_is_the_only_copy_of_the_rule() -> None:
    """§0.6 单一真相源:路由侧不得再抄一份"从明文头取身份"的判据。"""
    for module in (knowledge_fs, knowledge_write, external_import):
        src = inspect.getsource(module)
        assert 'request.headers.get("x-user-id"' not in src
        assert "x_user_id" not in src
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
