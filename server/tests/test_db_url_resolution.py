"""数据库 URL 解析行为集成测试.

覆盖:
1. ENV=production/prod/staging + PG 不可用 -> RuntimeError (拒绝降级)
2. ENV=production + PG 可用 -> 保持原 PG URL
3. ENV=dev (默认) + PG 不可用 -> 降级到 SQLite
4. ENV=dev + PG 可用 -> 保持原 PG URL
5. 非 PG URL (SQLite/MySQL) -> 原样返回

注意: 不需要真实 PG 连接. 用一个能快速失败的 PG URL (127.0.0.1:1, 端口拒绝连接)
来模拟 "PG 不可用" 场景.
"""
from __future__ import annotations

import os
import socket
from unittest import mock

import pytest


# 找本机一个保证拒绝连接的端口 (绑定后立即关闭)
def _find_unused_port() -> int:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]
    finally:
        s.close()


# 一个必然连接失败的 PG URL (端口 1 通常被 IANA 保留, 不会有人监听)
PG_UNREACHABLE_URL = "postgresql+psycopg2://nobody:nopass@127.0.0.1:1/nonexistent?connect_timeout=1"

# 模拟 PG 可用: 用一个能 SELECT 1 的 SQLite 但仍声称是 postgresql URL, 用 mock 替换 _resolve_db_url 内部的 create_engine
# 更简单做法: 直接 mock sqlalchemy.create_engine 返回一个能 connect().execute(text("SELECT 1")) 的对象
PG_REACHABLE_URL = "postgresql+psycopg2://user:pass@db.example.com:5432/mydb"


@pytest.fixture(autouse=True)
def _reset_env(monkeypatch):
    """每个测试前后清理 ENV, 避免污染."""
    for key in ("ENV",):
        monkeypatch.delenv(key, raising=False)
    yield


def _patched_resolve(url: str, idx: int):
    """导入 _resolve_db_url 走真实代码, 但 ENV 由 fixture 控制."""
    from app.database import _resolve_db_url
    return _resolve_db_url(url, idx)


def test_non_pg_url_passthrough():
    """非 PG URL (SQLite, MySQL) 原样返回, 不做 ping."""
    assert _patched_resolve("sqlite:///foo.db", 1) == "sqlite:///foo.db"
    assert _patched_resolve("mysql://x", 1) == "mysql://x"


def test_pg_unreachable_in_dev_falls_back_to_sqlite(monkeypatch):
    """ENV=dev + PG 不可用 -> 降级到 SQLite fallback 文件."""
    monkeypatch.setenv("ENV", "dev")
    out = _patched_resolve(PG_UNREACHABLE_URL, 7)
    assert out.startswith("sqlite:///"), f"应降级到 SQLite, 实际: {out}"
    assert "zhs_db_fallback_7" in out


def test_pg_unreachable_in_test_falls_back_to_sqlite(monkeypatch):
    """ENV=test + PG 不可用 -> 降级到 SQLite."""
    monkeypatch.setenv("ENV", "test")
    out = _patched_resolve(PG_UNREACHABLE_URL, 2)
    assert out.startswith("sqlite:///")
    assert "zhs_db_fallback_2" in out


def test_pg_unreachable_in_production_raises(monkeypatch):
    """ENV=production + PG 不可用 -> RuntimeError, 不允许降级."""
    monkeypatch.setenv("ENV", "production")
    with pytest.raises(RuntimeError) as exc_info:
        _patched_resolve(PG_UNREACHABLE_URL, 1)
    msg = str(exc_info.value)
    assert "生产环境" in msg
    assert "拒绝降级" in msg
    assert "PostgreSQL 不可用" in msg


def test_pg_unreachable_in_prod_alias_raises(monkeypatch):
    """ENV=prod / staging 也都拒绝降级."""
    for env in ("prod", "staging"):
        monkeypatch.setenv("ENV", env)
        with pytest.raises(RuntimeError):
            _patched_resolve(PG_UNREACHABLE_URL, 1)


def test_pg_reachable_in_production_passes(monkeypatch):
    """ENV=production + PG 可用 -> 保持原 PG URL."""
    monkeypatch.setenv("ENV", "production")

    fake_engine = mock.MagicMock()
    fake_conn = mock.MagicMock()
    fake_conn.__enter__ = mock.MagicMock(return_value=fake_conn)
    fake_conn.__exit__ = mock.MagicMock(return_value=False)
    fake_conn.execute = mock.MagicMock(return_value=None)
    fake_engine.connect = mock.MagicMock(return_value=fake_conn)
    fake_engine.dispose = mock.MagicMock()

    # patch app.database.create_engine (局部导入的 create_engine 不影响 sqlalchemy.create_engine 的全局 patch)
    with mock.patch("app.database.create_engine", return_value=fake_engine) as ce:
        out = _patched_resolve(PG_REACHABLE_URL, 1)
    assert out == PG_REACHABLE_URL
    assert ce.called
    assert fake_engine.connect.called
    assert fake_engine.dispose.called


def test_pg_reachable_in_dev_passes(monkeypatch):
    """ENV=dev + PG 可用 -> 保持原 PG URL, 不降级."""
    monkeypatch.setenv("ENV", "dev")
    fake_engine = mock.MagicMock()
    fake_conn = mock.MagicMock()
    fake_conn.__enter__ = mock.MagicMock(return_value=fake_conn)
    fake_conn.__exit__ = mock.MagicMock(return_value=False)
    fake_conn.execute = mock.MagicMock(return_value=None)
    fake_engine.connect = mock.MagicMock(return_value=fake_conn)
    fake_engine.dispose = mock.MagicMock()

    with mock.patch("app.database.create_engine", return_value=fake_engine):
        out = _patched_resolve(PG_REACHABLE_URL, 1)
    assert out == PG_REACHABLE_URL


def test_pg_reachable_in_prod_but_runtime_error_still_raises(monkeypatch):
    """ENV=production + create_engine 抛异常 -> 仍 RuntimeError."""
    monkeypatch.setenv("ENV", "production")
    with mock.patch("app.database.create_engine", side_effect=Exception("engine boom")):
        with pytest.raises(RuntimeError) as exc_info:
            _patched_resolve(PG_REACHABLE_URL, 1)
    assert "engine boom" in str(exc_info.value) or "PostgreSQL 不可用" in str(exc_info.value)


def test_fallback_path_is_absolute(monkeypatch, tmp_path):
    """降级路径必须是绝对路径 (避免工作目录影响)."""
    monkeypatch.setenv("ENV", "dev")
    monkeypatch.chdir(tmp_path)  # 切到临时目录
    out = _patched_resolve(PG_UNREACHABLE_URL, 3)
    # sqlite:/// + 绝对路径
    assert out.startswith("sqlite:///")
    path_part = out[len("sqlite:///"):]
    if os.name == "nt":
        path_part = path_part.replace("/", os.sep)
    assert os.path.isabs(path_part), f"fallback 路径必须是绝对路径, 实际: {path_part}"
