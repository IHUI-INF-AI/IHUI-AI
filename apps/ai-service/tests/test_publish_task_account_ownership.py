# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AIS-073: 发布任务 target.account_id 必须归属当前用户(双层)。

缺陷 1(提交侧): create_task 只把 JWT user_id 当任务归属,targets 里的 account_id
未校验 ⇒ 可用他人账号凭证代发。
缺陷 2(取凭证侧): scheduler._load_credentials 的 SQL 只有 id+platform,无 user_id
⇒ 即使提交侧漏了,调度执行仍会拿受害者凭证发布。

夹具:
(a) 他人 account_id 提交被拒(结构化 4xx),自己的账号可正常创建;
(b) _load_credentials 以 id+platform+user_id 命中,他人账号取不到凭证;
(c) _run_single_platform 把任务 user_id 透传给 _load_credentials(不硬编码)。
"""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

import app.routers.publish as publish_router
from app.services.publish import scheduler as sched_module
from app.services.publish.base_adapter import PublishContent
from app.services.publish.scheduler import PublishScheduler


class _FakeAccountsConn:
    """publish_accounts 最小假库:只按 (id, user_id) 命中归属。"""

    def __init__(self, owned: dict[int, str]):
        self._owned = owned
        self.closed = False
        self.fetchrow_calls: list[tuple] = []

    async def execute(self, *args, **kwargs):
        return None

    async def fetchrow(self, sql, *args, **kwargs):
        self.fetchrow_calls.append((sql, args))
        if "FROM publish_accounts" not in sql:
            return None
        account_id, user_id = args[0], args[1]
        return {"id": account_id} if self._owned.get(account_id) == user_id else None

    async def close(self):
        self.closed = True


class _FakeCredentialsConn:
    """凭证查询替身:SQL 三参 (id, platform, user_id) 命中才返回行。"""

    def __init__(self, rows: dict[tuple, dict]):
        self._rows = rows
        self.closed = False
        self.fetchrow_calls: list[tuple] = []

    async def fetchrow(self, sql, *args):
        self.fetchrow_calls.append((sql, args))
        return self._rows.get((args[0], args[1], args[2]))

    async def close(self):
        self.closed = True


def _request(user_id: str = "user-a") -> SimpleNamespace:
    return SimpleNamespace(state=SimpleNamespace(user_id=user_id))


def _body(targets: list[dict]) -> publish_router.TaskCreate:
    return publish_router.TaskCreate(
        title="标题",
        format="md",
        text="正文",
        targets=[publish_router.PublishTarget(**t) for t in targets],
    )


def _patch_submit(monkeypatch) -> AsyncMock:
    submit = AsyncMock(return_value={"ok": True, "task_id": "x", "status": "running"})
    monkeypatch.setattr(
        publish_router, "publish_scheduler", SimpleNamespace(submit_task=submit)
    )
    return submit


async def test_create_task_rejects_foreign_account_id(monkeypatch) -> None:
    """(a) target 指向他人账号 → 403,且不会提交给调度器。"""
    conn = _FakeAccountsConn({111: "user-a", 999: "user-b"})
    monkeypatch.setattr(publish_router, "_get_conn", AsyncMock(return_value=conn))
    submit = _patch_submit(monkeypatch)

    with pytest.raises(HTTPException) as exc_info:
        await publish_router.create_task(
            _body([{"platform": "wordpress", "account_id": 999}]), _request("user-a")
        )

    assert exc_info.value.status_code == 403
    assert "999" in str(exc_info.value.detail)
    submit.assert_not_awaited()
    assert conn.closed is True, "归属校验后连接未归还"


async def test_create_task_rejects_mixed_targets_listing_only_foreign(monkeypatch) -> None:
    """(a') 混合 target(自己 + 他人)→ 拒绝,错误里只列他人 account_id。"""
    conn = _FakeAccountsConn({111: "user-a", 999: "user-b"})
    monkeypatch.setattr(publish_router, "_get_conn", AsyncMock(return_value=conn))
    submit = _patch_submit(monkeypatch)

    with pytest.raises(HTTPException) as exc_info:
        await publish_router.create_task(
            _body([
                {"platform": "wordpress", "account_id": 111},
                {"platform": "zhihu", "account_id": 999},
            ]),
            _request("user-a"),
        )

    assert exc_info.value.status_code == 403
    assert "999" in str(exc_info.value.detail)
    assert "111" not in str(exc_info.value.detail)
    submit.assert_not_awaited()


async def test_create_task_accepts_own_account(monkeypatch) -> None:
    """(c) 自己的账号仍能正常创建,任务归属仍是 JWT user_id。"""
    conn = _FakeAccountsConn({111: "user-a"})
    monkeypatch.setattr(publish_router, "_get_conn", AsyncMock(return_value=conn))
    submit = _patch_submit(monkeypatch)

    result = await publish_router.create_task(
        _body([{"platform": "wordpress", "account_id": 111}]), _request("user-a")
    )

    assert result["code"] == 0
    submit.assert_awaited_once()
    kwargs = submit.await_args.kwargs
    assert kwargs["user_id"] == "user-a"
    assert kwargs["targets"][0]["account_id"] == 111
    assert conn.closed is True


async def test_load_credentials_scopes_query_by_user_id(monkeypatch) -> None:
    """(b) 凭证查询按 id+platform+user_id 命中。"""
    conn = _FakeCredentialsConn({(111, "wordpress", "user-a"): {"credentials_enc": "enc"}})
    sched = PublishScheduler()
    sched._get_conn = AsyncMock(return_value=conn)
    monkeypatch.setattr(sched_module, "decrypt", lambda cipher: {"token": cipher})

    creds = await sched._load_credentials(111, "wordpress", "user-a")

    assert creds == {"token": "enc"}
    sql, args = conn.fetchrow_calls[0]
    assert "user_id" in sql
    assert args == (111, "wordpress", "user-a")
    assert conn.closed is True


async def test_load_credentials_returns_none_for_other_users_account(monkeypatch) -> None:
    """(b') 他人账号即便 id+platform 正确也取不到凭证(不泄露受害者凭证)。"""
    conn = _FakeCredentialsConn({(999, "wordpress", "user-b"): {"credentials_enc": "victim"}})
    sched = PublishScheduler()
    sched._get_conn = AsyncMock(return_value=conn)
    monkeypatch.setattr(sched_module, "decrypt", lambda cipher: {"token": cipher})

    assert await sched._load_credentials(999, "wordpress", "attacker") is None
    assert conn.closed is True


async def test_run_single_platform_passes_task_user_id(monkeypatch) -> None:
    """(c') 执行链把任务来源 user_id 透传给 _load_credentials,不硬编码。"""
    sched = PublishScheduler()
    sched._get_conn = AsyncMock(return_value=None)
    sched._load_credentials = AsyncMock(return_value=None)
    monkeypatch.setattr(sched_module, "get_adapter", lambda platform: MagicMock())

    await sched._run_single_platform(
        "task-1",
        "user-a",
        PublishContent(format="md", title="标题", text="正文"),
        {"platform": "wordpress", "account_id": 111},
    )

    sched._load_credentials.assert_awaited_once_with(111, "wordpress", "user-a")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
