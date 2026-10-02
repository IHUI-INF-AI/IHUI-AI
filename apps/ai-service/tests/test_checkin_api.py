# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""签到助手服务端化测试(Phase1b,2026-10-03 立)。

覆盖:录入 → 列表脱敏(jwt 字段绝不出现)→ 过期 jwt 拒收 →
手动签到(mock checkin_engine,不打外网)→ 记录/积分流水回显 → 删除,
外加调度器冷却累积语义(Server 连击 3 次触发冷却 + 成功清零)。

DB 隔离:仓库无 PG testcontainer fixture,按 conftest 既有惯例
(monkeypatch 仓储层)把 checkin_store 的全部 DB 函数换成进程内假实现;
checkin_engine.checkin_account 用假实现替换,绝无真实网络 IO。
"""

from __future__ import annotations

import base64
import json
import time
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest

from app.services import checkin_scheduler as checkin_scheduler_mod
from app.services import checkin_store

# ---------------------------------------------------------------------------
# 工具:构造可解析的假 JWT(不校验签名,引擎只 base64 解 payload)
# ---------------------------------------------------------------------------


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def make_jwt(user_id: str = "u-1001", exp_offset_seconds: float = 86400) -> str:
    payload = {
        "data": {"id": user_id},
        "exp": int(time.time() + exp_offset_seconds),
    }
    return f"{_b64url(b'{}')}.{_b64url(json.dumps(payload).encode())}.sig"


# ---------------------------------------------------------------------------
# 进程内假数据层(签名与 checkin_store 真函数一一对应)
# ---------------------------------------------------------------------------


class FakeStore:
    def __init__(self) -> None:
        self.accounts: dict[int, dict[str, Any]] = {}
        self.records: dict[int, dict[str, Any]] = {}
        self.counts: dict[int, dict[str, int]] = {}
        self.next_account_id = 1
        self.next_record_id = 1

    # --- 账号 ---

    async def create_account(self, owner, name, jwt, device_map):
        for acc in self.accounts.values():
            if acc["owner_user_id"] == owner and acc["name"] == name:
                raise ValueError(f"账号名已存在: {name}")
        aid = self.next_account_id
        self.next_account_id += 1
        self.accounts[aid] = {
            "id": aid,
            "owner_user_id": owner,
            "name": name,
            "jwt": jwt,
            "device_map": dict(device_map),
            "enabled": True,
            "created_at": datetime.now(UTC),
            "updated_at": datetime.now(UTC),
        }
        return self._account_out(self.accounts[aid])

    async def list_accounts(self, owner):
        rows = [a for a in self.accounts.values() if a["owner_user_id"] == owner]
        rows.sort(key=lambda a: a["id"])
        return [self._account_out(a) for a in rows]

    async def delete_account(self, account_id, owner):
        acc = self.accounts.get(account_id)
        if acc is None or acc["owner_user_id"] != owner:
            return False
        del self.accounts[account_id]
        self.records = {k: v for k, v in self.records.items() if v["account_id"] != account_id}
        self.counts.pop(account_id, None)
        return True

    async def set_enabled(self, account_id, owner, enabled):
        acc = self.accounts.get(account_id)
        if acc is None or acc["owner_user_id"] != owner:
            return False
        acc["enabled"] = enabled
        return True

    async def get_decrypted_jwt(self, account_id, owner):
        acc = self.accounts.get(account_id)
        if acc is None or acc["owner_user_id"] != owner:
            return None
        return {
            "id": acc["id"],
            "name": acc["name"],
            "jwt": acc["jwt"],
            "device_map": dict(acc["device_map"]),
            "enabled": acc["enabled"],
        }

    async def list_enabled_accounts(self):
        return [
            {"id": a["id"], "name": a["name"], "jwt": a["jwt"], "device_map": dict(a["device_map"])}
            for a in self.accounts.values()
            if a["enabled"]
        ]

    async def save_device_map(self, account_id, device_map):
        if account_id in self.accounts:
            self.accounts[account_id]["device_map"] = dict(device_map)

    # --- 记录 ---

    async def insert_record(self, account_id, *, ok, action, http_status, code,
                            message, classified_error, cooldown_until, credits, credits_delta):
        rid = self.next_record_id
        self.next_record_id += 1
        rec = {
            "id": rid,
            "account_id": account_id,
            "ok": ok,
            "action": action,
            "http_status": http_status,
            "code": code,
            "message": message,
            "classified_error": classified_error,
            "cooldown_until": cooldown_until,
            "credits": credits,
            "credits_delta": credits_delta,
            "created_at": datetime.now(UTC),
        }
        self.records[rid] = rec
        return self._record_out(rec)

    async def list_records(self, owner, account_id=None, limit=50):
        owned = {a["id"] for a in self.accounts.values() if a["owner_user_id"] == owner}
        if account_id is not None:
            owned &= {account_id}
        rows = [r for r in self.records.values() if r["account_id"] in owned]
        rows.sort(key=lambda r: (r["created_at"], r["id"]), reverse=True)
        return [self._record_out(r) for r in rows[:limit]]

    async def credits_history(self, owner, account_id=None, limit=200):
        rows = [
            r
            for r in await self.list_records(owner, account_id=account_id, limit=limit)
            if r["credits_delta"] is not None
        ]
        return [
            {
                "id": r["id"],
                "account_id": r["account_id"],
                "ok": r["ok"],
                "action": r["action"],
                "credits": r["credits"],
                "credits_delta": r["credits_delta"],
                "created_at": r["created_at"],
            }
            for r in rows
        ]

    # --- 冷却计数 ---

    async def get_error_counts(self, account_id):
        c = self.counts.get(account_id, {})
        return c.get("server_errors", 0), c.get("client_errors", 0)

    async def bump_error_count(self, account_id, column):
        c = self.counts.setdefault(account_id, {"server_errors": 0, "client_errors": 0})
        c[column] += 1
        return c[column]

    async def reset_error_count(self, account_id, column):
        c = self.counts.setdefault(account_id, {"server_errors": 0, "client_errors": 0})
        c[column] = 0

    async def reset_all_error_counts(self, account_id):
        self.counts[account_id] = {"server_errors": 0, "client_errors": 0}

    async def get_active_cooldowns(self):
        now = datetime.now(UTC)
        out: dict[int, datetime] = {}
        for r in self.records.values():
            cd = r["cooldown_until"]
            if cd is not None and cd > now and cd > out.get(r["account_id"], datetime.min.replace(tzinfo=UTC)):
                out[r["account_id"]] = cd
        return out

    async def ensure_tables(self) -> None:
        return None

    # --- 输出投影 ---

    def _account_out(self, acc):
        return {
            "id": acc["id"],
            "name": acc["name"],
            "device_map": dict(acc["device_map"]),
            "enabled": acc["enabled"],
            "created_at": acc["created_at"].isoformat(),
            "updated_at": acc["updated_at"].isoformat(),
        }

    def _record_out(self, rec):
        out = dict(rec)
        cd = out["cooldown_until"]
        out["cooldown_until"] = cd.isoformat() if cd else None
        out["created_at"] = out["created_at"].isoformat()
        return out


@pytest.fixture
def fake_store(monkeypatch):
    """把 checkin_store 的全部 DB 函数替换为进程内假实现(不连真实 PG)。"""
    store = FakeStore()
    for name in [
        "create_account",
        "list_accounts",
        "delete_account",
        "set_enabled",
        "get_decrypted_jwt",
        "list_enabled_accounts",
        "save_device_map",
        "insert_record",
        "list_records",
        "credits_history",
        "get_error_counts",
        "bump_error_count",
        "reset_error_count",
        "reset_all_error_counts",
        "get_active_cooldowns",
        "ensure_tables",
    ]:
        monkeypatch.setattr(checkin_store, name, getattr(store, name))
    return store


def make_engine_result(name: str, *, ok: bool = True, classified_error=None) -> dict[str, Any]:
    """与 checkin_account 返回结构对齐的假结果。"""
    return {
        "ok": ok,
        "status": "success" if ok else "fail",
        "action": "claim_ok" if ok else "claim",
        "user_id": "u-1001",
        "name": name,
        "code": 0 if ok else 500,
        "message": "签到成功" if ok else "Internal Server Error",
        "http_status": 200 if ok else 500,
        "credits": 20 if ok else None,
        "credits_delta": 20 if ok else None,
        "classified_error": classified_error,
        "warning": None,
    }


@pytest.fixture
def mock_engine_success(monkeypatch):
    calls: list[tuple[str, str]] = []

    async def fake_checkin_account(name, jwt, device_map, **kwargs):
        device_map.setdefault("u-1001", {"device_id": "d1", "gen": 2})
        calls.append((name, jwt))
        return make_engine_result(name, ok=True)

    monkeypatch.setattr(checkin_scheduler_mod, "checkin_account", fake_checkin_account)
    return calls


# ---------------------------------------------------------------------------
# 用例
# ---------------------------------------------------------------------------



async def test_create_and_list_masked(client, fake_store):
    """录入 → 列表脱敏:响应绝不含 jwt / jwt_enc 字段。"""
    resp = await client.post(
        "/api/checkin/accounts",
        json={"name": "主号", "jwt": make_jwt(), "device_map": {"u-1001": {"device_id": "d1"}}},
    )
    assert resp.status_code == 200
    created = resp.json()
    assert created["name"] == "主号"
    assert created["enabled"] is True

    resp = await client.get("/api/checkin/accounts")
    assert resp.status_code == 200
    body = resp.json()
    assert body["count"] == 1
    acc = body["accounts"][0]
    assert "jwt" not in acc
    assert "jwt_enc" not in acc
    assert acc["device_map"] == {"u-1001": {"device_id": "d1"}}



async def test_create_duplicate_name_conflict(client, fake_store):
    jwt = make_jwt()
    resp1 = await client.post("/api/checkin/accounts", json={"name": "dup", "jwt": jwt})
    assert resp1.status_code == 200
    resp2 = await client.post("/api/checkin/accounts", json={"name": "dup", "jwt": jwt})
    assert resp2.status_code == 409



async def test_create_rejects_unparseable_and_expired_jwt(client, fake_store):
    """jwt 无法解析 → 400;已声明 exp 且已过期 → 400。"""
    resp = await client.post("/api/checkin/accounts", json={"name": "bad", "jwt": "not-a-jwt"})
    assert resp.status_code == 400

    expired = make_jwt(exp_offset_seconds=-3600)
    resp = await client.post("/api/checkin/accounts", json={"name": "expired", "jwt": expired})
    assert resp.status_code == 400
    assert "过期" in resp.json()["detail"]



async def test_manual_checkin_records_and_credits(client, fake_store, mock_engine_success):
    """手动签到(mock 引擎,不打外网)→ 记录回显 → 积分流水聚合。"""
    resp = await client.post(
        "/api/checkin/accounts", json={"name": "主号", "jwt": make_jwt()}
    )
    account_id = resp.json()["id"]

    resp = await client.post(f"/api/checkin/accounts/{account_id}/checkin")
    assert resp.status_code == 200
    record = resp.json()
    assert record["ok"] is True
    assert record["credits_delta"] == 20
    assert record["account_id"] == account_id
    assert len(mock_engine_success) == 1

    resp = await client.get("/api/checkin/records", params={"account_id": account_id})
    assert resp.status_code == 200
    records = resp.json()["records"]
    assert len(records) == 1
    assert records[0]["ok"] is True

    resp = await client.get("/api/checkin/credits/history", params={"account_id": account_id})
    assert resp.status_code == 200
    body = resp.json()
    assert body["count"] == 1
    assert body["total_credits_delta"] == 20



async def test_checkin_account_not_found(client, fake_store, mock_engine_success):
    resp = await client.post("/api/checkin/accounts/9999/checkin")
    assert resp.status_code == 404



async def test_set_enabled_and_delete(client, fake_store, mock_engine_success):
    resp = await client.post(
        "/api/checkin/accounts", json={"name": "tmp", "jwt": make_jwt()}
    )
    account_id = resp.json()["id"]

    resp = await client.patch(
        f"/api/checkin/accounts/{account_id}/enabled", json={"enabled": False}
    )
    assert resp.status_code == 200
    assert resp.json()["enabled"] is False
    assert fake_store.accounts[account_id]["enabled"] is False

    resp = await client.delete(f"/api/checkin/accounts/{account_id}")
    assert resp.status_code == 200
    resp = await client.delete(f"/api/checkin/accounts/{account_id}")
    assert resp.status_code == 404
    assert await fake_store.list_accounts("dev-anonymous") == []



async def test_cooldown_semantics_server_trip_and_success_reset(fake_store):
    """Server 错误连击 <3 不冷却只计数,≥3 触发冷却并清零;成功 → 两计数清零。"""
    sched = checkin_scheduler_mod.checkin_scheduler
    aid = 1
    fail_result = make_engine_result("a", ok=False, classified_error={"type": "Server", "cooldown_seconds": 600})

    r1 = await sched.record_result(aid, fail_result)
    assert r1["cooldown_until"] is None
    s, c = await fake_store.get_error_counts(aid)
    assert (s, c) == (1, 0)

    r2 = await sched.record_result(aid, fail_result)
    assert r2["cooldown_until"] is None

    r3 = await sched.record_result(aid, fail_result)
    assert r3["cooldown_until"] is not None  # 第 3 次触发冷却
    assert datetime.fromisoformat(r3["cooldown_until"]) > datetime.now(UTC)
    s, c = await fake_store.get_error_counts(aid)
    assert (s, c) == (0, 0)  # 触发冷却后计数清零

    cooldowns = await fake_store.get_active_cooldowns()
    assert aid in cooldowns  # 冷却中,每日任务应跳过

    # 成功 → 两计数清零
    ok_result = make_engine_result("a", ok=True)
    await sched.record_result(aid, ok_result)
    s, c = await fake_store.get_error_counts(aid)
    assert (s, c) == (0, 0)



async def test_cooldown_semantics_client_independent(fake_store):
    """Client 类错误独立计数,不影响 Server 计数。"""
    sched = checkin_scheduler_mod.checkin_scheduler
    aid = 2
    fail = make_engine_result("b", ok=False, classified_error={"type": "Client", "cooldown_seconds": 600})
    await sched.record_result(aid, fail)
    await sched.record_result(aid, fail)
    s, c = await fake_store.get_error_counts(aid)
    assert (s, c) == (0, 2)

    server_fail = make_engine_result("b", ok=False, classified_error={"type": "Server", "cooldown_seconds": 600})
    await sched.record_result(aid, server_fail)
    s, c = await fake_store.get_error_counts(aid)
    assert (s, c) == (1, 2)



async def test_daily_run_skips_cooldown_account(fake_store, mock_engine_success):
    """冷却中的账号每日任务跳过(引擎不被调用)。"""
    aid = 1
    fake_store.accounts[aid] = {
        "id": aid,
        "owner_user_id": "dev-anonymous",
        "name": "冷却号",
        "jwt": make_jwt(),
        "device_map": {},
        "enabled": True,
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC),
    }
    fake_store.records[1] = {
        "id": 1,
        "account_id": aid,
        "ok": False,
        "action": "claim",
        "http_status": 500,
        "code": None,
        "message": "err",
        "classified_error": json.dumps({"type": "Server", "cooldown_seconds": 600}),
        "cooldown_until": datetime.now(UTC) + timedelta(hours=1),
        "credits": None,
        "credits_delta": None,
        "created_at": datetime.now(UTC),
    }
    await checkin_scheduler_mod.checkin_scheduler._daily_run()
    assert mock_engine_success == []  # 冷却中被跳过,未打引擎
# ⁠[IHUI-AI-PROVENANCE-TAIL]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
