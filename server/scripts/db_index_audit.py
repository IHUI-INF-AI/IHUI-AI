"""数据库索引审计脚本.

扫描 SQLAlchemy models, 检查:
1. 是否有 __table_args__ index/UniqueConstraint
2. 外键列是否有索引
3. 高频查询字段 (status, create_by, del_flag) 是否有索引
4. 输出缺失索引建议 + Markdown 报告

用法:
    python scripts/db_index_audit.py
    python scripts/db_index_audit.py --report docs/INDEX_AUDIT.md
"""
import argparse
import sys
from pathlib import Path
from typing import Dict, List, Tuple

# 默认审计的核心表
HIGH_FREQ_FIELDS = {"status", "create_by", "update_by", "del_flag", "tenant_id", "user_id", "parent_id"}


def collect_models():
    """动态导入所有 models, 返回 [(model_class, table_name)]."""
    # 触发所有 model 模块的 import (在 conftest 之前), 单个失败不影响其它
    models_dir = Path("app/models")
    for m in sorted(models_dir.glob("*.py")):
        if m.stem.startswith("_"):
            continue
        try:
            __import__(f"app.models.{m.stem}")
        except Exception as ex:
            print(f"  跳过 {m.stem}: {ex}", file=sys.stderr)

    try:
        from app.database import Base

        results = []
        for cls in Base.registry.mappers:
            try:
                table = cls.local_table
            except Exception:
                continue
            if table is None:
                continue
            results.append((cls.class_, table.name))
        return results
    except Exception as e:
        print(f"WARN 无法从 Base.registry 读取: {e}", file=sys.stderr)
        return []


def audit_indexes(model_cls, table_name: str) -> Dict[str, List[str]]:
    """审计单个 model 的索引.

    Returns:
        {
            "existing": [...],      # 已存在的索引
            "missing": [...],       # 建议添加的索引 (外键/高频字段)
        }
    """
    try:
        table = model_cls.__table__
    except AttributeError:
        return {"existing": [], "missing": []}

    existing_indexes = set()
    for idx in table.indexes:
        for col in idx.columns:
            existing_indexes.add(col.name)
    for col in table.columns:
        if col.primary_key:
            existing_indexes.add(col.name)
    for uc in getattr(table, "constraints", []):
        if hasattr(uc, "columns"):
            for col in uc.columns:
                existing_indexes.add(col.name)

    missing = []
    for col in table.columns:
        # 外键必须有索引
        if col.foreign_keys and col.name not in existing_indexes:
            missing.append(f"FK: {col.name} (类型={col.type})")
            continue
        # 高频字段必须有索引
        if col.name in HIGH_FREQ_FIELDS and col.name not in existing_indexes:
            missing.append(f"HIGH_FREQ: {col.name} (类型={col.type})")

    return {
        "existing": sorted(existing_indexes),
        "missing": missing,
    }


def main():
    parser = argparse.ArgumentParser(description="数据库索引审计")
    parser.add_argument("--report", help="输出 Markdown 报告路径")
    args = parser.parse_args()

    models = collect_models()
    if not models:
        print("未发现 model, 请在 app/ 目录下运行")
        sys.exit(1)

    total = len(models)
    with_missing = 0
    total_missing = 0
    md = ["# 数据库索引审计报告", "", f"扫描 {total} 张表", ""]

    rows: List[Tuple[str, List[str], List[str]]] = []
    for cls, tname in sorted(models, key=lambda x: x[1]):
        result = audit_indexes(cls, tname)
        if result["missing"]:
            with_missing += 1
            total_missing += len(result["missing"])
        rows.append((tname, result["existing"], result["missing"]))

    md.append(f"## 摘要\n")
    md.append(f"- 总表数: **{total}**")
    md.append(f"- 有缺失索引: **{with_missing}**")
    md.append(f"- 缺失索引总数: **{total_missing}**\n")

    md.append("## 详细报告\n")
    md.append("| 表名 | 已有索引 | 缺失索引 |")
    md.append("|------|---------|---------|")
    for tname, existing, missing in rows:
        existing_str = ", ".join(existing[:5]) + ("..." if len(existing) > 5 else "")
        missing_str = "<br/>".join(missing) if missing else "✓"
        md.append(f"| `{tname}` | {existing_str} | {missing_str} |")

    md.append("\n## 修复建议\n")
    md.append("为每个缺失字段在 model __table_args__ 中添加 Index:")
    md.append("```python")
    md.append("__table_args__ = (")
    md.append("    Index('ix_table_status', 'status'),")
    md.append("    Index('ix_table_user_id', 'user_id'),")
    md.append(")")
    md.append("```")

    report = "\n".join(md)
    print(f"\n审计完成: {total} 张表, {with_missing} 张缺失索引, 共 {total_missing} 个缺失")
    if with_missing > 0:
        print("\n缺失索引 Top 10:")
        for tname, _, missing in sorted(rows, key=lambda x: -len(x[2]))[:10]:
            print(f"  - {tname}: {len(missing)} 处缺失")

    if args.report:
        Path(args.report).parent.mkdir(parents=True, exist_ok=True)
        Path(args.report).write_text(report, encoding="utf-8")
        print(f"\n报告已写入: {args.report}")

    # 非零退出码: 有缺失 (CI 可检查)
    sys.exit(1 if with_missing > 0 else 0)


if __name__ == "__main__":
    main()
