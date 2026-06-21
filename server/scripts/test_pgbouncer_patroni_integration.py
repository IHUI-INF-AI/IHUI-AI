#!/usr/bin/env python3
"""pgBouncer + Patroni 集成验证测试"""
import sys
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
DOCKER_DIR = SERVER_DIR / "docker" / "pgbouncer"
COMPOSE_FILE = SERVER_DIR / "deploy" / "docker" / "docker-compose.pgbouncer-patroni.yml"
INI_FILE = DOCKER_DIR / "pgbouncer_patroni.ini"


def test_ini_exists():
    """测试 1: pgBouncer Patroni 配置文件存在"""
    assert INI_FILE.exists(), f"缺少配置文件: {INI_FILE}"
    print("✅ 测试 1 通过: 配置文件存在")


def test_compose_exists():
    """测试 2: compose 文件存在"""
    assert COMPOSE_FILE.exists(), f"缺少 compose 文件: {COMPOSE_FILE}"
    print("✅ 测试 2 通过: compose 文件存在")


def test_ini_haproxy_routing():
    """测试 3: 配置指向 HAProxy VIP"""
    content = INI_FILE.read_text(encoding="utf-8")
    assert "host=haproxy" in content, "缺少 HAProxy 主机配置"
    assert "port=5000" in content, "缺少写端口 5000"
    assert "port=5001" in content, "缺少读端口 5001"
    print("✅ 测试 3 通过: HAProxy VIP 路由")


def test_ini_write_read_split():
    """测试 4: 读写分离配置"""
    content = INI_FILE.read_text(encoding="utf-8")
    assert "zhs_ai_project = host=haproxy port=5000" in content, "缺少写库路由"
    assert "zhs_ai_project_ro = host=haproxy port=5001" in content, "缺少读库路由"
    assert "zhs_center_project" in content, "缺少 center 库"
    assert "zhs_educational_training" in content, "缺少 educational_training 库"
    print("✅ 测试 4 通过: 读写分离配置")


def test_ini_pool_mode():
    """测试 5: 连接池模式"""
    content = INI_FILE.read_text(encoding="utf-8")
    assert "pool_mode = transaction" in content, "缺少 transaction 模式"
    assert "max_client_conn = 200" in content, "缺少 max_client_conn"
    assert "default_pool_size = 50" in content, "缺少 default_pool_size"
    print("✅ 测试 5 通过: 连接池模式")


def test_ini_auth():
    """测试 6: 认证配置"""
    content = INI_FILE.read_text(encoding="utf-8")
    assert "auth_type = trust" in content, "缺少 auth_type"
    assert "auth_file = /etc/pgbouncer/userlist.txt" in content, "缺少 auth_file"
    print("✅ 测试 6 通过: 认证配置")


def test_compose_services():
    """测试 7: compose 服务定义"""
    content = COMPOSE_FILE.read_text(encoding="utf-8")
    assert "pgbouncer-write" in content, "缺少 pgbouncer-write 服务"
    assert "pgbouncer-read" in content, "缺少 pgbouncer-read 服务"
    assert "haproxy" in content, "缺少 haproxy 服务"
    print("✅ 测试 7 通过: compose 服务定义")


def test_compose_ports():
    """测试 8: 端口映射"""
    content = COMPOSE_FILE.read_text(encoding="utf-8")
    assert "6432:6432" in content, "缺少写连接池端口 6432"
    assert "6433:6432" in content, "缺少读连接池端口 6433"
    assert "5000:5000" in content, "缺少 HAProxy 写端口"
    assert "5001:5001" in content, "缺少 HAProxy 读端口"
    assert "7000:7000" in content, "缺少 HAProxy stats 端口"
    print("✅ 测试 8 通过: 端口映射")


def test_compose_depends_on():
    """测试 9: 服务依赖"""
    content = COMPOSE_FILE.read_text(encoding="utf-8")
    assert "depends_on" in content, "缺少 depends_on"
    assert "- haproxy" in content, "缺少 haproxy 依赖"
    print("✅ 测试 9 通过: 服务依赖")


def test_compose_network():
    """测试 10: 网络配置"""
    content = COMPOSE_FILE.read_text(encoding="utf-8")
    assert "patroni-net" in content, "缺少 patroni-net 网络"
    assert "networks:" in content, "缺少 networks 配置"
    assert "external: true" in content, "缺少外部网络声明"
    print("✅ 测试 10 通过: 网络配置")


def test_compose_healthcheck():
    """测试 11: 健康检查"""
    content = COMPOSE_FILE.read_text(encoding="utf-8")
    assert "healthcheck" in content, "缺少 healthcheck"
    assert "pg_isready" in content, "缺少 pg_isready 健康检查"
    print("✅ 测试 11 通过: 健康检查")


def main():
    print("=" * 60)
    print("pgBouncer + Patroni 集成验证")
    print("=" * 60)
    tests = [
        test_ini_exists, test_compose_exists, test_ini_haproxy_routing,
        test_ini_write_read_split, test_ini_pool_mode, test_ini_auth,
        test_compose_services, test_compose_ports, test_compose_depends_on,
        test_compose_network, test_compose_healthcheck,
    ]
    for t in tests:
        t()
    print("=" * 60)
    print(f"✅ 全部 {len(tests)} 项测试通过")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
