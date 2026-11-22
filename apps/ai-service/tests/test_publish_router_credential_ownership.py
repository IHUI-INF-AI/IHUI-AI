# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""钉 router 第二凭据提取入口的归属校验(2026-11-22 审计补)。

``monitor/verify`` 与 ``monitor/refresh-metrics`` 经 ``_load_account_credentials``
解密账号凭证。此前该函数只按 id+platform 取,而 account_id 从 task.targets(JSON,
可含脏/过时值)解析 —— 一旦 targets 指向他人账号,无归属兜底就会解出他人凭据。
本测试钉住修复后的三项行为:缺 user_id fail-closed、SQL 带 user_id 归属、归属不符
取不到行。与 scheduler._load_credentials 的守卫对称,杜绝"两条提取入口一条有校验
一条没有"的漂移。
"""

from __future__ import annotations

from typing import Any

import pytest

from app.routers import publish as router


class _FakeConn:
    """只实现 fetchrow + close;记录 SQL 与参数供断言。"""

    def __init__(self, row: dict[str, Any] | None) -> None:
        self.row = row
        self.calls: list[tuple[str, tuple[Any, ...]]] = []
        self.closed = False

    async def fetchrow(self, sql: str, *args: Any) -> dict[str, Any] | None:
        self.calls.append((sql, args))
        return self.row

    async def close(self) -> None:
        self.closed = True


def _patch(monkeypatch: pytest.MonkeyPatch, conn: _FakeConn) -> None:
    async def fake_get_conn() -> _FakeConn:
        return conn

    monkeypatch.setattr(router, "_get_conn", fake_get_conn)


@pytest.mark.asyncio
async def test_missing_user_id_fails_closed_without_touching_db(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """缺 user_id ⇒ 直接返回 None,连库都不碰(避免归属未定的出站)。"""
    conn = _FakeConn({"credentials_enc": "cipher"})
    _patch(monkeypatch, conn)
    assert await router._load_account_credentials(1, "csdn", "") is None
    assert conn.calls == []


@pytest.mark.asyncio
async def test_query_scopes_by_user_id(monkeypatch: pytest.MonkeyPatch) -> None:
    """取密文必须带 user_id 归属参数(三参数),杜绝越权加载。"""
    conn = _FakeConn({"credentials_enc": "cipher"})
    _patch(monkeypatch, conn)
    # 让 decrypt 返回可辨识值,只验 SQL 与参数,不依赖真实密钥
    monkeypatch.setattr(router, "decrypt", lambda cipher: {"cookies": cipher})
    out = await router._load_account_credentials(7, "csdn", "owner-1")
    assert out == {"cookies": "cipher"}
    assert len(conn.calls) == 1
    sql, args = conn.calls[0]
    assert "user_id=$3" in sql
    assert args == (7, "csdn", "owner-1")
    assert conn.closed is True


@pytest.mark.asyncio
async def test_no_row_when_ownership_mismatch(monkeypatch: pytest.MonkeyPatch) -> None:
    """归属不符 ⇒ DB 不返回行 ⇒ 解不出凭证(模拟 WHERE user_id 挡住他人账号)。"""
    conn = _FakeConn(None)
    _patch(monkeypatch, conn)
    assert await router._load_account_credentials(7, "csdn", "other-user") is None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
