"""pgBouncer 连接池部署验证脚本.

验证内容 (10 项):
1. pgbouncer.ini 存在且配置完整
2. pool_mode = transaction (事务级池化)
3. max_client_conn = 200
4. default_pool_size = 50
5. 3 个库路由配置
6. 超时配置 (idle/server_lifetime/query_wait)
7. userlist.txt 存在且包含 zhs 用户
8. docker-compose pgbouncer 服务
9. pgbouncer 镜像: edoburu/pgbouncer:1.22.0
10. 端口 6432 + 健康检查 + 依赖 postgres

用法:
  python scripts/test_pgbouncer.py
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PGBOUNCER_INI = ROOT / "docker" / "pgbouncer" / "pgbouncer.ini"
USERLIST = ROOT / "docker" / "pgbouncer" / "userlist.txt"
COMPOSE = ROOT / "deploy" / "docker" / "docker-compose.yml"


def test_ini_exists() -> bool:
    """测试 pgbouncer.ini 存在且配置完整."""
    try:
        assert PGBOUNCER_INI.exists(), f"文件不存在: {PGBOUNCER_INI}"
        content = PGBOUNCER_INI.read_text(encoding="utf-8")
        assert "[databases]" in content, "缺少 [databases] 段"
        assert "[pgbouncer]" in content, "缺少 [pgbouncer] 段"
        print(f"  ✅ pgbouncer.ini 存在 ({len(content)} 字节)")
        return True
    except Exception as e:
        print(f"  ❌ 文件存在性验证失败: {e}")
        return False


def test_pool_mode() -> bool:
    """测试 pool_mode = transaction."""
    try:
        content = PGBOUNCER_INI.read_text(encoding="utf-8")
        assert "pool_mode = transaction" in content, "pool_mode 非 transaction"
        print(f"  ✅ pool_mode = transaction (事务级池化)")
        return True
    except Exception as e:
        print(f"  ❌ pool_mode 验证失败: {e}")
        return False


def test_max_client_conn() -> bool:
    """测试 max_client_conn = 200."""
    try:
        content = PGBOUNCER_INI.read_text(encoding="utf-8")
        assert "max_client_conn = 200" in content, "max_client_conn 非 200"
        print(f"  ✅ max_client_conn = 200 (客户端最大连接)")
        return True
    except Exception as e:
        print(f"  ❌ max_client_conn 验证失败: {e}")
        return False


def test_default_pool_size() -> bool:
    """测试 default_pool_size = 50."""
    try:
        content = PGBOUNCER_INI.read_text(encoding="utf-8")
        assert "default_pool_size = 50" in content, "default_pool_size 非 50"
        assert "reserve_pool_size = 5" in content, "缺少 reserve_pool_size"
        assert "max_db_connections = 100" in content, "缺少 max_db_connections"
        print(f"  ✅ default_pool_size = 50 (4:1 收敛, reserve=5, max_db=100)")
        return True
    except Exception as e:
        print(f"  ❌ default_pool_size 验证失败: {e}")
        return False


def test_databases_routing() -> bool:
    """测试 3 个库路由配置."""
    try:
        content = PGBOUNCER_INI.read_text(encoding="utf-8")
        assert "zhs_ai_project = host=postgres port=5432 dbname=zhs_ai_project" in content, \
            "缺少 zhs_ai_project 路由"
        assert "zhs_center_project = host=postgres port=5432 dbname=zhs_center_project" in content, \
            "缺少 zhs_center_project 路由"
        assert "zhs_educational_training = host=postgres port=5432 dbname=zhs_educational_training" in content, \
            "缺少 zhs_educational_training 路由"
        assert "* = host=postgres port=5432" in content, "缺少默认路由"

        print(f"  ✅ 3 个库路由配置 (ai/center/educational_training + 默认)")
        return True
    except Exception as e:
        print(f"  ❌ 库路由验证失败: {e}")
        return False


def test_timeouts() -> bool:
    """测试超时配置."""
    try:
        content = PGBOUNCER_INI.read_text(encoding="utf-8")
        assert "idle_transaction_timeout = 60" in content, "缺少 idle_transaction_timeout"
        assert "server_lifetime = 3600" in content, "缺少 server_lifetime"
        assert "server_idle_timeout = 600" in content, "缺少 server_idle_timeout"
        assert "connect_timeout = 15" in content, "缺少 connect_timeout"
        assert "query_wait_timeout = 120" in content, "缺少 query_wait_timeout"

        print(f"  ✅ 超时配置完整 (idle=60s, lifetime=3600s, wait=120s)")
        return True
    except Exception as e:
        print(f"  ❌ 超时配置验证失败: {e}")
        return False


def test_userlist() -> bool:
    """测试 userlist.txt 存在且包含 zhs 用户."""
    try:
        assert USERLIST.exists(), f"文件不存在: {USERLIST}"
        content = USERLIST.read_text(encoding="utf-8")
        assert '"zhs" "zhs_pg_pass"' in content, "缺少 zhs 用户"
        assert '"replicator" "replica_pass"' in content, "缺少 replicator 用户"

        print(f"  ✅ userlist.txt 存在 (zhs + replicator 用户)")
        return True
    except Exception as e:
        print(f"  ❌ userlist 验证失败: {e}")
        return False


def test_docker_compose_service() -> bool:
    """测试 docker-compose pgbouncer 服务."""
    try:
        content = COMPOSE.read_text(encoding="utf-8")
        assert "pgbouncer:" in content, "docker-compose 缺少 pgbouncer 服务"
        assert "edoburu/pgbouncer:1.22.0" in content, "镜像非 edoburu/pgbouncer:1.22.0"
        assert "6432:6432" in content, "缺少 6432 端口映射"
        assert "POOL_MODE: transaction" in content, "缺少 POOL_MODE 环境变量"
        assert "MAX_CLIENT_CONN: 200" in content, "缺少 MAX_CLIENT_CONN"
        assert "DEFAULT_POOL_SIZE: 50" in content, "缺少 DEFAULT_POOL_SIZE"

        print(f"  ✅ docker-compose pgbouncer 服务配置完整")
        return True
    except Exception as e:
        print(f"  ❌ docker-compose 服务验证失败: {e}")
        return False


def test_image() -> bool:
    """测试 pgbouncer 镜像: edoburu/pgbouncer:1.22.0."""
    try:
        content = COMPOSE.read_text(encoding="utf-8")
        assert "edoburu/pgbouncer:1.22.0" in content, "镜像非 edoburu/pgbouncer:1.22.0"
        print(f"  ✅ pgbouncer 镜像: edoburu/pgbouncer:1.22.0")
        return True
    except Exception as e:
        print(f"  ❌ 镜像验证失败: {e}")
        return False


def test_healthcheck_and_deps() -> bool:
    """测试端口 6432 + 健康检查 + 依赖 postgres."""
    try:
        content = COMPOSE.read_text(encoding="utf-8")
        assert "6432:6432" in content, "缺少 6432 端口"
        assert "pg_isready -h 127.0.0.1 -p 6432" in content, "缺少健康检查"
        assert "depends_on:" in content, "缺少依赖"
        assert "postgres:" in content, "缺少 postgres 依赖"
        assert "condition: service_healthy" in content, "缺少健康条件依赖"

        print(f"  ✅ 端口 6432 + 健康检查 + 依赖 postgres (service_healthy)")
        return True
    except Exception as e:
        print(f"  ❌ 健康检查验证失败: {e}")
        return False


def main() -> int:
    print("=" * 70)
    print("pgBouncer 连接池部署验证")
    print("=" * 70)

    results = []
    print("\n[1] 配置文件")
    results.append(("pgbouncer.ini 存在", test_ini_exists()))
    results.append(("pool_mode = transaction", test_pool_mode()))
    results.append(("max_client_conn = 200", test_max_client_conn()))
    results.append(("default_pool_size = 50", test_default_pool_size()))
    results.append(("3 个库路由", test_databases_routing()))
    results.append(("超时配置", test_timeouts()))
    results.append(("userlist.txt", test_userlist()))

    print("\n[2] docker-compose 集成")
    results.append(("pgbouncer 服务", test_docker_compose_service()))
    results.append(("镜像 1.22.0", test_image()))
    results.append(("健康检查 + 依赖", test_healthcheck_and_deps()))

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
