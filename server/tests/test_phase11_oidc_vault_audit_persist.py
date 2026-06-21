"""Phase 11 建议 1: OIDC Vault 审计日志持久化 (SQLite)."""

from __future__ import annotations

import importlib
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "ci"))


@pytest.fixture()
def audit_store(tmp_path):
    """每个测试一个独立 SQLite 库."""
    from oidc_vault_audit import AuditStore

    db = tmp_path / "audit.db"
    store = AuditStore(db)
    yield store
    store.truncate()
    if db.exists():
        db.unlink()


def test_audit_store_creates_db(audit_store, tmp_path):
    """首次创建必生成 db 文件."""
    assert (tmp_path / "audit.db").exists()


def test_audit_store_creates_parent_dirs(tmp_path):
    """父目录不存在必自动创建."""
    from oidc_vault_audit import AuditStore

    nested = tmp_path / "deep" / "nested" / "audit.db"
    AuditStore(nested)
    assert nested.exists()


def test_append_returns_id(audit_store):
    """append 必返回自增 id."""
    id1 = audit_store.append({"ts": "2026-06-16T00:00:00Z", "provider": "grafana"})
    id2 = audit_store.append({"ts": "2026-06-16T00:00:01Z", "provider": "dingtalk"})
    assert id2 > id1


def test_query_returns_appended(audit_store):
    """query 必返回刚 append 的行."""
    audit_store.append(
        {
            "ts": "2026-06-16T00:00:00Z",
            "github_sub": "repo:o/r:ref:refs/heads/main",
            "provider": "grafana",
            "ttl_min": 30,
            "client_ip": "1.2.3.4",
        }
    )
    rows = audit_store.query()
    assert len(rows) == 1
    assert rows[0]["provider"] == "grafana"
    assert rows[0]["ttl_min"] == 30


def test_query_filter_by_provider(audit_store):
    """按 provider 过滤."""
    audit_store.append({"ts": "2026-06-16T00:00:00Z", "provider": "grafana"})
    audit_store.append({"ts": "2026-06-16T00:00:01Z", "provider": "dingtalk"})
    audit_store.append({"ts": "2026-06-16T00:00:02Z", "provider": "alertmanager"})
    rows = audit_store.query(provider="grafana")
    assert len(rows) == 1
    assert rows[0]["provider"] == "grafana"


def test_query_filter_by_since(audit_store):
    """按时间过滤 (since)."""
    audit_store.append({"ts": "2026-06-15T00:00:00Z", "provider": "grafana"})
    audit_store.append({"ts": "2026-06-16T00:00:00Z", "provider": "dingtalk"})
    audit_store.append({"ts": "2026-06-17T00:00:00Z", "provider": "alertmanager"})
    rows = audit_store.query(since="2026-06-16T00:00:00Z")
    assert len(rows) == 2
    assert all(r["ts"] >= "2026-06-16" for r in rows)


def test_query_limit(audit_store):
    """limit 生效."""
    for i in range(20):
        audit_store.append({"ts": f"2026-06-16T00:00:{i:02d}Z", "provider": "grafana"})
    rows = audit_store.query(limit=5)
    assert len(rows) == 5


def test_count(audit_store):
    """count 返回总行数."""
    for i in range(7):
        audit_store.append({"ts": f"2026-06-16T00:00:{i:02d}Z", "provider": "grafana"})
    assert audit_store.count() == 7
    assert audit_store.count(provider="dingtalk") == 0


def test_count_filter_by_provider(audit_store):
    """按 provider 计数."""
    audit_store.append({"ts": "2026-06-16T00:00:00Z", "provider": "grafana"})
    audit_store.append({"ts": "2026-06-16T00:00:01Z", "provider": "grafana"})
    audit_store.append({"ts": "2026-06-16T00:00:02Z", "provider": "dingtalk"})
    assert audit_store.count(provider="grafana") == 2


def test_truncate_clears_all(audit_store):
    """truncate 清空."""
    audit_store.append({"ts": "2026-06-16T00:00:00Z", "provider": "grafana"})
    audit_store.append({"ts": "2026-06-16T00:00:01Z", "provider": "dingtalk"})
    assert audit_store.count() == 2
    audit_store.truncate()
    assert audit_store.count() == 0


def test_persistence_survives_reopen(tmp_path):
    """重启进程后数据仍在."""
    from oidc_vault_audit import AuditStore

    db = tmp_path / "persist.db"
    s1 = AuditStore(db)
    s1.append({"ts": "2026-06-16T00:00:00Z", "provider": "grafana"})
    s1.append({"ts": "2026-06-16T00:00:01Z", "provider": "dingtalk"})
    # 模拟重启
    s2 = AuditStore(db)
    assert s2.count() == 2
    rows = s2.query()
    assert rows[0]["provider"] == "dingtalk"  # 最新


def test_thread_safety(audit_store):
    """多线程 append 不丢数据."""
    import threading

    errors = []

    def worker(n: int):
        try:
            for i in range(10):
                audit_store.append(
                    {
                        "ts": f"2026-06-16T00:00:{i:02d}Z",
                        "provider": "grafana",
                        "ttl_min": n,
                    }
                )
        except Exception as e:
            errors.append(e)

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(5)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert not errors
    assert audit_store.count() == 50


def test_vault_server_persists_audit(tmp_path, monkeypatch):
    """vault /v1/exchange 后审计必持久化到 SQLite."""
    db_path = tmp_path / "vault_audit.db"
    monkeypatch.setenv("ZHS_VAULT_MOCK", "1")
    monkeypatch.setenv("ZHS_VAULT_AUDIT_DB", str(db_path))

    # 重新加载模块以让 ZHS_VAULT_AUDIT_DB 生效
    if "oidc_vault_server" in sys.modules:
        del sys.modules["oidc_vault_server"]
    server = importlib.import_module("oidc_vault_server")

    client = TestClient(server.app)

    # 构造 mock GitHub OIDC JWT
    import base64 as _b64
    import json as _json

    payload = {"sub": "repo:o/r:ref:refs/heads/main", "aud": "zhs-vault", "exp": 9999999999}
    p = _b64.urlsafe_b64encode(_json.dumps(payload).encode()).rstrip(b"=").decode()
    fake_jwt = f"h.{p}.s"

    resp = client.post(
        "/v1/exchange",
        headers={"Authorization": f"Bearer {fake_jwt}"},
        json={"provider": "grafana", "ttl_min": 30},
    )
    assert resp.status_code == 200

    # 审计必写入 SQLite
    assert server.audit_store is not None
    rows = server.audit_store.query(provider="grafana")
    assert len(rows) == 1
    assert rows[0]["provider"] == "grafana"
    assert rows[0]["github_sub"] == "repo:o/r:ref:refs/heads/main"


def test_audit_endpoint_returns_sqlite_source(tmp_path, monkeypatch):
    """/v1/audit 必返回 source=sqlite (持久化模式)."""
    db_path = tmp_path / "vault_audit2.db"
    monkeypatch.setenv("ZHS_VAULT_MOCK", "1")
    monkeypatch.setenv("ZHS_VAULT_AUDIT_DB", str(db_path))

    if "oidc_vault_server" in sys.modules:
        del sys.modules["oidc_vault_server"]
    server = importlib.import_module("oidc_vault_server")
    client = TestClient(server.app)

    resp = client.get("/v1/audit")
    assert resp.status_code == 200
    body = resp.json()
    assert body["source"] == "sqlite"


def test_audit_endpoint_filter_provider(tmp_path, monkeypatch):
    """/v1/audit?provider=grafana 必过滤."""
    db_path = tmp_path / "vault_audit3.db"
    monkeypatch.setenv("ZHS_VAULT_MOCK", "1")
    monkeypatch.setenv("ZHS_VAULT_AUDIT_DB", str(db_path))

    if "oidc_vault_server" in sys.modules:
        del sys.modules["oidc_vault_server"]
    server = importlib.import_module("oidc_vault_server")
    client = TestClient(server.app)

    import base64 as _b64
    import json as _json

    payload = {"sub": "repo:o/r:ref:refs/heads/main", "aud": "zhs-vault", "exp": 9999999999}
    p = _b64.urlsafe_b64encode(_json.dumps(payload).encode()).rstrip(b"=").decode()
    fake_jwt = f"h.{p}.s"

    for prov in ("grafana", "dingtalk", "grafana"):
        client.post(
            "/v1/exchange",
            headers={"Authorization": f"Bearer {fake_jwt}"},
            json={"provider": prov, "ttl_min": 15},
        )

    resp = client.get("/v1/audit?provider=grafana")
    body = resp.json()
    assert body["count"] == 2
    assert all(r["provider"] == "grafana" for r in body["rows"])


def test_vault_works_without_audit_db(monkeypatch):
    """ZHS_VAULT_AUDIT_DB 不设时, 退化为内存, 仍能正常工作."""
    monkeypatch.setenv("ZHS_VAULT_MOCK", "1")
    monkeypatch.delenv("ZHS_VAULT_AUDIT_DB", raising=False)

    if "oidc_vault_server" in sys.modules:
        del sys.modules["oidc_vault_server"]
    server = importlib.import_module("oidc_vault_server")
    assert server.audit_store is None

    client = TestClient(server.app)
    import base64 as _b64
    import json as _json

    payload = {"sub": "repo:o/r:ref:refs/heads/main", "aud": "zhs-vault", "exp": 9999999999}
    p = _b64.urlsafe_b64encode(_json.dumps(payload).encode()).rstrip(b"=").decode()
    fake_jwt = f"h.{p}.s"
    resp = client.post(
        "/v1/exchange",
        headers={"Authorization": f"Bearer {fake_jwt}"},
        json={"provider": "grafana", "ttl_min": 30},
    )
    assert resp.status_code == 200

    resp2 = client.get("/v1/audit")
    assert resp2.json()["source"] == "memory"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
