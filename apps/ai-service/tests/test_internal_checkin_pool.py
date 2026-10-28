# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""O64 号池↔签到同步 internal 端点测试(2026-10-23 立)。

覆盖:内网密钥三态(未配置 503 / 错 401 / 对放行)、pool-sync 建号契约
(device_map 键位 / 系统 owner / account_group=pool)、白名单外平台如实
skipped、disabled 载荷置位、单条失败不拖垮整批、pool_cred_version
幂等(同版本跳过)与前进(新版本更新凭证)、pool-state 三态联动、pool-status
点查、pool_uid 身份权威与版本解析容错。

DB 隔离同 test_checkin_api 惯例:checkin_store 的 DB 函数换进程内假实现,
FakeStore.create_account 镜像真实现的版本防降级语义(设计 §3 D1),绝无真实 IO。
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import pytest

from app.core.config import settings
from app.services import checkin_store
from app.services.checkin_store import POOL_SYNC_OWNER

INTERNAL_SECRET = "test-internal-secret"


def _account_payload(**overrides: Any) -> dict[str, Any]:
    """号池侧单账号投影基线(api 映射 platform 后送达的形状)。"""
    base: dict[str, Any] = {
        "poolAccountId": "11111111-1111-1111-1111-111111111111",
        "uid": "u-9001",
        "name": "Qoder 池号 #1",
        "token": "tok-abc",
        "refreshToken": "ref-xyz",
        "credVersion": 3,
        "enabled": True,
        "proxyUrl": "http://user:pass@10.0.0.1:8080",
        "deviceId": "dev-1",
        "machineId": "mac-1",
        "cosy": {"machine_token": "mt", "machine_code": "mc"},
        "expiresAt": "2026-11-01T00:00:00+00:00",
    }
    base.update(overrides)
    return base


class FakeStore:
    """进程内替身:镜像 internal router 消费的 5 个 store 函数。

    create_account 复刻真实现两档语义:identity 合并 + pool_cred_version 防降级。
    """

    def __init__(self) -> None:
        self.accounts: dict[int, dict[str, Any]] = {}
        self.next_account_id = 1

    def _row(self, acc: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": acc["id"],
            "name": acc["name"],
            "group": acc.get("account_group", ""),
            "platform": acc.get("platform", "trae"),
            "device_map": acc["device_map"],
            "enabled": acc["enabled"],
            "created_at": acc["created_at"].isoformat(),
            "updated_at": acc["updated_at"].isoformat(),
        }

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
        incoming_ver = checkin_store._pool_cred_version_of(device_map)
        if identity:
            for acc in self.accounts.values():
                if (
                    acc["owner_user_id"] == owner
                    and acc["platform"] == platform
                    and acc["identity_key"] == identity
                ):
                    existing_ver = checkin_store._pool_cred_version_of(acc["device_map"])
                    if (
                        incoming_ver is not None
                        and existing_ver is not None
                        and incoming_ver <= existing_ver
                    ):
                        return self._row(acc)  # 幂等:版本不前进,凭证不更新
                    acc["jwt"] = jwt
                    acc["device_map"] = dict(device_map)
                    acc["name"] = name or acc["name"]
                    acc["updated_at"] = datetime.now(UTC)
                    return self._row(acc)
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
        return self._row(acc)

    async def set_enabled(self, account_id: int, owner: str, enabled: bool) -> bool:
        acc = self.accounts.get(account_id)
        if acc is None or acc["owner_user_id"] != owner:
            return False
        acc["enabled"] = enabled
        return True

    async def list_pool_accounts(self) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        for acc in self.accounts.values():
            if acc["owner_user_id"] != POOL_SYNC_OWNER:
                continue
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
                }
            )
        return out

    async def apply_pool_state(
        self,
        platform: str,
        uid: str,
        state: str,
        *,
        pool_account_id: str | None = None,
        owner_user_id: str | None = None,
    ) -> dict[str, Any]:
        for acc in self.accounts.values():
            if pool_account_id:
                matched = acc["device_map"].get("pool_account_id") == pool_account_id
            else:
                matched = (
                    acc["owner_user_id"] == (owner_user_id or POOL_SYNC_OWNER)
                    and acc["platform"] == platform
                    and acc["identity_key"] == uid
                )
            if matched:
                if state == "pool_deleted":
                    acc["enabled"] = False
                    acc["device_map"]["pool_deleted_at"] = datetime.now(UTC).isoformat()
                else:
                    acc["enabled"] = state == "enabled"
                return {"found": True, "accountId": acc["id"]}
        return {"found": False, "accountId": None}

    async def pool_status(
        self,
        platform: str,
        uid: str,
        *,
        pool_account_id: str | None = None,
        owner_user_id: str | None = None,
    ) -> dict[str, Any]:
        for acc in self.accounts.values():
            if pool_account_id:
                matched = acc["device_map"].get("pool_account_id") == pool_account_id
            else:
                matched = (
                    acc["owner_user_id"] == (owner_user_id or POOL_SYNC_OWNER)
                    and acc["platform"] == platform
                    and acc["identity_key"] == uid
                )
            if matched:
                return {
                    "found": True,
                    "accountId": acc["id"],
                    "name": acc["name"],
                    "enabled": acc["enabled"],
                    "poolAccountId": acc["device_map"].get("pool_account_id"),
                    "poolCredVersion": checkin_store._pool_cred_version_of(acc["device_map"]),
                    "poolSyncedAt": acc["device_map"].get("pool_synced_at"),
                    "poolDeletedAt": acc["device_map"].get("pool_deleted_at"),
                    "pendingCred": "pool_pending_cred" in acc["device_map"],
                    "cooldownUntil": None,
                    "lastRecord": None,
                }
        return {"found": False}


@pytest.fixture
def fake_store(monkeypatch):
    store = FakeStore()
    for name in [
        "create_account",
        "set_enabled",
        "list_pool_accounts",
        "apply_pool_state",
        "pool_status",
    ]:
        monkeypatch.setattr(checkin_store, name, getattr(store, name))
    return store


@pytest.fixture(autouse=True)
def _internal_secret(monkeypatch):
    monkeypatch.setattr(settings, "ai_callback_secret", INTERNAL_SECRET)


# ---------------------------------------------------------------------------
# 鉴权三态
# ---------------------------------------------------------------------------


async def test_pool_sync_requires_internal_secret(client, monkeypatch):
    monkeypatch.setattr(settings, "ai_callback_secret", "")
    resp = await client.post(
        "/internal/checkin/pool-sync",
        json={"platform": "qoder", "accounts": [_account_payload()]},
    )
    assert resp.status_code == 503  # 未配置不裸奔

    monkeypatch.setattr(settings, "ai_callback_secret", INTERNAL_SECRET)
    resp = await client.post(
        "/internal/checkin/pool-sync",
        json={"platform": "qoder", "accounts": [_account_payload()]},
        headers={"X-Internal-Secret": "wrong"},
    )
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# pool-sync 建号契约
# ---------------------------------------------------------------------------


async def test_pool_sync_creates_account_with_contract(client, fake_store):
    resp = await client.post(
        "/internal/checkin/pool-sync",
        json={"platform": "qoder", "accounts": [_account_payload()]},
        headers={"X-Internal-Secret": INTERNAL_SECRET},
    )
    assert resp.status_code == 200
    results = resp.json()["results"]
    assert len(results) == 1
    assert results[0]["status"] == "synced"
    assert results[0]["reason"] is None

    acc = fake_store.accounts[1]
    assert acc["owner_user_id"] == POOL_SYNC_OWNER  # 系统 owner 隔离
    assert acc["platform"] == "qoder"
    assert acc["account_group"] == "pool"
    dm = acc["device_map"]
    assert dm["pool_account_id"] == "11111111-1111-1111-1111-111111111111"
    assert dm["pool_uid"] == "u-9001"  # 身份权威
    assert dm["pool_cred_version"] == 3
    assert dm["pool_synced_at"]
    assert dm["pool_enabled"] is True
    assert dm["uid"] == "u-9001"  # qoder 引擎消费键
    assert dm["refresh_token"] == "ref-xyz"
    assert dm["expires_at"] == "2026-11-01T00:00:00+00:00"
    assert dm["proxy"] == "http://user:pass@10.0.0.1:8080"  # 同账号同出口
    assert dm["cosy"] == {"machine_token": "mt", "machine_code": "mc"}
    assert dm["pool_device_id"] == "dev-1"
    assert dm["pool_machine_id"] == "mac-1"
    assert dm["pool_name"] == "Qoder 池号 #1"


async def test_pool_sync_carries_device_proof_keys_into_device_map(client, fake_store):
    """Trae 设备证明密钥对必须过桥(2026-10-26 补链)。

    桌面渠道签发的票只能由签发它的设备身份续;密钥不落到 device_map,
    反向回灌个人池时就永远缺 secrets ⇒ 生产池里的 Trae 号刷不动(10101)。
    """
    resp = await client.post(
        "/internal/checkin/pool-sync",
        json={
            "platform": "trae",
            "accounts": [_account_payload(deviceKeyPem="PEM-PRIV", devicePubPem="PEM-PUB")],
        },
        headers={"X-Internal-Secret": INTERNAL_SECRET},
    )
    assert resp.status_code == 200
    dm = next(iter(fake_store.accounts.values()))["device_map"]
    assert dm["pool_device_id"] == "dev-1"
    assert dm["pool_device_key_pem"] == "PEM-PRIV"
    assert dm["pool_device_pub_pem"] == "PEM-PUB"


async def test_pool_sync_without_device_keys_writes_no_keys(client, fake_store):
    """不带密钥时不得凭空造键(旧账号行为不变,导入侧按"无材料"退回旧通道)。"""
    resp = await client.post(
        "/internal/checkin/pool-sync",
        json={"platform": "trae", "accounts": [_account_payload()]},
        headers={"X-Internal-Secret": INTERNAL_SECRET},
    )
    assert resp.status_code == 200
    dm = next(iter(fake_store.accounts.values()))["device_map"]
    assert "pool_device_key_pem" not in dm
    assert "pool_device_pub_pem" not in dm


async def test_pool_sync_skips_unsupported_platform(client, fake_store):
    """codearts 等无签到引擎:逐条 skipped,不假装同步成功。"""
    resp = await client.post(
        "/internal/checkin/pool-sync",
        json={"platform": "codearts", "accounts": [_account_payload()]},
        headers={"X-Internal-Secret": INTERNAL_SECRET},
    )
    assert resp.status_code == 200
    results = resp.json()["results"]
    assert results[0]["status"] == "skipped"
    assert "无签到引擎" in results[0]["reason"]
    assert fake_store.accounts == {}


async def test_pool_sync_disabled_payload_sets_enabled_false(client, fake_store):
    resp = await client.post(
        "/internal/checkin/pool-sync",
        json={
            "platform": "qoder",
            "accounts": [_account_payload(enabled=False)],
        },
        headers={"X-Internal-Secret": INTERNAL_SECRET},
    )
    assert resp.status_code == 200
    assert fake_store.accounts[1]["enabled"] is False


async def test_pool_sync_single_failure_does_not_block_batch(client, fake_store, monkeypatch):
    """第二条建号抛错 → failed,第一条照常 synced。"""
    real_create = fake_store.create_account

    async def flaky(owner, name, jwt, device_map, account_group="", platform="trae"):
        if device_map.get("pool_account_id") == "22222222-2222-2222-2222-222222222222":
            raise RuntimeError("boom")
        return await real_create(owner, name, jwt, device_map, account_group, platform)

    monkeypatch.setattr(checkin_store, "create_account", flaky)
    resp = await client.post(
        "/internal/checkin/pool-sync",
        json={
            "platform": "qoder",
            "accounts": [
                _account_payload(),
                _account_payload(
                    poolAccountId="22222222-2222-2222-2222-222222222222", uid="u-9002"
                ),
            ],
        },
        headers={"X-Internal-Secret": INTERNAL_SECRET},
    )
    assert resp.status_code == 200
    results = resp.json()["results"]
    assert results[0]["status"] == "synced"
    assert results[1]["status"] == "failed"
    assert "boom" in results[1]["reason"]


async def test_pool_sync_idempotent_same_version_no_update(client, fake_store):
    """同版本重推:凭证不更新(幂等;旧永不覆盖新)。"""
    headers = {"X-Internal-Secret": INTERNAL_SECRET}
    body = {"platform": "qoder", "accounts": [_account_payload()]}
    await client.post("/internal/checkin/pool-sync", json=body, headers=headers)
    first_dm = dict(fake_store.accounts[1]["device_map"])

    resp = await client.post(
        "/internal/checkin/pool-sync",
        json={
            "platform": "qoder",
            "accounts": [_account_payload(token="tok-NEW", refreshToken="ref-NEW")],
        },
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["results"][0]["status"] == "synced"
    # 凭证未被旧版本载荷改写
    assert fake_store.accounts[1]["device_map"]["refresh_token"] == first_dm["refresh_token"]
    assert fake_store.accounts[1]["jwt"] == "tok-abc"


async def test_pool_sync_newer_version_updates_credentials(client, fake_store):
    """版本前进:凭证更新为新载荷。"""
    headers = {"X-Internal-Secret": INTERNAL_SECRET}
    await client.post(
        "/internal/checkin/pool-sync",
        json={"platform": "qoder", "accounts": [_account_payload()]},
        headers=headers,
    )
    resp = await client.post(
        "/internal/checkin/pool-sync",
        json={
            "platform": "qoder",
            "accounts": [_account_payload(token="tok-NEW", refreshToken="ref-NEW", credVersion=4)],
        },
        headers=headers,
    )
    assert resp.status_code == 200
    assert fake_store.accounts[1]["jwt"] == "tok-NEW"
    assert fake_store.accounts[1]["device_map"]["pool_cred_version"] == 4


# ---------------------------------------------------------------------------
# pool-state 三态联动
# ---------------------------------------------------------------------------


async def test_pool_state_three_states(client, fake_store):
    headers = {"X-Internal-Secret": INTERNAL_SECRET}
    await client.post(
        "/internal/checkin/pool-sync",
        json={"platform": "qoder", "accounts": [_account_payload()]},
        headers=headers,
    )
    for state, expect in (("disabled", False), ("enabled", True), ("pool_deleted", False)):
        resp = await client.post(
            "/internal/checkin/pool-state",
            json={"platform": "qoder", "items": [{"uid": "u-9001", "state": state}]},
            headers=headers,
        )
        assert resp.status_code == 200
        item = resp.json()["results"][0]
        assert item["found"] is True
        assert item["accountId"] == 1
        assert fake_store.accounts[1]["enabled"] is expect
    # pool_deleted 留痕(保历史)
    assert "pool_deleted_at" in fake_store.accounts[1]["device_map"]


async def test_pool_state_not_found(client, fake_store):
    resp = await client.post(
        "/internal/checkin/pool-state",
        json={"platform": "qoder", "items": [{"uid": "nope", "state": "disabled"}]},
        headers={"X-Internal-Secret": INTERNAL_SECRET},
    )
    assert resp.status_code == 200
    assert resp.json()["results"][0]["found"] is False


# ---------------------------------------------------------------------------
# pool-status 点查
# ---------------------------------------------------------------------------


async def test_pool_status_found_and_not_found(client, fake_store):
    headers = {"X-Internal-Secret": INTERNAL_SECRET}
    resp = await client.get(
        "/internal/checkin/pool-status",
        params={"platform": "qoder", "uid": "u-9001"},
        headers=headers,
    )
    assert resp.json()["found"] is False

    await client.post(
        "/internal/checkin/pool-sync",
        json={"platform": "qoder", "accounts": [_account_payload()]},
        headers=headers,
    )
    resp = await client.get(
        "/internal/checkin/pool-status",
        params={"platform": "qoder", "uid": "u-9001"},
        headers=headers,
    )
    body = resp.json()
    assert body["found"] is True
    assert body["accountId"] == 1
    assert body["poolCredVersion"] == 3
    assert body["pendingCred"] is False


# ---------------------------------------------------------------------------
# 纯函数:pool_uid 身份权威 + 版本解析容错
# ---------------------------------------------------------------------------


def test_derive_identity_prefers_pool_uid():
    """pool_uid 第一优先:即使 JWT 可解析出别的 id,也以号池 uid 为准。"""
    jwt = "eyJhbGciOiJIUzI1NiJ9.eyJkYXRhIjp7ImlkIjoianNvbi11aWQifX0.sig"
    identity = checkin_store.derive_account_identity(
        "trae", jwt, {"pool_uid": "pool-uid-42"}
    )
    assert identity == "pool-uid-42"
    # 无 pool_uid 时退回原平台解析(存量行为零变化)
    assert checkin_store.derive_account_identity("trae", jwt, {}) == "json-uid"


@pytest.mark.parametrize(
    "raw,expected",
    [
        ({"pool_cred_version": 5}, 5),
        ('{"pool_cred_version": 7}', 7),  # asyncpg jsonb 可能回传 str
        ({}, None),
        ({"pool_cred_version": None}, None),
        ({"pool_cred_version": True}, None),  # bool 不是 int 版本
        ({"pool_cred_version": "3"}, None),  # 字符串版本不收
        ("not-json", None),
        (None, None),
    ],
)
def test_pool_cred_version_of_tolerates_bad_values(raw: Any, expected: int | None):
    assert checkin_store._pool_cred_version_of(raw) == expected
