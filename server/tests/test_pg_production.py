"""PostgreSQL 生产化验证脚本.

验证内容:
1. docker-compose.yml PostgreSQL 配置正确性 (无 MySQL 残留)
2. 模型 BigInteger 主键跨方言兼容性统计
3. Alembic 迁移链完整性
4. 应用配置中的数据库连接字符串正确性
5. Helm/部署文件中的 PostgreSQL 配置
"""
import os
import re

from pathlib import Path
_ROOT = Path(__file__).resolve().parent.parent
SERVER = str(_ROOT)
CLIENT = str(_ROOT.parent / "client")


def run_all_checks() -> list:
    """执行所有 PostgreSQL 生产化检查, 返回 (name, ok, detail) 列表."""
    results = []

    def check(name: str, ok: bool, detail: str = ""):
        status = "PASS" if ok else "FAIL"
        results.append((name, ok, detail))
        print(f"  [{status}] {name}: {detail}")

    print("=== 1. docker-compose.yml PostgreSQL 配置 ===")
    compose = os.path.join(SERVER, "deploy", "docker", "docker-compose.yml")
    if os.path.exists(compose):
        with open(compose, encoding="utf-8") as f:
            content = f.read()
        has_pg = "postgres:14" in content
        has_mysql = bool(re.search(r"mysql|mariadb|3306", content, re.IGNORECASE))
        has_pg_exporter = "postgres-exporter" in content
        has_pg_url = "postgresql+psycopg2" in content
        check("postgres_image", has_pg, "postgres:14-alpine")
        check("no_mysql_residue", not has_mysql, "无 MySQL/MariaDB 引用")
        check("postgres_exporter", has_pg_exporter, "prometheuscommunity/postgres-exporter")
        check("pg_connection_url", has_pg_url, "postgresql+psycopg2 连接字符串")
    else:
        check("docker_compose_exists", False, "文件不存在")

    print("\n=== 2. 模型 BigInteger 主键跨方言兼容性 ===")
    models_dir = os.path.join(SERVER, "app", "models")
    total_pk = 0
    variant_pk = 0
    direct_bigint_autoincrement = 0
    direct_bigint_composite = 0
    files_with_direct_bigint = []

    for dirpath, _, files in os.walk(models_dir):
        for f in files:
            if not f.endswith(".py"):
                continue
            path = os.path.join(dirpath, f)
            with open(path, encoding="utf-8") as fp:
                content = fp.read()
            code_lines = []
            in_docstring = False
            for l in content.split("\n"):
                stripped = l.strip()
                if stripped.startswith("#"):
                    continue
                if '"""' in stripped:
                    in_docstring = not in_docstring
                    continue
                if in_docstring:
                    continue
                code_lines.append(l)
            code_content = "\n".join(code_lines)
            auto_matches = re.findall(r"Column\(BigInteger,\s*primary_key=True,\s*autoincrement=True", code_content)
            if auto_matches:
                direct_bigint_autoincrement += len(auto_matches)
                files_with_direct_bigint.append(os.path.basename(path))
            composite_matches = re.findall(r"Column\(BigInteger,\s*primary_key=True\)", content)
            direct_bigint_composite += len(composite_matches)
            variant_matches = re.findall(r"with_variant\(BigInteger", content)
            variant_pk += len(variant_matches)
            total_pk += len(auto_matches) + len(variant_matches)

    check("id_column_factory_exists", variant_pk > 0, f"{variant_pk} 处使用 with_variant(BigInteger)")
    check("direct_bigint_autoincrement", direct_bigint_autoincrement == 0, f"{direct_bigint_autoincrement} 处直接用 BigInteger+autoincrement (SQLite 不兼容)")
    if direct_bigint_composite > 0:
        print(f"    [INFO] {direct_bigint_composite} 处联合主键用 BigInteger (允许, 无 autoincrement)")
    if files_with_direct_bigint:
        print(f"    涉及文件: {', '.join(files_with_direct_bigint[:10])}{'...' if len(files_with_direct_bigint) > 10 else ''}")

    print("\n=== 3. Alembic 迁移链完整性 ===")
    versions_dir = os.path.join(SERVER, "alembic", "versions")
    if os.path.exists(versions_dir):
        migration_files = [f for f in os.listdir(versions_dir) if f.endswith(".py") and not f.startswith("__")]
        has_008 = any("008" in f for f in migration_files)
        check("migration_files_count", len(migration_files) >= 8, f"{len(migration_files)} 个迁移文件")
        check("008_missing_tables", has_008, "008_add_missing_tables.py 存在")
    else:
        check("versions_dir_exists", False, "alembic/versions 目录不存在")

    print("\n=== 4. 应用配置数据库连接字符串 ===")
    config_files = [
        os.path.join(SERVER, "app", "config.py"),
        os.path.join(SERVER, "app", "database.py"),
        os.path.join(SERVER, ".env.example"),
    ]
    for cf in config_files:
        if not os.path.exists(cf):
            continue
        with open(cf, encoding="utf-8") as f:
            content = f.read()
        has_pg = "postgresql" in content.lower()
        code_lines = [l for l in content.split("\n") if not l.strip().startswith("#")]
        code_content = "\n".join(code_lines)
        has_mysql = bool(re.search(r"mysql|pymysql|aiomysql", code_content, re.IGNORECASE))
        rel = os.path.relpath(cf, SERVER)
        check(f"{rel}_pg_config", has_pg, "包含 postgresql 配置")
        check(f"{rel}_no_mysql", not has_mysql, "无 MySQL 引用")

    print("\n=== 5. Helm/部署文件 PostgreSQL 配置 ===")
    helm_paths = [
        str(_ROOT.parent / "deploy" / "helm"),
        str(_ROOT.parent / "helm"),
        str(_ROOT / "deploy"),
    ]
    helm_found = False
    for hp in helm_paths:
        if os.path.exists(hp):
            helm_found = True
            for dirpath, _, files in os.walk(hp):
                for f in files:
                    if f.endswith((".yaml", ".yml", ".tpl")):
                        path = os.path.join(dirpath, f)
                        with open(path, encoding="utf-8") as fp:
                            content = fp.read()
                        if "pg-" in content or "postgres" in content.lower():
                            has_mysql = bool(re.search(r"mysql|mariadb|3306", content, re.IGNORECASE))
                            rel = os.path.relpath(path, hp)
                            check(f"helm_{rel}", not has_mysql, "PostgreSQL 配置, 无 MySQL")
    if not helm_found:
        check("helm_dir_exists", False, "未找到 Helm 部署目录")

    print("\n=== 6. backup 脚本验证 ===")
    backup_scripts = [
        os.path.join(SERVER, "scripts", "backup_all.sh"),
        os.path.join(SERVER, "scripts", "backup_pg.sh"),
    ]
    for bs in backup_scripts:
        if os.path.exists(bs):
            with open(bs, encoding="utf-8") as f:
                content = f.read()
            calls_pg = "backup_pg.sh" in content
            calls_mysql = "backup_mysql.sh" in content
            rel = os.path.basename(bs)
            check(f"{rel}_calls_pg", calls_pg or "pg_dump" in content, "调用 PostgreSQL 备份")
            check(f"{rel}_no_mysql", not calls_mysql, "不调用 MySQL 备份")

    print("\n=== 7. requirements.txt 依赖验证 ===")
    req_path = os.path.join(SERVER, "requirements.txt")
    if os.path.exists(req_path):
        with open(req_path, encoding="utf-8") as f:
            content = f.read()
        has_psycopg2 = "psycopg2" in content
        has_pymysql = "pymysql" in content.lower() or "aiomysql" in content.lower()
        check("psycopg2_dep", has_psycopg2, "psycopg2 依赖存在")
        check("no_pymysql_dep", not has_pymysql, "无 PyMySQL/aiomysql 依赖")

    print("\n" + "=" * 60)
    passed = sum(1 for _, ok, _ in results if ok)
    failed = sum(1 for _, ok, _ in results if not ok)
    print(f"总计: {passed} PASS, {failed} FAIL")
    print("=" * 60)

    return results


def test_pg_production_checks():
    """pytest 入口: 所有检查项必须全部 PASS."""
    results = run_all_checks()
    failed = [name for name, ok, _ in results if not ok]
    assert not failed, f"PostgreSQL 生产化检查失败项: {failed}"


if __name__ == "__main__":
    import sys
    results = run_all_checks()
    failed = sum(1 for _, ok, _ in results if not ok)
    sys.exit(0 if failed == 0 else 1)
