# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""PATCH /accounts/{id}/device_map 端点测试(2026-10-10 立)。

覆盖:合法 device_map 整体替换落库(记录 save_device_map 调用参数)、
账号不存在 404、序列化超 16KB 拒收 422、属主隔离(他人账号 → 404)。

DB 隔离:沿用 conftest 的 client fixture(app.main 惰性导入),
checkin_store 仅替换本端点触及的 get_decrypted_jwt / save_device_map
为进程内假实现,不连真实 PG,绝无网络 IO。
独立 FakeDeviceMapStore:不 import test_checkin_api 的 FakeStore
(避免与他席在途编辑冲突),其 get_decrypted_jwt 不回吐 platform,
而本端点响应含 platform,故自备含 platform 的最小假实现。
"""

from __future__ import annotations

from typing import Any

import pytest

from app.core.jwt_auth import require_request_user_id
from app.services import checkin_store

_DEFAULT_OWNER = "dev-anonymous"


class FakeDeviceMapStore:
    """仅覆盖 device_map 端点触及的两个 store 函数(签名与真实现一致)。"""

    def __init__(self) -> None:
        self.accounts: dict[int, dict[str, Any]] = {}
        self.saved: list[tuple[int, dict[str, Any]]] = []

    async def get_decrypted_jwt(self, account_id: int, owner_user_id: str) -> dict[str, Any] | None:
        acc = self.accounts.get(account_id)
        if acc is None or acc["owner_user_id"] != owner_user_id:
            return None
        return {
            "id": acc["id"],
            "name": acc["name"],
            "jwt": acc.get("jwt", ""),
            "device_map": dict(acc.get("device_map") or {}),
            "platform": acc.get("platform", "trae"),
            "enabled": acc.get("enabled", True),
        }

    async def save_device_map(self, account_id: int, device_map: dict[str, Any]) -> None:
        self.saved.append((account_id, dict(device_map)))
        if account_id in self.accounts:
            self.accounts[account_id]["device_map"] = dict(device_map)


@pytest.fixture
def device_map_store(monkeypatch):
    store = FakeDeviceMapStore()
    monkeypatch.setattr(checkin_store, "get_decrypted_jwt", store.get_decrypted_jwt)
    monkeypatch.setattr(checkin_store, "save_device_map", store.save_device_map)
    return store


def _seed_account(store: FakeDeviceMapStore, aid: int, *, owner: str = _DEFAULT_OWNER,
                  platform: str = "qoder") -> None:
    store.accounts[aid] = {
        "id": aid,
        "owner_user_id": owner,
        "name": f"账号{aid}",
        "jwt": "x.y.z",
        "device_map": {},
        "platform": platform,
        "enabled": True,
    }


async def test_update_device_map_success(client, device_map_store):
    """合法 device_map → 200,响应含 ok/keys/platform,且 save_device_map 按参落库。"""
    _seed_account(device_map_store, 1, platform="qoder")

    device_map = {
        "refresh_token": "rt-abc",
        "headers": {"Cosy-Device": "d-1", "Cosy-Udid": "u-1"},
    }
    resp = await client.patch("/api/checkin/accounts/1/device_map", json={"device_map": device_map})
    assert resp.status_code == 200
    body = resp.json()
    assert body == {"ok": True, "device_map_keys": 2, "platform": "qoder"}

    # 落库被调用且参数完整
    assert device_map_store.saved == [(1, device_map)]
    assert device_map_store.accounts[1]["device_map"] == device_map


async def test_update_device_map_not_found(client, device_map_store):
    resp = await client.patch(
        "/api/checkin/accounts/9999/device_map", json={"device_map": {"k": "v"}}
    )
    assert resp.status_code == 404
    assert "账号不存在" in resp.json()["detail"]
    assert device_map_store.saved == []


async def test_update_device_map_oversize_422(client, device_map_store):
    """序列化后超 16384 → 422,detail 含上限与实际长度,不落库。"""
    _seed_account(device_map_store, 1)

    big = {"blob": "x" * 17000}
    resp = await client.patch("/api/checkin/accounts/1/device_map", json={"device_map": big})
    assert resp.status_code == 422
    detail = resp.json()["detail"]
    assert "16384" in detail
    assert device_map_store.saved == []


async def test_update_device_map_owner_isolation(client, device_map_store):
    """属主隔离:换身份 PATCH 别人的账号 → 404,不落库。"""
    from app.main import fastapi_app  # client fixture 已触发惰性导入,此处仅取引用

    _seed_account(device_map_store, 1, owner="user-mine")

    fastapi_app.dependency_overrides[require_request_user_id] = lambda: "user-other"
    try:
        resp = await client.patch(
            "/api/checkin/accounts/1/device_map",
            json={"device_map": {"refresh_token": "evil"}},
        )
        assert resp.status_code == 404
        assert "账号不存在" in resp.json()["detail"]
    finally:
        fastapi_app.dependency_overrides.pop(require_request_user_id, None)
    assert device_map_store.saved == []
    assert device_map_store.accounts[1]["device_map"] == {}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
