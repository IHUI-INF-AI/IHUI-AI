# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core 托管允许集权限组合求解器 — Round 10（对标 Codex managed permissions 四维求解）
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


from app.core.managed_permissions import (
    ManagedPermissions,
    PermissionRequest,
    RejectCode,
    SolveState,
    assert_monotonic,
    solve_managed_permissions,
    would_loosen_approval,
    would_loosen_sandbox,
)

# ---------- 一、无托管约束 ⇒ 不介入（零行为变化）----------


def test_unmanaged_returns_unmanaged_and_does_not_pick():
    """托管未声明任何允许集 ⇒ UNMANAGED，调用方整段跳过。"""
    out = solve_managed_permissions(
        PermissionRequest(sandbox_mode="workspace-write", approval_policy="on-request"),
        ManagedPermissions(),
    )
    assert out.state is SolveState.UNMANAGED
    assert out.resolved is None
    assert out.is_actionable is False


def test_unmanaged_explain_mentions_zero_change():
    out = solve_managed_permissions(
        PermissionRequest(), ManagedPermissions()
    )
    assert "零行为变化" in out.explain()


# ---------- 二、求解成功路径 ----------


def test_solved_when_current_values_already_allowed():
    """当前值就在允许集内 ⇒ 保持当前值（最小变更优先）。"""
    req = PermissionRequest(sandbox_mode="workspace-write", approval_policy="on-request")
    out = solve_managed_permissions(
        req,
        ManagedPermissions(
            allowed_approval_policies=("on-request", "untrusted"),
            allowed_sandboxes=("workspace-write", "read-only"),
        ),
    )
    assert out.state is SolveState.SOLVED
    assert out.resolved is not None
    assert out.resolved.sandbox_mode == "workspace-write"
    assert out.resolved.approval_policy == "on-request"
    assert out.resolved.reviewer == "user"
    assert out.is_actionable is True


def test_solved_by_tightening_sandbox_to_default():
    """当前沙箱不被允许 ⇒ 回落到平台默认沙箱（收紧方向）。"""
    req = PermissionRequest(
        sandbox_mode="danger-full-access", approval_policy="on-request"
    )
    out = solve_managed_permissions(
        req,
        ManagedPermissions(
            allowed_sandboxes=("read-only", "workspace-write"),
            allowed_approval_policies=("on-request",),
        ),
        default_sandbox="read-only",
    )
    assert out.state is SolveState.SOLVED
    assert out.resolved is not None
    assert out.resolved.sandbox_mode == "read-only"
    # 沙箱被收紧，审批持平
    ok, detail = assert_monotonic(req, out)
    assert ok, detail


def test_solved_by_tightening_approval():
    """当前审批不被允许 ⇒ 取允许集里更严的一档。"""
    req = PermissionRequest(sandbox_mode="read-only", approval_policy="never")
    out = solve_managed_permissions(
        req,
        ManagedPermissions(
            allowed_sandboxes=("read-only",),
            allowed_approval_policies=("untrusted", "on-request"),
        ),
    )
    assert out.state is SolveState.SOLVED
    assert out.resolved is not None
    # never(0) → untrusted(3)：严格度上升
    assert out.resolved.approval_policy in ("untrusted", "on-request")
    ok, detail = assert_monotonic(req, out)
    assert ok, detail


def test_reviewer_axis_can_be_solved():
    """复审者维度独立可解。"""
    req = PermissionRequest(
        sandbox_mode="read-only", approval_policy="on-request", reviewer="automation"
    )
    out = solve_managed_permissions(
        req,
        ManagedPermissions(
            allowed_sandboxes=("read-only",),
            allowed_approval_policies=("on-request",),
            allowed_reviewers=("user",),
        ),
    )
    assert out.state is SolveState.SOLVED
    assert out.resolved is not None
    assert out.resolved.reviewer == "user"


# ---------- 三、不可满足（对侧抛错处，本仓给候选级理由）----------


def test_unsatisfiable_when_all_sandboxes_rejected():
    """沙箱全被拒 ⇒ UNSATISFIABLE，且带候选级理由。"""
    req = PermissionRequest(
        sandbox_mode="danger-full-access", approval_policy="on-request"
    )
    out = solve_managed_permissions(
        req,
        ManagedPermissions(
            allowed_sandboxes=("read-only",),
            allowed_approval_policies=("on-request",),
        ),
        default_sandbox="danger-full-access",  # 默认也危险 ⇒ 两枚候选都不合格
    )
    assert out.state is SolveState.UNSATISFIABLE
    assert out.resolved is None
    assert out.is_actionable is False
    assert len(out.rejections) >= 1
    assert all(isinstance(r.code, RejectCode) for r in out.rejections)


def test_unsatisfiable_never_returns_success_silently():
    """不可满足绝不静默返回任何 resolved（防「空结果冒充成功」）。"""
    out = solve_managed_permissions(
        PermissionRequest(sandbox_mode="read-only", approval_policy="never"),
        ManagedPermissions(allowed_approval_policies=()),  # 显式声明：一个都不允许
    )
    assert out.state is SolveState.UNSATISFIABLE
    assert out.resolved is None


# ---------- 四、单调收紧（本仓超越轴三）----------


def test_would_loosen_approval_matrix():
    """审批严格度序：untrusted(3) > on-request(2) > on-failure(1) > never(0)。"""
    assert would_loosen_approval("untrusted", "never") is True
    assert would_loosen_approval("untrusted", "on-request") is True
    assert would_loosen_approval("on-request", "on-failure") is True
    assert would_loosen_approval("on-request", "untrusted") is False
    assert would_loosen_approval("never", "on-request") is False
    assert would_loosen_approval("never", "never") is False


def test_would_loosen_sandbox_matrix():
    """沙箱严格度序：read-only(3) > workspace-write(2) > external-sandbox(1) > danger(0)。"""
    assert would_loosen_sandbox("read-only", "workspace-write") is True
    assert would_loosen_sandbox("read-only", "danger-full-access") is True
    assert would_loosen_sandbox("danger-full-access", "read-only") is False
    assert would_loosen_sandbox("workspace-write", "workspace-write") is False


def test_monotonic_blocks_managed_sanctioned_loosening():
    """**安全关键**：托管允许集里含宽松档，但当前是严格档 ⇒ 不得降级。

    这是单调收紧约束不可被 `allowed_*` 替代的唯一场景：候选「在允许集内」
    但比当前更松。若去掉 `would_loosen_approval` 这道闸，求解器会把
    `untrusted` 静默降到 `never`（= 关掉审批），而语义上托管集只划定
    上界、不能替代「只许收紧」这条更严的约束。
    """
    req = PermissionRequest(sandbox_mode="read-only", approval_policy="untrusted")
    out = solve_managed_permissions(
        req,
        ManagedPermissions(
            allowed_sandboxes=("read-only",),
            allowed_approval_policies=("never",),  # 托管「允许」了最松的一档
        ),
    )
    # 唯一候选 never 虽在允许集内，但比 untrusted 松 ⇒ 必须判不可满足，
    # 绝不能返回 approval_policy="never"
    assert out.state is SolveState.UNSATISFIABLE
    assert out.resolved is None
    codes = {r.code for r in out.rejections}
    assert RejectCode.WOULD_LOOSEN_APPROVAL in codes


def test_monotonic_blocks_sandbox_downgrade_even_if_allowed():
    """同一漏洞的沙箱轴：托管允许 danger 档，但当前是 read-only ⇒ 不得降级。"""
    req = PermissionRequest(
        sandbox_mode="read-only", approval_policy="on-request"
    )
    out = solve_managed_permissions(
        req,
        ManagedPermissions(
            # 沙箱允许集只列 danger，read-only 不在内 ⇒ read-only 候选被拒
            allowed_sandboxes=("danger-full-access",),
            allowed_approval_policies=("on-request",),
        ),
        default_sandbox="danger-full-access",
    )
    assert out.state is SolveState.UNSATISFIABLE
    codes = {r.code for r in out.rejections}
    # read-only 候选被「不在允许集」拒；danger 候选被「放松」拒
    assert RejectCode.SANDBOX_NOT_ALLOWED in codes
    assert RejectCode.WOULD_LOOSEN_SANDBOX in codes


def test_unknown_values_do_not_count_as_loosening():
    """认不出的值不得被读成「放松」（否则未知会被静默当成提权）。"""
    assert would_loosen_approval("bogus-value", "never") is False
    assert would_loosen_sandbox("bogus-mode", "danger-full-access") is False


def test_monotonic_holds_for_every_solved_case():
    """穷举：所有 SOLVED 结果都必须满足单调收紧。"""
    sandboxes = ["read-only", "workspace-write", "danger-full-access"]
    approvals = ["untrusted", "on-request", "on-failure", "never"]
    checked = 0
    for sm in sandboxes:
        for ap in approvals:
            req = PermissionRequest(sandbox_mode=sm, approval_policy=ap)
            managed = ManagedPermissions(
                allowed_sandboxes=("read-only", "workspace-write"),
                allowed_approval_policies=("untrusted", "on-request", "on-failure"),
            )
            out = solve_managed_permissions(req, managed, default_sandbox="read-only")
            if out.state is SolveState.SOLVED:
                ok, detail = assert_monotonic(req, out)
                assert ok, f"{sm}/{ap} 破坏单调性: {detail}"
                checked += 1
    assert checked > 0, "穷举未覆盖任何 SOLVED 用例，断言无效"


def test_assert_monotonic_detects_injected_loosening():
    """反向变异：把一个放松结果喂给 assert_monotonic 必须判否。"""
    from app.core.managed_permissions import SolveOutcome

    req = PermissionRequest(sandbox_mode="read-only", approval_policy="untrusted")
    loosened = SolveOutcome(
        state=SolveState.SOLVED,
        resolved=PermissionRequest(
            sandbox_mode="danger-full-access",
            approval_policy="never",
            reviewer="user",
        ),
    )
    ok, detail = assert_monotonic(req, loosened)
    assert ok is False
    assert "放松" in detail


# ---------- 五、未判定与判死不混（本仓超越轴二）----------


def test_bad_sandbox_input_is_undetermined_not_unsatisfiable():
    """认不出的沙箱值 ⇒ UNDETERMINED（不猜），不是 UNSATISFIABLE。"""
    out = solve_managed_permissions(
        PermissionRequest(sandbox_mode="bogus-mode"),
        ManagedPermissions(allowed_sandboxes=("read-only",)),
    )
    assert out.state is SolveState.UNDETERMINED
    assert out.resolved is None


def test_bad_approval_input_is_undetermined():
    out = solve_managed_permissions(
        PermissionRequest(approval_policy="bogus-policy"),
        ManagedPermissions(allowed_approval_policies=("never",)),
    )
    assert out.state is SolveState.UNDETERMINED


def test_permission_profile_path_is_undetermined_not_silent_success():
    """托管给档案路径 ⇒ 显式未判定，不得返回看起来成功的空结果。"""
    out = solve_managed_permissions(
        PermissionRequest(),
        ManagedPermissions(
            allowed_sandboxes=("read-only",),
            allowed_permission_profiles=("review",),
        ),
    )
    assert out.state is SolveState.UNDETERMINED
    assert out.resolved is None
    assert any("permission_profiles.py" in n for n in out.notes)


# ---------- 六、可解释性（本仓超越轴一）----------


def test_rejections_carry_human_readable_reason():
    """每个拒绝都带代码与人读理由，不是一条总错误。"""
    out = solve_managed_permissions(
        PermissionRequest(sandbox_mode="danger-full-access", approval_policy="never"),
        ManagedPermissions(
            allowed_sandboxes=("read-only",),
            allowed_approval_policies=("never",),
        ),
        default_sandbox="read-only",
    )
    assert out.state is SolveState.SOLVED
    # 危险档被拒的理由必须在内
    codes = {r.code for r in out.rejections}
    assert RejectCode.SANDBOX_NOT_ALLOWED in codes
    texts = [r.to_explanation() for r in out.rejections]
    assert all("被拒" in t for t in texts)
    assert all("[" in t and "]" in t for t in texts)


def test_explain_is_multi_line_and_mentions_state():
    out = solve_managed_permissions(
        PermissionRequest(), ManagedPermissions(allowed_sandboxes=("read-only",))
    )
    text = out.explain()
    assert "state=" in text
    assert len(text.splitlines()) >= 1


# ---------- 七、空允许集 ≠ 未约束 ----------


def test_empty_allowed_set_is_constraint_not_absent():
    """空元组 = 显式声明「一个都不允许」，与 None（未约束）语义相反。"""
    assert ManagedPermissions(allowed_sandboxes=()).has_any_constraint() is True
    assert ManagedPermissions().has_any_constraint() is False
    out = solve_managed_permissions(
        PermissionRequest(sandbox_mode="read-only", approval_policy="on-request"),
        ManagedPermissions(allowed_sandboxes=()),
    )
    assert out.state is SolveState.UNSATISFIABLE


# ---------- 八、交叉：与既有双轴契约的值域一致 ----------


def test_value_domains_match_permission_axis_contract():
    """本模块的严格度表键集必须与 permission_axis 的值域逐字一致。"""
    from app.core.managed_permissions import APPROVAL_STRICTNESS, SANDBOX_STRICTNESS
    from app.core.permission_axis import APPROVAL_POLICIES, SANDBOX_MODES
    from app.core.sandbox_policy import POLICY_EXTERNAL_SANDBOX

    assert set(APPROVAL_STRICTNESS) == set(APPROVAL_POLICIES)
    assert set(SANDBOX_STRICTNESS) == set(SANDBOX_MODES) | {POLICY_EXTERNAL_SANDBOX}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
