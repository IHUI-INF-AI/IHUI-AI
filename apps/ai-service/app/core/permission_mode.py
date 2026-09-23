# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""权限模式唯一真源 —— Python 侧镜像(G-161,2026-09-22 立)。

TS 侧在 ``packages/types/src/permission-mode.ts``。两侧成员与别名映射必须逐字
一致,由 ``scripts/check-permission-mode-vocabulary.mjs``(guardian 第 68 项,
blocking)对账 —— 跨语言复刻判定路径历史上已经造过一次假"生效"(见
project memory: cross-language-replica-creates-phantom-bugs)。

为什么需要归一化而不是各自校验:同一语义曾有 5 套拼写在跑
(agent-runtime 5-camel / workspace 4-kebab / api-client 3-kebab /
本服务 agent_loop_v2 3 值 / 对外文档 5 值),非法值在 ``AgentLoopV2``
构造期直接 ``ValueError`` 打成 500,在 Pydantic 侧则被静默丢弃 ——
"客户端发了"和"服务端生效"之间没有任何一层负责对齐。
"""

from __future__ import annotations

from typing import Final, Literal

PermissionModeId = Literal["default", "acceptEdits", "bypassPermissions", "plan", "manual"]

PERMISSION_MODES: Final[tuple[str, ...]] = (
    "default",
    "acceptEdits",
    "bypassPermissions",
    "plan",
    "manual",
)

# 键为归一化键(permission_mode_key 的输出);三条非随手映射的依据见 TS 侧注释。
PERMISSION_MODE_ALIASES: Final[dict[str, PermissionModeId]] = {
    "default": "default",
    "acceptedits": "acceptEdits",
    "accept-edits": "acceptEdits",
    "bypasspermissions": "bypassPermissions",
    "bypass-permissions": "bypassPermissions",
    "plan": "plan",
    "manual": "manual",
    "auto": "acceptEdits",
    "accept-all": "bypassPermissions",
    "read-only": "plan",
    "plan-only": "plan",
}


def permission_mode_key(raw: str) -> str:
    """camelCase → kebab → 全小写,使 ``acceptEdits`` 与 ``accept-edits`` 同键。"""
    out: list[str] = []
    prev_lower = False
    for ch in raw.strip():
        if ch.isupper() and prev_lower:
            out.append("-")
        out.append(ch)
        prev_lower = ch.islower() or ch.isdigit()
    return "".join(out).lower()


def normalize_permission_mode(raw: object) -> PermissionModeId | None:
    """任意输入 → 规范标识;认不出返回 None(**不**回退 'default')。

    静默降级会让用户以为高危档已生效,与本次根治的静默失效同类,故由调用方
    显式处理 None(拒 400 / raise)。
    """
    if not isinstance(raw, str):
        return None
    key = permission_mode_key(raw)
    if not key:
        return None
    return PERMISSION_MODE_ALIASES.get(key)


def is_readonly_permission_mode(mode: str) -> bool:
    return mode == "plan"


def skips_approval_permission_mode(mode: str) -> bool:
    """acceptEdits / bypassPermissions 两档享有免审批(只读工具范围由调用方判定)。"""
    return mode in ("acceptEdits", "bypassPermissions")


def permission_mode_error(raw: object) -> str:
    """统一非法值文案 —— 别让三处 raise 各写一份取值清单。"""
    return (
        f"非法 permission_mode: {raw!r},取值必须为 "
        + " / ".join(f"'{m}'" for m in PERMISSION_MODES)
        + "(历史别名 auto/accept-edits/accept-all/read-only/plan-only 会自动归一)"
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
