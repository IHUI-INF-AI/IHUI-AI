# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core/exec_policy_decision.py 第三十一批测试(对标 Codex exec_policy_tests.rs 决策矩阵语义)。

from app.core.exec_policy_decision import (
    PROMPT_CONFLICT_REASON,
    REJECT_RULES_APPROVAL_REASON,
    REJECT_SANDBOX_APPROVAL_REASON,
    AskForApproval,
    CommandOrigin,
    Decision,
    GranularApproval,
    SandboxKind,
    UnmatchedCommandContext,
    prompt_is_rejected_by_policy,
    render_decision_for_unmatched_command,
)


def _ctx(**kw):
    base = dict(approval_policy=AskForApproval.ON_REQUEST)
    base.update(kw)
    return UnmatchedCommandContext(**base)


class TestUnmatchedDecisionMatrix:
    def test_dangerous_with_never_is_forbidden(self):
        assert (
            render_decision_for_unmatched_command(True, _ctx(approval_policy=AskForApproval.NEVER))
            is Decision.FORBIDDEN
        )

    def test_dangerous_with_on_request_is_prompt(self):
        for policy in (AskForApproval.ON_REQUEST, AskForApproval.UNLESS_TRUSTED, AskForApproval.GRANULAR):
            assert (
                render_decision_for_unmatched_command(True, _ctx(approval_policy=policy))
                is Decision.PROMPT
            )

    def test_windows_managed_fs_without_backend_prompts_even_safe(self):
        ctx = _ctx(
            approval_policy=AskForApproval.ON_REQUEST,
            sandbox_kind=SandboxKind.UNRESTRICTED,
            windows_managed_fs_restrictions_without_sandbox_backend=True,
        )
        assert render_decision_for_unmatched_command(False, ctx) is Decision.PROMPT
        # never 下同样升级为禁止
        ctx_never = _ctx(
            approval_policy=AskForApproval.NEVER,
            windows_managed_fs_restrictions_without_sandbox_backend=True,
        )
        assert render_decision_for_unmatched_command(False, ctx_never) is Decision.FORBIDDEN

    def test_never_allows_safe_command(self):
        assert (
            render_decision_for_unmatched_command(False, _ctx(approval_policy=AskForApproval.NEVER))
            is Decision.ALLOW
        )

    def test_unless_trusted_prompts_all_unmatched(self):
        for kind in SandboxKind:
            assert (
                render_decision_for_unmatched_command(
                    False, _ctx(approval_policy=AskForApproval.UNLESS_TRUSTED, sandbox_kind=kind)
                )
                is Decision.PROMPT
            )

    def test_on_request_unrestricted_allows(self):
        for kind in (SandboxKind.UNRESTRICTED, SandboxKind.EXTERNAL_SANDBOX):
            assert (
                render_decision_for_unmatched_command(
                    False, _ctx(approval_policy=AskForApproval.ON_REQUEST, sandbox_kind=kind)
                )
                is Decision.ALLOW
            )

    def test_on_request_restricted_no_override_allows(self):
        # 受限沙箱下非危险、未请求越权 → 交给沙箱执行,不打扰用户
        assert (
            render_decision_for_unmatched_command(
                False,
                _ctx(approval_policy=AskForApproval.ON_REQUEST, sandbox_kind=SandboxKind.RESTRICTED),
            )
            is Decision.ALLOW
        )

    def test_on_request_restricted_with_override_prompts(self):
        assert (
            render_decision_for_unmatched_command(
                False,
                _ctx(
                    approval_policy=AskForApproval.ON_REQUEST,
                    sandbox_kind=SandboxKind.RESTRICTED,
                    requests_sandbox_override=True,
                ),
            )
            is Decision.PROMPT
        )

    def test_granular_mirrors_on_request_for_unmatched(self):
        assert (
            render_decision_for_unmatched_command(
                False,
                _ctx(approval_policy=AskForApproval.GRANULAR, sandbox_kind=SandboxKind.UNRESTRICTED),
            )
            is Decision.ALLOW
        )
        assert (
            render_decision_for_unmatched_command(
                False,
                _ctx(
                    approval_policy=AskForApproval.GRANULAR,
                    sandbox_kind=SandboxKind.RESTRICTED,
                    requests_sandbox_override=True,
                ),
            )
            is Decision.PROMPT
        )

    def test_full_matrix_never_upgrades_dangerous_beyond_prompt(self):
        # 危险命令在任何策略下绝不 ALLOW
        for policy in AskForApproval:
            for kind in SandboxKind:
                for override in (False, True):
                    d = render_decision_for_unmatched_command(
                        True, _ctx(approval_policy=policy, sandbox_kind=kind, requests_sandbox_override=override)
                    )
                    assert d in (Decision.PROMPT, Decision.FORBIDDEN)


class TestPromptRejectedByPolicy:
    def test_never_conflicts_with_any_prompt(self):
        assert prompt_is_rejected_by_policy(AskForApproval.NEVER, prompt_is_rule=True) == PROMPT_CONFLICT_REASON
        assert prompt_is_rejected_by_policy(AskForApproval.NEVER, prompt_is_rule=False) == PROMPT_CONFLICT_REASON

    def test_on_request_and_unless_trusted_never_reject(self):
        for policy in (AskForApproval.ON_REQUEST, AskForApproval.UNLESS_TRUSTED):
            assert prompt_is_rejected_by_policy(policy, prompt_is_rule=True) is None
            assert prompt_is_rejected_by_policy(policy, prompt_is_rule=False) is None

    def test_granular_rules_gate(self):
        assert (
            prompt_is_rejected_by_policy(
                AskForApproval.GRANULAR, prompt_is_rule=True, granular=GranularApproval(rules_approval=False)
            )
            == REJECT_RULES_APPROVAL_REASON
        )
        assert (
            prompt_is_rejected_by_policy(
                AskForApproval.GRANULAR, prompt_is_rule=True, granular=GranularApproval(rules_approval=True)
            )
            is None
        )

    def test_granular_sandbox_gate(self):
        assert (
            prompt_is_rejected_by_policy(
                AskForApproval.GRANULAR, prompt_is_rule=False, granular=GranularApproval(sandbox_approval=False)
            )
            == REJECT_SANDBOX_APPROVAL_REASON
        )
        assert (
            prompt_is_rejected_by_policy(
                AskForApproval.GRANULAR, prompt_is_rule=False, granular=GranularApproval(sandbox_approval=True)
            )
            is None
        )

    def test_rule_prompt_takes_precedence(self):
        # 两个开关同时关闭:规则提示优先(Codex 文档语义)
        assert (
            prompt_is_rejected_by_policy(
                AskForApproval.GRANULAR,
                prompt_is_rule=True,
                granular=GranularApproval(rules_approval=False, sandbox_approval=False),
            )
            == REJECT_RULES_APPROVAL_REASON
        )


class TestOriginEnum:
    def test_command_origin_values(self):
        # PowerShell 来源走专用危险命令检测(我们侧接 command_safety 的 PS 分支)
        assert CommandOrigin.POWERSHELL.value == "powershell"
        assert CommandOrigin.GENERIC.value == "generic"
