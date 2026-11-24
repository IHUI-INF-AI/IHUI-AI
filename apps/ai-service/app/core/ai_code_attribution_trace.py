# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AI 代码归属账的**回溯族**(2026-11-05,goal-b49)。

裁决一条锚**回溯得出还是回溯不出**。纯函数:blame 的执行由调用方注入
(``blame_fn``),本模块只做裁决,不自己跑 git —— IO 与判据分离。

回溯不出就如实出声(§0.3「没判」不写成「判过」):
- 锚缺路径 ⇒ 「回溯不出:锚缺路径」;
- 锚缺提交 sha(改动尚未提交)⇒ 「回溯不出:改动尚未提交,无提交锚」;
- 锚缺行区间 ⇒ 「回溯不出:锚缺行区间」;
- blame 本身失败 ⇒ 「回溯不出:<blame 给的原因>」。

真跑 blame 的执行器在 app/services/ai_code_attribution_git.py。
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from app.core.ai_code_attribution_record import HunkAnchor

TRACE_RESOLVED = "resolved"
TRACE_UNRESOLVED = "unresolved"

#: blame 执行器签名:(commit_sha, path, line_start, line_end) → (成功?, 说明, 命中提交 sha 列表)。
BlameFn = Callable[[str, str, int, int], tuple[bool, str, tuple[str, ...]]]


@dataclass(frozen=True)
class TraceResult:
    """回溯裁决:成功还是回溯不出(附原因)。"""

    status: str
    detail: str
    commits: tuple[str, ...]


def resolve_anchor(anchor: HunkAnchor, blame_fn: BlameFn) -> TraceResult:
    """用 ``blame_fn`` 回溯锚;回溯不出 ⇒ unresolved + 原因(不假装成功)。

    "回溯不出"的口径(按序):锚缺路径 → 锚缺提交 sha(改动尚未提交 ⇒ 无从 blame)
    → 锚缺行区间 → blame 本身失败(带上 blame 给的原因)。
    """
    if not anchor.path.strip():
        return TraceResult(TRACE_UNRESOLVED, "回溯不出:锚缺路径", ())
    if not anchor.commit_sha.strip():
        return TraceResult(TRACE_UNRESOLVED, "回溯不出:改动尚未提交,无提交锚", ())
    if anchor.line_start <= 0 or anchor.line_end < anchor.line_start:
        return TraceResult(TRACE_UNRESOLVED, "回溯不出:锚缺行区间", ())
    ok, detail, commits = blame_fn(
        anchor.commit_sha, anchor.path, anchor.line_start, anchor.line_end
    )
    if not ok:
        return TraceResult(TRACE_UNRESOLVED, f"回溯不出:{detail}", ())
    return TraceResult(TRACE_RESOLVED, detail, commits)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
