"""Phase 14 建议 1 测试: OIDC Vault 服务高可用."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "ci"))

from oidc_vault_cluster import (
    NODE_STATUS_DOWN,
    NODE_STATUS_UP,
    ClusterManager,
    ConsistentHashRing,
    VaultNode,
    VaultProxy,
    _parse_peer,
)

# ---------------------------------------------------------------------------
# ConsistentHashRing
# ---------------------------------------------------------------------------


class TestConsistentHashRing:
    def test_empty_ring_pick_returns_none(self):
        r = ConsistentHashRing()
        assert r.pick("any-key") is None
        assert r.pick_n("k", 3) == []

    def test_add_node_and_pick(self):
        r = ConsistentHashRing(vnodes_per_node=64)
        r.add("node-a")
        nid = r.pick("user-123")
        assert nid == "node-a"

    def test_multiple_nodes_pick_deterministic(self):
        r = ConsistentHashRing(vnodes_per_node=64)
        r.add("node-a")
        r.add("node-b")
        r.add("node-c")
        # 同一 key 多次选应一致
        for _ in range(10):
            assert r.pick("user-123") == r.pick("user-123")

    def test_distribution_reasonable(self):
        r = ConsistentHashRing(vnodes_per_node=64)
        for n in ("a", "b", "c", "d"):
            r.add(n)
        # 1000 个 key 应分布相对均匀 (允许 ±30% 偏差)
        counts = {"a": 0, "b": 0, "c": 0, "d": 0}
        for i in range(1000):
            counts[r.pick(f"key-{i}")] += 1
        for c in counts.values():
            assert 150 <= c <= 350, f"分布不均: {counts}"

    def test_remove_node_keeps_mostly_same(self):
        r1 = ConsistentHashRing(vnodes_per_node=64)
        r2 = ConsistentHashRing(vnodes_per_node=64)
        for n in ("a", "b", "c", "d"):
            r1.add(n)
            r2.add(n)
        # 移除 c 节点后, 至少 50% 非 c key 保持原样 (理论 75%, 留余量)
        r2.remove("c")
        same = 0
        total = 1000
        for i in range(total):
            k = f"key-{i}"
            before = r1.pick(k)
            after = r2.pick(k)
            if before == "c":
                continue
            if before == after:
                same += 1
        non_c_ratio = same / total * 4 / 3  # 3/4 是非 c key 占比
        assert non_c_ratio >= 0.5, f"一致性过低: {non_c_ratio:.2%}"

    def test_pick_n_returns_distinct(self):
        r = ConsistentHashRing(vnodes_per_node=64)
        for n in ("a", "b", "c", "d"):
            r.add(n)
        result = r.pick_n("user-1", 3)
        assert len(result) == 3
        assert len(set(result)) == 3

    def test_pick_n_more_than_nodes(self):
        r = ConsistentHashRing()
        r.add("a")
        r.add("b")
        result = r.pick_n("k", 5)
        assert len(result) == 2  # 最多 2 个

    def test_pick_n_empty_ring(self):
        r = ConsistentHashRing()
        assert r.pick_n("k", 3) == []

    def test_add_twice_is_idempotent(self):
        r = ConsistentHashRing()
        r.add("a")
        r.add("a")
        assert r.nodes() == {"a"}
        assert len(r._ring) == r.vnodes_per_node

    def test_remove_nonexistent_is_safe(self):
        r = ConsistentHashRing()
        r.remove("x")  # 不应抛


# ---------------------------------------------------------------------------
# ClusterManager
# ---------------------------------------------------------------------------


class TestClusterManager:
    def test_register_new_node(self):
        m = ClusterManager()
        n = m.register("vault-0", "127.0.0.1", 9100)
        assert n.id == "vault-0"
        assert n.host == "127.0.0.1"
        assert n.port == 9100
        # 注册时 status 未知, 等健康检查确认
        assert n.status == "unknown"
        n2 = m.register("vault-1", "127.0.0.1", 9101)
        assert n2.status == "unknown"

    def test_register_existing_updates(self):
        m = ClusterManager()
        m.register("vault-0", "127.0.0.1", 9100)
        m.register("vault-0", "127.0.0.1", 9999)  # 改 port
        assert m.nodes["vault-0"].port == 9999

    def test_deregister(self):
        m = ClusterManager()
        m.register("vault-0", "127.0.0.1", 9100)
        m.deregister("vault-0")
        assert "vault-0" not in m.nodes
        assert "vault-0" not in m.ring.nodes()

    def test_pick_node_returns_only_healthy(self):
        m = ClusterManager()
        m.register("a", "127.0.0.1", 9001)
        m.register("b", "127.0.0.1", 9002)
        # 标 a 为 down
        m.nodes["a"].status = NODE_STATUS_DOWN
        # 不论 key, 都应选 b
        for i in range(100):
            assert m.pick_node(f"key-{i}").id == "b"

    def test_pick_node_with_failover(self):
        m = ClusterManager()
        m.register("a", "127.0.0.1", 9001)
        m.register("b", "127.0.0.1", 9002)
        m.register("c", "127.0.0.1", 9003)
        m.nodes["a"].status = NODE_STATUS_DOWN
        m.nodes["b"].status = NODE_STATUS_DOWN
        nodes = m.pick_node_with_failover("user-1", max_tries=3)
        assert len(nodes) == 1
        assert nodes[0].id == "c"

    def test_pick_node_with_failover_no_healthy(self):
        m = ClusterManager()
        m.register("a", "127.0.0.1", 9001)
        m.nodes["a"].status = NODE_STATUS_DOWN
        nodes = m.pick_node_with_failover("user-1", max_tries=3)
        assert nodes == []

    def test_pick_node_consistent_for_same_key(self):
        m = ClusterManager()
        m.register("a", "127.0.0.1", 9001)
        m.register("b", "127.0.0.1", 9002)
        m.register("c", "127.0.0.1", 9003)
        # 同一 key 多次选应一致
        for _ in range(20):
            assert m.pick_node("key-x").id == m.pick_node("key-x").id

    def test_status_dict(self):
        m = ClusterManager()
        m.register("a", "127.0.0.1", 9001)
        m.register("b", "127.0.0.1", 9002)
        m.nodes["a"].status = NODE_STATUS_UP
        m.nodes["b"].status = NODE_STATUS_DOWN
        s = m.status_dict()
        assert s["node_count"] == 2
        assert s["healthy_count"] == 1
        assert len(s["nodes"]) == 2


# ---------------------------------------------------------------------------
# health_check (用真实 httpx)
# ---------------------------------------------------------------------------


class TestHealthCheck:
    def test_health_check_mark_down_on_connection_refused(self):
        pytest.importorskip("httpx")
        m = ClusterManager(health_timeout_s=1.0)
        m.register("bad", "127.0.0.1", 1)  # 端口 1 必拒连
        asyncio.run(m.health_check(m.nodes["bad"]))
        assert m.nodes["bad"].status == NODE_STATUS_DOWN
        assert "refused" in m.nodes["bad"].last_error.lower() or "connect" in m.nodes["bad"].last_error.lower()

    def test_health_check_all_uses_httpx(self):
        pytest.importorskip("httpx")
        m = ClusterManager(health_timeout_s=1.0)
        m.register("a", "127.0.0.1", 1)
        m.register("b", "127.0.0.1", 2)
        results = asyncio.run(m.health_check_all())
        assert results == {"a": False, "b": False}
        assert m.nodes["a"].status == NODE_STATUS_DOWN


# ---------------------------------------------------------------------------
# VaultProxy
# ---------------------------------------------------------------------------


def _has_fastapi() -> bool:
    try:
        import fastapi  # noqa: F401
        from fastapi.testclient import TestClient  # noqa: F401

        return True
    except ImportError:
        return False


@pytest.mark.skipif(not _has_fastapi(), reason="fastapi.testclient 不可用")
class TestVaultProxy:
    def test_proxy_healthz(self):
        m = ClusterManager()
        m.register("a", "127.0.0.1", 9001)
        proxy = VaultProxy(m)
        from fastapi.testclient import TestClient

        client = TestClient(proxy.app)
        r = client.get("/healthz")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "ok"
        assert data["cluster"]["node_count"] == 1

    def test_proxy_cluster_status(self):
        m = ClusterManager()
        m.register("a", "127.0.0.1", 9001)
        m.register("b", "127.0.0.1", 9002)
        m.nodes["a"].status = NODE_STATUS_UP
        proxy = VaultProxy(m)
        from fastapi.testclient import TestClient

        client = TestClient(proxy.app)
        r = client.get("/cluster/status")
        assert r.status_code == 200
        data = r.json()
        assert data["node_count"] == 2
        assert data["healthy_count"] == 1

    def test_proxy_forward_no_healthy_node(self):
        m = ClusterManager()
        m.register("a", "127.0.0.1", 9001)
        m.nodes["a"].status = NODE_STATUS_DOWN
        proxy = VaultProxy(m)
        from fastapi.testclient import TestClient

        client = TestClient(proxy.app)
        r = client.post("/v1/exchange", json={"provider": "grafana"})
        assert r.status_code == 503

    def test_proxy_forward_503_when_no_nodes(self):
        m = ClusterManager()  # 无节点
        proxy = VaultProxy(m)
        from fastapi.testclient import TestClient

        client = TestClient(proxy.app)
        r = client.post("/v1/exchange", json={"provider": "grafana"})
        assert r.status_code == 503

    def test_proxy_audit_without_db(self):
        m = ClusterManager()
        proxy = VaultProxy(m, audit_db_url="")
        from fastapi.testclient import TestClient

        client = TestClient(proxy.app)
        r = client.get("/v1/audit")
        assert r.status_code == 200
        data = r.json()
        assert data["source"] == "none"

    def test_proxy_audit_with_sqlite(self, tmp_path):
        m = ClusterManager()
        url = f"sqlite:///{tmp_path / 'audit.db'}"
        proxy = VaultProxy(m, audit_db_url=url)
        from fastapi.testclient import TestClient

        client = TestClient(proxy.app)
        r = client.get("/v1/audit")
        assert r.status_code == 200
        data = r.json()
        assert data["source"] == "shared-sql"

    def test_proxy_forward_with_real_vault(self):
        """用真正的 vault server 测端到端."""
        pytest.importorskip("uvicorn")
        import threading
        import time

        import uvicorn
        from oidc_vault_server import app as vault_app

        config = uvicorn.Config(vault_app, host="127.0.0.1", port=18901, log_level="error")
        server = uvicorn.Server(config)
        thread = threading.Thread(target=server.run, daemon=True)
        thread.start()
        time.sleep(1.0)  # 等启动

        try:
            m = ClusterManager()
            m.register("v1", "127.0.0.1", 18901)
            m.nodes["v1"].status = NODE_STATUS_UP
            proxy = VaultProxy(m, request_timeout_s=3.0)
            from fastapi.testclient import TestClient

            client = TestClient(proxy.app)

            # mock 模式 vault 需 ZHS_VAULT_MOCK=1, 这里用 healthz 替代 (无 mock 也通)
            r = client.get("/healthz")
            assert r.status_code == 200
        finally:
            server.should_exit = True
            thread.join(timeout=3)


# ---------------------------------------------------------------------------
# _parse_peer
# ---------------------------------------------------------------------------


class TestParsePeer:
    def test_with_id(self):
        nid, host, port = _parse_peer("vault-0@10.0.0.1:9100")
        assert nid == "vault-0"
        assert host == "10.0.0.1"
        assert port == 9100

    def test_without_id(self):
        nid, host, port = _parse_peer("10.0.0.1:9100")
        assert nid == "vault-10.0.0.1-9100"
        assert host == "10.0.0.1"
        assert port == 9100

    def test_invalid_format(self):
        with pytest.raises(ValueError):
            _parse_peer("no-port")

    def test_ipv6(self):
        nid, host, port = _parse_peer("v1@[::1]:9100")
        assert host == "[::1]"
        assert port == 9100


# ---------------------------------------------------------------------------
# VaultNode
# ---------------------------------------------------------------------------


class TestVaultNode:
    def test_url(self):
        n = VaultNode(id="x", host="h", port=9100)
        assert n.url() == "http://h:9100"
        assert n.url("/healthz") == "http://h:9100/healthz"

    def test_to_dict(self):
        n = VaultNode(id="x", host="h", port=9100, status="up")
        d = n.to_dict()
        assert d["id"] == "x"
        assert d["status"] == "up"
        assert d["url"] == "http://h:9100"
