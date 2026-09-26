# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""O19(2026-09-21)agents HTTP 面端点级属主鉴权回归测试。

覆盖本机 curl 实锤复现过的三条越权链:
  1. `GET /api/agents/sessions` 匿名 200 返回全站 session id 列表
  2. `POST /api/agents/approval-response` 匿名抵达决策写入点(人工审批门可被第三方自批)
  3. `GET /api/agents/tasks/stream` 匿名订阅到他人会话的实时工具事件

判据分两层,与 tests/test_session_import_auth.py 同一范式(real_jwt + 自建 probe app
挂真实中间件 + 独立 oracle):
  * **中间件层**:真实 JWTAuthMiddleware 下匿名一律 401(且 `.env` 里的
    `/api/agents/` 前缀已被 jwt_auth._NEVER_PUBLIC_ROOTS 强制剔除)。
  * **端点层(本次新增,独立于中间件)**:把 `PUBLIC_PATHS` 人为塞回
    `/api/agents/`(模拟配错 .env),或对**没挂中间件**的最小 app 直接发请求,
    端点级 `Depends(require_request_user_id)` 仍必须 401 —— 白名单再错也漏不出去。
  * **属主层**:审批条目带 owner,跨用户 403 / 无属主 403 / 不存在 404;
    事件流只转发属主==请求者的事件,无属主记录 fail-closed 不转发。

模板与 real_jwt 标记用法照抄 tests/test_session_import_auth.py(conftest 的
_isolate_jwt_auth 对本模块整体放行,jwt_secret 由本文件自行钉死)。
"""

from __future__ import annotations

import asyncio
import contextlib
import time
from typing import Any

import jwt
import pytest
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient

from app.core import jwt_auth
from app.core.config import settings

pytestmark = pytest.mark.real_jwt

TEST_SECRET = "test-jwt-secret-for-agents-authz-59-only"
USER_A = "user-a-authz59"
USER_B = "user-b-authz59"

APPROVAL_URL = "/api/agents/approval-response"
SESSIONS_URL = "/api/agents/sessions"
TASKS_STREAM_URL = "/api/agents/tasks/stream"

# 端点级鉴权必须覆盖到的面(任一项漏挂 Depends,本用例立即红)
AUTHZ_ENFORCED_ENDPOINTS: tuple[tuple[str, str], ...] = (
    ("post", APPROVAL_URL),
    ("post", "/api/agents/execute"),
    ("post", "/api/agents/execute/stream"),
    ("post", "/api/agents/execute/resume"),
    ("get", TASKS_STREAM_URL),
    ("get", SESSIONS_URL),
    ("get", "/api/agents/sessions/whatever/messages"),
    ("get", "/api/agents/sessions/whatever/deliverables"),
    ("delete", "/api/agents/sessions/whatever"),
    ("post", "/api/agents/memory/search"),
    ("get", "/api/agents/running"),
    ("get", "/api/agents/whatever/status"),
    ("post", "/api/agents/whatever/cancel"),
    ("post", "/api/agents/skill-evolution"),
    ("post", "/api/agents/debate"),
    ("get", "/api/agent/trace/whatever"),
    ("get", "/api/agent/traces"),
    ("get", "/api/agents/whatever/tool-calls"),
    ("get", "/api/agents/whatever/errors"),
    ("get", "/api/agents/whatever/sessions"),
    ("get", "/api/agents/whatever/token-usage"),
    ("get", "/api/agent/security-config"),
    ("put", "/api/agent/security-config"),
    ("get", "/api/agents/whatever/stream"),
)


def _token(user_id: str) -> str:
    """签一把与 apps/api 同口径的 access token(sub/iss/aud/type 四项都对齐中间件校验)。"""
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


# ---------------------------------------------------------------------------
# 夹具
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _forbid_production_db(monkeypatch: pytest.MonkeyPatch) -> None:
    """AGENTS.md §5 测试隔离铁律:本文件用例零 DB 触达(建池即报错)。"""

    async def _no_pool(*args: object, **kwargs: object) -> None:
        raise AssertionError("鉴权回归用例不得创建 asyncpg 连接池(生产库禁连)")

    monkeypatch.setattr("asyncpg.create_pool", _no_pool)


@pytest.fixture(autouse=True)
def _enforce_jwt(monkeypatch: pytest.MonkeyPatch) -> None:
    """钉死测试密钥:非空 jwt_secret ⇒ auth_globally_enforced() 为真,不允许 dev 降级。"""
    monkeypatch.setattr(settings, "jwt_secret", TEST_SECRET)


@pytest.fixture(autouse=True)
def _clean_run_ownership():
    """每个用例前后清空属主登记表(它是进程内单例,跨用例残留会让断言失去意义)。"""
    from app.services import run_ownership

    run_ownership.clear_all()
    yield
    run_ownership.clear_all()


@pytest.fixture(autouse=True)
def _memory_store_in_memory_mode():
    """强制 memory_store 走内存实现(不碰 Redis)。"""
    from app.services.memory import memory_store

    memory_store._use_redis = False
    memory_store._redis = None
    memory_store._store.clear()
    yield
    memory_store._store.clear()


def _agents_app(*, with_middleware: bool) -> FastAPI:
    """最小装配:真实 agents router(+ 可选真实 JWTAuthMiddleware),前缀同 main.py。"""
    from app.routers.agents import router

    app = FastAPI()
    if with_middleware:
        app.add_middleware(jwt_auth.JWTAuthMiddleware)
    app.include_router(router, prefix="/api")
    return app


@pytest.fixture
async def probe_client() -> Any:
    """挂了真实中间件的客户端(等价生产链路)。"""
    transport = ASGITransport(app=_agents_app(with_middleware=True))
    async with AsyncClient(transport=transport, base_url="http://authz59.test") as ac:
        yield ac


@pytest.fixture
async def bare_client() -> Any:
    """**不挂中间件**的客户端:唯一裁判是端点级 Depends,与中间件是否放行无关。"""
    transport = ASGITransport(app=_agents_app(with_middleware=False))
    async with AsyncClient(transport=transport, base_url="http://authz59-bare.test") as ac:
        yield ac


# ---------------------------------------------------------------------------
# 1. 端点级鉴权:每个面都必须把匿名/无身份请求挡在 401
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("method,path", AUTHZ_ENFORCED_ENDPOINTS)
async def test_endpoint_level_auth_is_wired(
    bare_client: AsyncClient, method: str, path: str
) -> None:
    """无 JWT 上下文(生产态)一律 401 —— 端点级地板,不依赖中间件是否放行。

    bare_client 没挂中间件,所以 request.state 里永远没有 user_id。此时
    jwt_secret 非空 ⇒ require_request_user_id 必须抛 401(而非落到
    DEV_ANONYMOUS_PRINCIPAL 的开发降级)。任一端点漏挂 Depends → 本用例红。
    """
    kwargs: dict[str, Any] = {"json": {}} if method in ("post", "put", "patch") else {}
    resp = await getattr(bare_client, method)(path, **kwargs)
    assert resp.status_code == 401, f"{method.upper()} {path} 缺端点级鉴权(实得 {resp.status_code})"


@pytest.mark.parametrize("path", [APPROVAL_URL, SESSIONS_URL, TASKS_STREAM_URL])
async def test_anonymous_request_is_401_through_real_middleware(
    probe_client: AsyncClient, path: str
) -> None:
    """真实中间件 + 匿名请求 → 401(复刻本次实测的三条链,结论必须翻转)。"""
    resp = await probe_client.post(path, json={})
    if resp.status_code == 405:  # GET-only 端点用 GET 再打一次
        resp = await probe_client.get(path)
    assert resp.status_code == 401, f"{path} 仍可匿名可达"
    assert resp.json()["message"] == "Authentication required"


async def test_whitelist_misconfiguration_cannot_leak_agents(
    probe_client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """即便有人在 .env 里把 `/api/agents/` 重新塞进免鉴权名单,端点级 Depends 仍 401。

    这正是本次事故的配置面:`.env` 一条目录前缀曾让整个无鉴权 router 匿名可达。
    中间件层的剔除由 test_session_import_auth.py 钉,这里钉的是第二层防线。
    """
    monkeypatch.setattr(
        jwt_auth, "PUBLIC_PATHS", tuple(jwt_auth.PUBLIC_PATHS) + ("/api/agents/",)
    )
    resp = await probe_client.get(SESSIONS_URL)
    assert resp.status_code == 401, "白名单放行了 /api/agents,而端点级鉴权没兜住"
    assert "sessions" not in resp.json()


# ---------------------------------------------------------------------------
# 2. 审批属主:匹配 / 跨用户 / 无属主 / 不存在
# ---------------------------------------------------------------------------


def _register(approval_id: str, owner: str | None) -> asyncio.Event:
    """手工登记一条待决审批(等价 _request_approval 的登记动作,不触弹窗)。"""
    from app.services import agent_loop_v2 as alv

    ev = asyncio.Event()
    alv._approval_registry[approval_id] = alv._ApprovalEntry(
        event=ev, decision=None, owner_user_id=owner
    )
    return ev


@pytest.fixture
def isolated_approval_registry(monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    """把审批注册表换成本用例独占的空 dict(模块属性替换,读取方运行时解析)。"""
    from app.services import agent_loop_v2 as alv

    registry: dict[str, Any] = {}
    monkeypatch.setattr(alv, "_approval_registry", registry)
    monkeypatch.setattr(alv, "_approval_persist_keys", {})
    return registry


async def test_owner_match_approval_is_accepted(
    probe_client: AsyncClient, isolated_approval_registry: dict[str, Any]
) -> None:
    """属主匹配 → 决策写入并唤醒等待协程。"""
    ev = _register("appr_59_own", USER_A)
    resp = await probe_client.post(
        APPROVAL_URL,
        json={"approval_id": "appr_59_own", "decision": "approve"},
        headers=_auth(USER_A),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["code"] == 0
    assert body["data"] == {
        "accepted": True,
        "approval_id": "appr_59_own",
        "decision": "approve",
    }
    assert isolated_approval_registry["appr_59_own"].decision == "approve"
    assert ev.is_set()


async def test_cross_user_approval_is_403(
    probe_client: AsyncClient, isolated_approval_registry: dict[str, Any]
) -> None:
    """跨用户 → 403,且**不得**写入决策、不得唤醒协程(审批门不能由别人点头)。"""
    ev = _register("appr_59_victim", USER_A)
    resp = await probe_client.post(
        APPROVAL_URL,
        json={"approval_id": "appr_59_victim", "decision": "approve"},
        headers=_auth(USER_B),
    )
    assert resp.status_code == 403, resp.text
    assert isolated_approval_registry["appr_59_victim"].decision is None
    assert not ev.is_set()


async def test_ownerless_approval_is_403_over_http(
    probe_client: AsyncClient, isolated_approval_registry: dict[str, Any]
) -> None:
    """属主为 None(非 HTTP 上下文创建)的审批不允许被本端点解掉 → 403。"""
    ev = _register("appr_59_orphan", None)
    resp = await probe_client.post(
        APPROVAL_URL,
        json={"approval_id": "appr_59_orphan", "decision": "approve"},
        headers=_auth(USER_A),
    )
    assert resp.status_code == 403, resp.text
    assert isolated_approval_registry["appr_59_orphan"].decision is None
    assert not ev.is_set()


async def test_unknown_approval_is_404(
    probe_client: AsyncClient, isolated_approval_registry: dict[str, Any]
) -> None:
    """不存在 → 404,与 403 可区分(路由层据此给不同结论)。"""
    resp = await probe_client.post(
        APPROVAL_URL,
        json={"approval_id": "appr_59_never_existed", "decision": "approve"},
        headers=_auth(USER_A),
    )
    assert resp.status_code == 404, resp.text


async def test_resolve_outcome_distinguishes_forbidden_from_missing() -> None:
    """服务层三态判定(不经过 HTTP 也成立):applied / not_found / forbidden。"""
    from app.services import agent_loop_v2 as alv
    from app.services.agent_loop_v2 import ApprovalOutcome, resolve_approval_for_requester

    with pytest.MonkeyPatch.context() as mp:
        registry: dict[str, Any] = {}
        mp.setattr(alv, "_approval_registry", registry)
        registry["x1"] = alv._ApprovalEntry(event=asyncio.Event(), owner_user_id=USER_A)
        registry["x2"] = alv._ApprovalEntry(event=asyncio.Event(), owner_user_id=None)
        ev_legacy = asyncio.Event()
        registry["x3"] = (ev_legacy, None)  # 历史二元组形态(owner=None)

        assert (
            resolve_approval_for_requester("x1", "approve", USER_A)
            is ApprovalOutcome.APPLIED
        )
        assert (
            resolve_approval_for_requester("x1", "approve", USER_B)
            is ApprovalOutcome.FORBIDDEN
        )
        assert (
            resolve_approval_for_requester("nope", "approve", USER_A)
            is ApprovalOutcome.NOT_FOUND
        )
        assert (
            resolve_approval_for_requester("x2", "approve", USER_A)
            is ApprovalOutcome.FORBIDDEN
        )
        # 二元组就地升级:无 principal 的通道(引擎)仍可结算,升级后 owner=None 语义不变
        assert (
            resolve_approval_for_requester("x3", "approve", None)
            is ApprovalOutcome.APPLIED
        )
        assert isinstance(registry["x3"], alv._ApprovalEntry)
        assert registry["x3"].owner_user_id is None
        assert ev_legacy.is_set()


async def test_request_approval_registers_owner_from_run_user_id(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """参数链打通:路由层传入的 user_id 必须成为审批条目的属主(不靠全局变量)。"""
    from app.services import agent_loop_v2 as alv
    from app.services import approval_persistence as ap
    from app.services.agent_loop_v2 import (
        ApprovalOutcome,
        AgentLoopV2,
        ToolCall,
        ToolDefinition,
        resolve_approval_for_requester,
    )

    ap.set_db_path(tmp_path / "approval_grants_authz59.db")
    monkeypatch.setattr(alv, "_approval_registry", {})
    emitted: list[dict[str, Any]] = []

    class _FakeHookEngine:
        async def emit(self, event: str, context: dict[str, Any]) -> list[dict[str, Any]]:
            emitted.append({"event": event, **context})
            return []

    monkeypatch.setattr(alv, "hook_engine", _FakeHookEngine())

    async def _exec(args: dict[str, Any]) -> dict[str, Any]:
        return {"ok": True, "path": args["path"]}

    loop = AgentLoopV2(
        None,
        [ToolDefinition(name="write_file", description="写", parameters={}, executor=_exec)],
        approval_enabled=True,
        approval_timeout=10,
        session_id="sess-authz59-owner",
        user_id=USER_A,
        # 2026-09-26 V3 #47 第二格:write_file ∈ _ADMIN_ONLY_TOOLS,角色闸在审批闸之前。
        # 本例测的是"审批条目属主 = 路由传入的 user_id"(越权链),前置条件是这人身为
        # admin 走到了审批那一步;role 闸自身的正反例在 tests/test_engine_role_parity.py。
        user_role=1,
    )
    tc = ToolCall(id="c1", name="write_file", args={"path": "/tmp/authz59.txt"})
    task = asyncio.create_task(loop._execute_single(tc))
    await asyncio.sleep(0)  # 让 _execute_single 跑到审批等待

    approval_id = next(i["approval_id"] for i in emitted if i["event"] == "tool.approval")
    entry = alv._approval_registry[approval_id]
    assert isinstance(entry, alv._ApprovalEntry)
    assert entry.owner_user_id == USER_A, "审批条目未登记属主 ⇒ 属主绑定链没打通"

    # 别人的身份解不掉,本人的身份才生效
    assert (
        resolve_approval_for_requester(approval_id, "approve", USER_B)
        is ApprovalOutcome.FORBIDDEN
    )
    assert task.done() is False
    assert (
        resolve_approval_for_requester(approval_id, "approve", USER_A)
        is ApprovalOutcome.APPLIED
    )
    result = await task
    assert result.error is None
    assert result.result == {"ok": True, "path": "/tmp/authz59.txt"}
    assert approval_id not in alv._approval_registry  # 清理纪律:同期释放
    assert approval_id not in alv._approval_persist_keys
    ap.close()
    ap.set_db_path(ap.DEFAULT_DB_PATH)


# ---------------------------------------------------------------------------
# 3. 事件流:按属主转发 + fail-closed
# ---------------------------------------------------------------------------


class _StubRequest:
    """SSE 生成器只用到 is_disconnected —— 最小替身,永不主动断开。"""

    async def is_disconnected(self) -> bool:
        return False


async def _drain_one(broadcasts: list[tuple[str, dict[str, Any]]], *, user: str, agent_id: str = "") -> str | None:
    """起流 → 广播给定事件 → 取回**第一条被转发**的 SSE 行(None=全被过滤)。"""
    from app.routers.agents import stream_agent_tasks
    from app.services.hook_engine import hook_engine

    resp = await stream_agent_tasks(
        request=_StubRequest(),  # type: ignore[arg-type]
        agentId=agent_id,
        current_user=user,
    )
    gen = resp.body_iterator
    pending = asyncio.create_task(gen.__anext__())
    await asyncio.sleep(0.3)  # 让生成器跑到 subscribe 之后的轮询
    for evt, payload in broadcasts:
        hook_engine._broadcast(evt, payload)
    line: str | None = None
    try:
        line = await asyncio.wait_for(pending, 3)
    except (TimeoutError, StopAsyncIteration):
        pending.cancel()
        with contextlib.suppress(BaseException):
            await pending
    finally:
        with contextlib.suppress(Exception):
            await gen.aclose()
    return line


async def test_tasks_stream_does_not_forward_other_users_events() -> None:
    """他人会话的事件不得转发(旧实现 agentId="" 时全站广播)。"""
    from app.services.agent_events import HOOK_TOOL_AFTER
    from app.services.run_ownership import record_ownership

    record_ownership("sess-victim", USER_A)
    record_ownership("sess-attacker", USER_B)
    line = await _drain_one(
        [
            (HOOK_TOOL_AFTER, {"session_id": "sess-victim", "marker": "VICTIM-SECRET"}),
            (HOOK_TOOL_AFTER, {"session_id": "sess-attacker", "marker": "ATTACKER-OWN"}),
        ],
        user=USER_B,
    )
    assert line is not None, "本人事件应被转发(不能把流过滤成恒空)"
    assert "ATTACKER-OWN" in line
    assert "VICTIM-SECRET" not in line, "他人会话事件被转发 ⇒ 全局广播没被消灭"


async def test_tasks_stream_is_fail_closed_without_ownership_record() -> None:
    """无属主记录的事件默认不转发(fail-closed):宁可看不到实时流,也不泄漏。"""
    from app.services.agent_events import HOOK_TOOL_AFTER

    line = await _drain_one(
        [(HOOK_TOOL_AFTER, {"session_id": "sess-orphan", "marker": "ORPHAN-SECRET"})],
        user=USER_A,
    )
    assert line is None, "查不到属主的事件被转发 ⇒ fail-closed 失效"


async def test_tasks_stream_uses_run_id_as_owner_key() -> None:
    """thinking.delta/plan.step 只带 run_id(=workbench session_id)→ 按 run_id 判属主。"""
    from app.services.agent_events import HOOK_PLAN_STEP
    from app.services.run_ownership import record_ownership

    record_ownership("run-59-mine", USER_A)
    line = await _drain_one(
        [(HOOK_PLAN_STEP, {"run_id": "run-59-mine", "marker": "MY-RUN"})],
        user=USER_A,
    )
    assert line is not None and "MY-RUN" in line


async def test_tasks_stream_explicit_agent_id_cross_user_is_403() -> None:
    """显式传 agentId 且属主是别人 → 403(误用可见),而不是静默空流。"""
    from app.routers.agents import stream_agent_tasks
    from app.services.run_ownership import record_ownership

    record_ownership("sess-victim", USER_A)
    with pytest.raises(HTTPException) as exc:
        await stream_agent_tasks(
            request=_StubRequest(),  # type: ignore[arg-type]
            agentId="sess-victim",
            current_user=USER_B,
        )
    assert exc.value.status_code == 403


async def test_tasks_stream_requires_login_over_http(
    probe_client: AsyncClient,
) -> None:
    """HTTP 层:匿名订阅 tasks/stream 必须 401(实测曾 200 收到他人工具事件)。"""
    resp = await probe_client.get(TASKS_STREAM_URL)
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# 4. 会话数据:复用 memory.py 的 P1-6 隔离原语
# ---------------------------------------------------------------------------


async def test_sessions_listing_is_scoped_to_current_user(
    probe_client: AsyncClient,
) -> None:
    """GET /agents/sessions 只列请求者自己的会话(复合 key 前缀过滤)。"""
    from app.services.memory import memory_store

    memory_store._store[f"memory:{USER_A}:sess-a"] = [{"role": "user", "content": "A 正文"}]
    memory_store._store[f"memory:{USER_B}:sess-b"] = [{"role": "user", "content": "B 正文"}]
    memory_store._store["memory:legacy-sess"] = [{"role": "user", "content": "旧数据"}]

    resp = await probe_client.get(SESSIONS_URL, headers=_auth(USER_A))
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["sessions"] == ["sess-a"]
    assert data["count"] == 1


async def test_other_user_session_messages_are_not_leaked(
    probe_client: AsyncClient,
) -> None:
    """读他人会话:属主未知时按复合 key 读不到内容;属主可判定则直接 403。"""
    from app.services.memory import memory_store
    from app.services.run_ownership import record_ownership

    memory_store._store[f"memory:{USER_B}:sess-b"] = [{"role": "user", "content": "B 正文"}]

    resp = await probe_client.get(
        "/api/agents/sessions/sess-b/messages", headers=_auth(USER_A)
    )
    assert resp.status_code == 200
    assert resp.json()["messages"] == [], "跨用户读到了他人会话正文"

    record_ownership("sess-b", USER_B)
    resp2 = await probe_client.get(
        "/api/agents/sessions/sess-b/messages", headers=_auth(USER_A)
    )
    assert resp2.status_code == 403, "属主可判定为他人却未拦(应 403)"


async def test_run_ownership_registry_release_and_lookup() -> None:
    """登记表自身语义:登记可查、释放即忘、空标识不建伪记录(事件流据此 fail-closed)。"""
    from app.services.run_ownership import (
        entry_count,
        owner_of,
        record_ownership,
        release_ownership,
    )

    record_ownership("sess-59", USER_A)
    assert owner_of("sess-59") == USER_A
    release_ownership("sess-59")
    assert owner_of("sess-59") is None
    record_ownership("", USER_A)
    record_ownership("sess-59b", "")
    assert owner_of("sess-59b") is None
    assert entry_count() == 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
