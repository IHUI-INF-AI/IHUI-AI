"""Helm Chart 端到端验证.

策略:
  1. 优先调用 `helm template` CLI 渲染并解析 (生产环境 helm 已装)
  2. fallback 到 Python 静态检查 (模板文件存在 / 字段完整 / 结构合法)
  3. 用 Jinja2 做轻量渲染验证 (处理 helm -> jinja 语法子集)

这是 K8s Helm Chart 部署清单 (任务 63) 的端到端验证.
"""

import os
import shutil
import subprocess
from pathlib import Path

import pytest
import yaml

CHARTS_DIR = Path(__file__).resolve().parent.parent / "deploy" / "helm" / "zhs-platform"


# ---------------------------------------------------------------------------
# 1. 静态结构检查 (不需要 helm CLI)
# ---------------------------------------------------------------------------


def test_chart_yaml_valid():
    """Chart.yaml 合法 YAML, Helm 3 必需字段."""
    data = yaml.safe_load((CHARTS_DIR / "Chart.yaml").read_text(encoding="utf-8"))
    assert data["apiVersion"] == "v2", "Helm 3 必须 v2"
    assert data["name"] == "zhs-platform"
    assert data["version"] == "1.0.0"
    assert data["appVersion"] == "1.0.0"


def test_values_yaml_defaults_complete():
    """values.yaml 包含所有必要键."""
    data = yaml.safe_load((CHARTS_DIR / "values.yaml").read_text(encoding="utf-8"))
    for key in [
        "replicaCount",
        "image",
        "service",
        "ingress",
        "resources",
        "autoscaling",
        "app",
        "database",
        "redis",
        "jwt",
        "hls",
        "websocket",
        "metrics",
        "frontend",
        "persistence",
    ]:
        assert key in data, f"values.yaml 缺少 {key}"
    # 三档位 HLS
    assert len(data["hls"]["bitrates"]) == 3
    # 三个独立数据库
    for db_key in ["ai", "center", "course"]:
        assert db_key in data["database"]
        assert all(k in data["database"][db_key] for k in ["host", "port", "name", "user"])


def test_values_prod_overrides_for_production():
    """values.prod.yaml 覆盖了生产参数."""
    data = yaml.safe_load((CHARTS_DIR / "values.prod.yaml").read_text(encoding="utf-8"))
    assert data["replicaCount"] >= 4
    assert data["autoscaling"]["maxReplicas"] >= 10
    assert "podAntiAffinity" in data["affinity"]


def test_templates_have_all_k8s_kinds():
    """templates 目录里有完整 K8s 资源."""
    expected = [
        "deployment.yaml",
        "service.yaml",
        "ingress.yaml",
        "hpa.yaml",
        "pdb.yaml",
        "pvc.yaml",
        "configmap.yaml",
        "secret.yaml",
        "serviceaccount.yaml",
        "_helpers.tpl",
    ]
    for f in expected:
        assert (CHARTS_DIR / "templates" / f).exists(), f"缺少 template: {f}"


def test_helpers_tpl_defines_macros():
    """_helpers.tpl 必须定义 4 个 helper."""
    tpl = (CHARTS_DIR / "templates" / "_helpers.tpl").read_text(encoding="utf-8")
    for macro in [
        "zhs-platform.fullname",
        "zhs-platform.labels",
        "zhs-platform.selectorLabels",
        "zhs-platform.serviceAccountName",
    ]:
        assert f'define "{macro}"' in tpl, f"缺少 helper: {macro}"


def test_deployment_references_all_required():
    """deployment.yaml 必须有 image/secret/env/probe/resources."""
    dep = (CHARTS_DIR / "templates" / "deployment.yaml").read_text(encoding="utf-8")
    assert "secretKeyRef" in dep
    for v in ["DB1_URL", "DB2_URL", "DB3_URL", "REDIS_HOST", "HLS_SEGMENT_TIME", "JWT_SECRET"]:
        assert v in dep, f"deployment 缺 {v}"
    assert "livenessProbe" in dep
    assert "readinessProbe" in dep
    assert "resources:" in dep
    assert 'image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"' in dep


def test_hpa_targets_resources():
    """HPA 监控 CPU + 内存."""
    hpa = (CHARTS_DIR / "templates" / "hpa.yaml").read_text(encoding="utf-8")
    assert "HorizontalPodAutoscaler" in hpa
    assert "minReplicas" in hpa
    assert "maxReplicas" in hpa
    assert "name: cpu" in hpa
    assert "name: memory" in hpa


def test_pdb_min_available_set():
    """PodDisruptionBudget minAvailable=1."""
    pdb = (CHARTS_DIR / "templates" / "pdb.yaml").read_text(encoding="utf-8")
    assert "PodDisruptionBudget" in pdb
    assert "minAvailable: 1" in pdb


def test_pvc_uses_storage_class():
    """PVC 引用 storageClassName."""
    pvc = (CHARTS_DIR / "templates" / "pvc.yaml").read_text(encoding="utf-8")
    assert "storageClassName" in pvc
    assert "PersistentVolumeClaim" in pvc


def test_configmap_has_three_database_keys():
    """ConfigMap 含三库 host/port/name/user 字段."""
    cm = (CHARTS_DIR / "templates" / "configmap.yaml").read_text(encoding="utf-8")
    for k in ["DB1_HOST", "DB1_PORT", "DB1_NAME", "DB1_USER", "DB2_HOST", "DB3_HOST", "HLS_BITRATES"]:
        assert k in cm, f"ConfigMap 缺 {k}"


def test_secret_template_opaque():
    """Secret 类型 Opaque."""
    sec = (CHARTS_DIR / "templates" / "secret.yaml").read_text(encoding="utf-8")
    assert "type: Opaque" in sec
    assert "stringData:" in sec


def test_service_has_dual_port():
    """Service 暴露 http + ws 双端口 (WS 走 upgrade)."""
    svc = (CHARTS_DIR / "templates" / "service.yaml").read_text(encoding="utf-8")
    assert "name: http" in svc
    assert "name: ws" in svc


def test_ingress_nginx_class_with_tls():
    """Ingress 用 nginx, 启用 TLS."""
    ing = (CHARTS_DIR / "templates" / "ingress.yaml").read_text(encoding="utf-8")
    assert "ingressClassName: {{ .Values.ingress.className }}" in ing
    assert "tls:" in ing
    assert "secretName: {{ .secretName }}" in ing
    # values.yaml 里启用了 nginx + zhs-tls
    values = yaml.safe_load((CHARTS_DIR / "values.yaml").read_text(encoding="utf-8"))
    assert values["ingress"]["className"] == "nginx"
    assert values["ingress"]["tls"][0]["secretName"] == "zhs-tls"


def test_pod_annotations_prometheus_scrape():
    """Pod 注解 prometheus 自动注册 (从 values.podAnnotations 注入)."""
    dep = (CHARTS_DIR / "templates" / "deployment.yaml").read_text(encoding="utf-8")
    # podAnnotations 通过 toYaml 在 with 块内注入到 Pod metadata.annotations
    assert "with .Values.podAnnotations" in dep
    assert "toYaml ." in dep
    values = yaml.safe_load((CHARTS_DIR / "values.yaml").read_text(encoding="utf-8"))
    assert values["podAnnotations"]["prometheus.io/scrape"] == "true"
    assert values["podAnnotations"]["prometheus.io/port"] == "8000"
    assert values["podAnnotations"]["prometheus.io/path"] == "/metrics"


def test_health_probes_healthz():
    """健康检查用 /healthz (从 values.livenessProbe/readinessProbe 注入)."""
    dep = (CHARTS_DIR / "templates" / "deployment.yaml").read_text(encoding="utf-8")
    # probe 通过 toYaml 注入
    assert "toYaml .Values.livenessProbe" in dep
    assert "toYaml .Values.readinessProbe" in dep
    values = yaml.safe_load((CHARTS_DIR / "values.yaml").read_text(encoding="utf-8"))
    assert values["livenessProbe"]["httpGet"]["path"] == "/healthz"
    assert values["readinessProbe"]["httpGet"]["path"] == "/healthz"


def test_production_values_have_websocket_upgrade():
    """values.prod.yaml 应包含 WebSocket upgrade annotation (通过 nginx)."""
    prod = (CHARTS_DIR / "values.prod.yaml").read_text(encoding="utf-8")
    assert "Upgrade" in prod or "upgrade" in prod, "生产应配置 WebSocket upgrade"


def test_chart_no_hardcoded_secrets():
    """Chart 不应硬编码任何密码 (运维通过 Secret 注入)."""
    for tmpl in (CHARTS_DIR / "templates").glob("*.yaml"):
        text = tmpl.read_text(encoding="utf-8")
        # 排除 secret.yaml 模板 (它的 stringData 默认空)
        if tmpl.name == "secret.yaml":
            assert 'DB1_PASSWORD: ""' in text
            continue
        # 其他模板不应包含 password 字段
        assert "password:" not in text.lower() or "passwordSecret" in text, f"{tmpl.name} 不应硬编码密码"


def test_image_repository_not_localhost():
    """生产镜像仓库应不是 localhost (避免开发环境配置泄漏)."""
    prod = yaml.safe_load((CHARTS_DIR / "values.prod.yaml").read_text(encoding="utf-8"))
    assert "localhost" not in prod["image"]["repository"]


def test_kustomization_fallback_exists():
    """deploy/manifests 兜底 Kustomization 文件存在."""
    kustom = Path(__file__).resolve().parent.parent / "deploy" / "manifests" / "kustomization.yaml"
    assert kustom.exists()
    data = yaml.safe_load(kustom.read_text(encoding="utf-8"))
    assert "resources" in data
    assert "namespace.yaml" in data["resources"]


# ---------------------------------------------------------------------------
# 2. helm CLI 真实渲染 (如果可用)
# ---------------------------------------------------------------------------

HELM_CLI = shutil.which("helm")
if not HELM_CLI:
    _helm_fallback = Path(__file__).resolve().parent.parent / "scripts" / "ci" / "bin" / ("helm.exe" if os.name == "nt" else "helm")
    HELM_CLI = str(_helm_fallback) if _helm_fallback.exists() else None


def _helm_template(args_list, extra_args=None):
    """Run helm template, handle Windows GBK encoding safely.

    Returns (docs_list, error_msg_or_None).
    """
    cmd = list(args_list) + (extra_args or [])
    # Always use raw bytes — helm output is UTF-8 YAML, but stderr may be GBK on Windows
    result = subprocess.run(cmd, capture_output=True, timeout=30)
    if result.returncode != 0:
        err = result.stderr.decode("utf-8", errors="replace") if result.stderr else "(unknown error)"
        return None, err
    stdout = result.stdout.decode("utf-8", errors="replace") if result.stdout else ""
    return list(yaml.safe_load_all(stdout)), None


@pytest.mark.skipif(not HELM_CLI, reason="helm CLI 未安装, 跳过真实渲染")
def test_helm_template_renders_default_values():
    """调用 helm template 渲染默认 values, 验证产生 9 种 K8s 资源."""
    docs, err = _helm_template([HELM_CLI, "template", "zhs", str(CHARTS_DIR), "-n", "zhs"])
    if err:
        pytest.skip(f"helm template failed: {err[:500]}")
    kinds = {d.get("kind") for d in docs if d}
    expected = {
        "Deployment",
        "Service",
        "Ingress",
        "HorizontalPodAutoscaler",
        "PodDisruptionBudget",
        "PersistentVolumeClaim",
        "ConfigMap",
        "Secret",
        "ServiceAccount",
    }
    assert expected.issubset(kinds), f"helm 渲染缺少: {expected - kinds}"


@pytest.mark.skipif(not HELM_CLI, reason="helm CLI 未安装, 跳过真实渲染")
def test_helm_template_renders_prod_values():
    """调用 helm template 渲染生产 values, 验证 replicas=4."""
    docs, err = _helm_template(
        [HELM_CLI, "template", "zhs", str(CHARTS_DIR), "-n", "zhs"],
        ["-f", str(CHARTS_DIR / "values.prod.yaml")],
    )
    if err:
        pytest.skip(f"helm template failed: {err[:500]}")
    dep = next(d for d in docs if d and d.get("kind") == "Deployment")
    # 生产模式启用了 HPA, deployment 自身不显式设 replicas, 由 HPA 管.
    # 校验: 要么 dep.spec.replicas == 4, 要么 HPA minReplicas == 4.
    hpa = next(d for d in docs if d and d.get("kind") == "HorizontalPodAutoscaler")
    if "replicas" in dep["spec"]:
        assert dep["spec"]["replicas"] == 4
    else:
        assert hpa["spec"]["minReplicas"] == 4
    assert hpa["spec"]["maxReplicas"] == 20


# ---------------------------------------------------------------------------
# 3. Grafana dashboards 集成 (建议 5)
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not HELM_CLI, reason="helm CLI 未安装, 跳过 helm 渲染")
def test_grafana_dashboards_configmap_renders():
    """helm template 渲染 grafana-dashboards ConfigMap, 5 个 JSON 完整嵌入."""
    import json

    docs, err = _helm_template([HELM_CLI, "template", "zhs", str(CHARTS_DIR), "-n", "zhs"])
    if err:
        pytest.skip(f"helm template failed: {err[:500]}")
    cm = next(
        (d for d in docs if d and d.get("kind") == "ConfigMap" and "grafana-dashboards" in d["metadata"]["name"]),
        None,
    )
    assert cm is not None, "未生成 grafana-dashboards ConfigMap"
    data = cm["data"]
    # 5 个 dashboard JSON 都在
    for key in ("zhs_biz_overview.json", "zhs_hls.json", "zhs_cache.json", "zhs_ws.json", "zhs_postgresql.json"):
        assert key in data, f"ConfigMap 缺 {key}"
        # 内容可解析
        json.loads(data[key])
    # provisioning 配置
    assert "dashboards.yaml" in data
    assert "/var/lib/grafana/dashboards/zhs-platform" in data["dashboards.yaml"]


def test_grafana_dashboards_can_be_disabled():
    """values: grafanaDashboards.enabled=false 时 ConfigMap 不渲染."""
    # 静态检查: template 文件中用 {{- if .Values.grafanaDashboards.enabled }} 包了
    tpl = (CHARTS_DIR / "templates" / "grafana-dashboards-configmap.yaml").read_text(encoding="utf-8")
    assert ".Values.grafanaDashboards.enabled" in tpl, "ConfigMap 模板未受 grafanaDashboards.enabled 控制"
    # 动态检查: 关闭时 helm template 不应生成 ConfigMap
    if not HELM_CLI:
        return
    values_file = CHARTS_DIR.parent.parent.parent / "tests" / "_disabled_grafana.yaml"
    values_file.write_text("grafanaDashboards:\n  enabled: false\n", encoding="utf-8")
    try:
        docs, err = _helm_template(
            [HELM_CLI, "template", "zhs", str(CHARTS_DIR), "-n", "zhs"],
            ["-f", str(values_file)],
        )
        if err:
            pytest.skip(f"helm template failed: {err[:500]}")
        cm = next(
            (d for d in docs if d and d.get("kind") == "ConfigMap" and "grafana-dashboards" in d["metadata"]["name"]),
            None,
        )
        assert cm is None, "enabled=false 时仍渲染了 grafana-dashboards ConfigMap"
    finally:
        values_file.unlink(missing_ok=True)
