# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


# 权限双轴唯一真源(79 号票第一刀,2026-10-01 立)—— TS 侧 packages/types/src/permission-axis.ts 的
# 逐字镜像。成员/别名/预设/Legacy 映射必须与 TS 侧完全一致,由守门
# scripts/check-permission-mode-vocabulary.mjs 的 R6 条对账。取证与边界声明见 TS 侧头注;
# 本双轴与下方 permission_mode.py 既有的 CHAT_MODE × PERMISSION_MODE 相交策略是两个域,不得顶账。

from collections.abc import Mapping
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

# ---------------------------------------------------------------------------
# config profiles(79 号票第二刀,2026-10-18 立):[profiles.NAME] 顶层键子集。
#
# 取证(2026-10-01,与上方取证同批):config.toml 的 [profiles.NAME] 可覆盖
# model / approval_policy / sandbox_mode 等顶层键子集,经 --profile 或顶层
# profile= 选择。本模块只收**键名单 + 取值解析**,不复制继承语义。
#
# 边界声明(与 permission_mode.py 的 CHAT_MODE × PERMISSION_MODE、与
# core/permission_profiles.py 的 PermissionsToml 档案族,三者互不顶账):
# - permission_profiles.py 是"档案声明面 + filesystem/network 的解析语义"
#   (extends 链、normalize_host),是 Codex PermissionsToml 那一族;
# - 本族是"顶层键子集的取值覆盖",没有 extends 链、没有档案继承。
#   两族同源于 Codex 但落点不同,把 [profiles.NAME] 的键塞进 PermissionsToml
#   的档案解析会把"顶层键覆盖"误读成"档案继承",属于跨族顶账。
# ---------------------------------------------------------------------------

CONFIG_PROFILE_VALUE_KEYS: Final[tuple[str, ...]] = (
    "approval_policy",
    "sandbox_mode",
    "model",
)


def resolve_config_profile_axis(profile: object) -> tuple[str | None, str | None] | None:
    """config profile 映射 → 双轴取值对;**解析不出返回 None,不回退默认**。

    两件事必须分开(2026-10-18 实测订正,起因是外卖那一版把"没给"当成"默认档"):
    - 某轴**没给** ⇒ 该轴为 None(未指定),由上层/全局配置决定。
      刻意**不**填 SANDBOX_MODE_DEFAULT:只声明 approval_policy 的档案如果被
      自动补成 read-only,那么"我只要不弹审批"就被读成"禁止一切写操作" ——
      方向相反的失真,且用户看不出来。
    - 某轴**给了但认不出**(拼错 / 本族不支持的档)⇒ 整段 None。
      "认不出"绝不当成"没给":那会把用户明确写的 read-only 静默降级成未指定。

    model 键按 Codex 只属顶层键子集,不参与双轴判定,故解析时只做存在性放行、
    **不校验取值**(模型清单另有真源,本模块不抄第二份)。
    """
    if not isinstance(profile, Mapping):
        return None
    raw_sandbox = profile.get("sandbox_mode")
    raw_approval = profile.get("approval_policy")
    sandbox = None if raw_sandbox is None else normalize_sandbox_mode(raw_sandbox)
    approval = None if raw_approval is None else normalize_approval_policy(raw_approval)
    if (raw_sandbox is not None and sandbox is None) or (
        raw_approval is not None and approval is None
    ):
        return None
    return (sandbox, approval)
