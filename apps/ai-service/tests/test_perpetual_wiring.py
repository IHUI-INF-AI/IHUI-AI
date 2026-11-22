# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""永久保活接线测试(2026-11-22):证明自愈策略真接进了 cookie_daemon,不是死代码。

针对两条新路径:
  1. cookie 轮换回写失败 ⇒ 带界重试;耗尽 ⇒ RefreshResult.writeback_failed=True
     (上层可见"续期未落地"),refreshed=False(不谎报已续期)。
  2. 软失败(未检测到目标 cookie)⇒ 从 credential_history 回滚探活,救回即提升为当前;
     全军覆没才返回失败。
"""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import AsyncMock, patch

import pytest

from app.services.publish.cookie_refresh_daemon import (
    CookieRefreshDaemon,
    RefreshResult,
)
from app.services.publish.credentials_crypto import encrypt


def _conn_with_row(enc: str, extra: dict[str, Any] | None = None) -> Any:
    """构造最小 async conn:f etchrow 返回一行,close 空操作。"""
    conn = AsyncMock()
    row = {"credentials_enc": enc}
    if extra is not None:
        row["extra"] = json.dumps(extra)
    conn.fetchrow.return_value = row
    conn.execute.return_value = "UPDATE 1"
    return conn


class TestWritebackRetryWiring:
    """回写失败重试接线。"""

    @pytest.mark.asyncio
    async def test_writeback_failure_marked_visible(self) -> None:
        """回写一直失败 ⇒ writeback_failed=True、refreshed=False,调用次数=预算。"""
        d = CookieRefreshDaemon()
        conn = _conn_with_row(encrypt({"z_c0": "old"}))
        # apply_credentials_update 恒失败
        with patch(
            "app.services.publish.cookie_refresh_daemon.get_db_conn",
            new=AsyncMock(return_value=conn),
        ), patch.object(
            CookieRefreshDaemon, "_visit_and_check", return_value=(True, {"z_c0": "new"})
        ), patch(
            "app.services.publish.credential_history.apply_credentials_update",
            new=AsyncMock(side_effect=RuntimeError("db down")),
        ):
            result = await d.refresh_single(1, "zhihu")
        assert result.success is True           # 本次会话仍活着
        assert result.writeback_failed is True  # 但续期没落地 —— 必须可见
        assert result.refreshed is False        # 不能谎报已续期


class TestHistoryRecoveryWiring:
    """历史凭据回滚接线。"""

    @pytest.mark.asyncio
    async def test_soft_failure_rolls_back_to_history(self) -> None:
        """当前凭据探活失败,历史[0]救回 ⇒ success=True、消息点名回滚来源。"""
        d = CookieRefreshDaemon()
        old_enc = encrypt({"z_c0": "still-valid"})
        extra = {"credentialsHistory": [{"enc": old_enc, "at": "2026-11-20", "reason": "x"}]}
        conn = _conn_with_row(encrypt({"z_c0": "dead"}), extra)
        # 第一次(当前凭据)探活失败;历史凭据探活成功
        visit_results = [(False, {}), (True, {})]
        with patch(
            "app.services.publish.cookie_refresh_daemon.get_db_conn",
            new=AsyncMock(return_value=conn),
        ), patch.object(
            CookieRefreshDaemon, "_visit_and_check", side_effect=visit_results
        ), patch(
            "app.services.publish.credential_history.apply_credentials_update",
            new=AsyncMock(return_value=None),
        ):
            result = await d.refresh_single(1, "zhihu")
        assert result.success is True
        assert "历史凭据回滚" in result.message
        assert result.refreshed is True

    @pytest.mark.asyncio
    async def test_all_dead_still_fails(self) -> None:
        """当前 + 历史全失败 ⇒ 仍返回失败(才允许上层喊人工重扫)。"""
        d = CookieRefreshDaemon()
        old_enc = encrypt({"z_c0": "dead-too"})
        extra = {"credentialsHistory": [{"enc": old_enc, "at": "2026-11-19", "reason": "x"}]}
        conn = _conn_with_row(encrypt({"z_c0": "dead"}), extra)
        with patch(
            "app.services.publish.cookie_refresh_daemon.get_db_conn",
            new=AsyncMock(return_value=conn),
        ), patch.object(
            CookieRefreshDaemon, "_visit_and_check", return_value=(False, {})
        ), patch(
            "app.services.publish.credential_history.apply_credentials_update",
            new=AsyncMock(return_value=None),
        ):
            result = await d.refresh_single(1, "zhihu")
        assert result.success is False
        assert "未检测到目标 cookie" in result.message


def test_refresh_result_backward_compatible_defaults() -> None:
    """新字段有默认值 —— 不破坏既有构造点(老测试/老调用)。"""
    r = RefreshResult(account_id=1, platform="p", success=True, message="ok")
    assert r.writeback_failed is False
    assert r.refreshed is False
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
