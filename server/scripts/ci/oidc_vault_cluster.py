"""Phase 14 建议 1: OIDC Vault 服务高可用 (集群 + 反向代理).

目的:
  Phase 10 建议 2 实现了单实例 OIDC Vault.
  Phase 14 加:
  1. 多副本水平扩展: 多个 vault 节点并行服务
  2. 一致性哈希路由: 按 client_ip / github_sub 把请求固定到特定节点
     (同一客户端始终命中同一节点 → 缓存命中 / 限流生效 / 重试一致)
  3. 健康检查: 定期探测 /healthz, 标记 down/up 节点, 自动剔除
  4. 自动 failover: 主节点不可用时, 选下一个健康节点
  5. 共享审计: 多副本共用同一 SQL 后端 (SQLite WAL/PostgreSQL)
  6. 反向代理: VaultProxy FastAPI 接收外部请求, 内部转发到目标节点

组件:
  - VaultNode           数据类 (id, host, port, status, vnodes)
  - ConsistentHashRing  64 vnode 一致性哈希环
  - ClusterManager      节点注册 / 健康检查 / 选节点
  - VaultProxy          FastAPI 反向代理

用法:
  # 启动 3 个 vault 节点
  python scripts/ci/oidc_vault_server.py --port 9100 --mock &
  python scripts/ci/oidc_vault_server.py --port 9101 --mock &
  python scripts/ci/oidc_vault_server.py --port 9102 --mock &

  # 启动反向代理
  python scripts/ci/oidc_vault_cluster.py \
      --proxy-port 9200 \
      --peer vault-0@127.0.0.1:9100 \
      --peer vault-1@127.0.0.1:9101 \
      --peer vault-2@127.0.0.1:9102

  # 外部请求走代理
  curl http://127.0.0.1:9200/v1/exchange -X POST -H 'Authorization: Bearer xxx' -d '{"provider":"grafana"}'
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import sys
import time
from dataclasses import dataclass, field

try:
    import httpx
except ImportError:
    httpx = None  # type: ignore

try:
    import uvicorn
    from fastapi import FastAPI, HTTPException, Request
    from fastapi.responses import JSONResponse

    FASTAPI_AVAILABLE = True
except ImportError:
    FASTAPI_AVAILABLE = False


# ---------------------------------------------------------------------------
# 1. 数据类
# ---------------------------------------------------------------------------

NODE_STATUS_UP = "up"
NODE_STATUS_DOWN = "down"
NODE_STATUS_UNKNOWN = "unknown"


@dataclass
class VaultNode:
    """vault 集群节点."""

    id: str
    host: str
    port: int
    status: str = NODE_STATUS_UNKNOWN
    last_health_ts: float = 0.0
    last_error: str = ""
    vnodes: list[int] = field(default_factory=list)

    def url(self, path: str = "") -> str:
        return f"http://{self.host}:{self.port}{path}"

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "host": self.host,
            "port": self.port,
            "url": self.url(),
            "status": self.status,
            "last_health_ts": self.last_health_ts,
            "last_error": self.last_error,
        }


# ---------------------------------------------------------------------------
# 2. 一致性哈希环
# ---------------------------------------------------------------------------

_HASH_KEY = "zhs-vault-hash-v1"


def _hash_to_int(s: str) -> int:
    """把字符串映射到 32-bit 整数 (md5 前 4 字节)."""
    h = hashlib.md5(f"{_HASH_KEY}|{s}".encode()).digest()
    return int.from_bytes(h[:4], byteorder="big", signed=False)


class ConsistentHashRing:
    """64 vnode 一致性哈希环.

    特性:
      - 添加/删除节点时, 只有 ~1/N 比例的 key 需重新映射
      - 同一 key 始终映射到同一节点 (节点集合不变)
    """

    def __init__(self, vnodes_per_node: int = 64):
        if vnodes_per_node < 1:
            raise ValueError(f"vnodes_per_node 必须 >= 1, 实际 {vnodes_per_node}")
        self.vnodes_per_node = vnodes_per_node
        # sorted list of (hash, node_id)
        self._ring: list[tuple[int, str]] = []
        self._nodes: set[str] = set()

    def add(self, node_id: str) -> None:
        if node_id in self._nodes:
            return
        self._nodes.add(node_id)
        for i in range(self.vnodes_per_node):
            h = _hash_to_int(f"{node_id}#{i}")
            self._ring.append((h, node_id))
        self._ring.sort(key=lambda x: x[0])

    def remove(self, node_id: str) -> None:
        if node_id not in self._nodes:
            return
        self._nodes.discard(node_id)
        self._ring = [(h, nid) for h, nid in self._ring if nid != node_id]

    def nodes(self) -> set[str]:
        return set(self._nodes)

    def pick(self, key: str) -> str | None:
        """根据 key 选节点 (顺时针最近)."""
        if not self._ring:
            return None
        h = _hash_to_int(key)
        # 二分查找
        lo, hi = 0, len(self._ring)
        while lo < hi:
            mid = (lo + hi) // 2
            if self._ring[mid][0] < h:
                lo = mid + 1
            else:
                hi = mid
        if lo >= len(self._ring):
            lo = 0  # 环回
        return self._ring[lo][1]

    def pick_n(self, key: str, n: int) -> list[str]:
        """选 n 个不同节点 (含主节点). 用于 failover."""
        if not self._ring or n < 1:
            return []
        h = _hash_to_int(key)
        lo, hi = 0, len(self._ring)
        while lo < hi:
            mid = (lo + hi) // 2
            if self._ring[mid][0] < h:
                lo = mid + 1
            else:
                hi = mid
        if lo >= len(self._ring):
            lo = 0
        out: list[str] = []
        seen: set[str] = set()
        for i in range(len(self._ring)):
            idx = (lo + i) % len(self._ring)
            nid = self._ring[idx][1]
            if nid in seen:
                continue
            seen.add(nid)
            out.append(nid)
            if len(out) >= n:
                break
        return out


# ---------------------------------------------------------------------------
# 3. ClusterManager
# ---------------------------------------------------------------------------


class ClusterManager:
    """vault 集群管理器.

    职责:
      - 节点注册 / 注销
      - 一致性哈希选节点
      - 定期健康检查
      - 暴露 /cluster/status 端点
    """

    def __init__(self, health_interval_s: float = 5.0, health_timeout_s: float = 2.0):
        self.nodes: dict[str, VaultNode] = {}
        self.ring = ConsistentHashRing()
        self.health_interval_s = health_interval_s
        self.health_timeout_s = health_timeout_s
        self._check_task: asyncio.Task | None = None
        self._stop_event = asyncio.Event()

    def register(self, node_id: str, host: str, port: int) -> VaultNode:
        """注册节点, 已存在则更新."""
        node = self.nodes.get(node_id)
        if node is None:
            node = VaultNode(id=node_id, host=host, port=port)
            self.nodes[node_id] = node
            self.ring.add(node_id)
        else:
            # 已注册: 更新 host/port (如配置变更)
            old_host, old_port = node.host, node.port
            node.host = host
            node.port = port
            if (old_host, old_port) != (host, port):
                # host/port 变了, 不需要重建 vnode
                pass
        return node

    def deregister(self, node_id: str) -> None:
        if node_id in self.nodes:
            del self.nodes[node_id]
            self.ring.remove(node_id)

    def pick_node(self, key: str, exclude: set[str] | None = None) -> VaultNode | None:
        """按 key 选节点, 可排除指定 id."""
        exclude = exclude or set()
        candidates = self.ring.pick_n(key, n=len(self.nodes))
        for nid in candidates:
            if nid in exclude:
                continue
            node = self.nodes.get(nid)
            if node is None:
                continue
            if node.status == NODE_STATUS_DOWN:
                continue
            return node
        return None

    def pick_node_with_failover(self, key: str, max_tries: int = 3) -> list[VaultNode]:
        """返回 (主节点, 备选节点...) 列表, 长度 0~max_tries."""
        exclude: set[str] = set()
        out: list[VaultNode] = []
        for _ in range(max_tries):
            n = self.pick_node(key, exclude=exclude)
            if n is None:
                break
            out.append(n)
            exclude.add(n.id)
        return out

    async def health_check(self, node: VaultNode) -> bool:
        """检查单个节点健康."""
        if httpx is None:
            node.status = NODE_STATUS_UNKNOWN
            node.last_error = "httpx 未安装"
            return False
        try:
            async with httpx.AsyncClient(timeout=self.health_timeout_s) as client:
                r = await client.get(node.url("/healthz"))
                if r.status_code == 200:
                    node.status = NODE_STATUS_UP
                    node.last_health_ts = time.time()
                    node.last_error = ""
                    return True
                node.status = NODE_STATUS_DOWN
                node.last_error = f"HTTP {r.status_code}"
                return False
        except Exception as e:
            node.status = NODE_STATUS_DOWN
            node.last_error = f"{type(e).__name__}: {e}"
            return False

    async def health_check_all(self) -> dict[str, bool]:
        """并发检查所有节点."""
        results: dict[str, bool] = {}
        if not self.nodes:
            return results
        await asyncio.gather(*(self._check_and_record(n) for n in self.nodes.values()))
        return {nid: n.status == NODE_STATUS_UP for nid, n in self.nodes.items()}

    async def _check_and_record(self, node: VaultNode) -> None:
        await self.health_check(node)

    async def start_health_loop(self) -> None:
        """启动后台定期健康检查任务."""
        if self._check_task is not None:
            return
        self._stop_event.clear()
        self._check_task = asyncio.create_task(self._health_loop())

    async def stop_health_loop(self) -> None:
        if self._check_task is None:
            return
        self._stop_event.set()
        try:
            await asyncio.wait_for(self._check_task, timeout=self.health_timeout_s * 2)
        except (TimeoutError, asyncio.CancelledError):
            pass
        self._check_task = None

    async def _health_loop(self) -> None:
        while not self._stop_event.is_set():
            await self.health_check_all()
            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=self.health_interval_s)
            except TimeoutError:
                pass

    def status_dict(self) -> dict:
        return {
            "node_count": len(self.nodes),
            "healthy_count": sum(1 for n in self.nodes.values() if n.status == NODE_STATUS_UP),
            "nodes": [n.to_dict() for n in self.nodes.values()],
        }


# ---------------------------------------------------------------------------
# 4. VaultProxy (FastAPI 反向代理)
# ---------------------------------------------------------------------------


class VaultProxy:
    """FastAPI 反向代理: 接收请求 → consistent hash 选节点 → 转发 → 失败 failover.

    支持端点:
      POST /v1/exchange       转发到主节点
      POST /v1/validate       转发到主节点
      POST /v1/redeem         转发到主节点
      GET  /v1/audit          本地查 (共享审计, 不转发)
      GET  /healthz           代理自身健康 + 集群状态
      GET  /cluster/status    集群节点状态
    """

    def __init__(
        self,
        manager: ClusterManager,
        audit_db_url: str = "",
        max_failover: int = 3,
        request_timeout_s: float = 10.0,
    ):
        self.manager = manager
        self.audit_db_url = audit_db_url
        self.max_failover = max_failover
        self.request_timeout_s = request_timeout_s
        # 共享审计: 代理写一份, 节点也写一份, 共用同 SQL 后端
        self._audit_store = None
        if audit_db_url:
            try:
                sys.path.insert(0, str(Path(__file__).resolve().parent))
                from oidc_vault_audit_sql import SqlAuditStore

                self._audit_store = SqlAuditStore(audit_db_url)
            except Exception as e:
                print(f"[warn] 共享审计初始化失败: {e}")

        if not FASTAPI_AVAILABLE:
            return
        self.app = FastAPI(title="ZHS Vault Proxy", version="1.0")
        self._register_routes()

    def _register_routes(self) -> None:
        @self.app.get("/healthz")
        async def healthz():
            return {
                "status": "ok",
                "ts": int(time.time()),
                "cluster": self.manager.status_dict(),
            }

        @self.app.get("/cluster/status")
        async def cluster_status():
            return self.manager.status_dict()

        @self.app.post("/v1/exchange")
        async def exchange(request: Request):
            return await self._forward(request, "/v1/exchange", key_from_auth=True)

        @self.app.post("/v1/validate")
        async def validate(request: Request):
            return await self._forward(request, "/v1/validate", key_from_body=True)

        @self.app.post("/v1/redeem")
        async def redeem(request: Request):
            return await self._forward(request, "/v1/redeem", key_from_body=True)

        @self.app.get("/v1/audit")
        async def audit(provider: str = "", since: str = "", limit: int = 100):
            if self._audit_store is None:
                return {"source": "none", "count": 0, "rows": []}
            try:
                rows = self._audit_store.query(
                    provider=provider or None,
                    since=since or None,
                    limit=min(limit, 1000),
                )
                return {"source": "shared-sql", "count": len(rows), "rows": rows}
            except Exception as e:
                return {"source": "error", "count": 0, "rows": [], "error": str(e)}

    def _routing_key(self, request: Request, body: dict | None) -> str:
        """选节点的 key. 优先 client_ip, 再 github_sub, 再 provider."""
        if request.client and request.client.host:
            return f"ip:{request.client.host}"
        if body:
            if "github_sub" in body:
                return f"sub:{body['github_sub']}"
            if "provider" in body:
                return f"provider:{body['provider']}"
        return "default"

    async def _forward(
        self,
        request: Request,
        path: str,
        key_from_auth: bool = False,
        key_from_body: bool = False,
    ) -> JSONResponse:
        body_bytes = await request.body()
        body: dict = {}
        if body_bytes:
            try:
                body = json.loads(body_bytes.decode("utf-8"))
            except Exception:
                body = {}
        # 选 key
        key = self._routing_key(request, body)
        nodes = self.manager.pick_node_with_failover(key, max_tries=self.max_failover)
        if not nodes:
            raise HTTPException(503, "无可用 vault 节点")
        # 转发 + 失败 failover
        headers = dict(request.headers)
        headers.pop("host", None)
        last_err: str = ""
        for node in nodes:
            try:
                async with httpx.AsyncClient(timeout=self.request_timeout_s) as client:
                    r = await client.post(
                        node.url(path),
                        content=body_bytes,
                        headers=headers,
                    )
                if r.status_code < 500:
                    return JSONResponse(
                        content=(
                            r.json()
                            if r.headers.get("content-type", "").startswith("application/json")
                            else {"raw": r.text}
                        ),
                        status_code=r.status_code,
                    )
                last_err = f"node {node.id} HTTP {r.status_code}: {r.text[:200]}"
            except Exception as e:
                last_err = f"node {node.id} {type(e).__name__}: {e}"
                # 标记为 down 一次
                node.status = NODE_STATUS_DOWN
                node.last_error = last_err
                continue
        raise HTTPException(502, f"所有 vault 节点失败: {last_err}")


# ---------------------------------------------------------------------------
# 5. CLI
# ---------------------------------------------------------------------------

from pathlib import Path  # noqa: E402


def _parse_peer(peer: str) -> tuple[str, str, int]:
    """解析 'id@host:port' 或 'host:port' → (id, host, port)."""
    if "@" in peer:
        node_id, hp = peer.split("@", 1)
    else:
        node_id = ""
        hp = peer
    if ":" not in hp:
        raise ValueError(f"peer 格式错误 (期望 id@host:port 或 host:port): {peer}")
    host, port_s = hp.rsplit(":", 1)
    if not node_id:
        node_id = f"vault-{host}-{port_s}"
    return node_id, host, int(port_s)


def main() -> int:
    p = argparse.ArgumentParser(description="ZHS Vault 集群反向代理")
    p.add_argument("--proxy-host", default="0.0.0.0", help="代理监听 host")
    p.add_argument("--proxy-port", type=int, default=9200, help="代理监听 port")
    p.add_argument("--peer", action="append", default=[], help="vault 节点, 格式 id@host:port (可多次)")
    p.add_argument("--audit-db", default=os.environ.get("ZHS_VAULT_AUDIT_DB", ""), help="共享审计 SQL URL")
    p.add_argument("--health-interval", type=float, default=5.0, help="健康检查周期 (秒)")
    p.add_argument("--health-timeout", type=float, default=2.0, help="健康检查超时 (秒)")
    p.add_argument("--max-failover", type=int, default=3, help="最大 failover 节点数")
    args = p.parse_args()

    if not args.peer:
        print("[error] 至少需要 1 个 --peer", file=sys.stderr)
        return 2

    manager = ClusterManager(
        health_interval_s=args.health_interval,
        health_timeout_s=args.health_timeout,
    )
    for peer in args.peer:
        node_id, host, port = _parse_peer(peer)
        manager.register(node_id, host, port)
        print(f"[register] {node_id} @ {host}:{port}")

    proxy = VaultProxy(
        manager=manager,
        audit_db_url=args.audit_db,
        max_failover=args.max_failover,
    )
    if not FASTAPI_AVAILABLE:
        print("[error] fastapi 不可用, 请 pip install fastapi uvicorn", file=sys.stderr)
        return 3

    @proxy.app.on_event("startup")
    async def _startup():
        await manager.start_health_loop()
        # 启动时立即做一次健康检查
        await manager.health_check_all()

    @proxy.app.on_event("shutdown")
    async def _shutdown():
        await manager.stop_health_loop()

    print(f"ZHS Vault Proxy: http://{args.proxy_host}:{args.proxy_port}")
    print(f"  peers: {len(manager.nodes)}")
    print(f"  audit-db: {args.audit_db or '(未配置)'}")
    uvicorn.run(proxy.app, host=args.proxy_host, port=args.proxy_port, log_level="info")
    return 0


if __name__ == "__main__":
    sys.exit(main())
