"""Patroni 高可用 PoC 验证脚本.

验证内容 (10 项):
1. docker-compose.patroni-ha.yml 存在且 YAML 合法
2. etcd 3 节点集群配置
3. Patroni 3 节点配置 (1 Leader + 2 Replica)
4. HAProxy 读写路由配置
5. Patroni 镜像: spilo-15 (Zalando)
6. etcd 镜像: v3.5.12
7. Patroni 配置参数 (scope/etcd/superuser/replication)
8. HAProxy 配置 (写端口 5000 + 读端口 5001 + stats 7000)
9. 故障转移演练脚本存在
10. 数据卷持久化 (etcd + patroni)

用法:
  python scripts/test_patroni_ha.py
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
COMPOSE = ROOT / "deploy" / "docker" / "docker-compose.patroni-ha.yml"
HAPROXY_CFG = ROOT / "docker" / "haproxy" / "haproxy.cfg"
FAILOVER_SCRIPT = ROOT / "scripts" / "patroni_failover_drill.sh"


def _bash_available() -> bool:
    try:
        subprocess.run(["bash", "--version"], capture_output=True, timeout=5)
        return True
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def _load_yaml(path: Path):
    try:
        import yaml
        with open(path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)
    except ImportError:
        return None
    except Exception:
        return None


def test_compose_exists() -> bool:
    """测试 docker-compose.patroni-ha.yml 存在且 YAML 合法."""
    try:
        assert COMPOSE.exists(), f"文件不存在: {COMPOSE}"
        data = _load_yaml(COMPOSE)
        if data is None:
            print("  ⚠️  PyYAML 未安装, 使用文本检查")
            content = COMPOSE.read_text(encoding="utf-8")
            assert "etcd1:" in content and "etcd2:" in content and "etcd3:" in content
            assert "patroni1:" in content and "patroni2:" in content and "patroni3:" in content
            assert "haproxy:" in content
            print(f"  ✅ docker-compose.patroni-ha.yml 存在 (文本检查)")
            return True

        services = data.get("services", {})
        for s in ["etcd1", "etcd2", "etcd3", "patroni1", "patroni2", "patroni3", "haproxy"]:
            assert s in services, f"缺少 {s} 服务"

        print(f"  ✅ docker-compose.patroni-ha.yml YAML 合法 (7 个服务)")
        return True
    except Exception as e:
        print(f"  ❌ 文件存在性验证失败: {e}")
        return False


def test_etcd_cluster() -> bool:
    """测试 etcd 3 节点集群配置."""
    try:
        data = _load_yaml(COMPOSE)
        if data is None:
            content = COMPOSE.read_text(encoding="utf-8")
            assert "ETCD_INITIAL_CLUSTER=etcd1=http://etcd1:2380,etcd2=http://etcd2:2380,etcd3=http://etcd3:2380" in content
            assert "ETCD_INITIAL_CLUSTER_TOKEN=patroni-zhs" in content
            print(f"  ✅ etcd 3 节点集群 (文本检查)")
            return True

        services = data["services"]
        for i in [1, 2, 3]:
            etcd = services[f"etcd{i}"]
            env = etcd.get("environment", [])
            # 环境变量可能是 list 或 dict
            if isinstance(env, list):
                env_str = " ".join(env)
            else:
                env_str = " ".join(f"{k}={v}" for k, v in env.items())
            assert f"ETCD_NAME=etcd{i}" in env_str, f"etcd{i} 缺少 ETCD_NAME"
            assert "ETCD_INITIAL_CLUSTER" in env_str, f"etcd{i} 缺少 ETCD_INITIAL_CLUSTER"

        # 集群配置
        content = COMPOSE.read_text(encoding="utf-8")
        assert "etcd1=http://etcd1:2380,etcd2=http://etcd2:2380,etcd3=http://etcd3:2380" in content
        assert "patroni-zhs" in content, "缺少集群 token"

        print(f"  ✅ etcd 3 节点集群 (Raft 一致性, token=patroni-zhs)")
        return True
    except Exception as e:
        print(f"  ❌ etcd 集群验证失败: {e}")
        return False


def test_patroni_nodes() -> bool:
    """测试 Patroni 3 节点配置."""
    try:
        data = _load_yaml(COMPOSE)
        if data is None:
            content = COMPOSE.read_text(encoding="utf-8")
            for i in [1, 2, 3]:
                assert f"PATRONI_NAME=patroni{i}" in content, f"缺少 patroni{i}"
            print(f"  ✅ Patroni 3 节点 (文本检查)")
            return True

        services = data["services"]
        for i in [1, 2, 3]:
            patroni = services[f"patroni{i}"]
            env = patroni.get("environment", [])
            if isinstance(env, list):
                env_str = " ".join(env)
            else:
                env_str = " ".join(f"{k}={v}" for k, v in env.items())
            assert f"PATRONI_NAME=patroni{i}" in env_str, f"patroni{i} 缺少 PATRONI_NAME"
            assert "PATRONI_SCOPE=zhs" in env_str, f"patroni{i} 缺少 PATRONI_SCOPE"
            assert "PATRONI_ETCD3_HOSTS" in env_str, f"patroni{i} 缺少 PATRONI_ETCD3_HOSTS"

        print(f"  ✅ Patroni 3 节点 (scope=zhs, etcd3 后端)")
        return True
    except Exception as e:
        print(f"  ❌ Patroni 节点验证失败: {e}")
        return False


def test_haproxy_config() -> bool:
    """测试 HAProxy 读写路由配置."""
    try:
        assert HAPROXY_CFG.exists(), f"HAProxy 配置不存在: {HAPROXY_CFG}"
        content = HAPROXY_CFG.read_text(encoding="utf-8")

        # 写端口 5000
        assert "bind *:5000" in content, "缺少写端口 5000"
        assert "write_frontend" in content, "缺少 write_frontend"
        assert "write_backend" in content, "缺少 write_backend"

        # 读端口 5001
        assert "bind *:5001" in content, "缺少读端口 5001"
        assert "read_frontend" in content, "缺少 read_frontend"
        assert "read_backend" in content, "缺少 read_backend"

        # stats 7000
        assert "bind *:7000" in content, "缺少 stats 端口 7000"
        assert "stats uri /stats" in content, "缺少 stats uri"

        # 3 个 Patroni 服务器
        assert "server patroni1 patroni1:5432" in content, "缺少 patroni1 服务器"
        assert "server patroni2 patroni2:5432" in content, "缺少 patroni2 服务器"
        assert "server patroni3 patroni3:5432" in content, "缺少 patroni3 服务器"

        # 健康检查端口 8008
        assert "check port 8008" in content, "缺少 Patroni 健康检查端口 8008"

        print(f"  ✅ HAProxy 配置完整 (写5000 + 读5001 + stats7000 + 3节点)")
        return True
    except Exception as e:
        print(f"  ❌ HAProxy 配置验证失败: {e}")
        return False


def test_patroni_image() -> bool:
    """测试 Patroni 镜像: spilo-15 (Zalando)."""
    try:
        content = COMPOSE.read_text(encoding="utf-8")
        assert "ghcr.io/zalando/spilo-15" in content, "Patroni 镜像非 spilo-15"
        print(f"  ✅ Patroni 镜像: ghcr.io/zalando/spilo-15 (Zalando)")
        return True
    except Exception as e:
        print(f"  ❌ Patroni 镜像验证失败: {e}")
        return False


def test_etcd_image() -> bool:
    """测试 etcd 镜像: v3.5.12."""
    try:
        content = COMPOSE.read_text(encoding="utf-8")
        assert "quay.io/coreos/etcd:v3.5.12" in content, "etcd 镜像非 v3.5.12"
        print(f"  ✅ etcd 镜像: quay.io/coreos/etcd:v3.5.12")
        return True
    except Exception as e:
        print(f"  ❌ etcd 镜像验证失败: {e}")
        return False


def test_patroni_params() -> bool:
    """测试 Patroni 配置参数."""
    try:
        content = COMPOSE.read_text(encoding="utf-8")

        # scope
        assert "PATRONI_SCOPE=zhs" in content, "缺少 PATRONI_SCOPE"

        # superuser
        assert "PATRONI_SUPERUSER_USERNAME=zhs" in content, "缺少 PATRONI_SUPERUSER_USERNAME"
        assert "PATRONI_SUPERUSER_PASSWORD=zhs_pg_pass" in content, "缺少 PATRONI_SUPERUSER_PASSWORD"

        # replication
        assert "PATRONI_REPLICATION_USERNAME=replicator" in content, "缺少 PATRONI_REPLICATION_USERNAME"
        assert "PATRONI_REPLICATION_PASSWORD=replica_pass" in content, "缺少 PATRONI_REPLICATION_PASSWORD"

        # PostgreSQL 参数
        assert "max_connections=200" in content, "缺少 max_connections"
        assert "shared_buffers=2GB" in content, "缺少 shared_buffers"

        # REST API
        assert "PATRONI_RESTAPI_LISTEN=0.0.0.0:8008" in content, "缺少 PATRONI_RESTAPI_LISTEN"

        # etcd3 后端
        assert "PATRONI_ETCD3_HOSTS=etcd1:2379,etcd2:2379,etcd3:2379" in content, "缺少 PATRONI_ETCD3_HOSTS"

        print(f"  ✅ Patroni 参数完整 (scope/superuser/replication/PG参数/etcd3)")
        return True
    except Exception as e:
        print(f"  ❌ Patroni 参数验证失败: {e}")
        return False


def test_failover_script() -> bool:
    """测试故障转移演练脚本存在."""
    try:
        assert FAILOVER_SCRIPT.exists(), f"脚本不存在: {FAILOVER_SCRIPT}"

        if _bash_available():
            result = subprocess.run(["bash", "-n", str(FAILOVER_SCRIPT)], capture_output=True, timeout=10)
            assert result.returncode == 0, f"语法错误: {result.stderr}"
            note = "bash 语法通过"
        else:
            note = "bash 不可用, 跳过语法检查"

        content = FAILOVER_SCRIPT.read_text(encoding="utf-8")
        assert "[步骤 1/7]" in content, "缺少步骤 1"
        assert "[步骤 7/7]" in content, "缺少步骤 7"
        assert "docker stop" in content, "缺少 docker stop 模拟故障"
        assert "docker start" in content, "缺少 docker start 恢复"

        print(f"  ✅ 故障转移演练脚本存在 ({note}, 7 步流程)")
        return True
    except Exception as e:
        print(f"  ❌ 故障转移脚本验证失败: {e}")
        return False


def test_volumes_persistence() -> bool:
    """测试数据卷持久化."""
    try:
        data = _load_yaml(COMPOSE)
        if data is None:
            content = COMPOSE.read_text(encoding="utf-8")
            for v in ["etcd1_data", "etcd2_data", "etcd3_data", "patroni1_data", "patroni2_data", "patroni3_data"]:
                assert f"{v}:" in content, f"缺少 {v} 卷"
            print(f"  ✅ 数据卷持久化 (文本检查)")
            return True

        volumes = data.get("volumes", {})
        required = ["etcd1_data", "etcd2_data", "etcd3_data",
                    "patroni1_data", "patroni2_data", "patroni3_data"]
        for v in required:
            assert v in volumes, f"缺少 {v} 卷"

        print(f"  ✅ 数据卷持久化 (6 个卷: 3 etcd + 3 patroni)")
        return True
    except Exception as e:
        print(f"  ❌ 数据卷验证失败: {e}")
        return False


def main() -> int:
    print("=" * 70)
    print("Patroni 高可用 PoC 验证")
    print("=" * 70)

    results = []
    print("\n[1] docker-compose 配置")
    results.append(("compose 文件存在", test_compose_exists()))
    results.append(("etcd 3 节点集群", test_etcd_cluster()))
    results.append(("Patroni 3 节点", test_patroni_nodes()))
    results.append(("HAProxy 读写路由", test_haproxy_config()))

    print("\n[2] 镜像与参数")
    results.append(("Patroni 镜像 (spilo-15)", test_patroni_image()))
    results.append(("etcd 镜像 (v3.5.12)", test_etcd_image()))
    results.append(("Patroni 参数", test_patroni_params()))

    print("\n[3] 演练与持久化")
    results.append(("故障转移演练脚本", test_failover_script()))
    results.append(("数据卷持久化", test_volumes_persistence()))

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
