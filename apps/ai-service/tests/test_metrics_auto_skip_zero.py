# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
"""自动回收失败不写 0 快照,否则下一轮会被 6 小时窗口挡住,永远不再重试。"""

from __future__ import annotations

from typing import Any

import pytest

from app.services.publish import metrics_collector as mc


@pytest.mark.asyncio
async def test_failed_collect_skips_insert_when_write_zero_disabled(monkeypatch) -> None:
    async def _boom(*args: Any, **kwargs: Any) -> None:
        metrics = args[3]
        metrics["source"]["error"] = "login expired"

    async def _must_not_write() -> None:
        raise AssertionError("失败快照不应写库")

    monkeypatch.setattr(mc, "_collect_zhihu", _boom)
    monkeypatch.setattr(mc, "get_db_conn", _must_not_write)

    metrics = await mc.collect_metrics(
        "task-1", "zhihu", "content-1", {},
        write_zero_on_error=False,
    )

    assert metrics["source"]["error"] == "login expired"
    assert metrics["views"] == 0
