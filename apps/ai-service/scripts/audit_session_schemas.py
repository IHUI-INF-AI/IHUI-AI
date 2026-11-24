# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""审计:库面上的 `sess_*` schema 都是什么、哪些是空壳。

**只读尺子,不是守门**(不接 guardian / CI;本文件刻意不写"已接线"之类的话)。

为什么需要它:`session_store` 的 schema 名此前按"库路径 sha1"派生,于是每换一次
`SESSION_STORE_DB_PATH` 就在同一个 PG 实例里多一个 `sess_<12hex>` —— 本机实测 900+ 个,
其中既有 pytest 残留,也有历史开发库。`sess_main` 落地后,机器**判不出**"哪一个旧 schema
是生产"(`_row_count` 只说明有没有行,不说明归属),所以接管只能显式指名
(`SESSION_STORE_ADOPT_LEGACY_SCHEMA`),而"要不要清掉空壳"必须有可核验的账。

判据(可机械执行,不含猜测):
  · 总行数 = `threads` + `turns` + `items` + `relay_summaries` + `rollbacks` 五张表现读求和;
    表不存在按 0 计并单独标注(缺表 ≠ 空库,但都不含数据)。
  · `--drop-empty` 只删 **总行数 0 ∧ schema 名不是 sess_main** 的 shell;带行的一律不动
    (删带行 schema = 删数据,机器没有这个权限判断)。
  · 取不到 DSN / 连不上 ⇒ exit 2 显式"未判定",不回落任何默认库。

用法:
  python scripts/audit_session_schemas.py                # 表格:每个 schema 的行数
  python scripts/audit_session_schemas.py --json         # 机读(stdout 是纯 JSON,结论行走 stderr)
  python scripts/audit_session_schemas.py --drop-empty   # 真删空壳(只删 0 行 ∧ 非 sess_main)

退出码:0 = 审计完成(有无空壳都算完成)/ 1 = 删除动作里有失败 / 2 = 未判定。
"""

from __future__ import annotations

import argparse
import json
import os
import pathlib
import re
import sys
from typing import Any, TextIO

ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

TABLES = ("threads", "turns", "items", "relay_summaries", "rollbacks")
DEFAULT_SCHEMA = "sess_main"
LEGACY_RE = re.compile(r"^sess_[0-9a-f]{12}$")


def _dsn() -> str:
    for key in ("SESSION_PG_DSN", "DATABASE_URL"):
        v = (os.environ.get(key) or "").strip()
        if v:
            return v
    env_file = ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            if line.startswith("DATABASE_URL="):
                return line.split("=", 1)[1].strip()
    return ""


def _rows(session: Any, sql: str, params: tuple[Any, ...] = ()) -> list[Any]:
    return list(session.fetchall(sql, params))


def audit(dsn: str) -> dict[str, Any]:
    from app.core.pg_sync import SyncPgSession

    session = SyncPgSession(dsn)
    try:
        names = [
            str(r["nspname"])
            for r in _rows(
                session,
                "SELECT nspname FROM pg_namespace WHERE nspname LIKE 'sess\\_%'"
                " ORDER BY nspname",
            )
        ]
        out: list[dict[str, Any]] = []
        for name in names:
            present = {
                str(r["relname"])
                for r in _rows(
                    session,
                    "SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace"
                    " WHERE n.nspname = $1 AND c.relkind = 'r'",
                    (name,),
                )
            }
            counts: dict[str, int] = {}
            for t in TABLES:
                counts[t] = (
                    int(_rows(session, f'SELECT count(*) AS c FROM "{name}"."{t}"')[0]["c"] or 0)
                    if t in present
                    else 0
                )
            total = sum(counts.values())
            out.append(
                {
                    "schema": name,
                    "total": total,
                    "counts": counts,
                    "missing_tables": [t for t in TABLES if t not in present],
                    "kind": "default" if name == DEFAULT_SCHEMA else
                    ("legacy_path" if LEGACY_RE.match(name) else "other"),
                }
            )
        return {
            "schemas": out,
            "total": len(out),
            "with_rows": sum(1 for x in out if x["total"] > 0),
            "empty": sum(1 for x in out if x["total"] == 0),
            "unknown_shape": sum(1 for x in out if x["kind"] == "other"),
        }
    finally:
        session.close()


def drop_empty(dsn: str, report: dict[str, Any]) -> tuple[list[str], list[str]]:
    from app.core.pg_sync import SyncPgSession

    dropped: list[str] = []
    failed: list[str] = []
    session = SyncPgSession(dsn)
    try:
        for item in report["schemas"]:
            if item["total"] > 0 or item["schema"] == DEFAULT_SCHEMA:
                continue
            try:
                session.execute(f'DROP SCHEMA IF EXISTS "{item["schema"]}" CASCADE')
                dropped.append(item["schema"])
            except Exception as e:  # noqa: BLE001 - 逐条记账,不因一条失败放弃整批
                failed.append(f'{item["schema"]}: {e}')
    finally:
        session.close()
    return dropped, failed


def _marker_stream(json_mode: bool) -> TextIO:
    """机读档的结论行走 stderr。

    `--json` 时 stdout 必须能被整体 `json.loads`:结论行 `SESSION-SCHEMAS-RESULT ...`
    贴在 JSON 尾巴上会变成 `Extra data: line N`(实测如此),把"能机读"的承诺弄坏。
    所以机读档把结论行改投 stderr —— 内容一个字不少,只是不再污染数据流。
    """
    return sys.stderr if json_mode else sys.stdout


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="审计 session_store 的 sess_* schema")
    ap.add_argument("--json", action="store_true", help="机读输出")
    ap.add_argument("--drop-empty", action="store_true", help="删除 0 行且非 sess_main 的 schema")
    args = ap.parse_args(argv)

    dsn = _dsn()
    if not dsn:
        print("❌ 未判定:没有 SESSION_PG_DSN / DATABASE_URL(不回落任何默认库)", file=sys.stderr)
        print(
            "SESSION-SCHEMAS-RESULT state=undetermined total=NA with_rows=NA empty=NA",
            file=_marker_stream(args.json),
        )
        return 2
    try:
        report = audit(dsn)
    except Exception as e:  # noqa: BLE001 - 连不上就是未判定
        print(f"❌ 未判定:连不上/查不动({e})", file=sys.stderr)
        print(
            "SESSION-SCHEMAS-RESULT state=undetermined total=NA with_rows=NA empty=NA",
            file=_marker_stream(args.json),
        )
        return 2

    dropped: list[str] = []
    failed: list[str] = []
    if args.drop_empty:
        dropped, failed = drop_empty(dsn, report)
        report["dropped"] = dropped
        report["failed"] = failed

    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        rows = sorted(report["schemas"], key=lambda x: (-x["total"], x["schema"]))
        print(f'{"schema":<28}{"总行":>8}{"threads":>9}{"turns":>8}{"items":>8}{"relay":>7}  形态')
        for item in rows:
            c = item["counts"]
            note = "缺表:" + ",".join(item["missing_tables"]) if item["missing_tables"] else ""
            print(
                f'{item["schema"]:<28}{item["total"]:>8}{c["threads"]:>9}{c["turns"]:>8}'
                f'{c["items"]:>8}{c["relay_summaries"]:>7}  {item["kind"]} {note}'
            )
        if args.drop_empty:
            print(f"\n已删空壳 {len(dropped)} 个;失败 {len(failed)} 个")
            for f in failed:
                print("  · " + f)
        print(
            f'\n合计 {report["total"]} 个 schema:带行 {report["with_rows"]} / 空壳 {report["empty"]}'
            f' / 非路径命名 {report["unknown_shape"]}'
        )
        cands = [x for x in sorted(report["schemas"], key=lambda x: -x["total"]) if x["total"] > 0][:3]
        if cands:
            print("\n接管候选(机器不代猜,需人工指名;令进程以该名字启动即原地改名,不搬行):")
            for x in cands:
                c = x["counts"]
                print(
                    f'  SESSION_STORE_ADOPT_LEGACY_SCHEMA={x["schema"]}'
                    f'   # {c["threads"]} threads / {x["total"]} 行'
                )
    state = "ok" if not failed else "partial"
    print(
        f"SESSION-SCHEMAS-RESULT state={state} total={report['total']} "
        f"with_rows={report['with_rows']} empty={report['empty']}"
        + (f" dropped={len(dropped)} failed={len(failed)}" if args.drop_empty else ""),
        file=_marker_stream(args.json),
    )
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
