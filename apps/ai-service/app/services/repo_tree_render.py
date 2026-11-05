# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""仓库目录骨架的按 token 预算渲染(MCP 工具 `render_repo_tree` 的实现层)。

逆向复现超越(goal-b47,2026-11-01,对齐 Qoder mtree 的
`renderTree({cwd, scope, maxTokens})`,取证见
`docs/benchmark-evidence/2026-11/qoder-trae-rea-20261101/T9-qoder-search-engine.md` §5「窗口渲染」):
上下文装箱不只装箱命中片,还装箱目录骨架。本仓此前**全仓零命中**(`render_tree` /
`repo_tree` / `directory_tree`),即"有清单、没有骨架"。

三条不跟对方一样含糊的规矩:
1. **枚举只走单源出口** `rg_fallback_parity.enumerate_code_files`(V75 判据 4:枚举语义只许住
   在那里);这里不写第二遍 `os.walk`。
2. **预算是硬约束,而且是量出来的**:token 估算复用 `context_compaction.estimate_tokens`
   (cl100k_base),落地前用整段文本再量一次 —— 超了就退尾行,绝不输出"看起来被截了但没人知道"的骨架。
3. **每一次没装进去都要有名字**:`dirs_dropped` / `files_dropped` / `files_scoped_out` /
   `duplicates_collapsed` 四格计数 + `drop_reason` + `complete` 布尔。
   调用方据此能判断"这份骨架是全仓还是被预算削过的"。
"""

import time
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from ..core.context_compaction import estimate_tokens
from .codebase_indexer import _EXT_TO_LANG, _IGNORED_DIRS, MAX_FILES_PER_INDEX
from .ignore_rules import DEFAULT_IGNORE_FILENAMES, filter_paths, load_ignore_set
from .repo_tree_weight import (
    DEFAULT_WEIGHTS,
    NodeFacts,
    WeightConfig,
    env_weight_config,
    order_rows,
)
from .rg_fallback_parity import enumerate_code_files

INDENT = "  "
LINE_TOKEN_COST = 1  # 行间换行按 1 token 记账(低估会让预算被突破,宁可高估)
DEFAULT_MAX_TOKENS = 2000
MIN_MAX_TOKENS = 32


def collect_node_facts(root: Path, rel_paths: Sequence[str]) -> tuple[dict[str, NodeFacts], int]:
    """落地层的 stat 采集(纯渲染层拿不到的两枚信号)→ (节点信号, 采集失败数)。

    - 文件行:自己的 mtime/size;目录行:**后代里最新的那枚 mtime** + 后代 size 之和
      (目录自己没有"上次改动"这个事实,借后代的)。
    - 单条 stat 失败(oserror:改名/权限/坏链)只计数不冒充 0 —— 拿 0 当"很新"会让权重
      把读不到的节点排到最前面。失败数由调用方写进 notes。
    """
    stamp = time.time()
    facts: dict[str, NodeFacts] = {}
    dir_age: dict[str, float] = {}
    dir_size: dict[str, int] = {}
    failed = 0
    for rel in rel_paths:
        try:
            st = (root / rel).stat()
        except OSError:
            failed += 1
            continue
        age = max(0.0, (stamp - st.st_mtime) / 86400.0)
        facts[rel] = NodeFacts(age_days=age, size_bytes=st.st_size)
        parts = rel.split("/")
        for i in range(len(parts) - 1):
            d = "/".join(parts[: i + 1])
            dir_age[d] = min(dir_age.get(d, age), age)
            dir_size[d] = dir_size.get(d, 0) + st.st_size
    for d, age in dir_age.items():
        facts[d] = NodeFacts(age_days=age, size_bytes=dir_size[d])
    return facts, failed


@dataclass
class TreeRow:
    """树里的一行:目录或文件。`path` 是相对 posix 路径,也是排序与父子判定的键。"""

    depth: int
    name: str
    path: str
    is_dir: bool
    parent: str


@dataclass
class TreeRender:
    """一次渲染的产出面 + 核算面。"""

    text: str
    tokens: int
    max_tokens: int
    dirs_shown: int = 0
    files_shown: int = 0
    dirs_dropped: int = 0
    files_dropped: int = 0
    files_scoped_out: int = 0
    duplicates_collapsed: int = 0
    files_ignored: int = 0
    enumerated: int = 0
    complete: bool = False
    drop_reason: str | None = None
    engine: str = ""
    degraded_reason: str | None = None
    fallback_detail: str | None = None
    scope: str | None = None
    notes: list[str] = field(default_factory=list)
    ignored_by: list[str] = field(default_factory=list)
    #: 排序档:"weighted"(带权 DFS) / "lexical"(纯词序,对照档)
    ranking: str = "lexical"
    #: 本轮**有信号源并真的参与打分**的维(名字与 `repo_tree_weight` 的表一一对应)
    dims_applied: list[str] = field(default_factory=list)
    #: 本轮惰性的维 —— 必须点名"为什么没有"(§0.3:不得用中性值冒充判过这一维)
    dims_inert: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "text": self.text,
            "tokens": self.tokens,
            "maxTokens": self.max_tokens,
            "dirsShown": self.dirs_shown,
            "filesShown": self.files_shown,
            "dirsDropped": self.dirs_dropped,
            "filesDropped": self.files_dropped,
            "filesScopedOut": self.files_scoped_out,
            "duplicatesCollapsed": self.duplicates_collapsed,
            "filesIgnored": self.files_ignored,
            "ignoredBy": list(self.ignored_by),
            "enumerated": self.enumerated,
            "complete": self.complete,
            "dropReason": self.drop_reason,
            "engine": self.engine,
            "degradedReason": self.degraded_reason,
            "fallbackDetail": self.fallback_detail,
            "scope": self.scope,
            "notes": self.notes,
            "ranking": self.ranking,
            "dimsApplied": self.dims_applied,
            "dimsInert": self.dims_inert,
        }


def _norm_rel(path: str) -> str:
    return path.replace("\\", "/").strip("/")


def build_rows(rel_paths: list[str], scope: str | None = None) -> tuple[list[TreeRow], dict[str, int]]:
    """相对路径清单 → 行集(目录由文件路径合成,只出现在真有内容的路径上)。

    返回的计数只三格:`scoped_out` / `duplicates` / `bad`(空串、`.`、纯斜杠这类不可用条目)。
    目录集合完全由文件派生 ⇒ 不会出现"空目录也被渲染进去"。
    """
    scope_key = _norm_rel(scope) if scope else ""
    files: set[str] = set()
    scoped_out = 0
    duplicates = 0
    bad = 0
    for raw in rel_paths:
        rel = _norm_rel(str(raw))
        if not rel or rel == "." or rel.endswith("/"):
            bad += 1
            continue
        if scope_key and not (rel == scope_key or rel.startswith(scope_key + "/")):
            scoped_out += 1
            continue
        if rel in files:
            duplicates += 1
            continue
        files.add(rel)

    dirs: set[str] = set()
    rows: dict[str, TreeRow] = {}
    for rel in files:
        parts = rel.split("/")
        for i in range(len(parts) - 1):
            dirs.add("/".join(parts[: i + 1]))
    for d in dirs:
        parent = d.rsplit("/", 1)[0] if "/" in d else ""
        rows[d] = TreeRow(
            depth=d.count("/"),
            name=d.rsplit("/", 1)[-1],
            path=d,
            is_dir=True,
            parent=parent,
        )
    for rel in files:
        parent = rel.rsplit("/", 1)[0] if "/" in rel else ""
        rows[rel] = TreeRow(
            depth=rel.count("/"),
            name=rel.rsplit("/", 1)[-1],
            path=rel,
            is_dir=False,
            parent=parent,
        )
    ordered = sorted(rows.values(), key=lambda r: (r.depth, 0 if r.is_dir else 1, r.path.lower(), r.path))
    return ordered, {"scoped_out": scoped_out, "duplicates": duplicates, "bad": bad}


def _line(row: TreeRow) -> str:
    return INDENT * row.depth + row.name + ("/" if row.is_dir else "")


def _fits(used: int, cost: int, max_tokens: int) -> bool:
    return used + cost <= max_tokens


def select_rows(rows: list[TreeRow], max_tokens: int) -> tuple[set[str], dict[str, int]]:
    """预算分配:**先保目录骨架,再按序补文件**。

    目录侧一旦有一枚装不下就停止收目录 ——  deeper 目录挂着未展示的父级会变成假树;
    文件侧继续扫(小文件可填缝),因为文件不影响父子完整性。
    """
    budget = max(int(max_tokens), 0)
    kept: set[str] = set()
    used = 0
    dirs_dropped = 0
    files_dropped = 0
    dirs_blocked = False

    for row in rows:
        if not row.is_dir:
            continue
        cost = estimate_tokens(_line(row)) + (LINE_TOKEN_COST if kept else 0)
        if dirs_blocked or not _fits(used, cost, budget):
            dirs_blocked = True
            dirs_dropped += 1
            continue
        used += cost
        kept.add(row.path)

    for row in rows:
        if row.is_dir:
            continue
        # 根级文件(parent == "")没有父目录行要依附;非根文件的父目录没进骨架时不能单独出现
        # —— 那部分展开量已由父级的 dirs_dropped 记过一笔,不再重复计文件。
        if row.parent and row.parent not in kept:
            continue
        cost = estimate_tokens(_line(row)) + LINE_TOKEN_COST
        if _fits(used, cost, budget):
            used += cost
            kept.add(row.path)
        else:
            files_dropped += 1
    return kept, {"dirs_dropped": dirs_dropped, "files_dropped": files_dropped}


def render_rows(
    rel_paths: list[str],
    *,
    max_tokens: int = DEFAULT_MAX_TOKENS,
    scope: str | None = None,
    enumerated: int | None = None,
    engine: str = "",
    degraded_reason: str | None = None,
    fallback_detail: str | None = None,
    files_ignored: int = 0,
    ignored_by: list[str] | None = None,
    weights: WeightConfig | None = DEFAULT_WEIGHTS,
    node_facts: Mapping[str, NodeFacts] | None = None,
) -> TreeRender:
    """纯渲染档(不碰磁盘):路径清单进、骨架文本与核算出。夹具与判据都吃这一层。

    排序档(2026-11-05 Z12 补):`weights` 给定时走**带权前序 DFS**(兄弟按权、父必先于子),
    `weights=None` 保留原词序档(正向对照与"只想看字母序"的调用方走这一支)。
    """
    budget = max(int(max_tokens), MIN_MAX_TOKENS)
    rows, counts = build_rows(rel_paths, scope)
    ranking = "lexical"
    dims_applied: list[str] = []
    dims_inert: list[str] = []
    orphans = 0
    if weights is not None:
        rows, orphans = order_rows(rows, weights, facts=node_facts)
        ranking = "weighted"
        dims_applied, dims_inert = weights.active_dims(node_facts)
    kept, dropped = select_rows(rows, budget)

    seq = {row.path: i for i, row in enumerate(rows)}
    shown = [r for r in rows if r.path in kept]
    shown.sort(key=lambda r: seq[r.path])
    lines = [_line(r) for r in shown]
    text = "\n".join(lines)
    tokens = estimate_tokens(text) if text else 0

    # 整段复量:逐行估算之和与整段编码结果不会逐字节相等(跨行 BPE 合并),
    # 以"整段量出来不超预算"为准 —— 超了就退尾行,退掉的计入 files_dropped/dirs_dropped。
    while text and tokens > budget:
        removed = lines.pop()
        text = "\n".join(lines)
        tokens = estimate_tokens(text) if text else 0
        row = next((r for r in reversed(shown) if _line(r) == removed), None)
        shown = [r for r in shown if _line(r) != removed]
        if row is not None:
            if row.is_dir:
                dropped["dirs_dropped"] += 1
            else:
                dropped["files_dropped"] += 1

    dirs_shown = sum(1 for r in shown if r.is_dir)
    files_shown = sum(1 for r in shown if not r.is_dir)
    total_enum = enumerated if enumerated is not None else len(rows)
    files_scoped_out = counts["scoped_out"]
    files_dropped = dropped["files_dropped"]
    dirs_dropped = dropped["dirs_dropped"]

    reason: str | None = None
    if files_scoped_out:
        reason = "scope"
    if dirs_dropped or files_dropped:
        reason = "budget" if reason is None else reason + "+budget"
    if degraded_reason:
        reason = "enum-degraded" if reason is None else reason + "+enum-degraded"
    if files_ignored:
        reason = "ignore" if reason is None else reason + "+ignore"

    notes: list[str] = []
    if counts["bad"]:
        notes.append(f"{counts['bad']} 条不可用路径条目被跳过(空串/纯目录名)")
    if orphans:
        notes.append(f"{orphans} 行没有可依附的父目录行(带权排序下仍原样保留在末尾)")

    return TreeRender(
        text=text,
        tokens=tokens,
        max_tokens=budget,
        dirs_shown=dirs_shown,
        files_shown=files_shown,
        dirs_dropped=dirs_dropped,
        files_dropped=files_dropped,
        files_scoped_out=files_scoped_out,
        duplicates_collapsed=counts["duplicates"],
        files_ignored=files_ignored,
        ignored_by=list(ignored_by or []),
        enumerated=total_enum,
        complete=(dirs_dropped == 0 and files_dropped == 0 and files_scoped_out == 0),
        drop_reason=reason,
        engine=engine,
        degraded_reason=degraded_reason,
        fallback_detail=fallback_detail,
        scope=_norm_rel(scope) if scope else None,
        notes=notes,
        ranking=ranking,
        dims_applied=dims_applied,
        dims_inert=dims_inert,
    )


def render_workspace_tree(
    root: Path,
    *,
    max_tokens: int = DEFAULT_MAX_TOKENS,
    scope: str | None = None,
    max_files: int | None = MAX_FILES_PER_INDEX,
    ignore_filenames: tuple[str, ...] | None = DEFAULT_IGNORE_FILENAMES,
    weights: WeightConfig | None = None,
) -> TreeRender:
    """落地档:枚举走单源出口,其余交回纯渲染层。

    `enumerated` 取枚举出口自报的 `counted`(不是渲染行数)⇒ "被预算削掉多少"的分母
    始终是"这次到底量到了多少文件",与懒索引护栏同一个数。

    ignore 剪枝在本层是"一律剪":骨架是**受预算约束的投影**,少显示一枚不影响内容还在仓里。
    索引面(P84,2026-11-01)另有一套口径 —— "跟踪但被 `.gitignore` 覆盖"的路径在那里
    **默认保留并点名**,因为从索引里剔掉等于内容从检索面消失;那套口径与理由写在
    `codebase_indexer.apply_index_ignore_rules`,两处共用同一个规则求值器(不各写一份)。
    """
    rel_paths, prov = enumerate_code_files(
        root,
        ignored_dirs=_IGNORED_DIRS,
        suffixes=tuple(_EXT_TO_LANG),
        max_files=max_files,
    )
    notes_extra: list[str] = []
    files_ignored = 0
    ignored_by: list[str] = []
    kept_paths = rel_paths
    if ignore_filenames:
        ignore = load_ignore_set(root, filenames=tuple(ignore_filenames))
        if ignore.rules:
            kept_paths, pruned = filter_paths(rel_paths, ignore)
            files_ignored = len(pruned)
            seen: set[str] = set()
            for _path, where in pruned:
                if where not in seen and len(seen) < 12:
                    seen.add(where)
                    ignored_by.append(where)
        notes_extra.extend(f"ignore 规则读不动:{e}" for e in ignore.errors)
    cfg = env_weight_config() if weights is None else weights
    node_facts: Mapping[str, NodeFacts] | None = None
    if cfg is not None and (cfg.time_decay_factor > 0.0 or cfg.size_impact_factor > 0.0):
        node_facts, facts_failed = collect_node_facts(root, kept_paths)
        if facts_failed:
            notes_extra.append(
                f"{facts_failed} 个节点 stat 读不到(时间/体积维对这些节点未判定,按中性处理)"
            )
    out = render_rows(
        kept_paths,
        max_tokens=max_tokens,
        scope=scope,
        enumerated=prov.counted,
        engine=prov.engine,
        degraded_reason=prov.degraded_reason,
        fallback_detail=prov.fallback_detail,
        files_ignored=files_ignored,
        ignored_by=ignored_by,
        weights=cfg,
        node_facts=node_facts,
    )
    out.notes.extend(notes_extra)
    return out


__test__ = {
    "build_rows": build_rows,
    "select_rows": select_rows,
    "render_rows": render_rows,
    "estimate_tokens": estimate_tokens,
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
