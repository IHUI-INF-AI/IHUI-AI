# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""send_to_session 工具(G-07 会话寻址形态)用例。

覆盖:
1. 属主放行:消息真实落入目标会话队列(落点 = 既有 AgentMessageBus,不新造传输层)
2. 非属主 / 无属主 / 调用方会话属他人:拒绝且零副作用(目标队列连创建都没有),并给正向对照
3. 身份缺失 / 参数非法:拒绝且一次都不碰总线
4. 投递诚实性:总线没落队就不冒充已投递
5. 注册面:_TOOLS 与 _TOOL_HANDLERS 双射 + schema 只带模型可填字段
6. relay 默认态:台账 default 与代码字面默认一致(源码字面量 + 开关实测)

隔离:每条用例一个全新 AgentMessageBus(经 bus= 注入);autouse 夹具清 run_ownership
(进程级登记表,不清会让上一条的属主记录污染下一条)。
"""

from __future__ import annotations

import inspect
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock

import pytest

from app.services import mcp_server
from app.services.agent_comm import AgentMessageBus
from app.services.mcp_server import _TOOL_HANDLERS, _TOOLS, _tool_send_to_session
from app.services.run_ownership import clear_all, record_ownership

S1 = "sess-a"
S2 = "sess-b"
S3 = "sess-c"
U1 = "user-1"
U2 = "user-2"


@pytest.fixture(autouse=True)
def _isolate_run_ownership() -> Any:
    """run_ownership 是进程级登记表,逐条清空才能重复跑。"""
    clear_all()
    yield
    clear_all()


@pytest.fixture()
def bus() -> AgentMessageBus:
    b = AgentMessageBus()
    # Redis 出口钉死为"永不调用":本工具是纯内存投递路径(测试隔离铁律)
    b._get_redis = AsyncMock()  # type: ignore[method-assign]
    return b


def _args(
    target: str = S2,
    *,
    body: str = "继续手头那条",
    user: str = U1,
    session: str = S1,
    **extra: Any,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "__session_id": session,
        "__user_id": user,
        "target_session_id": target,
        "message": body,
    }
    payload.update(extra)
    return payload


# =============================================================================
# 1. 属主放行 + 落点
# =============================================================================


async def test_owner_delivery_lands_in_target_session_queue(bus: AgentMessageBus) -> None:
    """同一属主:消息必须真实落进目标会话队列,且载荷带齐来源/归属两维。"""
    record_ownership(S1, U1)
    record_ownership(S2, U1)
    result = await _tool_send_to_session(_args(), bus=bus)

    assert result["ok"] is True
    assert result["code"] == "queued"
    assert result["delivered"] is True
    assert result["toSessionId"] == S2
    assert result["queueDepth"] == 1
    assert bus.queue_depth(S2) == 1

    got = await bus.receive(S2, timeout=0.05)
    assert got is not None
    assert got.content == "继续手头那条"
    assert got.fromAgent == S1
    assert got.toAgent == S2
    assert got.type == "notification"
    assert got.sessionId == S1
    assert got.ownerUserId == U1


async def test_request_kind_sets_require_reply(bus: AgentMessageBus) -> None:
    record_ownership(S1, U1)
    record_ownership(S2, U1)
    result = await _tool_send_to_session(_args(kind="request"), bus=bus)
    assert result["ok"] is True

    got = await bus.receive(S2, timeout=0.05)
    assert got is not None
    assert got.type == "request"
    assert got.requireReply is True


# =============================================================================
# 2. 归属拒绝 + 零副作用 + 正向对照
# =============================================================================


async def test_non_owner_is_refused_with_zero_side_effects(bus: AgentMessageBus) -> None:
    """目标属他人 ⇒ 拒绝,目标队列连创建都不发生;同目标换真属主可投(正向对照)。"""
    record_ownership(S1, U1)
    record_ownership(S2, U2)
    record_ownership(S3, U2)

    denied = await _tool_send_to_session(_args(), bus=bus)
    assert denied["ok"] is False
    assert denied["code"] == "forbidden_cross_owner"
    assert denied["delivered"] is False
    assert denied["sideEffects"] == "none"
    assert bus.queue_depth(S2) is None

    allowed = await _tool_send_to_session(_args(user=U2, session=S3), bus=bus)
    assert allowed["ok"] is True
    assert bus.queue_depth(S2) == 1


async def test_target_without_owner_record_fails_closed(bus: AgentMessageBus) -> None:
    """owner_of 查不到 ⇒ 拒绝(不把「查不到」读成「无主可投」);登记后可投。"""
    record_ownership(S1, U1)

    denied = await _tool_send_to_session(_args(), bus=bus)
    assert denied["ok"] is False
    assert denied["code"] == "target_owner_unknown"
    assert bus.queue_depth(S2) is None

    record_ownership(S2, U1)
    allowed = await _tool_send_to_session(_args(), bus=bus)
    assert allowed["ok"] is True
    assert bus.queue_depth(S2) == 1


async def test_caller_session_owned_by_other_user_is_refused(bus: AgentMessageBus) -> None:
    """调用方会话已登记为他人属主 ⇒ 拒绝,不得拿别人的会话当发送方。"""
    record_ownership(S1, U2)
    record_ownership(S2, U1)

    denied = await _tool_send_to_session(_args(), bus=bus)
    assert denied["ok"] is False
    assert denied["code"] == "forbidden_caller_session_mismatch"
    assert bus.queue_depth(S2) is None


async def test_missing_caller_identity_never_touches_bus(bus: AgentMessageBus) -> None:
    record_ownership(S2, U1)
    cases = (
        (_args(user=""), ["__user_id"]),
        (_args(session=""), ["__session_id"]),
    )
    for payload, missing in cases:
        denied = await _tool_send_to_session(payload, bus=bus)
        assert denied["ok"] is False
        assert denied["code"] == "missing_caller_identity"
        assert denied["missingKeys"] == missing
        assert bus.queue_depth(S2) is None


@pytest.mark.parametrize(
    ("payload", "code"),
    [
        (_args(target=""), "missing_target_session"),
        (_args(target="*"), "broadcast_not_allowed"),
        (_args(target=S1), "self_target"),
        (_args(body="   "), "empty_message"),
        (_args(kind="broadcast"), "unsupported_kind"),
        (_args(kind="response"), "unsupported_kind"),
    ],
)
async def test_invalid_payload_is_refused_before_bus(
    bus: AgentMessageBus, payload: dict[str, Any], code: str
) -> None:
    record_ownership(S1, U1)
    record_ownership(S2, U1)
    denied = await _tool_send_to_session(payload, bus=bus)
    assert denied["ok"] is False
    assert denied["code"] == code
    assert denied["delivered"] is False
    assert bus.queue_depth(S2) is None


# =============================================================================
# 3. 投递诚实性
# =============================================================================


async def test_not_queued_is_not_reported_as_delivered(
    bus: AgentMessageBus, monkeypatch: pytest.MonkeyPatch
) -> None:
    record_ownership(S1, U1)
    record_ownership(S2, U1)
    monkeypatch.setattr(bus, "send", AsyncMock())

    result = await _tool_send_to_session(_args(), bus=bus)
    assert result["ok"] is False
    assert result["code"] == "not_queued"
    assert result["delivered"] is False
    assert "messageId" in result


# =============================================================================
# 4. 注册面与 schema
# =============================================================================


def test_tool_registered_in_both_tables() -> None:
    assert "send_to_session" in {t.name for t in _TOOLS}
    assert _TOOL_HANDLERS.get("send_to_session") is _tool_send_to_session
    assert len(_TOOLS) == len(_TOOL_HANDLERS)


def test_schema_carries_only_model_fillable_fields() -> None:
    from app.services.agent_comm import _NAMABLE_MESSAGE_TYPES

    tool = next(t for t in _TOOLS if t.name == "send_to_session")
    schema = tool.input_schema
    props = schema["properties"]
    assert schema["required"] == ["target_session_id", "message"]
    assert schema["additionalProperties"] is False
    assert set(props) == {"target_session_id", "message", "kind"}
    # 路由身份键不得出现在模型可填面(只能由 call_tool 宿主注入)
    assert "__user_id" not in props
    assert "__session_id" not in props
    # kind 值域 = 既有投递层白名单(不复制第二份)
    assert set(props["kind"]["enum"]) == set(_NAMABLE_MESSAGE_TYPES)


def test_tool_is_not_admin_only() -> None:
    """普通用户在自己名下的会话之间投递,不该被 admin 矩阵挡掉。"""
    assert "send_to_session" not in mcp_server._ADMIN_ONLY_TOOLS


def test_delivery_reuses_existing_bus_not_a_new_transport() -> None:
    """形状锁:只经 agent_comm 的既有总线 send,不新建队列/传输层。"""
    src = inspect.getsource(_tool_send_to_session)
    assert "agent_message_bus" in src
    assert "await b.send(" in src
    assert "asyncio.Queue(" not in src


# =============================================================================
# 5. relay 默认态(台账 ↔ 代码同源)
# =============================================================================


def _matrix_row(env: str) -> dict[str, str]:
    from app.core.capability_matrix import CAPABILITY_MATRIX

    return next(e for e in CAPABILITY_MATRIX if e["env"] == env)


def test_relay_matrix_default_matches_code_literal() -> None:
    """台账 default 必须等于代码字面默认;单改台账 true 即撒谎。"""
    row = _matrix_row("AGENT_TEAM_RELAY_ENABLED")
    app_dir = Path(mcp_server.__file__).resolve().parents[1]
    loop_src = (app_dir / "services" / "agent_loop_v2.py").read_text(encoding="utf-8")
    assert 'os.environ.get("AGENT_TEAM_RELAY_ENABLED", "false")' in loop_src
    assert row["default"] == "false"
    assert "放量" in row["reason_if_off"]
    assert "agent_loop_v2" in row["doc_ref"]


def test_relay_switch_env_semantics(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.services.agent_loop_v2 import _team_relay_enabled_from_env

    monkeypatch.delenv("AGENT_TEAM_RELAY_ENABLED", raising=False)
    assert _team_relay_enabled_from_env() is False
    monkeypatch.setenv("AGENT_TEAM_RELAY_ENABLED", "true")
    assert _team_relay_enabled_from_env() is True
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
