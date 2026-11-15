# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""round 10:code-mode cell 生命周期状态机 + 并发 delegate 边界判据的测试钉。

立因
----
``app.core.code_mode_cell_lifecycle`` 把 Codex 26.1111 code-mode 宿主的
cell-actor 治理(cell 状态机 + 两级 delegate 并发上限 + 队列背压 + 执行边界)
复现成本仓纯函数判据。行为必须被测试逐条钉住:合法迁移放行、终态复活拒绝、
cell ID 重复拒绝、两级 delegate 上限逐条报、队列背压、形状不认阻断、
执行边界非法整组阻断、输出截断 head+tail。

判据
----
测试只 import 生产模块(``cm``),断言 verdict / next_state / findings / rule /
reason;规则 id 与状态常量一律引用模块常量,不复制判据(§0.6)。负例统一断言
"带非空 reason + 非空 findings",正例断言 allowed + 空 findings。

刻意不做什么
------------
* 不连库、不起服务、不 mock 状态机、不执行代码:全部用例是纯函数入出参断言,
  天然满足测试隔离铁律;
* 不在测试里重写一份状态迁移表或边界数值(那是第二份真相源);
* 不测"语言选型"(V8 vs CPython)—— 那是刻意不做、非判据的决策。
"""

from app.core import code_mode_cell_lifecycle as cm


# ===========================================================================
# 判据 1:cell 状态迁移
# ===========================================================================
class TestCellTransition:
    def test_admission_to_started_allowed(self):
        v = cm.decide_cell_transition(cm.CELL_STATE_ADMISSION, cm.CELL_STATE_STARTED, "c1", set())
        assert v.verdict == cm.VERDICT_ALLOWED
        assert v.findings == ()
        assert v.next_state == cm.CELL_STATE_STARTED

    def test_full_happy_path_chain(self):
        """admission→started→outcome→closed 全链合法。

        active 语义 = "已 started 的其他 cell"。cell 自己 admission→started 时
        active 里还没有它(它才开始),started 之后才进 active;duplicate 只在
        迁入 started 时查,所以后续 outcome/closed 迁移传 {cell} 不影响判定。
        """
        cur, cell = cm.CELL_STATE_ADMISSION, "c1"
        steps = [
            (cm.CELL_STATE_STARTED, set()),      # 自己开跑时 active 还没有自己
            (cm.CELL_STATE_OUTCOME, {cell}),     # 之后 active 含自己,但非 started 迁移不查重
            (cm.CELL_STATE_CLOSED, {cell}),
        ]
        for nxt, active in steps:
            v = cm.decide_cell_transition(cur, nxt, cell, active)
            assert v.verdict == cm.VERDICT_ALLOWED, (cur, nxt, v.findings)
            cur = nxt

    def test_terminal_revive_closed_rejected(self):
        v = cm.decide_cell_transition(cm.CELL_STATE_CLOSED, cm.CELL_STATE_STARTED)
        assert v.verdict == cm.VERDICT_DENIED
        assert any(f.rule == cm.RULE_TERMINAL_REVIVE for f in v.findings)
        assert all(f.reason for f in v.findings)

    def test_terminal_revive_abandoned_rejected(self):
        v = cm.decide_cell_transition(cm.CELL_STATE_ABANDONED, cm.CELL_STATE_OUTCOME)
        assert v.verdict == cm.VERDICT_DENIED
        assert any(f.rule == cm.RULE_TERMINAL_REVIVE for f in v.findings)

    def test_illegal_transition_admission_to_closed(self):
        """准入态不能直接跳到 closed(必须走 started→outcome)。"""
        v = cm.decide_cell_transition(cm.CELL_STATE_ADMISSION, cm.CELL_STATE_CLOSED)
        assert v.verdict == cm.VERDICT_DENIED
        assert any(f.rule == cm.RULE_ILLEGAL_TRANSITION for f in v.findings)

    def test_abandon_from_started_allowed(self):
        """started 可因超时/取消 abandoned。"""
        v = cm.decide_cell_transition(cm.CELL_STATE_STARTED, cm.CELL_STATE_ABANDONED)
        assert v.verdict == cm.VERDICT_ALLOWED

    def test_duplicate_active_cell_id(self):
        """复用活跃 cell ID(对标 runtime reused an active cell ID)。"""
        v = cm.decide_cell_transition(
            cm.CELL_STATE_ADMISSION, cm.CELL_STATE_STARTED, "dup", {"dup"})
        assert v.verdict == cm.VERDICT_DENIED
        assert any(f.rule == cm.RULE_DUPLICATE_CELL_ID for f in v.findings)

    def test_bad_current_state_unjudged(self):
        v = cm.decide_cell_transition("bogus", cm.CELL_STATE_STARTED)
        assert v.verdict == cm.VERDICT_UNJUDGED
        assert any(f.rule == cm.RULE_BAD_STATE for f in v.findings)

    def test_bad_target_state_unjudged(self):
        v = cm.decide_cell_transition(cm.CELL_STATE_ADMISSION, "nope")
        assert v.verdict == cm.VERDICT_UNJUDGED
        assert any(f.rule == cm.RULE_BAD_STATE for f in v.findings)


# ===========================================================================
# 判据 2:并发 delegate 边界
# ===========================================================================
class TestDelegateAdmission:
    def test_under_all_caps_allowed(self):
        lim = cm.CellExecutionLimits(max_pending_delegates_per_session=8,
                                     max_pending_delegates_per_host=32,
                                     max_tool_subscriptions_per_session=16,
                                     max_event_queue=256)
        v = cm.decide_delegate_admission(lim, 3, 10, 5, 100)
        assert v.verdict == cm.VERDICT_ALLOWED
        assert v.findings == ()

    def test_session_cap_exceeded(self):
        lim = cm.CellExecutionLimits(max_pending_delegates_per_session=8)
        v = cm.decide_delegate_admission(lim, 8, 0, 0, 0)
        assert v.verdict == cm.VERDICT_DENIED
        assert any(f.rule == cm.RULE_DELEGATE_SESSION_CAP for f in v.findings)

    def test_host_cap_exceeded_independently(self):
        """宿主级超限独立报(即使会话级没超)。"""
        lim = cm.CellExecutionLimits(max_pending_delegates_per_host=32)
        v = cm.decide_delegate_admission(lim, 0, 32, 0, 0)
        assert v.verdict == cm.VERDICT_DENIED
        assert any(f.rule == cm.RULE_DELEGATE_HOST_CAP for f in v.findings)

    def test_multi_level_all_reported(self):
        """两级 + 队列同时超,逐条全报(全量证据)。"""
        lim = cm.CellExecutionLimits(max_pending_delegates_per_session=8,
                                     max_pending_delegates_per_host=32,
                                     max_event_queue=256)
        v = cm.decide_delegate_admission(lim, 8, 40, 0, 300)
        assert v.verdict == cm.VERDICT_DENIED
        rules = {f.rule for f in v.findings}
        assert cm.RULE_DELEGATE_SESSION_CAP in rules
        assert cm.RULE_DELEGATE_HOST_CAP in rules
        assert cm.RULE_QUEUE_FULL in rules

    def test_tool_subscription_cap(self):
        lim = cm.CellExecutionLimits(max_tool_subscriptions_per_session=16)
        v = cm.decide_delegate_admission(lim, 0, 0, 16, 0)
        assert v.verdict == cm.VERDICT_DENIED
        assert any(f.rule == cm.RULE_SUBSCRIPTION_CAP for f in v.findings)

    def test_negative_count_unjudged(self):
        lim = cm.DEFAULT_CELL_LIMITS
        v = cm.decide_delegate_admission(lim, -1, 0, 0, 0)
        assert v.verdict == cm.VERDICT_UNJUDGED
        assert any(f.rule == cm.RULE_EXEC_SHAPE for f in v.findings)

    def test_bool_count_unjudged(self):
        """bool 是 int 子类,必须显式排除(防 True 混过边界)。"""
        lim = cm.DEFAULT_CELL_LIMITS
        v = cm.decide_delegate_admission(lim, True, 0, 0, 0)
        assert v.verdict == cm.VERDICT_UNJUDGED


# ===========================================================================
# 判据 3:执行边界校验 + 输出截断
# ===========================================================================
class TestExecutionLimits:
    def test_default_limits_valid(self):
        v = cm.validate_execution_limits(cm.DEFAULT_CELL_LIMITS)
        assert v.verdict == cm.VERDICT_ALLOWED
        assert v.findings == ()

    def test_non_limits_object_unjudged(self):
        v = cm.validate_execution_limits({"timeout_ms": 1000})
        assert v.verdict == cm.VERDICT_UNJUDGED
        assert any(f.rule == cm.RULE_EXEC_SHAPE for f in v.findings)

    def test_zero_timeout_unjudged(self):
        bad = cm.CellExecutionLimits(timeout_ms=0)
        v = cm.validate_execution_limits(bad)
        assert v.verdict == cm.VERDICT_UNJUDGED
        assert any(f.rule == cm.RULE_EXEC_TIMEOUT_CAP for f in v.findings)

    def test_timeout_over_max_unjudged(self):
        bad = cm.CellExecutionLimits(timeout_ms=999_999, max_timeout_ms=300_000)
        v = cm.validate_execution_limits(bad)
        assert v.verdict == cm.VERDICT_UNJUDGED
        rules = {f.rule for f in v.findings}
        assert cm.RULE_EXEC_TIMEOUT_CAP in rules


class TestClipOutput:
    def test_short_text_unchanged(self):
        assert cm.clip_output("hi", cm.DEFAULT_CELL_LIMITS) == "hi"

    def test_long_text_head_tail(self):
        lim = cm.CellExecutionLimits(output_head=10, output_tail=5)
        text = "A" * 10 + "X" * 100 + "B" * 5
        out = cm.clip_output(text, lim)
        assert out.startswith("A" * 10)
        assert out.endswith("B" * 5)
        assert "输出截断" in out
        assert "100" in out  # 中间省略 100 字节

    def test_non_string_returns_empty(self):
        assert cm.clip_output(None, cm.DEFAULT_CELL_LIMITS) == ""
        assert cm.clip_output(123, cm.DEFAULT_CELL_LIMITS) == ""


# ===========================================================================
# 超越轴:对照只靠隐式 dict / 提示词,本仓给全量结构化证据
# ===========================================================================
class TestSurpassAxis:
    def test_all_cell_states_covered(self):
        """状态机覆盖全部五态,无遗漏。"""
        assert {
            cm.CELL_STATE_ADMISSION, cm.CELL_STATE_STARTED, cm.CELL_STATE_OUTCOME,
            cm.CELL_STATE_CLOSED, cm.CELL_STATE_ABANDONED,
        } == cm.ALL_CELL_STATES

    def test_terminal_states_have_no_outgoing(self):
        """终态无出边(不能复活)。"""
        for st in (cm.CELL_STATE_CLOSED, cm.CELL_STATE_ABANDONED):
            allowed = cm._CELL_TRANSITIONS[st]
            assert allowed == frozenset()

    def test_findings_always_carry_reason(self):
        """任何 denied/unjudged 的 finding 都带非空 reason(可审计)。"""
        cases = [
            cm.decide_cell_transition("x", cm.CELL_STATE_STARTED),
            cm.decide_cell_transition(cm.CELL_STATE_CLOSED, cm.CELL_STATE_STARTED),
            cm.decide_delegate_admission(cm.DEFAULT_CELL_LIMITS, -1, 0, 0, 0),
            cm.validate_execution_limits({"bad": 1}),
        ]
        for v in cases:
            assert v.verdict != cm.VERDICT_ALLOWED
            assert v.findings
            assert all(f.reason.strip() for f in v.findings)
