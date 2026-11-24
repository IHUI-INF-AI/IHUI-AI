# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""connector_store PG 存储层的内存 fake(测试隔离,不连真实 PG)。

只实现 store 模块实际用到的四个会话面:``fetchrow / fetchall / fetchval / execute``;
SQL 按语句前缀分派,参数位置与 ``connector_store`` 里的占位符一一对应。行模型与 PG
表 ``connector_instances`` 列名一致,方便断言"原始行里 secret 是密文、不含明文"。
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any


def _now() -> str:
    return datetime.now(UTC).isoformat()


class FakeSession:
    """内存表,行为对齐 SyncPgSession 的薄同步桥。"""

    def __init__(self) -> None:
        self.rows: list[dict[str, Any]] = []
        self.force_unique_conflict = False
        self.executed: list[str] = []

    # -- 匹配 ---------------------------------------------------------------

    @staticmethod
    def _match(row: dict[str, Any], tenant: str, owner: Any, key: str | None = None) -> bool:
        if str(row["tenant_id"]) != str(tenant):
            return False
        row_owner = row["owner_user_id"]
        if owner is None:
            if row_owner is not None:
                return False
        elif str(row_owner) != str(owner):
            return False
        if key is not None and str(row["key"]) != str(key):
            return False
        return True

    def _find(self, tenant: str, owner: Any, key: str) -> dict[str, Any] | None:
        for row in self.rows:
            if self._match(row, tenant, owner, key):
                return row
        return None

    # -- 会话面 -------------------------------------------------------------

    def fetchrow(self, sql: str, params: tuple[Any, ...] = ()) -> dict[str, Any] | None:
        self.executed.append(sql)
        if sql.lstrip().upper().startswith("UPDATE"):
            return self._apply_update(sql, params)
        tenant, owner, key = params[0], params[1], params[2]
        row = self._find(tenant, owner, key)
        return dict(row) if row is not None else None

    def fetchall(self, sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
        self.executed.append(sql)
        tenant = params[0] if params else None
        owner = params[1] if len(params) > 1 else None
        return [dict(r) for r in self.rows if self._match(r, tenant, owner)]

    def fetchval(self, sql: str, params: tuple[Any, ...] = ()) -> Any:
        self.executed.append(sql)
        if "tenant_id IS NULL" in sql:
            return sum(1 for r in self.rows if r["tenant_id"] is None)
        return len(self.rows)

    def execute(self, sql: str, params: tuple[Any, ...] = ()) -> str:
        self.executed.append(sql)
        head = sql.lstrip().upper()
        if head.startswith("INSERT"):
            return self._apply_insert(sql, params)
        if head.startswith("UPDATE"):
            self._apply_update(sql, params)
            return "UPDATE 1"
        if head.startswith("DELETE"):
            tenant, owner, key = params[0], params[1], params[2]
            before = len(self.rows)
            self.rows = [r for r in self.rows if not self._match(r, tenant, owner, key)]
            return "DELETE 1" if len(self.rows) < before else "DELETE 0"
        return "OK"

    # -- 内部:写 ------------------------------------------------------------

    def _common(self, params: tuple[Any, ...]) -> dict[str, Any]:
        # INSERT/UPDATE 共用参数位:$3 key,$4 conn_type,$5 name,$6 enabled,$7 app_id,
        # $8 app_secret,$9 extra,$10 mode,$11 spec,$12 operations,$13 managed,
        # $14 credential_source,$15 installed_at,$16 last_sync_at,$17 last_error,$18 sync_items
        return {
            "key": params[2],
            "conn_type": params[3],
            "name": params[4],
            "enabled": bool(params[5]),
            "app_id": params[6],
            "app_secret": params[7],
            "extra": _maybe_json(params[8]),
            "mode": params[9],
            "spec": _maybe_json(params[10]),
            "operations": _maybe_json(params[11]),
            "managed": bool(params[12]),
            "credential_source": params[13],
            "installed_at": params[14],
            "last_sync_at": params[15],
            "last_error": params[16],
            "sync_items": _maybe_json(params[17]),
        }

    def _apply_insert(self, sql: str, params: tuple[Any, ...]) -> str:
        if self.force_unique_conflict:
            raise RuntimeError("unique violation: connector_instances_owner_key_uidx")
        tenant, owner = params[0], params[1]
        row: dict[str, Any] = {
            "id": f"row-{len(self.rows) + 1}",
            "tenant_id": tenant,
            "owner_user_id": owner,
            **self._common(params),
            "created_at": _now(),
            "updated_at": _now(),
        }
        self.rows.append(row)
        return "INSERT 0 1"

    def _apply_update(self, sql: str, params: tuple[Any, ...]) -> dict[str, Any] | None:
        tenant, owner, key = params[0], params[1], params[2]
        row = self._find(tenant, owner, key)
        if row is None:
            return None
        if "enabled=$4" in sql:
            row["enabled"] = bool(params[3])
            row["updated_at"] = _now()
            return dict(row)
        if "sync_items=$6::jsonb" in sql:
            row["last_sync_at"] = params[3]
            row["last_error"] = params[4]
            row["sync_items"] = _maybe_json(params[5])
            row["updated_at"] = _now()
            return dict(row)
        if "last_sync_at=$4" in sql:
            row["last_sync_at"] = params[3]
            row["last_error"] = params[4]
            row["updated_at"] = _now()
            return dict(row)
        # 全字段 upsert update
        row.update(self._common(params))
        row["updated_at"] = _now()
        return dict(row)


def _maybe_json(raw: Any) -> Any:
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except Exception:  # noqa: BLE001
            return raw
    return raw
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
