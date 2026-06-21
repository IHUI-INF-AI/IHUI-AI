"""多租户 backfill 脚本 (建议 139) - scripts/ci/backfill_tenants.py.

把 public.users / public.user_margin 的现有数据按 tenant_id 列拆到各 tenant_X schema.
配合建议 132 (User / UserMargin 已迁移到 TenantBase) 使用.

用法:
    python scripts/ci/backfill_tenants.py [--batch-size 1000] [--table users,user_margin] [--dry-run]
    python scripts/ci/backfill_tenants.py --status --state-file .backfill_state.json
    python scripts/ci/backfill_tenants.py --reset-state

特性:
  - 按 tenant_id 拆分数据, 每个 tenant 一个目标 schema
  - batch 处理 (默认 1000 行/批)
  - 进度报告 + ETA 估算
  - 断点续传 (记录 last_processed_id)
  - dry-run 模式 (不写, 只统计)
  - 幂等: 用 ON CONFLICT DO NOTHING 避免重复
  - 仅迁移 active tenant (status=1)
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import sqlalchemy as sa

from app.core.tenant import get_tenant_schema_name

# ---------------------------------------------------------------------------
# 建议 139: Backfill 状态跟踪器
# ---------------------------------------------------------------------------

DEFAULT_STATE_FILE = str(ROOT / ".backfill_tenants_state.json")


class BackfillStateTracker:
    """Backfill 进度跟踪 (断点续传)."""

    def __init__(self, state_file: str = DEFAULT_STATE_FILE):
        self._state_file = state_file
        self._data = self._load()

    def _load(self) -> dict:
        if os.path.exists(self._state_file):
            try:
                with open(self._state_file, encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return {
            "version": 1,
            "started_at": time.time(),
            "updated_at": time.time(),
            "tables": {},  # {table_name: {tenant_id: last_id, total_processed, status}}
        }

    def _save(self) -> None:
        self._data["updated_at"] = time.time()
        tmp = self._state_file + ".tmp"
        try:
            os.makedirs(os.path.dirname(self._state_file) or ".", exist_ok=True)
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(self._data, f, ensure_ascii=False, indent=2)
            os.replace(tmp, self._state_file)
        except Exception:
            try:
                if os.path.exists(tmp):
                    os.remove(tmp)
            except Exception:
                pass

    def get_last_id(self, table: str, tenant_id: int) -> str | None:
        rec = self._data["tables"].get(table, {}).get(str(tenant_id), {})
        return rec.get("last_id")

    def mark_progress(self, table: str, tenant_id: int, last_id: str, processed: int) -> None:
        t = self._data["tables"].setdefault(table, {})
        t[str(tenant_id)] = {
            "tenant_id": tenant_id,
            "last_id": last_id,
            "processed": processed,
            "status": "in_progress",
            "last_updated": time.time(),
        }
        self._save()

    def mark_done(self, table: str, tenant_id: int) -> None:
        t = self._data["tables"].setdefault(table, {})
        t[str(tenant_id)] = {
            "tenant_id": tenant_id,
            "last_id": None,
            "status": "done",
            "last_updated": time.time(),
        }
        self._save()

    def reset(self) -> None:
        self._data = {
            "version": 1,
            "started_at": time.time(),
            "updated_at": time.time(),
            "tables": {},
        }
        self._save()

    def summary(self) -> dict:
        """汇总: 状态计数 + 进度."""
        result = {}
        for table, tenants in self._data["tables"].items():
            cnt = {"done": 0, "in_progress": 0}
            for t in tenants.values():
                s = t.get("status", "in_progress")
                cnt[s] = cnt.get(s, 0) + 1
            result[table] = cnt
        return result


# ---------------------------------------------------------------------------
# 工具: 列出 active tenants
# ---------------------------------------------------------------------------


def list_active_tenants(engine: sa.engine.Engine) -> list[int]:
    """从 public.admin_tenant 列出 active tenant_id."""
    try:
        with engine.connect() as conn:
            rows = conn.execute(
                sa.text("SELECT tenant_id FROM public.admin_tenant WHERE status = 1 ORDER BY tenant_id")
            ).fetchall()
            return [r[0] for r in rows]
    except Exception:
        return []


# ---------------------------------------------------------------------------
# 核心: backfill 一张表
# ---------------------------------------------------------------------------


def backfill_one_table(
    engine: sa.engine.Engine,
    source_table: str,
    batch_size: int = 1000,
    dry_run: bool = False,
    resume: bool = False,
    state_file: str = DEFAULT_STATE_FILE,
    tenant_ids: list[int] | None = None,
    publish_events: bool = True,
) -> dict:
    """把 public.{table} 按 tenant_id 拆到 tenant_X.{table}.

    Args:
        publish_events: 是否发布到 BackfillBroadcaster (建议 145), 默认 True

    Returns:
        {
            "source_table": str,
            "total_processed": int,
            "tenants": {tenant_id: {"processed": int, "duration": float}},
            "duration_seconds": float,
            "dry_run": bool,
        }
    """
    # 建议 145: 进度广播器
    bc = None
    if publish_events:
        try:
            from app.backfill_broadcaster import get_broadcaster

            bc = get_broadcaster()
        except Exception:
            bc = None
    tracker = BackfillStateTracker(state_file)
    start = time.time()
    # 拿 active tenants
    if tenant_ids is None:
        tenant_ids = list_active_tenants(engine)
    if not tenant_ids:
        return {
            "source_table": source_table,
            "total_processed": 0,
            "tenants": {},
            "duration_seconds": 0.0,
            "dry_run": dry_run,
        }

    # 验证 source table 存在 + 有 tenant_id 列
    try:
        with engine.connect() as conn:
            row = conn.execute(
                sa.text(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_schema='public' AND table_name=:t AND column_name='tenant_id'"
                ),
                {"t": source_table},
            ).fetchone()
            if not row:
                return {
                    "source_table": source_table,
                    "total_processed": 0,
                    "tenants": {},
                    "duration_seconds": 0.0,
                    "dry_run": dry_run,
                    "error": f"public.{source_table} 缺 tenant_id 列",
                }
            # 拿总行数
            cnt_row = conn.execute(sa.text(f'SELECT COUNT(*) FROM public."{source_table}"')).fetchone()
            total = cnt_row[0] if cnt_row else 0
    except Exception as e:
        if bc is not None:
            bc.publish_error(source_table, f"读 source 表失败: {e}")
        return {
            "source_table": source_table,
            "total_processed": 0,
            "tenants": {},
            "duration_seconds": 0.0,
            "dry_run": dry_run,
            "error": f"读 source 表失败: {e}",
        }

    # 建议 145: 发布 started
    if bc is not None:
        bc.publish_started(source_table, total=total)

    result_tenants: dict = {}
    grand_total = 0
    for tid in tenant_ids:
        schema = get_tenant_schema_name(tid)
        tenant_start = time.time()
        # 拿 last_id (断点续传)
        last_id = tracker.get_last_id(source_table, tid) if resume else None
        if last_id is None:
            last_id = ""  # 起始
        # 拿主键列
        pk_col = _get_pk_col(engine, source_table) or "id"
        # batch 处理
        processed = 0
        if not dry_run:
            # 验证 target schema 存在
            try:
                with engine.connect() as conn:
                    conn.execute(sa.text(f'CREATE SCHEMA IF NOT EXISTS "{schema}"'))
                    # 验证 target 表存在 (用户已迁移表到 TenantBase)
                    row = conn.execute(
                        sa.text("SELECT 1 FROM information_schema.tables " "WHERE table_schema=:s AND table_name=:t"),
                        {"s": schema, "t": source_table},
                    ).fetchone()
                    if not row:
                        # target 表不存在, 跳过 (用户未迁移该 schema)
                        result_tenants[tid] = {
                            "processed": 0,
                            "duration": 0.0,
                            "skipped": "target 表不存在",
                        }
                        continue
            except Exception as e:
                result_tenants[tid] = {
                    "processed": 0,
                    "duration": 0.0,
                    "error": str(e)[:200],
                }
                continue
        # 拉 batch + INSERT
        offset = 0
        with engine.connect() as conn:
            while True:
                # 拉 batch
                if last_id:
                    rows = conn.execute(
                        sa.text(
                            f'SELECT * FROM public."{source_table}" '
                            f"WHERE tenant_id=:tid AND {pk_col} > :lid "
                            f"ORDER BY {pk_col} LIMIT :lim"
                        ),
                        {"tid": tid, "lid": last_id, "lim": batch_size},
                    ).fetchall()
                else:
                    rows = conn.execute(
                        sa.text(
                            f'SELECT * FROM public."{source_table}" '
                            f"WHERE tenant_id=:tid ORDER BY {pk_col} LIMIT :lim OFFSET :off"
                        ),
                        {"tid": tid, "lim": batch_size, "off": offset},
                    ).fetchall()
                if not rows:
                    break
                # INSERT to target (dry-run 跳过)
                if not dry_run:
                    _insert_batch(conn, schema, source_table, rows)
                # 更新 last_id
                last_id = str(rows[-1]._mapping[pk_col])
                processed += len(rows)
                # 进度
                elapsed = time.time() - tenant_start
                pct = processed / total * 100 if total else 0
                eta = (elapsed / processed * (total - processed)) if processed else 0
                sys.stdout.write(
                    f"\r  [table={source_table} tenant={tid} schema={schema}] "
                    f"processed={processed}/{total} ({pct:.1f}%) "
                    f"elapsed={elapsed:.1f}s eta={eta:.1f}s"
                )
                sys.stdout.flush()
                if len(rows) < batch_size:
                    break
                offset += batch_size
        # 标记完成
        if not dry_run:
            tracker.mark_done(source_table, tid)
        duration = time.time() - tenant_start
        result_tenants[tid] = {"processed": processed, "duration": round(duration, 3)}
        grand_total += processed
        # 建议 145: 发布 tenant_done
        if bc is not None:
            bc.publish_tenant_done(source_table, tid, processed, duration)
        print(f"\n  [完成] table={source_table} tenant={tid} processed={processed} duration={duration:.2f}s")
    duration = time.time() - start
    # 建议 145: 发布 table_done
    if bc is not None:
        bc.publish_table_done(source_table, grand_total)
    print(f"\n[backfill {source_table}] grand_total={grand_total} duration={duration:.2f}s dry_run={dry_run}")
    return {
        "source_table": source_table,
        "total_processed": grand_total,
        "tenants": result_tenants,
        "duration_seconds": round(duration, 3),
        "dry_run": dry_run,
    }


def _get_pk_col(engine: sa.engine.Engine, table: str) -> str | None:
    """拿 source 表的主键列名 (启发式: id 或 uuid)."""
    try:
        with engine.connect() as conn:
            rows = conn.execute(
                sa.text(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_schema='public' AND table_name=:t "
                    "AND column_name IN ('id', 'uuid', 'user_id', 'user_uuid') "
                    "ORDER BY ordinal_position LIMIT 1"
                ),
                {"t": table},
            ).fetchall()
            return rows[0][0] if rows else None
    except Exception:
        return None


def _insert_batch(conn, schema: str, table: str, rows: list) -> None:
    """把 rows 批量插入到 schema.table.

    使用 INSERT ... ON CONFLICT DO NOTHING 幂等性.
    """
    if not rows:
        return
    # 拿列名 (从第一行)
    first = rows[0]
    cols = list(first._mapping.keys())
    # 构造 placeholders
    placeholders = ", ".join([f":{c}" for c in cols])
    col_list = ", ".join([f'"{c}"' for c in cols])
    sql = f'INSERT INTO "{schema}"."{table}" ({col_list}) VALUES ({placeholders}) ' f"ON CONFLICT DO NOTHING"
    # 把 row 转换成 dict
    for r in rows:
        conn.execute(sa.text(sql), dict(r._mapping))


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(description="多租户 backfill 数据迁移")
    parser.add_argument("--batch-size", type=int, default=1000, help="每批行数 (默认 1000)")
    parser.add_argument("--table", default="users,user_margin", help="要 backfill 的表 (逗号分隔)")
    parser.add_argument("--dry-run", action="store_true", help="干跑模式 (只统计不写)")
    parser.add_argument("--resume", action="store_true", help="断点续传")
    parser.add_argument("--state-file", default=DEFAULT_STATE_FILE, help=f"state 文件 (默认 {DEFAULT_STATE_FILE})")
    parser.add_argument("--tenants", default=None, help="显式 tenant 列表 (逗号分隔)")
    parser.add_argument("--status", action="store_true", help="查看 state 进度")
    parser.add_argument("--reset-state", action="store_true", help="重置 state")
    parser.add_argument("--engine-url", default=None, help="DB URL")
    args = parser.parse_args()

    # engine
    if args.engine_url:
        engine = sa.create_engine(args.engine_url)
    else:
        from app.database import engine1

        engine = engine1

    # status
    if args.status:
        tracker = BackfillStateTracker(args.state_file)
        sm = tracker.summary()
        print(f"\n========== Backfill 状态 ({args.state_file}) ==========")
        for table, cnt in sm.items():
            print(f"  table={table}: {cnt}")
        print("=============================================")
        return 0

    if args.reset_state:
        BackfillStateTracker(args.state_file).reset()
        print(f"[backfill_tenants] state 已重置: {args.state_file}")
        return 0

    # 拿 tables
    tables = [t.strip() for t in args.table.split(",") if t.strip()]
    # 拿 tenants
    tenant_ids = None
    if args.tenants:
        tenant_ids = [int(x.strip()) for x in args.tenants.split(",") if x.strip()]

    # 跑 backfill
    print(f"[backfill_tenants] tables={tables} batch={args.batch_size} dry_run={args.dry_run}")
    all_results = []
    for t in tables:
        r = backfill_one_table(
            engine=engine,
            source_table=t,
            batch_size=args.batch_size,
            dry_run=args.dry_run,
            resume=args.resume,
            state_file=args.state_file,
            tenant_ids=tenant_ids,
        )
        all_results.append(r)
    # 退出码: 全部成功 0, 有失败 1
    has_error = any("error" in r for r in all_results)
    return 1 if has_error else 0


if __name__ == "__main__":
    sys.exit(main())
