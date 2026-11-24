# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# /// script
# requires-python = ">=3.12"
# ///
"""连接器实例:旧 JSON 单文件 → PostgreSQL 回填器(2026-11-24 立)。

背景:``connector_store`` 已从 ``data/connector_store.json`` 迁到 PG 表
``connector_instances``。部署机上旧 JSON 里的存量记录需要一次性搬进 PG;本工具是
唯一合法出口 —— 运行时存储层**不**回落读 JSON,漏跑的存量在新层里不可见。

判据(每一条都是"推不出就不落"):
  1. **无主记录不得被回填成有主**:旧记录没有 ``owner_user_id`` 的,只计入"无主"类
     逐条报名,绝不落库(谁是原主只能由人认领,见 ``backfill_connector_owner.py``)。
  2. **已有属主的记录**按解析出的 (tenant_id, owner_user_id, key) 落 PG;PG 已存在
     同键行 ⇒ 计入"跳过",不覆盖(幂等:第二次跑同一份存量,落项必为 0)。
  3. 租户来源可信:``--tenant-id`` 显式 UUID 优先;否则回落 ``PLATFORM_DEFAULT_TENANT_ID``;
     两者都拿不到 ⇒ 拒绝执行(fail-closed),不凭空造租户。
  4. ``app_secret`` 落库前加密:明文经 ``connector_store._encrypt_secret`` 走 enc:v1;
     已是密文的原样保留。只打印 key / type 与计数,**绝不**打印记录正文或密钥。

用法:
  * 缺省 dry-run:只算会落哪些,不写库;``--apply`` 才写库。
  * ``--json`` 机器可读输出;``--store`` 覆盖旧 JSON 路径。

退出码:0 = 成功(含"无可落项");1 = 语义拒绝;2 = 环境错(store 损坏 / 无 DSN /
租户解析失败)。
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

if __package__ in (None, ""):  # 允许 `python apps/ai-service/scripts/xxx.py` 直跑
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings  # noqa: E402
from app.core.pg_sync import SyncPgSession  # noqa: E402
from app.services import connector_store as store  # noqa: E402

DEFAULT_STORE = Path(__file__).resolve().parents[1] / "data" / "connector_store.json"

_UUID_RE = store._UUID_RE  # noqa: SLF001 - 复用同一 UUID 判据,不复制字面量


@dataclass
class Plan:
    """一次回填的结论(与是否写库无关;dry-run 与 apply 共用同一判据)。"""

    inserted: list[dict[str, Any]] = field(default_factory=list)  # 本次会落 PG 的记录
    skipped: list[str] = field(default_factory=list)  # PG 已存在同键 ⇒ 不动
    ownerless: list[str] = field(default_factory=list)  # 无主且未被认领(key <- type)
    unknown_key: list[str] = field(default_factory=list)  # 缺可用 key 字段

    @property
    def changed(self) -> bool:
        return bool(self.inserted)


def load_store(path: Path) -> list[dict[str, Any]]:
    """读旧 JSON。缺文件按空列表;损坏 / 非列表抛错 ⇒ 交 CLI 判 exit 2(不猜成空)。"""
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError(f"{path} 顶层不是列表,拒绝按记录处理")
    return [rec for rec in data if isinstance(rec, dict)]


def resolve_target_tenant(cli_tenant: str | None) -> str | None:
    """解析可信落库租户;拿不到返回 None(调用方 fail-closed)。"""
    tenant = (cli_tenant or "").strip()
    if tenant:
        return tenant if _UUID_RE.match(tenant) else None
    fallback = str(getattr(settings, "platform_default_tenant_id", "") or "").strip()
    return fallback or None


def plan_backfill(
    records: list[dict[str, Any]],
    tenant_id: str,
    existing_keys: set[tuple[str, str, str]],
) -> Plan:
    """纯函数:按存量与 PG 已存键算出**该落哪些**,不碰入参、不写库。"""
    plan = Plan()
    for rec in records:
        key = rec.get("key")
        if not isinstance(key, str) or not key.strip():
            plan.unknown_key.append(str(rec.get("type") or "?"))
            continue
        owner = rec.get(store.OWNER_FIELD)
        if not owner:
            plan.ownerless.append(f"{key} ({str(rec.get('type') or '?')})")
            continue
        principal = (tenant_id, str(owner), key)
        if principal in existing_keys:
            plan.skipped.append(key)
        else:
            plan.inserted.append(rec)
    return plan


def _existing_keys(session: SyncPgSession, tenant_id: str) -> set[tuple[str, str, str]]:
    rows = session.fetchall(
        f"""
        SELECT tenant_id::text AS tenant_id, owner_user_id::text AS owner_user_id, key
        FROM "{store._TABLE}"
        WHERE tenant_id = $1
        """,
        (tenant_id,),
    )
    return {(r["tenant_id"], r["owner_user_id"] or "", r["key"]) for r in rows}


def _insert_one(session: SyncPgSession, tenant_id: str, rec: dict[str, Any]) -> None:
    """把一条记录落 PG;列映射与 connector_store._upsert 保持同源。"""
    owner = str(rec.get(store.OWNER_FIELD) or "")
    secret = rec.get("app_secret")
    secret = secret if isinstance(secret, str) else ""
    if not secret and rec.get(store._SECRET_UNREADABLE) and isinstance(
        rec.get(store._SECRET_RAW), str
    ):
        stored_secret = rec[store._SECRET_RAW]
    else:
        stored_secret = store._encrypt_secret(secret)

    extra = store._as_dict(rec.get("extra"))
    spec = store._as_dict(rec.get("spec"))
    operations = store._as_list(rec.get("operations"))
    sync_items = store._as_list(rec.get("sync_items"))
    session.execute(
        f"""
        INSERT INTO "{store._TABLE}"
          (tenant_id, owner_user_id, key, conn_type, name, enabled, app_id, app_secret,
           extra, mode, spec, operations, managed, credential_source,
           installed_at, last_sync_at, last_error, sync_items)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11::jsonb,$12::jsonb,$13,$14,
                $15,$16,$17,$18::jsonb)
        ON CONFLICT DO NOTHING
        """,
        (
            tenant_id,
            owner,
            str(rec.get("key") or ""),
            str(rec.get("type") or ""),
            str(rec.get("name") or ""),
            bool(rec.get("enabled", True)),
            str(rec.get("app_id") or ""),
            stored_secret,
            json.dumps(extra, ensure_ascii=False),
            str(rec.get("mode") or "preset"),
            json.dumps(spec, ensure_ascii=False),
            json.dumps(operations, ensure_ascii=False),
            bool(rec.get("managed", False)),
            str(rec.get("credential_source") or ""),
            str(rec.get("installed_at") or ""),
            str(rec.get("last_sync_at") or ""),
            str(rec.get("last_error") or ""),
            json.dumps(sync_items, ensure_ascii=False),
        ),
    )


def apply_plan(session: SyncPgSession, tenant_id: str, plan: Plan) -> int:
    """落库 inserted 项,返回实际插入条数(ON CONFLICT 跳过的不计)。"""
    inserted = 0
    for rec in plan.inserted:
        before = _existing_keys(session, tenant_id)
        principal = (tenant_id, str(rec.get(store.OWNER_FIELD) or ""), str(rec.get("key") or ""))
        if principal in before:
            continue
        _insert_one(session, tenant_id, rec)
        inserted += 1
    return inserted


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--store", default=str(DEFAULT_STORE), help="旧连接器 JSON 路径")
    parser.add_argument("--tenant-id", default="", help="落库租户 UUID(缺省回落 PLATFORM_DEFAULT_TENANT_ID)")
    parser.add_argument("--dry-run", action="store_true", help="显式 dry-run(与 --apply 互斥)")
    parser.add_argument("--apply", action="store_true", help="写库(缺省 dry-run)")
    parser.add_argument("--json", action="store_true", help="机器可读输出")
    args = parser.parse_args(argv)

    if args.apply and args.dry_run:
        print("❌ 拒绝:--dry-run 与 --apply 互斥,同给等于两个意图")
        return 1

    path = Path(args.store)
    try:
        records = load_store(path)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"❌ 无法判定:{path} 读不到或形态不认识 —— {exc}")
        return 2

    tenant_id = resolve_target_tenant(args.tenant_id or None)
    if not tenant_id:
        print("❌ 拒绝:拿不到可信落库租户(--tenant-id 非法且 PLATFORM_DEFAULT_TENANT_ID 未配置)")
        return 2

    dsn = str(getattr(settings, "database_url", "") or "").strip()
    if not dsn:
        print("❌ 环境错:DATABASE_URL 未配置,无法连 PostgreSQL")
        return 2

    session: SyncPgSession | None = None
    try:
        session = SyncPgSession(dsn, schema=store._SCHEMA_STATEMENTS, timeout=10.0)
        existing = _existing_keys(session, tenant_id)
        plan = plan_backfill(records, tenant_id, existing)
    except Exception as exc:  # noqa: BLE001 - 建连 / 查表失败按环境错,不猜落库
        print(f"❌ 环境错:PG 不可用 —— {type(exc).__name__}: {exc}")
        return 2

    if not args.json:
        print(f"📇 连接器 JSON→PG 回填 store={path} 记录 {len(records)} 条 租户={tenant_id}")
        print(
            f"   回填 {len(plan.inserted)} 条 / 跳过(已存在) {len(plan.skipped)} 条 / "
            f"无主(不落库) {len(plan.ownerless)} 条"
        )
        if plan.ownerless:
            print("   ⚠️ 无主记录(须人工认领,未被写成有主):")
            for item in plan.ownerless:
                print(f"     · {item}")
        if plan.unknown_key:
            print(f"   ❌ 缺可用 key 字段:{len(plan.unknown_key)} 条")

    if not args.apply:
        print("   [dry-run] 未写库。确认无误后加 --apply")
        if args.json:
            print(
                json.dumps(
                    {
                        "apply": False,
                        "tenantId": tenant_id,
                        "inserted": len(plan.inserted),
                        "skipped": len(plan.skipped),
                        "ownerless": len(plan.ownerless),
                    },
                    ensure_ascii=False,
                )
            )
        return 0

    if not plan.changed:
        print("   无可落项(幂等:第二次跑同一份存量就是这里为 0)")
        if args.json:
            print(json.dumps({"apply": True, "inserted": 0, "skipped": len(plan.skipped),
                              "ownerless": len(plan.ownerless)}, ensure_ascii=False))
        return 0

    try:
        inserted = apply_plan(session, tenant_id, plan)
    except Exception as exc:  # noqa: BLE001
        print(f"❌ 写库失败: {type(exc).__name__}: {exc}")
        return 1

    print(f"✅ 已回填 {inserted} 条到 PG(跳过 {len(plan.skipped)} 条,无主 {len(plan.ownerless)} 条)")
    if args.json:
        print(
            json.dumps(
                {
                    "apply": True,
                    "tenantId": tenant_id,
                    "inserted": inserted,
                    "skipped": len(plan.skipped),
                    "ownerless": len(plan.ownerless),
                },
                ensure_ascii=False,
            )
        )
    return 0


def harden_console_streams() -> None:
    """stdout/stderr 编码 errors='replace'(同 backfill_connector_owner 范本)。"""
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if not callable(reconfigure):
            continue
        try:
            reconfigure(errors="replace")
        except (OSError, ValueError):
            pass


if __name__ == "__main__":
    harden_console_streams()
    raise SystemExit(main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
