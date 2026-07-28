"""publish.py 路由 IDOR 修复测试(2026-07-27 立)。

测试覆盖:
1. _get_user_id 工具函数:JWT 缺失抛 401,有 user_id 返回字符串
2. Pydantic 模型:AccountCreate/TaskCreate 不再有 user_id 必填字段(向后兼容)
3. 路由签名:13 个受保护端点都有 request: Request 参数
4. 未登录访问受保护端点返回 401(端到端,模拟 JWT 缺失)
5. 公开端点(/platforms /credentials-key/generate /running)不受影响

背景:
- 13 个端点原 user_id 直接从请求体/查询参数/路径参数取值,任意攻击者可伪造
- 修复后全部改从 request.state.user_id(JWTAuthMiddleware 注入)取,缺失返回 401
- 更新/删除/验证账号 + 任务详情/取消/重试,额外校验 resource.user_id == 当前用户
"""

from __future__ import annotations

import inspect
from types import SimpleNamespace

import pytest
from fastapi import HTTPException, Request

from app.routers.publish import (
    AccountCreate,
    TaskCreate,
    _get_user_id,
    cancel_task,
    create_account,
    create_task,
    delete_account,
    get_stats,
    get_task,
    list_accounts,
    list_history,
    list_tasks,
    retry_task,
    update_account,
    upload_file,
    verify_account,
)


# =============================================================================
# Fixture:覆盖 conftest 中 broken 的 _isolate_vector_memory(引用了已移除的 _store / _next_id)
# 同时清空 jwt_secret,让 JWTAuthMiddleware 在 development 模式跳过认证(用于 401 测试)
# =============================================================================


@pytest.fixture(autouse=True)
def _isolate_vector_memory(monkeypatch: pytest.MonkeyPatch):
    """覆盖 conftest 中 broken 的同名 fixture。

    conftest 版本引用了 VectorMemoryStore 已移除的 _store / _next_id 属性,
    会导致所有测试失败。这里用正确的 _entries / _vectors 属性重写,
    同时清空 jwt_secret 模拟"未登录"环境(中间件跳过,不注入 user_id)。
    """
    from app.core.config import settings
    from app.services.vector_memory import vector_memory

    monkeypatch.setattr(settings, "jwt_secret", "")
    vector_memory._use_redis = False
    vector_memory._redis = None
    vector_memory._entries.clear()
    vector_memory._vectors.clear()
    yield
    vector_memory._use_redis = False
    vector_memory._redis = None
    vector_memory._entries.clear()
    vector_memory._vectors.clear()


# =============================================================================
# 1. _get_user_id 工具函数
# =============================================================================


def test_get_user_id_returns_id_when_set() -> None:
    """request.state.user_id 已设置时,_get_user_id 返回该 ID(字符串化)。"""
    request = SimpleNamespace(state=SimpleNamespace(user_id="user-123"))
    result = _get_user_id(request)  # type: ignore[arg-type]
    assert result == "user-123"


def test_get_user_id_returns_string_for_numeric_id() -> None:
    """request.state.user_id 为数字时,_get_user_id 转为字符串(JWT payload 可能是 int)。"""
    request = SimpleNamespace(state=SimpleNamespace(user_id=12345))
    result = _get_user_id(request)  # type: ignore[arg-type]
    assert result == "12345"


def test_get_user_id_raises_401_when_missing() -> None:
    """request.state.user_id 未设置时,_get_user_id 抛 401(未登录兜底)。"""
    request = SimpleNamespace(state=SimpleNamespace())
    with pytest.raises(HTTPException) as exc_info:
        _get_user_id(request)  # type: ignore[arg-type]
    assert exc_info.value.status_code == 401
    assert "未登录" in exc_info.value.detail


def test_get_user_id_raises_401_when_none() -> None:
    """request.state.user_id 为 None 时,_get_user_id 抛 401。"""
    request = SimpleNamespace(state=SimpleNamespace(user_id=None))
    with pytest.raises(HTTPException) as exc_info:
        _get_user_id(request)  # type: ignore[arg-type]
    assert exc_info.value.status_code == 401


def test_get_user_id_raises_401_when_empty_string() -> None:
    """request.state.user_id 为空串时,_get_user_id 抛 401(防空字符串绕过)。"""
    request = SimpleNamespace(state=SimpleNamespace(user_id=""))
    with pytest.raises(HTTPException) as exc_info:
        _get_user_id(request)  # type: ignore[arg-type]
    assert exc_info.value.status_code == 401


# =============================================================================
# 2. Pydantic 模型:user_id 字段移除(向后兼容)
# =============================================================================


def test_account_create_no_user_id_required() -> None:
    """AccountCreate 不再要求 user_id(从 JWT 取)。"""
    body = AccountCreate(platform="wordpress", credentials={"token": "abc"})
    assert body.platform == "wordpress"
    # user_id 不应是模型字段
    assert "user_id" not in type(body).model_fields


def test_account_create_ignores_user_id_in_payload() -> None:
    """客户端仍传 user_id 时,Pydantic extra='ignore' 默认忽略,不抛错(向后兼容)。

    IDOR 修复关键:即使攻击者在 payload 里塞 user_id,模型也不接收,
    服务端只用 request.state.user_id(JWT 注入)。
    """
    body = AccountCreate.model_validate({
        "platform": "wordpress",
        "credentials": {"token": "abc"},
        "user_id": "attacker-forged",  # 应被忽略
    })
    assert body.platform == "wordpress"
    assert "user_id" not in type(body).model_fields
    assert not hasattr(body, "user_id")


def test_task_create_no_user_id_required() -> None:
    """TaskCreate 不再要求 user_id(从 JWT 取)。"""
    body = TaskCreate(
        title="测试任务",
        format="md",
        text="hello",
        targets=[{"platform": "wordpress", "account_id": 1}],
    )
    assert body.title == "测试任务"
    assert "user_id" not in type(body).model_fields


def test_task_create_ignores_user_id_in_payload() -> None:
    """客户端仍传 user_id 时被忽略(向后兼容)。"""
    body = TaskCreate.model_validate({
        "title": "测试",
        "format": "md",
        "targets": [{"platform": "wordpress", "account_id": 1}],
        "user_id": "attacker-forged",  # 应被忽略
    })
    assert body.title == "测试"
    assert "user_id" not in type(body).model_fields
    assert not hasattr(body, "user_id")


# =============================================================================
# 3. 路由签名:13 个受保护端点都有 request: Request 参数
# =============================================================================

# IDOR 修复清单:13 个端点全部从 request.state.user_id 取身份
_PROTECTED_ENDPOINTS = [
    upload_file,
    list_accounts,
    create_account,
    update_account,
    delete_account,
    verify_account,
    create_task,
    list_tasks,
    get_task,
    cancel_task,
    retry_task,
    list_history,
    get_stats,
]


def test_protected_endpoints_count_is_13() -> None:
    """受保护端点总数应为 13 个(与 IDOR 修复清单一致)。"""
    assert len(_PROTECTED_ENDPOINTS) == 13


@pytest.mark.parametrize("endpoint", _PROTECTED_ENDPOINTS, ids=lambda e: e.__name__)
def test_protected_endpoint_has_request_param(endpoint) -> None:
    """所有 13 个受保护端点的函数签名都包含 request: Request 参数(IDOR 修复必需)。

    没有此参数无法从 request.state 取 JWT 注入的 user_id,即 IDOR 漏洞未修复。

    注:publish.py 用了 `from __future__ import annotations`,注解会被字符串化,
    所以 annotation 可能是 Request 类或字符串 'Request' / "'Request'",都视为合法。
    """
    sig = inspect.signature(endpoint)
    assert "request" in sig.parameters, f"{endpoint.__name__} 缺少 request 参数"
    param = sig.parameters["request"]
    annotation = param.annotation
    # 接受 Request 类本身或其字符串形式(因 from __future__ import annotations 字符串化)
    assert annotation is Request or str(annotation) in ("Request", "'Request'"), (
        f"{endpoint.__name__} 的 request 参数类型应为 Request,实际: {annotation!r}"
    )


# =============================================================================
# 4. 未登录访问受保护端点返回 401(端到端)
# =============================================================================

# 测试环境:jwt_secret="" + node_env="development" → JWTAuthMiddleware 跳过认证,
# 不设置 request.state.user_id → _get_user_id 抛 401
# 这模拟了"JWT 缺失"的真实攻击场景


async def test_unauth_list_accounts_returns_401(client) -> None:
    """未登录访问 GET /accounts/{user_id} 返回 401(IDOR 修复:不再信任路径参数)。"""
    resp = await client.get("/api/publish/accounts/any-user-id")
    assert resp.status_code == 401
    assert resp.json()["detail"] == "未登录"


async def test_unauth_list_tasks_returns_401(client) -> None:
    """未登录访问 GET /tasks 返回 401(IDOR 修复:不再信任 user_id Query)。"""
    resp = await client.get("/api/publish/tasks")
    assert resp.status_code == 401


async def test_unauth_list_tasks_with_forged_user_id_query_returns_401(client) -> None:
    """未登录访问 GET /tasks?user_id=forged 仍返回 401(忽略 Query,强制 JWT)。"""
    resp = await client.get("/api/publish/tasks?user_id=attacker-forged")
    assert resp.status_code == 401


async def test_unauth_list_history_returns_401(client) -> None:
    """未登录访问 GET /history 返回 401。"""
    resp = await client.get("/api/publish/history")
    assert resp.status_code == 401


async def test_unauth_list_history_with_forged_user_id_returns_401(client) -> None:
    """未登录访问 GET /history?user_id=forged 仍返回 401。"""
    resp = await client.get("/api/publish/history?user_id=attacker-forged")
    assert resp.status_code == 401


async def test_unauth_get_stats_returns_401(client) -> None:
    """未登录访问 GET /stats 返回 401。"""
    resp = await client.get("/api/publish/stats")
    assert resp.status_code == 401


async def test_unauth_get_stats_with_forged_user_id_returns_401(client) -> None:
    """未登录访问 GET /stats?user_id=forged 仍返回 401。"""
    resp = await client.get("/api/publish/stats?user_id=attacker-forged")
    assert resp.status_code == 401


async def test_unauth_create_account_returns_401(client) -> None:
    """未登录访问 POST /accounts 返回 401(且不读 body.user_id)。"""
    resp = await client.post(
        "/api/publish/accounts",
        json={"platform": "wordpress", "credentials": {}, "user_id": "forged"},
    )
    assert resp.status_code == 401


async def test_unauth_create_task_returns_401(client) -> None:
    """未登录访问 POST /tasks 返回 401(且不读 body.user_id)。"""
    resp = await client.post(
        "/api/publish/tasks",
        json={
            "title": "test",
            "format": "md",
            "targets": [{"platform": "wordpress", "account_id": 1}],
            "user_id": "forged",
        },
    )
    assert resp.status_code == 401


async def test_unauth_update_account_returns_401(client) -> None:
    """未登录访问 PUT /accounts/{id} 返回 401。"""
    resp = await client.put(
        "/api/publish/accounts/1",
        json={"display_name": "hacked"},
    )
    assert resp.status_code == 401


async def test_unauth_delete_account_returns_401(client) -> None:
    """未登录访问 DELETE /accounts/{id} 返回 401。"""
    resp = await client.delete("/api/publish/accounts/1")
    assert resp.status_code == 401


async def test_unauth_verify_account_returns_401(client) -> None:
    """未登录访问 POST /accounts/{id}/verify 返回 401(防凭证泄露)。"""
    resp = await client.post("/api/publish/accounts/1/verify")
    assert resp.status_code == 401


async def test_unauth_get_task_returns_401(client) -> None:
    """未登录访问 GET /tasks/{task_id} 返回 401(防他人任务详情泄露)。"""
    resp = await client.get("/api/publish/tasks/any-task-id")
    assert resp.status_code == 401


async def test_unauth_cancel_task_returns_401(client) -> None:
    """未登录访问 POST /tasks/{task_id}/cancel 返回 401。"""
    resp = await client.post("/api/publish/tasks/any-task-id/cancel")
    assert resp.status_code == 401


async def test_unauth_retry_task_returns_401(client) -> None:
    """未登录访问 POST /tasks/{task_id}/retry 返回 401。"""
    resp = await client.post("/api/publish/tasks/any-task-id/retry")
    assert resp.status_code == 401


# =============================================================================
# 5. 公开端点不受 IDOR 修复影响(回归测试)
# =============================================================================


async def test_public_platforms_endpoint_still_works(client) -> None:
    """GET /platforms 是公开端点,无需认证(IDOR 修复不影响)。"""
    resp = await client.get("/api/publish/platforms")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert data["count"] >= 9


async def test_public_credentials_key_generate_still_works(client) -> None:
    """GET /credentials-key/generate 是公开端点,无需认证。"""
    resp = await client.get("/api/publish/credentials-key/generate")
    assert resp.status_code == 200
    assert "key" in resp.json()


async def test_public_running_endpoint_still_works(client) -> None:
    """GET /running 是公开端点,无需认证。"""
    resp = await client.get("/api/publish/running")
    assert resp.status_code == 200
    assert "running" in resp.json()
