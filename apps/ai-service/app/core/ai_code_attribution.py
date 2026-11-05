# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AI 代码归属账 —— **聚合导出面**(2026-11-05,goal-b49)。

本模块是 `app.core.ai_code_attribution` 的**稳定入口**:判据与纯函数按族拆到四个
子模块,这里原样再导出,消费方(`app/services/ai_code_attribution_store.py`、
`app/routers/ai_code_attribution.py`、`tests/test_ai_code_attribution.py`)的
导入写法**不改**。

| 族 | 模块 | 内容 |
| --- | --- | --- |
| ① 判据(唯一真源) | `app/core/ai_code_attribution_verdict.py` | 三态取值 / AI·人手工具登记表 / 理由码 / 归一化与判定纯函数 |
| ② 记录构造 | `app/core/ai_code_attribution_record.py` | `make_record` / `AttributionRecord` / `HunkAnchor` / hunk 标识 / diff 行区间 |
| ③ 统计 | `app/core/ai_code_attribution_stats.py` | `compute_stats` / `AttributionStats` |
| ④ 回溯 | `app/core/ai_code_attribution_trace.py` | `resolve_anchor` / `TraceResult` |

**判据只有一份**:工具登记表与判定实现只在 ① 里(仓内 grep `AI_GENERATED_TOOLS`
只会命中那一处);本文件只做再导出,不复制任何常量表(§0.6 单一真相源)。

对标能力(取证册 docs/benchmark-evidence/2026-11/qoder-trae-workbuddy-rea-20261105/
T1-impl.md §3 第 5 行):按 (tool, file, hunk) 记「这段改动是 AI 生成还是人手写的」,
并给出足以事后用 git blame 回溯的锚。
"""

from __future__ import annotations

from app.core.ai_code_attribution_record import (
    HUNK_SUMMARY_MAX,
    AttributionRecord,
    HunkAnchor,
    compute_hunk_id,
    make_record,
    parse_diff_line_range,
)
from app.core.ai_code_attribution_stats import AttributionStats, compute_stats
from app.core.ai_code_attribution_trace import (
    TRACE_RESOLVED,
    TRACE_UNRESOLVED,
    BlameFn,
    TraceResult,
    resolve_anchor,
)
from app.core.ai_code_attribution_verdict import (
    AI_GENERATED_TOOLS,
    ATTRIBUTION_AI,
    ATTRIBUTION_HUMAN,
    ATTRIBUTION_UNKNOWN,
    ATTRIBUTION_VALUES,
    HUMAN_AUTHORED_TOOLS,
    REASON_AI_REGISTRY,
    REASON_HUMAN_REGISTRY,
    REASON_MISSING_INPUT,
    REASON_UNREGISTERED_TOOL,
    AttributionVerdict,
    classify,
    classify_attribution,
    normalize_tool_name,
)

__all__ = [
    # ① 判据
    "ATTRIBUTION_AI",
    "ATTRIBUTION_HUMAN",
    "ATTRIBUTION_UNKNOWN",
    "ATTRIBUTION_VALUES",
    "AI_GENERATED_TOOLS",
    "HUMAN_AUTHORED_TOOLS",
    "REASON_AI_REGISTRY",
    "REASON_HUMAN_REGISTRY",
    "REASON_MISSING_INPUT",
    "REASON_UNREGISTERED_TOOL",
    "AttributionVerdict",
    "classify",
    "classify_attribution",
    "normalize_tool_name",
    # ② 记录构造
    "HUNK_SUMMARY_MAX",
    "AttributionRecord",
    "HunkAnchor",
    "compute_hunk_id",
    "make_record",
    "parse_diff_line_range",
    # ③ 统计
    "AttributionStats",
    "compute_stats",
    # ④ 回溯
    "TRACE_RESOLVED",
    "TRACE_UNRESOLVED",
    "BlameFn",
    "TraceResult",
    "resolve_anchor",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
