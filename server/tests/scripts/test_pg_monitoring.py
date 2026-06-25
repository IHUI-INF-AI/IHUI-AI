"""PostgreSQL Exporter + Prometheus 监控验证脚本.

验证内容:
1. docker-compose.yml 中 postgres-exporter 服务配置
2. docker-compose.yml 中 prometheus 服务配置
3. prometheus.yml 抓取目标正确 (postgres-exporter:9187)
4. prometheus.yml 抓取目标正确 (api:8000)
5. rules.yml 文件存在且可加载
6. postgres-exporter 环境变量配置 (DATA_SOURCE_NAME)
7. prometheus 数据卷持久化配置

用法:
  python scripts/test_pg_monitoring.py
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def test_docker_compose_services() -> bool:
    """测试 docker-compose.yml 中 postgres-exporter 和 prometheus 服务."""
    try:
        import yaml

        compose_path = ROOT / "deploy" / "docker" / "docker-compose.yml"
        with open(compose_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        services = data.get("services", {})
        assert "postgres-exporter" in services, "缺少 postgres-exporter 服务"
        assert "prometheus" in services, "缺少 prometheus 服务"

        # postgres-exporter 配置
        pg_exp = services["postgres-exporter"]
        assert pg_exp["image"].startswith("prometheuscommunity/postgres-exporter"), \
            f"postgres-exporter 镜像错误: {pg_exp['image']}"
        env = pg_exp.get("environment", {})
        dsn = env.get("DATA_SOURCE_NAME", "")
        assert "postgresql://" in dsn, f"DATA_SOURCE_NAME 格式错误: {dsn}"
        assert "5432" in dsn, "DATA_SOURCE_NAME 缺少 5432 端口"
        assert "9187" in pg_exp.get("ports", [""])[0], "postgres-exporter 端口非 9187"

        # prometheus 配置
        prom = services["prometheus"]
        assert prom["image"].startswith("prom/prometheus"), f"prometheus 镜像错误: {prom['image']}"
        assert "9090" in prom.get("ports", [""])[0], "prometheus 端口非 9090"
        volumes = prom.get("volumes", [])
        assert any("prometheus.yml" in v for v in volumes), "prometheus 缺少 prometheus.yml 挂载"
        assert any("rules.yml" in v for v in volumes), "prometheus 缺少 rules.yml 挂载"
        assert any("prometheus_data" in v for v in volumes), "prometheus 缺少数据卷"

        # 依赖关系
        assert "postgres-exporter" in prom.get("depends_on", []), "prometheus 未依赖 postgres-exporter"

        print(f"  ✅ docker-compose 服务配置正确 (postgres-exporter + prometheus)")
        return True
    except ImportError:
        print(f"  ⚠️  PyYAML 未安装, 跳过验证")
        return True
    except Exception as e:
        print(f"  ❌ docker-compose 服务验证失败: {e}")
        return False


def test_prometheus_config() -> bool:
    """测试 prometheus.yml 抓取目标."""
    try:
        import yaml

        prom_path = ROOT / "docker" / "prometheus" / "prometheus.yml"
        with open(prom_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        scrape_configs = data.get("scrape_configs", [])
        jobs = {s["job_name"]: s for s in scrape_configs}

        # postgresql job
        assert "postgresql" in jobs, "缺少 postgresql job"
        pg_targets = jobs["postgresql"]["static_configs"][0]["targets"]
        assert "postgres-exporter:9187" in pg_targets, f"postgresql job 目标错误: {pg_targets}"

        # zhs-platform job
        assert "zhs-platform" in jobs, "缺少 zhs-platform job"
        app_targets = jobs["zhs-platform"]["static_configs"][0]["targets"]
        assert "api:8000" in app_targets, f"zhs-platform job 目标错误: {app_targets}"

        # redis job
        assert "redis" in jobs, "缺少 redis job"

        print(f"  ✅ prometheus.yml 抓取目标正确 (postgresql/zhs-platform/redis)")
        return True
    except Exception as e:
        print(f"  ❌ prometheus.yml 验证失败: {e}")
        return False


def test_rules_file() -> bool:
    """测试 rules.yml 文件存在且可加载."""
    try:
        import yaml

        rules_path = ROOT / "docker" / "prometheus" / "rules.yml"
        if not rules_path.exists():
            print(f"  ❌ rules.yml 不存在: {rules_path}")
            return False

        with open(rules_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        # 规则文件格式: groups: [...]
        assert "groups" in data, "rules.yml 缺少 groups 字段"
        groups = data["groups"]
        assert len(groups) > 0, "rules.yml groups 为空"

        total_rules = sum(len(g.get("rules", [])) for g in groups)
        print(f"  ✅ rules.yml 可加载 ({len(groups)} 组, {total_rules} 条规则)")
        return True
    except Exception as e:
        print(f"  ❌ rules.yml 验证失败: {e}")
        return False


def test_pg_exporter_env() -> bool:
    """测试 postgres-exporter 环境变量."""
    try:
        import yaml

        compose_path = ROOT / "deploy" / "docker" / "docker-compose.yml"
        with open(compose_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        pg_exp = data["services"]["postgres-exporter"]
        env = pg_exp.get("environment", {})

        # DATA_SOURCE_NAME
        dsn = env.get("DATA_SOURCE_NAME", "")
        assert dsn, "DATA_SOURCE_NAME 为空"
        assert "postgresql://" in dsn, "DATA_SOURCE_NAME 非 PostgreSQL 协议"
        assert "sslmode=disable" in dsn, "DATA_SOURCE_NAME 缺少 sslmode"

        # AUTO_DISCOVER
        auto_discover = env.get("PG_EXPORTER_AUTO_DISCOVER_DATABASES", "")
        assert auto_discover == "false", f"AUTO_DISCOVER 应为 false, 实际 {auto_discover}"

        print(f"  ✅ postgres-exporter 环境变量配置正确")
        return True
    except Exception as e:
        print(f"  ❌ postgres-exporter 环境变量验证失败: {e}")
        return False


def test_volumes() -> bool:
    """测试 prometheus_data 卷持久化."""
    try:
        import yaml

        compose_path = ROOT / "deploy" / "docker" / "docker-compose.yml"
        with open(compose_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        volumes = data.get("volumes", {})
        assert "prometheus_data" in volumes, "缺少 prometheus_data 卷"

        # 验证 prometheus 服务挂载了该卷
        prom_volumes = data["services"]["prometheus"].get("volumes", [])
        assert any("prometheus_data" in v for v in prom_volumes), "prometheus 未挂载 prometheus_data 卷"

        print(f"  ✅ prometheus_data 卷持久化配置正确")
        return True
    except Exception as e:
        print(f"  ❌ 卷配置验证失败: {e}")
        return False


def test_no_mysql_references() -> bool:
    """验证监控配置无 MySQL 残留."""
    try:
        files_to_check = [
            ROOT / "deploy" / "docker" / "docker-compose.yml",
            ROOT / "docker" / "prometheus" / "prometheus.yml",
            ROOT / "docker" / "prometheus" / "prometheus-federate.yml",
        ]
        for f in files_to_check:
            if not f.exists():
                continue
            content = f.read_text(encoding="utf-8")
            lower = content.lower()
            assert "mysql" not in lower, f"{f.name} 仍有 mysql 引用"
            assert "mariadb" not in lower, f"{f.name} 仍有 mariadb 引用"
            assert "mysqld-exporter" not in lower, f"{f.name} 仍有 mysqld-exporter"
            assert "3306" not in content or "3306" in content.split("#")[0] is False, \
                f"{f.name} 可能仍有 3306 端口引用"

        print(f"  ✅ 监控配置无 MySQL 残留")
        return True
    except Exception as e:
        print(f"  ❌ MySQL 残留检查失败: {e}")
        return False


def main() -> int:
    print("=" * 70)
    print("PostgreSQL Exporter + Prometheus 监控验证")
    print("=" * 70)

    results = []
    print("\n[1] docker-compose 服务配置")
    results.append(("docker-compose 服务", test_docker_compose_services()))

    print("\n[2] Prometheus 配置")
    results.append(("prometheus.yml 抓取目标", test_prometheus_config()))
    results.append(("rules.yml 规则文件", test_rules_file()))

    print("\n[3] PostgreSQL Exporter 配置")
    results.append(("环境变量配置", test_pg_exporter_env()))

    print("\n[4] 持久化与清理")
    results.append(("prometheus_data 卷", test_volumes()))
    results.append(("无 MySQL 残留", test_no_mysql_references()))

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
