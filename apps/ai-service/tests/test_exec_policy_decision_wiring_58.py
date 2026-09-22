# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""批58(十五):危险命令拦截回执的审批决策矩阵接线测试(对标 codex exec_policy.rs)。"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from app.services.agent_engine import _unmatched_command_decision_meta  # noqa: E402


def test_unconfigured_policy_maps_to_on_request_prompt():
    meta = _unmatched_command_decision_meta({}, "unified_exec")
    assert meta["approval_policy"] == "on_request"
    assert meta["decision"] == "prompt"
    assert "policy_reason" not in meta


def test_never_policy_yields_forbidden_with_codex_reason():
    meta = _unmatched_command_decision_meta({"unified_exec": "never"}, "unified_exec")
    assert meta["approval_policy"] == "never"
    assert meta["decision"] == "forbidden"
    assert meta["policy_reason"] == (
        "approval required by policy, but AskForApproval is set to Never"
    )


def test_always_policy_maps_to_unless_trusted_prompt():
    meta = _unmatched_command_decision_meta({"unified_exec": "always"}, "unified_exec")
    assert meta["approval_policy"] == "unless_trusted"
    assert meta["decision"] == "prompt"


def test_on_request_policy_prompt():
    meta = _unmatched_command_decision_meta({"unified_exec": "on-request"}, "unified_exec")
    assert meta["approval_policy"] == "on_request"
    assert meta["decision"] == "prompt"


def test_wildcard_policy_applies():
    meta = _unmatched_command_decision_meta({"*": "never"}, "unified_exec")
    assert meta["decision"] == "forbidden"


def test_per_tool_overrides_wildcard():
    meta = _unmatched_command_decision_meta(
        {"*": "never", "unified_exec": "on-request"}, "unified_exec"
    )
    assert meta["decision"] == "prompt"


def test_dangerous_never_yields_allow_never():
    """危险命令恒不得 allow(矩阵不放松拦截)。"""
    for policies in ({}, {"*": "never"}, {"*": "always"}, {"*": "on-request"}):
        meta = _unmatched_command_decision_meta(policies, "unified_exec")
        assert meta["decision"] in ("prompt", "forbidden")


def test_unknown_policy_value_degrades_to_on_request():
    meta = _unmatched_command_decision_meta({"unified_exec": "weird"}, "unified_exec")
    assert meta["approval_policy"] == "on_request"


def test_exception_path_returns_empty(monkeypatch):
    """异常路径返回空 dict(回执与接线前逐零差异)。"""
    import app.services.agent_engine as engine

    def _boom(*_args, **_kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr(engine, "_resolve_approval_policy", _boom)
    assert _unmatched_command_decision_meta({"a": "never"}, "unified_exec") == {}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
