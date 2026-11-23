# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""B3-07 真实 PostgreSQL 集成测试。

默认跳过；设置 `IHUI_TEST_PG_DSN` 指向**专用测试库**后运行：

    IHUI_TEST_PG_DSN=postgresql://postgres:postgres@127.0.0.1:5432/ihui_test_metadata \
      python -m pytest apps/ai-service/tests/test_request_metadata_pg.py -q

测试会建表、写一行、重复写一次并核对 `ON CONFLICT` 不重复；不连生产库。
"""

from __future__ import annotations

import asyncio
import os
import uuid

import pytest

DSN = os.environ.get("IHUI_TEST_PG_DSN", "")

pytestmark = pytest.mark.skipif(
    not DSN,
    reason="设置 IHUI_TEST_PG_DSN 后才跑真实 PostgreSQL 集成测试",
)


def test_record_chat_metadata_real_pg(monkeypatch):
    from app.core import config
    from app.core.db_pool import get_shared_pool
    from app.services import request_metadata as rm

    monkeypatch.setattr(config.settings, "database_url", DSN)
    request_id = f"pg-test-{uuid.uuid4()}"

    async def run() -> None:
        meta, reason = rm.validate_chat_metadata(
            {
                "workspace": {"file_count": 3, "languages": ["ts"]},
                "business": {"id": "biz-pg-test", "stage": "test"},
                "context": {"request_id": request_id},
                "user": {"user_id": "user-pg-test"},
            }
        )
        assert meta is not None and reason is None
        first = await rm.record_chat_metadata(meta)
        second = await rm.record_chat_metadata(meta)
        pool = await get_shared_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                f"SELECT request_id, user_id, workspace_languages FROM {rm.TRACKING_TABLE} "
                "WHERE request_id = $1",
                request_id,
            )
            count = await conn.fetchval(
                f"SELECT count(*) FROM {rm.TRACKING_TABLE} WHERE request_id = $1",
                request_id,
            )
            await conn.execute(
                f"DELETE FROM {rm.TRACKING_TABLE} WHERE request_id = $1",
                request_id,
            )
        await pool.close()
        assert first["recorded"] is True
        assert second["recorded"] is True
        assert count == 1
        assert row is not None
        assert row["user_id"] == "user-pg-test"
        assert row["workspace_languages"] == ["ts"]

    asyncio.run(run())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
