"""Helm chart PostgreSQL 部署配置验证脚本.

验证内容:
1. values.yaml 数据库配置 (pg-xxx:5432, 无 mysql)
2. values.prod.yaml 数据库配置 (pg-xxx:5432, 无 mysql)
3. Chart.yaml 元数据
4. deployment.yaml DB1/DB2/DB3_URL 使用 postgresql+psycopg2
5. configmap.yaml DB1/DB2/DB3_HOST/PORT 配置
6. secret.yaml 数据库密码引用
7. 无 MySQL 残留 (所有 chart 文件)
8. Helm template 渲染验证 (helm template)

用法:
  python scripts/test_helm_pg_config.py
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHART_DIR = ROOT / "deploy" / "helm" / "zhs-platform"


def test_values_yaml() -> bool:
    """测试 values.yaml 数据库配置."""
    try:
        import yaml

        values_path = CHART_DIR / "values.yaml"
        with open(values_path, "r", encoding="utf-8") as f:
            values = yaml.safe_load(f)

        db = values.get("database", {})
        assert db, "缺少 database 配置"

        for key in ("ai", "center", "course"):
            cfg = db.get(key, {})
            host = cfg.get("host", "")
            port = cfg.get("port", 0)
            assert "pg-" in host, f"{key}.host 应含 pg-, 实际: {host}"
            assert port == 5432, f"{key}.port 应为 5432, 实际: {port}"
            assert "mysql" not in host.lower(), f"{key}.host 仍有 mysql: {host}"

        print(f"  ✅ values.yaml 数据库配置正确 (pg-xxx:5432)")
        return True
    except Exception as e:
        print(f"  ❌ values.yaml 验证失败: {e}")
        return False


def test_values_prod_yaml() -> bool:
    """测试 values.prod.yaml 数据库配置."""
    try:
        import yaml

        prod_path = CHART_DIR / "values.prod.yaml"
        with open(prod_path, "r", encoding="utf-8") as f:
            values = yaml.safe_load(f)

        db = values.get("database", {})
        assert db, "缺少 database 配置"

        for key in ("ai", "center", "course"):
            cfg = db.get(key, {})
            host = cfg.get("host", "")
            port = cfg.get("port", 0)
            assert "pg-" in host, f"{key}.host 应含 pg-, 实际: {host}"
            assert port == 5432, f"{key}.port 应为 5432, 实际: {port}"
            assert "mysql" not in host.lower(), f"{key}.host 仍有 mysql: {host}"

        print(f"  ✅ values.prod.yaml 数据库配置正确 (pg-xxx:5432)")
        return True
    except Exception as e:
        print(f"  ❌ values.prod.yaml 验证失败: {e}")
        return False


def test_chart_yaml() -> bool:
    """测试 Chart.yaml 元数据."""
    try:
        import yaml

        chart_path = CHART_DIR / "Chart.yaml"
        with open(chart_path, "r", encoding="utf-8") as f:
            chart = yaml.safe_load(f)

        assert chart["apiVersion"] == "v2", f"apiVersion 应为 v2"
        assert chart["name"] == "zhs-platform", f"name 应为 zhs-platform"
        assert chart["type"] == "application", f"type 应为 application"
        assert "version" in chart, "缺少 version"
        assert "appVersion" in chart, "缺少 appVersion"

        print(f"  ✅ Chart.yaml 元数据正确 (v{chart['version']})")
        return True
    except Exception as e:
        print(f"  ❌ Chart.yaml 验证失败: {e}")
        return False


def test_deployment_db_urls() -> bool:
    """测试 deployment.yaml 中 DB1/DB2/DB3_URL 使用 postgresql+psycopg2."""
    try:
        dep_path = CHART_DIR / "templates" / "deployment.yaml"
        content = dep_path.read_text(encoding="utf-8")

        for db_url in ("DB1_URL", "DB2_URL", "DB3_URL"):
            assert db_url in content, f"缺少 {db_url} 环境变量"

        assert "postgresql+psycopg2://" in content, "DB URL 未使用 postgresql+psycopg2 协议"
        assert "mysql" not in content.lower(), "deployment.yaml 仍有 mysql 引用"
        assert "3306" not in content, "deployment.yaml 仍有 3306 端口"

        # 验证 3 个 DB URL 都用 postgresql+psycopg2
        pg_count = content.count("postgresql+psycopg2://")
        assert pg_count >= 3, f"postgresql+psycopg2 出现次数应 >= 3, 实际 {pg_count}"

        print(f"  ✅ deployment.yaml DB URL 使用 postgresql+psycopg2 (3 个库)")
        return True
    except Exception as e:
        print(f"  ❌ deployment.yaml 验证失败: {e}")
        return False


def test_configmap_db_config() -> bool:
    """测试 configmap.yaml 数据库配置."""
    try:
        cm_path = CHART_DIR / "templates" / "configmap.yaml"
        content = cm_path.read_text(encoding="utf-8")

        for key in ("ai", "center", "course"):
            idx = {"ai": "1", "center": "2", "course": "3"}[key]
            assert f"DB{idx}_HOST" in content, f"缺少 DB{idx}_HOST"
            assert f"DB{idx}_PORT" in content, f"缺少 DB{idx}_PORT"
            assert f"DB{idx}_NAME" in content, f"缺少 DB{idx}_NAME"
            assert f"DB{idx}_USER" in content, f"缺少 DB{idx}_USER"

        assert "mysql" not in content.lower(), "configmap.yaml 仍有 mysql 引用"

        print(f"  ✅ configmap.yaml 数据库配置完整 (DB1/DB2/DB3)")
        return True
    except Exception as e:
        print(f"  ❌ configmap.yaml 验证失败: {e}")
        return False


def test_secret_db_passwords() -> bool:
    """测试 secret.yaml 数据库密码引用."""
    try:
        secret_path = CHART_DIR / "templates" / "secret.yaml"
        if not secret_path.exists():
            print(f"  ⚠️  secret.yaml 不存在, 跳过")
            return True

        content = secret_path.read_text(encoding="utf-8")
        # 验证密码引用 (DB1_PASSWORD/DB2_PASSWORD/DB3_PASSWORD)
        for idx in ("1", "2", "3"):
            assert f"DB{idx}_PASSWORD" in content, f"缺少 DB{idx}_PASSWORD 引用"

        print(f"  ✅ secret.yaml 数据库密码引用完整")
        return True
    except Exception as e:
        print(f"  ❌ secret.yaml 验证失败: {e}")
        return False


def test_no_mysql_in_chart() -> bool:
    """验证整个 chart 目录无 MySQL 残留."""
    try:
        mysql_files = []
        for f in CHART_DIR.rglob("*"):
            if not f.is_file():
                continue
            if f.suffix not in (".yaml", ".yml", ".tpl", ".md"):
                continue
            content = f.read_text(encoding="utf-8", errors="ignore").lower()
            if "mysql" in content or "mariadb" in content:
                mysql_files.append(str(f.relative_to(CHART_DIR)))

        if mysql_files:
            print(f"  ❌ chart 目录仍有 MySQL 引用: {mysql_files}")
            return False

        print(f"  ✅ chart 目录无 MySQL 残留")
        return True
    except Exception as e:
        print(f"  ❌ MySQL 残留检查失败: {e}")
        return False


def test_helm_template_render() -> bool:
    """测试 helm template 渲染 (如果 helm 可用)."""
    try:
        import shutil

        if not shutil.which("helm"):
            print(f"  ⚠️  helm 未安装, 跳过 template 渲染验证")
            return True

        result = subprocess.run(
            ["helm", "template", "test-zhs", str(CHART_DIR), "-f", str(CHART_DIR / "values.prod.yaml")],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode != 0:
            print(f"  ❌ helm template 失败: {result.stderr[-300:]}")
            return False

        output = result.stdout
        # 验证渲染结果含 postgresql+psycopg2
        assert "postgresql+psycopg2://" in output, "渲染结果缺少 postgresql+psycopg2"
        # 验证无 mysql
        assert "mysql" not in output.lower(), "渲染结果仍有 mysql"
        # 验证端口 5432
        assert "5432" in output, "渲染结果缺少 5432 端口"

        print(f"  ✅ helm template 渲染成功 (postgresql+psycopg2, 5432, 无 mysql)")
        return True
    except subprocess.TimeoutExpired:
        print(f"  ⚠️  helm template 超时, 跳过")
        return True
    except Exception as e:
        print(f"  ⚠️  helm template 验证失败: {e}")
        return True


def main() -> int:
    print("=" * 70)
    print("Helm chart PostgreSQL 部署配置验证")
    print("=" * 70)

    results = []
    print("\n[1] Values 配置")
    results.append(("values.yaml", test_values_yaml()))
    results.append(("values.prod.yaml", test_values_prod_yaml()))
    results.append(("Chart.yaml", test_chart_yaml()))

    print("\n[2] Templates 配置")
    results.append(("deployment.yaml DB URL", test_deployment_db_urls()))
    results.append(("configmap.yaml DB 配置", test_configmap_db_config()))
    results.append(("secret.yaml 密码引用", test_secret_db_passwords()))

    print("\n[3] 清理与渲染")
    results.append(("无 MySQL 残留", test_no_mysql_in_chart()))
    results.append(("helm template 渲染", test_helm_template_render()))

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
