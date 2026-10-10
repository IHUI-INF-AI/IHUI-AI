# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""签到助手服务端化测试(Phase1b,2026-10-03 立)。

覆盖:录入 → 列表脱敏(jwt 字段绝不出现)→ 过期 jwt 拒收 →
手动签到(mock checkin_engine,不打外网)→ 记录/积分流水回显 → 删除,
外加调度器冷却累积语义(Server 连击 3 次触发冷却 + 成功清零)。

Phase1c 增强(2026-10-08):PATCH jwt(成功/404/400/属主隔离)、
列表 jwt_exp + cooldown_until 字段、GET scheduler/status 三字段形态。

DB 隔离:仓库无 PG testcontainer fixture,按 conftest 既有惯例
(monkeypatch 仓储层)把 checkin_store 的全部 DB 函数换成进程内假实现;
checkin_engine.checkin_account 用假实现替换,绝无真实网络 IO。
"""

from __future__ import annotations

import base64
import json
import time
from datetime import UTC, date, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import pytest

from app.core.jwt_auth import require_request_user_id
from app.services import checkin_scheduler as checkin_scheduler_mod
from app.services import checkin_store
from app.services.checkin_engine import get_jwt_exp

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
        self.credits_daily: dict[tuple[int, str], dict[str, Any]] = {}
        self.next_account_id = 1
        self.next_record_id = 1

    # --- 账号 ---

    async def create_account(self, owner, name, jwt, device_map, account_group="", platform="trae"):
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
            "group": account_group,
            "platform": platform,
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

    async def update_jwt(self, account_id, owner, jwt):
        acc = self.accounts.get(account_id)
        if acc is None or acc["owner_user_id"] != owner:
            return False
        acc["jwt"] = jwt
        acc["updated_at"] = datetime.now(UTC)
        return True

    async def update_group(self, account_id, owner, group):
        acc = self.accounts.get(account_id)
        if acc is None or acc["owner_user_id"] != owner:
            return False
        acc["group"] = group
        acc["updated_at"] = datetime.now(UTC)
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

    # --- 积分每日快照(WP-B) ---

    async def upsert_credits_daily(self, account_id, owner_user_id, day, remaining, gained):
        key = (account_id, day)
        row = self.credits_daily.get(key)
        if row is None:
            self.credits_daily[key] = {
                "account_id": account_id,
                "owner_user_id": owner_user_id,
                "day": day,
                "remaining": remaining,
                "gained": gained,
            }
            return None
        if remaining is not None:  # remaining None 不覆盖旧值
            row["remaining"] = remaining
        row["gained"] = gained
        return None

    async def get_credits_daily_range(self, owner_user_id, days):
        """稀疏行:仅含有数据的日子(与真实现的 UNION 聚合语义一致)。"""
        cn = ZoneInfo("Asia/Shanghai")
        start = datetime.now(cn).date() - timedelta(days=days - 1)
        out: dict[str, dict[str, Any]] = {}
        for row in self.credits_daily.values():
            if row["owner_user_id"] != owner_user_id:
                continue
            if date.fromisoformat(row["day"]) < start:
                continue
            agg = out.setdefault(row["day"], {"day": row["day"], "total": None, "gained": None})
            if row["remaining"] is not None:
                agg["total"] = (agg["total"] or 0) + row["remaining"]
        owned = {a["id"] for a in self.accounts.values() if a["owner_user_id"] == owner_user_id}
        for r in self.records.values():
            if r["account_id"] not in owned or r["credits_delta"] is None:
                continue
            day = r["created_at"].astimezone(cn).date().isoformat()
            if date.fromisoformat(day) < start:
                continue
            agg = out.setdefault(day, {"day": day, "total": None, "gained": None})
            agg["gained"] = (agg["gained"] or 0) + r["credits_delta"]
        return [out[k] for k in sorted(out)]

    async def sum_credits_delta_for_day(self, account_id, owner_user_id, day):
        acc = self.accounts.get(account_id)
        if acc is None or acc["owner_user_id"] != owner_user_id:
            return 0
        cn = ZoneInfo("Asia/Shanghai")
        target = date.fromisoformat(day)
        return sum(
            r["credits_delta"]
            for r in self.records.values()
            if r["account_id"] == account_id
            and r["credits_delta"] is not None
            and r["created_at"].astimezone(cn).date() == target
        )

    async def list_enabled_accounts_full(self):
        return [
            {
                "id": a["id"],
                "owner_user_id": a["owner_user_id"],
                "name": a["name"],
                "jwt": a["jwt"],
                "device_map": dict(a["device_map"]),
            }
            for a in self.accounts.values()
            if a["enabled"]
        ]

    # --- 输出投影 ---

    def _account_out(self, acc):
        exp_dt, _remaining = get_jwt_exp(acc["jwt"])
        return {
            "id": acc["id"],
            "name": acc["name"],
            "group": acc.get("group", ""),
            "platform": acc.get("platform", "trae"),
            "device_map": dict(acc["device_map"]),
            "enabled": acc["enabled"],
            "created_at": acc["created_at"].isoformat(),
            "updated_at": acc["updated_at"].isoformat(),
            "jwt_exp": exp_dt.isoformat() if exp_dt is not None else None,
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
        "update_jwt",
        "update_group",
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
        "upsert_credits_daily",
        "get_credits_daily_range",
        "sum_credits_delta_for_day",
        "list_enabled_accounts_full",
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



async def test_update_jwt_roundtrip(client, fake_store):
    """PATCH jwt 成功:响应含 ok/jwt_exp,store 里 jwt 已换新。"""
    resp = await client.post("/api/checkin/accounts", json={"name": "主号", "jwt": make_jwt()})
    assert resp.status_code == 200
    account_id = resp.json()["id"]
    old_jwt = fake_store.accounts[account_id]["jwt"]

    new_jwt = make_jwt(user_id="u-2002", exp_offset_seconds=7200)
    resp = await client.patch(f"/api/checkin/accounts/{account_id}/jwt", json={"jwt": new_jwt})
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["id"] == account_id
    exp_dt, _ = get_jwt_exp(new_jwt)
    assert body["jwt_exp"] == exp_dt.isoformat()
    assert fake_store.accounts[account_id]["jwt"] == new_jwt
    assert old_jwt != new_jwt



async def test_update_jwt_not_found(client, fake_store):
    resp = await client.patch("/api/checkin/accounts/9999/jwt", json={"jwt": make_jwt()})
    assert resp.status_code == 404
    assert "账号不存在" in resp.json()["detail"]



async def test_update_jwt_rejects_unparseable(client, fake_store):
    """无法解析的 jwt → 400,且不得落库。"""
    resp = await client.post("/api/checkin/accounts", json={"name": "主号", "jwt": make_jwt()})
    account_id = resp.json()["id"]
    original_jwt = fake_store.accounts[account_id]["jwt"]

    resp = await client.patch(f"/api/checkin/accounts/{account_id}/jwt", json={"jwt": "not-a-jwt"})
    assert resp.status_code == 400
    assert fake_store.accounts[account_id]["jwt"] == original_jwt



async def test_update_jwt_owner_isolation(client, fake_store):
    """属主隔离:换身份 PATCH 别人的账号 → 404,jwt 不被改动。"""
    from app.main import fastapi_app  # client fixture 已触发惰性导入,此处仅取引用

    resp = await client.post("/api/checkin/accounts", json={"name": "mine", "jwt": make_jwt()})
    account_id = resp.json()["id"]
    original_jwt = fake_store.accounts[account_id]["jwt"]

    fastapi_app.dependency_overrides[require_request_user_id] = lambda: "user-other"
    try:
        resp = await client.patch(
            f"/api/checkin/accounts/{account_id}/jwt", json={"jwt": make_jwt(user_id="u-evil")}
        )
        assert resp.status_code == 404
        assert fake_store.accounts[account_id]["jwt"] == original_jwt
    finally:
        fastapi_app.dependency_overrides.pop(require_request_user_id, None)



async def test_list_accounts_jwt_exp_and_cooldown_until(client, fake_store):
    """列表增强:jwt_exp 与该账号 jwt 的 exp 一致;cooldown_until 无冷却为 null、
    有未来冷却记录时合并进行内,且 jwt/jwt_enc 依旧不出现。"""
    jwt = make_jwt()
    resp = await client.post("/api/checkin/accounts", json={"name": "主号", "jwt": jwt})
    account_id = resp.json()["id"]

    resp = await client.get("/api/checkin/accounts")
    assert resp.status_code == 200
    acc = resp.json()["accounts"][0]
    exp_dt, _ = get_jwt_exp(jwt)
    assert acc["jwt_exp"] == exp_dt.isoformat()
    assert "jwt" not in acc
    assert "jwt_enc" not in acc
    assert acc["cooldown_until"] is None

    # 写入一条未来冷却记录 → 列表行合并出 cooldown_until
    cd = datetime.now(UTC) + timedelta(hours=1)
    fake_store.records[9001] = {"id": 9001, "account_id": account_id, "cooldown_until": cd}
    resp = await client.get("/api/checkin/accounts")
    acc = resp.json()["accounts"][0]
    assert acc["cooldown_until"] == cd.isoformat()



async def test_group_create_list_and_patch(client, fake_store):
    """Phase1d 分组:创建带 group → 列表回吐;PATCH 换组/清空(空串)均生效。"""
    resp = await client.post(
        "/api/checkin/accounts",
        json={"name": "主号", "jwt": make_jwt(), "group": "主力"},
    )
    assert resp.status_code == 200
    account_id = resp.json()["id"]
    assert resp.json()["group"] == "主力"

    resp = await client.get("/api/checkin/accounts")
    assert resp.json()["accounts"][0]["group"] == "主力"

    resp = await client.patch(
        f"/api/checkin/accounts/{account_id}/group", json={"group": "备用"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body == {"ok": True, "id": account_id, "group": "备用"}
    assert fake_store.accounts[account_id]["group"] == "备用"

    # 空串 = 移出分组
    resp = await client.patch(
        f"/api/checkin/accounts/{account_id}/group", json={"group": ""}
    )
    assert resp.status_code == 200
    assert fake_store.accounts[account_id]["group"] == ""

    # 不带 group 的创建回落空串
    resp = await client.post("/api/checkin/accounts", json={"name": "散号", "jwt": make_jwt()})
    assert resp.status_code == 200
    assert resp.json()["group"] == ""


async def test_update_group_not_found(client, fake_store):
    resp = await client.patch("/api/checkin/accounts/9999/group", json={"group": "x"})
    assert resp.status_code == 404
    assert "账号不存在" in resp.json()["detail"]


async def test_update_group_owner_isolation(client, fake_store):
    """属主隔离:换身份 PATCH 别人的账号分组 → 404,原分组不被改动。"""
    from app.main import fastapi_app

    resp = await client.post("/api/checkin/accounts", json={"name": "mine", "jwt": make_jwt()})
    account_id = resp.json()["id"]

    fastapi_app.dependency_overrides[require_request_user_id] = lambda: "user-other"
    try:
        resp = await client.patch(
            f"/api/checkin/accounts/{account_id}/group", json={"group": "入侵"}
        )
        assert resp.status_code == 404
        assert fake_store.accounts[account_id]["group"] == ""
    finally:
        fastapi_app.dependency_overrides.pop(require_request_user_id, None)


async def test_scheduler_status_shape(client, monkeypatch):
    """GET /scheduler/status:四字段形态(测试进程无 lifespan → 未启动,next_run 双 null)。"""
    monkeypatch.setenv("CHECKIN_CRON_ENABLED", "true")
    resp = await client.get("/api/checkin/scheduler/status")
    assert resp.status_code == 200
    body = resp.json()
    assert body["enabled"] is True
    assert body["started"] is False
    assert body["next_run"] is None
    assert body["next_run_qoder"] is None



def test_scheduler_status_next_run_when_started(monkeypatch):
    """status():started 单例 + job.next_run_time → 带时区 ISO8601;未启动四字段缺省。"""
    monkeypatch.setenv("CHECKIN_CRON_ENABLED", "false")
    sched = checkin_scheduler_mod.CheckinScheduler()
    assert sched.status() == {
        "enabled": False,
        "started": False,
        "next_run": None,
        "next_run_qoder": None,
    }

    nrt = datetime(2026, 10, 9, 8, 5, tzinfo=checkin_scheduler_mod._CN_TZ)
    nrt_q = datetime(2026, 10, 9, 10, 5, tzinfo=checkin_scheduler_mod._CN_TZ)

    class _FakeJob:
        next_run_time: datetime | None = nrt

    class _FakeJobQoder:
        next_run_time: datetime | None = nrt_q

    class _FakeApscheduler:
        def get_job(self, job_id: str):
            if job_id == checkin_scheduler_mod._JOB_ID:
                return _FakeJob()
            if job_id == checkin_scheduler_mod._JOB_ID_QODER:
                return _FakeJobQoder()
            return None

    sched._scheduler = _FakeApscheduler()  # 模拟已 start 的单例,不真起事件循环调度
    sched._started = True
    st = sched.status()
    assert st["started"] is True
    assert st["enabled"] is False
    assert st["next_run"] == "2026-10-09T08:05:00+08:00"
    assert st["next_run_qoder"] == "2026-10-09T10:05:00+08:00"



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


# ---------------------------------------------------------------------------
# WP-B(2026-10-09)积分每日快照
# ---------------------------------------------------------------------------


def _make_packs_result(remaining: int) -> dict[str, Any]:
    return {
        "remaining": remaining,
        "packs": [{"limit": 200, "used": 200 - remaining, "expire_time": None, "charge_amount": 0}],
        "error": None,
    }


async def test_query_credits_success_writes_snapshot(client, fake_store, monkeypatch):
    """query_credits 成功:返回 ok/remaining,且落当日快照(gained 取当日 delta 合计)。"""
    from app.services import checkin_credits

    async def fake_query(jwt):
        return _make_packs_result(150)

    monkeypatch.setattr(checkin_credits, "query_remaining_credits", fake_query)

    resp = await client.post("/api/checkin/accounts", json={"name": "主号", "jwt": make_jwt()})
    account_id = resp.json()["id"]

    resp = await client.post(f"/api/checkin/accounts/{account_id}/query_credits")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["remaining"] == 150

    day = datetime.now(ZoneInfo("Asia/Shanghai")).date().isoformat()
    row = fake_store.credits_daily[(account_id, day)]
    assert row["remaining"] == 150
    assert row["gained"] == 0

    # 当日已有签到 delta 时,gained 合计进快照
    await fake_store.insert_record(
        account_id,
        ok=True,
        action="claim_ok",
        http_status=200,
        code=0,
        message="签到成功",
        classified_error=None,
        cooldown_until=None,
        credits=20,
        credits_delta=20,
    )
    resp = await client.post(f"/api/checkin/accounts/{account_id}/query_credits")
    assert resp.status_code == 200
    assert fake_store.credits_daily[(account_id, day)]["gained"] == 20
    assert fake_store.credits_daily[(account_id, day)]["remaining"] == 150  # 旧值不丢


async def test_query_credits_owner_isolation_404(client, fake_store, monkeypatch):
    """属主隔离:换身份查别人的账号 → 404,不落任何快照。"""
    from app.main import fastapi_app
    from app.services import checkin_credits

    async def fake_query(jwt):
        return _make_packs_result(999)

    monkeypatch.setattr(checkin_credits, "query_remaining_credits", fake_query)

    resp = await client.post("/api/checkin/accounts", json={"name": "mine", "jwt": make_jwt()})
    account_id = resp.json()["id"]

    fastapi_app.dependency_overrides[require_request_user_id] = lambda: "user-other"
    try:
        resp = await client.post(f"/api/checkin/accounts/{account_id}/query_credits")
        assert resp.status_code == 404
        assert "账号不存在" in resp.json()["detail"]
    finally:
        fastapi_app.dependency_overrides.pop(require_request_user_id, None)
    assert fake_store.credits_daily == {}


async def test_query_credits_error_no_snapshot(client, fake_store, monkeypatch):
    """查询失败:error 透传且不落快照,不抛栈(200 + ok=false)。"""
    from app.services import checkin_credits

    async def fake_query(jwt):
        return {"remaining": None, "packs": [], "error": "积分余额接口 HTTP 401: expired"}

    monkeypatch.setattr(checkin_credits, "query_remaining_credits", fake_query)

    resp = await client.post("/api/checkin/accounts", json={"name": "主号", "jwt": make_jwt()})
    account_id = resp.json()["id"]

    resp = await client.post(f"/api/checkin/accounts/{account_id}/query_credits")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert "401" in body["error"]
    assert fake_store.credits_daily == {}


async def test_credits_daily_series_and_consumed_formula(client, fake_store):
    """credits/daily 聚合形状:total/gained/consumed 三线,consumed 公式
    |total[i] − gained[i] − total[i−1]|,首日 0,断档日 null。"""
    cn = ZoneInfo("Asia/Shanghai")
    today = datetime.now(cn).date()
    d_minus2 = (today - timedelta(days=2)).isoformat()
    d_minus1 = (today - timedelta(days=1)).isoformat()
    today_iso = today.isoformat()

    resp = await client.post("/api/checkin/accounts", json={"name": "主号", "jwt": make_jwt()})
    account_id = resp.json()["id"]

    # 前天快照 160;昨天快照 140;今天快照 100 + 当日签到 delta 20(相邻日构成公式链)
    await fake_store.upsert_credits_daily(account_id, "dev-anonymous", d_minus2, 160, 0)
    await fake_store.upsert_credits_daily(account_id, "dev-anonymous", d_minus1, 140, 0)
    await fake_store.upsert_credits_daily(account_id, "dev-anonymous", today_iso, 100, 0)
    await fake_store.insert_record(
        account_id,
        ok=True,
        action="claim_ok",
        http_status=200,
        code=0,
        message="签到成功",
        classified_error=None,
        cooldown_until=None,
        credits=20,
        credits_delta=20,
    )

    resp = await client.get("/api/checkin/credits/daily", params={"days": 3})
    assert resp.status_code == 200
    body = resp.json()
    assert body["days"] == [d_minus2, d_minus1, today_iso]
    series = body["series"]
    assert series["total"] == [160, 140, 100]
    assert series["gained"] == [0, 0, 20]
    # consumed = |total[i] − gained[i] − total[i−1]|,首日 0
    assert series["consumed"] == [0, abs(140 - 0 - 160), abs(100 - 20 - 140)]

    # 窗口拉长到 5 天:前两天无数据 → total/consumed 置 null(断档断线)
    resp = await client.get("/api/checkin/credits/daily", params={"days": 5})
    series = resp.json()["series"]
    assert series["total"] == [None, None, 160, 140, 100]
    assert series["gained"] == [0, 0, 0, 0, 20]
    assert series["consumed"] == [None, None, None, 20, 60]
# ⁠[IHUI-AI-PROVENANCE-TAIL]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
