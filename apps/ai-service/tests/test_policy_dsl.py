# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core 受限策略表达式求值器 — Round 10（对标 Codex 用 Starlark 写 execpolicy）
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


import pytest

from app.core.policy_dsl import (
    MAX_DEPTH,
    MAX_EXPRESSION_CHARS,
    EvalState,
    ExprError,
    PolicyEnv,
    compile_policy,
    evaluate_source,
)

ENV = PolicyEnv(
    {
        "host": "registry.npmjs.org",
        "user": "alice",
        "is_prod": False,
        "attempts": 3,
        "tags": ["a", "b"],
        "flags": {"x": 1},
    }
)


# ---------- 一、正常求值 ----------


@pytest.mark.parametrize(
    ("src", "expect"),
    [
        ('host == "registry.npmjs.org"', EvalState.TRUE),
        ('host == "evil.example"', EvalState.FALSE),
        ('host != "evil.example"', EvalState.TRUE),
        ('user in ["alice", "bob"]', EvalState.TRUE),
        ('user in ["bob"]', EvalState.FALSE),
        ('"npmjs" in host', EvalState.TRUE),  # 子串测试
        ("attempts == 3", EvalState.TRUE),
        ("attempts < 5", EvalState.TRUE),
        ("attempts >= 3", EvalState.TRUE),
        ("is_prod", EvalState.FALSE),
        ("not is_prod", EvalState.TRUE),
        ('is_prod or user == "alice"', EvalState.TRUE),
        ('is_prod and user == "alice"', EvalState.FALSE),
        ('user in ["alice"] and not is_prod', EvalState.TRUE),
        ('(user == "alice" or user == "bob") and attempts > 1', EvalState.TRUE),
        ('"x" in flags', EvalState.TRUE),
        ('"y" in flags', EvalState.FALSE),
    ],
)
def test_expression_truth_table(src, expect):
    res, err = evaluate_source(src, ENV)
    assert err is None, f"{src} 不应编译失败: {err}"
    assert res.state is expect, f"{src} 期望 {expect} 实得 {res.state}"


# ---------- 二、逃逸防护（本模块最重要的部分）----------


@pytest.mark.parametrize(
    ("src", "allowed_codes"),
    [
        # 属性访问：防 __class__.__bases__ 类逃逸的根本手段
        ("host.__class__", {ExprError.ATTRIBUTE_ACCESS_FORBIDDEN}),
        ('"".__class__.__mro__', {ExprError.ATTRIBUTE_ACCESS_FORBIDDEN}),
        ("flags.items", {ExprError.ATTRIBUTE_ACCESS_FORBIDDEN}),
        # 方法调用同时含 '.' 与 '('，报任一逃逸码都可接受；
        # 关键是**不能**报成泛泛的语法错误（那会让审计看不出是越权尝试）
        (
            'host.startswith("reg")',
            {ExprError.ATTRIBUTE_ACCESS_FORBIDDEN, ExprError.CALL_FORBIDDEN},
        ),
        ("len(host)", {ExprError.CALL_FORBIDDEN}),
        ("__import__('os')", {ExprError.CALL_FORBIDDEN}),
        ("(user)(1)", {ExprError.CALL_FORBIDDEN}),
    ],
)
def test_escape_vectors_are_refused_at_compile(src, allowed_codes):
    policy, err = compile_policy(src)
    assert policy is None, f"{src} 不该编译成功"
    assert err is not None
    assert err.code in allowed_codes, f"{src} 期望 {allowed_codes} 实得 {err.code}"
    # 不得报成泛泛语法错误
    assert err.code is not ExprError.UNEXPECTED_TOKEN, (
        f"{src} 被报成泛泛语法错误，审计者看不出这是越权尝试"
    )


def test_attribute_access_error_message_names_the_reason():
    _, err = compile_policy("host.__dict__")
    assert err is not None
    assert "防沙箱逃逸" in err.detail


def test_compile_failure_yields_undetermined_not_false():
    """编译失败必须是 UNDETERMINED —— 若返回 FALSE，deny 规则会静默失效。"""
    res, err = evaluate_source("host.startswith('x')", ENV)
    assert err is not None
    assert res.state is EvalState.UNDETERMINED
    assert res.state is not EvalState.FALSE


# ---------- 三、三态语义 ----------


def test_missing_variable_is_undetermined_not_false():
    res, err = evaluate_source("missing_var == 1", ENV)
    assert err is None
    assert res.state is EvalState.UNDETERMINED
    assert any("missing_var" in t for t in res.trail)


def test_no_implicit_bool_int_equality():
    """Python 里 True == 1，策略里必须判不等（否则 flag == 1 会误命中）。"""
    env = PolicyEnv({"flag": True})
    res, _ = evaluate_source("flag == 1", env)
    assert res.state is EvalState.FALSE


def test_bool_int_not_in_list():
    env = PolicyEnv({"flag": True, "nums": [1, 2, 3]})
    res, _ = evaluate_source("flag in nums", env)
    assert res.state is EvalState.FALSE


def test_and_short_circuits_to_false_even_with_undetermined():
    """FALSE and UNDETERMINED ⇒ FALSE（确定不成立就该早退）。"""
    res, _ = evaluate_source("is_prod and missing_var", ENV)
    assert res.state is EvalState.FALSE


def test_or_short_circuits_to_true_even_with_undetermined():
    res, _ = evaluate_source('not is_prod or missing_var', ENV)
    assert res.state is EvalState.TRUE


def test_and_with_undetermined_and_true_is_undetermined():
    res, _ = evaluate_source("missing_var and not is_prod", ENV)
    assert res.state is EvalState.UNDETERMINED


def test_top_level_non_bool_is_undetermined():
    """裸变量是字符串 ⇒ 顶层不是 bool ⇒ 未判定。"""
    res, _ = evaluate_source("host", ENV)
    assert res.state is EvalState.UNDETERMINED
    assert any("bool" in t for t in res.trail)


def test_ordered_compare_on_mismatched_types_is_undetermined():
    res, _ = evaluate_source("host < 5", ENV)
    assert res.state is EvalState.UNDETERMINED


def test_in_on_non_container_is_undetermined():
    res, _ = evaluate_source("user in attempts", ENV)
    assert res.state is EvalState.UNDETERMINED


# ---------- 四、规模上限（防解析期 DoS）----------


def test_too_long_expression_refused():
    src = "a" * (MAX_EXPRESSION_CHARS + 1)
    policy, err = compile_policy(src)
    assert policy is None
    assert err is not None
    assert err.code is ExprError.TOO_LONG


def test_too_deep_nesting_refused():
    src = "(" * (MAX_DEPTH + 4) + "is_prod" + ")" * (MAX_DEPTH + 4)
    policy, err = compile_policy(src)
    assert policy is None
    assert err is not None
    assert err.code is ExprError.TOO_DEEP


def test_unterminated_string_refused():
    policy, err = compile_policy('host == "abc')
    assert policy is None
    assert err is not None
    assert err.code is ExprError.UNTERMINATED_STRING


def test_empty_expression_refused():
    policy, err = compile_policy("   ")
    assert policy is None
    assert err is not None
    assert err.code is ExprError.EMPTY_EXPRESSION


def test_non_string_input_refused():
    res, err = evaluate_source(None, ENV)  # type: ignore[arg-type]
    assert err is not None
    assert res.state is EvalState.UNDETERMINED


# ---------- 五、语法边界 ----------


def test_trailing_tokens_refused():
    policy, err = compile_policy("is_prod is_prod")
    assert policy is None
    assert err is not None


def test_number_with_unit_suffix_refused():
    policy, err = compile_policy("attempts == 3x")
    assert policy is None
    assert err is not None
    assert err.code is ExprError.UNEXPECTED_CHAR


def test_single_quotes_supported():
    res, err = evaluate_source("host == 'registry.npmjs.org'", ENV)
    assert err is None
    assert res.state is EvalState.TRUE


def test_none_literal():
    env = PolicyEnv({"target": None})
    res, _ = evaluate_source("target == none", env)
    assert res.state is EvalState.TRUE


def test_true_false_literals():
    res, _ = evaluate_source("false", ENV)
    assert res.state is EvalState.FALSE
    res2, _ = evaluate_source("true", ENV)
    assert res2.state is EvalState.TRUE


# ---------- 六、与 exec_policy_decision 的值域对账 ----------


def test_can_gate_existing_decision_enums():
    """能用策略表达式表达既有 Decision/SandboxKind 的条件（落点可行性证明）。"""
    from app.core.exec_policy_decision import Decision, SandboxKind

    env = PolicyEnv(
        {
            "decision": Decision.PROMPT.value,
            "sandbox": SandboxKind.RESTRICTED.value,
            "dangerous": True,
        }
    )
    res, _ = evaluate_source(
        'decision == "prompt" and sandbox == "restricted" and dangerous', env
    )
    assert res.state is EvalState.TRUE


# ---------- 七、留痕可解释 ----------


def test_explanation_contains_reason():
    res, _ = evaluate_source("missing_a and missing_b", ENV)
    text = res.to_explanation()
    assert "undetermined" in text
    assert "missing_a" in text or "missing_b" in text
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


# ---------- 九、策略内建自测（对标 Codex match / not_match）----------


from app.core.policy_dsl import (  # noqa: E402
    ExampleCase,
    SelfTestFailure,
    assert_policy,
    run_policy_self_test,
)


def test_self_test_passes_when_all_examples_hold():
    cases = [
        ExampleCase("命中", PolicyEnv({"host": "a.example", "ok": True}), EvalState.TRUE),
        ExampleCase("不命中", PolicyEnv({"host": "b.example", "ok": True}), EvalState.FALSE),
    ]
    res, err = assert_policy('host == "a.example" and ok', cases)
    assert err is None
    assert res is not None and res.ok is True
    assert "通过" in res.to_explanation()


def test_self_test_catches_policy_written_wrong():
    """**核心价值**：策略写错（这里是 == 写成 != 的效果）加载期就暴露。"""
    cases = [
        # 策略作者以为这里会命中，实际不会
        ExampleCase("该命中却没命中", PolicyEnv({"host": "a.example"}), EvalState.TRUE),
    ]
    res, err = assert_policy('host != "a.example"', cases)
    assert err is None
    assert res is not None
    assert res.ok is False
    assert res.failures[0][1] is SelfTestFailure.EXPECTED_TRUE_GOT_FALSE


def test_self_test_catches_over_broad_policy_with_negative_case():
    """反例抓住「规则写太宽」—— 对侧 not_match 的用途。"""
    cases = [
        ExampleCase("该拒绝的样本", PolicyEnv({"dangerous": False}), EvalState.TRUE),
    ]
    # 策略恒为真（过宽），正例能过但反例（这里用另一个 env 期望 FALSE 被违反的等价形式）
    res, err = assert_policy("true", cases)
    assert err is None
    assert res is not None and res.ok is True

    # 换成正例期望 FALSE ⇒ 恒真策略被抓住
    cases2 = [ExampleCase("不该命中", PolicyEnv({}), EvalState.FALSE)]
    res2, _ = assert_policy("true", cases2)
    assert res2 is not None and res2.ok is False
    assert res2.failures[0][1] is SelfTestFailure.EXPECTED_FALSE_GOT_TRUE


def test_self_test_distinguishes_undetermined_from_false():
    """**本仓超越对侧**：变量没注入（装配问题）与策略写错是不同失败类。"""
    cases = [ExampleCase("忘了注入 host", PolicyEnv({}), EvalState.TRUE)]
    res, _ = assert_policy('host == "a"', cases)
    assert res is not None
    assert res.ok is False
    assert res.failures[0][1] is SelfTestFailure.EXPECTED_TRUE_GOT_UNDETERMINED, (
        "装配问题必须与策略写错分开报，否则排障方向会错"
    )


def test_self_test_all_failures_are_reported_not_just_first():
    cases = [
        ExampleCase("失败一", PolicyEnv({}), EvalState.TRUE),
        ExampleCase("失败二", PolicyEnv({}), EvalState.TRUE),
        ExampleCase("通过", PolicyEnv({"host": "a"}), EvalState.TRUE),
    ]
    res, _ = assert_policy('host == "a"', cases)
    assert res is not None
    assert len(res.failures) == 2, "应报全部失败项，不是只报第一条"
    labels = {f[0] for f in res.failures}
    assert labels == {"失败一", "失败二"}


def test_self_test_compile_error_not_swallowed():
    res, err = assert_policy("host.__class__", [])
    assert res is None
    assert err is not None


def test_self_test_empty_cases_is_vacuously_ok():
    """空用例不算「已验证」，但也不该判失败。"""
    res, err = assert_policy("true", [])
    assert err is None
    assert res is not None and res.ok is True


def test_self_test_explanation_lists_failures():
    cases = [ExampleCase("样本A", PolicyEnv({}), EvalState.TRUE)]
    res, _ = assert_policy('host == "a"', cases)
    assert res is not None
    text = res.to_explanation()
    assert "样本A" in text
    assert "失败" in text


def test_run_policy_self_test_directly():
    policy, err = compile_policy('host == "a"')
    assert err is None and policy is not None
    res = run_policy_self_test(
        policy, [ExampleCase("ok", PolicyEnv({"host": "a"}), EvalState.TRUE)]
    )
    assert res.ok is True


# ---------- 十、四值决策（对标 Codex Allow/Prompt/PromptUser/Forbidden）----------


from app.core.policy_dsl import (  # noqa: E402
    POLICY_DECISION_WIRE,
    PolicyDecision,
    parse_policy_decision,
    policy_decision_to_three,
)


@pytest.mark.parametrize(
    ("raw", "expect"),
    [
        ("allow", PolicyDecision.ALLOW),
        ("prompt", PolicyDecision.PROMPT),
        ("prompt_user", PolicyDecision.PROMPT_USER),
        ("PromptUser", PolicyDecision.PROMPT_USER),
        ("prompt-user", PolicyDecision.PROMPT_USER),
        ("forbidden", PolicyDecision.FORBIDDEN),
        ("deny", PolicyDecision.FORBIDDEN),
        ("  ALLOW  ", PolicyDecision.ALLOW),
    ],
)
def test_parse_policy_decision_accepts_four_values_and_aliases(raw, expect):
    assert parse_policy_decision(raw) is expect


def test_parse_policy_decision_rejects_unknown_without_default():
    """认不出必须返回 None —— 不得回落 allow 或 prompt。"""
    for bad in ["bogus", "", 123, None, []]:
        assert parse_policy_decision(bad) is None


def test_policy_decision_to_three_never_loosens():
    """降级映射方向恒为更保守：PROMPT_USER 只能是 prompt，不能是 allow。"""
    assert policy_decision_to_three(PolicyDecision.ALLOW) == "allow"
    assert policy_decision_to_three(PolicyDecision.PROMPT) == "prompt"
    assert policy_decision_to_three(PolicyDecision.PROMPT_USER) == "prompt"
    assert policy_decision_to_three(PolicyDecision.FORBIDDEN) == "forbidden"


def test_wire_encoding_matches_existing_amendment_mapping():
    """forbidden 在 wire 上编码为 deny —— 与 exec_policy_amendments 的
    _DECISION_MAPPING 同源，避免两套编码漂移。"""
    assert POLICY_DECISION_WIRE[PolicyDecision.FORBIDDEN] == "deny"
    assert POLICY_DECISION_WIRE[PolicyDecision.ALLOW] == "allow"
    assert POLICY_DECISION_WIRE[PolicyDecision.PROMPT_USER] == "prompt_user"

    from app.core.exec_policy_amendments import _DECISION_MAPPING

    assert _DECISION_MAPPING["allow"] == POLICY_DECISION_WIRE[PolicyDecision.ALLOW]
    assert _DECISION_MAPPING["forbidden"] == POLICY_DECISION_WIRE[PolicyDecision.FORBIDDEN]


def test_four_values_cover_superset_of_existing_three():
    """四值必须覆盖既有三值全部（防漏）。"""
    from app.core.exec_policy_decision import Decision

    for d in Decision:
        assert any(
            policy_decision_to_three(pd) == d.value for pd in PolicyDecision
        ), f"既有 Decision.{d} 在四值映射中无对应"
