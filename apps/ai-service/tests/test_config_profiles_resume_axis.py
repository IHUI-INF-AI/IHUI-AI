# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""79 号票遗留格:config profiles 双轴接入 resume 三出口(2026-10-25)。

三个出口逐条钉格:
1. `_resume_run_from_checkpoint`(冷恢复直调共享实现);
2. `POST /agents/execute/resume`(`resume_agent_execute`);
3. `POST /agents/{session_id}/resume`(`resume_agent_session`)。

每个出口三例:
- profiles 生效:两轴都未携带 ⇒ 选中档案接管(source=config_profile);
- 显式值仍优先:携带任一显式轴 ⇒ source=explicit,profiles 不覆盖;
- 配置缺失不改变行为:没有档案 ⇒ None(裁决门整段跳过,与接线前逐字节同)。

所有外部世界(checkpoint 存储 / AgentLoopV2 / 控制面)一律 stub,不碰网络/DB。
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest

from app.core.config import settings
from app.core.permission_axis_gate import AxisSource, resolve_axis_resolution
from app.routers import agents as agents_mod
from app.services import agent_checkpoint
from app.services.agent_run_control import ResumeOutcome, ResumeResult

USER = "user-resume"

_PROFILE_DOC = (
    '{"profile": "review", "profiles": {"review": '
    '{"sandbox_mode": "read-only", "approval_policy": "on-request"}}}'
)


def _set_profiles(
    monkeypatch: pytest.MonkeyPatch, raw: str = _PROFILE_DOC, selected: str = ""
) -> None:
    """替换 Settings 上的两个配置源(本票唯一来源)。"""
    monkeypatch.setattr(settings, "config_profiles", raw)
    monkeypatch.setattr(settings, "config_profile", selected)


def _request() -> Any:
    """最小 Request 替身:`resolve_request_role_id` 只读 state.role_id。"""
    return SimpleNamespace(state=SimpleNamespace(role_id=0))


def _loop_result() -> SimpleNamespace:
    """能被 `_resume_result_payload` 消费的最小结果形状。"""
    return SimpleNamespace(
        success=True,
        final_response="续跑完成",
        stop_reason="completed",
        checkpoint_id=None,
        error=None,
        iterations=[],
        total_duration_ms=1.0,
    )


def _assert_profile_axis(axis: Any) -> None:
    assert axis is not None
    assert axis.source is AxisSource.CONFIG_PROFILE
    assert axis.profile_name == "review"
    assert (axis.sandbox_mode, axis.approval_policy) == ("read-only", "on-request")


# ---------------------------------------------------------------------------
# 出口 1:`_resume_run_from_checkpoint`(冷恢复直调 / 全仓唯一续跑实现)
# ---------------------------------------------------------------------------


async def _call_shared_resume(
    monkeypatch: pytest.MonkeyPatch,
    axis_resolution: Any = None,
) -> dict[str, Any]:
    captured: dict[str, Any] = {}

    async def fake_new_v2_loop(**kwargs: Any) -> Any:
        captured.update(kwargs)

        class _FakeLoop:
            async def resume_from_checkpoint(self, checkpoint_id: str) -> Any:
                captured["checkpoint_id"] = checkpoint_id
                return _loop_result()

        return _FakeLoop()

    monkeypatch.setattr(agents_mod, "_new_v2_loop", fake_new_v2_loop)

    result = await agents_mod._resume_run_from_checkpoint(
        "cp-cold",
        model=None,
        max_iterations=None,
        tools=None,
        request=_request(),
        current_user=USER,
        permission_mode=None,
        axis_resolution=axis_resolution,
    )
    assert result.success is True
    assert captured["checkpoint_id"] == "cp-cold"
    return captured


async def test_shared_resume_reads_profiles(monkeypatch: pytest.MonkeyPatch) -> None:
    _set_profiles(monkeypatch)

    captured = await _call_shared_resume(monkeypatch)

    _assert_profile_axis(captured["axis_resolution"])


async def test_shared_resume_explicit_axis_still_wins(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _set_profiles(monkeypatch)
    explicit = resolve_axis_resolution(sandbox_mode="danger-full-access")
    assert explicit is not None

    captured = await _call_shared_resume(monkeypatch, axis_resolution=explicit)

    axis = captured["axis_resolution"]
    assert axis is explicit
    assert axis.source is AxisSource.EXPLICIT
    assert axis.sandbox_mode == "danger-full-access"


async def test_shared_resume_without_profiles_is_unchanged(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _set_profiles(monkeypatch, "")

    captured = await _call_shared_resume(monkeypatch)

    assert captured["axis_resolution"] is None


# ---------------------------------------------------------------------------
# 两个 HTTP 出口共用:把 `_resume_run_from_checkpoint` / 存储换成替身
# ---------------------------------------------------------------------------


def _stub_shared_resume(monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    captured: dict[str, Any] = {}

    async def fake_resume(checkpoint_id: str, **kwargs: Any) -> Any:
        captured["checkpoint_id"] = checkpoint_id
        captured.update(kwargs)
        return _loop_result()

    monkeypatch.setattr(agents_mod, "_resume_run_from_checkpoint", fake_resume)
    return captured


def _stub_checkpoint_manager(monkeypatch: pytest.MonkeyPatch) -> None:
    """属主可判定为请求者本人(无 session_id ⇒ 不登记在飞归属)。"""

    class _Manager:
        async def load_checkpoint(self, checkpoint_id: str) -> Any:
            return SimpleNamespace(session_id=None, owner_user_id=USER)

    monkeypatch.setattr(
        agent_checkpoint, "get_agent_checkpoint_manager", lambda: _Manager()
    )


def _stub_session_control(monkeypatch: pytest.MonkeyPatch) -> None:
    """控制面替身:直接取 runner 跑一次并回 RESUMED。"""

    async def fake_resume_session(
        session_id: str, requester: str, *, runner: Any
    ) -> ResumeResult:
        checkpoint = SimpleNamespace(checkpoint_id="cp-session")
        result = await runner(checkpoint, requester)
        return ResumeResult(
            outcome=ResumeOutcome.RESUMED,
            changed=True,
            checkpoint_id="cp-session",
            result=result,
        )

    monkeypatch.setattr(agents_mod, "resume_session", fake_resume_session)


# ---------------------------------------------------------------------------
# 出口 2:`POST /agents/execute/resume`
# ---------------------------------------------------------------------------


async def test_execute_resume_endpoint_reads_profiles(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _set_profiles(monkeypatch)
    captured = _stub_shared_resume(monkeypatch)
    _stub_checkpoint_manager(monkeypatch)

    await agents_mod.resume_agent_execute(
        agents_mod.AgentResumeRequest(checkpoint_id="cp-http"),
        _request(),
        current_user=USER,
    )

    _assert_profile_axis(captured["axis_resolution"])


async def test_execute_resume_endpoint_explicit_axis_still_wins(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _set_profiles(monkeypatch)
    captured = _stub_shared_resume(monkeypatch)
    _stub_checkpoint_manager(monkeypatch)

    await agents_mod.resume_agent_execute(
        agents_mod.AgentResumeRequest(
            checkpoint_id="cp-http", sandbox_mode="danger-full-access"
        ),
        _request(),
        current_user=USER,
    )

    axis = captured["axis_resolution"]
    assert axis is not None
    assert axis.source is AxisSource.EXPLICIT
    assert axis.sandbox_mode == "danger-full-access"


async def test_execute_resume_endpoint_without_profiles_is_unchanged(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _set_profiles(monkeypatch, "")
    captured = _stub_shared_resume(monkeypatch)
    _stub_checkpoint_manager(monkeypatch)

    await agents_mod.resume_agent_execute(
        agents_mod.AgentResumeRequest(checkpoint_id="cp-http"),
        _request(),
        current_user=USER,
    )

    assert captured["axis_resolution"] is None


# ---------------------------------------------------------------------------
# 出口 3:`POST /agents/{session_id}/resume`
# ---------------------------------------------------------------------------


async def test_session_resume_endpoint_reads_profiles(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _set_profiles(monkeypatch)
    captured = _stub_shared_resume(monkeypatch)
    _stub_session_control(monkeypatch)

    await agents_mod.resume_agent_session(
        "session-http",
        agents_mod.AgentSessionResumeRequest(),
        _request(),
        current_user=USER,
    )

    _assert_profile_axis(captured["axis_resolution"])


async def test_session_resume_endpoint_explicit_axis_still_wins(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _set_profiles(monkeypatch)
    captured = _stub_shared_resume(monkeypatch)
    _stub_session_control(monkeypatch)

    await agents_mod.resume_agent_session(
        "session-http",
        agents_mod.AgentSessionResumeRequest(sandbox_mode="danger-full-access"),
        _request(),
        current_user=USER,
    )

    axis = captured["axis_resolution"]
    assert axis is not None
    assert axis.source is AxisSource.EXPLICIT
    assert axis.sandbox_mode == "danger-full-access"


async def test_session_resume_endpoint_without_profiles_is_unchanged(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _set_profiles(monkeypatch, "")
    captured = _stub_shared_resume(monkeypatch)
    _stub_session_control(monkeypatch)

    await agents_mod.resume_agent_session(
        "session-http",
        agents_mod.AgentSessionResumeRequest(),
        _request(),
        current_user=USER,
    )

    assert captured["axis_resolution"] is None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
