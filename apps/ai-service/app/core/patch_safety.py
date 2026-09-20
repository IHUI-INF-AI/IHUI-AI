# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""补丁安全判定(纯规则,无 FS/网络) — 对标 codex-rs safety.rs 的 assess_patch_safety。

移植范围:
- PatchSafetyDecision 三态:auto_approve / ask_user / reject(reason 可空);
- assess_patch_safety:对齐 codex AskForApproval 四策略(never / on_request /
  unless_trusted / granular_sandbox_approval)。never 恒 auto_approve;其余在「全部
  路径落在 writable_roots(含 Update 的 move 目标,由调用方传全路径集)且沙箱可用」
  时 auto_approve;只读沙箱(空 writable_roots 且无 cwd)且路径在外 → reject
  "read-only sandbox" 文案;路径越界 → reject "outside of the project" 文案;否则 ask_user;
- 路径判定复用 ihui WritableRoot 语义(组件级前缀 + os.path.normcase,Windows
  盘符/大小写兼容);cwd 恒作为隐式可写根(对齐 SandboxPolicy.get_writable_roots_with_cwd);
- extract_patch_paths:从 ihui apply_patch 文本提取涉及路径(Add/Update/Delete/Move
  的 old+new,去重保序),轻量正则行扫描,不 import apply_patch 模块以避免耦合。

Reject 文案逐字对齐 codex-rs/core/src/safety.rs 的两个常量:
- PATCH_REJECTED_OUTSIDE_PROJECT_REASON
- PATCH_REJECTED_READ_ONLY_REASON
"""
from __future__ import annotations

import os
from dataclasses import dataclass

from app.core.sandbox_policy import WritableRoot

# ---------------------------------------------------------------------------
# 常量(逐字对齐 codex-rs/core/src/safety.rs)
# ---------------------------------------------------------------------------

PATCH_REJECTED_OUTSIDE_PROJECT_REASON = (
    "writing outside of the project; rejected by user approval settings"
)
PATCH_REJECTED_READ_ONLY_REASON = (
    "writing is blocked by read-only sandbox; rejected by user approval settings"
)

# approval_policy 取值(对齐 codex AskForApproval)
APPROVAL_POLICY_NEVER = "never"
APPROVAL_POLICY_ON_REQUEST = "on_request"
APPROVAL_POLICY_UNLESS_TRUSTED = "unless_trusted"
APPROVAL_POLICY_GRANULAR_SANDBOX_APPROVAL = "granular_sandbox_approval"

# apply_patch hunk 头标记(镜像 apply_patch.py 同名常量;此处复制以避免 import 耦合)
ADD_FILE_MARKER = "*** Add File: "
DELETE_FILE_MARKER = "*** Delete File: "
UPDATE_FILE_MARKER = "*** Update File: "
MOVE_TO_MARKER = "*** Move to: "


# ---------------------------------------------------------------------------
# 判定结果
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class PatchSafetyDecision:
    """补丁安全判定三态,对齐 codex SafetyCheck(AutoApprove/AskUser/Reject{reason})。"""

    outcome: str  # "auto_approve" | "ask_user" | "reject"
    reason: str | None = None

    @classmethod
    def auto_approve(cls) -> "PatchSafetyDecision":
        return cls(outcome="auto_approve")

    @classmethod
    def ask_user(cls) -> "PatchSafetyDecision":
        return cls(outcome="ask_user")

    @classmethod
    def reject(cls, reason: str) -> "PatchSafetyDecision":
        return cls(outcome="reject", reason=reason)


# ---------------------------------------------------------------------------
# writable_roots 路径判定(复用 WritableRoot 语义 + normcase)
# ---------------------------------------------------------------------------


def _build_writable_roots(roots: list[str]) -> list[WritableRoot]:
    """构造 WritableRoot 列表;null/空根跳过。根路径经 normcase+normpath 归一(Windows 兼容)。"""
    result: list[WritableRoot] = []
    for root in roots:
        if not root:
            continue
        norm_root = os.path.normcase(os.path.normpath(root))
        # 仅做路径边界判定:不挂只读子路径/受保护元数据(避免依赖真实 FS 状态)
        result.append(WritableRoot(root=norm_root))
    return result


def _path_is_writable(path: str, writable_roots: list[WritableRoot]) -> bool:
    """单个路径是否落在任一可写根内(组件级前缀;normcase 处理大小写/分隔符)。"""
    norm_path = os.path.normcase(os.path.normpath(path))
    return any(wr.is_path_writable(norm_path) for wr in writable_roots)


def _paths_all_writable(paths: list[str], roots: list[str]) -> bool:
    """全部路径均可写。空根集合 → 恒 False(任何写入都越界)。"""
    if not roots:
        return False
    writable_roots = _build_writable_roots(roots)
    if not writable_roots:
        return False
    return all(_path_is_writable(p, writable_roots) for p in paths)


# ---------------------------------------------------------------------------
# 主判定入口
# ---------------------------------------------------------------------------


def assess_patch_safety(
    *,
    approval_policy: str,
    patch_paths: list[str],
    writable_roots: list[str],
    cwd: str,
    sandbox_available: bool,
) -> PatchSafetyDecision:
    """对齐 codex assess_patch_safety 的补丁安全判定。

    never 恒 auto_approve;其余在「全部路径落在 writable_roots(含 move 目标)且沙箱可用」
    时 auto_approve;只读沙箱(空 writable_roots 且无 cwd)且路径在外 → reject(read-only
    文案);路径越界 → reject(outside-of-project 文案);否则 ask_user。
    cwd 恒作为隐式可写根。
    """
    # never:覆盖 writable_roots / 沙箱 检查,恒 auto-approve
    if approval_policy == APPROVAL_POLICY_NEVER:
        return PatchSafetyDecision.auto_approve()

    # cwd 恒为隐式可写根(对齐 SandboxPolicy.get_writable_roots_with_cwd)
    effective_roots = list(writable_roots)
    if cwd:
        effective_roots.append(cwd)

    all_in_roots = _paths_all_writable(patch_paths, effective_roots)

    if all_in_roots and sandbox_available:
        return PatchSafetyDecision.auto_approve()

    if not effective_roots:
        # 只读沙箱:任何写入目标必然落在可写根之外
        return PatchSafetyDecision.reject(PATCH_REJECTED_READ_ONLY_REASON)

    if not all_in_roots:
        return PatchSafetyDecision.reject(PATCH_REJECTED_OUTSIDE_PROJECT_REASON)

    return PatchSafetyDecision.ask_user()


# ---------------------------------------------------------------------------
# 补丁路径提取(轻量文本扫描,不耦合 apply_patch 模块)
# ---------------------------------------------------------------------------


def extract_patch_paths(patch_text: str) -> list[str]:
    """从 ihui apply_patch 文本提取涉及路径(Add/Update/Delete/Move 的 old+new,去重保序)。

    四种 hunk 头均按行扫描:
    - "*** Add File: path"        → path
    - "*** Update File: path"     → path(old)
    - "*** Move to: path"         → path(new,Update 内)
    - "*** Delete File: path"     → path
    仅做纯文本提取,不做补丁解析/校验。
    """
    seen: set[str] = set()
    ordered: list[str] = []
    for line in patch_text.splitlines():
        stripped = line.strip()
        for marker in (
            ADD_FILE_MARKER,
            UPDATE_FILE_MARKER,
            DELETE_FILE_MARKER,
            MOVE_TO_MARKER,
        ):
            if stripped.startswith(marker):
                path = stripped[len(marker):].strip()
                if path and path not in seen:
                    seen.add(path)
                    ordered.append(path)
                break
    return ordered
