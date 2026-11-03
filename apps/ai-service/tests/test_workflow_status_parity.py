# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-916424 配套:workflow 终态词汇的源码级锁。

上游同课:ZCode `contracts/src/workflow/index.ts` 的 `WorkflowRunStatusSchema` 与
`script.ts:73-80` 的 `SCRIPT_WORKFLOW_RUN_STATUSES` 同六值各自声明(`export *` 本可由
const 推 schema)—— 上一批已登记为"两份真相"实例。我方修法是反方向:把注释升成
Literal 单一出处,并用源码锁钉住"注释与 Literal 不得漂移"。

**已否证的断言(登记免得下一个人重查)**:取证代理曾称我方 workflow 状态与
`packages/types/src/v1-endpoints.ts:478` 是"同一域两套词汇" —— 实测 478 是
`V1GenerationStatusResponse`(生成任务:queued/processing/...),与工作流引擎
(pending/running/...)是**不同域**,不存在漂移,不构成对账对象。
"""

import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
ENGINE = HERE.parent / "app" / "services" / "workflow_engine.py"

EXPECTED = {"pending", "running", "completed", "failed", "cancelled"}


def _source() -> str:
    return ENGINE.read_text(encoding="utf-8")


def test_literal_defined_with_exactly_five_values():
    src = _source()
    m = re.search(r"WorkflowStatus = Literal\[(.+?)\]", src, re.S)
    assert m, "WorkflowStatus Literal 定义丢失 ⇒ 状态词汇回到只有注释的形态"
    values = set(re.findall(r'"([a-z_]+)"', m.group(1)))
    assert values == EXPECTED, f"Literal 值集漂移:多 {values - EXPECTED} / 少 {EXPECTED - values}"


def test_both_dataclass_fields_use_the_literal():
    src = _source()
    assert src.count("status: WorkflowStatus") >= 2, (
        "WorkflowInstance 与 WorkflowTask 的 status 都必须走 Literal,不许有人退回裸 str"
    )


def test_old_comment_form_is_gone():
    """反向锁:旧的「裸 str + 注释」形态不得回来(那是本票修掉的形态)。"""
    src = _source()
    assert not re.search(r"status: str\s*#\s*pending", src), "旧形态回来了"


def test_assignment_sites_stay_within_the_vocabulary():
    """所有对 status 的字面量赋值都必须落在 Literal 集内(漂出集即红)。"""
    src = _source()
    assigned = set(re.findall(r'(?:inst|task)\.status\s*=\s*"([a-z_]+)"', src))
    keyword = set(re.findall(r'status="([a-z_]+)"', src))
    used = assigned | keyword
    assert used <= EXPECTED, f"发现词汇表之外的状态值:{used - EXPECTED}"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
