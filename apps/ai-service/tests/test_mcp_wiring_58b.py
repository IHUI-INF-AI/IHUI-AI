# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""批58:MCP 服务器侧接线测试(6 个模块)。

前 5 个模块(elicitation_pause / mcp_openai_file / world_state_tools /
permission_profiles / permissions_instructions)由并行 worker 接线,此处守住
"默认 off" 这条铁律;第 6 个 model_tools_57 由主会话接线,做完整四项验证。
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services import mcp_server as ms  # noqa: E402

SWITCHES = [
    ("MCP_ELICITATION_PAUSE_ENABLED", ms._mcp_elicitation_pause_enabled_from_env),
    ("MCP_OPENAI_FILE_REWRITE_ENABLED", ms._mcp_openai_file_rewrite_enabled_from_env),
    ("MCP_WORLD_STATE_TOOLS_ENABLED", ms._mcp_world_state_tools_enabled_from_env),
    ("MCP_PERMISSION_PROFILES_ENABLED", ms._mcp_permission_profiles_enabled_from_env),
    ("MCP_PERMISSIONS_INSTRUCTIONS_ENABLED", ms._mcp_permissions_instructions_enabled_from_env),
    ("MCP_MODEL_TOOLS_ENABLED", ms._mcp_model_tools_enabled_from_env),
]


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    for name, _fn in SWITCHES:
        monkeypatch.delenv(name, raising=False)


def test_all_switches_default_off():
    """铁律:所有开关默认 off(未设 env 时一律 False)。"""
    for name, fn in SWITCHES:
        assert fn() is False, f"{name} 默认必须 off"


@pytest.mark.parametrize("env_name,fn", SWITCHES, ids=[n for n, _ in SWITCHES])
def test_switch_on_values(monkeypatch, env_name, fn):
    """on/1/true/yes(大小写与空白容错)均视为启用。"""
    for v in ("on", "1", "true", "yes", "ON", " True ", "YES"):
        monkeypatch.setenv(env_name, v)
        assert fn() is True, f"{env_name}={v!r} 应视为 on"


@pytest.mark.parametrize("env_name,fn", SWITCHES, ids=[n for n, _ in SWITCHES])
def test_switch_invalid_values_are_off(monkeypatch, env_name, fn):
    """非法/空值一律按 off(绝不因拼写错误误开)。"""
    for v in ("", "0", "false", "no", "off", "maybe", "yes2"):
        monkeypatch.setenv(env_name, v)
        assert fn() is False, f"{env_name}={v!r} 应视为 off"


# ---------------------------------------------------------------------------
# model_tools_57:后台 sleep 时长校验
# ---------------------------------------------------------------------------


def test_model_tools_sleep_off_no_validation(monkeypatch):
    """off:不校验时长,短时长照常休眠并返回(与接线前一致)。"""
    assert ms._mcp_model_tools_enabled_from_env() is False
    out = asyncio.run(ms._bg_impl_sleep({"seconds": 0.01}))
    assert out == {"slept_seconds": 0.01}


def test_model_tools_sleep_on_rejects_out_of_range(monkeypatch):
    """on:越界时长立即返回 error,不进入休眠(不阻塞 worker)。"""
    monkeypatch.setenv("MCP_MODEL_TOOLS_ENABLED", "1")
    out = asyncio.run(ms._bg_impl_sleep({"seconds": 99999}))
    assert "error" in out
    assert out["slept_seconds"] == 0


def test_model_tools_sleep_on_accepts_valid(monkeypatch):
    """on:合法时长正常休眠。"""
    monkeypatch.setenv("MCP_MODEL_TOOLS_ENABLED", "1")
    out = asyncio.run(ms._bg_impl_sleep({"seconds": 0.01}))
    assert out == {"slept_seconds": 0.01}


def test_model_tools_sleep_exception_isolated(monkeypatch):
    """校验模块抛异常:降级照常休眠,绝不阻断后台任务。"""
    import app.core.model_tools_57 as mt

    monkeypatch.setenv("MCP_MODEL_TOOLS_ENABLED", "1")
    monkeypatch.setattr(mt, "validate_sleep_duration", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("boom")))
    out = asyncio.run(ms._bg_impl_sleep({"seconds": 0.01}))
    assert out == {"slept_seconds": 0.01}


# ---------------------------------------------------------------------------
# model_tools_57:完成通知 async 投递投影(background_tasks)
# ---------------------------------------------------------------------------


def test_bg_notification_projection_off(monkeypatch):
    """off:metadata 仅含既有两键。"""
    from app.services.background_tasks import _bg_model_tools_enabled_from_env

    assert _bg_model_tools_enabled_from_env() is False


def test_bg_notification_projection_on(monkeypatch, tmp_path):
    """on:metadata 额外带 async_notification 投影(codex AgentMessageItem 形态)。"""
    from app.services.background_tasks import _bg_model_tools_enabled_from_env

    monkeypatch.setenv("MCP_MODEL_TOOLS_ENABLED", "1")
    assert _bg_model_tools_enabled_from_env() is True

    from app.core.model_tools_57 import build_async_user_notification

    payload = build_async_user_notification("任务完成")
    assert payload["type"] == "agent_message"
    assert payload["delivery"] == "async"
    assert payload["phase"] == "final_answer"
    assert payload["content"][0]["text"] == "任务完成"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
