# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""并行编辑冲突检测与消解(多 agent 团队协作的编辑层,2026-11-07 立)。

为什么要有这一层
  既有团队协作(`agent_teams.TeamOrchestrator`)只做了"并行 fan-out + 结论聚合":
  多个 subagent 同时改同一文件时,谁后写谁赢(或 second 编辑直接 `CONFLICT` 后
  无人裁决)——**没有任何一方能看到"这次并行为什么只保留了这份改动"**。
  `merge3.py` 解决的是另一件事:单个 agent 的编辑 vs 磁盘被外部改过。它拿不到
  N 个 agent 的编辑意图,也就无法做跨 agent 的区域判定。

本模块补的就是这一段:把 N 份结构化编辑意图放到**同一份 base 快照**上做区域
定位,输出三态决策(封闭集,不得新增第四态):

  ① ``merged``          各 agent 的修改区间在 base 上互不相交 → 全部保留,
                         内容按 base 偏移从后往前应用(避免偏移漂移),并做
                         长度守恒 + 内容存在性双重校验;校验不过按 ③ 处理。
  ② ``conflict``        跨 agent 的行区间重叠 → **整批拒绝写入**,列出重叠对
                         与双方行区间;不做 last-write-wins,也不静默取一方。
                         同一行即使字符位置不重叠也算同区域(保守判据:行粒度是
                         「能定位到行区间」的最低保证,字符级缝隙不放大承诺)。
  ③ ``replan_required`` 无法判定:base 缺失 / base_revision 不匹配 / anchor 在
                         base 里找不到或存在多处 / 整文件覆盖与其它编辑并存 /
                         意图本身坏掉 → 拒并要求重规划,不猜。

三条纪律:
  ① **纯函数、无 I/O**:定位/判定/合并全部是纯计算,相同输入必得相同输出,
     输入顺序打乱也得到同一决策(内部先按 path/agent/偏移排序);
  ② **不静默**:冲突与无法判定都随返回值上抛(带结构化明细),调用方不存在
     "拿到空结果继续写盘"的路径 —— 非 merged 时 `content` 恒为 None;
  ③ **可回答"为什么保留"**:每个文件的 apply_order、区间、冲突对、理由串都
     进决策体;`TeamEditAuditor` 再把决策写进既有审计面(`audit_log`)与既有
     编排事件总线(`orchestration_hub`,`subagent.*` 族的新子类型,不新开帧族)。
"""

from __future__ import annotations

import hashlib
import logging
from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass, field
from typing import Any, Literal

logger = logging.getLogger(__name__)

# =============================================================================
# 对外契约(封闭集)
# =============================================================================

EditDecisionStatus = Literal["merged", "conflict", "replan_required"]
EDIT_DECISION_STATUSES: frozenset[str] = frozenset(
    {"merged", "conflict", "replan_required"}
)

# 无法判定的封闭原因码。禁止在此集合之外产生值;读侧遇到未知值一律按
# replan_required 处理(fail-closed),绝不降级成 merged。
REPLAN_REASONS: tuple[str, ...] = (
    "base_missing",             # 调用方没给该文件的 base 快照
    "base_revision_mismatch",   # agent 看到的 base 与本次共享 base 不是同一版
    "anchor_not_in_base",       # old_string 在 base 中 0 命中,区域无从定位
    "ambiguous_anchor",         # old_string 多处命中且未声明 replace_all
    "concurrent_overwrite",     # 整文件覆盖与他人编辑并存,区域无法判定
    "invalid_intent",           # 意图结构损坏(缺 agent/path、类型不对等)
    "verification_failed",      # 合并结果未通过长度/内容校验
)

# 事件子类型:复用既有 `subagent.*` 事件族(票面 D121:禁新开 SSE 帧族),
# 读出口是既有 `GET /api/orchestration/events?event_type=subagent.edit_conflict_resolution`。
TEAM_EDIT_EVENT_TYPE = "subagent.edit_conflict_resolution"
# 审计动作名(落 `audit_log` 的操作级审计面)。
TEAM_EDIT_AUDIT_ACTION = "team.edit_conflict_resolution"


# =============================================================================
# 数据模型
# =============================================================================


@dataclass(frozen=True)
class EditIntent:
    """一个 agent 对单个文件的一次编辑意图(base 坐标系)。

    ``old_string`` 为空 = 整文件覆盖;``base_revision`` 非空时必须与共享 base
    的 sha256 一致,否则视为"看到的是另一版",不参与区域合并。
    ``parse_error`` 非空表示这份意图已损坏(来自外部 dict 解析失败),按
    ①②③ 的 ③ 拒绝,而不是悄悄丢掉 —— 丢掉一份编辑本身就是静默丢改动。
    """

    agent: str
    path: str
    old_string: str = ""
    new_string: str = ""
    replace_all: bool = False
    base_revision: str = ""
    parse_error: str = ""

    @classmethod
    def from_dict(cls, raw: Any) -> EditIntent:
        """从外部 dict 解析;结构不对抛 ValueError(由调用方转成坏意图)。"""
        if not isinstance(raw, dict):
            raise ValueError("编辑意图不是对象")
        path = str(raw.get("path", "") or "").strip()
        agent = str(raw.get("agent", "") or "").strip()
        if not path:
            raise ValueError("编辑意图缺少 path")
        if not agent:
            raise ValueError("编辑意图缺少 agent")
        old_string = raw.get("old_string", "")
        new_string = raw.get("new_string", "")
        if not isinstance(old_string, str) or not isinstance(new_string, str):
            raise ValueError("old_string/new_string 必须是字符串")
        replace_all = raw.get("replace_all", False)
        if not isinstance(replace_all, bool):
            raise ValueError("replace_all 必须是布尔值")
        base_revision = raw.get("base_revision", "")
        if not isinstance(base_revision, str):
            raise ValueError("base_revision 必须是字符串")
        return cls(
            agent=agent,
            path=path,
            old_string=old_string,
            new_string=new_string,
            replace_all=replace_all,
            base_revision=base_revision,
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "agent": self.agent,
            "path": self.path,
            "old_string": self.old_string,
            "new_string": self.new_string,
            "replace_all": self.replace_all,
            "base_revision": self.base_revision,
            "parse_error": self.parse_error,
        }


@dataclass(frozen=True)
class _LocatedEdit:
    """编辑意图在 base 中的确切位置(offset + 行区间,均为 0-based 半开区间)。"""

    intent: EditIntent
    start: int
    end: int
    start_line: int
    end_line: int

    def to_dict(self) -> dict[str, Any]:
        return {
            "agent": self.intent.agent,
            "start": self.start,
            "end": self.end,
            "start_line": self.start_line,
            "end_line": self.end_line,
            "replace_all": self.intent.replace_all,
        }


@dataclass
class FileResolution:
    """单文件消解结果。``content`` 仅在 merged 时非 None —— 非 merged 绝不提供
    可写内容,避免调用方"顺手写盘"绕过冲突。"""

    path: str
    status: EditDecisionStatus
    base_revision: str = ""
    content: str | None = None
    apply_order: list[dict[str, Any]] = field(default_factory=list)
    conflicts: list[dict[str, Any]] = field(default_factory=list)
    undeterminable: list[dict[str, Any]] = field(default_factory=list)
    rationale: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "path": self.path,
            "status": self.status,
            "base_revision": self.base_revision,
            "content": self.content,
            "apply_order": self.apply_order,
            "conflicts": self.conflicts,
            "undeterminable": self.undeterminable,
            "rationale": self.rationale,
        }


@dataclass
class EditResolution:
    """整批编辑意图的消解决策(团队一轮对应一份)。"""

    status: EditDecisionStatus
    files: list[FileResolution] = field(default_factory=list)
    conflicts: list[dict[str, Any]] = field(default_factory=list)
    undeterminable: list[dict[str, Any]] = field(default_factory=list)
    applied_edits: list[dict[str, Any]] = field(default_factory=list)
    rationale: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "files": [f.to_dict() for f in self.files],
            "conflicts": self.conflicts,
            "undeterminable": self.undeterminable,
            "applied_edits": self.applied_edits,
            "rationale": self.rationale,
        }

    def summary(self) -> dict[str, Any]:
        """紧凑摘要(事件载荷用;不含文件正文,避免把内容灌进事件流)。"""
        return {
            "status": self.status,
            "rationale": self.rationale,
            "paths": [f.path for f in self.files],
            "conflict_pairs": len(self.conflicts),
            "undeterminable": len(self.undeterminable),
            "applied_edits": len(self.applied_edits),
        }


# =============================================================================
# 区域定位(纯计算)
# =============================================================================


def _revision(text: str) -> str:
    """base 内容指纹(sha256 十六进制;调用方与 agent 共用同一算法)。"""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _line_index(text: str, offset: int) -> int:
    """offset 所在行号(0-based)。"""
    return text.count("\n", 0, offset)


def _line_span(text: str, start: int, end: int) -> tuple[int, int]:
    """[start, end) 覆盖的 base 行区间 [start_line, end_line)。

    非空区间用 ``end - 1`` 定位末字符所在行,保证 "b" 与 "b\\n" 都只占一行。
    """
    if end <= start:
        line = _line_index(text, start)
        return line, line
    return _line_index(text, start), _line_index(text, end - 1) + 1


def _ranges_overlap(a: _LocatedEdit, b: _LocatedEdit) -> bool:
    """行区间是否重叠。

    零宽区间(理论上只出现在同一位置的纯插入)与同点另一区间视为重叠:
    两方在同一行同一位置插入,顺序不可判定 → 必须报冲突而不是挑一个先写。
    """
    if a.start_line == a.end_line and b.start_line == b.end_line:
        return a.start_line == b.start_line
    if a.start_line == a.end_line:
        return b.start_line <= a.start_line < b.end_line
    if b.start_line == b.end_line:
        return a.start_line <= b.start_line < a.end_line
    return a.start_line < b.end_line and b.start_line < a.end_line


def _locate(path: str, base: str, intent: EditIntent) -> tuple[list[_LocatedEdit], list[dict[str, Any]]]:
    """把一份意图定位到 base 的 offset/行区间;无法定位时返回原因。"""
    problems: list[dict[str, Any]] = []
    if intent.parse_error:
        problems.append(
            {
                "path": path,
                "agent": intent.agent,
                "reason": "invalid_intent",
                "detail": intent.parse_error,
            }
        )
        return [], problems
    if intent.base_revision and intent.base_revision != _revision(base):
        problems.append(
            {
                "path": path,
                "agent": intent.agent,
                "reason": "base_revision_mismatch",
                "detail": "agent 看到的 base 与本次共享 base 不是同一版",
            }
        )
        return [], problems

    if not intent.old_string:
        # 整文件覆盖:区域 = 全文,无法与他人编辑做区域级共存判定。
        return [
            _LocatedEdit(
                intent=intent,
                start=0,
                end=len(base),
                start_line=0,
                end_line=_line_span(base, 0, len(base))[1] if base else 0,
            )
        ], problems

    occurrences: list[int] = []
    cursor = base.find(intent.old_string)
    while cursor != -1 and (intent.replace_all or not occurrences):
        occurrences.append(cursor)
        if not intent.replace_all:
            break
        cursor = base.find(intent.old_string, cursor + len(intent.old_string))

    total = base.count(intent.old_string)
    if not occurrences:
        problems.append(
            {
                "path": path,
                "agent": intent.agent,
                "reason": "anchor_not_in_base",
                "detail": "old_string 在 base 中 0 命中",
            }
        )
        return [], problems
    if not intent.replace_all and total > 1:
        problems.append(
            {
                "path": path,
                "agent": intent.agent,
                "reason": "ambiguous_anchor",
                "detail": f"old_string 在 base 中命中 {total} 处,未声明 replace_all",
            }
        )
        return [], problems

    located: list[_LocatedEdit] = []
    for start in occurrences:
        end = start + len(intent.old_string)
        start_line, end_line = _line_span(base, start, end)
        located.append(
            _LocatedEdit(
                intent=intent,
                start=start,
                end=end,
                start_line=start_line,
                end_line=end_line,
            )
        )
    return located, problems


# =============================================================================
# 单文件消解
# =============================================================================


def _apply_located(base: str, located: list[_LocatedEdit]) -> str:
    """按 base 偏移从后往前应用,保证先应用的改动不改变后应用的偏移。"""
    out = base
    for item in sorted(located, key=lambda x: (x.start, x.end), reverse=True):
        out = out[: item.start] + item.intent.new_string + out[item.end :]
    return out


def _verify_merge(base: str, located: list[_LocatedEdit], merged: str) -> str:
    """合并结果双重校验:长度守恒 + 每份非空替换文本至少出现一次。

    不通过返回原因码(调用方转 replan_required),绝不放行"看起来合并成功"
    但实际丢了一份改动的结果。
    """
    expected_len = len(base) + sum(
        len(item.intent.new_string) - (item.end - item.start) for item in located
    )
    if len(merged) != expected_len:
        return "长度不守恒"
    for item in located:
        new_string = item.intent.new_string
        if new_string and new_string not in merged:
            return f"agent {item.intent.agent} 的替换文本未出现在合并结果中"
    return ""


def _resolve_file(
    path: str, base: str | None, intents: list[EditIntent]
) -> FileResolution:
    """单文件三态判定。判定顺序:无法判定 > 冲突 > 可合并。"""
    if base is None:
        return FileResolution(
            path=path,
            status="replan_required",
            undeterminable=[
                {
                    "path": path,
                    "agent": intent.agent,
                    "reason": "base_missing",
                    "detail": "调用方未提供该文件的 base 快照,区域无从判定",
                }
                for intent in intents
            ],
            rationale=f"{path}: 缺少 base 快照,拒绝猜测区域并要求重规划。",
        )

    located: list[_LocatedEdit] = []
    problems: list[dict[str, Any]] = []
    for intent in intents:
        item_edits, item_problems = _locate(path, base, intent)
        located.extend(item_edits)
        problems.extend(item_problems)

    # 整文件覆盖与他人编辑并存 → 区域不可判定(单独覆盖则合法)。
    has_overwrite = any(not intent.old_string for intent in intents)
    if has_overwrite and len(intents) > 1:
        problems.append(
            {
                "path": path,
                "agent": next(i.agent for i in intents if not i.old_string),
                "reason": "concurrent_overwrite",
                "detail": f"同一文件有 {len(intents)} 份编辑意图,其中含整文件覆盖",
            }
        )

    conflicts: list[dict[str, Any]] = []
    for idx, left in enumerate(located):
        for right in located[idx + 1 :]:
            if left.intent.agent == right.intent.agent:
                continue
            if not _ranges_overlap(left, right):
                continue
            conflicts.append(
                {
                    "path": path,
                    "agents": sorted([left.intent.agent, right.intent.agent]),
                    "regions": [left.to_dict(), right.to_dict()],
                    "identical_replacement": left.intent.new_string
                    == right.intent.new_string,
                }
            )

    apply_order = [
        item.to_dict()
        for item in sorted(located, key=lambda x: (x.start, x.end), reverse=True)
    ]

    if problems:
        reasons = sorted({str(p["reason"]) for p in problems})
        return FileResolution(
            path=path,
            status="replan_required",
            base_revision=_revision(base),
            apply_order=[],
            conflicts=conflicts,
            undeterminable=problems,
            rationale=(
                f"{path}: 无法判定修改区域(原因 {', '.join(reasons)}),整批拒绝,要求重规划。"
            ),
        )

    if conflicts:
        pairs = "; ".join(
            f"{'/'.join(c['agents'])} 在 base 行区间 "
            + " vs ".join(
                f"[{r['start_line']},{r['end_line']})" for r in c["regions"]
            )
            for c in conflicts
        )
        return FileResolution(
            path=path,
            status="conflict",
            base_revision=_revision(base),
            apply_order=[],
            conflicts=conflicts,
            rationale=(
                f"{path}: 检测到 {len(conflicts)} 对跨 agent 行区间重叠({pairs});"
                "整批拒绝写入,不做 last-write-wins,要求重规划或人工裁决。"
            ),
        )

    merged = _apply_located(base, located)
    failure = _verify_merge(base, located, merged)
    if failure:
        return FileResolution(
            path=path,
            status="replan_required",
            base_revision=_revision(base),
            apply_order=[],
            undeterminable=[
                {
                    "path": path,
                    "agent": "",
                    "reason": "verification_failed",
                    "detail": failure,
                }
            ],
            rationale=f"{path}: 合并校验未通过({failure}),整批拒绝,要求重规划。",
        )

    agents = sorted({item.intent.agent for item in located})
    spans = ", ".join(
        f"{item.intent.agent}:[{item.start_line},{item.end_line})" for item in located
    )
    return FileResolution(
        path=path,
        status="merged",
        base_revision=_revision(base),
        content=merged,
        apply_order=apply_order,
        rationale=(
            f"{path}: {len(agents)} 位 agent 的 {len(located)} 处改动在 base 行区间"
            f"互不相交({spans}),全部保留;应用顺序按 base 偏移从后往前,避免偏移漂移。"
        ),
    )


# =============================================================================
# 整批消解入口(纯函数)
# =============================================================================


_STATUS_RANK: dict[str, int] = {"merged": 0, "conflict": 1, "replan_required": 2}


def resolve_team_edit_conflicts(
    intents: list[EditIntent], bases: Mapping[str, str]
) -> EditResolution:
    """对同一轮并行产生的全部编辑意图做冲突检测与消解。

    :param intents: 各 agent 的编辑意图(顺序无关,内部会排序)
    :param bases:   共享 base 快照 path → 内容(缺失即 replan_required)
    """
    if not intents:
        return EditResolution(status="merged", rationale="无并行编辑,无需消解。")

    broken = [intent for intent in intents if intent.parse_error]
    if broken:
        # 损坏的意图连"改哪个文件"都不成立,区域判定无从谈起 → 整批重规划,
        # 且不能落到 base_missing(那是另一类原因,混用会让归因失真)。
        return EditResolution(
            status="replan_required",
            undeterminable=[
                {
                    "path": intent.path,
                    "agent": intent.agent,
                    "reason": "invalid_intent",
                    "detail": intent.parse_error,
                }
                for intent in broken
            ],
            rationale=(
                f"整批 {len(intents)} 份编辑意图中有 {len(broken)} 份结构损坏,"
                "整批拒绝并要求重规划;损坏意图不得静默丢弃。"
            ),
        )

    ordered = sorted(
        intents,
        key=lambda i: (i.path, i.agent, i.old_string, i.new_string, i.parse_error),
    )
    grouped: dict[str, list[EditIntent]] = {}
    for intent in ordered:
        grouped.setdefault(intent.path, []).append(intent)

    files: list[FileResolution] = []
    for path in sorted(grouped):
        base = bases.get(path)
        if not isinstance(base, str):
            base = None
        files.append(_resolve_file(path, base, grouped[path]))

    status: EditDecisionStatus = "merged"
    for file_result in files:
        if _STATUS_RANK[file_result.status] > _STATUS_RANK[status]:
            status = file_result.status

    conflicts = [c for f in files for c in f.conflicts]
    undeterminable = [u for f in files for u in f.undeterminable]
    applied: list[dict[str, Any]] = []
    if status == "merged":
        applied = [
            {"path": f.path, **item}
            for f in files
            for item in f.apply_order
        ]

    if status == "replan_required":
        rationale = (
            f"整批 {len(intents)} 份编辑意图无法安全消解(不可判定 {len(undeterminable)} 项),"
            "拒绝写入并要求重规划;未做任何静默取舍。"
        )
    elif status == "conflict":
        rationale = (
            f"整批 {len(intents)} 份编辑意图检测到 {len(conflicts)} 对区域重叠,"
            "拒绝写入(不做 last-write-wins),要求重规划或人工裁决。"
        )
    else:
        rationale = (
            f"整批 {len(intents)} 份编辑意图在 {len(files)} 个文件上区域互不相交,"
            "全部保留并给出确定性应用顺序。"
        )

    return EditResolution(
        status=status,
        files=files,
        conflicts=conflicts,
        undeterminable=undeterminable,
        applied_edits=applied,
        rationale=rationale,
    )


# =============================================================================
# 审计 / 追踪落点(既有审计面 + 既有编排事件总线)
# =============================================================================

EditEventSink = Callable[[str, dict[str, Any]], Awaitable[str]]
AuditRecorder = Callable[[str, str, str, dict[str, Any] | None], str | None]


async def _emit_edit_event_to_hub(event_type: str, payload: dict[str, Any]) -> str:
    """默认事件出口:投到既有编排事件总线(惰性 import,避免循环依赖)。"""
    from .orchestration_hub import orchestration_hub

    event_id: str = await orchestration_hub.emit(
        event_type=event_type,
        source_pillar="subagent",
        payload=payload,
    )
    return event_id


def _record_edit_audit(
    action: str, actor: str, target: str, detail: dict[str, Any] | None
) -> str | None:
    """默认审计出口:既有操作级审计面(`audit_log`),返回条目 id。"""
    from .audit_log import record as record_audit

    entry = record_audit(action=action, actor=actor, target=target, detail=detail)
    return entry.id


def build_edit_audit_detail(
    team_id: str, round_id: str, resolution: EditResolution
) -> dict[str, Any]:
    """构造审计明细:必须能回答"这次并行保留了哪份改动、为什么"。"""
    return {
        "team_id": team_id,
        "round_id": round_id,
        "status": resolution.status,
        "rationale": resolution.rationale,
        "files": [
            {
                "path": f.path,
                "status": f.status,
                "base_revision": f.base_revision,
                "apply_order": f.apply_order,
                "conflicts": f.conflicts,
                "undeterminable": f.undeterminable,
                "rationale": f.rationale,
            }
            for f in resolution.files
        ],
        "applied_edits": resolution.applied_edits,
    }


class TeamEditAuditor:
    """把消解决策写进既有审计/追踪面。

    投递失败只告警、不回滚决策 —— 决策是纯函数算出来的,事件/审计是留痕面;
    与 `TeamTaskBoard._emit_handoff` 同一条纪律。但失败原因会随回执上抛
    (``audit_error`` / ``event_error``),不假装"已留痕"。
    """

    def __init__(
        self,
        sink: EditEventSink | None = None,
        recorder: AuditRecorder | None = None,
    ) -> None:
        self._sink: EditEventSink = sink or _emit_edit_event_to_hub
        self._recorder: AuditRecorder = recorder or _record_edit_audit

    async def record_resolution(
        self, team_id: str, round_id: str, resolution: EditResolution
    ) -> dict[str, Any]:
        """写审计 + 发事件;返回留痕回执(audit_id / event_id 及失败原因)。"""
        target = team_id or ",".join(f.path for f in resolution.files)
        audit_id: str | None = None
        audit_error = ""
        try:
            audit_id = self._recorder(
                TEAM_EDIT_AUDIT_ACTION,
                "agent_teams",
                target,
                build_edit_audit_detail(team_id, round_id, resolution),
            )
        except Exception as e:  # noqa: BLE001 - 留痕面故障不得让消解结果消失
            audit_error = str(e)
            logger.warning("[agent_edit_conflicts] 审计写入失败(决策仍有效): %s", e)

        event_id: str | None = None
        event_error = ""
        try:
            event_id = await self._sink(
                TEAM_EDIT_EVENT_TYPE,
                {
                    "team_id": team_id,
                    "round_id": round_id,
                    **resolution.summary(),
                    "at": _now_iso(),
                },
            )
        except Exception as e:  # noqa: BLE001
            event_error = str(e)
            logger.warning("[agent_edit_conflicts] 事件投递失败(决策仍有效): %s", e)

        return {
            "audit_id": audit_id,
            "audit_error": audit_error,
            "event_id": event_id,
            "event_error": event_error,
            "status": resolution.status,
        }


def _now_iso() -> str:
    """UTC ISO8601(秒级),与团队任务板同一格式。"""
    import time

    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


# 模块级单例(团队编排与路由共用)
team_edit_auditor = TeamEditAuditor()
