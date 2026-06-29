"""CI workflow PostgreSQL 集成测试验证脚本.

验证内容 (10 项):
1. ci.yml integration job 使用 PostgreSQL 服务
2. ci.yml postgres 服务配置 (postgres:14 + pg_isready + 5432)
3. ci.yml psycopg2-binary 依赖
4. ci.yml PGPASSWORD 环境变量
5. ci.yml 创建 3 个测试数据库 (zhs_ai_project/center/educational_training)
6. ci.yml postgresql+psycopg2:// 连接串 (3 个 DB URL)
7. ci-fast.yml 无 MySQL 残留 + alembic_ci.py 引用正确
8. ci-nightly.yml integration job 使用 PostgreSQL
9. 全局无 MySQL 残留 (3 个 CI 文件)
10. CI workflow 引用脚本存在性验证 (alembic_ci.py / migrate_tenants.py)

用法:
  python scripts/test_ci_pg_integration.py
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORKFLOWS = ROOT / ".github" / "workflows"


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_ci_yml_pg_service() -> bool:
    """测试 ci.yml integration job 使用 PostgreSQL 服务."""
    try:
        content = _read(WORKFLOWS / "ci.yml")

        # integration job 存在
        assert "integration:" in content, "ci.yml 缺少 integration job"

        # PostgreSQL 服务
        assert "postgres:" in content, "ci.yml 缺少 postgres 服务"
        assert "image: postgres:14" in content, "ci.yml postgres 镜像非 14"
        assert "POSTGRES_USER: zhs" in content, "ci.yml 缺少 POSTGRES_USER"
        assert "POSTGRES_PASSWORD: zhs_pg_pass" in content, "ci.yml 缺少 POSTGRES_PASSWORD"
        assert "POSTGRES_DB: zhs_ai_project" in content, "ci.yml 缺少 POSTGRES_DB"
        assert "5432:5432" in content, "ci.yml 缺少 5432 端口映射"

        # 健康检查
        assert "pg_isready -U zhs" in content, "ci.yml 缺少 pg_isready 健康检查"

        print(f"  ✅ ci.yml PostgreSQL 服务配置正确 (postgres:14 + pg_isready)")
        return True
    except Exception as e:
        print(f"  ❌ ci.yml PostgreSQL 服务验证失败: {e}")
        return False


def test_ci_yml_pg_deps() -> bool:
    """测试 ci.yml psycopg2-binary 依赖."""
    try:
        content = _read(WORKFLOWS / "ci.yml")

        # psycopg2-binary 依赖
        assert "psycopg2-binary" in content, "ci.yml 缺少 psycopg2-binary 依赖"

        # 不应有 pymysql
        assert "pymysql" not in content, "ci.yml 仍有 pymysql 引用"
        assert "aiomysql" not in content, "ci.yml 仍有 aiomysql 引用"

        # cryptography 依赖 (JWT)
        assert "cryptography" in content, "ci.yml 缺少 cryptography 依赖"

        print(f"  ✅ ci.yml Python 依赖正确 (psycopg2-binary + cryptography, 无 pymysql)")
        return True
    except Exception as e:
        print(f"  ❌ ci.yml 依赖验证失败: {e}")
        return False


def test_ci_yml_pg_password_env() -> bool:
    """测试 ci.yml PGPASSWORD 环境变量."""
    try:
        content = _read(WORKFLOWS / "ci.yml")

        # PGPASSWORD 环境变量
        assert "PGPASSWORD: zhs_pg_pass" in content, "ci.yml 缺少 PGPASSWORD 环境变量"

        # psql 命令使用
        assert "psql -h 127.0.0.1 -U zhs" in content, "ci.yml 缺少 psql 命令"

        print(f"  ✅ ci.yml PGPASSWORD 环境变量正确 (psql 命令可用)")
        return True
    except Exception as e:
        print(f"  ❌ ci.yml PGPASSWORD 验证失败: {e}")
        return False


def test_ci_yml_create_databases() -> bool:
    """测试 ci.yml 创建 3 个测试数据库."""
    try:
        content = _read(WORKFLOWS / "ci.yml")

        # 3 个数据库
        assert "CREATE DATABASE zhs_ai_project" in content, "ci.yml 缺少创建 zhs_ai_project"
        assert "CREATE DATABASE zhs_center_project" in content, "ci.yml 缺少创建 zhs_center_project"
        assert "CREATE DATABASE zhs_educational_training" in content, \
            "ci.yml 缺少创建 zhs_educational_training"

        print(f"  ✅ ci.yml 创建 3 个测试数据库 (ai/center/educational_training)")
        return True
    except Exception as e:
        print(f"  ❌ ci.yml 创建数据库验证失败: {e}")
        return False


def test_ci_yml_db_urls() -> bool:
    """测试 ci.yml postgresql+psycopg2:// 连接串."""
    try:
        content = _read(WORKFLOWS / "ci.yml")

        # 3 个 DB URL
        assert "DB1_URL: postgresql+psycopg2://zhs:zhs_pg_pass@127.0.0.1:5432/zhs_ai_project" in content, \
            "ci.yml DB1_URL 错误"
        assert "DB2_URL: postgresql+psycopg2://zhs:zhs_pg_pass@127.0.0.1:5432/zhs_center_project" in content, \
            "ci.yml DB2_URL 错误"
        assert "DB3_URL: postgresql+psycopg2://zhs:zhs_pg_pass@127.0.0.1:5432/zhs_educational_training" in content, \
            "ci.yml DB3_URL 错误"

        # 不应有 mysql 连接串
        assert "mysql+pymysql" not in content, "ci.yml 仍有 mysql+pymysql 连接串"
        assert "mysql+aiomysql" not in content, "ci.yml 仍有 mysql+aiomysql 连接串"
        assert "3306" not in content, "ci.yml 仍有 3306 端口"

        print(f"  ✅ ci.yml DB URL 正确 (3 个 postgresql+psycopg2:// 连接串)")
        return True
    except Exception as e:
        print(f"  ❌ ci.yml DB URL 验证失败: {e}")
        return False


def test_ci_fast_no_mysql() -> bool:
    """测试 ci-fast.yml 无 MySQL 残留 + alembic_ci.py 引用正确."""
    try:
        content = _read(WORKFLOWS / "ci-fast.yml")

        # 不应有 MySQL
        lower = content.lower()
        assert "mysql" not in lower, "ci-fast.yml 仍有 mysql 引用"
        assert "mariadb" not in lower, "ci-fast.yml 仍有 mariadb 引用"
        assert "pymysql" not in content, "ci-fast.yml 仍有 pymysql 引用"
        assert "aiomysql" not in content, "ci-fast.yml 仍有 aiomysql 引用"
        assert "mysqld-exporter" not in lower, "ci-fast.yml 仍有 mysqld-exporter"
        assert "3306" not in content, "ci-fast.yml 仍有 3306 端口"

        # alembic_ci.py 引用 (不是 alembic_ci_mysql.py)
        assert "alembic_ci.py" in content, "ci-fast.yml 缺少 alembic_ci.py 引用"
        assert "alembic_ci_mysql.py" not in content, \
            "ci-fast.yml 仍引用 alembic_ci_mysql.py (不存在)"

        print(f"  ✅ ci-fast.yml 无 MySQL 残留 + alembic_ci.py 引用正确")
        return True
    except Exception as e:
        print(f"  ❌ ci-fast.yml 验证失败: {e}")
        return False


def test_ci_nightly_pg_integration() -> bool:
    """测试 ci-nightly.yml integration job 使用 PostgreSQL."""
    try:
        content = _read(WORKFLOWS / "ci-nightly.yml")

        # PostgreSQL 服务
        assert "image: postgres:14" in content, "ci-nightly.yml postgres 镜像非 14"
        assert "POSTGRES_USER: zhs" in content, "ci-nightly.yml 缺少 POSTGRES_USER"
        assert "POSTGRES_PASSWORD: zhs_pg_pass" in content, "ci-nightly.yml 缺少 POSTGRES_PASSWORD"
        assert "pg_isready -U zhs" in content, "ci-nightly.yml 缺少 pg_isready"

        # psycopg2-binary 依赖
        assert "psycopg2-binary" in content, "ci-nightly.yml 缺少 psycopg2-binary"

        # 3 个 DB URL
        assert "postgresql+psycopg2://zhs:zhs_pg_pass@127.0.0.1:5432/zhs_ai_project" in content, \
            "ci-nightly.yml DB1_URL 错误"
        assert "postgresql+psycopg2://zhs:zhs_pg_pass@127.0.0.1:5432/zhs_center_project" in content, \
            "ci-nightly.yml DB2_URL 错误"
        assert "postgresql+psycopg2://zhs:zhs_pg_pass@127.0.0.1:5432/zhs_educational_training" in content, \
            "ci-nightly.yml DB3_URL 错误"

        # 不应有 MySQL
        lower = content.lower()
        assert "mysql" not in lower, "ci-nightly.yml 仍有 mysql 引用"
        assert "mariadb" not in lower, "ci-nightly.yml 仍有 mariadb 引用"
        assert "3306" not in content, "ci-nightly.yml 仍有 3306 端口"

        print(f"  ✅ ci-nightly.yml PostgreSQL 集成测试配置正确")
        return True
    except Exception as e:
        print(f"  ❌ ci-nightly.yml 验证失败: {e}")
        return False


def test_no_mysql_global() -> bool:
    """验证 3 个 CI 文件全局无 MySQL 残留."""
    try:
        files = ["ci.yml", "ci-fast.yml", "ci-nightly.yml"]
        for fname in files:
            content = _read(WORKFLOWS / fname)
            lower = content.lower()
            assert "mysql" not in lower, f"{fname} 仍有 mysql 引用"
            assert "mariadb" not in lower, f"{fname} 仍有 mariadb 引用"
            assert "pymysql" not in content, f"{fname} 仍有 pymysql 引用"
            assert "aiomysql" not in content, f"{fname} 仍有 aiomysql 引用"
            assert "mysqld-exporter" not in lower, f"{fname} 仍有 mysqld-exporter"
            assert "3306" not in content, f"{fname} 仍有 3306 端口"

        print(f"  ✅ 3 个 CI 文件全局无 MySQL 残留")
        return True
    except Exception as e:
        print(f"  ❌ 全局 MySQL 残留检查失败: {e}")
        return False


def test_referenced_scripts_exist() -> bool:
    """验证 CI 引用的脚本存在."""
    try:
        ci_content = _read(WORKFLOWS / "ci.yml")
        ci_fast_content = _read(WORKFLOWS / "ci-fast.yml")

        # alembic_ci.py
        alembic_ci = ROOT / "scripts" / "ci" / "alembic_ci.py"
        assert alembic_ci.exists(), "scripts/ci/alembic_ci.py 不存在"

        # migrate_tenants.py
        migrate_tenants = ROOT / "scripts" / "ci" / "migrate_tenants.py"
        assert migrate_tenants.exists(), "scripts/ci/migrate_tenants.py 不存在"

        # migrate_tenant_dryrun.py
        migrate_dryrun = ROOT / "scripts" / "ci" / "migrate_tenant_dryrun.py"
        assert migrate_dryrun.exists(), "scripts/ci/migrate_tenant_dryrun.py 不存在"

        # alembic_autogen.py
        alembic_autogen = ROOT / "scripts" / "alembic_autogen.py"
        assert alembic_autogen.exists(), "scripts/alembic_autogen.py 不存在"

        # check_alert_rules.py
        check_alerts = ROOT / "scripts" / "ci" / "check_alert_rules.py"
        assert check_alerts.exists(), "scripts/ci/check_alert_rules.py 不存在"

        # 不应存在 alembic_ci_mysql.py
        alembic_mysql = ROOT / "scripts" / "ci" / "alembic_ci_mysql.py"
        assert not alembic_mysql.exists(), "scripts/ci/alembic_ci_mysql.py 不应存在"

        print(f"  ✅ CI 引用脚本全部存在 (alembic_ci/migrate_tenants/check_alert_rules 等)")
        return True
    except Exception as e:
        print(f"  ❌ 引用脚本验证失败: {e}")
        return False


def test_ci_yml_alembic_step() -> bool:
    """测试 ci.yml Alembic 迁移步骤使用 PostgreSQL."""
    try:
        content = _read(WORKFLOWS / "ci.yml")

        # Apply alembic migrations 步骤
        assert "Apply alembic migrations" in content, "ci.yml 缺少 Alembic 迁移步骤"
        assert "PGPASSWORD: zhs_pg_pass" in content, "ci.yml Alembic 步骤缺少 PGPASSWORD"

        # psql 应用 SQL
        assert "psql -h 127.0.0.1 -U zhs -d $DB -f" in content, \
            "ci.yml 缺少 psql 应用 SQL 命令"

        # 验证表存在
        assert "psql -h 127.0.0.1 -U zhs -d zhs_ai_project -c" in content, \
            "ci.yml 缺少 psql 验证表命令"

        print(f"  ✅ ci.yml Alembic 迁移步骤使用 PostgreSQL (psql + PGPASSWORD)")
        return True
    except Exception as e:
        print(f"  ❌ ci.yml Alembic 步骤验证失败: {e}")
        return False


def main() -> int:
    print("=" * 70)
    print("CI workflow PostgreSQL 集成测试验证")
    print("=" * 70)

    results = []
    print("\n[1] ci.yml PostgreSQL 服务")
    results.append(("PostgreSQL 服务配置", test_ci_yml_pg_service()))
    results.append(("Python 依赖", test_ci_yml_pg_deps()))
    results.append(("PGPASSWORD 环境变量", test_ci_yml_pg_password_env()))

    print("\n[2] ci.yml 数据库与连接")
    results.append(("创建 3 个测试数据库", test_ci_yml_create_databases()))
    results.append(("postgresql+psycopg2 连接串", test_ci_yml_db_urls()))
    results.append(("Alembic 迁移步骤", test_ci_yml_alembic_step()))

    print("\n[3] 其他 CI 文件")
    results.append(("ci-fast.yml 无 MySQL", test_ci_fast_no_mysql()))
    results.append(("ci-nightly.yml PostgreSQL", test_ci_nightly_pg_integration()))

    print("\n[4] 全局验证")
    results.append(("全局无 MySQL 残留", test_no_mysql_global()))
    results.append(("引用脚本存在性", test_referenced_scripts_exist()))

    print("\n" + "=" * 70)
    passed = sum(1 for _, ok in results if ok)
    total = len(results)
    print(f"测试结果: {passed}/{total} 通过")
    print("=" * 70)
    for name, ok in results:
        status = "✅" if ok else "❌"
        print(f"  {status} {name}")

    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
