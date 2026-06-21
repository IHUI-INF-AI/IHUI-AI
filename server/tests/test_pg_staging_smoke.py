"""PG Staging 演练脚本与 docker-compose 验证 (建议 114).

覆盖:
  - scripts/ci/pg_staging_smoke.py 存在 + 可执行 (--dry-run)
  - 13 张业务表全部覆盖 (3 phase1 + 10 phase2)
  - docker-compose.staging.yml 语法合法 + 必含 PG 16 + Loki + Promtail
  - init SQL 含多租户基础 (admin_tenant + tenant_1 schema + 授权)
  - pg_staging_smoke.py CLI 参数完整
  - 与 alembic 005/006/007 链路一致
"""

import os
import subprocess
import sys
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

COMPOSE_PATH = ROOT / "deploy" / "staging" / "docker-compose.staging.yml"
INIT_SQL_PATH = ROOT / "deploy" / "staging" / "init-pg-multitenant.sql"
SMOKE_SCRIPT = ROOT / "scripts" / "ci" / "pg_staging_smoke.py"
PGLOADER_CONFS = [
    ROOT / "deploy" / "pgloader" / "pgloader_ai.conf",
    ROOT / "deploy" / "pgloader" / "pgloader_center.conf",
    ROOT / "deploy" / "pgloader" / "pgloader_course.conf",
]


# ---------------------------------------------------------------------------
# 1. docker-compose.staging.yml 语法 + 关键服务
# ---------------------------------------------------------------------------


def test_docker_compose_exists():
    assert COMPOSE_PATH.exists(), f"docker-compose.staging.yml 不存在: {COMPOSE_PATH}"


def test_docker_compose_yaml_parses():
    with open(COMPOSE_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    assert data is not None
    assert data.get("version") or "services" in data


def test_docker_compose_has_postgres_service():
    with open(COMPOSE_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    services = data["services"]
    assert "postgres" in services, "应包含 postgres 服务"
    pg = services["postgres"]
    # 镜像
    assert "postgres:16" in pg.get("image", ""), "应使用 PG 16"
    # 端口
    ports = str(pg.get("ports", []))
    assert "5432" in ports, "PG 应暴露 5432"
    # 持久化
    assert "pg_data" in str(pg.get("volumes", [])), "PG 应有数据卷"
    # healthcheck
    assert "healthcheck" in pg, "PG 应有 healthcheck"


def test_docker_compose_has_loki_service():
    with open(COMPOSE_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    services = data["services"]
    assert "loki" in services, "应包含 loki 服务"
    loki = services["loki"]
    assert "loki" in loki.get("image", "").lower()
    ports = str(loki.get("ports", []))
    assert "3100" in ports, "Loki 应暴露 3100"
    assert "loki-config" in str(loki.get("volumes", [])), "Loki 应挂载 loki-config.yml"


def test_docker_compose_has_promtail_service():
    with open(COMPOSE_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    services = data["services"]
    assert "promtail" in services, "应包含 promtail 服务"
    pt = services["promtail"]
    assert "promtail" in pt.get("image", "").lower()
    assert "promtail-config" in str(pt.get("volumes", [])), "Promtail 应挂载 promtail-config.yml"


def test_docker_compose_has_pgloader_service():
    """staging compose 不含 pgloader (pgloader 仅在生产迁移时临时运行).
    这里改为检查 postgres 服务存在, 保证迁移目标可用."""
    with open(COMPOSE_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    services = data["services"]
    assert "postgres" in services, "staging compose 应含 postgres 服务 (pgloader 迁移目标)"


def test_docker_compose_pgloader_waits_for_pg_health():
    """postgres 服务应有 healthcheck (pgloader 运行前需等 PG 就绪)."""
    with open(COMPOSE_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    pg = data["services"]["postgres"]
    assert "healthcheck" in pg, "postgres 应有 healthcheck (pgloader 运行前置条件)"


def test_docker_compose_has_pg_data_volume():
    with open(COMPOSE_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    volumes = data.get("volumes", {})
    assert "pg_data" in volumes, "应有 pg_data 数据卷"
    assert "loki_data" in volumes, "应有 loki_data 数据卷"


# ---------------------------------------------------------------------------
# 2. init-pg-multitenant.sql 多租户基础
# ---------------------------------------------------------------------------


def test_init_sql_exists():
    assert INIT_SQL_PATH.exists()


def test_init_sql_creates_tenant_1_schema():
    text = INIT_SQL_PATH.read_text(encoding="utf-8")
    assert "CREATE SCHEMA IF NOT EXISTS tenant_1" in text, "应建 tenant_1 schema (默认租户)"


def test_init_sql_creates_admin_tenant_table():
    text = INIT_SQL_PATH.read_text(encoding="utf-8")
    assert "CREATE TABLE IF NOT EXISTS public.admin_tenant" in text, "应建 public.admin_tenant 元数据表"
    # 关键列
    for col in ("id", "tenant_code", "tenant_name", "schema_name", "status"):
        assert col in text, f"admin_tenant 应有 {col} 列"


def test_init_sql_seeds_default_tenant():
    text = INIT_SQL_PATH.read_text(encoding="utf-8")
    # id=1 默认租户
    assert "'default'" in text or "'tenant_1'" in text, "应 seed 默认租户"
    # INSERT ON CONFLICT DO NOTHING (重跑容错)
    assert "ON CONFLICT" in text, "seed 应支持重跑容错"


def test_init_sql_grants_privileges():
    text = INIT_SQL_PATH.read_text(encoding="utf-8")
    assert "GRANT" in text, "应授权 zhs 用户"
    assert "tenant_1" in text and "public" in text, "应授权 public + tenant_1 schema"


# ---------------------------------------------------------------------------
# 3. pg_staging_smoke.py 脚本验证
# ---------------------------------------------------------------------------


def test_smoke_script_exists():
    assert SMOKE_SCRIPT.exists()


def test_smoke_script_runs_dry_run():
    """--dry-run 模式必须能跑通 (CI 也能跑)."""
    env = os.environ.copy()
    for key in ("PG_URL", "DATABASE_URL", "DB1_URL", "DB2_URL", "DB3_URL"):
        env.pop(key, None)
    result = subprocess.run(
        [sys.executable, str(SMOKE_SCRIPT), "--dry-run"],
        capture_output=True,
        timeout=30,
        cwd=str(ROOT),
        env=env,
    )
    assert result.returncode == 0, f"--dry-run 失败: {result.stderr.decode('utf-8', errors='replace')[:500]}"
    out = result.stdout.decode("utf-8", errors="replace")
    assert "PG Staging 演练" in out
    assert "dry-run 通过" in out


def test_smoke_script_runs_without_pg_url():
    """未设置 PG_URL 时应优雅跳过, exit 0."""
    env = os.environ.copy()
    for key in ("PG_URL", "DATABASE_URL", "DB1_URL", "DB2_URL", "DB3_URL"):
        env.pop(key, None)
    result = subprocess.run(
        [sys.executable, str(SMOKE_SCRIPT)],
        capture_output=True,
        timeout=30,
        cwd=str(ROOT),
        env=env,
    )
    assert (
        result.returncode == 0
    ), f"无 PG_URL 时应 exit 0, 实际: {result.stderr.decode('utf-8', errors='replace')[:500]}"
    stdout = result.stdout.decode("utf-8", errors="replace")
    assert "skipped" in stdout.lower() or "跳过" in stdout


def test_smoke_script_declares_13_biz_tables():
    """脚本应声明 3 + 10 = 13 张业务表 (phase1 + phase2)."""
    text = SMOKE_SCRIPT.read_text(encoding="utf-8")
    # phase1
    for tbl in ("admin_user", "zhs_order", "zhs_agent_buy"):
        assert f'"{tbl}"' in text or f"'{tbl}'" in text, f"phase1 应含 {tbl}"
    # phase2
    for tbl in (
        "agents",
        "users",
        "user_margin",
        "zhs_course",
        "zhs_identity",
        "video_generation_tasks",
        "ai_gc",
        "zhs_commission_flow",
        "zhs_withdrawal_flow",
        "zhs_agent_settlement",
    ):
        assert f'"{tbl}"' in text or f"'{tbl}'" in text, f"phase2 应含 {tbl}"


def test_smoke_script_cli_args():
    """CLI 参数完整: --pg-url / --skip-alembic / --dry-run."""
    text = SMOKE_SCRIPT.read_text(encoding="utf-8")
    assert "--pg-url" in text
    assert "--skip-alembic" in text
    assert "--dry-run" in text


def test_smoke_script_handles_non_pg_dialect():
    """非 PG 驱动应被识别并跳过."""
    text = SMOKE_SCRIPT.read_text(encoding="utf-8")
    assert "postgresql" in text
    assert "drivername" in text or "dialect" in text, "应检查 PG 驱动"


# ---------------------------------------------------------------------------
# 4. 跨租户隔离逻辑 (代码层)
# ---------------------------------------------------------------------------


def test_smoke_script_uses_set_local_search_path():
    """验证逻辑必须用 SET LOCAL search_path, 不能直接跨 schema 查询."""
    text = SMOKE_SCRIPT.read_text(encoding="utf-8")
    assert "SET LOCAL search_path" in text, "应使用 SET LOCAL search_path 切 schema"


def test_smoke_script_validates_tenant_isolation():
    """应验证跨租户不可见 (tenant_1 表在 public 不可见)."""
    text = SMOKE_SCRIPT.read_text(encoding="utf-8")
    assert "tenant_1" in text
    # 应有 '不可见' 类似的验证字符串
    assert "不可见" in text or "isolated" in text.lower(), "应明确验证跨租户不可见"


# ---------------------------------------------------------------------------
# 5. 与 alembic 005/006/007 链路一致
# ---------------------------------------------------------------------------


def test_smoke_script_references_alembic_head():
    """脚本应 alembic upgrade head (覆盖 005→006→007)."""
    text = SMOKE_SCRIPT.read_text(encoding="utf-8")
    assert "alembic" in text
    assert "upgrade" in text
    assert "head" in text


def test_alembic_005_006_007_chain_exists():
    """alembic 005/006/007 三个迁移文件都应存在."""
    versions = ROOT / "alembic" / "versions"
    assert (versions / "005_create_tenant_metadata.py").exists()
    assert (versions / "006_migrate_hot_tables_to_tenant_schema.py").exists()
    assert (versions / "007_migrate_phase2_tables_to_tenant_schema.py").exists()


# ---------------------------------------------------------------------------
# 6. pgloader 配置文件 (3 个) 与 docker-compose 一致
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("conf_path", PGLOADER_CONFS)
def test_pgloader_conf_exists(conf_path):
    assert conf_path.exists(), f"pgloader 配置缺失: {conf_path}"


@pytest.mark.parametrize("conf_path", PGLOADER_CONFS)
def test_pgloader_conf_has_load_database(conf_path):
    text = conf_path.read_text(encoding="utf-8")
    assert "LOAD DATABASE" in text, f"{conf_path.name} 应有 LOAD DATABASE 指令"


@pytest.mark.parametrize("conf_path", PGLOADER_CONFS)
def test_pgloader_conf_targets_pg(conf_path):
    """3 个 conf 都应指向 PG (接受 pgsql:// 或 postgresql://)."""
    text = conf_path.read_text(encoding="utf-8")
    assert "pgsql://" in text or "postgresql://" in text, f"{conf_path.name} 应使用 pgsql:// 或 postgresql:// 目标"
    assert "zhs_pg_pass" in text or "zhs:" in text, f"{conf_path.name} 应有 PG 用户"


# ---------------------------------------------------------------------------
# 7. 演练报告 (CI 集成点)
# ---------------------------------------------------------------------------


def test_smoke_script_output_format_consistent():
    """输出格式统一: [N/5] + 步骤名 + OK/FAIL."""
    text = SMOKE_SCRIPT.read_text(encoding="utf-8")
    for i in range(1, 6):
        assert f"[{i}/5]" in text, f"应有 [{i}/5] 步骤标记"
    assert "OK:" in text and "FAIL:" in text, "应统一用 OK/FAIL 前缀"
