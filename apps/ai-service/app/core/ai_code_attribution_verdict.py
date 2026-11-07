# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AI 代码归属判据 —— 仓内**唯一**一份(2026-11-05,goal-b49)。

本模块只放**判据**:归属三态取值、AI/人手工具登记表、判定理由码、工具名归一化与
判定纯函数。记录构造族/统计族/回溯族分别在 app/core/ai_code_attribution_record.py、
_ai_code_attribution_stats.py、_ai_code_attribution_trace.py;而
app/core/ai_code_attribution.py 是**向后兼容的聚合导出面**(消费方仍从那里取名)。

对标能力(取证册 docs/benchmark-evidence/2026-11/qoder-trae-workbuddy-rea-20261105/
T1-impl.md §3 第 5 行):按 (tool, file, hunk) 记「这段改动是 AI 生成还是人手写的」,
并给出足以事后用 git blame 回溯的锚。

三条硬纪律:判定是纯函数且仓内**只此一份**(§0.6 单一真相源:禁止第二份常量表、
禁止第二份判定实现);unknown 不折成 ai/human(§0.3「没判」不写成「判过」);
回溯不出就说回溯不出(锚不全或 blame 失败 ⇒ unresolved + 原因,不假装成功)。
"""

from __future__ import annotations

from dataclasses import dataclass

# ---------------------------------------------------------------------------
# 归属三态
# ---------------------------------------------------------------------------
ATTRIBUTION_AI = "ai"
ATTRIBUTION_HUMAN = "human"
ATTRIBUTION_UNKNOWN = "unknown"

#: 归属取值全集(登记/统计/校验都按这一份取值走,禁止各处自写字符串)。
ATTRIBUTION_VALUES: tuple[str, ...] = (ATTRIBUTION_AI, ATTRIBUTION_HUMAN, ATTRIBUTION_UNKNOWN)

# ---------------------------------------------------------------------------
# 工具登记表(判据唯一真源)
# ---------------------------------------------------------------------------
#: 经由 AI 工具产生的改动 ⇒ 归属 ai。本仓侧真消费面:file_edit / file_write /
#: file_batch_edit、apply_patch / patch_apply、edit_file / write_file 等写工具。
AI_GENERATED_TOOLS: frozenset[str] = frozenset(
    {
        "file_edit",
        "file_write",
        "file_batch_edit",
        "write_file",
        "edit_file",
        "apply_patch",
        "patch_apply",
        "str_replace_editor",
        "multiedit",
        "create_file",
    }
)

#: 人手直接书写的改动 ⇒ 归属 human(本仓没有「人手编辑」走工具面的入口:人手改代码
#: 发生在编辑器里,不经本仓工具链),故此表只登记显式标注面。
HUMAN_AUTHORED_TOOLS: frozenset[str] = frozenset(
    {
        "manual_edit",
        "human_edit",
        "user_edit",
        "human_patch",
    }
)

#: 两张表不得有交集:同一个工具名同时登记成 ai 与 human ⇒ 判据自身矛盾。
assert not (AI_GENERATED_TOOLS & HUMAN_AUTHORED_TOOLS), "归属工具登记表自相矛盾"

# ---------------------------------------------------------------------------
# 判定理由(读数侧要能复述「为什么判成这样」)
# ---------------------------------------------------------------------------
REASON_AI_REGISTRY = "tool_in_ai_registry"
REASON_HUMAN_REGISTRY = "tool_in_human_registry"
REASON_UNREGISTERED_TOOL = "tool_not_in_registry"
REASON_MISSING_INPUT = "missing_file_or_hunk"


@dataclass(frozen=True)
class AttributionVerdict:
    """一次判定的结果:归属 + 理由(理由是读数侧可复述的依据,不是装饰)。"""

    attribution: str
    reason: str


def normalize_tool_name(tool: str) -> str:
    """工具名归一化:去空白 → 小写 → 剥掉 MCP 命名空间前缀。

    `mcp__<server>__<tool>` 归一到 `<tool>`;归一化后仍不在登记表里 ⇒ unknown
    (不猜成 human)。
    """
    name = (tool or "").strip().lower()
    if name.startswith("mcp__"):
        parts = name.split("__")
        if len(parts) >= 3:
            name = parts[-1]
    return name


def classify(tool: str, file: str, hunk: str) -> AttributionVerdict:
    """判定一段改动的归属(纯函数:无 IO、无全局状态)。

    判定序:文件或 hunk 为空 ⇒ unknown(不折成 human/ai);工具名归一化后命中 AI
    登记表 ⇒ ai;命中人手登记表 ⇒ human;其余 ⇒ unknown(工具未登记 = 判不出来)。
    """
    if not (file or "").strip() or not (hunk or "").strip():
        return AttributionVerdict(ATTRIBUTION_UNKNOWN, REASON_MISSING_INPUT)
    name = normalize_tool_name(tool)
    if not name:
        return AttributionVerdict(ATTRIBUTION_UNKNOWN, REASON_MISSING_INPUT)
    if name in AI_GENERATED_TOOLS:
        return AttributionVerdict(ATTRIBUTION_AI, REASON_AI_REGISTRY)
    if name in HUMAN_AUTHORED_TOOLS:
        return AttributionVerdict(ATTRIBUTION_HUMAN, REASON_HUMAN_REGISTRY)
    return AttributionVerdict(ATTRIBUTION_UNKNOWN, REASON_UNREGISTERED_TOOL)


def classify_attribution(tool: str, file: str, hunk: str) -> str:
    """``classify`` 的薄封装:只要归属取值那一档。"""
    return classify(tool, file, hunk).attribution
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
