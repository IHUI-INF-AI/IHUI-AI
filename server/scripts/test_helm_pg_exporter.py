"""Helm chart PostgreSQL exporter 验证脚本.

验证内容 (10 项):
1. values.yaml 包含 postgresExporter 配置
2. postgresExporter.enabled = true
3. postgresExporter.image = prometheuscommunity/postgres-exporter:v0.15.0
4. postgresExporter.port = 9187
5. postgresExporter.datasourceSecret 配置
6. templates/postgres-exporter.yaml 模板存在
7. 模板包含 Deployment + Service
8. 模板使用 DATA_SOURCE_NAME 环境变量
9. 模板包含健康检查 (liveness + readiness)
10. 模板受 postgresExporter.enabled 控制

用法:
  python scripts/test_helm_pg_exporter.py
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VALUES = ROOT / "deploy" / "helm" / "zhs-platform" / "values.yaml"
TEMPLATE = ROOT / "deploy" / "helm" / "zhs-platform" / "templates" / "postgres-exporter.yaml"


def _load_values():
    """加载 values.yaml."""
    try:
        import yaml
        with open(VALUES, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)
    except ImportError:
        return None
    except Exception:
        return None


def test_values_has_pg_exporter() -> bool:
    """测试 values.yaml 包含 postgresExporter 配置."""
    try:
        data = _load_values()
        if data is None:
            print("  ⚠️  PyYAML 未安装, 使用文本检查")
            content = VALUES.read_text(encoding="utf-8")
            assert "postgresExporter:" in content, "values.yaml 缺少 postgresExporter 配置"
            print(f"  ✅ values.yaml 包含 postgresExporter 配置 (文本检查)")
            return True

        assert "postgresExporter" in data, "values.yaml 缺少 postgresExporter 配置"
        pg_exp = data["postgresExporter"]
        assert "enabled" in pg_exp, "postgresExporter 缺少 enabled"
        assert "image" in pg_exp, "postgresExporter 缺少 image"
        assert "port" in pg_exp, "postgresExporter 缺少 port"
        assert "datasourceSecret" in pg_exp, "postgresExporter 缺少 datasourceSecret"
        assert "resources" in pg_exp, "postgresExporter 缺少 resources"

        print(f"  ✅ values.yaml postgresExporter 配置完整")
        return True
    except Exception as e:
        print(f"  ❌ values.yaml 验证失败: {e}")
        return False


def test_pg_exporter_enabled() -> bool:
    """测试 postgresExporter.enabled = true."""
    try:
        data = _load_values()
        if data is None:
            content = VALUES.read_text(encoding="utf-8")
            assert "enabled: true" in content, "postgresExporter.enabled 非 true"
            print(f"  ✅ postgresExporter.enabled = true (文本检查)")
            return True

        assert data["postgresExporter"]["enabled"] is True, "postgresExporter.enabled 非 true"
        print(f"  ✅ postgresExporter.enabled = true")
        return True
    except Exception as e:
        print(f"  ❌ enabled 验证失败: {e}")
        return False


def test_pg_exporter_image() -> bool:
    """测试 postgresExporter.image = prometheuscommunity/postgres-exporter:v0.15.0."""
    try:
        data = _load_values()
        if data is None:
            content = VALUES.read_text(encoding="utf-8")
            assert "prometheuscommunity/postgres-exporter:v0.15.0" in content, \
                "postgresExporter.image 非 v0.15.0"
            print(f"  ✅ postgresExporter.image = prometheuscommunity/postgres-exporter:v0.15.0 (文本检查)")
            return True

        image = data["postgresExporter"]["image"]
        assert image == "prometheuscommunity/postgres-exporter:v0.15.0", \
            f"postgresExporter.image 错误: {image}"
        print(f"  ✅ postgresExporter.image = {image}")
        return True
    except Exception as e:
        print(f"  ❌ image 验证失败: {e}")
        return False


def test_pg_exporter_port() -> bool:
    """测试 postgresExporter.port = 9187."""
    try:
        data = _load_values()
        if data is None:
            content = VALUES.read_text(encoding="utf-8")
            assert "port: 9187" in content, "postgresExporter.port 非 9187"
            print(f"  ✅ postgresExporter.port = 9187 (文本检查)")
            return True

        port = data["postgresExporter"]["port"]
        assert port == 9187, f"postgresExporter.port 非 9187: {port}"
        print(f"  ✅ postgresExporter.port = {port}")
        return True
    except Exception as e:
        print(f"  ❌ port 验证失败: {e}")
        return False


def test_pg_exporter_datasource_secret() -> bool:
    """测试 postgresExporter.datasourceSecret 配置."""
    try:
        data = _load_values()
        if data is None:
            content = VALUES.read_text(encoding="utf-8")
            assert "datasourceSecret:" in content, "缺少 datasourceSecret"
            assert "datasourceKey:" in content, "缺少 datasourceKey"
            print(f"  ✅ postgresExporter.datasourceSecret 配置存在 (文本检查)")
            return True

        pg_exp = data["postgresExporter"]
        assert "datasourceSecret" in pg_exp, "缺少 datasourceSecret"
        assert "datasourceKey" in pg_exp, "缺少 datasourceKey"
        assert pg_exp["datasourceSecret"], "datasourceSecret 为空"
        assert pg_exp["datasourceKey"], "datasourceKey 为空"

        print(f"  ✅ datasourceSecret={pg_exp['datasourceSecret']}, key={pg_exp['datasourceKey']}")
        return True
    except Exception as e:
        print(f"  ❌ datasourceSecret 验证失败: {e}")
        return False


def test_template_exists() -> bool:
    """测试 templates/postgres-exporter.yaml 模板存在."""
    try:
        assert TEMPLATE.exists(), f"模板不存在: {TEMPLATE}"
        content = TEMPLATE.read_text(encoding="utf-8")
        assert len(content) > 0, "模板内容为空"
        print(f"  ✅ templates/postgres-exporter.yaml 存在 ({len(content)} 字节)")
        return True
    except Exception as e:
        print(f"  ❌ 模板存在性验证失败: {e}")
        return False


def test_template_has_deployment_and_service() -> bool:
    """测试模板包含 Deployment + Service."""
    try:
        content = TEMPLATE.read_text(encoding="utf-8")
        assert "kind: Deployment" in content, "模板缺少 Deployment"
        assert "kind: Service" in content, "模板缺少 Service"
        assert "apps/v1" in content, "模板缺少 apps/v1 API"
        assert "v1" in content, "模板缺少 v1 API"

        print(f"  ✅ 模板包含 Deployment + Service")
        return True
    except Exception as e:
        print(f"  ❌ Deployment/Service 验证失败: {e}")
        return False


def test_template_uses_dsn_env() -> bool:
    """测试模板使用 DATA_SOURCE_NAME 环境变量."""
    try:
        content = TEMPLATE.read_text(encoding="utf-8")
        assert "DATA_SOURCE_NAME" in content, "模板缺少 DATA_SOURCE_NAME 环境变量"
        assert "secretKeyRef" in content, "模板缺少 secretKeyRef"
        assert "datasourceSecret" in content, "模板未引用 datasourceSecret"
        assert "datasourceKey" in content, "模板未引用 datasourceKey"

        # PG_EXPORTER_AUTO_DISCOVER_DATABASES
        assert "PG_EXPORTER_AUTO_DISCOVER_DATABASES" in content, \
            "模板缺少 PG_EXPORTER_AUTO_DISCOVER_DATABASES"
        assert "PG_EXPORTER_DISABLE_DEFAULT_METRICS" in content, \
            "模板缺少 PG_EXPORTER_DISABLE_DEFAULT_METRICS"

        print(f"  ✅ 模板使用 DATA_SOURCE_NAME + secretKeyRef + PG_EXPORTER_* 环境变量")
        return True
    except Exception as e:
        print(f"  ❌ DATA_SOURCE_NAME 验证失败: {e}")
        return False


def test_template_has_healthchecks() -> bool:
    """测试模板包含健康检查."""
    try:
        content = TEMPLATE.read_text(encoding="utf-8")
        assert "livenessProbe:" in content, "模板缺少 livenessProbe"
        assert "readinessProbe:" in content, "模板缺少 readinessProbe"
        assert "httpGet:" in content, "模板缺少 httpGet"
        assert "path: /metrics" in content, "模板缺少 /metrics 路径"
        assert "port: metrics" in content, "模板缺少 metrics 端口"

        print(f"  ✅ 模板包含 liveness + readiness 健康检查 (/metrics)")
        return True
    except Exception as e:
        print(f"  ❌ 健康检查验证失败: {e}")
        return False


def test_template_conditional() -> bool:
    """测试模板受 postgresExporter.enabled 控制."""
    try:
        content = TEMPLATE.read_text(encoding="utf-8")
        assert "{{- if .Values.postgresExporter.enabled }}" in content, \
            "模板未受 postgresExporter.enabled 控制"
        assert "{{- end }}" in content, "模板缺少 {{- end }}"

        print(f"  ✅ 模板受 postgresExporter.enabled 控制 (可禁用)")
        return True
    except Exception as e:
        print(f"  ❌ 条件控制验证失败: {e}")
        return False


def main() -> int:
    print("=" * 70)
    print("Helm chart PostgreSQL exporter 验证")
    print("=" * 70)

    results = []
    print("\n[1] values.yaml 配置")
    results.append(("postgresExporter 配置存在", test_values_has_pg_exporter()))
    results.append(("enabled = true", test_pg_exporter_enabled()))
    results.append(("image = v0.15.0", test_pg_exporter_image()))
    results.append(("port = 9187", test_pg_exporter_port()))
    results.append(("datasourceSecret 配置", test_pg_exporter_datasource_secret()))

    print("\n[2] 模板文件")
    results.append(("模板文件存在", test_template_exists()))
    results.append(("Deployment + Service", test_template_has_deployment_and_service()))

    print("\n[3] 模板内容")
    results.append(("DATA_SOURCE_NAME 环境变量", test_template_uses_dsn_env()))
    results.append(("健康检查", test_template_has_healthchecks()))
    results.append(("条件控制 (enabled)", test_template_conditional()))

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
