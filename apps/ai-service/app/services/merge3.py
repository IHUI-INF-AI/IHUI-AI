# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""3-way merge 引擎(P1 1-2 补丁冲突处理,2026-09-08 立)。

语义对齐 git merge-file / diff3:
- ``base``   :公共祖先版本(agent 上次 read_file/write 看到的内容)
- ``theirs`` :磁盘当前内容(快照之后被外部修改过)
- ``ours``   :agent 基于 base 的期望结果(base 应用 old_string→new_string)

三方逐行 diff(difflib.SequenceMatcher)后按 base 行区间归并:
- 双方修改区间不相交 → 自动合并(干净合并);
- 相交(或紧邻,保守并簇)→ 冲突块,输出 ``<<<<<<< ours / ======= / >>>>>>> theirs``
  标记文本,并保留结构化冲突块供 ``resolve_conflicts`` 逐块决策
  (局部拒绝:某些块选 "theirs" 即拒绝 agent 在该块的修改、保留磁盘现状)。

纯函数无 IO,契约见 tests/test_merge3.py。
"""

from __future__ import annotations

import difflib
from dataclasses import dataclass, field
from typing import Any

OURS_MARKER = "<<<<<<< ours\n"
SEP_MARKER = "=======\n"
THEIRS_MARKER = ">>>>>>> theirs\n"


@dataclass
class ConflictBlock:
    """单个冲突块(结构化,供逐块决策与 UI 展示)。"""

    index: int
    base_start: int  # base 行区间 [start, end)
    base_end: int
    ours: list[str]
    theirs: list[str]


@dataclass
class MergeResult:
    """merge3 结果。

    clean=True 时 merged 为自动合并后的最终内容;
    clean=False 时 merged 为带冲突标记的内容(未写盘,由调用方决策)。
    """

    merged: str
    clean: bool
    conflicts: list[ConflictBlock] = field(default_factory=list)

    def conflict_count(self) -> int:
        return len(self.conflicts)


def _lines(text: str) -> list[str]:
    """按行切分(保留行尾,与磁盘内容一致;空文本返回空列表)。"""
    if not text:
        return []
    return text.splitlines(keepends=True)


def _replace_blocks(base: list[str], other: list[str]) -> list[tuple[int, int, list[str]]]:
    """base→other 的全部非 equal 块:[(i1, i2, other_lines)],按 base 顺序。

    纯插入块 i1==i2(在 base 第 i1 行前插入 other_lines)。
    """
    sm = difflib.SequenceMatcher(None, base, other, autojunk=False)
    return [
        (i1, i2, other[j1:j2])
        for tag, i1, i2, j1, j2 in sm.get_opcodes()
        if tag != "equal"
    ]


def merge3(base: str, theirs: str, ours: str) -> MergeResult:
    """三方合并 base/theirs/ours,返回 MergeResult。

    簇规则:双方块在 base 行区间上**重叠**(s < e)才并入同簇报冲突;
    相邻但不重叠的修改可确定性合并(ours 改第 i 行、theirs 改第 i+1 行,
    两侧改动无歧义)。同一行区间被双方修改 → 冲突,宁多报不静默丢改动。

    注意:调用方须保证三方文本行尾一致(建议统一 LF,见 mcp_server 的
    EOL 归一化),否则行尾差异会导致整文件视为单侧全改。
    """
    base_l = _lines(base)
    theirs_blocks = [(s, e, ln, "theirs") for s, e, ln in _replace_blocks(base_l, _lines(theirs))]
    ours_blocks = [(s, e, ln, "ours") for s, e, ln in _replace_blocks(base_l, _lines(ours))]
    blocks = sorted(theirs_blocks + ours_blocks, key=lambda b: (b[0], b[1]))

    out: list[str] = []
    conflicts: list[ConflictBlock] = []
    i = 0  # base 行指针
    k = 0
    while k < len(blocks):
        # 簇:从当前块开始,不断并入「起点 < 当前簇终点」的块(真正重叠)
        lo, hi = blocks[k][0], blocks[k][1]
        cluster = [blocks[k]]
        k += 1
        while k < len(blocks) and blocks[k][0] < hi:
            cluster.append(blocks[k])
            hi = max(hi, blocks[k][1])
            k += 1
        # 未修改的 equal 段
        if i < lo:
            out.extend(base_l[i:lo])
        i = max(i, hi)
        sides = {b[3] for b in cluster}
        if len(sides) == 1:
            # 单侧修改:顺序输出该侧替换文本
            for _, _, ln, _ in cluster:
                out.extend(ln)
        else:
            # 双侧冲突:标记文本 + 结构化块
            ours_txt = [line for b in cluster if b[3] == "ours" for line in b[2]]
            theirs_txt = [line for b in cluster if b[3] == "theirs" for line in b[2]]
            out.append(OURS_MARKER)
            out.extend(ours_txt)
            out.append(SEP_MARKER)
            out.extend(theirs_txt)
            out.append(THEIRS_MARKER)
            conflicts.append(
                ConflictBlock(
                    index=len(conflicts),
                    base_start=lo,
                    base_end=hi,
                    ours=ours_txt,
                    theirs=theirs_txt,
                )
            )
    if i < len(base_l):
        out.extend(base_l[i:])
    merged = "".join(out)
    return MergeResult(merged=merged, clean=not conflicts, conflicts=conflicts)


def merge3_for_edit(
    base: str, current: str, old_string: str, new_string: str, *, replace_all: bool = False
) -> MergeResult:
    """file_edit 场景包装:ours = base 应用 old→new 替换后的期望内容。"""
    if old_string and old_string in base:
        count = base.count(old_string)
        if replace_all:
            ours = base.replace(old_string, new_string)
        else:
            ours = base.replace(old_string, new_string, 1)
        del count  # 计数仅调试用途,不参与合并
    else:
        ours = base
    return merge3(base, current, ours)


def resolve_conflicts(
    base: str,
    current: str,
    old_string: str,
    new_string: str,
    choices: list[str],
    *,
    replace_all: bool = False,
) -> dict[str, Any]:
    """按块决策解决冲突(局部拒绝的核心载体),返回最终内容。

    choices 按冲突块顺序取值:"ours"(采用 agent 修改)/"theirs"(保留磁盘
    现状,即拒绝该块的 agent 修改)。choices 不足的块缺省 "ours"。
    无冲突时直接返回自动合并结果(等价于直接 merge)。
    """
    mr = merge3_for_edit(base, current, old_string, new_string, replace_all=replace_all)
    if mr.clean:
        return {"ok": True, "content": mr.merged, "conflicts": 0, "applied": []}
    if choices is None:
        choices = []

    base_l = _lines(base)
    # theirs 侧在冲突块的「外部修改后内容」:逐块换回 theirs 文本需要知道
    # theirs 文件在该 base 区间的实际行。由于 ours 替换只覆盖 old_string 区
    # 域,冲突块 theirs 行已在 mr 中捕获(cb.theirs);直接按 cb 决策。
    out: list[str] = []
    applied: list[dict[str, Any]] = []
    i = 0
    for cb in mr.conflicts:
        # 冲突块前的 equal 段(theirs 版本此时与 base 相同,直接取 base 行)
        if i < cb.base_start:
            out.extend(base_l[i : cb.base_start])
        choice = "ours"
        if cb.index < len(choices):
            choice = choices[cb.index] if choices[cb.index] in ("ours", "theirs") else "ours"
        out.extend(cb.ours if choice == "ours" else cb.theirs)
        applied.append({"index": cb.index, "choice": choice})
        i = max(i, cb.base_end)
    if i < len(base_l):
        out.extend(base_l[i:])
    return {"ok": True, "content": "".join(out), "conflicts": len(mr.conflicts), "applied": applied}
