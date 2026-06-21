"""Phase 16 建议 1: OTel Collector 集成工具.

目的:
  - 一键启动/停止/检查 OTel Collector 容器
  - 提供 collector 配置文件 (trace + metric 接收, 转发到 Prometheus + Tempo)
  - 健康检查 / 抓取器状态查询
  - 本地端口/服务暴露, 应用只需配置 OTLP endpoint

设计:
  1. CollectorConfigBuilder      拼 collector.yaml (receivers/processors/exporters)
  2. CollectorManager            拉 docker 镜像, 启停容器, 状态查询
  3. HealthChecker               HTTP 探活 (curl /health, /metrics, /debug/...)
  4. PrometheusRemoteWriteConfig 生成 remote_write YAML 片段
  5. CLI                         一键起停 + 状态 + 报告
"""

from __future__ import annotations

import json
import os
import shutil
import socket
import subprocess
import sys
import urllib.error
import urllib.request
from typing import Any

DEFAULT_IMAGE = "otel/opentelemetry-collector-contrib:0.104.0"
DEFAULT_CONTAINER = "zhs-otel-collector"
DEFAULT_PORTS = {
    "otlp_grpc": 4317,
    "otlp_http": 4318,
    "prometheus": 8889,
    "health": 13133,
    "zpages": 55679,
}


# ---------------------------------------------------------------------------
# 1. CollectorConfigBuilder
# ---------------------------------------------------------------------------


class CollectorConfigBuilder:
    """拼 collector.yaml 配置 (含 receivers / processors / exporters / service)."""

    def __init__(self, service_name: str = "zhs-platform"):
        self.service_name = service_name
        self.receivers: list[dict] = []
        self.processors: list[dict] = []
        self.exporters: list[dict] = []
        self.extensions: list[dict] = []

    def add_otlp_receiver(self, grpc: int = 4317, http: int = 4318) -> CollectorConfigBuilder:
        self.receivers.append(
            {
                "otlp": {
                    "protocols": {
                        "grpc": {"endpoint": f"0.0.0.0:{grpc}"},
                        "http": {"endpoint": f"0.0.0.0:{http}"},
                    },
                },
            }
        )
        return self

    def add_prometheus_receiver(self, port: int = 8889) -> CollectorConfigBuilder:
        """Collector 自身作为 Prometheus 抓取端点."""
        self.receivers.append(
            {
                "prometheus": {
                    "config": {
                        "scrape_configs": [
                            {
                                "job_name": "otel-collector-self",
                                "scrape_interval": "30s",
                                "static_configs": [{"targets": [f"localhost:{port}"]}],
                            },
                        ],
                    },
                },
            }
        )
        return self

    def add_health_check_extension(self, port: int = 13133) -> CollectorConfigBuilder:
        self.extensions.append({"health_check": {"endpoint": f"0.0.0.0:{port}"}})
        return self

    def add_zpages_extension(self, port: int = 55679) -> CollectorConfigBuilder:
        self.extensions.append({"zpages": {"endpoint": f"0.0.0.0:{port}"}})
        return self

    def add_memory_limiter(self, limit_mib: int = 512, spike_mib: int = 128) -> CollectorConfigBuilder:
        self.processors.append(
            {
                "memory_limiter": {
                    "check_interval": "5s",
                    "limit_percentage": 80,
                    "spike_limit_percentage": 25,
                },
            }
        )
        return self

    def add_batch_processor(self, timeout: str = "10s", send_batch_size: int = 8192) -> CollectorConfigBuilder:
        self.processors.append(
            {
                "batch": {
                    "timeout": timeout,
                    "send_batch_size": send_batch_size,
                },
            }
        )
        return self

    def add_tail_sampling(self, policy: str = "probabilistic", sample_ratio: float = 0.1) -> CollectorConfigBuilder:
        """尾采样, 减少 trace 存储成本."""
        if policy == "probabilistic":
            self.processors.append(
                {
                    "tail_sampling": {
                        "decision_wait": "10s",
                        "num_traces": 50000,
                        "expected_new_traces_per_sec": 1000,
                        "policies": [
                            {
                                "name": "zhs-probabilistic",
                                "type": "probabilistic",
                                "probabilistic": {"sampling_percentage": int(sample_ratio * 100)},
                            },
                        ],
                    },
                }
            )
        return self

    def add_prometheus_exporter(self, endpoint: str = "0.0.0.0:8889") -> CollectorConfigBuilder:
        """OTel metrics -> Prometheus 格式输出."""
        self.exporters.append(
            {
                "prometheus": {
                    "endpoint": endpoint,
                    "const_labels": {"service_name": self.service_name},
                },
            }
        )
        return self

    def add_otlp_exporter(self, endpoint: str = "tempo:4317", tls: bool = False) -> CollectorConfigBuilder:
        """trace -> 后端 (Tempo / Jaeger / Honeycomb 等)."""
        self.exporters.append(
            {
                "otlp": {
                    "endpoint": endpoint,
                    "tls": {"insecure": not tls} if not tls else None,
                },
            }
        )
        return self

    def add_logging_exporter(self, verbosity: str = "basic") -> CollectorConfigBuilder:
        """调试用, 打印到 stdout."""
        self.exporters.append(
            {
                "debug": {"verbosity": verbosity},
            }
        )
        return self

    def build(self) -> dict:
        return {
            "receivers": self._merge_receivers(),
            "processors": self._merge_processors(),
            "exporters": self._merge_exporters(),
            "extensions": self._merge_extensions(),
            "service": {
                "extensions": [list(e.keys())[0] for e in self.extensions],
                "pipelines": {
                    "traces": {
                        "receivers": ["otlp"],
                        "processors": self._proc_names(),
                        "exporters": self._exporter_names_for("traces"),
                    },
                    "metrics": {
                        "receivers": ["otlp", "prometheus"],
                        "processors": self._proc_names(),
                        "exporters": self._exporter_names_for("metrics"),
                    },
                },
            },
        }

    def to_yaml(self) -> str:
        """输出 YAML (手写避免引入 pyyaml 依赖)."""
        cfg = self.build()
        lines: list[str] = []
        lines.append("# OpenTelemetry Collector 配置 - 自动生成")
        lines.append(f"# service_name: {self.service_name}")
        lines.append("")
        lines.append("extensions:")
        for ext in cfg["extensions"]:
            for k, v in ext.items():
                lines.append(f"  {k}:")
                self._emit_block(lines, v, indent=4)
        lines.append("")
        lines.append("receivers:")
        for recv_name, recv_cfg in cfg["receivers"].items():
            lines.append(f"  {recv_name}:")
            self._emit_block(lines, recv_cfg, indent=4)
        lines.append("")
        lines.append("processors:")
        for proc_name, proc_cfg in cfg["processors"].items():
            lines.append(f"  {proc_name}:")
            self._emit_block(lines, proc_cfg, indent=4)
        lines.append("")
        lines.append("exporters:")
        for exp_name, exp_cfg in cfg["exporters"].items():
            lines.append(f"  {exp_name}:")
            self._emit_block(lines, exp_cfg, indent=4)
        lines.append("")
        lines.append("service:")
        lines.append("  extensions: [" + ", ".join(list(e.keys())[0] for e in cfg["extensions"]) + "]")
        lines.append("  pipelines:")
        for pipe_name, pipe_cfg in cfg["service"]["pipelines"].items():
            lines.append(f"    {pipe_name}:")
            lines.append(f"      receivers: [{', '.join(pipe_cfg['receivers'])}]")
            lines.append(f"      processors: [{', '.join(pipe_cfg['processors'])}]")
            lines.append(f"      exporters: [{', '.join(pipe_cfg['exporters'])}]")
        return "\n".join(lines) + "\n"

    def _merge_receivers(self) -> dict:
        merged: dict = {}
        for r in self.receivers:
            merged.update(r)
        return merged

    def _merge_processors(self) -> dict:
        merged: dict = {}
        for p in self.processors:
            merged.update(p)
        return merged

    def _merge_exporters(self) -> dict:
        merged: dict = {}
        for e in self.exporters:
            merged.update(e)
        return merged

    def _merge_extensions(self) -> list[dict]:
        return list(self.extensions)

    def _proc_names(self) -> list[str]:
        names: list[str] = []
        for p in self.processors:
            names.append(list(p.keys())[0])
        return names

    def _exporter_names_for(self, kind: str) -> list[str]:
        if kind == "traces":
            return [n for n, _ in [(list(e.keys())[0], e) for e in self.exporters] if n in ("otlp", "debug")]
        if kind == "metrics":
            return [
                n for n, _ in [(list(e.keys())[0], e) for e in self.exporters] if n in ("prometheus", "debug", "otlp")
            ]
        return [list(e.keys())[0] for e in self.exporters]

    def _emit_block(self, lines: list[str], block: Any, indent: int) -> None:
        if isinstance(block, dict):
            for k, v in block.items():
                if isinstance(v, (dict, list)) and v:
                    lines.append(" " * indent + f"{k}:")
                    self._emit_block(lines, v, indent + 2)
                else:
                    if v is None:
                        continue
                    if isinstance(v, str):
                        lines.append(" " * indent + f'{k}: "{v}"')
                    else:
                        lines.append(" " * indent + f"{k}: {v}")
        elif isinstance(block, list):
            for item in block:
                if isinstance(item, dict):
                    lines.append(" " * indent + "-")
                    self._emit_block(lines, item, indent + 2)
                else:
                    lines.append(" " * indent + f"- {item}")


# ---------------------------------------------------------------------------
# 2. CollectorManager (docker 启停)
# ---------------------------------------------------------------------------


class CollectorManager:
    """管理 OTel Collector 容器 (docker)."""

    def __init__(self, container_name: str = DEFAULT_CONTAINER, image: str = DEFAULT_IMAGE):
        self.container_name = container_name
        self.image = image

    def is_docker_available(self) -> bool:
        return shutil.which("docker") is not None

    def is_running(self) -> bool:
        if not self.is_docker_available():
            return False
        try:
            proc = subprocess.run(
                ["docker", "ps", "--filter", f"name={self.container_name}", "--format", "{{.Names}}"],
                capture_output=True,
                text=True,
                timeout=10,
            )
            return self.container_name in proc.stdout
        except Exception:
            return False

    def container_status(self) -> dict:
        if not self.is_docker_available():
            return {"available": False, "running": False, "info": "docker not installed"}
        try:
            proc = subprocess.run(
                [
                    "docker",
                    "ps",
                    "-a",
                    "--filter",
                    f"name={self.container_name}",
                    "--format",
                    "{{.Names}}\t{{.Status}}\t{{.Ports}}",
                ],
                capture_output=True,
                text=True,
                timeout=10,
            )
            lines = [l for l in proc.stdout.splitlines() if l.strip()]
            if not lines:
                return {"available": True, "running": False, "info": "not created"}
            parts = lines[0].split("\t")
            return {
                "available": True,
                "running": "Up" in parts[1] if len(parts) > 1 else False,
                "info": lines[0],
            }
        except Exception as e:
            return {"available": True, "running": False, "info": f"err: {e}"}

    def start(
        self,
        config_path: str,
        ports: dict | None = None,
        detach: bool = True,
    ) -> dict:
        """启动 collector 容器."""
        if not self.is_docker_available():
            return {"ok": False, "error": "docker 未安装"}
        ports = ports or DEFAULT_PORTS
        cmd = [
            "docker",
            "run",
            "--rm",
            "--name",
            self.container_name,
        ]
        for k, v in ports.items():
            cmd.extend(["-p", f"{v}:{v}"])
        cmd.extend(
            [
                "-v",
                f"{os.path.abspath(config_path)}:/etc/otelcol/config.yaml:ro",
                self.image,
            ]
        )
        if detach:
            cmd.insert(2, "-d")
        try:
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            return {
                "ok": proc.returncode == 0,
                "stdout": proc.stdout.strip(),
                "stderr": proc.stderr.strip(),
            }
        except subprocess.TimeoutExpired:
            return {"ok": False, "error": "docker run 超时"}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def stop(self) -> dict:
        if not self.is_docker_available():
            return {"ok": False, "error": "docker 未安装"}
        try:
            proc = subprocess.run(
                ["docker", "stop", self.container_name],
                capture_output=True,
                text=True,
                timeout=30,
            )
            return {
                "ok": proc.returncode == 0,
                "stdout": proc.stdout.strip(),
                "stderr": proc.stderr.strip(),
            }
        except Exception as e:
            return {"ok": False, "error": str(e)}


# ---------------------------------------------------------------------------
# 3. HealthChecker
# ---------------------------------------------------------------------------


class HealthChecker:
    """HTTP 探活 collector."""

    def __init__(self, host: str = "localhost", port: int = 13133, prom_port: int = 8889, timeout: float = 2.0):
        self.host = host
        self.port = port
        self.prom_port = prom_port
        self.timeout = timeout

    def _get(self, path: str, port: int | None = None) -> tuple[int, str]:
        p = port or self.port
        url = f"http://{self.host}:{p}{path}"
        try:
            with urllib.request.urlopen(url, timeout=self.timeout) as resp:
                return resp.getcode(), resp.read().decode("utf-8", errors="ignore")[:500]
        except urllib.error.HTTPError as e:
            return e.code, ""
        except Exception as e:
            return 0, str(e)

    def health(self) -> dict:
        code, body = self._get("/")
        return {"status_code": code, "healthy": code == 200, "body": body}

    def metrics_port_open(self) -> bool:
        try:
            with socket.create_connection((self.host, self.prom_port), timeout=self.timeout):
                return True
        except Exception:
            return False

    def full_check(self) -> dict:
        h = self.health()
        prom = self.metrics_port_open()
        return {
            "healthy": h["healthy"],
            "metrics_port_open": prom,
            "health_code": h["status_code"],
        }


# ---------------------------------------------------------------------------
# 4. PrometheusRemoteWriteConfig
# ---------------------------------------------------------------------------


class PrometheusRemoteWriteConfig:
    """生成 prometheus.yml 的 remote_write 片段, 让 Prometheus 抓 collector 暴露的指标."""

    @staticmethod
    def build_static_scrape_config(
        job_name: str = "otel-collector", target: str = "localhost:8889", interval: str = "30s"
    ) -> dict:
        return {
            "scrape_configs": [
                {
                    "job_name": job_name,
                    "scrape_interval": interval,
                    "static_configs": [{"targets": [target]}],
                },
            ],
        }

    @staticmethod
    def to_yaml() -> str:
        return """# Prometheus remote_write / scrape 配置片段
# 加入到 prometheus.yml 的 scrape_configs 列表中
scrape_configs:
  - job_name: otel-collector
    scrape_interval: 30s
    static_configs:
      - targets: ['localhost:8889']
"""


# ---------------------------------------------------------------------------
# 5. CLI
# ---------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    import argparse

    p = argparse.ArgumentParser(description="OTel Collector 集成管理")
    sub = p.add_subparsers(dest="cmd", required=True)

    # gen-config
    p_gen = sub.add_parser("gen-config", help="生成 collector.yaml")
    p_gen.add_argument("--out", default="collector.yaml")
    p_gen.add_argument("--enable-tail-sampling", action="store_true")
    p_gen.add_argument("--tempo-endpoint", default="tempo:4317")
    p_gen.add_argument("--service-name", default="zhs-platform")

    # status
    p_status = sub.add_parser("status", help="查看 collector 状态")

    # start
    p_start = sub.add_parser("start", help="启动 collector (docker)")
    p_start.add_argument("--config", default="collector.yaml")
    p_start.add_argument("--detach", action="store_true", default=True)

    # stop
    sub.add_parser("stop", help="停止 collector")

    # health
    p_health = sub.add_parser("health", help="健康检查")
    p_health.add_argument("--host", default="localhost")
    p_health.add_argument("--port", type=int, default=13133)

    # scrape-config
    p_scrape = sub.add_parser("scrape-config", help="输出 prometheus remote_write 片段")
    p_scrape.add_argument("--out", default="")

    args = p.parse_args(argv)

    if args.cmd == "gen-config":
        b = CollectorConfigBuilder(service_name=args.service_name)
        b.add_otlp_receiver().add_prometheus_receiver()
        b.add_health_check_extension().add_zpages_extension()
        b.add_memory_limiter().add_batch_processor()
        if args.enable_tail_sampling:
            b.add_tail_sampling()
        b.add_prometheus_exporter().add_otlp_exporter(endpoint=args.tempo_endpoint).add_logging_exporter()
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(b.to_yaml())
        print(f"✅ 配置已生成: {args.out}")
        return 0

    if args.cmd == "status":
        mgr = CollectorManager()
        st = mgr.container_status()
        print(json.dumps(st, ensure_ascii=False, indent=2))
        return 0

    if args.cmd == "start":
        mgr = CollectorManager()
        r = mgr.start(args.config, detach=args.detach)
        print(json.dumps(r, ensure_ascii=False, indent=2))
        return 0 if r.get("ok") else 1

    if args.cmd == "stop":
        mgr = CollectorManager()
        r = mgr.stop()
        print(json.dumps(r, ensure_ascii=False, indent=2))
        return 0 if r.get("ok") else 1

    if args.cmd == "health":
        hc = HealthChecker(host=args.host, port=args.port)
        print(json.dumps(hc.full_check(), ensure_ascii=False, indent=2))
        return 0

    if args.cmd == "scrape-config":
        cfg = PrometheusRemoteWriteConfig.to_yaml()
        if args.out:
            with open(args.out, "w", encoding="utf-8") as f:
                f.write(cfg)
            print(f"✅ 已写入: {args.out}")
        else:
            print(cfg)
        return 0

    return 1


if __name__ == "__main__":
    sys.exit(main())
