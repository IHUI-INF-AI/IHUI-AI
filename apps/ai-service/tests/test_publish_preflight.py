# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""发布前预检与请求指纹的回归测试。"""
from __future__ import annotations

import json
from typing import Any

import pytest

from app.routers.publish import PublishTarget, TaskCreate, _task_request_hash
from app.services.publish.base_adapter import PublishContent
from app.services.publish.preflight import run_preflight


class _FakeConn:
    def __init__(
        self,
        row: dict[str, Any] | None,
        session: dict[str, Any] | None = None,
    ):
        self._row = row
        self._session = session

    async def fetchrow(self, sql: str, *args: Any) -> dict[str, Any] | None:
        if "FROM publish_accounts" in sql:
            return self._row
        if "publish_session_state" in sql:
            return self._session
        return None


@pytest.mark.asyncio
async def test_preflight_blocks_preflight_blocker_string() -> None:
    extra = json.dumps({
        "preflight_blockers": json.dumps([
            {"code": "netease_not_realname", "message": "未实名", "next_action": "去实名"}
        ], ensure_ascii=False),
    }, ensure_ascii=False)
    conn = _FakeConn({
        "id": 19, "platform": "netease", "display_name": "网易号",
        "status": "active", "extra": extra, "credentials_enc": None,
    })
    result = await run_preflight(
        conn, "u1",
        [{"platform": "netease", "account_id": 19}],
        PublishContent(format="md", title="t", text="body"),
    )
    assert result["ok"] is False
    assert result["targets"][0]["code"] == "netease_not_realname"


@pytest.mark.asyncio
async def test_preflight_blocks_publish_blocked_flag() -> None:
    conn = _FakeConn({
        "id": 7, "platform": "wechat", "display_name": "公众号",
        "status": "active", "extra": '{"publish_blocked": true}',
        "credentials_enc": None,
    })
    result = await run_preflight(
        conn, "u1",
        [{"platform": "wechat", "account_id": 7}],
        PublishContent(format="md", title="t", text="body"),
    )
    assert result["ok"] is False
    assert result["targets"][0]["code"] == "account_blocked"


@pytest.mark.asyncio
async def test_preflight_tolerates_minimal_test_row() -> None:
    conn = _FakeConn({"id": 111})
    result = await run_preflight(
        conn, "u1",
        [{"platform": "wordpress", "account_id": 111}],
        PublishContent(format="md", title="t", text="body"),
    )
    assert result["targets"][0]["accountId"] == 111


def test_request_hash_changes_with_targets() -> None:
    body = TaskCreate(
        title="标题", format="md", text="正文",
        targets=[PublishTarget(platform="wordpress", account_id=1)],
    )
    h1 = _task_request_hash(body, [{"platform": "wordpress", "account_id": 1}])
    h2 = _task_request_hash(body, [{"platform": "wordpress", "account_id": 2}])
    assert h1 != h2
    assert len(h1) == 64


@pytest.mark.asyncio
async def test_preflight_skips_auto_clear_blocker_when_session_healthy() -> None:
    conn = _FakeConn(
        {
            "id": 22, "platform": "youtube", "display_name": "YouTube",
            "status": "active", "credentials_enc": None,
            "extra": json.dumps({
                "preflight_blockers": [{
                    "code": "youtube_oauth_expired",
                    "message": "登录态失效",
                    "auto_clear_on_healthy": True,
                }],
            }, ensure_ascii=False),
        },
        session={"status": "healthy", "last_error": "", "last_error_kind": ""},
    )
    result = await run_preflight(
        conn, "u1",
        [{"platform": "youtube", "account_id": 22}],
        PublishContent(
            format="video", title="t", text="body",
            file_path=r"C:\IHUI-AI\apps\ai-service\.uploads\publish\dummy.mp4",
        ),
    )
    assert result["targets"][0]["code"] != "youtube_oauth_expired"


@pytest.mark.asyncio
async def test_preflight_ignores_expired_blocker() -> None:
    conn = _FakeConn({
        "id": 18, "platform": "qq", "display_name": "企鹅号",
        "status": "active", "credentials_enc": None,
        "extra": json.dumps({
            "preflight_blockers": [{
                "code": "qq_quota_zero",
                "message": "配額 0",
                "expires_at": "2020-01-01T00:00:00+08:00",
            }],
        }, ensure_ascii=False),
    })
    result = await run_preflight(
        conn, "u1",
        [{"platform": "qq", "account_id": 18}],
        PublishContent(format="md", title="t", text="body"),
    )
    assert result["targets"][0]["code"] != "qq_quota_zero"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
