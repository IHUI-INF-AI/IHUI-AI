# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""配置驱动命令钩子(command_hooks)的接线锁。

钉住五条硬事实:
1. 未配置 = 空表(合法默认档);
2. 配置形状按契约校验(事件名 / MatcherGroup 双字段 / 仅 command 变体);
3. **未信任不加载**(fail-closed,不给"读不到就放行"的退化);
4. 信任后经既有 HookRuntime 真正执行:退出码 2 ⇒ PRE_TOOL_USE deny,
   JSON ``additionalContext`` ⇒ outcome.additional_contexts;
5. 登记幂等(同一内容重复装配不产生第二份执行)。
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

import pytest

from app.core import command_hooks
from app.core.command_hooks import (
    CommandHookError,
    install_command_hooks,
    load_command_hooks,
    trust_hooks_config,
)
from app.core.hook_runtime import (
    HookKind,
    build_registered_hook_runtime,
    clear_lifecycle_hook_registry,
)

pytestmark = pytest.mark.anyio


@pytest.fixture(autouse=True)
def _isolate(monkeypatch: pytest.MonkeyPatch) -> None:
    """每个用例前清登记表与安装去重键,避免跨用例串味。"""
    command_hooks._INSTALLED.clear()
    clear_lifecycle_hook_registry()
    monkeypatch.delenv("IHUI_HOOKS_CONFIG", raising=False)
    yield
    command_hooks._INSTALLED.clear()
    clear_lifecycle_hook_registry()


def _write_config(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


def _config(pre: list[dict]) -> dict:
    return {"hooks": {"pre_tool_use": [{"matcher": "*", "hooks": pre}]}}


def _script(tmp_path: Path, body: str) -> str:
    """把一段 Python 写成可执行钩子命令(用当前解释器,免 shell heredoc)。"""
    script = tmp_path / "hook_impl.py"
    script.write_text(body, encoding="utf-8")
    return f'"{sys.executable}" "{script}"'


BLOCK_BODY = """
import sys
data = sys.stdin.read()
sys.stderr.write("secret path blocked by policy")
sys.exit(2)
"""

CONTEXT_BODY = """
import json, sys
json.loads(sys.stdin.read())
json.dump({"hookSpecificOutput": {"hookEventName": "PreToolUse",
           "additionalContext": "仓库约定:先跑测试再改实现"}}, sys.stdout)
"""

ALLOW_BODY = """
import json, sys
json.loads(sys.stdin.read())
json.dump({"hookSpecificOutput": {"hookEventName": "PreToolUse",
           "permissionDecision": "allow"}}, sys.stdout)
"""


def test_missing_config_is_empty(tmp_path: Path) -> None:
    assert load_command_hooks(tmp_path / "absent.json") == []


def test_unknown_event_rejected(tmp_path: Path) -> None:
    path = tmp_path / "hooks.json"
    _write_config(path, {"hooks": {"pre_tool_use_typo": []}})
    with pytest.raises(CommandHookError):
        load_command_hooks(path)


def test_matcher_group_arity_enforced(tmp_path: Path) -> None:
    path = tmp_path / "hooks.json"
    _write_config(path, {"hooks": {"pre_tool_use": [{"matcher": "*"}]}})
    with pytest.raises(CommandHookError):
        load_command_hooks(path)


def test_non_command_variant_rejected(tmp_path: Path) -> None:
    path = tmp_path / "hooks.json"
    _write_config(
        path,
        {"hooks": {"pre_tool_use": [{"matcher": "*", "hooks": [{"type": "prompt", "command": "x"}]}]}},
    )
    with pytest.raises(CommandHookError):
        load_command_hooks(path)


def test_untrusted_config_is_not_loaded(tmp_path: Path) -> None:
    path = tmp_path / "hooks.json"
    _write_config(path, _config([{"type": "command", "command": "echo hi"}]))
    with pytest.raises(CommandHookError, match="未受信任"):
        load_command_hooks(path)


def test_trust_then_load_and_block(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    path = tmp_path / ".ihui" / "hooks.json"
    _write_config(path, _config([{"type": "command", "command": _script(tmp_path, BLOCK_BODY)}]))
    trust_hooks_config(path)
    monkeypatch.setenv("IHUI_HOOKS_CONFIG", str(path))

    specs = load_command_hooks()
    assert [s.event for s in specs] == ["pre_tool_use"]
    cleared = build_registered_hook_runtime()
    assert cleared.hooks_for(HookKind.PRE_TOOL_USE)  # 已装配

    outcome = asyncio.run(
        cleared.run(HookKind.PRE_TOOL_USE, {"tool_name": "write_file", "tool_call_id": "t1", "args": {}})
    )
    assert outcome.denial_reason == "secret path blocked by policy"
    assert outcome.events and outcome.events[0].status == "ok"


def test_additional_context_flows_through_runtime(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    path = tmp_path / ".ihui" / "hooks.json"
    _write_config(path, _config([{"type": "command", "command": _script(tmp_path, CONTEXT_BODY)}]))
    trust_hooks_config(path)
    monkeypatch.setenv("IHUI_HOOKS_CONFIG", str(path))
    runtime = build_registered_hook_runtime()
    outcome = asyncio.run(runtime.run(HookKind.PRE_TOOL_USE, {"tool_name": "apply_patch"}))
    assert outcome.denial_reason is None
    assert outcome.additional_contexts == ["仓库约定:先跑测试再改实现"]


def test_matcher_mismatch_does_not_run(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    path = tmp_path / ".ihui" / "hooks.json"
    _write_config(
        path,
        {"hooks": {"pre_tool_use": [{"matcher": "run_command", "hooks": [
            {"type": "command", "command": _script(tmp_path, BLOCK_BODY)}
        ]}]}},
    )
    trust_hooks_config(path)
    monkeypatch.setenv("IHUI_HOOKS_CONFIG", str(path))
    runtime = build_registered_hook_runtime()
    outcome = asyncio.run(runtime.run(HookKind.PRE_TOOL_USE, {"tool_name": "write_file"}))
    assert outcome.denial_reason is None


def test_install_is_idempotent(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    path = tmp_path / ".ihui" / "hooks.json"
    _write_config(path, _config([{"type": "command", "command": "echo hi"}]))
    trust_hooks_config(path)
    monkeypatch.setenv("IHUI_HOOKS_CONFIG", str(path))
    assert install_command_hooks() == 1
    assert install_command_hooks() == 0


def test_permission_request_behavior_mapping(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """PermissionRequest 是嵌套 decision.behavior(不是扁平键),映射要逐字对上。"""
    body = """
import json, sys
json.loads(sys.stdin.read())
json.dump({"hookSpecificOutput": {"hookEventName": "PermissionRequest",
           "decision": {"behavior": "deny", "message": "策略拒绝"}}}, sys.stdout)
"""
    path = tmp_path / ".ihui" / "hooks.json"
    _write_config(
        path,
        {
            "hooks": {
                "permission_request": [
                    {"matcher": "*", "hooks": [{"type": "command", "command": _script(tmp_path, body)}]}
                ]
            }
        },
    )
    trust_hooks_config(path)
    monkeypatch.setenv("IHUI_HOOKS_CONFIG", str(path))
    runtime = build_registered_hook_runtime()
    outcome = asyncio.run(runtime.run(HookKind.PERMISSION_REQUEST, {"tool_name": "run_command"}))
    assert outcome.permission_behavior == "deny"
    assert outcome.denial_reason == "策略拒绝"


def test_permission_allow_is_transparent_not_faked(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """allow 只透出字段,不得被伪造成"钩子已放行"的运行时判定。"""
    path = tmp_path / ".ihui" / "hooks.json"
    _write_config(path, _config([{"type": "command", "command": _script(tmp_path, ALLOW_BODY)}]))
    trust_hooks_config(path)
    monkeypatch.setenv("IHUI_HOOKS_CONFIG", str(path))
    runtime = build_registered_hook_runtime()
    outcome = asyncio.run(runtime.run(HookKind.PRE_TOOL_USE, {"tool_name": "write_file"}))
    assert outcome.denial_reason is None
    assert outcome.additional_contexts == []
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
