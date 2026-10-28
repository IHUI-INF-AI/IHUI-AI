# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""b76-11(2026-09-30):冷恢复/resume 必须沿用 create 的权限面。

此前 AgentResumeRequest / AgentSessionResumeRequest 都没有 permission_mode 字段,
请求里的档位被 Pydantic 静默丢弃(G-161 同型),resume 链重建 runtime 时永远回落
env 默认档。本文件钉三条契约:

- 两个 resume 请求模型都声明 permission_mode(缺省 None = 沿用 env 默认);
- `_resume_run_from_checkpoint`(两条 resume 出口的全仓唯一实现)把档位原样
  贯通到 `_new_v2_loop`,不静默改写;
- 认不出的档位值在入口 400,绝不静默回落 default(G-161 立规口径)。

所有依赖外部世界的地方一律 stub / monkeypatch,不真调网络。
参数面三站同现的守门在 scripts/tests/agent-resume-param-parity.test.mjs(node --test)。
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest
from fastapi import HTTPException

# =============================================================================
# stub:能被 _resume_result_payload 消费的最小 AgentLoopResult 形状
# =============================================================================


def _stub_loop_result() -> SimpleNamespace:
    return SimpleNamespace(
        success=True,
        final_response="续跑完成",
        stop_reason="completed",
        checkpoint_id=None,
        error=None,
        iterations=[],
        total_duration_ms=1.0,
    )


# =============================================================================
# ① 请求模型字段面
# =============================================================================


def test_resume_request_models_carry_permission_mode() -> None:
    """两个 resume 请求模型都必须声明 permission_mode,缺省 None(= env 默认)。"""
    from app.routers.agents import AgentResumeRequest, AgentSessionResumeRequest

    assert "permission_mode" in AgentResumeRequest.model_fields
    assert "permission_mode" in AgentSessionResumeRequest.model_fields

    req = AgentResumeRequest(checkpoint_id="cp-x")
    assert req.permission_mode is None
    session_req = AgentSessionResumeRequest()
    assert session_req.permission_mode is None


# =============================================================================
# ② 档位贯通到 _new_v2_loop(唯一构造入口)
# =============================================================================


@pytest.mark.parametrize("mode", ["acceptEdits", "plan", "bypassPermissions", None])
async def test_resume_run_from_checkpoint_threads_permission_mode(
    monkeypatch: pytest.MonkeyPatch, mode: str | None
) -> None:
    """`_resume_run_from_checkpoint` 把 permission_mode 原样传给 `_new_v2_loop`。"""
    import app.routers.agents as agents_mod

    captured: dict[str, Any] = {}

    async def fake_new_v2_loop(**kwargs: Any) -> Any:
        captured.update(kwargs)

        class _FakeLoop:
            async def resume_from_checkpoint(self, checkpoint_id: str) -> Any:
                captured["resumed_checkpoint_id"] = checkpoint_id
                return _stub_loop_result()

        return _FakeLoop()

    monkeypatch.setattr(agents_mod, "_new_v2_loop", fake_new_v2_loop)

    result = await agents_mod._resume_run_from_checkpoint(
        "cp-threading",
        model="smoke-model",
        max_iterations=8,
        tools=None,
        request=SimpleNamespace(state=SimpleNamespace(role_id=0)),
        current_user="user-resume",
        permission_mode=mode,
    )
    assert result.success is True
    assert captured["permission_mode"] == mode
    assert captured["resumed_checkpoint_id"] == "cp-threading"
    # resume 链上 session_id 恒为 None(由 loop 自己从 checkpoint 恢复)
    assert captured["session_id"] is None


# =============================================================================
# ③ 入口校验:认不出的档位 400,不静默回落
# =============================================================================


async def test_resume_endpoint_rejects_unknown_permission_mode() -> None:
    """POST /agents/execute/resume 带 unknown 档位 → 400,且发生在任何 checkpoint I/O 前。"""
    from app.routers.agents import AgentResumeRequest, resume_agent_execute

    with pytest.raises(HTTPException) as exc_info:
        await resume_agent_execute(
            AgentResumeRequest(checkpoint_id="cp-never-loaded", permission_mode="不存在的档"),
            SimpleNamespace(state=SimpleNamespace(role_id=0)),  # type: ignore[arg-type]
        )
    assert exc_info.value.status_code == 400


async def test_session_resume_endpoint_rejects_unknown_permission_mode() -> None:
    """POST /agents/{session_id}/resume 带 unknown 档位 → 400(与 execute/resume 同口径)。"""
    from app.routers.agents import AgentSessionResumeRequest, resume_agent_session

    with pytest.raises(HTTPException) as exc_info:
        await resume_agent_session(
            "session-x",
            AgentSessionResumeRequest(permission_mode="不存在的档"),
            SimpleNamespace(state=SimpleNamespace(role_id=0)),  # type: ignore[arg-type]
            current_user="user-resume",
        )
    assert exc_info.value.status_code == 400
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
