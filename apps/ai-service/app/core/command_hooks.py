# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""配置驱动的命令钩子(代码级 HookRuntime 的配置面)。

取证来源:`codex_hook_config_contract`(事件名 14 项 / MatcherGroup 双字段 /
HANDLER_VARIANTS=Command,Prompt,Agent,McpTool / trust gate
`--dangerously-bypass-hook-trust` / `hooks.state.trusted_content_hash`)与
`hook_definition_contract`(PreToolUseHookSpecificOutputWire 的
permissionDecision/additionalContext/reason 字段面)。

本模块只补**缺失的那一格**,不新造运行时:

- 运行时仍是 ``hook_runtime.HookRuntime``(执行、超时、失败隔离、事件审计、
  PRE_TOOL_USE deny 与 additional_context 消费都在既有链路上,agent_loop_v2
  已装车);
- 本模块新增的只是「配置文件 → 可调用钩子」的**生产者**:读 ``.ihui/hooks.json``,
  **信任闸**要求内容哈希被显式登记在 ``.ihui/hooks-trust.json``(对齐
  ``trusted_content_hash``),未登记一律不加载(fail-closed,不退化成"读不到就
  放行");
- 只实现 ``command`` 变体(其余三种变体在本仓无执行语义,登记为不支持而不是
  假装能跑);
- 未配置/未信任 ⇒ 零钩子,``build_registered_hook_runtime()`` 行为与接线前逐零
  等价(这是本模块唯一的默认档)。

命令钩子合约(与本仓既有消费面同形):

- stdin: 一行 JSON ``{"hook_event_name","tool_name","tool_call_id","args",
  "session_id","cwd"}``;
- 退出码 **2** = 拒绝(对齐 Codex block 语义),stderr 首行作 reason;
- 退出码 0 且 stdout 是 JSON ⇒ 支持
  ``{"decision":"deny","reason":...}`` 与
  ``{"hookSpecificOutput":{"additionalContext":...,"permissionDecision":
  "allow|deny|ask"}}``;
- 其他退出码/解析失败 ⇒ 抛错,由 HookRuntime 记 error 事件并隔离(不改判定)。
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import hmac
import json
import logging
import os
import re
import sys
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Final

from .codex_hook_config_contract import (
    HANDLER_TOML_TYPE_VALUES,
    HANDLER_TYPE_FIELD,
    HANDLER_VARIANTS,
    MATCHER_GROUP_ARITY,
    MATCHER_GROUP_FIELDS,
    MATCHER_WILDCARD,
    is_event,
)
from .hook_runtime import (
    DEFAULT_HOOK_TIMEOUT_SECS,
    HookFunc,
    HookKind,
    register_lifecycle_hook,
)

__all__ = [
    "HOOKS_CONFIG_REL",
    "HOOKS_TRUST_REL",
    "CommandHookError",
    "CommandHookSpec",
    "load_command_hooks",
    "describe_command_hooks",
    "install_command_hooks",
    "trust_hooks_config",
    "hooks_content_hash",
]

logger = logging.getLogger(__name__)

HOOKS_CONFIG_REL: Final = ".ihui/hooks.json"
HOOKS_TRUST_REL: Final = ".ihui/hooks-trust.json"
# 命令变体在本仓的唯一执行类型(其余三种变体不支持)。
_EXECUTABLE_VARIANT: Final = "command"
# 已安装过的「(事件, 内容哈希)」去重键:登记表是进程级,重复 install 会让同一
# 命令在一次工具调用里跑 N 遍(幂等是本模块的硬要求)。
_INSTALLED: set[tuple[str, str]] = set()
_NAME_PREFIX: Final = "command:"


class CommandHookError(ValueError):
    """配置形状/信任状态不成立时抛错(调用方据此落"未判定")。"""


@dataclass(frozen=True)
class CommandHookSpec:
    """一条已通过形状校验的命令钩子(尚未信任判定)。"""

    event: str
    matcher: str
    command: str
    timeout: float
    name: str


def _default_config_path() -> Path:
    """默认配置位:``<apps/ai-service>/.ihui/hooks.json``。

    env ``IHUI_HOOKS_CONFIG`` 可整体改路径(必须指向文件)。取不到 = 未配置,
    不是"未判定" —— 零配置是本功能的合法默认档。
    """
    override = os.environ.get("IHUI_HOOKS_CONFIG")
    if override:
        return Path(override).expanduser()
    # app/core/command_hooks.py → parents[2] = apps/ai-service
    return Path(__file__).resolve().parents[2] / HOOKS_CONFIG_REL


def hooks_content_hash(data: bytes) -> str:
    """内容哈希(sha256 hex) —— 信任判定的唯一锚点,对齐 trusted_content_hash。"""
    return hashlib.sha256(data).hexdigest()


def _trust_path(config_path: Path) -> Path:
    return config_path.parent / Path(HOOKS_TRUST_REL).name


def _split_event_table(raw: Mapping[str, Any]) -> Mapping[str, Any]:
    """接受两种形状:``{"hooks": {...}}`` 或事件表直接作顶层。"""
    hooks = raw.get("hooks")
    if isinstance(hooks, Mapping):
        return hooks
    return raw


def _iter_groups(table: Mapping[str, Any]) -> list[tuple[str, Mapping[str, Any]]]:
    """展开 (事件, MatcherGroup);事件名与组形状都按契约校验。"""
    out: list[tuple[str, Mapping[str, Any]]] = []
    for event, groups in table.items():
        if event == "hooks":  # 兼容外壳字段混在同一层
            continue
        if not isinstance(event, str) or not is_event(event):
            raise CommandHookError(f"未登记 hook 事件名: {event!r}")
        if not isinstance(groups, list):
            raise CommandHookError(f"事件 {event} 的 matcher 组必须是数组")
        for group in groups:
            if not isinstance(group, Mapping):
                raise CommandHookError(f"事件 {event} 的 matcher 组必须是对象")
            keys = tuple(group.keys())
            if len(keys) != MATCHER_GROUP_ARITY or set(keys) != set(MATCHER_GROUP_FIELDS):
                raise CommandHookError(
                    f"事件 {event} 的 matcher 组字段必须恰为 {MATCHER_GROUP_FIELDS}"
                )
            out.append((event, group))
    return out


def _parse_specs(raw: Mapping[str, Any]) -> list[CommandHookSpec]:
    specs: list[CommandHookSpec] = []
    for event, group in _iter_groups(_split_event_table(raw)):
        matcher = group.get("matcher")
        if not isinstance(matcher, str) or not matcher:
            raise CommandHookError(f"事件 {event} 的 matcher 必须是非空字符串")
        handlers = group.get("hooks")
        if not isinstance(handlers, list):
            raise CommandHookError(f"事件 {event} 的 hooks 必须是数组")
        for index, handler in enumerate(handlers):
            if not isinstance(handler, Mapping):
                raise CommandHookError(f"事件 {event} 的 handler 必须是对象")
            variant = handler.get(HANDLER_TYPE_FIELD)
            # 配置面写 TOML 值(小写 command/prompt/...),契约表给的是 Pascal 名;
            # 两侧都接受,免得"照着契约写"反而被拒。
            normalised = (
                variant.lower()
                if isinstance(variant, str) and variant in HANDLER_VARIANTS
                else variant
            )
            if isinstance(variant, str) and variant in HANDLER_TOML_TYPE_VALUES:
                normalised = variant
            if normalised not in HANDLER_TOML_TYPE_VALUES:
                raise CommandHookError(
                    f"事件 {event} 的 handler 变体必须是 {HANDLER_TOML_TYPE_VALUES} 之一"
                )
            if normalised != _EXECUTABLE_VARIANT:
                # 不假装能跑:非命令变体在本仓没有执行语义,明确的"不支持"优于
                # 静默跳过(静默会被读成"已启用但没生效")。
                raise CommandHookError(
                    f"handler 变体 {variant!r} 本仓不支持(仅 command)"
                )
            command = handler.get("command")
            if not isinstance(command, str) or not command.strip():
                raise CommandHookError(f"事件 {event} 第 {index} 个 handler 缺 command")
            timeout_raw = handler.get("timeout")
            timeout = DEFAULT_HOOK_TIMEOUT_SECS
            if timeout_raw is not None:
                if not isinstance(timeout_raw, (int, float)) or timeout_raw <= 0:
                    raise CommandHookError(f"事件 {event} 的 timeout 必须是正数")
                timeout = float(timeout_raw)
            specs.append(
                CommandHookSpec(
                    event=event,
                    matcher=matcher,
                    command=command,
                    timeout=timeout,
                    name=f"{_NAME_PREFIX}{event}:{index}",
                )
            )
    return specs


def _read_trusted_hash(trust_path: Path) -> str | None:
    if not trust_path.exists():
        return None
    try:
        data = json.loads(trust_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise CommandHookError(f"信任文件不可读: {exc}") from exc
    if not isinstance(data, Mapping):
        raise CommandHookError("信任文件必须是对象")
    value = data.get("trusted_content_hash")
    return value if isinstance(value, str) and value else None


def load_command_hooks(config_path: Path | None = None) -> list[CommandHookSpec]:
    """读配置并通过形状/信任两道闸;任一不成立抛 ``CommandHookError``。

    未配置(文件不存在)返回空表 —— 这是合法默认档,不是错误。
    """
    path = config_path or _default_config_path()
    if not path.exists():
        return []
    try:
        raw_bytes = path.read_bytes()
    except OSError as exc:
        raise CommandHookError(f"钩子配置不可读: {exc}") from exc
    try:
        raw = json.loads(raw_bytes)
    except json.JSONDecodeError as exc:
        raise CommandHookError(f"钩子配置不是合法 JSON: {exc}") from exc
    if not isinstance(raw, Mapping):
        raise CommandHookError("钩子配置顶层必须是对象")
    specs = _parse_specs(raw)
    if not specs:
        return []
    trusted = _read_trusted_hash(_trust_path(path))
    current = hooks_content_hash(raw_bytes)
    # compare_digest 只为消除"前缀相等即通过"的时序面;值本身不是秘密。
    if not trusted or not hmac.compare_digest(trusted, current):
        raise CommandHookError(
            "钩子配置未受信任(内容哈希未登记): "
            f"trusted={trusted or 'none'} current={current}"
        )
    return specs


def _describe_spec(spec: CommandHookSpec) -> dict[str, Any]:
    """把一条钩子压成**可展示的元信息**,刻意不带完整命令行。

    配置是进程级全局文件(不是某个用户的私有数据),而读面只要求登录——
    完整 argv 可能带令牌/私有路径,展示给所有登录用户就是把一份可能的凭据
    面复制到第二个位置。展示面只给"能认领是哪一条"的信息:事件、matcher、
    超时、可执行文件名、参数个数;要看全文去读本机配置(与写它的权限同级)。
    """
    tokens = spec.command.split()
    exe = Path(tokens[0]).name if tokens else ""
    return {
        "name": spec.name,
        "event": spec.event,
        "matcher": spec.matcher,
        "timeout": spec.timeout,
        "command_preview": exe[:40],
        "arg_count": max(len(tokens) - 1, 0),
    }


def describe_command_hooks(config_path: Path | None = None) -> dict[str, Any]:
    """只读自述钩子配置面(不执行、不信任、不改盘)。

    存在的意义:配置面此前只有"跑起来才发现没生效"这一条观测路径 ——
    文件没建 / JSON 写坏 / 哈希没登记(未受信任)/ 空表,四种结局在运行时
    都表现为"钩子没跑",用户无从区分。本函数把这四态显式化,并复用
    ``_parse_specs`` / ``_read_trusted_hash`` / ``hooks_content_hash``
    (单一真相源,不另写一套判据)。

    ``status``: ``not-configured`` / ``empty`` / ``invalid`` / ``untrusted`` /
    ``trusted``。**任何输入都不抛错** —— 自述面失败不能把调用方拖红。
    """
    path = config_path or _default_config_path()
    info: dict[str, Any] = {
        "configured": False,
        "config_path": str(path),
        "status": "not-configured",
        "error": None,
        "content_hash": None,
        "trusted_hash": None,
        "specs": [],
    }
    if not path.exists():
        return info
    info["configured"] = True
    try:
        raw_bytes = path.read_bytes()
    except OSError as exc:
        info.update(status="invalid", error=f"钩子配置不可读: {exc}")
        return info
    info["content_hash"] = hooks_content_hash(raw_bytes)
    try:
        raw = json.loads(raw_bytes)
    except json.JSONDecodeError as exc:
        info.update(status="invalid", error=f"钩子配置不是合法 JSON: {exc}")
        return info
    if not isinstance(raw, Mapping):
        info.update(status="invalid", error="钩子配置顶层必须是对象")
        return info
    try:
        specs = _parse_specs(raw)
    except CommandHookError as exc:
        info.update(status="invalid", error=str(exc))
        return info
    info["specs"] = [_describe_spec(spec) for spec in specs]
    if not specs:
        info["status"] = "empty"
        return info
    try:
        trusted = _read_trusted_hash(_trust_path(path))
    except CommandHookError as exc:
        info.update(status="invalid", error=str(exc))
        return info
    info["trusted_hash"] = trusted
    ok = bool(trusted) and hmac.compare_digest(trusted, info["content_hash"])
    info["status"] = "trusted" if ok else "untrusted"
    if not ok:
        info["error"] = "钩子配置未受信任(内容哈希未登记): 改动后需重新登记信任"
    return info


def trust_hooks_config(config_path: Path | None = None) -> str:
    """把当前配置内容登记为受信任(写 ``.ihui/hooks-trust.json``)。

    这是**显式的用户动作**:内容一改哈希就变,旧信任自动失效(不做"信任整目录")。
    """
    path = config_path or _default_config_path()
    raw_bytes = path.read_bytes()
    digest = hooks_content_hash(raw_bytes)
    trust_path = _trust_path(path)
    trust_path.parent.mkdir(parents=True, exist_ok=True)
    trust_path.write_text(
        json.dumps({"trusted_content_hash": digest}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return digest


def _matcher_matches(matcher: str, tool_name: str) -> bool:
    """``*`` 全匹配;否则按正则 fullmatch(非法正则退化为逐字等值)。"""
    if matcher == MATCHER_WILDCARD:
        return True
    try:
        return re.fullmatch(matcher, tool_name) is not None
    except re.error:
        return matcher == tool_name


def _build_func(spec: CommandHookSpec, cwd: Path) -> HookFunc:
    async def _hook(payload: dict[str, Any]) -> dict[str, Any] | None:
        tool_name = str(payload.get("tool_name") or "")
        if tool_name and not _matcher_matches(spec.matcher, tool_name):
            return None
        stdin_payload = {
            "hook_event_name": spec.event,
            "tool_name": tool_name,
            "tool_call_id": payload.get("tool_call_id"),
            "args": payload.get("args"),
            "session_id": payload.get("session_id"),
            "cwd": str(cwd),
        }
        proc = await asyncio.create_subprocess_shell(
            spec.command,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=str(cwd),
            env={**os.environ, "IHUI_HOOK_EVENT": spec.event},
        )
        stdout_b, stderr_b = await proc.communicate(
            json.dumps(stdin_payload, ensure_ascii=False).encode("utf-8")
        )
        stdout = stdout_b.decode("utf-8", errors="replace").strip()
        stderr = stderr_b.decode("utf-8", errors="replace").strip()
        if proc.returncode == 2:
            reason = stderr.splitlines()[0] if stderr else f"hook {spec.name} blocked"
            return {"decision": "deny", "reason": reason}
        if proc.returncode != 0:
            raise CommandHookError(
                f"钩子 {spec.name} 退出码 {proc.returncode}: {stderr[:400] or stdout[:400]}"
            )
        if not stdout:
            return None
        try:
            parsed = json.loads(stdout)
        except json.JSONDecodeError as exc:
            raise CommandHookError(f"钩子 {spec.name} stdout 不是 JSON: {exc}") from exc
        if not isinstance(parsed, Mapping):
            raise CommandHookError(f"钩子 {spec.name} stdout 必须是 JSON 对象")
        out: dict[str, Any] = {}
        decision = parsed.get("decision")
        if isinstance(decision, str) and decision:
            out["decision"] = decision
        reason_raw = parsed.get("reason")
        if isinstance(reason_raw, str) and reason_raw:
            out["reason"] = reason_raw
        # 2026-11-20 第 28 项:STOP 点的 `decision: "block"` / `continue: true` 是
        # "别停,按 reason 再想一轮"的语义。HookRuntime._absorb 只认 `stop` 键,
        # 故在生产者这层做一次显式翻译(不让消费端去猜两种方言)。
        if spec.event == HookKind.STOP.value:
            if out.get("decision") == "block" or parsed.get("continue") is True:
                out["stop"] = True
                out["stop_reason"] = out.get("reason") or f"hook {spec.name} 要求继续"
        specific = parsed.get("hookSpecificOutput")
        if isinstance(specific, Mapping):
            ctx = specific.get("additionalContext")
            if isinstance(ctx, str) and ctx:
                out["additional_context"] = ctx
            perm = specific.get("permissionDecision")
            if isinstance(perm, str) and perm in ("allow", "deny", "ask"):
                # HookRuntime 只消费 deny/上下文;allow/ask 以字段透出,不在此伪造放行。
                out["permission_decision"] = perm
                if perm == "deny" and "decision" not in out:
                    out["decision"] = "deny"
            perm_reason = specific.get("permissionDecisionReason")
            if isinstance(perm_reason, str) and perm_reason and "reason" not in out:
                out["reason"] = perm_reason
            # PostToolUse 的产出改写面(契约字段 updatedMCPToolOutput):写进运行时
            # 消费侧认的键;给了 null 也是"显式替换为空",不能当未提供。
            if "updatedMCPToolOutput" in specific:
                out["updated_output"] = specific["updatedMCPToolOutput"]
            # PreToolUse 的入参改写面(契约字段 updatedInput):只对本仓支持的
            # 对象形状透出,非对象由运行时侧再拒一次。
            if "updatedInput" in specific:
                out["updated_input"] = specific["updatedInput"]
            # PermissionRequest 的裁决在 hookSpecificOutput.decision 内层
            # (PermissionRequestHookSpecificOutputWire),不是顶层键。
            _pr_decision = specific.get("decision")
            if isinstance(_pr_decision, Mapping):
                _behavior = _pr_decision.get("behavior")
                if isinstance(_behavior, str) and _behavior in ("allow", "deny"):
                    out["permission_behavior"] = _behavior
                    _msg = _pr_decision.get("message")
                    if isinstance(_msg, str) and _msg and "reason" not in out:
                        out["reason"] = _msg
        # PermissionRequest 的审批裁决面(契约 PermissionRequestHookSpecificOutputWire
        # 的 decision.behavior;形状是嵌套对象,不是扁平键)。
        nested = parsed.get("decision")
        if isinstance(nested, Mapping):
            behavior = nested.get("behavior")
            if isinstance(behavior, str) and behavior in ("allow", "deny"):
                out["permission_behavior"] = behavior
                message_raw = nested.get("message")
                if isinstance(message_raw, str) and message_raw and "reason" not in out:
                    out["reason"] = message_raw
        return out or None

    _hook.__name__ = spec.name.replace(":", "_").replace("-", "_")
    return _hook


_KIND_BY_EVENT: Final[dict[str, HookKind]] = {
    "pre_tool_use": HookKind.PRE_TOOL_USE,
    "post_tool_use": HookKind.POST_TOOL_USE,
    "permission_request": HookKind.PERMISSION_REQUEST,
    "session_start": HookKind.SESSION_START,
    "user_prompt_submit": HookKind.USER_PROMPT_SUBMIT,
    "pre_compact": HookKind.PRE_COMPACT,
    "post_compact": HookKind.POST_COMPACT,
    "stop": HookKind.STOP,
}


def install_command_hooks(config_path: Path | None = None) -> int:
    """加载并通过信任闸后登记进进程级登记表;返回本次新登记条数。

    幂等:同一 (事件, 内容哈希) 只登记一次。未配置 ⇒ 0 且无日志噪音;
    配置存在但未信任 ⇒ 0 + 一条 warning(不抛,避免一个坏钩子文件让服务起不来)。
    """
    path = config_path or _default_config_path()
    try:
        specs = load_command_hooks(path)
    except CommandHookError as exc:
        logger.warning("命令钩子未启用(配置未通过闸): %s", exc)
        return 0
    if not specs:
        return 0
    digest = hooks_content_hash(path.read_bytes())
    cwd = path.parent.parent
    installed = 0
    for spec in specs:
        kind = _KIND_BY_EVENT.get(spec.event)
        if kind is None:
            # 事件在契约内但本仓 HookRuntime 尚无该挂载点 ⇒ 明确"不支持",
            # 不静默丢弃(静默 = 读起来像已生效)。
            logger.warning("事件 %s 本仓无挂载点(钩子 %s 未登记)", spec.event, spec.name)
            continue
        key = (spec.event, digest)
        if key in _INSTALLED:
            continue
        register_lifecycle_hook(
            kind,
            _build_func(spec, cwd),
            name=f"{spec.name}@{digest[:8]}",
            timeout=spec.timeout,
        )
        _INSTALLED.add(key)
        installed += 1
    return installed


def _main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="命令钩子配置信任闸")
    parser.add_argument("--config", type=Path, default=None)
    parser.add_argument("--trust", action="store_true", help="登记当前内容为受信任")
    parser.add_argument("--list", action="store_true", help="列出可执行钩子(过闸后)")
    args = parser.parse_args(argv)
    if args.trust:
        digest = trust_hooks_config(args.config)
        print(f"trusted {digest}")
        return 0
    if args.list:
        try:
            specs = load_command_hooks(args.config)
        except CommandHookError as exc:
            print(f"未通过闸: {exc}", file=sys.stderr)
            return 2
        for spec in specs:
            print(f"{spec.event}\t{spec.matcher}\t{spec.name}")
        return 0
    parser.print_help()
    return 0


if __name__ == "__main__":  # pragma: no cover - 手工运维入口
    raise SystemExit(_main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
