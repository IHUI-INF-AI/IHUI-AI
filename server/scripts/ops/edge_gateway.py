"""Phase 18 建议 2: 边缘计算网关 - CDN 规则同步 + 边缘函数灰度.

目的:
  - 多边缘节点 CDN 规则统一同步
  - 边缘函数 (auth/rewrite/cache) 灰度发布
  - per-node 同步状态追踪
  - 同步失败告警 + 报表

设计:
  EdgeNode:
    id, region, location, status (online/offline/degraded)

  CacheRule:
    path_pattern, ttl_seconds, cache_key, vary, compress

  EdgeFunction:
    name, version, code_hash, phase (request/response)

  CanaryDeployment:
    function_name, version, percentage, allowlist, status

  EdgeGateway:
    nodes 列表
    rules 列表
    functions 列表
    sync_to_node(node) 模拟同步
    rollout_function(func, percentage) 灰度发布
    report() 报表
"""

from __future__ import annotations

import json
import time
from collections.abc import Callable
from dataclasses import asdict, dataclass, field
from enum import Enum

# ---------------------------------------------------------------------------
# 1. 枚举
# ---------------------------------------------------------------------------


class NodeStatus(str, Enum):
    ONLINE = "online"
    OFFLINE = "offline"
    DEGRADED = "degraded"
    SYNCING = "syncing"


class SyncStatus(str, Enum):
    PENDING = "pending"
    SYNCING = "syncing"
    IN_SYNC = "in_sync"
    FAILED = "failed"


class CanaryStatus(str, Enum):
    DRAFT = "draft"
    ROLLOUT = "rollout"
    PAUSED = "paused"
    PROMOTED = "promoted"
    ROLLED_BACK = "rolled_back"


# ---------------------------------------------------------------------------
# 2. 数据类
# ---------------------------------------------------------------------------


@dataclass
class EdgeNode:
    id: str
    region: str
    location: str
    status: NodeStatus = NodeStatus.ONLINE
    last_sync_ts: float = 0.0
    last_sync_status: SyncStatus = SyncStatus.PENDING
    last_error: str = ""


@dataclass
class CacheRule:
    path_pattern: str  # /api/* /static/*.js
    ttl_seconds: int = 0  # 0 = no-cache
    cache_key: str = "url"  # url / url+ua / url+cookie
    compress: bool = True
    immutable: bool = False
    enabled: bool = True


@dataclass
class EdgeFunction:
    name: str
    version: int
    code: str = ""
    code_hash: str = ""
    phase: str = "request"  # request / response
    enabled: bool = True

    def __post_init__(self):
        if not self.code_hash:
            self.code_hash = str(abs(hash(self.code)) % (10**8))


@dataclass
class CanaryDeployment:
    function_name: str
    version: int
    percentage: int = 0  # 0-100
    allowlist: list[str] = field(default_factory=list)  # node_id 白名单
    status: CanaryStatus = CanaryStatus.DRAFT
    created_ts: float = field(default_factory=time.time)
    updated_ts: float = field(default_factory=time.time)
    promoted_ts: float | None = None
    rolled_back_ts: float | None = None


# ---------------------------------------------------------------------------
# 3. EdgeGateway
# ---------------------------------------------------------------------------


class EdgeGateway:
    """边缘计算网关 - 规则 + 函数 + 灰度."""

    def __init__(self):
        self.nodes: dict[str, EdgeNode] = {}
        self.rules: list[CacheRule] = []
        self.functions: dict[str, EdgeFunction] = {}
        self.canary: dict[str, CanaryDeployment] = {}  # function_name -> deployment
        self._sync_log: list[dict] = []
        # 可注入的同步钩子 (测试用)
        self._sync_hook: Callable[[EdgeNode, list[CacheRule], dict[str, EdgeFunction]], bool] | None = None
        self._sync_delay_s: float = 0.0

    # ---- 节点管理 ----
    def add_node(self, node: EdgeNode) -> None:
        self.nodes[node.id] = node

    def remove_node(self, node_id: str) -> None:
        self.nodes.pop(node_id, None)

    # ---- 规则管理 ----
    def add_rule(self, rule: CacheRule) -> None:
        self.rules.append(rule)

    def remove_rule(self, path_pattern: str) -> bool:
        for i, r in enumerate(self.rules):
            if r.path_pattern == path_pattern:
                self.rules.pop(i)
                return True
        return False

    def enabled_rules(self) -> list[CacheRule]:
        return [r for r in self.rules if r.enabled]

    # ---- 函数管理 ----
    def deploy_function(self, func: EdgeFunction) -> None:
        self.functions[func.name] = func
        if func.name in self.canary:
            # 已有 canary -> 更新版本
            self.canary[func.name].version = func.version
            self.canary[func.name].updated_ts = time.time()

    # ---- 灰度管理 ----
    def start_canary(
        self, function_name: str, version: int, percentage: int = 10, allowlist: list[str] | None = None
    ) -> CanaryDeployment:
        dep = CanaryDeployment(
            function_name=function_name,
            version=version,
            percentage=percentage,
            allowlist=allowlist or [],
            status=CanaryStatus.ROLLOUT,
        )
        self.canary[function_name] = dep
        return dep

    def update_canary(self, function_name: str, percentage: int) -> CanaryDeployment | None:
        dep = self.canary.get(function_name)
        if dep is None or dep.status != CanaryStatus.ROLLOUT:
            return None
        dep.percentage = max(0, min(100, percentage))
        dep.updated_ts = time.time()
        return dep

    def promote_canary(self, function_name: str) -> CanaryDeployment | None:
        dep = self.canary.get(function_name)
        if dep is None:
            return None
        dep.status = CanaryStatus.PROMOTED
        dep.percentage = 100
        dep.promoted_ts = time.time()
        return dep

    def rollback_canary(self, function_name: str) -> CanaryDeployment | None:
        dep = self.canary.get(function_name)
        if dep is None:
            return None
        dep.status = CanaryStatus.ROLLED_BACK
        dep.percentage = 0
        dep.rolled_back_ts = time.time()
        return dep

    def is_canary_for_node(self, function_name: str, node_id: str) -> bool:
        """某节点是否使用 canary 版本."""
        dep = self.canary.get(function_name)
        if dep is None:
            return False
        if dep.status == CanaryStatus.PROMOTED:
            return True
        if dep.status == CanaryStatus.ROLLED_BACK:
            return False
        if dep.status != CanaryStatus.ROLLOUT:
            return False
        if node_id in dep.allowlist:
            return True
        if dep.percentage >= 100:
            return True
        if dep.percentage <= 0:
            return False
        return (hash((function_name, node_id)) % 100) < dep.percentage

    # ---- 同步 ----
    def set_sync_hook(self, hook: Callable[[EdgeNode, list[CacheRule], dict[str, EdgeFunction]], bool]) -> None:
        self._sync_hook = hook

    def sync_to_node(self, node_id: str, now: float | None = None) -> bool:
        node = self.nodes.get(node_id)
        if node is None:
            return False
        if node.status == NodeStatus.OFFLINE:
            node.last_sync_status = SyncStatus.FAILED
            node.last_error = "node offline"
            return False
        t = now or time.time()
        node.status = NodeStatus.SYNCING
        node.last_sync_status = SyncStatus.SYNCING
        try:
            if self._sync_hook is not None:
                ok = self._sync_hook(node, self.enabled_rules(), self.functions)
                if not ok:
                    node.last_sync_status = SyncStatus.FAILED
                    node.last_error = "hook returned False"
                    return False
            else:
                if self._sync_delay_s > 0:
                    time.sleep(self._sync_delay_s)
            node.last_sync_ts = t
            node.last_sync_status = SyncStatus.IN_SYNC
            node.last_error = ""
            node.status = NodeStatus.ONLINE
            self._sync_log.append(
                {
                    "ts": t,
                    "node": node_id,
                    "status": "in_sync",
                    "rules_count": len(self.enabled_rules()),
                    "functions_count": len(self.functions),
                }
            )
            return True
        except Exception as e:
            node.last_sync_status = SyncStatus.FAILED
            node.last_error = str(e)
            node.status = NodeStatus.DEGRADED
            self._sync_log.append(
                {
                    "ts": t,
                    "node": node_id,
                    "status": "failed",
                    "error": str(e),
                }
            )
            return False

    def sync_all(self, now: float | None = None) -> dict[str, bool]:
        return {nid: self.sync_to_node(nid, now) for nid in self.nodes}

    # ---- 报表 ----
    def summary(self) -> dict:
        total = len(self.nodes)
        online = sum(1 for n in self.nodes.values() if n.status == NodeStatus.ONLINE)
        in_sync = sum(1 for n in self.nodes.values() if n.last_sync_status == SyncStatus.IN_SYNC)
        failed = sum(1 for n in self.nodes.values() if n.last_sync_status == SyncStatus.FAILED)
        return {
            "nodes_total": total,
            "nodes_online": online,
            "nodes_in_sync": in_sync,
            "nodes_failed": failed,
            "rules_count": len(self.enabled_rules()),
            "functions_count": len(self.functions),
            "canary_count": sum(1 for c in self.canary.values() if c.status == CanaryStatus.ROLLOUT),
        }

    def report(self) -> str:
        s = self.summary()
        lines: list[str] = []
        lines.append("# 边缘计算网关报表")
        lines.append("")
        lines.append(f"- 节点总数: **{s['nodes_total']}**")
        lines.append(f"- 在线节点: **{s['nodes_online']}**")
        lines.append(f"- 同步成功: **{s['nodes_in_sync']}**")
        lines.append(f"- 同步失败: **{s['nodes_failed']}**")
        lines.append(f"- 规则数: **{s['rules_count']}**")
        lines.append(f"- 函数数: **{s['functions_count']}**")
        lines.append(f"- 灰度中: **{s['canary_count']}**")
        lines.append("")
        lines.append("## 节点同步状态")
        lines.append("")
        lines.append("| 节点 | 区域 | 状态 | 同步状态 | 上次同步 | 错误 |")
        lines.append("| --- | --- | --- | --- | --- | --- |")
        for n in self.nodes.values():
            ts = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(n.last_sync_ts)) if n.last_sync_ts else "-"
            lines.append(
                f"| {n.id} | {n.region} | {n.status.value} | {n.last_sync_status.value} | {ts} | {n.last_error} |"
            )
        lines.append("")
        if self.canary:
            lines.append("## 灰度发布")
            lines.append("")
            lines.append("| 函数 | 版本 | 进度 | 状态 | 允许节点 |")
            lines.append("| --- | --- | --- | --- | --- |")
            for c in self.canary.values():
                nodes = ", ".join(c.allowlist) or "-"
                lines.append(f"| {c.function_name} | v{c.version} | {c.percentage}% | {c.status.value} | {nodes} |")
        return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# 4. CLI
# ---------------------------------------------------------------------------


def _demo_gateway() -> EdgeGateway:
    gw = EdgeGateway()
    # 节点
    gw.add_node(EdgeNode("node-us-east-1a", "us-east-1", "NewYork"))
    gw.add_node(EdgeNode("node-us-west-2a", "us-west-2", "Seattle"))
    gw.add_node(EdgeNode("node-eu-west-1a", "eu-west-1", "London"))
    # 规则
    gw.add_rule(CacheRule("/api/users/*", ttl_seconds=0, cache_key="url+cookie"))
    gw.add_rule(CacheRule("/static/*", ttl_seconds=86400 * 30, immutable=True))
    gw.add_rule(CacheRule("/assets/*", ttl_seconds=3600, compress=True))
    # 函数
    gw.deploy_function(EdgeFunction("auth-check", 1, code="def auth(...): pass"))
    return gw


def main(argv: list[str] | None = None, gateway: EdgeGateway | None = None) -> int:
    import argparse

    p = argparse.ArgumentParser(description="边缘计算网关")
    sub = p.add_subparsers(dest="cmd", required=True)

    p_demo = sub.add_parser("demo")
    p_demo.add_argument("--simulate", default="sync", choices=["sync", "canary", "rollback"])

    p_report = sub.add_parser("report")

    args = p.parse_args(argv)
    gw = gateway or _demo_gateway()
    if args.cmd == "demo":
        if args.simulate == "sync":
            results = gw.sync_all()
            print(json.dumps({"summary": gw.summary(), "results": results}, ensure_ascii=False, indent=2))
            return 0
        if args.simulate == "canary":
            gw.deploy_function(EdgeFunction("auth-check", 2, code="def auth(...): pass-v2"))
            gw.start_canary("auth-check", 2, percentage=30, allowlist=["node-us-east-1a"])
            gw.sync_all()
            rollout = {nid: gw.is_canary_for_node("auth-check", nid) for nid in gw.nodes}
            print(json.dumps({"canary": "started", "rollout": rollout}, ensure_ascii=False, indent=2))
            return 0
        if args.simulate == "rollback":
            gw.deploy_function(EdgeFunction("auth-check", 3, code="v3"))
            gw.start_canary("auth-check", 3, percentage=50)
            gw.rollback_canary("auth-check")
            print(
                json.dumps(
                    {"status": "rolled_back", "canary": asdict(gw.canary["auth-check"])},
                    ensure_ascii=False,
                    indent=2,
                    default=str,
                )
            )
            return 0
    if args.cmd == "report":
        print(gw.report())
        return 0
    return 1


if __name__ == "__main__":
    import sys

    sys.exit(main())
