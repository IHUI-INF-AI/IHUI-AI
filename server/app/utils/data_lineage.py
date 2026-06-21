"""Bug-110: 数据血缘追踪.

设计:
  - 节点: 表 / 字段 / 任务 / 产物
  - 边: 上游 -> 下游 (UPSTREAM / DOWNSTREAM 双向)
  - 反查: 给定节点, 查所有上游/下游 (递归)
  - 影响面分析: 节点变更时, 列出所有受影响的下游
  - 可视化友好: dot 格式输出
  - 周期重建索引 (避免长期累积变慢)
"""

import logging
import threading
import time
from collections import defaultdict, deque
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class NodeKind(str, Enum):
    TABLE = "table"
    COLUMN = "column"
    JOB = "job"
    ARTIFACT = "artifact"
    DATASET = "dataset"
    METRIC = "metric"


class EdgeKind(str, Enum):
    READS = "reads"  # 上游被读
    WRITES = "writes"  # 上游被写
    DERIVES = "derives"  # 派生
    DEPENDS = "depends"  # 依赖


@dataclass
class LineageNode:
    id: str
    kind: str
    name: str
    extra: dict = field(default_factory=dict)
    created_at: float = 0.0

    def to_dict(self) -> dict:
        return self.__dict__.copy()


@dataclass
class LineageEdge:
    src: str
    dst: str
    kind: str = EdgeKind.DEPENDS.value
    weight: int = 1
    created_at: float = 0.0

    def to_dict(self) -> dict:
        return self.__dict__.copy()


@dataclass
class LineageImpact:
    node_id: str
    direct_downstream: list[str]
    all_downstream: list[str]
    direct_upstream: list[str]
    all_upstream: list[str]


class DataLineage:
    """数据血缘追踪器."""

    def __init__(self):
        self._lock = threading.Lock()
        self._nodes: dict[str, LineageNode] = {}
        # 出边 (src -> [(dst, kind)])
        self._out: dict[str, list[LineageEdge]] = defaultdict(list)
        # 入边 (dst -> [(src, kind)])
        self._in: dict[str, list[LineageEdge]] = defaultdict(list)

    def add_node(self, id: str, kind: str, name: str = "", extra: dict | None = None) -> LineageNode:
        with self._lock:
            old = self._nodes.get(id)
            n = LineageNode(
                id=id,
                kind=kind,
                name=name or id,
                extra=extra or {},
                created_at=old.created_at if old else time.time(),
            )
            self._nodes[id] = n
            return n

    def get_node(self, id: str) -> LineageNode | None:
        with self._lock:
            return self._nodes.get(id)

    def list_nodes(self, kind: str | None = None) -> list[LineageNode]:
        with self._lock:
            arr = list(self._nodes.values())
        if kind:
            arr = [n for n in arr if n.kind == kind]
        return arr

    def add_edge(self, src: str, dst: str, kind: str = EdgeKind.DEPENDS.value, weight: int = 1) -> LineageEdge:
        # 自动补全节点
        if src not in self._nodes:
            self.add_node(src, kind=NodeKind.TABLE.value, name=src)
        if dst not in self._nodes:
            self.add_node(dst, kind=NodeKind.TABLE.value, name=dst)
        with self._lock:
            # 去重 (同 src+dst+kind 视为同一条边)
            for e in self._out[src]:
                if e.dst == dst and e.kind == kind:
                    e.weight += weight
                    return e
            e = LineageEdge(src=src, dst=dst, kind=kind, weight=weight, created_at=time.time())
            self._out[src].append(e)
            self._in[dst].append(e)
            return e

    def remove_edge(self, src: str, dst: str, kind: str | None = None) -> int:
        with self._lock:
            n = 0
            kept: list[LineageEdge] = []
            for e in self._out[src]:
                if e.dst == dst and (kind is None or e.kind == kind):
                    n += 1
                else:
                    kept.append(e)
            self._out[src] = kept
            kept2: list[LineageEdge] = []
            for e in self._in[dst]:
                if e.src == src and (kind is None or e.kind == kind):
                    pass
                else:
                    kept2.append(e)
            self._in[dst] = kept2
            return n

    def remove_node(self, id: str) -> bool:
        with self._lock:
            if id not in self._nodes:
                return False
            # 删除相关边
            out_edges = self._out.pop(id, [])
            in_edges = self._in.pop(id, [])
            for e in out_edges:
                self._in[e.dst] = [x for x in self._in[e.dst] if x.src != id]
            for e in in_edges:
                self._out[e.src] = [x for x in self._out[e.src] if x.dst != id]
            del self._nodes[id]
            return True

    def direct_downstream(self, id: str) -> list[str]:
        with self._lock:
            return [e.dst for e in self._out.get(id, [])]

    def direct_upstream(self, id: str) -> list[str]:
        with self._lock:
            return [e.src for e in self._in.get(id, [])]

    def all_downstream(self, id: str, max_depth: int = 10) -> list[str]:
        return self._bfs(id, "downstream", max_depth)

    def all_upstream(self, id: str, max_depth: int = 10) -> list[str]:
        return self._bfs(id, "upstream", max_depth)

    def _bfs(self, start: str, direction: str, max_depth: int) -> list[str]:
        if start not in self._nodes:
            return []
        visited: set[str] = {start}
        order: list[str] = []
        queue: deque[tuple[str, int]] = deque([(start, 0)])
        while queue:
            cur, depth = queue.popleft()
            if depth >= max_depth:
                continue
            if direction == "downstream":
                next_ids = [e.dst for e in self._out.get(cur, [])]
            else:
                next_ids = [e.src for e in self._in.get(cur, [])]
            for nid in next_ids:
                if nid in visited:
                    continue
                visited.add(nid)
                order.append(nid)
                queue.append((nid, depth + 1))
        return order

    def impact(self, id: str, max_depth: int = 10) -> LineageImpact:
        return LineageImpact(
            node_id=id,
            direct_downstream=self.direct_downstream(id),
            all_downstream=self.all_downstream(id, max_depth=max_depth),
            direct_upstream=self.direct_upstream(id),
            all_upstream=self.all_upstream(id, max_depth=max_depth),
        )

    def find_cycles(self) -> list[list[str]]:
        """检测环 (depth-first)."""
        cycles: list[list[str]] = []
        WHITE, GRAY, BLACK = 0, 1, 2
        color: dict[str, int] = dict.fromkeys(self._nodes, WHITE)
        path: list[str] = []

        def dfs(u: str) -> None:
            color[u] = GRAY
            path.append(u)
            for e in self._out.get(u, []):
                v = e.dst
                if color.get(v, WHITE) == GRAY:
                    # 找到环
                    idx = path.index(v)
                    cycles.append(path[idx:] + [v])
                elif color.get(v, WHITE) == WHITE:
                    dfs(v)
            path.pop()
            color[u] = BLACK

        for n in self._nodes:
            if color[n] == WHITE:
                dfs(n)
        return cycles

    def to_dot(self) -> str:
        """生成 Graphviz dot 格式."""
        with self._lock:
            nodes = list(self._nodes.values())
            out_edges: list[LineageEdge] = []
            for arr in self._out.values():
                out_edges.extend(arr)
        lines = ["digraph lineage {"]
        for n in nodes:
            label = f"{n.name}\\n({n.kind})"
            lines.append(f'  "{n.id}" [label="{label}"];')
        for e in out_edges:
            lines.append(f'  "{e.src}" -> "{e.dst}" [label="{e.kind}"];')
        lines.append("}")
        return "\n".join(lines)

    def rebuild_index(self) -> int:
        """重建出/入边索引 (维护用)."""
        with self._lock:
            old_out = self._out
            self._out = defaultdict(list)
            self._in = defaultdict(list)
            for arr in old_out.values():
                for e in arr:
                    self._out[e.src].append(e)
                    self._in[e.dst].append(e)
            return len(self._nodes)

    def stats(self) -> dict:
        with self._lock:
            edge_count = sum(len(v) for v in self._out.values())
            return {
                "node_count": len(self._nodes),
                "edge_count": edge_count,
                "by_kind": {
                    k: sum(1 for n in self._nodes.values() if n.kind == k) for k in NodeKind.__members__.values()
                },
            }

    def clear(self) -> None:
        with self._lock:
            self._nodes.clear()
            self._out.clear()
            self._in.clear()


# 全局单例
data_lineage = DataLineage()
