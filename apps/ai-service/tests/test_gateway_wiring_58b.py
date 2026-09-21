# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""批58:LLM 网关侧 + 命令执行侧接线测试(网关 3 模块 + 执行 2 模块)。

覆盖纪律(每个模块 4 项):
1. off 零差异 —— 与接线前逐字节等价;
2. on 生效    —— 能力真实产出;
3. 异常隔离   —— 模块抛异常时主流程照常;
4. 非法 env   —— 非 on/1/true/yes 一律按 off。
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core import llm_gateway as gw  # noqa: E402
from app.services import sandbox as sb  # noqa: E402

ON = ("on", "1", "true", "yes")


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    """每个用例前清掉相关 env,保证 off 基线干净。"""
    for k in (
        "LLM_RESPONSES_HEADERS_ENABLED",
        "LLM_RESPONSES_ASSEMBLY_ENABLED",
        "LLM_PROVIDER_CONFIG_ENABLED",
        "LLM_CODEX_BETA_FEATURES",
        "LLM_CODEX_TURN_STATE",
        "LLM_CONCURRENT_REASONING_SUMMARIES",
        "EXEC_SHELL_DETECT_ENABLED",
        "EXEC_CAPTURE_POLICY_ENABLED",
        "EXEC_CAPTURE_POLICY",
    ):
        monkeypatch.delenv(k, raising=False)


# ---------------------------------------------------------------------------
# 模块1 responses_headers
# ---------------------------------------------------------------------------


def test_responses_headers_off_zero_diff(monkeypatch):
    """off:不注入任何头,call_kwargs 与接线前一致。"""
    assert gw._llm_responses_headers_enabled_from_env() is False
    kw = {"model": "openai/gpt-4o", "messages": [], "extra_headers": {"X-A": "1"}}
    before = dict(kw)
    gw._apply_responses_headers(kw)
    assert kw == before


def test_responses_headers_on_merges(monkeypatch):
    """on:合并 beta 特性头与 turn-state 头,且不覆盖既有头。"""
    monkeypatch.setenv("LLM_RESPONSES_HEADERS_ENABLED", "1")
    monkeypatch.setenv("LLM_CODEX_BETA_FEATURES", "a, b")
    monkeypatch.setenv("LLM_CODEX_TURN_STATE", "ts-1")
    kw = {"model": "openai/gpt-4o", "messages": [], "extra_headers": {"X-Keep": "v"}}
    gw._apply_responses_headers(kw)
    headers = kw["extra_headers"]
    assert headers["X-Keep"] == "v"
    assert headers["x-codex-beta-features"] == "a,b"
    assert headers["x-codex-turn-state"] == "ts-1"


def test_responses_headers_exception_isolated(monkeypatch):
    """模块抛异常:不注入头、不冒泡。"""
    import app.core.responses_headers as rh

    monkeypatch.setenv("LLM_RESPONSES_HEADERS_ENABLED", "1")
    monkeypatch.setattr(rh, "build_responses_headers", lambda **kw: (_ for _ in ()).throw(RuntimeError("boom")))
    kw = {"model": "openai/gpt-4o", "messages": []}
    gw._apply_responses_headers(kw)  # 不得抛出
    assert "extra_headers" not in kw


def test_responses_headers_invalid_env_is_off(monkeypatch):
    """非法 env 值按 off。"""
    for v in ("", "0", "false", "OFF", "yes please", " true "):
        monkeypatch.setenv("LLM_RESPONSES_HEADERS_ENABLED", v)
        if v.strip().lower() in ON:
            assert gw._llm_responses_headers_enabled_from_env() is True
        else:
            assert gw._llm_responses_headers_enabled_from_env() is False


# ---------------------------------------------------------------------------
# 模块2 responses_request_assembly
# ---------------------------------------------------------------------------


def test_stream_options_off_zero_diff(monkeypatch):
    """off:不追加 stream_options。"""
    assert gw._llm_responses_assembly_enabled_from_env() is False
    kw = {"model": "openai/gpt-4o", "messages": [], "reasoning_effort": "high"}
    before = dict(kw)
    gw._apply_responses_stream_options(kw)
    assert kw == before


def test_stream_options_on_three_conditions(monkeypatch):
    """on 且三条件齐备:产出 sequential_cutoff 流选项。"""
    monkeypatch.setenv("LLM_RESPONSES_ASSEMBLY_ENABLED", "true")
    monkeypatch.setenv("LLM_CONCURRENT_REASONING_SUMMARIES", "1")
    kw = {"model": "openai/gpt-4o", "messages": [], "reasoning_effort": "high"}
    gw._apply_responses_stream_options(kw)
    assert kw["stream_options"] == {"reasoning_summary_delivery": "sequential_cutoff"}


def test_stream_options_non_openai_none(monkeypatch):
    """非 OpenAI 系模型不产出(条件不齐备)。"""
    monkeypatch.setenv("LLM_RESPONSES_ASSEMBLY_ENABLED", "1")
    monkeypatch.setenv("LLM_CONCURRENT_REASONING_SUMMARIES", "1")
    kw = {"model": "anthropic/claude-3", "messages": [], "reasoning_effort": "high"}
    gw._apply_responses_stream_options(kw)
    assert "stream_options" not in kw


def test_stream_options_exception_isolated(monkeypatch):
    """模块抛异常:不追加、不冒泡。"""
    import app.core.responses_request_assembly as ra

    monkeypatch.setenv("LLM_RESPONSES_ASSEMBLY_ENABLED", "1")
    monkeypatch.setattr(ra, "build_stream_options", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("boom")))
    kw = {"model": "openai/gpt-4o", "messages": []}
    gw._apply_responses_stream_options(kw)  # 不得抛出
    assert "stream_options" not in kw


# ---------------------------------------------------------------------------
# 模块3 provider_config
# ---------------------------------------------------------------------------


def test_provider_config_off_is_off(monkeypatch):
    """off:开关判定为 False(调用方走原样透传分支)。"""
    assert gw._llm_provider_config_enabled_from_env() is False


def test_provider_config_on_strips_trailing_slash(monkeypatch):
    """on:api_base 末尾斜杠被归一(避免 //v1 双斜杠)。"""
    monkeypatch.setenv("LLM_PROVIDER_CONFIG_ENABLED", "1")
    assert gw._normalize_provider_api_base("https://api.example.com/v1/") == "https://api.example.com/v1"
    assert gw._normalize_provider_api_base("https://api.example.com/v1") == "https://api.example.com/v1"
    assert gw._normalize_provider_api_base(None) is None


def test_provider_config_exception_isolated(monkeypatch):
    """校验失败:降级返回原值,绝不改坏地址。"""
    import app.core.provider_config as pc

    class Boom:
        def __init__(self, **kw):
            raise RuntimeError("boom")

    monkeypatch.setattr(pc, "ProviderConfig", Boom)
    assert gw._normalize_provider_api_base("https://keep.me/v1/") == "https://keep.me/v1/"


def test_provider_config_invalid_env_is_off(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER_CONFIG_ENABLED", "maybe")
    assert gw._llm_provider_config_enabled_from_env() is False


# ---------------------------------------------------------------------------
# 模块4 shell_detect(命令执行层)
# ---------------------------------------------------------------------------


def test_shell_detect_off_returns_none(monkeypatch):
    """off:返回 None(调用方回落 create_subprocess_shell,逐字节等价)。"""
    assert sb._exec_shell_detect_enabled_from_env() is False
    assert sb._derive_windows_exec_args("echo hi") is None


def test_shell_detect_on_derives_argv(monkeypatch):
    """on:派生显式 argv(cmd.exe /c <command>)。"""
    monkeypatch.setenv("EXEC_SHELL_DETECT_ENABLED", "yes")
    argv = sb._derive_windows_exec_args("echo hi")
    assert argv is not None
    assert len(argv) == 3
    assert argv[1] == "/c"
    assert argv[2] == "echo hi"


def test_shell_detect_exception_isolated(monkeypatch):
    """派生失败:回落 None,绝不阻塞命令执行。"""
    import app.core.shell_detect as sd

    monkeypatch.setenv("EXEC_SHELL_DETECT_ENABLED", "1")
    monkeypatch.setattr(sd, "derive_exec_args", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("boom")))
    assert sb._derive_windows_exec_args("echo hi") is None


def test_shell_detect_invalid_env_is_off(monkeypatch):
    monkeypatch.setenv("EXEC_SHELL_DETECT_ENABLED", "TRUE?")
    assert sb._exec_shell_detect_enabled_from_env() is False


# ---------------------------------------------------------------------------
# 模块5 exec_params(输出捕获策略)
# ---------------------------------------------------------------------------


def test_exec_capture_policy_off_is_off(monkeypatch):
    assert sb._exec_capture_policy_enabled_from_env() is False


def test_exec_capture_policy_on_truncates(monkeypatch):
    """on:超上限输出被截断并留标记;档位无上限时原样返回。"""
    monkeypatch.setenv("EXEC_CAPTURE_POLICY_ENABLED", "1")
    big = "x" * (2 * 1024 * 1024)  # 超过 ShellTool 档位 1MiB 上限
    out, err = sb._apply_exec_capture_policy(big, "e" * 10)
    assert len(out) < len(big)
    assert "截断" in out

    monkeypatch.setenv("EXEC_CAPTURE_POLICY", "full_buffer")
    out2, err2 = sb._apply_exec_capture_policy(big, "e")
    assert out2 == big


def test_exec_capture_policy_exception_isolated(monkeypatch):
    """策略应用失败:原样返回,绝不吞掉输出。"""
    import app.core.exec_params as ep

    class Boom:
        def __init__(self, v):
            raise RuntimeError("boom")

    monkeypatch.setenv("EXEC_CAPTURE_POLICY_ENABLED", "1")
    monkeypatch.setattr(ep, "ExecCapturePolicy", Boom)
    assert sb._apply_exec_capture_policy("keep", "keep") == ("keep", "keep")


def test_exec_capture_policy_invalid_value_isolated(monkeypatch):
    """非法档位值:降级原样返回。"""
    monkeypatch.setenv("EXEC_CAPTURE_POLICY_ENABLED", "1")
    monkeypatch.setenv("EXEC_CAPTURE_POLICY", "not-a-policy")
    assert sb._apply_exec_capture_policy("keep", "keep") == ("keep", "keep")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
