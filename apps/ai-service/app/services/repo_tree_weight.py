# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""仓库目录骨架的**加权排序**(goal-b49 Z12 第三格,triage ② #8)。

对照程序的形态(取证只到字符串面,语义按本仓自定 —— 见
`docs/benchmark-evidence/2026-11/qoder-trae-rea-20261101/T12-mtree-and-hook-host.md`
§4 第 88 行的逐字字段清单):
`WeightConfig{fileTypeWeights, dirNameWeights, timeDecayFactor, sizeImpactFactor,
depthDecayFactor, dirBoostFactor, ignoreDirs, brokenLimit, hardLimit, sortLimit}`。

**本仓已有 vs 本格补的**(按需分批,不一次抄十维):

| 对方维 | 本仓现状(现读) | 本格处置 |
| --- | --- | --- |
| `depthDecayFactor` | 已有:排序键 `(depth, dir-first, path)` 里的 depth | 纳入权重式(同一处实现,不再两份) |
| `dirBoostFactor` | 已有:dir-first 的 0/1 硬档 | 换成可调倍率(硬档 ⇒ 倍率) |
| `ignoreDirs` | **已具备**:单源 `codebase_indexer._IGNORED_DIRS` + `ignore_rules` | 不在本层重抄(§0.6) |
| `hardLimit` | **已具备**:同职帽 `MAX_FILES_PER_INDEX`(枚举侧) | 不另造第二把尺 |
| `dirNameWeights` | 缺 | **补齐**(行名段查表) |
| `fileTypeWeights` | 缺 | **补齐**(扩展名查表) |
| `timeDecayFactor` | 缺,且**渲染纯层无信号源** | **补齐消费链**:由落地层 stat 注入(`node_facts`),默认惰性 |
| `sizeImpactFactor` | 同上 | 同上 |
| `brokenLimit` / `sortLimit` | 语义只在字符串面见到,未反编译出判据 | **本仓无该信号源**:不造空维(证据见交付册) |

排序**只在同一父级的兄弟之间做**并返回前序(父先于子)的 DFS 序 —— 全局按分数摊平会
造出"子行出现在父行之前"的假树,这是对方一档能力搬到本仓时必须补的边界。
"""

from __future__ import annotations

import math
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from typing import Protocol

INERT_NOTE = "维惰性:本轮无信号源(必须点名,不得用中性值冒充判过)"


class _Row(Protocol):
    """`repo_tree_render.TreeRow` 的结构形状(单向依赖,不反向 import,免成环)。"""

    @property
    def depth(self) -> int: ...

    @property
    def name(self) -> str: ...

    @property
    def path(self) -> str: ...

    @property
    def is_dir(self) -> bool: ...

    @property
    def parent(self) -> str: ...


@dataclass(frozen=True)
class NodeFacts:
    """落地层能注入、纯渲染层拿不到的两枚信号(时间/体积)。"""

    age_days: float | None = None
    size_bytes: int | None = None


def _table(pairs: tuple[tuple[str, float], ...]) -> Mapping[str, float]:
    """权重表的唯一构造形态:键一律小写(查表侧同样用 `.lower()`,不留两种口径)。"""
    return {k.lower(): v for k, v in pairs}


#: 目录名段权重(未命中表 ⇒ 1.0,即"中性",不是"不重要")
DEFAULT_DIR_NAME_WEIGHTS: Mapping[str, float] = _table((
    ("src", 1.6), ("app", 1.6), ("apps", 1.5), ("services", 1.5),
    ("packages", 1.4), ("core", 1.4), ("api", 1.3), ("lib", 1.2),
    ("tests", 0.9), ("test", 0.9), ("e2e", 0.9), ("scripts", 0.9),
    ("docs", 0.8), ("doc", 0.8), ("migrations", 0.8),
    ("assets", 0.7), ("static", 0.7), ("public", 0.7),
    ("examples", 0.6), ("playground", 0.6),
))

#: 文件类型权重(按后缀;表只覆盖本仓真实存在的语言族,`_EXT_TO_LANG` 是枚举口径)
DEFAULT_FILE_TYPE_WEIGHTS: Mapping[str, float] = _table((
    (".ts", 1.3), (".tsx", 1.35), (".js", 1.1), (".jsx", 1.15),
    (".py", 1.3), (".rs", 1.25), (".go", 1.25), (".java", 1.2),
    (".kt", 1.2), (".swift", 1.2), (".sql", 1.1), (".css", 0.9),
    (".scss", 0.9), (".json", 0.8), (".yaml", 0.8), (".yml", 0.8),
    (".toml", 0.8), (".md", 0.7), (".lock", 0.3), (".snap", 0.3),
))

#: 入口/骨架文件名权重(读代码时"先看的那几枚")
DEFAULT_ENTRY_NAME_WEIGHTS: Mapping[str, float] = _table((
    ("index.ts", 1.5), ("index.tsx", 1.5), ("main.ts", 1.5), ("main.py", 1.5),
    ("app.ts", 1.4), ("server.ts", 1.4), ("cli.ts", 1.35), ("mod.rs", 1.4),
    ("lib.rs", 1.35), ("package.json", 1.3), ("pyproject.toml", 1.3),
    ("cargo.toml", 1.3), ("readme.md", 1.2), ("agents.md", 1.2),
    ("schema.ts", 1.2), ("router.ts", 1.2),
))


@dataclass(frozen=True)
class WeightConfig:
    """一表权重 knobs(缺省即"本仓有信号源的维全开";系数 0 ⇒ 该维惰性)。"""

    dir_name_weights: Mapping[str, float] = field(default_factory=lambda: DEFAULT_DIR_NAME_WEIGHTS)
    file_type_weights: Mapping[str, float] = field(default_factory=lambda: DEFAULT_FILE_TYPE_WEIGHTS)
    entry_name_weights: Mapping[str, float] = field(default_factory=lambda: DEFAULT_ENTRY_NAME_WEIGHTS)
    depth_decay: float = 0.06
    dir_boost: float = 1.15
    time_decay_factor: float = 0.0
    size_impact_factor: float = 0.0

    def active_dims(self, facts: Mapping[str, NodeFacts] | None) -> tuple[list[str], list[str]]:
        """(出了力的维, 惰性的维) —— 惰性必须点名,不得用 1.0 冒充"判过这一维"。"""
        applied = ["dirName", "fileType", "entryName", "depth", "dirBoost"]
        inert: list[str] = []
        has_age = facts is not None and any(f.age_days is not None for f in facts.values())
        has_size = facts is not None and any(f.size_bytes is not None for f in facts.values())
        if self.time_decay_factor > 0.0 and has_age:
            applied.append("timeDecay")
        else:
            inert.append("timeDecay")
        if self.size_impact_factor > 0.0 and has_size:
            applied.append("sizeImpact")
        else:
            inert.append("sizeImpact")
        return applied, inert


def env_weight_config() -> WeightConfig:
    """生产侧唯一构造点:`IHUI_REPO_TREE_STAT_WEIGHTS=1` 才为时间/体积维付 stat 成本。

    默认关的**事实依据**:渲染层的 mtime/size 在本仓没有任何缓存源(快照 `SnapshotRead`
    只有 content-hash 与 simhash,枚举出口 `enumerate_code_files` 只返回路径),
    开这两维就等于每次渲染都逐文件 `stat()`。
    """
    import os

    cfg = DEFAULT_WEIGHTS
    raw = (os.environ.get("IHUI_REPO_TREE_STAT_WEIGHTS") or "").strip().lower()
    if raw in {"1", "true", "on", "yes"}:
        return WeightConfig(
            dir_name_weights=cfg.dir_name_weights,
            file_type_weights=cfg.file_type_weights,
            entry_name_weights=cfg.entry_name_weights,
            depth_decay=cfg.depth_decay,
            dir_boost=cfg.dir_boost,
            time_decay_factor=0.02,
            size_impact_factor=0.015,
        )
    return cfg


DEFAULT_WEIGHTS = WeightConfig()


def _suffix(name: str) -> str:
    lower = name.lower()
    dot = lower.rfind(".")
    return lower[dot:] if dot > 0 else ""


def row_weight(
    row: _Row,
    cfg: WeightConfig,
    *,
    facts: Mapping[str, NodeFacts] | None = None,
) -> float:
    """单行权重(≥0)。每一维都是**倍率**,不是加分 ⇒ 缺信号源的维乘 1.0 而不是乘 0。"""
    score = 1.0
    own = row.name.lower()
    if row.is_dir:
        score *= cfg.dir_name_weights.get(own, 1.0) * cfg.dir_boost
    else:
        parent_dir = row.path.rsplit("/", 2)[-2].lower() if "/" in row.path else ""
        score *= cfg.dir_name_weights.get(parent_dir, 1.0)
        score *= cfg.file_type_weights.get(_suffix(own), 1.0)
        score *= cfg.entry_name_weights.get(own, 1.0)
    decay = max(0.0, 1.0 - cfg.depth_decay)
    score *= decay ** max(0, int(row.depth))
    node = (facts or {}).get(row.path)
    if node is not None and cfg.time_decay_factor > 0.0 and node.age_days is not None:
        score *= 1.0 / (1.0 + cfg.time_decay_factor * max(0.0, node.age_days))
    if node is not None and cfg.size_impact_factor > 0.0 and node.size_bytes is not None:
        score /= 1.0 + cfg.size_impact_factor * math.log10(1.0 + max(0, node.size_bytes))
    return score


def order_rows[R: _Row](
    rows: Sequence[R],
    cfg: WeightConfig | None,
    *,
    facts: Mapping[str, NodeFacts] | None = None,
) -> tuple[list[R], int]:
    """兄弟按权排序 + 前序 DFS(父必先于子)→ (有序行, 无父级孤儿行数)。

    `cfg=None` ⇒ 原序返回(词序档,给对照测试与"只想看字母序"的调用方留的口)。
    孤儿(父目录行不在行集里,又不是根)不丢弃:排在末尾并计数,由调用方写进 notes。
    """
    if cfg is None:
        return list(rows), 0
    children: dict[str, list[R]] = {}
    known: set[str] = set()
    for row in rows:
        known.add(row.path)
        children.setdefault(row.parent, []).append(row)
    for group in children.values():
        group.sort(key=lambda r: (-row_weight(r, cfg, facts=facts), r.path.lower(), r.path))

    ordered: list[R] = []
    orphans: list[R] = []

    def walk(parent: str) -> None:
        for row in children.get(parent, []):
            ordered.append(row)
            walk(row.path)

    walk("")
    emitted = {r.path for r in ordered}
    for row in rows:
        if row.path not in emitted and (row.parent and row.parent not in known):
            orphans.append(row)
            ordered.append(row)
    return ordered, len(orphans)


__test__ = {
    "row_weight": row_weight,
    "order_rows": order_rows,
    "active_dims": lambda cfg, facts: cfg.active_dims(facts),
    "env_weight_config": env_weight_config,
    "WeightConfig": WeightConfig,
    "NodeFacts": NodeFacts,
    "DEFAULT_TABLES": (DEFAULT_DIR_NAME_WEIGHTS, DEFAULT_FILE_TYPE_WEIGHTS, DEFAULT_ENTRY_NAME_WEIGHTS),
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
