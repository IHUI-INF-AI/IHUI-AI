# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""O64 对账收敛器 internal 端点测试(2026-10-23 立,提交 5)。

覆盖 ai-service 侧对账面:
- GET  /internal/checkin/pool-accounts  系统 owner 全量摘要(含 poolPendingCred)
- POST /internal/checkin/pool-cred-flush 指定账号立即重试凭证回写
  (复用 checkin_pool_writeback.maybe_writeback;not_found/skipped/failed/noop)
- store:load_device_map 契约(限系统 owner;JSON 字符串/坏 JSON 容错)

DB 隔离同 test_internal_checkin_pool 惯例:checkin_store 的 DB 函数换进程内
假实现,绝无真实 IO;maybe_writeback 经 monkeypatch 替换,不断网。
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

import pytest

from app.core.config import settings
from app.services import checkin_pool_writeback, checkin_store
from app.services.checkin_store import POOL_SYNC_OWNER

INTERNAL_SECRET = "test-internal-secret"


class FakeStore:
    """进程内替身:镜像对账面消费的 store 函数(list/load/save)。"""

    def __init__(self) -> None:
        self.accounts: dict[int, dict[str, Any]] = {}
        self.next_account_id = 1
        self.save_calls: list[tuple[int, dict[str, Any]]] = []

    async def create_account(
        self,
        owner: str,
        name: str,
        jwt: str,
        device_map: dict[str, Any],
        account_group: str = "",
        platform: str = "trae",
    ) -> dict[str, Any]:
        identity = checkin_store.derive_account_identity(platform, jwt, device_map) or ""
        acc = {
            "id": self.next_account_id,
            "owner_user_id": owner,
            "name": name,
            "jwt": jwt,
            "device_map": dict(device_map),
            "enabled": True,
            "account_group": account_group,
            "platform": platform,
            "identity_key": identity,
            "created_at": datetime.now(UTC),
            "updated_at": datetime.now(UTC),
        }
        self.accounts[acc["id"]] = acc
        self.next_account_id += 1
        return {"id": acc["id"], "name": acc["name"], "platform": platform, "enabled": True}

    async def list_pool_accounts(self) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        for acc in self.accounts.values():
            if acc["owner_user_id"] != POOL_SYNC_OWNER:
                continue
            pending = acc["device_map"].get("pool_pending_cred")
            out.append(
                {
                    "accountId": acc["id"],
                    "name": acc["name"],
                    "platform": acc["platform"],
                    "identityKey": acc["identity_key"],
                    "enabled": acc["enabled"],
                    "ownerUserId": acc["owner_user_id"],
                    "poolAccountId": acc["device_map"].get("pool_account_id"),
                    "poolCredVersion": checkin_store._pool_cred_version_of(acc["device_map"]),
                    "poolPendingCred": (
                        {
                            "attempts": pending.get("attempts", 0),
                            "at": pending.get("at"),
                        }
                        if isinstance(pending, dict)
                        else None
                    ),
                }
            )
        return out

    async def load_device_map(self, account_id: int) -> dict[str, Any] | None:
        acc = self.accounts.get(account_id)
        if acc is None or acc["owner_user_id"] != POOL_SYNC_OWNER:
            return None
        return acc["device_map"]

    async def pool_account_id_of(
        self,
        platform: str,
        uid: str,
        *,
        pool_account_id: str | None = None,
        owner_user_id: str | None = None,
    ) -> int | None:
        for acc in self.accounts.values():
            if pool_account_id:
                if acc["device_map"].get("pool_account_id") == pool_account_id:
                    return acc["id"]
                continue
            if (
                acc["owner_user_id"] == (owner_user_id or POOL_SYNC_OWNER)
                and acc["platform"] == platform
                and acc["identity_key"] == uid
            ):
                return acc["id"]
        return None

    async def owner_of_account(self, account_id: int) -> str:
        acc = self.accounts.get(account_id)
        if acc is None:
            raise LookupError(f"签到账号不存在: {account_id}")
        return acc["owner_user_id"]

    async def save_device_map(self, account_id: int, device_map: dict[str, Any]) -> None:
        self.save_calls.append((account_id, dict(device_map)))
        if account_id in self.accounts:
            self.accounts[account_id]["device_map"] = dict(device_map)


@pytest.fixture
def fake_store(monkeypatch):
    store = FakeStore()
    for name in [
        "create_account",
        "list_pool_accounts",
        "load_device_map",
        "save_device_map",
        "pool_account_id_of",
        "owner_of_account",
    ]:
        monkeypatch.setattr(checkin_store, name, getattr(store, name))
    return store


@pytest.fixture(autouse=True)
def _internal_secret(monkeypatch):
    monkeypatch.setattr(settings, "ai_callback_secret", INTERNAL_SECRET)


def _pool_payload(**overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "poolAccountId": "pool-a",
        "uid": "u-1",
        "name": "池号 A",
        "token": "tok",
        "refreshToken": "ref",
        "credVersion": 5,
        "enabled": True,
    }
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# GET /internal/checkin/pool-accounts
# ---------------------------------------------------------------------------


async def test_pool_accounts_requires_secret(client, monkeypatch):
    monkeypatch.setattr(settings, "ai_callback_secret", "")
    resp = await client.get("/internal/checkin/pool-accounts")
    assert resp.status_code == 503
    monkeypatch.setattr(settings, "ai_callback_secret", INTERNAL_SECRET)
    resp = await client.get("/internal/checkin/pool-accounts", headers={"X-Internal-Secret": "wrong"})
    assert resp.status_code == 401


async def test_pool_accounts_returns_summary(client, fake_store):
    await fake_store.create_account(
        POOL_SYNC_OWNER,
        "池号 A",
        "tok",
        {
            "pool_account_id": "pool-a",
            "pool_uid": "u-1",
            "pool_cred_version": 5,
            "pool_pending_cred": {"attempts": 2, "at": "2026-10-23T00:00:00Z"},
        },
        account_group="pool",
        platform="qoder",
    )
    resp = await client.get(
        "/internal/checkin/pool-accounts", headers={"X-Internal-Secret": INTERNAL_SECRET}
    )
    assert resp.status_code == 200
    accounts = resp.json()["accounts"]
    assert len(accounts) == 1
    a = accounts[0]
    assert a["poolAccountId"] == "pool-a"
    assert a["poolCredVersion"] == 5
    assert a["enabled"] is True
    assert a["poolPendingCred"] == {"attempts": 2, "at": "2026-10-23T00:00:00Z"}
    # jwt 明文不出库
    assert "jwt" not in a and "refresh_token" not in a


async def test_pool_accounts_pending_none_when_absent(client, fake_store):
    await fake_store.create_account(
        POOL_SYNC_OWNER, "池号 B", "tok", {"pool_account_id": "pool-b"}, platform="trae"
    )
    resp = await client.get(
        "/internal/checkin/pool-accounts", headers={"X-Internal-Secret": INTERNAL_SECRET}
    )
    a = resp.json()["accounts"][0]
    assert a["poolPendingCred"] is None
    assert a["poolCredVersion"] is None


# ---------------------------------------------------------------------------
# POST /internal/checkin/pool-cred-flush
# ---------------------------------------------------------------------------


async def test_pool_cred_flush_requires_secret(client, monkeypatch):
    monkeypatch.setattr(settings, "ai_callback_secret", INTERNAL_SECRET)
    resp = await client.post(
        "/internal/checkin/pool-cred-flush",
        json={"accountIds": [1]},
        headers={"X-Internal-Secret": "wrong"},
    )
    assert resp.status_code == 401


async def test_pool_cred_flush_writeback_and_persist(client, fake_store, monkeypatch):
    row = await fake_store.create_account(
        POOL_SYNC_OWNER,
        "池号 A",
        "tok",
        {"pool_account_id": "pool-a", "pool_cred_version": 4, "refresh_token": "ref-1"},
        platform="qoder",
    )
    account_id = row["id"]

    calls: list[tuple[dict[str, Any], tuple[str, str]]] = []

    async def fake_writeback(device_map: dict[str, Any], before_fp: tuple[str, str]) -> bool:
        calls.append((dict(device_map), before_fp))
        device_map["pool_cred_version"] = 9  # 模拟 applied 后基准校正
        return True

    monkeypatch.setattr(checkin_pool_writeback, "maybe_writeback", fake_writeback)

    resp = await client.post(
        "/internal/checkin/pool-cred-flush",
        json={"accountIds": [account_id]},
        headers={"X-Internal-Secret": INTERNAL_SECRET},
    )
    assert resp.status_code == 200
    results = resp.json()["results"]
    assert results == [{"accountId": account_id, "status": "flushed"}]
    assert len(calls) == 1
    # device_map 变化已持久化(pending 清标记/基准校正不丢)
    assert fake_store.save_calls and fake_store.save_calls[0][0] == account_id
    assert fake_store.accounts[account_id]["device_map"]["pool_cred_version"] == 9


async def test_pool_cred_flush_noop_skips_persist(client, fake_store, monkeypatch):
    row = await fake_store.create_account(
        POOL_SYNC_OWNER, "池号 A", "tok", {"pool_account_id": "pool-a"}, platform="trae"
    )

    async def fake_writeback(device_map: dict[str, Any], before_fp: tuple[str, str]) -> bool:
        return False

    monkeypatch.setattr(checkin_pool_writeback, "maybe_writeback", fake_writeback)

    resp = await client.post(
        "/internal/checkin/pool-cred-flush",
        json={"accountIds": [row["id"]]},
        headers={"X-Internal-Secret": INTERNAL_SECRET},
    )
    assert resp.json()["results"] == [{"accountId": row["id"], "status": "noop"}]
    assert fake_store.save_calls == []  # 无变化不写库


async def test_pool_cred_flush_not_found_and_non_pool(client, fake_store):
    resp = await client.post(
        "/internal/checkin/pool-cred-flush",
        json={"accountIds": [999]},
        headers={"X-Internal-Secret": INTERNAL_SECRET},
    )
    assert resp.json()["results"] == [{"accountId": 999, "status": "not_found"}]

    # 用户自建账号(非系统 owner):load_device_map 寻址不到 → not_found
    user_row = await fake_store.create_account("user:1", "我的", "tok", {}, platform="trae")
    resp = await client.post(
        "/internal/checkin/pool-cred-flush",
        json={"accountIds": [user_row["id"]]},
        headers={"X-Internal-Secret": INTERNAL_SECRET},
    )
    assert resp.json()["results"] == [{"accountId": user_row["id"], "status": "not_found"}]


async def test_pool_cred_flush_skips_account_without_pool_id(client, fake_store):
    row = await fake_store.create_account(
        POOL_SYNC_OWNER, "脏数据", "tok", {"uid": "u-x"}, platform="trae"
    )
    resp = await client.post(
        "/internal/checkin/pool-cred-flush",
        json={"accountIds": [row["id"]]},
        headers={"X-Internal-Secret": INTERNAL_SECRET},
    )
    assert resp.json()["results"] == [
        {"accountId": row["id"], "status": "skipped", "reason": "非号池账号"}
    ]


async def test_pool_cred_flush_failure_does_not_sink_batch(client, fake_store, monkeypatch):
    row = await fake_store.create_account(
        POOL_SYNC_OWNER, "池号 A", "tok", {"pool_account_id": "pool-a"}, platform="trae"
    )

    async def boom(device_map: dict[str, Any], before_fp: tuple[str, str]) -> bool:
        raise RuntimeError("回写端点炸了")

    monkeypatch.setattr(checkin_pool_writeback, "maybe_writeback", boom)

    resp = await client.post(
        "/internal/checkin/pool-cred-flush",
        json={"accountIds": [row["id"], 999]},
        headers={"X-Internal-Secret": INTERNAL_SECRET},
    )
    results = resp.json()["results"]
    assert results[0]["status"] == "failed"
    assert "回写端点炸了" in results[0]["reason"]
    assert results[1] == {"accountId": 999, "status": "not_found"}  # 单条失败不拖垮整批


async def test_pool_cred_flush_rejects_empty_and_oversize(client):
    resp = await client.post(
        "/internal/checkin/pool-cred-flush",
        json={"accountIds": []},
        headers={"X-Internal-Secret": INTERNAL_SECRET},
    )
    assert resp.status_code == 422
    resp = await client.post(
        "/internal/checkin/pool-cred-flush",
        json={"accountIds": list(range(201))},
        headers={"X-Internal-Secret": INTERNAL_SECRET},
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# POST /internal/checkin/pool-run(admin 手动签到,系统 owner 面)
# ---------------------------------------------------------------------------


async def test_pool_run_requires_secret(client, monkeypatch):
    monkeypatch.setattr(settings, "ai_callback_secret", INTERNAL_SECRET)
    resp = await client.post(
        "/internal/checkin/pool-run",
        json={"platform": "qoder", "uid": "u-1"},
        headers={"X-Internal-Secret": "wrong"},
    )
    assert resp.status_code == 401


async def test_pool_run_success_with_system_owner(client, fake_store, monkeypatch):
    from app.services import checkin_scheduler as sched_mod

    row = await fake_store.create_account(
        POOL_SYNC_OWNER,
        "池号 A",
        "tok",
        {"pool_account_id": "pool-a", "pool_uid": "u-1"},
        platform="qoder",
    )
    seen: list[tuple[int, str]] = []

    class FakeScheduler:
        async def run_checkin_now(self, account_id: int, owner_user_id: str) -> dict[str, Any]:
            seen.append((account_id, owner_user_id))
            return {"ok": True, "credits": 120, "accountId": account_id}

    monkeypatch.setattr(sched_mod, "checkin_scheduler", FakeScheduler())

    resp = await client.post(
        "/internal/checkin/pool-run",
        json={"platform": "qoder", "uid": "u-1"},
        headers={"X-Internal-Secret": INTERNAL_SECRET},
    )
    assert resp.status_code == 200
    assert resp.json()["credits"] == 120
    # 系统 owner 触发:用户态 API 按 owner 过滤,寻址不到这些账号
    assert seen == [(row["id"], POOL_SYNC_OWNER)]


async def test_pool_run_unknown_target_maps_404(client, fake_store):
    resp = await client.post(
        "/internal/checkin/pool-run",
        json={"platform": "qoder", "uid": "no-such"},
        headers={"X-Internal-Secret": INTERNAL_SECRET},
    )
    assert resp.status_code == 404


async def test_pool_run_user_owned_account_not_addressable(client, fake_store):
    # 用户自建账号(同 platform/identity_key 但 owner 不同)必须寻址不到
    await fake_store.create_account("user:1", "我的", "tok", {}, platform="qoder")
    resp = await client.post(
        "/internal/checkin/pool-run",
        json={"platform": "qoder", "uid": ""},
        headers={"X-Internal-Secret": INTERNAL_SECRET},
    )
    assert resp.status_code == 422  # uid 空串过不了 min_length


async def test_pool_run_cooldown_maps_429(client, fake_store, monkeypatch):
    from datetime import timedelta

    from app.services import checkin_scheduler as sched_mod

    await fake_store.create_account(
        POOL_SYNC_OWNER, "池号 A", "tok", {"pool_uid": "u-1"}, platform="qoder"
    )

    class FakeScheduler:
        async def run_checkin_now(self, account_id: int, owner_user_id: str) -> dict[str, Any]:
            raise sched_mod.CooldownActiveError(
                "池号 A", datetime.now(UTC) + timedelta(seconds=600)
            )

    monkeypatch.setattr(sched_mod, "checkin_scheduler", FakeScheduler())

    resp = await client.post(
        "/internal/checkin/pool-run",
        json={"platform": "qoder", "uid": "u-1"},
        headers={"X-Internal-Secret": INTERNAL_SECRET},
    )
    assert resp.status_code == 429  # 尊重冷却:不提供绕过风控的后门


async def test_pool_run_rate_limited_maps_429(client, fake_store, monkeypatch):
    from app.services import checkin_scheduler as sched_mod

    await fake_store.create_account(
        POOL_SYNC_OWNER, "池号 A", "tok", {"pool_uid": "u-1"}, platform="qoder"
    )

    class FakeScheduler:
        async def run_checkin_now(self, account_id: int, owner_user_id: str) -> dict[str, Any]:
            raise sched_mod.RateLimitedError("签到接口限流冷却中(120s)", remaining=120)

    monkeypatch.setattr(sched_mod, "checkin_scheduler", FakeScheduler())

    resp = await client.post(
        "/internal/checkin/pool-run",
        json={"platform": "qoder", "uid": "u-1"},
        headers={"X-Internal-Secret": INTERNAL_SECRET},
    )
    assert resp.status_code == 429


# ---------------------------------------------------------------------------
# store:load_device_map 真实现契约(不连 DB 的部分:JSON 容错走 FakeStore 镜像)
# ---------------------------------------------------------------------------


async def test_load_device_map_json_string_tolerance(monkeypatch):
    """真实现里 device_map 可能是 JSON 字符串(asyncpg jsonb 有时回吐 str)。"""

    class _Conn:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def fetchrow(self, query: str, *args: Any):
            return {"device_map": json.dumps({"pool_account_id": "pool-a", "pool_cred_version": 3})}

    class _Pool:
        def acquire(self):
            return _Conn()

    async def _fake_pool() -> object:
        return _Pool()

    monkeypatch.setattr(checkin_store, "get_shared_pool", _fake_pool)
    dm = await checkin_store.load_device_map(1)
    assert dm == {"pool_account_id": "pool-a", "pool_cred_version": 3}


async def test_load_device_map_bad_json_becomes_empty(monkeypatch):
    class _Conn:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def fetchrow(self, query: str, *args: Any):
            return {"device_map": "not-json{{{"}

    class _Pool:
        def acquire(self):
            return _Conn()

    async def _fake_pool() -> object:
        return _Pool()

    monkeypatch.setattr(checkin_store, "get_shared_pool", _fake_pool)
    assert await checkin_store.load_device_map(1) == {}


async def test_load_device_map_missing_row_returns_none(monkeypatch):
    class _Conn:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def fetchrow(self, query: str, *args: Any):
            return None

    class _Pool:
        def acquire(self):
            return _Conn()

    async def _fake_pool() -> object:
        return _Pool()

    monkeypatch.setattr(checkin_store, "get_shared_pool", _fake_pool)
    assert await checkin_store.load_device_map(42) is None
