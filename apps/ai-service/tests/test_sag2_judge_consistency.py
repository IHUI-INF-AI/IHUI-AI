# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""SAG2 结果层「判定状态三字段自洽」形状锁回归（本仓自有实现）。

修复的缺陷：跨 hop 里只要有一轮 verdict.executed=True，结果层
``judge_executed`` 就为真，但 ``judge_reason`` 仍可能停留在
``NO_MODEL_REASON``（ModelJudge 成功路径 reason 为空 → 旧实现不覆盖初始值），
``judge_mode`` 也可能被最后一轮降级 verdict 覆盖成 lexical-only。
三字段自相矛盾会让调用方把「已判定」误读成「从未判定」。

本文件用固定夹具钉住四种世界：全降级 / 全执行 / 先降级后执行 / 先执行后降级，
并在 max_hops=0/1/2 上做穷尽形状锁。
"""

from __future__ import annotations

import asyncio

from app.services.sag2_lexical import (
    LexicalOnlyJudge,
    Sag2Options,
    retrieve,
)
from app.services.sag2_lexical.index import LexicalIndex
from app.services.sag2_lexical.judge import (
    JUDGE_EXECUTED_REASON,
    JudgeVerdict,
    MODE_LEXICAL_ONLY,
    MODE_MODEL,
    NO_MODEL_REASON,
)

# 与 test_sag2_lexical.py 同一套确定性多跳语料：doc3 只能靠查询时关联抵达。
DOCS = [
    ("kb/acquisition.txt", "A公司全资收购了B公司。A公司总部设在深圳。"),
    ("kb/cto.txt", "A公司任命张三为CTO。张三负责A公司的技术战略。"),
    ("kb/project.txt", "张三离职后转战盘古大模型。该模型由张三牵头研发。"),
    ("kb/noise1.txt", "本周食堂菜单包含米饭与青菜。"),
    ("kb/noise2.txt", "海边城市的天气预报显示晴朗。"),
    ("kb/noise3.txt", "音乐会门票在售票窗口领取。"),
]


def make_index() -> LexicalIndex:
    index = LexicalIndex()
    for path, content in DOCS:
        index.add_document(path, content)
    return index


class ScriptedJudge:
    """按调用序号返回预定 verdict；分数恒定，只用来驱动主循环走完每一 hop。"""

    def __init__(self, script: list[tuple[bool, str, str]]) -> None:
        self.script = script
        self.calls = 0

    async def score(self, question: str, candidates: list, evidence: list) -> JudgeVerdict:
        executed, reason, mode = self.script[min(self.calls, len(self.script) - 1)]
        self.calls += 1
        return JudgeVerdict(
            scores={getattr(c, "key", str(i)): 1.0 for i, c in enumerate(candidates)},
            mode=mode,
            executed=executed,
            reason=reason,
        )


def run(judge: object, max_hops: int = 1):
    return asyncio.run(
        retrieve(
            make_index(),
            "收购B公司",
            judge,  # type: ignore[arg-type]
            Sag2Options(max_hops=max_hops),
        )
    )


def assert_shape_consistent(result) -> None:
    """形状锁：三字段不得自相矛盾，且 to_dict() 与 dataclass 同口径。"""
    payload = result.to_dict()["judge"]
    assert payload["executed"] is result.judge_executed
    assert payload["mode"] == result.judge_mode
    assert payload["reason"] == result.judge_reason
    assert payload["reason"], "判定理由不得为空（无论降级还是已执行）"

    if result.judge_executed:
        assert result.judge_mode == MODE_MODEL, (
            "有模型分进入终排却仍标 lexical-only，会误导调用方"
        )
        assert NO_MODEL_REASON not in result.judge_reason, (
            "executed=True 却挂着『未配置模型』，是自相矛盾的形状"
        )
        assert JUDGE_EXECUTED_REASON in result.judge_reason
    else:
        assert result.judge_mode == MODE_LEXICAL_ONLY
        # 降级理由可以是 NO_MODEL_REASON / gateway 缺失 / provider 异常等多种，
        # 只锁「不得声称已执行」，不强行统一文案（具体原因必须保留）。
        assert JUDGE_EXECUTED_REASON not in result.judge_reason


def test_all_lexical_only_keeps_no_model_reason() -> None:
    result = run(LexicalOnlyJudge())
    assert result.judge_executed is False
    assert result.judge_mode == MODE_LEXICAL_ONLY
    assert result.judge_reason == NO_MODEL_REASON
    assert_shape_consistent(result)


def test_all_model_hops_never_claim_no_model() -> None:
    judge = ScriptedJudge([(True, "", MODE_MODEL)])
    result = run(judge)
    assert judge.calls >= 1
    assert result.judge_executed is True
    assert result.judge_mode == MODE_MODEL
    assert result.judge_reason == JUDGE_EXECUTED_REASON
    assert_shape_consistent(result)


def test_degrade_then_execute_marks_partial_degradation() -> None:
    judge = ScriptedJudge(
        [
            (False, NO_MODEL_REASON, MODE_LEXICAL_ONLY),
            (True, "", MODE_MODEL),
        ]
    )
    result = run(judge)
    assert judge.calls >= 2, "夹具必须真的跑到第二个 hop，否则测不到混合态"
    assert result.judge_executed is True
    assert "诚实降级" in result.judge_reason
    assert NO_MODEL_REASON not in result.judge_reason
    assert_shape_consistent(result)


def test_execute_then_degrade_marks_partial_degradation() -> None:
    judge = ScriptedJudge(
        [
            (True, "", MODE_MODEL),
            (False, NO_MODEL_REASON, MODE_LEXICAL_ONLY),
        ]
    )
    result = run(judge)
    assert judge.calls >= 2
    assert result.judge_executed is True
    assert result.judge_mode == MODE_MODEL
    assert "诚实降级" in result.judge_reason
    assert_shape_consistent(result)


def test_shape_lock_over_all_hop_budgets() -> None:
    """穷尽 max_hops 档位 × 四种 verdict 脚本，不允许任一组破坏三字段自洽。"""
    scripts = [
        [(False, NO_MODEL_REASON, MODE_LEXICAL_ONLY)],
        [(True, "", MODE_MODEL)],
        [
            (False, NO_MODEL_REASON, MODE_LEXICAL_ONLY),
            (True, "", MODE_MODEL),
        ],
        [
            (True, "", MODE_MODEL),
            (False, NO_MODEL_REASON, MODE_LEXICAL_ONLY),
        ],
    ]
    checked = 0
    for max_hops in (0, 1, 2):
        for script in scripts:
            result = run(ScriptedJudge(script), max_hops=max_hops)
            assert_shape_consistent(result)
            checked += 1
    assert checked == 12


def test_custom_degradation_reason_is_preserved_when_never_executed() -> None:
    """具体降级原因（gateway 缺失等）不得被压成一句笼统文案。"""
    reason = "SAG2_JUDGE_ENABLED 已开启但未提供 gateway;本轮诚实降级"
    judge = ScriptedJudge([(False, reason, MODE_LEXICAL_ONLY)])
    result = run(judge)
    assert result.judge_executed is False
    assert result.judge_reason == reason
    assert_shape_consistent(result)
