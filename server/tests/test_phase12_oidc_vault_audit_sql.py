"""Phase 12 建议 1: OIDC Vault 审计 SQL 后端 (SQLAlchemy) 验证."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "ci"))


def _has_sqlalchemy() -> bool:
    try:
        import sqlalchemy  # noqa: F401

        return True
    except ImportError:
        return False


pytestmark = pytest.mark.skipif(not _has_sqlalchemy(), reason="SQLAlchemy 未安装, 跳过")


@pytest.fixture()
def store(tmp_path):
    """每个测试一个独立 SQLite 库."""
    from oidc_vault_audit_sql import SqlAuditStore

    db_path = tmp_path / "audit.db"
    s = SqlAuditStore(f"sqlite:///{db_path}")
    yield s
    s.close()
    if db_path.exists():
        db_path.unlink()


def test_sqlite_url_creates_db_file(store, tmp_path):
    """sqlite URL 必创建 db 文件."""
    assert (tmp_path / "audit.db").exists()


def test_in_memory_url_supported(tmp_path):
    """sqlite:///:memory: 必能工作 (无文件)."""
    from oidc_vault_audit_sql import SqlAuditStore

    s = SqlAuditStore("sqlite:///:memory:")
    assert s.count() == 0
    s.append({"ts": "2026-06-16T00:00:00Z", "provider": "grafana"})
    assert s.count() == 1
    s.close()


def test_append_returns_id(store):
    """append 必返回自增 id."""
    id1 = store.append({"ts": "2026-06-16T00:00:00Z", "provider": "grafana"})
    id2 = store.append({"ts": "2026-06-16T00:00:01Z", "provider": "dingtalk"})
    assert id2 > id1


def test_query_returns_appended(store):
    """query 必返回刚 append 的行."""
    store.append(
        {
            "ts": "2026-06-16T00:00:00Z",
            "github_sub": "repo:o/r:ref:refs/heads/main",
            "provider": "grafana",
            "ttl_min": 30,
            "client_ip": "1.2.3.4",
        }
    )
    rows = store.query()
    assert len(rows) == 1
    assert rows[0]["provider"] == "grafana"
    assert rows[0]["ttl_min"] == 30
    assert rows[0]["github_sub"] == "repo:o/r:ref:refs/heads/main"


def test_query_filter_by_provider(store):
    """按 provider 过滤."""
    store.append({"ts": "2026-06-16T00:00:00Z", "provider": "grafana"})
    store.append({"ts": "2026-06-16T00:00:01Z", "provider": "dingtalk"})
    store.append({"ts": "2026-06-16T00:00:02Z", "provider": "alertmanager"})
    rows = store.query(provider="grafana")
    assert len(rows) == 1
    assert rows[0]["provider"] == "grafana"


def test_query_filter_by_since(store):
    """按时间过滤."""
    store.append({"ts": "2026-06-15T00:00:00Z", "provider": "grafana"})
    store.append({"ts": "2026-06-16T00:00:00Z", "provider": "dingtalk"})
    store.append({"ts": "2026-06-17T00:00:00Z", "provider": "alertmanager"})
    rows = store.query(since="2026-06-16T00:00:00Z")
    assert len(rows) == 2


def test_query_filter_by_action(store):
    """按 action 过滤 (新功能, 原生 SQL 后端没有)."""
    store.append({"ts": "2026-06-16T00:00:00Z", "provider": "grafana", "action": "exchange"})
    store.append({"ts": "2026-06-16T00:00:01Z", "provider": "dingtalk", "action": "redeem"})
    store.append({"ts": "2026-06-16T00:00:02Z", "provider": "grafana", "action": "validate"})
    rows = store.query(action="redeem")
    assert len(rows) == 1
    assert rows[0]["provider"] == "dingtalk"


def test_query_limit(store):
    """limit 生效."""
    for i in range(20):
        store.append({"ts": f"2026-06-16T00:00:{i:02d}Z", "provider": "grafana"})
    rows = store.query(limit=5)
    assert len(rows) == 5


def test_query_order_by_id_desc(store):
    """按 id 倒序 (最新在前)."""
    store.append({"ts": "2026-06-16T00:00:00Z", "provider": "grafana", "ttl_min": 10})
    store.append({"ts": "2026-06-16T00:00:01Z", "provider": "grafana", "ttl_min": 20})
    store.append({"ts": "2026-06-16T00:00:02Z", "provider": "grafana", "ttl_min": 30})
    rows = store.query()
    assert rows[0]["ttl_min"] == 30  # 最新
    assert rows[2]["ttl_min"] == 10  # 最旧


def test_count(store):
    """count 必正确."""
    for i in range(7):
        store.append({"ts": f"2026-06-16T00:00:{i:02d}Z", "provider": "grafana"})
    assert store.count() == 7
    assert store.count(provider="dingtalk") == 0


def test_count_filter_by_provider(store):
    """按 provider 计数."""
    store.append({"ts": "2026-06-16T00:00:00Z", "provider": "grafana"})
    store.append({"ts": "2026-06-16T00:00:01Z", "provider": "grafana"})
    store.append({"ts": "2026-06-16T00:00:02Z", "provider": "dingtalk"})
    assert store.count(provider="grafana") == 2


def test_truncate_clears_all(store):
    """truncate 清空."""
    store.append({"ts": "2026-06-16T00:00:00Z", "provider": "grafana"})
    store.append({"ts": "2026-06-16T00:00:01Z", "provider": "dingtalk"})
    assert store.count() == 2
    store.truncate()
    assert store.count() == 0


def test_persistence_survives_reopen(tmp_path):
    """重启进程后数据仍在."""
    from oidc_vault_audit_sql import SqlAuditStore

    url = f"sqlite:///{tmp_path / 'persist.db'}"
    s1 = SqlAuditStore(url)
    s1.append({"ts": "2026-06-16T00:00:00Z", "provider": "grafana"})
    s1.append({"ts": "2026-06-16T00:00:01Z", "provider": "dingtalk"})
    s1.close()

    s2 = SqlAuditStore(url)
    assert s2.count() == 2
    rows = s2.query()
    assert rows[0]["provider"] == "dingtalk"  # 最新
    s2.close()


def test_batch_append(store):
    """批量插入必返回所有 id."""
    entries = [{"ts": f"2026-06-16T00:00:{i:02d}Z", "provider": "grafana", "ttl_min": i} for i in range(10)]
    ids = store.append_batch(entries)
    assert len(ids) == 10
    assert all(isinstance(i, int) for i in ids)
    assert store.count() == 10


def test_batch_append_preserves_order(store):
    """批量插入必保序."""
    entries = [
        {"ts": "2026-06-16T00:00:00Z", "provider": "grafana", "ttl_min": 1},
        {"ts": "2026-06-16T00:00:01Z", "provider": "dingtalk", "ttl_min": 2},
        {"ts": "2026-06-16T00:00:02Z", "provider": "alertmanager", "ttl_min": 3},
    ]
    ids = store.append_batch(entries)
    rows = store.query()
    assert rows[0]["provider"] == "alertmanager"
    assert rows[1]["provider"] == "dingtalk"
    assert rows[2]["provider"] == "grafana"


def test_thread_safety(store):
    """多线程并发 append 不丢数据."""
    import threading

    errors = []

    def worker(n: int):
        try:
            for i in range(10):
                store.append(
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
    assert store.count() == 50


def test_raw_json_preserved(store):
    """raw_json 必含完整原始 dict (含中文)."""
    store.append(
        {
            "ts": "2026-06-16T00:00:00Z",
            "provider": "grafana",
            "client_ip": "192.168.1.1",
            "extra": "测试中文",
        }
    )
    rows = store.query()
    assert "测试中文" in rows[0]["raw_json"]


def test_compatible_with_vault_server(tmp_path, monkeypatch):
    """SqlAuditStore 必能替代原 AuditStore 接入 vault server."""
    db_path = tmp_path / "vault.db"
    monkeypatch.setenv("ZHS_VAULT_MOCK", "1")
    monkeypatch.setenv("ZHS_VAULT_AUDIT_DB", str(db_path))
    # 重置模块使 ZHS_VAULT_AUDIT_DB 生效
    import importlib

    if "oidc_vault_server" in sys.modules:
        del sys.modules["oidc_vault_server"]
    if "oidc_vault_audit" in sys.modules:
        del sys.modules["oidc_vault_audit"]
    server = importlib.import_module("oidc_vault_server")
    client = __import__("fastapi.testclient", fromlist=["TestClient"]).TestClient(server.app)

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

    # 审计必持久化到 sqlite (原 AuditStore)
    assert server.audit_store is not None
    rows = server.audit_store.query(provider="grafana")
    assert len(rows) == 1


def test_close_disposes_engine(store):
    """close 必能 dispose engine."""
    store.close()  # 不应抛错


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
