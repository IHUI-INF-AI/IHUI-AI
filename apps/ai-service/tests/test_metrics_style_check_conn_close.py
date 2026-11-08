# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AIS-021: publish_style_check 读写路径必须真正 await conn.close()。

缺陷: metrics_collector.persist_style_check / latest_style_check 的 finally 里写的是
`conn.close()`(缺少 await)⇒ 返回的协程从未被执行 ⇒ 连接不归还共享池。
夹具用假 conn(close 为 async 方法并置 closed=True),正常/异常路径都断言为 True;
旧代码下该断言必红。
"""
from __future__ import annotations

from datetime import UTC, datetime

from app.services.publish import metrics_collector as mc


class _FakeConn:
    """asyncpg 连接最小替身:close 只有被 await 才置 closed=True。"""

    def __init__(self, *, fetchrow_result=None, execute_error=None):
        self.closed = False
        self._fetchrow_result = fetchrow_result
        self._execute_error = execute_error
        self.execute_calls: list[tuple] = []
        self.fetchrow_calls: list[tuple] = []

    async def execute(self, *args):
        self.execute_calls.append(args)
        if self._execute_error is not None:
            raise self._execute_error

    async def fetchrow(self, *args):
        self.fetchrow_calls.append(args)
        if self._execute_error is not None:
            raise self._execute_error
        return self._fetchrow_result

    async def close(self):
        self.closed = True


def _install_conns(monkeypatch, conns):
    """按调用顺序返回假 conn(第 1 个给 _ensure_style_check_table,第 2 个给读写)。"""
    index = {"value": 0}

    async def _fake_get_db_conn():
        conn = conns[index["value"]]
        index["value"] += 1
        return conn

    monkeypatch.setattr(mc, "get_db_conn", _fake_get_db_conn)
    return index


def _row() -> dict:
    return {
        "passed": True,
        "issues": [],
        "content_length": 12,
        "images_total": 1,
        "images_loaded": 1,
        "checked_at": datetime(2026, 11, 8, tzinfo=UTC),
        "platform": "wordpress",
        "content_id": "c-1",
    }


async def test_persist_style_check_closes_conn_on_success(monkeypatch) -> None:
    table_conn = _FakeConn()
    write_conn = _FakeConn()
    _install_conns(monkeypatch, [table_conn, write_conn])

    await mc.persist_style_check("task-1", "wordpress", "c-1", {"passed": True, "issues": []})

    assert write_conn.execute_calls, "INSERT 未执行"
    assert write_conn.closed is True
    assert table_conn.closed is True


async def test_persist_style_check_closes_conn_on_error(monkeypatch) -> None:
    table_conn = _FakeConn()
    write_conn = _FakeConn(execute_error=RuntimeError("boom"))
    _install_conns(monkeypatch, [table_conn, write_conn])

    # 函数内部吞异常,但 finally 仍必须归还连接
    assert await mc.persist_style_check("task-1", "wordpress", "c-1", {"passed": False}) is None
    assert write_conn.closed is True
    assert table_conn.closed is True


async def test_latest_style_check_closes_conn_on_success(monkeypatch) -> None:
    table_conn = _FakeConn()
    read_conn = _FakeConn(fetchrow_result=_row())
    _install_conns(monkeypatch, [table_conn, read_conn])

    result = await mc.latest_style_check("task-1", "wordpress")

    assert result is not None
    assert result["passed"] is True
    assert result["platform"] == "wordpress"
    assert read_conn.fetchrow_calls, "SELECT 未执行"
    assert read_conn.closed is True
    assert table_conn.closed is True


async def test_latest_style_check_closes_conn_on_error(monkeypatch) -> None:
    table_conn = _FakeConn()
    read_conn = _FakeConn(execute_error=RuntimeError("boom"))
    _install_conns(monkeypatch, [table_conn, read_conn])

    assert await mc.latest_style_check("task-1") is None
    assert read_conn.closed is True
    assert table_conn.closed is True
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
