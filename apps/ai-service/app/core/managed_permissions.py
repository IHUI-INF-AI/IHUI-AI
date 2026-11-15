# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""托管允许集下的权限组合求解器 —— 对标 Codex `managed permissions` 四维求解。

## 取证来源（2026-11-15，Round 10）

对照物：`Codex` 桌面端 `app.asar`（`openai-codex-electron` 26.1106.51428）
主进程 chunk `.vite/build/early-bootstrap-620-*.js`。对侧实现（混淆后标识符 `sL`）：

```js
function sL(e, t) {
  let n = [e.approvalsReviewer, ...(t?.allowedApprovalsReviewers ?? [])],
      r = [e.approvalPolicy,    ...(t?.allowedApprovalPolicies   ?? [])];
  for (let i of [e.sandboxPolicy, defaultSandboxPolicy().sandboxPolicy])
    if ("dangerFullAccess" !== i.type && t?.allowedPermissionProfiles == null) {
      for (let s of n)
        for (let n of r)
          if (("never" !== n || "never" === e.approvalPolicy) &&
              isCompatible(t, normalize(i), n, s))
            return { ...e, activePermissionProfile: null,
                     sandboxPolicy: i, approvalPolicy: n, approvalsReviewer: s };
    }
  throw Error("No compatible automation permissions satisfy the managed requirements");
}
```

## 对侧设计要点（观察）

1. **候选集 = 当前值 ∪ 托管允许值**（当前值排在首位 ⇒ 最小变更优先）。
2. **沙箱候选只有两枚**：当前沙箱 + 平台默认沙箱。
3. **两个短路**：`danger-full-access` 不参与求解；托管给了 permissionProfiles 时整段跳过（走档案路径）。
4. **单调收紧约束**：`("never" !== n || "never" === e.approvalPolicy)` —— 候选审批策略不得比原值更松，唯一例外是原值本来就是 `never`。
5. **首个通过即返回**；全部不通过 ⇒ **抛错**，不静默降级。

## 本仓超越轴（本模块存在的理由）

对侧把整个求解压进一个函数，只有「成功/抛错」两种外部可见状态。本仓在此之上补三轴：

- **轴一 · 可解释**：返回 `SolveOutcome`，逐候选记录「为什么被拒」（拒绝码 + 人读理由），
  而不是只抛一个总错误。运维能直接看到「哪一维把哪个候选拦掉了」。
  对侧一条 `Error(...)` 里没有任何候选级证据。
- **轴二 · 未判定与判死不混**：对侧把「托管没给允许集」和「给了但都不兼容」压成同一结果。
  本仓区分 `UNMANAGED`（无托管约束 ⇒ 原值直通，不介入）/ `SOLVED` / `UNSATISFIABLE`
  （有约束但全域无解）/ `UNDETERMINED`（输入形状不合法 ⇒ 不猜）。与仓规 §0.3
  「没判绝不写成判过」同源。
- **轴三 · 收紧单调性可机检**：`assert_monotonic()` 把对侧藏在条件里的单调性提成
  可独立断言的纯函数，并由回归钉住「任何求解结果都不比输入更松」。

## 显式不做（有据跳过）

- **复审者（reviewer）维度之外的托管轴**：对侧只有 reviewer / approvalPolicy / sandbox /
  permissionProfiles 四维；本仓 `permission_profiles.py` 已完整移植档案声明面，
  profile 分支在此只做「存在即跳」的对位，不重写档案解析（§0.6 单一真相源）。
- **平台默认沙箱的探测**：由调用方注入 `default_sandbox`，本模块不读平台/环境
  （保持纯函数可测，§0.6 同源：平台事实由既有 `sandbox_policy.py` 供）。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Final

from .permission_axis import (
    APPROVAL_POLICIES,
    APPROVAL_POLICY_DEFAULT,
    SANDBOX_MODE_DEFAULT,
    SANDBOX_MODES,
    normalize_approval_policy,
    normalize_sandbox_mode,
)
from .sandbox_policy import POLICY_DANGER_FULL_ACCESS

# 审批策略的**严格度序**（越大越严）。用于单调收紧判定与候选排序。
#
# 依据：本仓 `permission_axis.py` 的 approval 值域
# ``untrusted`` / ``on-failure`` / ``on-request`` / ``never``。
# 语义严格度递增：untested 之外，untrusted 最严（几乎每步都问），
# never 最松（不问）。on-failure 介于二者之间但比 on-request 更宽
# —— 只在失败后才问，成功路径完全不打扰。
APPROVAL_STRICTNESS: Final[dict[str, int]] = {
    "untrusted": 3,
    "on-failure": 1,
    "on-request": 2,
    "never": 0,
}

# 沙箱策略的**严格度序**（越大越严）。danger-full-access 最松。
SANDBOX_STRICTNESS: Final[dict[str, int]] = {
    POLICY_DANGER_FULL_ACCESS: 0,
    "external-sandbox": 1,
    "workspace-write": 2,
    "read-only": 3,
}


class RejectCode(StrEnum):
    """单个候选被拒的原因码（对侧无此粒度）。"""

    SANDBOX_NOT_ALLOWED = "sandbox_not_allowed"
    APPROVAL_NOT_ALLOWED = "approval_not_allowed"
    REVIEWER_NOT_ALLOWED = "reviewer_not_allowed"
    WOULD_LOOSEN_APPROVAL = "would_loosen_approval"
    WOULD_LOOSEN_SANDBOX = "would_loosen_sandbox"
    REVIEWER_UNKNOWN = "reviewer_unknown"


class SolveState(StrEnum):
    """求解结果状态（对侧只有成功/抛错两态）。"""

    # 托管未给任何允许集 ⇒ 不做约束，原值直通（调用方须按「不介入」处理）
    UNMANAGED = "unmanaged"
    # 求解成功
    SOLVED = "solved"
    # 有托管约束，但候选全域无解
    UNSATISFIABLE = "unsatisfiable"
    # 输入形状不合法（认不出的值）⇒ 不猜，显式未判定
    UNDETERMINED = "undetermined"


@dataclass(frozen=True)
class ManagedPermissions:
    """托管侧声明（对应对侧 `t` 参数：`allowedApprovalPolicies` 等三集合）。

    三个允许集**都是可选**：``None`` = 该维不受托管约束；
    空元组 = 显式声明「一个都不允许」（与 None 语义相反，不可混用）。
    ``allowed_permission_profiles is not None`` 触发对侧的 profile 短路。
    """

    allowed_approval_policies: tuple[str, ...] | None = None
    allowed_reviewers: tuple[str, ...] | None = None
    allowed_sandboxes: tuple[str, ...] | None = None
    allowed_permission_profiles: tuple[str, ...] | None = None

    def has_any_constraint(self) -> bool:
        return any(
            x is not None
            for x in (
                self.allowed_approval_policies,
                self.allowed_reviewers,
                self.allowed_sandboxes,
                self.allowed_permission_profiles,
            )
        )


@dataclass(frozen=True)
class PermissionRequest:
    """当前请求的四维取值（对应对侧 `e` 参数）。"""

    sandbox_mode: str = SANDBOX_MODE_DEFAULT
    approval_policy: str = APPROVAL_POLICY_DEFAULT
    reviewer: str = "user"
    permission_profile: str | None = None


@dataclass(frozen=True)
class Rejection:
    """一个候选组合的拒绝理由（对侧无此结构）。"""

    sandbox_mode: str
    approval_policy: str
    reviewer: str
    code: RejectCode
    detail: str

    def to_explanation(self) -> str:
        return (
            f"候选(sandbox={self.sandbox_mode}, approval={self.approval_policy}, "
            f"reviewer={self.reviewer}) 被拒 [{self.code}]: {self.detail}"
        )


@dataclass(frozen=True)
class SolveOutcome:
    """求解结果。``state`` 决定调用方如何处置，绝不压成一个布尔。"""

    state: SolveState
    resolved: PermissionRequest | None = None
    rejections: tuple[Rejection, ...] = ()
    notes: tuple[str, ...] = field(default=())

    @property
    def is_actionable(self) -> bool:
        """只有 SOLVED 才可直接用于下发；其余状态由调用方按各自纪律处理。"""
        return self.state is SolveState.SOLVED

    def explain(self) -> str:
        """人读全文：状态 + 结论 + 逐候选拒绝理由。"""
        lines = [f"state={self.state}"]
        if self.resolved is not None:
            lines.append(
                f"resolved(sandbox={self.resolved.sandbox_mode}, approval={self.resolved.approval_policy}, reviewer={self.resolved.reviewer})"
            )
        lines.extend(self.notes)
        lines.extend(r.to_explanation() for r in self.rejections)
        return "\n".join(lines)


def _strictness_of_approval(policy: str) -> int:
    return APPROVAL_STRICTNESS.get(policy, -1)


def _strictness_of_sandbox(mode: str) -> int:
    return SANDBOX_STRICTNESS.get(mode, -1)


def would_loosen_approval(current: str, candidate: str) -> bool:
    """候选审批策略是否比当前更松（单调收紧约束的显式化）。

    对侧把这条藏在 `("never" !== n || "never" === e.approvalPolicy)` 里；
    这里提成纯函数，供 `assert_monotonic` 与测试直接钉住。

    未知值视为「不可比较」⇒ 返回 False（由 REGISTRY 校验环节另行判未判定），
    不让未知值在这一层静默变成「放松」。
    """
    cur = _strictness_of_approval(current)
    cand = _strictness_of_approval(candidate)
    if cur < 0 or cand < 0:
        return False
    return cand < cur


def would_loosen_sandbox(current: str, candidate: str) -> bool:
    """候选沙箱是否比当前更松。语义同 `would_loosen_approval`。"""
    cur = _strictness_of_sandbox(current)
    cand = _strictness_of_sandbox(candidate)
    if cur < 0 or cand < 0:
        return False
    return cand < cur


def _dedupe_keep_order(items: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for it in items:
        if it not in seen:
            seen.add(it)
            out.append(it)
    return out


def solve_managed_permissions(
    request: PermissionRequest,
    managed: ManagedPermissions,
    *,
    default_sandbox: str = SANDBOX_MODE_DEFAULT,
    default_reviewer: str = "user",
) -> SolveOutcome:
    """在托管允许集下求解一组可下发的权限组合。

    求解顺序（对位对侧，逐字保留其偏好）：
      1. 沙箱候选 = [当前沙箱, 平台默认沙箱]（去重保序）—— 最小变更优先；
      2. 审批候选 = [当前审批, ...托管允许审批]（去重保序）；
      3. 复审者候选 = [当前复审者, ...托管允许复审者]（去重保序）；
      4. 三者的笛卡尔积，按上述顺序遍历；**首个满足全部约束的即胜出**。

    与对侧的两处**有意分叉**（都写在这里，防后人误以为漏了）：
      - 对侧遇到 `danger-full-access` 直接跳过整个求解并抛错；本仓保留该档为候选，
        但受 `allowed_sandboxes` 与单调收紧双重过滤 —— 若托管根本没禁它、且当前
        就是它，则「保持不变」是合法解，不该被判无解。（对侧跳过是因为它只服务
        automation 路径，那里 danger 恒不可接受。）
      - 对侧 `allowed_permission_profiles != null` 时整段跳过；本仓返回
        `UNDETERMINED` + note，让调用方显式知道「档案路径未在本模块求解」，
        而不是拿到一个看起来成功的空结果。

    Returns:
        SolveOutcome；`state` 为 `UNMANAGED` 时调用方须整段跳过（零行为变化）。
    """
    # ---- 0. 输入校验：认不出的值不猜（§0.3）----
    bad: list[str] = []
    sm = normalize_sandbox_mode(request.sandbox_mode)
    if sm is None:
        bad.append(f"sandbox_mode={request.sandbox_mode!r}")
    ap = normalize_approval_policy(request.approval_policy)
    if ap is None:
        bad.append(f"approval_policy={request.approval_policy!r}")
    if bad:
        return SolveOutcome(
            state=SolveState.UNDETERMINED,
            notes=(f"输入取值认不出，未判定: {', '.join(bad)}",),
        )

    # ---- 1. 无托管约束 ⇒ 不介入 ----
    if not managed.has_any_constraint():
        return SolveOutcome(
            state=SolveState.UNMANAGED,
            notes=("托管未声明任何允许集，本模块不介入（零行为变化）",),
        )

    # ---- 2. 档案路径短路（对侧同位置跳过；本仓显式判未判定）----
    if managed.allowed_permission_profiles is not None:
        return SolveOutcome(
            state=SolveState.UNDETERMINED,
            notes=(
                "托管声明了 allowedPermissionProfiles（档案路径）；"
                "本模块只求解三轴直配组合，档案解析归 permission_profiles.py（单一真相源）",
            ),
        )

    # ---- 3. 候选集（去重保序，当前值优先）----
    sandbox_candidates = _dedupe_keep_order([sm, normalize_sandbox_mode(default_sandbox) or SANDBOX_MODE_DEFAULT])
    approval_candidates = _dedupe_keep_order(
        [ap, *(managed.allowed_approval_policies or ())]
    )
    reviewer_candidates = _dedupe_keep_order(
        [request.reviewer, *(managed.allowed_reviewers or ())]
    )

    rejections: list[Rejection] = []
    allowed_sandboxes = managed.allowed_sandboxes
    allowed_approvals = managed.allowed_approval_policies
    allowed_reviewers = managed.allowed_reviewers

    # ---- 4. 笛卡尔积遍历，首个全通过即胜出 ----
    for cand_sandbox in sandbox_candidates:
        norm_sandbox = normalize_sandbox_mode(cand_sandbox)
        if norm_sandbox is None:
            continue
        if allowed_sandboxes is not None and norm_sandbox not in allowed_sandboxes:
            rejections.append(
                Rejection(
                    sandbox_mode=norm_sandbox,
                    approval_policy=ap,
                    reviewer=request.reviewer,
                    code=RejectCode.SANDBOX_NOT_ALLOWED,
                    detail=f"不在托管允许沙箱集 {sorted(allowed_sandboxes)} 内",
                )
            )
            continue
        if would_loosen_sandbox(sm, norm_sandbox):
            rejections.append(
                Rejection(
                    sandbox_mode=norm_sandbox,
                    approval_policy=ap,
                    reviewer=request.reviewer,
                    code=RejectCode.WOULD_LOOSEN_SANDBOX,
                    detail=f"比当前沙箱 {sm} 更松（禁止放松，只许收紧）",
                )
            )
            continue

        for cand_approval in approval_candidates:
            norm_approval = normalize_approval_policy(cand_approval)
            if norm_approval is None:
                continue
            if allowed_approvals is not None and norm_approval not in allowed_approvals:
                rejections.append(
                    Rejection(
                        sandbox_mode=norm_sandbox,
                        approval_policy=norm_approval,
                        reviewer=request.reviewer,
                        code=RejectCode.APPROVAL_NOT_ALLOWED,
                        detail=f"不在托管允许审批集 {sorted(allowed_approvals)} 内",
                    )
                )
                continue
            if would_loosen_approval(ap, norm_approval):
                rejections.append(
                    Rejection(
                        sandbox_mode=norm_sandbox,
                        approval_policy=norm_approval,
                        reviewer=request.reviewer,
                        code=RejectCode.WOULD_LOOSEN_APPROVAL,
                        detail=(
                            f"比当前审批 {ap} 更松（对侧的 "
                            '("never" !== n || "never" === e.approvalPolicy) 同源约束）'
                        ),
                    )
                )
                continue

            for cand_reviewer in reviewer_candidates:
                if allowed_reviewers is not None and cand_reviewer not in allowed_reviewers:
                    rejections.append(
                        Rejection(
                            sandbox_mode=norm_sandbox,
                            approval_policy=norm_approval,
                            reviewer=cand_reviewer,
                            code=RejectCode.REVIEWER_NOT_ALLOWED,
                            detail=f"不在托管允许复审者集 {sorted(allowed_reviewers)} 内",
                        )
                    )
                    continue
                return SolveOutcome(
                    state=SolveState.SOLVED,
                    resolved=PermissionRequest(
                        sandbox_mode=norm_sandbox,
                        approval_policy=norm_approval,
                        reviewer=cand_reviewer,
                        permission_profile=None,
                    ),
                    rejections=tuple(rejections),
                    notes=(
                        "求解成功；已选候选按「当前值优先、收紧优于放松」顺序取首个可行解",
                    ),
                )

    # ---- 5. 全域无解：判死，且把每个候选的理由全交出去 ----
    return SolveOutcome(
        state=SolveState.UNSATISFIABLE,
        rejections=tuple(rejections),
        notes=(
            "托管约束下无任何可行组合；对侧在此处抛 "
            "'No compatible automation permissions satisfy the managed requirements'，"
            f"本仓改为返回带 {len(rejections)} 条候选级理由的不可满足结论",
        ),
    )


def assert_monotonic(
    request: PermissionRequest, outcome: SolveOutcome
) -> tuple[bool, str]:
    """机检：任何 `SOLVED` 结果都不得比输入更松（本仓超越轴三）。

    Returns:
        (ok, detail)。`UNMANAGED` / `UNDETERMINED` 不参与判定（不是求解结果）；
        `UNSATISFIABLE` 天然满足（没有下发任何东西）。
    """
    if outcome.state in (SolveState.UNMANAGED, SolveState.UNDETERMINED):
        return True, f"state={outcome.state} 非求解结果，不参与单调性判定"
    if outcome.state is SolveState.UNSATISFIABLE:
        return True, "state=unsatisfiable，无组合下发，单调性平凡成立"
    r = outcome.resolved
    if r is None:
        return False, "state=solved 但 resolved 为空（内部不一致）"
    if would_loosen_approval(request.approval_policy, r.approval_policy):
        return False, (
            f"审批被放松: {request.approval_policy} → {r.approval_policy}"
        )
    if would_loosen_sandbox(request.sandbox_mode, r.sandbox_mode):
        return False, f"沙箱被放松: {request.sandbox_mode} → {r.sandbox_mode}"
    return True, "单调性成立（两轴均为收紧或持平）"


__all__ = [
    "APPROVAL_POLICIES",
    "APPROVAL_STRICTNESS",
    "ManagedPermissions",
    "PermissionRequest",
    "RejectCode",
    "Rejection",
    "SANDBOX_MODES",
    "SANDBOX_STRICTNESS",
    "SolveOutcome",
    "SolveState",
    "assert_monotonic",
    "solve_managed_permissions",
    "would_loosen_approval",
    "would_loosen_sandbox",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
