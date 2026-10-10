# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


# 权限双轴唯一真源(79 号票第一刀,2026-10-01 立)—— TS 侧 packages/types/src/permission-axis.ts 的
# 逐字镜像。成员/别名/预设/Legacy 映射必须与 TS 侧完全一致,由守门
# scripts/check-permission-mode-vocabulary.mjs 的 R6 条对账。取证与边界声明见 TS 侧头注;
# 本双轴与下方 permission_mode.py 既有的 CHAT_MODE × PERMISSION_MODE 相交策略是两个域,不得顶账。

from typing import Final, Literal

SandboxModeId = Literal["read-only", "workspace-write", "danger-full-access"]
ApprovalPolicyId = Literal["untrusted", "on-failure", "on-request", "never"]

SANDBOX_MODES: Final[tuple[str, ...]] = (
    "read-only",
    "workspace-write",
    "danger-full-access",
)

SANDBOX_MODE_DEFAULT: Final[str] = "read-only"

APPROVAL_POLICIES: Final[tuple[str, ...]] = (
    "untrusted",
    "on-failure",
    "on-request",
    "never",
)

APPROVAL_POLICY_DEFAULT: Final[str] = "on-request"

SANDBOX_MODE_ALIASES: Final[dict[str, SandboxModeId]] = {
    "read-only": "read-only",
    "workspace-write": "workspace-write",
    "danger-full-access": "danger-full-access",
    "readonly": "read-only",
}

APPROVAL_POLICY_ALIASES: Final[dict[str, ApprovalPolicyId]] = {
    "untrusted": "untrusted",
    "on-failure": "on-failure",
    "on-request": "on-request",
    "never": "never",
    "unless-trusted": "untrusted",
}

APPROVAL_PRESETS: Final[dict[str, tuple[str, str]]] = {
    "readOnly": ("read-only", "on-request"),
    "auto": ("workspace-write", "on-request"),
    "fullAccess": ("danger-full-access", "never"),
}

APPROVAL_PRESET_IDS: Final[tuple[str, ...]] = ("readOnly", "auto", "fullAccess")

GRANULAR_APPROVAL_KEYS: Final[tuple[str, ...]] = (
    "sandbox_approval",
    "rules",
    "skill_approval",
    "request_permissions",
    "mcp_elicitations",
)


def normalize_sandbox_mode(raw: object) -> str | None:
    """任意输入 → 沙箱轴规范标识;认不出返回 None(不回退默认,同 TS 侧 fail-closed)。"""
    if not isinstance(raw, str):
        return None
    key = raw.strip().lower()
    if key == "":
        return None
    return SANDBOX_MODE_ALIASES.get(key)


def normalize_approval_policy(raw: object) -> str | None:
    """任意输入 → 审批轴规范标识;认不出返回 None(不回退默认,同 TS 侧 fail-closed)。"""
    if not isinstance(raw, str):
        return None
    key = raw.strip().lower()
    if key == "":
        return None
    return APPROVAL_POLICY_ALIASES.get(key)


PERMISSION_MODE_TO_AXIS: Final[dict[str, tuple[str, str] | None]] = {
    "default": ("workspace-write", "on-request"),
    "plan": ("read-only", "on-request"),
    "bypassPermissions": ("danger-full-access", "never"),
    "acceptEdits": None,
    "manual": None,
}
