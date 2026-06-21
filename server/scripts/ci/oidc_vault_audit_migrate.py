"""Phase 13 建议 1: OIDC Vault 审计日志 JSON → SQL 迁移工具.

目的:
  历史审计日志可能存在 JSON 文件里 (legacy), 需要迁移到 SQL 存储
  (SQLite 或 PostgreSQL). 支持:
  1. dry-run: 仅校验不写入
  2. 校验和: 源数据 SHA256 校验, 迁移后对比目标库校验
  3. 断点续传: 检测目标库 max id, 跳过已存在记录
  4. batch 写入: 大数据量分批, 默认 500 条/批
  5. 报告: 源条数/目标条数/跳过/校验和/耗时

源 JSON 格式 (任选其一):
  1. JSON 数组: [{"ts": "...", "github_sub": "...", ...}, ...]
  2. JSONL: 每行一条 {"ts": ..., ...}\n{"ts": ..., ...}
  3. 顶层 dict: {"entries": [...]}

目标 URL:
  sqlite:///path/to/audit.db
  sqlite:///:memory:
  postgresql://user:pass@host/db

用法:
  # dry-run 校验
  python oidc_vault_audit_migrate.py --src history/audit.json --dst sqlite:///tmp/new.db --dry-run

  # 正式迁移
  python oidc_vault_audit_migrate.py --src history/audit.json --dst sqlite:///tmp/new.db

  # 断点续传 (中间崩溃后可再跑, 自动跳过已存在)
  python oidc_vault_audit_migrate.py --src history/audit.json --dst postgresql://...
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
from collections.abc import Iterable
from pathlib import Path
from typing import Any


def _canonical_json(entry: dict[str, Any]) -> str:
    """规范化 JSON 串 (用于校验和)."""
    return json.dumps(
        {
            "ts": str(entry.get("ts", "")),
            "github_sub": str(entry.get("github_sub", "")),
            "provider": str(entry.get("provider", "")),
            "ttl_min": int(entry.get("ttl_min", 0) or 0),
            "client_ip": str(entry.get("client_ip", "")),
            "action": str(entry.get("action", "exchange")),
        },
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )


def checksum_entries(entries: Iterable[dict[str, Any]]) -> str:
    """对一组审计条目计算 SHA256 校验和.

    规则: 按 id 升序 (若无 id 用 ts) 后拼接规范化 JSON, SHA256 hex.
    """
    items = list(entries)
    items.sort(key=lambda e: (int(e.get("id", 0) or 0), str(e.get("ts", ""))))
    h = hashlib.sha256()
    for e in items:
        h.update(_canonical_json(e).encode("utf-8"))
        h.update(b"\n")
    return h.hexdigest()


def load_source(path: str | Path) -> list[dict[str, Any]]:
    """从 JSON/JSONL 文件加载审计条目.

    支持格式:
      1. JSON 数组: [{...}, {...}]
      2. JSONL: 每行一条 {...}
      3. 顶层 dict 含 entries 键: {"entries": [...]}
    """
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"源文件不存在: {p}")
    text = p.read_text(encoding="utf-8")
    text_stripped = text.strip()
    if not text_stripped:
        return []

    # 优先尝试 JSON 解析
    if text_stripped.startswith("["):
        data = json.loads(text_stripped)
        if not isinstance(data, list):
            raise ValueError("JSON 数组格式但根不是 list")
        return [dict(item) for item in data]

    if text_stripped.startswith("{"):
        # 可能是 dict entries 或单条记录
        try:
            data = json.loads(text_stripped)
        except json.JSONDecodeError:
            # 不是纯 JSON, 尝试 JSONL
            return _load_jsonl(text)
        if isinstance(data, dict):
            if "entries" in data and isinstance(data["entries"], list):
                return [dict(item) for item in data["entries"]]
            # 单条记录
            return [data]
        if isinstance(data, list):
            return [dict(item) for item in data]
        raise ValueError("无法识别的 JSON 结构")

    # 否则按 JSONL 解析
    return _load_jsonl(text)


def _load_jsonl(text: str) -> list[dict[str, Any]]:
    """解析 JSONL 文本 (每行一条 JSON)."""
    out: list[dict[str, Any]] = []
    for i, line in enumerate(text.splitlines(), start=1):
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError as e:
            raise ValueError(f"JSONL 第 {i} 行解析失败: {e}") from e
        if not isinstance(obj, dict):
            raise ValueError(f"JSONL 第 {i} 行不是 dict: {type(obj).__name__}")
        out.append(obj)
    return out


class Migrator:
    """审计 JSON → SQL 迁移器.

    关键设计:
      - 通过 SqlAuditStore (Phase 12 抽象层) 写入, 适配 SQLite/PostgreSQL
      - dry_run=True 时不写, 但仍计算校验和
      - batch_size: 每批写入条数, 默认 500
      - resume: 配合断点续传, 检测目标库已存在 (基于 ts+github_sub+provider 唯一组合)
    """

    def __init__(self, dst_url: str, batch_size: int = 500):
        if batch_size < 1:
            raise ValueError(f"batch_size 必须 >= 1, 实际 {batch_size}")
        self.dst_url = dst_url
        self.batch_size = batch_size
        # 延迟导入, 允许 dry-run 场景下不依赖 SQLAlchemy
        from oidc_vault_audit_sql import SqlAuditStore

        self._store_cls = SqlAuditStore

    def migrate(
        self,
        entries: list[dict[str, Any]],
        dry_run: bool = False,
        resume: bool = True,
    ) -> dict[str, Any]:
        """执行迁移, 返回报告.

        报告字段:
          source_count: 源条数
          target_count_before: 目标库迁移前条数
          target_count_after: 目标库迁移后条数
          inserted: 新插入条数
          skipped: 跳过条数 (断点续传)
          dry_run: 是否 dry-run
          source_checksum: 源 SHA256
          target_checksum_before: 目标迁移前 SHA256
          target_checksum_after: 目标迁移后 SHA256
          verify_ok: 校验是否通过
          elapsed_seconds: 耗时
          error: 错误信息 (如有)
        """
        started = time.time()
        report: dict[str, Any] = {
            "source_count": len(entries),
            "target_count_before": 0,
            "target_count_after": 0,
            "inserted": 0,
            "skipped": 0,
            "dry_run": dry_run,
            "source_checksum": "",
            "target_checksum_before": "",
            "target_checksum_after": "",
            "verify_ok": False,
            "elapsed_seconds": 0.0,
            "error": None,
        }
        try:
            report["source_checksum"] = checksum_entries(entries)

            if dry_run:
                # dry-run 不开 DB
                report["target_count_before"] = 0
                report["target_count_after"] = 0
                report["inserted"] = 0
                report["skipped"] = 0
                report["verify_ok"] = True  # dry-run 无法对比, 视为通过
                return report

            store = self._store_cls(self.dst_url)
            try:
                report["target_count_before"] = store.count()

                # 取目标已存在的指纹集合, 用于断点续传
                existing: set[tuple[str, str, str]] = set()
                if resume and report["target_count_before"] > 0:
                    for row in store.query(limit=1000000):
                        existing.add(
                            (
                                str(row.get("ts", "")),
                                str(row.get("github_sub", "")),
                                str(row.get("provider", "")),
                            )
                        )
                    report["target_checksum_before"] = checksum_entries(store.query(limit=1000000))

                # 过滤待插入
                to_insert: list[dict[str, Any]] = []
                for e in entries:
                    key = (
                        str(e.get("ts", "")),
                        str(e.get("github_sub", "")),
                        str(e.get("provider", "")),
                    )
                    if key in existing:
                        report["skipped"] += 1
                        continue
                    to_insert.append(e)

                # batch 写入
                for i in range(0, len(to_insert), self.batch_size):
                    batch = to_insert[i : i + self.batch_size]
                    ids = store.append_batch(batch)
                    report["inserted"] += len(ids)

                report["target_count_after"] = store.count()
                report["target_checksum_after"] = checksum_entries(store.query(limit=1000000))

                # 校验和对比 (源 vs 目标)
                report["verify_ok"] = report["source_checksum"] == report["target_checksum_after"]
            finally:
                store.close()
        except Exception as exc:
            report["error"] = f"{type(exc).__name__}: {exc}"
        finally:
            report["elapsed_seconds"] = round(time.time() - started, 3)
        return report


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        description="OIDC Vault 审计 JSON → SQL 迁移工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("--src", required=True, help="源 JSON/JSONL 文件路径")
    p.add_argument("--dst", required=True, help="目标 SQL URL (sqlite:///path.db 或 postgresql://...)")
    p.add_argument("--dry-run", action="store_true", help="仅校验, 不实际写入")
    p.add_argument("--batch-size", type=int, default=500, help="每批写入条数 (默认 500)")
    p.add_argument("--no-resume", action="store_true", help="禁用断点续传 (默认启用)")
    p.add_argument("--json-output", action="store_true", help="以 JSON 格式输出报告")
    args = p.parse_args(argv)

    try:
        entries = load_source(args.src)
    except Exception as e:
        print(f"[error] 加载源文件失败: {e}", file=sys.stderr)
        return 2

    migrator = Migrator(args.dst, batch_size=args.batch_size)
    report = migrator.migrate(entries, dry_run=args.dry_run, resume=not args.no_resume)

    if args.json_output:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        mode = "DRY-RUN" if args.dry_run else "MIGRATE"
        print(f"[{mode}] 源条数: {report['source_count']}")
        print(f"[{mode}] 目标迁移前: {report['target_count_before']}")
        print(f"[{mode}] 目标迁移后: {report['target_count_after']}")
        print(f"[{mode}] 插入: {report['inserted']}, 跳过: {report['skipped']}")
        print(f"[{mode}] 源校验和: {report['source_checksum'][:16]}...")
        if not args.dry_run:
            print(f"[{mode}] 目标校验和: {report['target_checksum_after'][:16]}...")
            print(f"[{mode}] 校验通过: {report['verify_ok']}")
        print(f"[{mode}] 耗时: {report['elapsed_seconds']}s")
        if report["error"]:
            print(f"[{mode}] 错误: {report['error']}", file=sys.stderr)
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
