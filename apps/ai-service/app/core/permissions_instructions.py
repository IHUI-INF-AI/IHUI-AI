# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
# app/core/permissions_instructions.py
"""权限指令与已批准命令前缀片段(对标 Codex permissions_instructions.rs /
approved_command_prefix_saved.rs / world_state/permissions.rs)。

移植范围:
- ``format_allow_prefixes``:已批准命令前缀(token 序列)渲染为 codex 格式文案
  (逐字对齐 codex_protocol::models::format_allow_prefixes:排序、JSON 编码、
  截断 100 条 / 5000 字节);空集返回 None(IHUI 语义,源码对空集返回 Some(""))。
- ``build_approved_command_prefix_saved_fragment``:developer 角色片段,正文
  ``"Approved command prefix saved:\n{prefixes}"``(逐字对齐
  ApprovedCommandPrefixSaved::body,无标记)。
- ``build_permissions_instructions_fragment``:``<permissions instructions>``
  developer 片段,正文模板逐字对齐 codex 英文模板(approval policy 文案 +
  sandbox 策略渲染 + writable roots),英文模板保留不中文化。
- ``PermissionsState``:对标 world_state/permissions.rs 的 PermissionsState,
  ``snapshot = (不含前缀的指令哈希, 已批准前缀 frozenset)``;
  ``render_diff`` 三分支:同哈希且前缀纯子集新增 → 增量 saved 片段;指令变化或
  前缀有删减 → 整段重发 instructions 片段;Absent/Unknown → 整段。

判定跳过:ApprovalPromptContext / ResolvedMessage catalog 全套多语言文案、
``exec_permission_approvals_enabled`` / ``request_permissions_tool_enabled``
条件分支(本批签名不携带这两个开关,采用 base 文案)、granular 明细分类渲染、
denied reads 渲染(本批签名未含 denied_read_paths/globs)。
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

# ---------------------------------------------------------------------------
# 常量(逐字对齐 codex protocol/src/models.rs)
# ---------------------------------------------------------------------------
MAX_RENDERED_PREFIXES = 100
MAX_ALLOW_PREFIX_TEXT_BYTES = 5000
TRUNCATED_MARKER = "...\n[Some commands were truncated]"

PERMISSIONS_INSTRUCTIONS_OPEN_TAG = "<permissions instructions>"
PERMISSIONS_INSTRUCTIONS_CLOSE_TAG = "</permissions instructions>"

APPROVED_COMMAND_PREFIX_SAVED_MESSAGE_PREFIX = "Approved command prefix saved:"

# sandbox 策略渲染模板(逐字对齐 prompts/templates/permissions/sandbox_mode/*.md,
# ``{{ network_access }}`` 占位符按 bool 渲染为 enabled/restricted)。
SANDBOX_TEMPLATES: dict[str, str] = {
    "danger-full-access": (
        "Filesystem sandboxing defines which files can be read or written. "
        "`sandbox_mode` is `danger-full-access`: No filesystem sandboxing - "
        "all commands are permitted. Network access is {{ network_access }}."
    ),
    "read-only": (
        "Filesystem sandboxing defines which files can be read or written. "
        "`sandbox_mode` is `read-only`: The sandbox only permits reading files. "
        "Network access is {{ network_access }}."
    ),
    "workspace-write": (
        "Filesystem sandboxing defines which files can be read or written. "
        "`sandbox_mode` is `workspace-write`: The sandbox permits reading files, "
        "and editing files in `cwd` and `writable_roots`. Editing files in other "
        "directories requires approval. Network access is {{ network_access }}."
    ),
}

# approval policy 文案(逐字对齐 prompts/templates/permissions/approval_policy/*.md
# + permissions_instructions.rs 的 GRANULAR_INTRO)。on_request 由拼接脚本从
# codex 源文件逐字注入,避免转写误差。
APPROVAL_TEMPLATES: dict[str, str] = {
    "never": (
        "Approval policy is currently never. Do not provide the "
        "`sandbox_permissions` for any reason, commands will be rejected."
    ),
    "on_request": "# Escalation Requests\n\nCommands are run outside the sandbox if they are approved by the user, or match an existing rule that allows it to run unrestricted. The command string is split into independent command segments at shell control operators, including but not limited to:\n\n- Pipes: |\n- Logical operators: &&, ||\n- Command separators: ;\n- Subshell boundaries: (...), $(...)\n\nEach resulting segment is evaluated independently for sandbox restrictions and approval requirements.\n\nExample:\n\ngit pull | tee output.txt\n\nThis is treated as two command segments:\n\n[\"git\", \"pull\"]\n\n[\"tee\", \"output.txt\"]\n\nCommands that use more advanced shell features like redirection (>, >>, <), substitutions ($(...), ...), environment variables (FOO=bar), or wildcard patterns (*, ?) will not be evaluated against rules, to limit the scope of what an approved rule allows.\n\n## How to request escalation\n\nIMPORTANT: To request approval to execute a command that will require escalated privileges:\n\n- Provide the `sandbox_permissions` parameter with the value `\"require_escalated\"`\n- Include a short question asking the user if they want to allow the action in `justification` parameter. e.g. \"Do you want to download and install dependencies for this project?\"\n- Optionally suggest a `prefix_rule` - this will be shown to the user with an option to persist the rule approval for future sessions.\n\nIf you run a command that is important to solving the user's query, but it fails because of sandboxing or with a likely sandbox-related network error (for example DNS/host resolution, registry/index access, or dependency download failure), rerun the command with \"require_escalated\". ALWAYS proceed to use the `justification` parameter - do not message the user before requesting approval for the command.\n\n## When to request escalation\n\nWhile commands are running inside the sandbox, here are some scenarios that will require escalation outside the sandbox:\n\n- You need to run a command that writes to a directory that requires it (e.g. running tests that write to /var)\n- You need to run a GUI app (e.g., open/xdg-open/osascript) to open browsers or files.\n- If you run a command that is important to solving the user's query, but it fails because of sandboxing or with a likely sandbox-related network error (for example DNS/host resolution, registry/index access, or dependency download failure), rerun the command with `require_escalated`. ALWAYS proceed to use the `sandbox_permissions` and `justification` parameters. do not message the user before requesting approval for the command.\n- You are about to take a potentially destructive action such as an `rm` or `git reset` that the user did not explicitly ask for.\n- Be judicious with escalating, but if completing the user's request requires it, you should do so - don't try and circumvent approvals by using other tools.\n\n## prefix_rule guidance\n\nWhen choosing a `prefix_rule`, request one that will allow you to fulfill similar requests from the user in the future without re-requesting escalation. It should be categorical and reasonably scoped to similar capabilities. You should rarely pass the entire command into `prefix_rule`.\n\n### Banned prefix_rules \nAvoid requesting overly broad prefixes that the user would be ill-advised to approve. For example, do not request [\"python3\"], [\"python\", \"-\"], or other similar prefixes that would allow arbitrary scripting.\nNEVER provide a prefix_rule argument for destructive commands like rm.\nNEVER provide a prefix_rule if your command uses a heredoc or herestring. \n\n### Examples\nGood examples of prefixes:\n- [\"npm\", \"run\", \"dev\"]\n- [\"gh\", \"pr\", \"check\"]\n- [\"cargo\", \"test\"]",
    "unless_trusted": (
        " `approval_policy` is `unless-trusted`: The harness will require user "
        "approval before running commands unless an explicit exec policy rule "
        "allows them."
    ),
    "granular": (
        "# Approval Requests\n\n"
        "Approval policy is `granular`. Categories set to `false` are "
        "automatically rejected instead of prompting the user."
    ),
}


# ---------------------------------------------------------------------------
# 已批准命令前缀渲染(对齐 codex_protocol::models::format_allow_prefixes)
# ---------------------------------------------------------------------------
def format_allow_prefixes(
    prefixes: set[list[str]] | list[list[str]],
) -> str | None:
    """把已批准命令前缀(token 序列集合)渲染为 codex 格式文案。

    逐字对齐源码:按 (长度, 总字符数, 字典序) 排序;每个前缀渲染为
    ``- ["tok1", "tok2"]``(token 经 JSON 编码);超过 100 条或 5000 字节截断并
    追加标记。空集返回 None(IHUI 语义)。
    """
    if not prefixes:
        return None
    seq: list[list[str]] = [list(p) for p in prefixes]
    truncated = len(seq) > MAX_RENDERED_PREFIXES
    seq.sort(key=lambda p: (len(p), sum(len(t) for t in p), p))
    lines = [f"- {_render_command_prefix(p)}" for p in seq[:MAX_RENDERED_PREFIXES]]
    full_text = "\n".join(lines)
    # 截断到 MAX_ALLOW_PREFIX_TEXT_BYTES 之前的最后一个完整 UTF-8 字符
    chars = list(full_text)
    if len(chars) > MAX_ALLOW_PREFIX_TEXT_BYTES:
        truncated = True
        full_text = "".join(chars[:MAX_ALLOW_PREFIX_TEXT_BYTES])
    if truncated:
        return f"{full_text}{TRUNCATED_MARKER}"
    return full_text


def _render_command_prefix(prefix: list[str]) -> str:
    """对齐 codex ``render_command_prefix``:每个 token 经 JSON 编码后用 ", " 连接。"""
    tokens = ", ".join(json.dumps(t) for t in prefix)
    return f"[{tokens}]"


# ---------------------------------------------------------------------------
# 片段构造(对齐 rollout_budget.build_rollout_budget_fragment 的 developer 角色
# dict 风格)
# ---------------------------------------------------------------------------
def build_approved_command_prefix_saved_fragment(prefixes: str | None) -> dict[str, Any] | None:
    """developer 角色片段,正文逐字为 ``"Approved command prefix saved:\n{prefixes}"``。"""
    if not prefixes:
        return None
    body = f"{APPROVED_COMMAND_PREFIX_SAVED_MESSAGE_PREFIX}\n{prefixes}"
    return {
        "type": "message",
        "role": "developer",
        "content": [{"type": "input_text", "text": body}],
    }


def build_permissions_instructions_fragment(
    *,
    approval_policy: str,
    sandbox_variant: str,
    writable_roots: list[str],
    cwd: str,
    network_access: bool = False,
) -> dict[str, Any]:
    """``<permissions instructions>`` developer 片段,正文模板逐字对齐 codex。"""
    body = _compose_instructions_body(
        sandbox_variant, network_access, approval_policy, writable_roots, cwd
    )
    return {
        "type": "message",
        "role": "developer",
        "content": [
            {
                "type": "input_text",
                "text": (
                    f"{PERMISSIONS_INSTRUCTIONS_OPEN_TAG}\n{body}"
                    f"{PERMISSIONS_INSTRUCTIONS_CLOSE_TAG}"
                ),
            }
        ],
    }


def _compose_instructions_body(
    sandbox_variant: str,
    network_access: bool,
    approval_policy: str,
    writable_roots: list[str],
    cwd: str,
) -> str:
    """对齐 codex ``PermissionsInstructions::from_resolved`` 的分节拼接。"""
    text = ""
    sandbox_tpl = SANDBOX_TEMPLATES[sandbox_variant]
    network_word = "enabled" if network_access else "restricted"
    text = _append_section(text, sandbox_tpl.replace("{{ network_access }}", network_word))
    text = _append_section(text, APPROVAL_TEMPLATES[approval_policy])
    # 仅 workspace-write 变体才有 writable roots 段(对齐 codex
    # SandboxPolicy::get_writable_roots_with_cwd:非 WorkspaceWrite 返回空表)。
    roots_text = None
    if sandbox_variant == "workspace-write":
        roots_text = _writable_roots_text(writable_roots, cwd)
    if roots_text is not None:
        text = _append_section(text, roots_text)
    if not text.endswith("\n"):
        text += "\n"
    return text


def _append_section(text: str, section: str) -> str:
    """对齐 codex ``append_section``:前一段未以换行结尾时先补一个换行。"""
    if not text.endswith("\n"):
        text += "\n"
    return text + section


def _writable_roots_text(writable_roots: list[str], cwd: str) -> str | None:
    """对齐 codex ``writable_roots_text``:cwd 恒入(非空),渲染为单/复数 root 句。"""
    roots: list[str] = list(writable_roots)
    if cwd:
        roots.append(cwd)
    if not roots:
        return None
    quoted = [f"`{r}`" for r in roots]
    if len(quoted) == 1:
        return f" The writable root is {quoted[0]}."
    return f" The writable roots are {', '.join(quoted)}."


# ---------------------------------------------------------------------------
# PermissionsState(对齐 world_state/permissions.rs)
# ---------------------------------------------------------------------------
PermissionsSnapshot = tuple[str, frozenset[tuple[str, ...]]]


def _hash_instructions_body(body: str) -> str:
    """对齐 Codex WorldStateHash:对 fragment body 做 SHA-1。

    前缀域字符串 ``permissions.instructions:`` 为自定命名空间前缀(与 WorldStateHash
    对同片段哈希一致的语义;因本批 instructions 正文不含前缀域,等价于只对正文哈希)。
    """
    return hashlib.sha1(f"permissions.instructions:{body}".encode("utf-8")).hexdigest()


class PermissionsState:
    """模型可见权限指令与已批准命令前缀的快照/差分状态。"""

    def __init__(
        self,
        *,
        approval_policy: str,
        sandbox_variant: str,
        writable_roots: list[str],
        cwd: str,
        approved_prefixes: set[list[str]] | list[list[str]],
        network_access: bool = False,
    ) -> None:
        self.approval_policy = approval_policy
        self.sandbox_variant = sandbox_variant
        self.writable_roots = tuple(writable_roots)
        self.cwd = cwd
        self.network_access = network_access
        # 前缀域存为 frozenset[tuple[str, ...]]:tuple 保留 token 顺序且 hashable,
        # 满足子集运算(对齐 codex BTreeSet<Vec<String>> 的命令前缀顺序语义)。
        self.approved_prefixes: frozenset[tuple[str, ...]] = frozenset(
            tuple(p) for p in approved_prefixes
        )
        # 不含前缀的指令哈希(对齐 codex instructions_without_approved_prefixes)
        self._instructions_hash = _hash_instructions_body(
            _compose_instructions_body(
                sandbox_variant, network_access, approval_policy, writable_roots, cwd
            )
        )
        self._instructions_fragment: dict[str, Any] = build_permissions_instructions_fragment(
            approval_policy=approval_policy,
            sandbox_variant=sandbox_variant,
            writable_roots=writable_roots,
            cwd=cwd,
            network_access=network_access,
        )

    @classmethod
    def new(
        cls,
        approval_policy: str,
        sandbox_variant: str,
        writable_roots: list[str],
        cwd: str,
        approved_prefixes: set[list[str]] | list[list[str]],
    ) -> "PermissionsState":
        """对齐 codex ``PermissionsState::new``(本批签名不携带 network_access)。"""
        return cls(
            approval_policy=approval_policy,
            sandbox_variant=sandbox_variant,
            writable_roots=writable_roots,
            cwd=cwd,
            approved_prefixes=approved_prefixes,
        )

    @property
    def snapshot(self) -> PermissionsSnapshot:
        """``(不含前缀的指令哈希, 已批准前缀 frozenset)``。"""
        return (self._instructions_hash, self.approved_prefixes)

    def render_diff(self, previous_snapshot: PermissionsSnapshot | None) -> dict[str, Any] | None:
        """对齐 codex ``PermissionsState::render_diff`` 三分支。

        ① Known 且指令哈希相同:
           - 前缀集合相等 → None(无变化);
           - 前缀纯子集新增 → 增量 saved 片段(仅新增前缀);
           - 否则(有删减/变化)→ 落到整段重发。
        ② 指令哈希变化 → 整段重发 instructions 片段。
        ③ Absent/Unknown(None)→ 整段重发。
        """
        if previous_snapshot is None:
            return self._instructions_fragment
        prev_hash, prev_prefixes = previous_snapshot
        if prev_hash == self._instructions_hash:
            if prev_prefixes == self.approved_prefixes:
                return None
            if prev_prefixes.issubset(self.approved_prefixes):
                added: frozenset[tuple[str, ...]] = self.approved_prefixes - prev_prefixes
                added_list: list[list[str]] = [list(p) for p in added]
                rendered = format_allow_prefixes(added_list)
                if rendered is not None:
                    return build_approved_command_prefix_saved_fragment(rendered)
        return self._instructions_fragment
