# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core 策略接线层 — Round 10（把 policy_dsl 接到既有安全判定链）
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


import pytest

from app.core.exec_policy_decision import (
    AskForApproval,
    Decision,
    GranularApproval,
    SandboxKind,
    UnmatchedCommandContext,
)
from app.core.policy_binding import (
    DECISION_STRICTNESS,
    TightenCause,
    bind_policy,
    build_policy_env,
    decide_with_policy,
)
from app.core.policy_dsl import EvalState

RESTRICTED = UnmatchedCommandContext(
    approval_policy=AskForApproval.ON_REQUEST, sandbox_kind=SandboxKind.RESTRICTED
)
UNRESTRICTED = UnmatchedCommandContext(
    approval_policy=AskForApproval.ON_REQUEST, sandbox_kind=SandboxKind.UNRESTRICTED
)


def _bind(src):
    b, err = bind_policy(src)
    assert err is None, f"编译失败: {err}"
    assert b is not None
    return b


# ---------- 一、未提供策略 ⇒ 零行为变化（接线安全的前提）----------


def test_no_policy_means_zero_change():
    """policy=None 时最终判定必须与既有矩阵逐字相同。"""
    cases = [
        (False, RESTRICTED),
        (True, RESTRICTED),
        (False, UNRESTRICTED),
        (True, UNRESTRICTED),
    ]
    for dangerous, ctx in cases:
        v = decide_with_policy(dangerous, ctx)
        from app.core.exec_policy_decision import render_decision_for_unmatched_command

        assert v.final is render_decision_for_unmatched_command(dangerous, ctx)
        assert v.cause is TightenCause.NO_POLICY
        assert v.policy_state is None
        assert v.tightened is False


# ---------- 二、规则一：策略只许收紧 ----------


def test_policy_hit_tightens_allow_to_forbidden():
    b = _bind('sandbox == "restricted"')
    v = decide_with_policy(False, RESTRICTED, policy=b)
    assert v.existing is Decision.ALLOW
    assert v.final is Decision.FORBIDDEN
    assert v.cause is TightenCause.POLICY_HIT
    assert v.tightened is True


def test_policy_miss_keeps_existing():
    b = _bind('sandbox == "unrestricted"')  # 对 RESTRICTED 不命中
    v = decide_with_policy(False, RESTRICTED, policy=b)
    assert v.policy_state is EvalState.FALSE
    assert v.final is v.existing
    assert v.tightened is False


def test_policy_cannot_loosen_forbidden():
    """**最关键的安全断言**：既有 FORBIDDEN 时，任何策略都不得放宽。"""
    # dangerous=True + approval=never ⇒ 既有 FORBIDDEN
    ctx = UnmatchedCommandContext(
        approval_policy=AskForApproval.NEVER, sandbox_kind=SandboxKind.RESTRICTED
    )
    from app.core.exec_policy_decision import render_decision_for_unmatched_command

    existing = render_decision_for_unmatched_command(True, ctx)
    assert existing is Decision.FORBIDDEN, "前置不成立：本例需要既有判定为 FORBIDDEN"

    for src in ['sandbox == "restricted"', 'sandbox == "unrestricted"', "true", "false"]:
        b = _bind(src)
        v = decide_with_policy(True, ctx, policy=b)
        assert v.final is Decision.FORBIDDEN, f"策略 {src!r} 放宽了 FORBIDDEN"
        assert v.tightened is False


def test_policy_cannot_loosen_prompt():
    """既有 PROMPT 时，策略不命中/未命中都不得降到 ALLOW。"""
    # dangerous=True + on_request ⇒ 既有 PROMPT
    from app.core.exec_policy_decision import render_decision_for_unmatched_command

    existing = render_decision_for_unmatched_command(True, RESTRICTED)
    assert existing is Decision.PROMPT
    b = _bind('sandbox == "unrestricted"')  # 不命中
    v = decide_with_policy(True, RESTRICTED, policy=b)
    assert v.final is Decision.PROMPT


def test_monotonic_across_all_combinations():
    """穷举：最终判定永不比既有判定更松。"""
    contexts = [
        RESTRICTED,
        UNRESTRICTED,
        UnmatchedCommandContext(
            approval_policy=AskForApproval.NEVER, sandbox_kind=SandboxKind.RESTRICTED
        ),
        UnmatchedCommandContext(
            approval_policy=AskForApproval.UNLESS_TRUSTED, sandbox_kind=SandboxKind.RESTRICTED
        ),
        UnmatchedCommandContext(
            approval_policy=AskForApproval.GRANULAR,
            granular=GranularApproval(rules_approval=False, sandbox_approval=False),
            sandbox_kind=SandboxKind.RESTRICTED,
        ),
        UnmatchedCommandContext(
            approval_policy=AskForApproval.ON_REQUEST,
            sandbox_kind=SandboxKind.RESTRICTED,
            requests_sandbox_override=True,
        ),
        UnmatchedCommandContext(
            approval_policy=AskForApproval.ON_REQUEST,
            sandbox_kind=SandboxKind.RESTRICTED,
            windows_managed_fs_restrictions_without_sandbox_backend=True,
        ),
    ]
    policies = [
        None,
        _bind('sandbox == "restricted"'),
        _bind('sandbox == "unrestricted"'),
        _bind("dangerous"),
        _bind('requests_override and sandbox == "restricted"'),
        _bind("missing_var == 1"),
    ]
    checked = 0
    for dangerous in (False, True):
        for ctx in contexts:
            for pol in policies:
                v = decide_with_policy(dangerous, ctx, policy=pol)
                assert DECISION_STRICTNESS[v.final] >= DECISION_STRICTNESS[v.existing], (
                    f"判定被放宽: existing={v.existing} final={v.final} "
                    f"dangerous={dangerous} policy={pol.name if pol else None}"
                )
                checked += 1
    assert checked == 2 * len(contexts) * len(policies)


# ---------- 三、规则二：未判定按收紧处理 ----------


def test_undetermined_tightens_allow_to_prompt():
    """策略变量拼错 ⇒ UNDETERMINED ⇒ ALLOW 抬到 PROMPT（不让装配错误静默通过）。"""
    b = _bind('hots == "x"')  # 故意拼错 host
    v = decide_with_policy(False, RESTRICTED, policy=b)
    assert v.policy_state is EvalState.UNDETERMINED
    assert v.existing is Decision.ALLOW
    assert v.final is Decision.PROMPT
    assert v.cause is TightenCause.POLICY_UNDETERMINED


def test_undetermined_keeps_prompt():
    b = _bind('hots == "x"')
    from app.core.exec_policy_decision import render_decision_for_unmatched_command

    existing = render_decision_for_unmatched_command(True, RESTRICTED)
    assert existing is Decision.PROMPT
    v = decide_with_policy(True, RESTRICTED, policy=b)
    assert v.final is Decision.PROMPT


def test_undetermined_keeps_forbidden():
    b = _bind('hots == "x"')
    ctx = UnmatchedCommandContext(
        approval_policy=AskForApproval.NEVER, sandbox_kind=SandboxKind.RESTRICTED
    )
    v = decide_with_policy(True, ctx, policy=b)
    assert v.final is Decision.FORBIDDEN


# ---------- 四、环境映射 ----------


def test_env_exposes_all_context_fields():
    env = build_policy_env(context=RESTRICTED, dangerous=True)
    vals = env.values
    assert vals["approval"] == "on_request"
    assert vals["sandbox"] == "restricted"
    assert vals["requests_override"] is False
    assert vals["windows_managed_without_backend"] is False
    assert vals["rules_approval"] is True
    assert vals["sandbox_approval"] is True
    assert vals["dangerous"] is True


def test_env_extra_overrides():
    env = build_policy_env(context=RESTRICTED, extra={"host": "a.example", "sandbox": "override"})
    assert env.values["host"] == "a.example"
    assert env.values["sandbox"] == "override", "extra 应覆盖同名映射"


def test_env_without_context():
    env = build_policy_env(dangerous=False)
    assert env.values == {"dangerous": False}


def test_policy_can_use_extra_variables():
    b = _bind('host == "registry.npmjs.org" and sandbox == "restricted"')
    v = b.apply(
        Decision.ALLOW,
        context=RESTRICTED,
        extra={"host": "registry.npmjs.org"},
    )
    assert v.final is Decision.FORBIDDEN
    assert v.cause is TightenCause.POLICY_HIT


def test_policy_without_extra_host_is_undetermined_then_tightened():
    b = _bind('host == "registry.npmjs.org"')
    v = b.apply(Decision.ALLOW, context=RESTRICTED)
    assert v.policy_state is EvalState.UNDETERMINED
    assert v.final is Decision.PROMPT  # 收紧而非放行


# ---------- 五、留痕可解释 ----------


def test_explanation_names_cause_and_states():
    b = _bind('sandbox == "restricted"')
    v = decide_with_policy(False, RESTRICTED, policy=b)
    text = v.to_explanation()
    assert "final=forbidden" in text
    assert "existing=allow" in text
    assert "cause=policy_hit" in text
    assert "收紧=是" in text


def test_no_policy_explanation_says_zero_change():
    v = decide_with_policy(False, RESTRICTED)
    assert "零行为变化" in v.to_explanation()


def test_undetermined_explanation_carries_trail():
    b = _bind('hots == "x"')
    v = decide_with_policy(False, RESTRICTED, policy=b)
    assert any("hots" in n for n in v.notes)


# ---------- 六、编译失败不抛异常 ----------


def test_bind_policy_returns_error_not_exception():
    b, err = bind_policy("host.__class__")
    assert b is None
    assert err is not None
    assert "属性访问" in err.detail or "attribute" in str(err.code)


# ---------- 七、幂等与可复用 ----------


def test_same_binding_reused_gives_stable_result():
    """编译一次可反复用；同输入同输出（无状态）。"""
    b = _bind('sandbox == "restricted"')
    r1 = decide_with_policy(False, RESTRICTED, policy=b)
    r2 = decide_with_policy(False, RESTRICTED, policy=b)
    assert r1.final is r2.final
    assert r1.cause is r2.cause


@pytest.mark.parametrize("trials", [1])
def test_binding_is_frozen(trials):
    b = _bind("true")
    with pytest.raises((AttributeError, TypeError)):
        b.name = "mutated"  # type: ignore[misc]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


# ---------- 八、_tighten 不变量（针对函数本体，不依赖上层组合）----------


def test_tighten_never_loosens_forbidden_for_any_state():
    """直接打 `_tighten`：existing=FORBIDDEN 时任何策略状态都必须仍是 FORBIDDEN。

    这条不依赖 decide_with_policy 的既有判定推导，因此即使用例上下文被改动
    （比如 render_decision_for_unmatched_command 将来改矩阵），它仍然守得住。
    """
    from app.core.policy_binding import _tighten

    for st in (EvalState.TRUE, EvalState.FALSE, EvalState.UNDETERMINED, None):
        final, _cause = _tighten(Decision.FORBIDDEN, st)
        assert final is Decision.FORBIDDEN, f"policy={st} 把 FORBIDDEN 放宽成了 {final}"


def test_tighten_matrix_is_exhaustive_and_monotonic():
    """_tighten 全矩阵：最终严格度 >= 既有严格度。"""
    from app.core.policy_binding import _tighten

    for existing in (Decision.ALLOW, Decision.PROMPT, Decision.FORBIDDEN):
        for st in (EvalState.TRUE, EvalState.FALSE, EvalState.UNDETERMINED, None):
            final, _cause = _tighten(existing, st)
            assert DECISION_STRICTNESS[final] >= DECISION_STRICTNESS[existing], (
                f"existing={existing} policy={st} 得到更松的 {final}"
            )
