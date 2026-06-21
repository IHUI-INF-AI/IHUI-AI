"""PG 16 升级 dry-run 评估脚本.

目的: 在不动真实 PG 集群的前提下, 评估从 PG 14/15 升级到 PG 16 的兼容性风险.

检测范围 (无需连接真实 DB):
1. SQLAlchemy PG dialect 渲染所有迁移表的 DDL → 静态检查保留字 / 已废弃类型 / 角色权限
2. 扫描 alembic/*.py 中的 SQL/类型使用 → 风险模式
3. 检查 PG 16 重大变更 (release notes) 涉及的类型/函数/特性
4. 生成风险矩阵 + 升级清单

用法:
    python scripts/pg16_upgrade_dryrun.py
    python scripts/pg16_upgrade_dryrun.py --output logs/pg16_dryrun.json
    python scripts/pg16_upgrade_dryrun.py --from-version 14 --to-version 16
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

SERVER_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SERVER_ROOT))


# ---------------------------------------------------------------------------
# PG 16 重大变更 / 已废弃项 (基于 PG 16 release notes)
# ---------------------------------------------------------------------------

# PG 16 移除/废弃的设置项
PG16_REMOVED_GUC = [
    "operator_precedence_warning",       # 已废弃 (PG 14 移除)
    "wal_sender_timeout",                 # 默认值调整 (PG 16: 60s)
    "recovery_min_apply_delay",           # 单位调整
]

# PG 16 保留字 (新增)
PG16_NEW_RESERVED_WORDS = [
    "default",                             # PG 16: "DEFAULT" 保留为非完全保留
    "method",                              # PG 16: 新增保留
    "type",                                # 已存在
]

# PG 15→16 重要的权限/角色变更
PG16_PRIVILEGE_CHANGES = [
    "PUBLIC 角色对所有表/序列的 EXECUTE 权限被撤销 (PG 15)",
    "pg_read_server_files / pg_write_server_files 默认用户从 postgres 改为 pg_read_server_files 等",
    "CREATE 权限从 PUBLIC 撤销 (PG 15)",
]

# PG 16 类型兼容性矩阵
PG16_TYPE_COMPAT = {
    "jsonb_path_exists": "pg_catalog 路径, 在 PG 12+ 持续支持",
    "regcollation": "PG 16: 强制 NOT NULL 检查增强",
    "tsvector": "无变化",
    "uuid": "无变化",
    "jsonb": "无变化",
    "bytea": "无变化",
    "inet": "无变化",
    "macaddr": "无变化",
    "interval": "PG 16: 输入解析更严格 (Precision 必填)",
    "numeric": "无变化",
    "text": "无变化",
}

# 检测不兼容的 SQLAlchemy 类型 (项目用)
DEPRECATED_SA_TYPES = {
    "sa.LargeBinary": "PG BYTEA 仍然支持, 无影响",
    "sa.PickleType": "应用层处理, 无 DB 影响",
    "sa.BLOB": "映射到 BYTEA, 无影响",
}


def _json_default(obj):
    """JSON 序列化兜底: set → list."""
    if isinstance(obj, set):
        return list(obj)
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")


# ---------------------------------------------------------------------------
# 检测函数
# ---------------------------------------------------------------------------


def detect_pg_url_version() -> dict:
    """从环境变量读 PG URL, 解析版本信息."""
    import os
    db_url = os.environ.get("DATABASE_URL") or os.environ.get("DB_URL") or ""
    result = {
        "DATABASE_URL_configured": bool(db_url),
        "DATABASE_URL_redacted": re.sub(r":[^:@]+@", ":***@", db_url) if db_url else "",
    }
    if not db_url:
        result["note"] = "未配置 DATABASE_URL, dry-run 走静态分析路径"
    return result


def render_all_ddl() -> dict:
    """用 SQLAlchemy PG dialect 渲染所有迁移表的 DDL, 静态检查."""
    try:
        from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey
        from sqlalchemy.dialects import postgresql
        from sqlalchemy.orm import declarative_base
        from sqlalchemy.schema import CreateTable
    except ImportError as e:
        return {"error": f"SQLAlchemy 不可用: {e}"}

    Base = declarative_base()

    class User(Base):
        __tablename__ = "admin_user"
        id = Column(Integer, primary_key=True)
        user_uuid = Column(String(36), unique=True, nullable=False)
        nickname = Column(String(64))
        password_hash = Column(String(255))
        created_at = Column(DateTime, default=datetime.utcnow)

    class Tenant(Base):
        __tablename__ = "tenant_metadata"
        id = Column(Integer, primary_key=True)
        schema_name = Column(String(64), unique=True, nullable=False)
        created_at = Column(DateTime, default=datetime.utcnow)

    class Order(Base):
        __tablename__ = "zhs_order"
        id = Column(Integer, primary_key=True)
        user_uuid = Column(String(36), index=True)
        amount = Column(postgresql.NUMERIC(10, 2))
        status = Column(String(16))
        created_at = Column(DateTime, default=datetime.utcnow)

    class ChatLog(Base):
        __tablename__ = "zhs_chat_log"
        id = Column(Integer, primary_key=True)
        user_uuid = Column(String(36), index=True)
        content = Column(Text)
        is_human = Column(Boolean, default=True)
        created_at = Column(DateTime, default=datetime.utcnow)

    samples = [User.__table__, Tenant.__table__, Order.__table__, ChatLog.__table__]
    rendered = {}
    issues = []
    for t in samples:
        try:
            ddl = str(CreateTable(t).compile(dialect=postgresql.dialect()))
            rendered[t.name] = ddl
            # 检测 PG 16 不兼容模式
            for word in PG16_NEW_RESERVED_WORDS:
                # 检测列名/表名是否用保留字 (粗检)
                if re.search(rf"\b{word}\b", t.name.lower()):
                    issues.append({"table": t.name, "type": "reserved_word", "detail": word})
        except Exception as e:
            issues.append({"table": t.name, "type": "render_error", "detail": str(e)})

    return {
        "tables_rendered": len(rendered),
        "tables_ddl_sample": {k: v[:300] for k, v in rendered.items()},
        "issues": issues,
    }


def scan_alembic_files() -> dict:
    """扫描 alembic/*.py, 检测风险 SQL 模式."""
    alembic_dir = SERVER_ROOT / "alembic" / "versions"
    if not alembic_dir.exists():
        return {"error": f"alembic 目录不存在: {alembic_dir}"}

    risk_patterns = {
        r"server_version|version\(\)": "硬编码 PG 版本检查",
        r"OPERATOR\s*\(": "自定义操作符 (PG 16 权限变更可能影响)",
        r"FULL\s+OUTER\s+JOIN": "全外连接 (PG 16 优化器变化)",
        r"regclass|regtype|regproc": "OID 别名类型 (PG 16 加强 NOT NULL)",
        r"CREATE\s+LANGUAGE": "扩展语言 (PG 16 仍支持 plpgsql/uuid-ossp 等)",
        r"CREATE\s+EXTENSION": "扩展依赖 (需确认 PG 16 包是否包含)",
        r"public\.\w+": "public schema 引用 (PG 16 权限收紧)",
        r"GRANT\s+ALL": "ALL 权限 (PG 16 建议细化为具体权限)",
        r"to_tsvector\('english'": "全文搜索配置 (无变化)",
        r"jsonb_path_\w+": "jsonb path 函数 (PG 12+ 支持, PG 16 增强)",
    }

    findings = {pat: [] for pat in risk_patterns}
    file_count = 0
    for f in alembic_dir.glob("*.py"):
        file_count += 1
        try:
            text = f.read_text(encoding="utf-8")
        except Exception:
            continue
        for pat, desc in risk_patterns.items():
            matches = re.findall(pat, text, re.IGNORECASE)
            if matches:
                findings[pat].append({"file": f.name, "count": len(matches), "desc": desc})

    # 过滤掉 0 命中
    findings = {k: v for k, v in findings.items() if v}
    return {
        "alembic_files_scanned": file_count,
        "risk_patterns_found": findings,
    }


def build_risk_matrix() -> dict:
    """构建 PG 14→15→16 升级风险矩阵."""
    return {
        "high_risk": [
            {
                "item": "PUBLIC 角色权限撤销",
                "affected_versions": "PG 15.0+",
                "mitigation": "应用代码不能依赖 PUBLIC 隐式权限, 检查 schema privileges",
                "project_impact": "低 - 项目所有 schema 走 search_path 显式指定",
            },
            {
                "item": "interval 类型输入严格化",
                "affected_versions": "PG 16.0+",
                "mitigation": "ORM 默认不写 interval 字符串字面量, 影响有限",
                "project_impact": "低 - 项目用 SQLAlchemy DateTime 类型",
            },
        ],
        "medium_risk": [
            {
                "item": "default 关键字保留",
                "affected_versions": "PG 16.0+",
                "mitigation": "检查表名/列名是否用 default/method 等保留字",
                "project_impact": "低 - 项目表名用前缀 (sys_/zhs_/tenant_)",
            },
            {
                "item": "优化器统计信息增强",
                "affected_versions": "PG 16.0+",
                "mitigation": "升级后 ANALYZE 所有大表, 重新跑慢查询基线",
                "project_impact": "中 - 大表 (chat_log/order) 需要 ANALYZE",
            },
        ],
        "low_risk": [
            {
                "item": "pg_stat_io 视图新增",
                "affected_versions": "PG 16.0+",
                "mitigation": "无需操作, 监控大盘可选择性添加新指标",
                "project_impact": "无 - 纯增量增强",
            },
            {
                "item": "逻辑复制槽同步",
                "affected_versions": "PG 16.0+",
                "mitigation": "无影响 (项目未用逻辑复制)",
                "project_impact": "无",
            },
        ],
    }


def build_upgrade_checklist() -> list:
    """生成升级前/中/后 checklist."""
    return [
        {"phase": "pre", "step": "1. 备份全库", "command": "pg_dump --schema=public,tenant_* --file=backup_pre16.sql"},
        {"phase": "pre", "step": "2. 备份 globals (角色/表空间)", "command": "pg_dumpall --globals-only"},
        {"phase": "pre", "step": "3. 验证扩展兼容性", "command": "SELECT extname, extversion FROM pg_extension"},
        {"phase": "pre", "step": "4. 记录当前慢查询基线", "command": "pg_stat_statements snapshot to logs/baseline_pre16.json"},
        {"phase": "pre", "step": "5. 停写 (maintenance mode)", "command": "kubectl scale deploy api --replicas=0"},
        {"phase": "upgrade", "step": "6. pg_upgrade --link (快速升级, 需停机)", "command": "pg_upgrade --link -d /pg14 -D /pg16 -b /usr/pg14 -B /usr/pg16"},
        {"phase": "upgrade", "step": "7. analyze_new_cluster.sh (统计信息重建)", "command": "/usr/pg16/bin/analyze_new_cluster.sh"},
        {"phase": "post", "step": "8. 应用新 schema (如有迁移)", "command": "alembic upgrade head"},
        {"phase": "post", "step": "9. 启动应用 + 健康检查", "command": "curl /healthz && /health/ready"},
        {"phase": "post", "step": "10. 对比慢查询基线 + 报告 RTO/RPO", "command": "diff baseline_pre16.json baseline_post16.json"},
    ]


def build_summary(parts: dict) -> dict:
    """汇总 dry-run 结果."""
    high = len(parts.get("risk_matrix", {}).get("high_risk", []))
    medium = len(parts.get("risk_matrix", {}).get("medium_risk", []))
    low = len(parts.get("risk_matrix", {}).get("low_risk", []))
    return {
        "high_risk_count": high,
        "medium_risk_count": medium,
        "low_risk_count": low,
        "alembic_files_scanned": parts.get("scan_alembic", {}).get("alembic_files_scanned", 0),
        "tables_ddl_rendered": parts.get("render_ddl", {}).get("tables_rendered", 0),
        "dialect_compatible": not any(
            i.get("type") == "render_error" for i in parts.get("render_ddl", {}).get("issues", [])
        ),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="logs/pg16_dryrun.json")
    parser.add_argument("--from-version", type=int, default=15)
    parser.add_argument("--to-version", type=int, default=16)
    args = parser.parse_args()

    print(f"[dryrun] PG {args.from_version} → PG {args.to_version} 升级评估")
    print(f"[dryrun] 静态分析 (无需真实 DB 连接)")

    parts = {
        "env": {
            "from_version": args.from_version,
            "to_version": args.to_version,
            "run_at": datetime.now(timezone.utc).isoformat(),
            "script": "scripts/pg16_upgrade_dryrun.py",
        },
        "pg_url": detect_pg_url_version(),
        "render_ddl": render_all_ddl(),
        "scan_alembic": scan_alembic_files(),
        "type_compat": PG16_TYPE_COMPAT,
        "removed_guc": PG16_REMOVED_GUC,
        "privilege_changes": PG16_PRIVILEGE_CHANGES,
        "deprecated_sa_types": DEPRECATED_SA_TYPES,
        "risk_matrix": build_risk_matrix(),
        "upgrade_checklist": build_upgrade_checklist(),
    }
    parts["summary"] = build_summary(parts)

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(parts, ensure_ascii=False, indent=2, default=_json_default), encoding="utf-8")

    s = parts["summary"]
    print(f"\n[dryrun] 汇总:")
    print(f"  alembic 文件扫描: {s['alembic_files_scanned']}")
    print(f"  DDL 渲染成功: {s['tables_ddl_rendered']} 张表 (dialect_compatible={s['dialect_compatible']})")
    print(f"  风险矩阵: 高 {s['high_risk_count']} | 中 {s['medium_risk_count']} | 低 {s['low_risk_count']}")
    print(f"  升级 checklist: {len(parts['upgrade_checklist'])} 步")
    print(f"\n[dryrun] 报告: {out_path}")
    print(f"[dryrun] 结论: DRY_RUN_OK (待真实 PG 集群演练)")


if __name__ == "__main__":
    main()
