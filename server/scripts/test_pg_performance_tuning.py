"""PostgreSQL 性能调优配置验证脚本.

验证内容 (10 项):
1. postgresql.conf 文件存在
2. 内存配置 (shared_buffers/work_mem/maintenance_work_mem/effective_cache_size)
3. WAL 与 Checkpoint 配置 (max_wal_size/checkpoint_completion_target)
4. 查询规划配置 (random_page_cost/effective_io_concurrency/并行查询)
5. 连接管理配置 (max_connections/idle_timeout/statement_timeout)
6. 自动 VACUUM 配置 (autovacuum/threshold/scale_factor)
7. 日志配置 (慢查询/锁等待/autovacuum 日志)
8. 时区配置 (Asia/Shanghai)
9. docker-compose 挂载 postgresql.conf
10. docker/mysql 目录已删除 (无 MySQL 残留)

用法:
  python scripts/test_pg_performance_tuning.py
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PG_CONF = ROOT / "docker" / "postgresql" / "postgresql.conf"
COMPOSE = ROOT / "deploy" / "docker" / "docker-compose.yml"
MYSQL_DIR = ROOT / "docker" / "mysql"


def _read_conf() -> str:
    return PG_CONF.read_text(encoding="utf-8")


def test_file_exists() -> bool:
    """测试 postgresql.conf 文件存在."""
    try:
        assert PG_CONF.exists(), f"文件不存在: {PG_CONF}"
        content = _read_conf()
        assert len(content) > 0, "文件内容为空"
        print(f"  ✅ postgresql.conf 存在 ({len(content)} 字节)")
        return True
    except Exception as e:
        print(f"  ❌ 文件存在性验证失败: {e}")
        return False


def test_memory_config() -> bool:
    """测试内存配置."""
    try:
        content = _read_conf()
        assert "shared_buffers = 2GB" in content, "shared_buffers 非 2GB"
        assert "work_mem = 16MB" in content, "work_mem 非 16MB"
        assert "maintenance_work_mem = 512MB" in content, "maintenance_work_mem 非 512MB"
        assert "effective_cache_size = 6GB" in content, "effective_cache_size 非 6GB"
        assert "wal_buffers = 16MB" in content, "wal_buffers 非 16MB"

        print(f"  ✅ 内存配置正确 (shared_buffers=2GB, work_mem=16MB, effective_cache_size=6GB)")
        return True
    except Exception as e:
        print(f"  ❌ 内存配置验证失败: {e}")
        return False


def test_wal_checkpoint_config() -> bool:
    """测试 WAL 与 Checkpoint 配置."""
    try:
        content = _read_conf()
        assert "max_wal_size = 4GB" in content, "max_wal_size 非 4GB"
        assert "min_wal_size = 1GB" in content, "min_wal_size 非 1GB"
        assert "checkpoint_completion_target = 0.9" in content, "checkpoint_completion_target 非 0.9"
        assert "checkpoint_timeout = 30min" in content, "checkpoint_timeout 非 30min"
        assert "synchronous_commit = on" in content, "synchronous_commit 非 on"

        print(f"  ✅ WAL/Checkpoint 配置正确 (max_wal=4GB, checkpoint_target=0.9, timeout=30min)")
        return True
    except Exception as e:
        print(f"  ❌ WAL/Checkpoint 验证失败: {e}")
        return False


def test_planner_config() -> bool:
    """测试查询规划配置."""
    try:
        content = _read_conf()
        assert "random_page_cost = 1.1" in content, "random_page_cost 非 1.1 (SSD)"
        assert "effective_io_concurrency = 200" in content, "effective_io_concurrency 非 200 (SSD)"
        assert "default_statistics_target = 100" in content, "default_statistics_target 非 100"
        assert "max_worker_processes = 8" in content, "max_worker_processes 非 8"
        assert "max_parallel_workers = 8" in content, "max_parallel_workers 非 8"
        assert "max_parallel_workers_per_gather = 2" in content, "max_parallel_workers_per_gather 非 2"

        print(f"  ✅ 查询规划配置正确 (SSD 优化 + 并行查询 8 workers)")
        return True
    except Exception as e:
        print(f"  ❌ 查询规划验证失败: {e}")
        return False


def test_connection_config() -> bool:
    """测试连接管理配置."""
    try:
        content = _read_conf()
        assert "max_connections = 200" in content, "max_connections 非 200"
        assert "idle_in_transaction_session_timeout = 10min" in content, \
            "idle_in_transaction_session_timeout 非 10min"
        assert "statement_timeout = 30s" in content, "statement_timeout 非 30s"
        assert "lock_timeout = 5s" in content, "lock_timeout 非 5s"

        print(f"  ✅ 连接管理配置正确 (max=200, idle=10min, statement=30s, lock=5s)")
        return True
    except Exception as e:
        print(f"  ❌ 连接管理验证失败: {e}")
        return False


def test_autovacuum_config() -> bool:
    """测试自动 VACUUM 配置."""
    try:
        content = _read_conf()
        assert "autovacuum = on" in content, "autovacuum 非 on"
        assert "autovacuum_max_workers = 3" in content, "autovacuum_max_workers 非 3"
        assert "autovacuum_naptime = 1min" in content, "autovacuum_naptime 非 1min"
        assert "autovacuum_vacuum_scale_factor = 0.1" in content, "autovacuum_vacuum_scale_factor 非 0.1"
        assert "autovacuum_analyze_scale_factor = 0.05" in content, "autovacuum_analyze_scale_factor 非 0.05"
        assert "autovacuum_vacuum_cost_limit = 200" in content, "autovacuum_vacuum_cost_limit 非 200"

        print(f"  ✅ 自动 VACUUM 配置正确 (workers=3, scale=0.1, cost_limit=200)")
        return True
    except Exception as e:
        print(f"  ❌ 自动 VACUUM 验证失败: {e}")
        return False


def test_logging_config() -> bool:
    """测试日志配置."""
    try:
        content = _read_conf()
        assert "log_min_duration_statement = 1000" in content, "慢查询日志非 1000ms"
        assert "log_lock_waits = on" in content, "log_lock_waits 非 on"
        assert "log_autovacuum_min_duration = 0" in content, "log_autovacuum_min_duration 非 0"
        assert "log_checkpoints = on" in content, "log_checkpoints 非 on"
        assert "log_temp_files = 0" in content, "log_temp_files 非 0"

        print(f"  ✅ 日志配置正确 (慢查询>1s, 锁等待, autovacuum, checkpoint, temp_files)")
        return True
    except Exception as e:
        print(f"  ❌ 日志配置验证失败: {e}")
        return False


def test_timezone_config() -> bool:
    """测试时区配置."""
    try:
        content = _read_conf()
        assert "timezone = 'Asia/Shanghai'" in content, "timezone 非 Asia/Shanghai"
        assert "log_timezone = 'Asia/Shanghai'" in content, "log_timezone 非 Asia/Shanghai"

        print(f"  ✅ 时区配置正确 (Asia/Shanghai)")
        return True
    except Exception as e:
        print(f"  ❌ 时区配置验证失败: {e}")
        return False


def test_docker_compose_mount() -> bool:
    """测试 docker-compose 挂载 postgresql.conf."""
    try:
        content = COMPOSE.read_text(encoding="utf-8")
        assert "docker/postgresql/postgresql.conf" in content, \
            "docker-compose 未挂载 postgresql.conf"
        assert "config_file=/etc/postgresql/postgresql.conf" in content, \
            "docker-compose 未使用 config_file 启动参数"

        print(f"  ✅ docker-compose 挂载 postgresql.conf (config_file 启动)")
        return True
    except Exception as e:
        print(f"  ❌ docker-compose 挂载验证失败: {e}")
        return False


def test_mysql_dir_removed() -> bool:
    """测试 docker/mysql 目录已删除."""
    try:
        assert not MYSQL_DIR.exists(), f"docker/mysql 目录仍存在: {MYSQL_DIR}"

        # 检查 docker 目录下无 mysql 子目录
        docker_dir = ROOT / "docker"
        for item in docker_dir.iterdir():
            assert "mysql" not in item.name.lower(), f"docker 目录下仍有 mysql 残留: {item.name}"

        print(f"  ✅ docker/mysql 目录已删除 (无 MySQL 残留)")
        return True
    except Exception as e:
        print(f"  ❌ MySQL 目录验证失败: {e}")
        return False


def main() -> int:
    print("=" * 70)
    print("PostgreSQL 性能调优配置验证")
    print("=" * 70)

    results = []
    print("\n[1] 文件与内存")
    results.append(("postgresql.conf 存在", test_file_exists()))
    results.append(("内存配置", test_memory_config()))

    print("\n[2] WAL 与规划")
    results.append(("WAL/Checkpoint", test_wal_checkpoint_config()))
    results.append(("查询规划 (SSD)", test_planner_config()))

    print("\n[3] 连接与 VACUUM")
    results.append(("连接管理", test_connection_config()))
    results.append(("自动 VACUUM", test_autovacuum_config()))

    print("\n[4] 日志与时区")
    results.append(("日志配置", test_logging_config()))
    results.append(("时区配置", test_timezone_config()))

    print("\n[5] 集成与清理")
    results.append(("docker-compose 挂载", test_docker_compose_mount()))
    results.append(("docker/mysql 已删除", test_mysql_dir_removed()))

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
