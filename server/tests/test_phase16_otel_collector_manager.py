"""Phase 16 建议 1 测试: OTel Collector 集成."""

from __future__ import annotations

import os
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from unittest.mock import MagicMock, patch

import pytest

try:
    from scripts.ops.otel_collector_manager import (
        DEFAULT_CONTAINER,
        DEFAULT_IMAGE,
        DEFAULT_PORTS,
        CollectorConfigBuilder,
        CollectorManager,
        HealthChecker,
        PrometheusRemoteWriteConfig,
        main,
    )

    HAS_MODULE = True
except ImportError:
    HAS_MODULE = False
    CollectorConfigBuilder = CollectorManager = HealthChecker = None
    PrometheusRemoteWriteConfig = main = None
    DEFAULT_IMAGE = DEFAULT_CONTAINER = DEFAULT_PORTS = None


# ---------------------------------------------------------------------------
# 1. CollectorConfigBuilder
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_config_builder_init():
    b = CollectorConfigBuilder()
    assert b.service_name == "zhs-platform"
    assert b.receivers == []
    assert b.exporters == []


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_config_builder_chains():
    b = (
        CollectorConfigBuilder(service_name="t1")
        .add_otlp_receiver()
        .add_prometheus_receiver()
        .add_health_check_extension()
        .add_zpages_extension()
        .add_memory_limiter()
        .add_batch_processor()
        .add_tail_sampling()
        .add_prometheus_exporter()
        .add_otlp_exporter()
        .add_logging_exporter()
    )
    assert len(b.receivers) == 2
    assert len(b.processors) == 3
    assert len(b.exporters) == 3
    assert len(b.extensions) == 2


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_config_builder_build_dict():
    b = (
        CollectorConfigBuilder(service_name="svc")
        .add_otlp_receiver()
        .add_prometheus_receiver()
        .add_health_check_extension()
        .add_memory_limiter()
        .add_batch_processor()
        .add_prometheus_exporter()
        .add_otlp_exporter()
    )
    cfg = b.build()
    assert "receivers" in cfg
    assert "otlp" in cfg["receivers"]
    assert "prometheus" in cfg["receivers"]
    assert "processors" in cfg
    assert "exporters" in cfg
    assert "service" in cfg
    assert "traces" in cfg["service"]["pipelines"]
    assert "metrics" in cfg["service"]["pipelines"]


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_config_builder_to_yaml():
    b = (
        CollectorConfigBuilder(service_name="t2")
        .add_otlp_receiver()
        .add_health_check_extension()
        .add_memory_limiter()
        .add_prometheus_exporter()
        .add_logging_exporter()
    )
    yaml = b.to_yaml()
    assert "receivers:" in yaml
    assert "otlp:" in yaml
    assert "processors:" in yaml
    assert "exporters:" in yaml
    assert "service:" in yaml
    assert "pipelines:" in yaml
    assert "traces:" in yaml
    assert "metrics:" in yaml


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_config_builder_yaml_contains_grpc_port():
    b = CollectorConfigBuilder().add_otlp_receiver(grpc=4317, http=4318)
    yaml = b.to_yaml()
    assert "4317" in yaml
    assert "4318" in yaml


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_config_builder_empty_extensions_in_yaml():
    b = CollectorConfigBuilder().add_otlp_receiver().add_prometheus_exporter()
    yaml = b.to_yaml()
    # 即便无 extensions, 也应能生成
    assert "exporters:" in yaml
    assert "prometheus:" in yaml


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_config_builder_tail_sampling_policies():
    b = CollectorConfigBuilder().add_tail_sampling(sample_ratio=0.25)
    assert len(b.processors) == 1
    p = b.processors[0]
    assert "tail_sampling" in p
    assert p["tail_sampling"]["policies"][0]["probabilistic"]["sampling_percentage"] == 25


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_config_builder_proc_names():
    b = CollectorConfigBuilder().add_memory_limiter().add_batch_processor()
    assert b._proc_names() == ["memory_limiter", "batch"]


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_config_builder_emit_dict():
    b = CollectorConfigBuilder()
    lines: list[str] = []
    b._emit_block(lines, {"a": 1, "b": "x"}, indent=2)
    assert any("a: 1" in l for l in lines)
    assert any('b: "x"' in l for l in lines)


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_config_builder_emit_nested():
    b = CollectorConfigBuilder()
    lines: list[str] = []
    b._emit_block(lines, {"outer": {"inner": 1}}, indent=0)
    text = "\n".join(lines)
    assert "outer:" in text
    assert "inner: 1" in text


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_config_builder_emit_list():
    b = CollectorConfigBuilder()
    lines: list[str] = []
    b._emit_block(lines, [1, 2, 3], indent=0)
    text = "\n".join(lines)
    assert "- 1" in text
    assert "- 2" in text


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_config_builder_exporter_routing():
    b = (
        CollectorConfigBuilder()
        .add_otlp_exporter(endpoint="tempo:4317")
        .add_prometheus_exporter()
        .add_logging_exporter()
    )
    traces = b._exporter_names_for("traces")
    metrics = b._exporter_names_for("metrics")
    assert "otlp" in traces
    assert "debug" in traces
    assert "prometheus" in metrics
    assert "debug" in metrics


# ---------------------------------------------------------------------------
# 2. CollectorManager
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_manager_init():
    m = CollectorManager()
    assert m.container_name == DEFAULT_CONTAINER
    assert m.image == DEFAULT_IMAGE


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_manager_docker_unavailable(monkeypatch):
    m = CollectorManager()
    monkeypatch.setattr(m, "is_docker_available", lambda: False)
    st = m.container_status()
    assert st["available"] is False


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_manager_status_running(monkeypatch):
    m = CollectorManager()
    monkeypatch.setattr(m, "is_docker_available", lambda: True)
    fake_proc = MagicMock(stdout=f"{DEFAULT_CONTAINER}\tUp 1 minute\n", returncode=0)
    with patch("subprocess.run", return_value=fake_proc):
        st = m.container_status()
    assert st["available"] is True
    assert st["running"] is True


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_manager_status_not_created(monkeypatch):
    m = CollectorManager()
    monkeypatch.setattr(m, "is_docker_available", lambda: True)
    fake_proc = MagicMock(stdout="", returncode=0)
    with patch("subprocess.run", return_value=fake_proc):
        st = m.container_status()
    assert st["running"] is False
    assert "not created" in st["info"]


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_manager_start_docker_unavailable(monkeypatch):
    m = CollectorManager()
    monkeypatch.setattr(m, "is_docker_available", lambda: False)
    r = m.start("config.yaml")
    assert r["ok"] is False
    assert "docker" in r["error"]


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_manager_start_success(monkeypatch, tmp_path):
    m = CollectorManager(container_name="zhs-test-otel")
    monkeypatch.setattr(m, "is_docker_available", lambda: True)
    cfg = tmp_path / "config.yaml"
    cfg.write_text("receivers: {}", encoding="utf-8")
    fake_proc = MagicMock(stdout="abc123", returncode=0, stderr="")
    with patch("subprocess.run", return_value=fake_proc) as mock_run:
        r = m.start(str(cfg))
    assert r["ok"] is True
    assert "abc123" in r["stdout"]


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_manager_start_failure(monkeypatch, tmp_path):
    m = CollectorManager(container_name="zhs-test-otel")
    monkeypatch.setattr(m, "is_docker_available", lambda: True)
    cfg = tmp_path / "config.yaml"
    cfg.write_text("x", encoding="utf-8")
    fake_proc = MagicMock(stdout="", returncode=1, stderr="image not found")
    with patch("subprocess.run", return_value=fake_proc):
        r = m.start(str(cfg))
    assert r["ok"] is False


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_manager_start_timeout(monkeypatch, tmp_path):
    import subprocess as sp

    m = CollectorManager(container_name="zhs-test-otel")
    monkeypatch.setattr(m, "is_docker_available", lambda: True)
    cfg = tmp_path / "config.yaml"
    cfg.write_text("x", encoding="utf-8")
    with patch("subprocess.run", side_effect=sp.TimeoutExpired(cmd="docker", timeout=60)):
        r = m.start(str(cfg))
    assert r["ok"] is False
    assert "超时" in r["error"]


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_manager_stop_docker_unavailable(monkeypatch):
    m = CollectorManager()
    monkeypatch.setattr(m, "is_docker_available", lambda: False)
    r = m.stop()
    assert r["ok"] is False


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_manager_stop_success(monkeypatch):
    m = CollectorManager(container_name="zhs-test-otel")
    monkeypatch.setattr(m, "is_docker_available", lambda: True)
    fake_proc = MagicMock(stdout=DEFAULT_CONTAINER, returncode=0, stderr="")
    with patch("subprocess.run", return_value=fake_proc):
        r = m.stop()
    assert r["ok"] is True


# ---------------------------------------------------------------------------
# 3. HealthChecker
# ---------------------------------------------------------------------------


class _MockHandler(BaseHTTPRequestHandler):
    """返回 200 状态码."""

    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(b"ok")

    def log_message(self, format, *args):
        pass  # 静默日志


def _start_mock_server() -> tuple[str, int, HTTPServer, threading.Thread]:
    """启动一个 mock HTTP server, 返回 (host, port, server, thread)."""
    server = HTTPServer(("127.0.0.1", 0), _MockHandler)
    port = server.server_address[1]
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    return "127.0.0.1", port, server, t


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_health_checker_init():
    hc = HealthChecker()
    assert hc.host == "localhost"
    assert hc.port == 13133


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_health_checker_healthy():
    host, port, server, t = _start_mock_server()
    hc = HealthChecker(host=host, port=port, prom_port=99999, timeout=1.0)
    h = hc.health()
    server.shutdown()
    assert h["healthy"] is True
    assert h["status_code"] == 200


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_health_checker_unhealthy():
    """连接到不存在的端口."""
    hc = HealthChecker(host="127.0.0.1", port=1, prom_port=1, timeout=0.5)
    h = hc.health()
    assert h["healthy"] is False
    assert h["status_code"] == 0


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_health_checker_metrics_port_open():
    """metrics 端口可达时 True."""
    host, port, server, t = _start_mock_server()
    hc = HealthChecker(host=host, prom_port=port)
    assert hc.metrics_port_open() is True
    server.shutdown()


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_health_checker_metrics_port_closed():
    """metrics 端口不可达时 False."""
    hc = HealthChecker(host="127.0.0.1", prom_port=1, timeout=0.3)
    assert hc.metrics_port_open() is False


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_health_checker_full_check():
    host, port, server, t = _start_mock_server()
    hc = HealthChecker(host=host, port=port, prom_port=port, timeout=1.0)
    r = hc.full_check()
    server.shutdown()
    assert r["healthy"] is True
    assert r["metrics_port_open"] is True


# ---------------------------------------------------------------------------
# 4. PrometheusRemoteWriteConfig
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_remote_write_static_config():
    cfg = PrometheusRemoteWriteConfig.build_static_scrape_config()
    assert "scrape_configs" in cfg
    assert cfg["scrape_configs"][0]["job_name"] == "otel-collector"


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_remote_write_to_yaml():
    y = PrometheusRemoteWriteConfig.to_yaml()
    assert "scrape_configs:" in y
    assert "otel-collector" in y
    assert "8889" in y


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_remote_write_custom_target():
    cfg = PrometheusRemoteWriteConfig.build_static_scrape_config(
        job_name="custom", target="collector:9999", interval="10s"
    )
    assert cfg["scrape_configs"][0]["job_name"] == "custom"
    assert cfg["scrape_configs"][0]["scrape_interval"] == "10s"
    assert "collector:9999" in cfg["scrape_configs"][0]["static_configs"][0]["targets"]


# ---------------------------------------------------------------------------
# 5. CLI
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_cli_gen_config(tmp_path):
    out = str(tmp_path / "collector.yaml")
    code = main(["gen-config", "--out", out, "--service-name", "test-svc"])
    assert code == 0
    assert os.path.exists(out)
    with open(out, encoding="utf-8") as f:
        c = f.read()
    assert "receivers:" in c
    assert "test-svc" in c  # service_name 出现在 const_labels 中
    assert "const_labels" in c


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_cli_gen_config_with_tail_sampling(tmp_path):
    out = str(tmp_path / "c2.yaml")
    code = main(["gen-config", "--out", out, "--enable-tail-sampling"])
    assert code == 0
    with open(out, encoding="utf-8") as f:
        c = f.read()
    assert "tail_sampling" in c


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_cli_status(monkeypatch, capsys):
    monkeypatch.setattr(
        "scripts.ops.otel_collector_manager.CollectorManager.is_docker_available",
        lambda self: False,
    )
    code = main(["status"])
    assert code == 0


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_cli_start_no_docker(monkeypatch, capsys, tmp_path):
    monkeypatch.setattr(
        "scripts.ops.otel_collector_manager.CollectorManager.is_docker_available",
        lambda self: False,
    )
    cfg = tmp_path / "c.yaml"
    cfg.write_text("x", encoding="utf-8")
    code = main(["start", "--config", str(cfg)])
    assert code == 1


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_cli_stop_no_docker(monkeypatch, capsys):
    monkeypatch.setattr(
        "scripts.ops.otel_collector_manager.CollectorManager.is_docker_available",
        lambda self: False,
    )
    code = main(["stop"])
    assert code == 1


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_cli_health(monkeypatch, capsys):
    """无 collector 时 health 返回结构."""
    code = main(["health", "--host", "127.0.0.1", "--port", "1"])
    assert code == 0


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_cli_scrape_config_to_stdout(capsys):
    code = main(["scrape-config"])
    assert code == 0
    out = capsys.readouterr().out
    assert "scrape_configs:" in out


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_cli_scrape_config_to_file(tmp_path):
    out = str(tmp_path / "prom.yaml")
    code = main(["scrape-config", "--out", out])
    assert code == 0
    assert os.path.exists(out)
    with open(out, encoding="utf-8") as f:
        c = f.read()
    assert "otel-collector" in c
