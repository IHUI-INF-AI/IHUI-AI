# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""检索召回扩边与行区间折叠的纯函数层(goal-b49 Z12,triage ② #4/#5)。

逆向对照 = Trae/qoder 检索面的两跳:`expand_by_symbols`(命中符号名后再补一跳召回)
与 `adjacent_chunk_merge` + `mergeGapLines`(同文件邻近行区间就近并片)。本仓此前两格都是
**零命中**:`codebase_indexer.search()` 只把 API 回来的切片原样交出 —— 既没有"以命中符号
为种子再捞一次",也没有把同文件碎片并成一区间(同一片代码占两个上下文槽)。

三条自己的规矩(超越档):
1. **纯函数、零 IO**:切片键名在本仓有两套形态(api 侧 camel、消费侧 snake),归一化
   只住 `hit_field` 一处(§0.6)。
2. **折叠不得静默吞行**:被 gap 跳过的行必须在 `content` 里留显式标记并计数
   (`gap_lines_skipped`)——"看起来并得更干净"不等于"信息没少"。
3. **符号种子只认真符号**:合成摘要片(`module_summary`/`architecture_summary`)的
   `symbol_name` 是目录名/文件名,当查询词会把整仓摘要互相拉进来 ⇒ 排除集由调用方给。
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence
from typing import Any

#: 折叠后仍要回显的键(消费方据此判"这一片是几条并成的",不得当成原始切片)
MERGED_COUNT_KEY = "lines_merged"
MERGED_RANGES_KEY = "merged_ranges"
GAP_SKIPPED_KEY = "gap_lines_skipped"
EXPANDED_KEY = "symbol_expanded"
EXPANDED_FROM_KEY = "expanded_from"

#: 切片键名的两套形态(单源归一;新增别名只许改这里)
_FIELD_ALIASES: dict[str, tuple[str, ...]] = {
    "file_path": ("file_path", "filePath", "path"),
    "line_start": ("line_start", "lineStart"),
    "line_end": ("line_end", "lineEnd"),
    "symbol_name": ("symbol_name", "symbolName"),
    "symbol_type": ("symbol_type", "symbolType"),
    "fused_from": ("fused_from", "fusedFrom"),
    "content": ("content",),
    "score": ("score",),
}


def hit_field(hit: Mapping[str, Any], field: str, default: Any = None) -> Any:
    """按归一化字段名取切片值(别名表单源;未知字段名直接报错,不静默返回 None)。"""
    for name in _FIELD_ALIASES.get(field, (field,)):
        value = hit.get(name)
        if value is not None and value != "":
            return value
    return default


def hit_identity(hit: Mapping[str, Any]) -> tuple[str, int, int]:
    """切片的身份键 = (相对路径, 起行, 止行)——去重与并片的唯一主键。"""
    return (
        str(hit_field(hit, "file_path", "")),
        int(hit_field(hit, "line_start", 0) or 0),
        int(hit_field(hit, "line_end", 0) or 0),
    )


def truncate_chunk(content: str, *, max_chars: int) -> str:
    """切片长度帽的唯一实现(全仓 `[:MAX_CHUNK_CHARS]` 五处重复收在这一格,§0.6)。"""
    if max_chars <= 0:
        raise ValueError(f"切片上限必须为正数,收到 {max_chars}")
    return content if len(content) <= max_chars else content[:max_chars]


def merge_line_spans(
    spans: Iterable[tuple[int, int]], *, gap_lines: int = 0
) -> list[tuple[int, int]]:
    """行区间就近合并(纯函数):重叠或间隔 ≤ `gap_lines` 的区间并成一枚。

    - 输入无序、可重复;输出按起行升序,且区间互不相邻(再喂一次结果 ⇒ 逐字节相同,幂等)。
    - 间隔语义:相邻两区间之间**被跳过的行数** = `next_start - prev_end - 1`;
      `gap_lines=0` 时只并真正重叠/相接的区间。
    - 畸形输入(起行 > 止行、负行号)⇒ `ValueError`:判据不能"跳过了当没有"。
    """
    if gap_lines < 0:
        raise ValueError(f"合并间隔不能为负,收到 {gap_lines}")
    cleaned: list[tuple[int, int]] = []
    for raw in spans:
        start, end = int(raw[0]), int(raw[1])
        if start <= 0 or end < start:
            raise ValueError(f"行区间形态不合:L{start}-L{end}(行号 1-based 且起 ≤ 止)")
        cleaned.append((start, end))
    out: list[tuple[int, int]] = []
    for start, end in sorted(cleaned):
        if out and start - out[-1][1] - 1 <= gap_lines:
            out[-1] = (out[-1][0], max(out[-1][1], end))
        else:
            out.append((start, end))
    return out


def _union_fused(members: Sequence[Mapping[str, Any]]) -> str | None:
    """来源并集:与 mcp_server 的 `fused_from` 同形态(`+` 连接、去重、稳定序)。"""
    parts: list[str] = []
    for hit in members:
        raw = hit_field(hit, "fused_from")
        for piece in str(raw or "").split("+"):
            token = piece.strip()
            if token and token not in parts:
                parts.append(token)
    return "+".join(parts) if parts else None


def gap_marker(skipped: int, start: int, end: int) -> str:
    """被跳过行的显式回显(折叠不吞信息的可见形态)。"""
    return f"... [folded-gap: {skipped} 行未纳入 L{start}-L{end}] ..."


def fold_adjacent_hits(
    hits: Sequence[Mapping[str, Any]],
    *,
    gap_lines: int = 0,
    max_chars: int | None = None,
) -> list[dict[str, Any]]:
    """同文件邻近切片就近并片(消费点在 `codebase_indexer.search()` 出口)。

    规则:按文件分组(分组顺序 = 首次出现序,保持稳定);组内按起行升序扫描,与已开片段
    间隔 ≤ `gap_lines` 的并入同一片。片头取组内**分片分最高**那条作底稿(并片不得把排序
    证据丢掉),`score` 取成员最大值。产物带三格账:`lines_merged`(并掉几条)、
    `merged_ranges`(原始区间)、`gap_lines_skipped`(+ `content` 里的显式 gap 标记);
    返回的是浅拷贝,绝不改调用方传进来的字典。
    """
    if gap_lines < 0:
        raise ValueError(f"合并间隔不能为负,收到 {gap_lines}")
    groups: dict[str, list[Mapping[str, Any]]] = {}
    order: list[str] = []
    for hit in hits:
        path = str(hit_field(hit, "file_path", ""))
        if path not in groups:
            groups[path] = []
            order.append(path)
        groups[path].append(hit)

    out: list[dict[str, Any]] = []
    for path in order:
        members = groups[path]
        runs: list[list[Mapping[str, Any]]] = []
        for hit in sorted(members, key=lambda h: (hit_identity(h)[1], hit_identity(h)[2], path)):
            span = (int(hit_field(hit, "line_start", 0) or 0), int(hit_field(hit, "line_end", 0) or 0))
            if span[0] <= 0 or span[1] < span[0]:
                raise ValueError(f"{path} 的切片行区间形态不合:L{span[0]}-L{span[1]}")
            if runs and span[0] - int(hit_field(runs[-1][-1], "line_end", 0) or 0) - 1 <= gap_lines:
                runs[-1].append(hit)
            else:
                runs.append([hit])

        for run in runs:
            host = max(run, key=lambda h: float(hit_field(h, "score", 0.0) or 0.0))
            merged = dict(host)
            parts: list[str] = []
            ranges: list[tuple[int, int]] = []
            skipped_total = 0
            cursor_end = 0
            for hit in run:
                start = int(hit_field(hit, "line_start", 0) or 0)
                end = int(hit_field(hit, "line_end", 0) or 0)
                ranges.append((start, end))
                if cursor_end and start - cursor_end - 1 > 0:
                    skipped = start - cursor_end - 1
                    skipped_total += skipped
                    parts.append(gap_marker(skipped, cursor_end + 1, start - 1))
                parts.append(str(hit_field(hit, "content", "")))
                cursor_end = max(cursor_end, end)
            content = "\n".join(parts)
            if max_chars is not None:
                content = truncate_chunk(content, max_chars=max_chars)
            merged["content"] = content
            merged["line_start"] = min(start for start, _ in ranges)
            merged["line_end"] = max(end for _, end in ranges)
            merged["score"] = max(float(hit_field(h, "score", 0.0) or 0.0) for h in run)
            if len(run) > 1:
                merged[MERGED_COUNT_KEY] = len(run) - 1
                merged[MERGED_RANGES_KEY] = [list(r) for r in ranges]
                names = {str(hit_field(h, "symbol_name", "") or "") for h in run}
                if len(names) > 1:
                    merged["symbol_ambiguous"] = True
            if skipped_total:
                merged[GAP_SKIPPED_KEY] = skipped_total
            fused = _union_fused(run)
            if fused is not None:
                merged["fused_from"] = fused
            out.append(merged)
    return out


def symbol_seeds(
    hits: Sequence[Mapping[str, Any]],
    *,
    limit: int = 2,
    exclude_symbol_types: Iterable[str] = (),
) -> list[str]:
    """从命中片里取"下一跳"的符号种子(排除合成摘要片;按分片分降序、去重、有界)。"""
    banned = {str(t) for t in exclude_symbol_types}
    ranked = sorted(hits, key=lambda h: -float(hit_field(h, "score", 0.0) or 0.0))
    seeds: list[str] = []
    seen_types: set[tuple[str, str]] = set()
    for hit in ranked:
        name = str(hit_field(hit, "symbol_name", "") or "").strip()
        stype = str(hit_field(hit, "symbol_type", "") or "").strip()
        if not name or stype in banned or name in seeds:
            continue
        if (name, stype) in seen_types:
            continue
        seen_types.add((name, stype))
        seeds.append(name)
        if limit > 0 and len(seeds) >= limit:
            break
    return seeds


def merge_recall(
    base: Sequence[Mapping[str, Any]],
    extra: Sequence[Mapping[str, Any]],
    *,
    seed: str,
) -> tuple[list[dict[str, Any]], int]:
    """把"补一跳"捞回的候选并入原命中集(身份键去重 ⇒ 绝不把已命中片复制成两份)。

    返回 `(并集, 新增枚数)`;新增条目按原序追加,并逐条打 `symbol_expanded` /
    `expanded_from`(哪枚符号种子把它拉进来的)。
    """
    out: list[dict[str, Any]] = [dict(h) for h in base]
    taken = {hit_identity(h) for h in base}
    added = 0
    for hit in extra:
        key = hit_identity(hit)
        if key in taken:
            continue
        taken.add(key)
        row = dict(hit)
        row[EXPANDED_KEY] = True
        row[EXPANDED_FROM_KEY] = seed
        out.append(row)
        added += 1
    return out, added


__test__ = {
    "hit_field": hit_field, "hit_identity": hit_identity, "truncate_chunk": truncate_chunk,
    "merge_line_spans": merge_line_spans, "fold_adjacent_hits": fold_adjacent_hits,
    "symbol_seeds": symbol_seeds, "merge_recall": merge_recall,
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
