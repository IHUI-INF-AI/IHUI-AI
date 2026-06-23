"""PostgreSQL 安装与配置脚本

在 Windows 上安装和配置 PostgreSQL for IHUI-AI

前置条件:
  - Windows 10/11
  - 管理员权限
  - winget 或 chocolatey

用法:
    python setup_postgresql.py           # 安装并配置
    python setup_postgresql.py --check   # 检查 PostgreSQL 状态
    python setup_postgresql.py --migrate # 从 SQLite 迁移数据到 PostgreSQL
"""
import os
import sys
import subprocess
from pathlib import Path

# PostgreSQL 配置
PG_HOST = "localhost"
PG_PORT = "5432"
PG_USER = "postgres"
PG_PASSWORD = "postgres"  # 修改为你的密码
PG_DB = "zhs_platform"

# SQLite 数据库路径
SQLITE_PATH = "G:/IHUI-AI/server/data/zhs_dev.sqlite"

# .env 文件路径
ENV_FILE = "G:/IHUI-AI/server/.env"


def check_postgresql():
    """检查 PostgreSQL 是否已安装"""
    try:
        result = subprocess.run(
            ["psql", "--version"],
            capture_output=True, text=True, shell=True
        )
        if result.returncode == 0:
            print(f"✅ PostgreSQL 已安装: {result.stdout.strip()}")
            return True
    except Exception:
        pass

    # 检查常见安装路径
    pg_paths = [
        r"C:\Program Files\PostgreSQL",
        r"C:\PostgreSQL",
    ]
    for path in pg_paths:
        if os.path.exists(path):
            print(f"✅ PostgreSQL 安装目录存在: {path}")
            return True

    print("❌ PostgreSQL 未安装")
    return False


def install_postgresql():
    """安装 PostgreSQL"""
    print("\n[1] 安装 PostgreSQL...")

    # 尝试使用 winget
    try:
        result = subprocess.run(
            ["winget", "install", "PostgreSQL.PostgreSQL.16"],
            capture_output=True, text=True, shell=True
        )
        if result.returncode == 0:
            print("✅ PostgreSQL 安装成功 (winget)")
            return True
    except Exception as e:
        print(f"  winget 安装失败: {e}")

    # 尝试使用 chocolatey
    try:
        result = subprocess.run(
            ["choco", "install", "postgresql16"],
            capture_output=True, text=True, shell=True
        )
        if result.returncode == 0:
            print("✅ PostgreSQL 安装成功 (chocolatey)")
            return True
    except Exception as e:
        print(f"  chocolatey 安装失败: {e}")

    print("❌ 自动安装失败，请手动安装:")
    print("  1. 下载: https://www.postgresql.org/download/windows/")
    print("  2. 安装时设置 superuser 密码为: postgres")
    print("  3. 端口保持默认: 5432")
    print("  4. 安装完成后重新运行此脚本")
    return False


def create_database():
    """创建 zhs_platform 数据库"""
    print(f"\n[2] 创建数据库 {PG_DB}...")

    # 设置 PGPASSWORD 环境变量
    env = os.environ.copy()
    env["PGPASSWORD"] = PG_PASSWORD

    # 检查数据库是否已存在
    try:
        result = subprocess.run(
            ["psql", "-h", PG_HOST, "-p", PG_PORT, "-U", PG_USER,
             "-d", "postgres", "-tAc",
             f"SELECT 1 FROM pg_database WHERE datname='{PG_DB}'"],
            capture_output=True, text=True, env=env, shell=True
        )
        if result.returncode == 0 and "1" in result.stdout:
            print(f"✅ 数据库 {PG_DB} 已存在")
            return True
    except Exception as e:
        print(f"  检查数据库失败: {e}")

    # 创建数据库
    try:
        result = subprocess.run(
            ["psql", "-h", PG_HOST, "-p", PG_PORT, "-U", PG_USER,
             "-d", "postgres", "-c",
             f"CREATE DATABASE {PG_DB}"],
            capture_output=True, text=True, env=env, shell=True
        )
        if result.returncode == 0:
            print(f"✅ 数据库 {PG_DB} 创建成功")
            return True
        else:
            print(f"  创建失败: {result.stderr}")
    except Exception as e:
        print(f"  创建数据库失败: {e}")

    return False


def create_schemas():
    """创建多租户 schema"""
    print(f"\n[3] 创建 schema...")

    env = os.environ.copy()
    env["PGPASSWORD"] = PG_PASSWORD

    schemas = ["public", "ai", "course", "agent", "official", "stats"]

    for schema in schemas:
        try:
            result = subprocess.run(
                ["psql", "-h", PG_HOST, "-p", PG_PORT, "-U", PG_USER,
                 "-d", PG_DB, "-c",
                 f"CREATE SCHEMA IF NOT EXISTS {schema}"],
                capture_output=True, text=True, env=env, shell=True
            )
            if result.returncode == 0:
                print(f"  ✅ Schema {schema}")
            else:
                print(f"  ❌ Schema {schema}: {result.stderr.strip()}")
        except Exception as e:
            print(f"  ❌ Schema {schema}: {e}")


def update_env_file():
    """更新 .env 文件使用 PostgreSQL"""
    print(f"\n[4] 更新 .env 文件...")

    pg_url = f"postgresql://{PG_USER}:{PG_PASSWORD}@{PG_HOST}:{PG_PORT}/{PG_DB}"

    if not os.path.exists(ENV_FILE):
        print(f"  .env 文件不存在，创建新文件")
        content = ""
    else:
        content = Path(ENV_FILE).read_text(encoding="utf-8")

    # 备份原文件
    backup_path = ENV_FILE + ".bak"
    Path(backup_path).write_text(content, encoding="utf-8")
    print(f"  原文件已备份到 {backup_path}")

    # 替换 DB1_URL 和 DB2_URL
    lines = content.split("\n")
    new_lines = []
    for line in lines:
        if line.startswith("DB1_URL="):
            new_lines.append(f"DB1_URL={pg_url}")
        elif line.startswith("DB2_URL="):
            new_lines.append(f"DB2_URL={pg_url}")
        else:
            new_lines.append(line)

    Path(ENV_FILE).write_text("\n".join(new_lines), encoding="utf-8")
    print(f"  ✅ .env 已更新: DB1_URL 和 DB2_URL 指向 PostgreSQL")
    print(f"     URL: {pg_url}")


def migrate_from_sqlite():
    """从 SQLite 迁移数据到 PostgreSQL"""
    print(f"\n[5] 从 SQLite 迁移数据到 PostgreSQL...")

    if not os.path.exists(SQLITE_PATH):
        print(f"  ❌ SQLite 数据库不存在: {SQLITE_PATH}")
        return False

    print(f"  SQLite 数据库: {SQLITE_PATH}")
    print(f"  PostgreSQL: {PG_HOST}:{PG_PORT}/{PG_DB}")
    print()
    print("  迁移步骤:")
    print("  1. 确保 PostgreSQL 已安装并运行")
    print("  2. 确保 zhs_platform 数据库已创建")
    print("  3. 运行以下命令:")
    print()
    print(f"     cd G:/IHUI-AI/server")
    print(f"     set AUTO_CREATE_SCHEMA=1")
    print(f"     set DB1_URL=postgresql://{PG_USER}:{PG_PASSWORD}@{PG_HOST}:{PG_PORT}/{PG_DB}")
    print(f"     set DB2_URL=postgresql://{PG_USER}:{PG_PASSWORD}@{PG_HOST}:{PG_PORT}/{PG_DB}")
    print(f"     python -c \"from app.database import create_all_per_db; create_all_per_db(); print('Tables created')\"")
    print()
    print("  4. 使用 pgloader 或手动 SQL 迁移数据:")
    print(f"     pip install pgloader")
    print(f"     或使用: pg_dump/psql 导入导出")
    print()
    print("  注意: 迁移后需要更新 .env 文件中的 DB1_URL 和 DB2_URL")


def main():
    check_mode = "--check" in sys.argv
    migrate_mode = "--migrate" in sys.argv

    if migrate_mode:
        migrate_from_sqlite()
        return

    print("=" * 60)
    print("PostgreSQL 安装与配置脚本")
    print("=" * 60)

    # 1. 检查 PostgreSQL
    if not check_postgresql():
        if check_mode:
            return
        if not install_postgresql():
            return
    elif check_mode:
        # 只检查模式
        create_database()
        return

    # 2. 创建数据库
    if not create_database():
        return

    # 3. 创建 schema
    create_schemas()

    # 4. 更新 .env
    update_env_file()

    # 5. 迁移提示
    print(f"\n" + "=" * 60)
    print("PostgreSQL 配置完成!")
    print("=" * 60)
    print()
    print("下一步:")
    print("  1. 重启后端服务")
    print("  2. 运行迁移: python setup_postgresql.py --migrate")
    print("  3. 验证连接: python -c \"from app.database import engine1; print(engine1.url)\"")


if __name__ == "__main__":
    main()
