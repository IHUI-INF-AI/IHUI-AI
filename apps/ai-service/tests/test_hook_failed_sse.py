# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-87 补链(2026-10-29):hook 执行失败的 SSE 通道路径回归。

**这一环此前整体缺失**(判定层 `packages/shared/src/chat/hook-failures.ts` 2026-09-24
交付后一直是死代码):`hook.failed` 只发 orchestration_hub(内部编排总线),不在
hook_engine 的订阅面,`AGENT_SUBSCRIBE_EVENTS` 里也没有它 ⇒ 前端六态卡零数据源。

本文件钉三件事:
1. 契约面:`hook.failed` 进 HOOK_FAILED 常量、进 HOOK_EVENT_TO_SSE 映射(kebab-case
   `hook-failed`,**不是** SSE 的 `error` 帧)、进 AGENT_SUBSCRIBE_EVENTS 白名单;
2. 发射面:失败时向订阅者真广播,且**不经** `emit()`(否则一次 hook 失败会去点火别的
   hook,自激成环);
3. 载荷面:六字段的**取得与取不到**如实分开 —— exitCode/stderr 只有"脚本真跑完且非零"
   才有,超时那一档没有退出码(不补 0)、stderr/command 必须过脱敏出口。
"""

from __future__ import annotations

import asyncio
import os

import pytest

from app.services.agent_events import (
    AGENT_SUBSCRIBE_EVENTS,
    HOOK_ERROR,
    HOOK_EVENT_TO_SSE,
    HOOK_FAILED,
    SSE_ERROR,
    map_hook_event_to_sse,
)
from app.services.hook_engine import (
    HOOK_EVENTS,
    HOOK_FAILED_EVENT,
    _redact_event_text,
    hook_engine,
)

# ---------------------------------------------------------------------------
# 1. 契约面
# ---------------------------------------------------------------------------


def test_hook_failed_in_contract_mapping_and_subscribe_set():
    """三个面必须同时到位 —— 只补一面就是"造好没装车"。"""
    assert HOOK_FAILED == "hook.failed"
    assert HOOK_FAILED_EVENT == HOOK_FAILED, "hook_engine 与 agent_events 的常量值必须同源同值"
    assert map_hook_event_to_sse(HOOK_FAILED) == "hook-failed"
    assert HOOK_FAILED in AGENT_SUBSCRIBE_EVENTS
    assert HOOK_EVENT_TO_SSE[HOOK_FAILED] == "hook-failed"


def test_hook_failed_is_not_mapped_onto_sse_error():
    """**不许**把 hook 执行失败映射成 SSE 的 `error` 帧。

    `error` 的消费面是 onError → setMessageError(气泡变红、正文不可用);hook 失败时
    回答通常完好。混过去 = 把"我的 lint hook 挂了"呈现成"这条回答失败了"。
    """
    assert map_hook_event_to_sse(HOOK_FAILED) != SSE_ERROR
    # 既有 HOOK_ERROR 仍映射到 error(两件事各自的映射都没被改坏)
    assert map_hook_event_to_sse(HOOK_ERROR) == SSE_ERROR


def test_hook_failed_is_not_a_user_configurable_trigger():
    """`HOOK_EVENTS` 是用户可配的**触发器白名单**,系统事实不混进去。

    `hook.failed` 若进白名单,用户就能配置"当某个 hook 失败时再跑另一个 hook" ——
    一次失败可以自激成环,而失败本身通常意味着环境已经不对了。
    """
    assert HOOK_FAILED not in HOOK_EVENTS
    # 但订阅集合里必须有它(订阅面 ≠ 触发器面,这两张表本来就不同一张)
    assert HOOK_FAILED in AGENT_SUBSCRIBE_EVENTS


# ---------------------------------------------------------------------------
# 2. 脱敏出口复用
# ---------------------------------------------------------------------------


def test_redact_reuses_existing_output_cleaning_exit():
    """必须复用 `app.core.output_cleaning.redact_secrets`,不是第二套正则。"""
    # 运行时拼接样本(整串字面量会触发 push protection,本仓已有前科)
    fake_key = "sk-" + "a" * 32
    out = _redact_event_text(f"before {fake_key} after", 500)
    assert fake_key not in out
    assert "[REDACTED_SECRET]" in out


def test_redact_truncates_to_limit():
    out = _redact_event_text("x" * 5000, 100)
    assert len(out) == 100


def test_redact_returns_empty_not_raw_text_when_unavailable(monkeypatch):
    """脱敏器不可用 ⇒ **空串**(调用方据此整键省略),绝不回落原文。

    失效方向必须是"少一格证据",绝不能是"漏一次凭据"。
    """
    import app.core.output_cleaning as oc

    def _boom(_text: str) -> str:
        raise RuntimeError("脱敏器坏了")

    monkeypatch.setattr(oc, "redact_secrets", _boom)
    assert _redact_event_text("password: hunter2hunter2", 500) == ""


# ---------------------------------------------------------------------------
# 3. 发射面:失败时向订阅者广播(且不经 emit)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_failed_hook_broadcasts_to_subscribers(monkeypatch):
    """重试耗尽的失败 ⇒ 订阅者收到 `hook.failed`,载荷带六字段 + 归属会话键。"""
    engine = hook_engine
    monkeypatch.setattr(engine, "_ensure_redis", _no_redis)
    monkeypatch.setattr(engine, "_schedule_persist_log", lambda *a, **k: None)
    emitted: list[tuple[str, object]] = []

    async def _fake_hub_emit(**kwargs):
        emitted.append(("hub", kwargs))
        return "evt-1"

    monkeypatch.setattr(engine, "_push_dlq", _noop_async)
    monkeypatch.setattr(
        "app.services.orchestration_hub.orchestration_hub.emit", _fake_hub_emit
    )

    q = engine.subscribe(HOOK_FAILED_EVENT)
    try:
        # 直连发射器:绕开 emit() 的 hook 匹配,聚焦"广播出来了吗、载荷对不对"
        engine._broadcast_hook_failed(
            hook={"id": "hk-1", "name": "lint 检查"},
            event="tool.after",
            context={"session_id": "sess-1"},
            error="script 退出码 2: 有 3 处 lint 错误",
            duration_ms=1234,
            action_type="script",
            config={"command": "npm run lint"},
            facts={"exit_code": 2, "stderr": "3 problems"},
        )
        payload = q.get_nowait()
    finally:
        engine.unsubscribe(HOOK_FAILED_EVENT, q)

    assert payload["type"] == HOOK_FAILED_EVENT
    assert payload["hook_id"] == "hk-1"
    assert payload["hook_name"] == "lint 检查"
    assert payload["event"] == "tool.after"
    assert payload["state"] == "failed"
    assert payload["duration_ms"] == 1234
    assert payload["exit_code"] == 2
    assert payload["stderr"] == "3 problems"
    assert payload["command"] == "npm run lint"
    # 归属键:转发层(tasks/stream / {agent_id}/stream)按它过滤,缺了会被 fail-closed 丢
    assert payload["session_id"] == "sess-1"
    assert payload["run_id"] == "sess-1"


@pytest.mark.asyncio
async def test_timeout_has_no_exit_code(monkeypatch):
    """超时那一档**没有** exit_code 与 stderr —— 不补 0、不补空串。

    0 是"确实以 0 退出"这个**肯定结论**,补上去就是把"没取到"伪装成"跑成功了"。
    终态信息由 state='timedOut' 表达。
    """
    engine = hook_engine
    q = engine.subscribe(HOOK_FAILED_EVENT)
    try:
        engine._broadcast_hook_failed(
            hook={"id": "hk-2", "name": "长任务"},
            event="tool.before",
            context={"run_id": "sess-2"},
            error="script 超时(10s)",
            duration_ms=10000,
            action_type="script",
            config={"command": "sleep 60"},
            facts={"timeout": True},
        )
        payload = q.get_nowait()
    finally:
        engine.unsubscribe(HOOK_FAILED_EVENT, q)

    assert payload["state"] == "timedOut"
    assert "exit_code" not in payload
    assert "stderr" not in payload
    # command 仍能取到(它在配置里,与执行成败无关)
    assert payload["command"] == "sleep 60"


@pytest.mark.asyncio
async def test_non_script_action_omits_command():
    """webhook/notify 等动作**不**下发 command(webhook 的 url 不外泄到端上)。"""
    engine = hook_engine
    q = engine.subscribe(HOOK_FAILED_EVENT)
    try:
        engine._broadcast_hook_failed(
            hook={"id": "hk-3", "name": "回调"},
            event="session.end",
            context={"session_id": "sess-3"},
            error="webhook 超时(5s)",
            duration_ms=5000,
            action_type="webhook",
            config={"url": "https://internal.example/hook"},
            facts={},
        )
        payload = q.get_nowait()
    finally:
        engine.unsubscribe(HOOK_FAILED_EVENT, q)

    assert payload["state"] == "failed"
    assert "command" not in payload
    assert "exit_code" not in payload
    assert "internal.example" not in str(payload)


@pytest.mark.asyncio
async def test_broadcast_never_raises_on_broken_queue():
    """观测面失败绝不阻塞 hook 主链路(广播抛错被吞,不向上冒)。"""
    engine = hook_engine
    q = engine.subscribe(HOOK_FAILED_EVENT)
    try:
        # 队列换成一个"取一次就炸"的替身
        class _Broken:
            def full(self) -> bool:
                raise RuntimeError("queue broke")

        engine._subscribers[HOOK_FAILED_EVENT] = [_Broken()]  # type: ignore[list-item]
        engine._broadcast_hook_failed(
            hook={"id": "hk-4", "name": "x"},
            event="tool.before",
            context={"session_id": "s"},
            error="e",
            duration_ms=1,
            action_type="log",
            config={},
            facts={},
        )
    finally:
        engine._subscribers.pop(HOOK_FAILED_EVENT, None)
        engine.unsubscribe(HOOK_FAILED_EVENT, q)


# ---------------------------------------------------------------------------
# 4. 执行器事实采集:exit_code/stderr 只在真失败时回填
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_run_script_fills_facts_on_nonzero_exit(monkeypatch):
    """脚本非零退出 ⇒ facts 回填 exit_code + stderr(原文,脱敏在发射点做)。"""
    engine = hook_engine
    facts: dict[str, object] = {}
    if os.name == "nt":
        cmd = "echo boom 1>&2 & exit 3"
    else:
        cmd = "echo boom 1>&2; exit 3"
    result, err = await engine._run_script({"command": cmd}, "tool.before", {}, facts)
    assert err is not None, "非零退出必须返回错误"
    assert facts.get("exit_code") == 3
    assert "boom" in str(facts.get("stderr") or "")
    assert result is None or isinstance(result, str)


@pytest.mark.asyncio
async def test_run_script_success_leaves_facts_empty():
    """成功执行不回填任何失败事实(否则成功路径会挂一张失败卡)。"""
    engine = hook_engine
    facts: dict[str, object] = {}
    cmd = "echo ok" if os.name == "nt" else "echo ok"
    result, err = await engine._run_script({"command": cmd}, "tool.before", {}, facts)
    assert err is None
    assert facts == {}


@pytest.mark.asyncio
async def test_run_script_missing_command_leaves_facts_empty():
    """命令未配置这一档**没有** stderr 可给 —— facts 保持空,不造假。"""
    engine = hook_engine
    facts: dict[str, object] = {}
    _result, err = await engine._run_script({}, "tool.before", {}, facts)
    assert err is not None
    assert facts == {}


# ---------------------------------------------------------------------------
# 5. 执行链端到端:重试耗尽的 _execute_hook 真会广播
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_execute_hook_broadcasts_when_retries_exhausted(monkeypatch):
    """`_execute_hook` 失败(重试耗尽)⇒ 走完整链路:入 DLQ + 广播 + 发编排事件。"""
    engine = hook_engine
    dlq_calls: list[tuple] = []
    hub_calls: list[dict] = []

    async def _fake_dlq(*args, **kwargs):
        dlq_calls.append(args)

    async def _fake_hub(**kwargs):
        hub_calls.append(kwargs)
        return "evt"

    monkeypatch.setattr(engine, "_push_dlq", _fake_dlq)
    monkeypatch.setattr(
        "app.services.orchestration_hub.orchestration_hub.emit", _fake_hub
    )

    q = engine.subscribe(HOOK_FAILED_EVENT)
    try:
        hook = {
            "id": "hk-e2e",
            "name": "端到端",
            "event": "tool.before",
            "action": {"type": "log", "config": {"message": "x"}},
        }
        # 让 log 动作恒定失败(避免依赖文件系统权限)
        monkeypatch.setattr(
            type(engine), "_run_log", lambda self, *a, **k: (None, "落盘失败(测试注入)")
        )
        log = await engine._execute_hook(
            hook, "tool.before", {"session_id": "sess-e2e"}
        )
        payload = q.get_nowait()
    finally:
        engine.unsubscribe(HOOK_FAILED_EVENT, q)

    assert log["success"] is False
    assert len(dlq_calls) == 1, "失败必须入 DLQ(既有行为不许被本轮改动破坏)"
    assert payload["state"] == "failed"
    assert payload["session_id"] == "sess-e2e"
    # 编排总线那条既有通道仍在(与订阅面广播**并存**,不是替换)
    assert any(c.get("event_type") == "hook.failed" for c in hub_calls)


# ---------------------------------------------------------------------------
# 辅助
# ---------------------------------------------------------------------------


async def _no_redis() -> None:
    return None


async def _noop_async(*_args, **_kwargs) -> None:
    return None


def test_subscribe_event_is_exported_from_both_modules():
    """常量在两个模块里同值同源(防"改了一处、另一处仍是旧字面量")。"""
    from app.services import agent_events, hook_engine

    assert agent_events.HOOK_FAILED == hook_engine.HOOK_FAILED_EVENT


def test_sse_deprecation_no_direct_error_usage():
    """阳性对照的反面:`HOOK_EVENT_TO_SSE` 里除 HOOK_ERROR 外不得再有值等于 'error'。"""
    errors = [
        k for k, v in HOOK_EVENT_TO_SSE.items() if v == SSE_ERROR and k != HOOK_ERROR
    ]
    assert errors == [], f"这几个 hook 事件被错映射到 SSE error: {errors}"


def test_asyncio_queue_type_annotation_smoke():
    """`_drain` 的队列注解是运行期字符串注解 —— 这里确认真实类型可用(防注解写坏)。"""
    q: asyncio.Queue = asyncio.Queue(maxsize=1)
    assert q.empty()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
