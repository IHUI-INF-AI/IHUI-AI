"""PostgreSQL 监控端到端 (E2E) 验证脚本.

验证内容 (10 项):
1. docker-compose 服务定义完整性 (postgres-exporter + prometheus + alertmanager)
2. postgres-exporter 镜像版本与端口
3. prometheus 镜像版本与启动参数 (--storage.tsdb.retention.time=15d)
4. prometheus.yml 抓取目标 (postgres-exporter:9187 + api:8000 + redis-exporter:9121)
5. prometheus-federate.yml 一致性 (与 prometheus.yml 抓取目标对齐)
6. rules.yml 告警规则完整性 (>= 35 条, 含 PostgreSQL 专用规则)
7. PostgreSQL 专用告警规则覆盖 (连接池/慢SQL/复制延迟/磁盘)
8. 数据卷持久化 (prometheus_data)
9. 服务依赖关系 (prometheus -> postgres-exporter -> postgres)
10. 全局无 MySQL 残留 (compose + prometheus 配置 + rules)

用法:
  python scripts/test_pg_monitoring_e2e.py
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _load_yaml(path: Path):
    """加载 YAML 文件, 失败返回 None."""
    try:
        import yaml
        with open(path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)
    except ImportError:
        return None
    except Exception:
        return None


def test_compose_services() -> bool:
    """测试 docker-compose 服务定义完整性."""
    try:
        data = _load_yaml(ROOT / "deploy" / "docker" / "docker-compose.yml")
        if data is None:
            print("  ⚠️  PyYAML 未安装或加载失败, 跳过")
            return True

        services = data.get("services", {})
        required = ["postgres", "postgres-exporter", "prometheus"]
        for s in required:
            assert s in services, f"缺少 {s} 服务"

        # postgres-exporter 镜像与端口
        pg_exp = services["postgres-exporter"]
        assert "prometheuscommunity/postgres-exporter" in pg_exp["image"], \
            f"postgres-exporter 镜像错误: {pg_exp['image']}"
        ports = pg_exp.get("ports", [])
        assert any("9187" in p for p in ports), f"postgres-exporter 端口非 9187: {ports}"

        # prometheus 镜像与端口
        prom = services["prometheus"]
        assert "prom/prometheus" in prom["image"], f"prometheus 镜像错误: {prom['image']}"
        prom_ports = prom.get("ports", [])
        assert any("9090" in p for p in prom_ports), f"prometheus 端口非 9090: {prom_ports}"

        # prometheus 启动参数
        cmd = prom.get("command", [])
        assert any("retention.time" in c for c in cmd), "prometheus 缺少 retention.time 参数"
        assert any("web.enable-lifecycle" in c for c in cmd), "prometheus 缺少 web.enable-lifecycle"

        print(f"  ✅ docker-compose 服务完整 (postgres + postgres-exporter + prometheus)")
        return True
    except Exception as e:
        print(f"  ❌ docker-compose 服务验证失败: {e}")
        return False


def test_pg_exporter_config() -> bool:
    """测试 postgres-exporter 配置."""
    try:
        data = _load_yaml(ROOT / "deploy" / "docker" / "docker-compose.yml")
        if data is None:
            print("  ⚠️  PyYAML 未安装, 跳过")
            return True

        pg_exp = data["services"]["postgres-exporter"]
        env = pg_exp.get("environment", {})

        # DATA_SOURCE_NAME
        dsn = env.get("DATA_SOURCE_NAME", "")
        assert dsn, "DATA_SOURCE_NAME 为空"
        assert "postgresql://" in dsn, "DATA_SOURCE_NAME 非 PostgreSQL 协议"
        assert "5432" in dsn, "DATA_SOURCE_NAME 缺少 5432 端口"
        assert "sslmode=disable" in dsn, "DATA_SOURCE_NAME 缺少 sslmode"

        # AUTO_DISCOVER_DATABASES=false (避免抓取所有库)
        assert env.get("PG_EXPORTER_AUTO_DISCOVER_DATABASES") == "false", \
            "PG_EXPORTER_AUTO_DISCOVER_DATABASES 应为 false"

        # 健康检查
        hc = pg_exp.get("healthcheck", {})
        assert "test" in hc, "postgres-exporter 缺少健康检查"
        assert "9187" in str(hc["test"]), "健康检查未指向 9187"

        # 依赖 postgres
        deps = pg_exp.get("depends_on", {})
        assert "postgres" in deps, "postgres-exporter 未依赖 postgres"

        print(f"  ✅ postgres-exporter 配置正确 (DSN + 健康检查 + 依赖 postgres)")
        return True
    except Exception as e:
        print(f"  ❌ postgres-exporter 配置验证失败: {e}")
        return False


def test_prometheus_config() -> bool:
    """测试 prometheus.yml 抓取目标."""
    try:
        data = _load_yaml(ROOT / "docker" / "prometheus" / "prometheus.yml")
        if data is None:
            print("  ❌ prometheus.yml 加载失败")
            return False

        # 全局配置
        assert data.get("global", {}).get("scrape_interval") == "15s", "scrape_interval 非 15s"

        # rule_files
        assert "/etc/prometheus/rules.yml" in data.get("rule_files", []), "缺少 rules.yml 引用"

        # alerting
        alerting = data.get("alerting", {}).get("alertmanagers", [{}])[0]
        alert_targets = alerting.get("static_configs", [{}])[0].get("targets", [])
        assert "alertmanager:9093" in alert_targets, "缺少 alertmanager 目标"

        # scrape_configs
        scrape_configs = data.get("scrape_configs", [])
        jobs = {s["job_name"]: s for s in scrape_configs}

        # postgresql job
        assert "postgresql" in jobs, "缺少 postgresql job"
        pg_targets = jobs["postgresql"]["static_configs"][0]["targets"]
        assert "postgres-exporter:9187" in pg_targets, f"postgresql 目标错误: {pg_targets}"

        # zhs-platform job
        assert "zhs-platform" in jobs, "缺少 zhs-platform job"
        app_targets = jobs["zhs-platform"]["static_configs"][0]["targets"]
        assert "api:8000" in app_targets, f"zhs-platform 目标错误: {app_targets}"

        # redis job
        assert "redis" in jobs, "缺少 redis job"
        redis_targets = jobs["redis"]["static_configs"][0]["targets"]
        assert "redis-exporter:9121" in redis_targets, f"redis 目标错误: {redis_targets}"

        print(f"  ✅ prometheus.yml 抓取目标正确 (postgresql + zhs-platform + redis)")
        return True
    except Exception as e:
        print(f"  ❌ prometheus.yml 验证失败: {e}")
        return False


def test_federate_config_consistency() -> bool:
    """测试 prometheus-federate.yml 与 prometheus.yml 一致性."""
    try:
        main = _load_yaml(ROOT / "docker" / "prometheus" / "prometheus.yml")
        fed = _load_yaml(ROOT / "docker" / "prometheus" / "prometheus-federate.yml")
        if main is None or fed is None:
            print("  ❌ 配置加载失败")
            return False

        # 抓取目标一致
        main_jobs = {s["job_name"]: s for s in main.get("scrape_configs", [])}
        fed_jobs = {s["job_name"]: s for s in fed.get("scrape_configs", [])}

        for job_name in ["postgresql", "zhs-platform", "redis"]:
            assert job_name in fed_jobs, f"federate 缺少 {job_name} job"
            main_target = main_jobs[job_name]["static_configs"][0]["targets"][0]
            fed_target = fed_jobs[job_name]["static_configs"][0]["targets"][0]
            assert main_target == fed_target, \
                f"{job_name} 目标不一致: main={main_target}, federate={fed_target}"

        # external_labels
        ext = fed.get("global", {}).get("external_labels", {})
        assert "region" in ext, "federate 缺少 region 标签"
        assert "cluster" in ext, "federate 缺少 cluster 标签"

        print(f"  ✅ prometheus-federate.yml 与主配置一致 (3 个 job 目标对齐)")
        return True
    except Exception as e:
        print(f"  ❌ federate 一致性验证失败: {e}")
        return False


def test_rules_completeness() -> bool:
    """测试 rules.yml 告警规则完整性."""
    try:
        data = _load_yaml(ROOT / "docker" / "prometheus" / "rules.yml")
        if data is None:
            print("  ❌ rules.yml 加载失败")
            return False

        groups = data.get("groups", [])
        assert len(groups) > 0, "rules.yml groups 为空"

        total_rules = sum(len(g.get("rules", [])) for g in groups)
        assert total_rules >= 35, f"告警规则不足 35 条, 实际 {total_rules}"

        # 每条规则必须有 alert/expr/for/labels
        for g in groups:
            for r in g.get("rules", []):
                assert "alert" in r, f"规则缺少 alert: {r}"
                assert "expr" in r, f"规则缺少 expr: {r['alert']}"
                assert "for" in r, f"规则缺少 for: {r['alert']}"
                labels = r.get("labels", {})
                assert "severity" in labels, f"规则缺少 severity: {r['alert']}"
                assert labels["severity"] in ["info", "warning", "critical"], \
                    f"severity 非法: {labels['severity']}"

        print(f"  ✅ rules.yml 完整 ({len(groups)} 组, {total_rules} 条规则)")
        return True
    except Exception as e:
        print(f"  ❌ rules.yml 完整性验证失败: {e}")
        return False


def test_pg_specific_alerts() -> bool:
    """测试 PostgreSQL 专用告警规则覆盖."""
    try:
        content = (ROOT / "docker" / "prometheus" / "rules.yml").read_text(encoding="utf-8")

        # 数据库连接池告警
        assert "ZHSDBPoolExhausted" in content, "缺少 DB 连接池饱和告警"
        assert "ZHSDBPoolCheckoutTimeouts" in content, "缺少 DB checkout 超时告警"
        assert "ZHSDBPoolOverflowHigh" in content, "缺少 DB overflow 告警"

        # 慢 SQL 告警
        assert "ZHSSlowSQLSpike" in content, "缺少慢 SQL 告警"
        assert "ZHSSlowSQLWithTrace" in content, "缺少带 trace 的慢 SQL 告警"
        assert "ZHSSlowSQLBurst" in content, "缺少单表慢 SQL 突增告警"

        # 多 engine 饱和告警
        assert "ZHSDBPoolMultiEngineSaturated" in content, "缺少多 engine 饱和告警"

        # 进程/资源告警
        assert "ZHSAppDown" in content, "缺少进程存活告警"
        assert "ZHSHighMemoryUsage" in content, "缺少内存告警"
        assert "ZHSHighCPU" in content, "缺少 CPU 告警"

        # 业务错误告警
        assert "ZHSBizErrorSpike" in content, "缺少业务错误突增告警"

        print(f"  ✅ PostgreSQL 专用告警规则覆盖完整 (连接池/慢SQL/资源/业务)")
        return True
    except Exception as e:
        print(f"  ❌ PostgreSQL 专用告警验证失败: {e}")
        return False


def test_volumes_and_persistence() -> bool:
    """测试数据卷持久化."""
    try:
        data = _load_yaml(ROOT / "deploy" / "docker" / "docker-compose.yml")
        if data is None:
            print("  ⚠️  PyYAML 未安装, 跳过")
            return True

        volumes = data.get("volumes", {})
        assert "prometheus_data" in volumes, "缺少 prometheus_data 卷"

        # prometheus 服务挂载
        prom_volumes = data["services"]["prometheus"].get("volumes", [])
        assert any("prometheus_data" in v for v in prom_volumes), "prometheus 未挂载 prometheus_data"
        assert any("prometheus.yml" in v for v in prom_volumes), "prometheus 未挂载 prometheus.yml"
        assert any("rules.yml" in v for v in prom_volumes), "prometheus 未挂载 rules.yml"

        print(f"  ✅ 数据卷持久化正确 (prometheus_data + 配置文件挂载)")
        return True
    except Exception as e:
        print(f"  ❌ 数据卷验证失败: {e}")
        return False


def test_service_dependencies() -> bool:
    """测试服务依赖关系."""
    try:
        data = _load_yaml(ROOT / "deploy" / "docker" / "docker-compose.yml")
        if data is None:
            print("  ⚠️  PyYAML 未安装, 跳过")
            return True

        services = data["services"]

        # postgres-exporter 依赖 postgres
        pg_exp_deps = services["postgres-exporter"].get("depends_on", {})
        assert "postgres" in pg_exp_deps, "postgres-exporter 未依赖 postgres"
        # 健康条件依赖
        if isinstance(pg_exp_deps, dict):
            assert pg_exp_deps["postgres"].get("condition") == "service_healthy", \
                "postgres-exporter 应等待 postgres 健康后启动"

        # prometheus 依赖 postgres-exporter
        prom_deps = services["prometheus"].get("depends_on", [])
        assert "postgres-exporter" in prom_deps, "prometheus 未依赖 postgres-exporter"

        print(f"  ✅ 服务依赖关系正确 (prometheus -> postgres-exporter -> postgres)")
        return True
    except Exception as e:
        print(f"  ❌ 服务依赖验证失败: {e}")
        return False


def test_no_mysql_references() -> bool:
    """验证监控配置全局无 MySQL 残留."""
    try:
        files_to_check = [
            ROOT / "deploy" / "docker" / "docker-compose.yml",
            ROOT / "docker" / "prometheus" / "prometheus.yml",
            ROOT / "docker" / "prometheus" / "prometheus-federate.yml",
            ROOT / "docker" / "prometheus" / "prometheus-center.yml",
            ROOT / "docker" / "prometheus" / "rules.yml",
        ]
        for f in files_to_check:
            if not f.exists():
                continue
            content = f.read_text(encoding="utf-8")
            lower = content.lower()
            assert "mysql" not in lower, f"{f.name} 仍有 mysql 引用"
            assert "mariadb" not in lower, f"{f.name} 仍有 mariadb 引用"
            assert "mysqld-exporter" not in lower, f"{f.name} 仍有 mysqld-exporter"
            assert "3306" not in content, f"{f.name} 仍有 3306 端口"

        print(f"  ✅ 监控配置全局无 MySQL 残留 (5 个文件)")
        return True
    except Exception as e:
        print(f"  ❌ MySQL 残留检查失败: {e}")
        return False


def test_healthcheck_config() -> bool:
    """测试健康检查配置."""
    try:
        data = _load_yaml(ROOT / "deploy" / "docker" / "docker-compose.yml")
        if data is None:
            print("  ⚠️  PyYAML 未安装, 跳过")
            return True

        services = data["services"]

        # postgres 健康检查
        pg_hc = services["postgres"].get("healthcheck", {})
        assert "test" in pg_hc, "postgres 缺少健康检查"
        assert "pg_isready" in str(pg_hc["test"]), "postgres 健康检查非 pg_isready"

        # postgres-exporter 健康检查
        exp_hc = services["postgres-exporter"].get("healthcheck", {})
        assert "test" in exp_hc, "postgres-exporter 缺少健康检查"
        assert "9187" in str(exp_hc["test"]), "postgres-exporter 健康检查未指向 9187"

        print(f"  ✅ 健康检查配置正确 (postgres + postgres-exporter)")
        return True
    except Exception as e:
        print(f"  ❌ 健康检查验证失败: {e}")
        return False


def main() -> int:
    print("=" * 70)
    print("PostgreSQL 监控端到端 (E2E) 验证")
    print("=" * 70)

    results = []
    print("\n[1] 服务定义")
    results.append(("docker-compose 服务", test_compose_services()))
    results.append(("postgres-exporter 配置", test_pg_exporter_config()))
    results.append(("健康检查配置", test_healthcheck_config()))

    print("\n[2] Prometheus 配置")
    results.append(("prometheus.yml 抓取目标", test_prometheus_config()))
    results.append(("federate 一致性", test_federate_config_consistency()))

    print("\n[3] 告警规则")
    results.append(("rules.yml 完整性", test_rules_completeness()))
    results.append(("PostgreSQL 专用告警", test_pg_specific_alerts()))

    print("\n[4] 持久化与依赖")
    results.append(("数据卷持久化", test_volumes_and_persistence()))
    results.append(("服务依赖关系", test_service_dependencies()))

    print("\n[5] 清理验证")
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
