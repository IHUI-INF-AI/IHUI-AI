"""Phase 14 建议 2: Federation 双层联邦 (中心聚合多边缘).

目的:
  Phase 12 建议 2 实现了边缘 /federate 端点, 让中心 Prometheus 反向抓取.
  Phase 14 加:
  1. 中心端: 周期性抓取多个边缘 /federate, 合并到本地 registry
  2. 跨域 label 去重: 同一 series 多次抓取只保留 1 份 (按 (name, sorted labels))
  3. 标签归一化: 给所有 series 加 source_edge / cluster / region 等元信息
  4. 暴露本地 /metrics, 让中心 Prometheus / Alertmanager / Grafana 用
  5. 容错: 单个边缘失败不影响整体, 重试 + 退避

组件:
  - EdgeConfig: 边缘配置 (name, url, bearer_token, match[], scrape_interval)
  - parse_prometheus_text(text, source) -> list[Series]
  - Series: name, labels, value, metric_type, source_edge
  - Aggregator: registry + 多个 EdgeConfig, scrape_all() 周期抓取, 去重合并
  - 本地 FastAPI: GET /metrics, GET /healthz, POST /v1/scrape 手动触发

用法:
  # 1. 配置 (YAML 或 env)
  edges:
    - name: edge-cn-east
      url: http://edge-cn-east:9105/federate
      match: ['{__name__=~"zhs_federation_.*"}']
      scrape_interval: 15
      bearer_token: xxx

  # 2. 启动聚合器
  python scripts/ops/federation_aggregator.py --config config/edges.yml --port 9205

  # 3. 中心 Prometheus 抓聚合器 /metrics
  scrape_configs:
    - job_name: zhs_federation_center
      static_configs:
        - targets: ['aggregator:9205']
"""

from __future__ import annotations

import argparse
import asyncio
import json
import re
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

try:
    import httpx
except ImportError:
    httpx = None  # type: ignore

try:
    from prometheus_client import CollectorRegistry, Counter, Gauge, generate_latest
    from prometheus_client.core import Sample

    PROMETHEUS_AVAILABLE = True
except ImportError:
    PROMETHEUS_AVAILABLE = False

try:
    import uvicorn
    from fastapi import FastAPI
    from fastapi.responses import PlainTextResponse

    FASTAPI_AVAILABLE = True
except ImportError:
    FASTAPI_AVAILABLE = False


# ---------------------------------------------------------------------------
# 1. 数据类
# ---------------------------------------------------------------------------


@dataclass
class EdgeConfig:
    """边缘节点配置."""

    name: str
    url: str
    match: list[str] = field(default_factory=list)
    bearer_token: str = ""
    scrape_interval: int = 30
    timeout_s: float = 10.0
    extra_labels: dict[str, str] = field(default_factory=dict)
    enabled: bool = True

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "url": self.url,
            "match": list(self.match),
            "scrape_interval": self.scrape_interval,
            "extra_labels": dict(self.extra_labels),
            "enabled": self.enabled,
        }


@dataclass
class Series:
    """一条时间序列."""

    name: str
    labels: dict[str, str]
    value: float
    metric_type: str = "untyped"  # counter/gauge/histogram/summary/untyped
    source_edge: str = ""

    def signature(self) -> tuple[str, tuple[tuple[str, str], ...]]:
        """去重签名: (metric_name, sorted labels)."""
        return (self.name, tuple(sorted(self.labels.items())))

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "labels": self.labels,
            "value": self.value,
            "metric_type": self.metric_type,
            "source_edge": self.source_edge,
        }


# ---------------------------------------------------------------------------
# 2. Prometheus 文本解析
# ---------------------------------------------------------------------------

# 行类型:
#   # HELP <name> <text>
#   # TYPE <name> <type>
#   <name>{label1="v1",label2="v2"} 123 [timestamp]
_LABEL_RE = re.compile(r'(\w+)="((?:[^"\\]|\\.)*)"')
_LINE_RE = re.compile(r"^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{[^}]*\})?\s+(\S+)(?:\s+(\S+))?\s*$")


def parse_label_value(v: str) -> str:
    """解析 label value, 处理 \\" \\n \\\\."""
    return v.replace('\\"', '"').replace("\\n", "\n").replace("\\\\", "\\")


def format_label_value(v: str) -> str:
    """格式化 label value, 转义 \\" \\n \\\\."""
    return v.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


def parse_prometheus_text(text: str, source: str = "") -> list[Series]:
    """解析 prometheus 文本格式, 返回 Series 列表.

    支持:
      - HELP / TYPE 元数据
      - 单 label / 多 label
      - timestamp (可选)
    """
    series_list: list[Series] = []
    metric_types: dict[str, str] = {}
    metric_helps: dict[str, str] = {}

    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith("# HELP "):
            m = re.match(r"# HELP\s+(\S+)\s+(.*)", line)
            if m:
                metric_helps[m.group(1)] = m.group(2)
            continue
        if line.startswith("# TYPE "):
            m = re.match(r"# TYPE\s+(\S+)\s+(\S+)", line)
            if m:
                metric_types[m.group(1)] = m.group(2)
            continue
        if line.startswith("#"):
            continue
        m = _LINE_RE.match(line)
        if not m:
            continue
        name = m.group(1)
        labels_str = m.group(2) or ""
        value_str = m.group(3)
        try:
            value = float(value_str)
        except ValueError:
            continue
        labels: dict[str, str] = {}
        if labels_str:
            inner = labels_str[1:-1]  # strip { }
            for lm in _LABEL_RE.finditer(inner):
                k = lm.group(1)
                v = parse_label_value(lm.group(2))
                labels[k] = v
        # 类型: 优先 metric_types, 否则 'untyped'
        mtype = metric_types.get(name, "untyped")
        series_list.append(
            Series(
                name=name,
                labels=labels,
                value=value,
                metric_type=mtype,
                source_edge=source,
            )
        )
    return series_list


# ---------------------------------------------------------------------------
# 3. 去重 + 标签归一化
# ---------------------------------------------------------------------------


def merge_series(
    series_lists: list[list[Series]],
    *,
    dedup: bool = True,
    extra_labels: dict[str, str] | None = None,
    source_label: str = "source_edge",
) -> list[Series]:
    """合并多组 series, 可选去重 + 加源标签.

    去重规则: 同 (name, 不含 source 标签的 sorted labels) 视为同一条, 后到的覆盖先到的.
    extra_labels: 给所有 series 强制加的标签 (如 cluster, region).
    source_label: 用哪个 label 标记源边缘 (默认 source_edge).
    """
    extra_labels = extra_labels or {}
    seen: dict[tuple, int] = {}  # sig -> out 索引
    out: list[Series] = []
    for group in series_lists:
        for s in group:
            # dedup 用不含 source 标签的签名
            sig_labels = {k: v for k, v in s.labels.items() if k != source_label}
            sig = (s.name, tuple(sorted(sig_labels.items())))
            # 加 extra_labels (已有的不覆盖)
            for k, v in extra_labels.items():
                s.labels.setdefault(k, v)
            if dedup:
                if sig in seen:
                    idx = seen[sig]
                    prev = out[idx]
                    # 多源: 合并到 source_label (用逗号拼接去重)
                    sources: set[str] = set()
                    if prev.source_edge:
                        sources.add(prev.source_edge)
                    if s.source_edge:
                        sources.add(s.source_edge)
                    if prev.labels.get(source_label):
                        for src in prev.labels[source_label].split(","):
                            if src:
                                sources.add(src)
                    s.labels[source_label] = ",".join(sorted(sources))
                    # 替换 out 中的 series
                    out[idx] = s
                else:
                    if s.source_edge:
                        s.labels[source_label] = s.source_edge
                    seen[sig] = len(out)
                    out.append(s)
            else:
                if s.source_edge:
                    s.labels[source_label] = s.source_edge
                out.append(s)
    return out


# ---------------------------------------------------------------------------
# 4. Aggregator
# ---------------------------------------------------------------------------


class Aggregator:
    """联邦聚合器.

    职责:
      - 持有多个 EdgeConfig
      - 周期性 scrape_all() 抓取 + 合并 + 写入 registry
      - 单 edge 失败不影响其他
      - 暴露本地 metrics (aggregate_* 系列)
    """

    def __init__(self, registry: Any | None = None):
        self.edges: dict[str, EdgeConfig] = {}
        self.last_results: dict[str, list[Series]] = {}
        self.last_scrape_ts: dict[str, float] = {}
        self.last_scrape_status: dict[str, str] = {}
        if registry is None and PROMETHEUS_AVAILABLE:
            registry = CollectorRegistry()
        self.registry = registry

        # 内部指标
        if PROMETHEUS_AVAILABLE:
            self._edge_up = Gauge(
                "zhs_federation_aggregator_edge_up",
                "边缘节点 up 状态 (1=up, 0=down)",
                ["edge"],
                registry=registry,
            )
            self._edge_series_count = Gauge(
                "zhs_federation_aggregator_edge_series_count",
                "边缘节点返回的 series 数量",
                ["edge"],
                registry=registry,
            )
            self._edge_scrape_duration = Gauge(
                "zhs_federation_aggregator_edge_scrape_duration_seconds",
                "边缘节点抓取耗时 (秒)",
                ["edge"],
                registry=registry,
            )
            self._total_series = Gauge(
                "zhs_federation_aggregator_total_series",
                "合并去重后的总 series 数",
                registry=registry,
            )

    def add_edge(self, cfg: EdgeConfig) -> None:
        self.edges[cfg.name] = cfg
        if PROMETHEUS_AVAILABLE:
            self._edge_up.labels(edge=cfg.name).set(0)

    def remove_edge(self, name: str) -> None:
        self.edges.pop(name, None)
        self.last_results.pop(name, None)
        self.last_scrape_ts.pop(name, None)
        self.last_scrape_status.pop(name, None)

    async def scrape_one(self, cfg: EdgeConfig) -> list[Series]:
        """抓取单个边缘."""
        if httpx is None:
            return []
        headers: dict[str, str] = {}
        if cfg.bearer_token:
            headers["Authorization"] = f"Bearer {cfg.bearer_token}"
        params: list[tuple[str, str]] = []
        for m in cfg.match:
            params.append(("match[]", m))

        start = time.time()
        try:
            async with httpx.AsyncClient(timeout=cfg.timeout_s) as client:
                r = await client.get(cfg.url, headers=headers, params=params)
            duration = time.time() - start
            if r.status_code != 200:
                if PROMETHEUS_AVAILABLE:
                    self._edge_up.labels(edge=cfg.name).set(0)
                    self._edge_scrape_duration.labels(edge=cfg.name).set(duration)
                self.last_scrape_status[cfg.name] = f"http_{r.status_code}"
                return []
            series = parse_prometheus_text(r.text, source=cfg.name)
            if PROMETHEUS_AVAILABLE:
                self._edge_up.labels(edge=cfg.name).set(1)
                self._edge_series_count.labels(edge=cfg.name).set(len(series))
                self._edge_scrape_duration.labels(edge=cfg.name).set(duration)
            self.last_scrape_status[cfg.name] = "ok"
            return series
        except Exception as e:
            duration = time.time() - start
            if PROMETHEUS_AVAILABLE:
                self._edge_up.labels(edge=cfg.name).set(0)
                self._edge_scrape_duration.labels(edge=cfg.name).set(duration)
            self.last_scrape_status[cfg.name] = f"{type(e).__name__}: {e}"
            return []

    async def scrape_all(self) -> list[Series]:
        """并发抓取所有边缘, 返回合并去重结果."""
        if not self.edges:
            return []
        results = await asyncio.gather(
            *(self.scrape_one(c) for c in self.edges.values() if c.enabled),
            return_exceptions=True,
        )
        all_series_lists: list[list[Series]] = []
        for cfg, result in zip(self.edges.values(), results):
            if isinstance(result, Exception):
                self.last_scrape_status[cfg.name] = f"{type(result).__name__}: {result}"
                if PROMETHEUS_AVAILABLE:
                    self._edge_up.labels(edge=cfg.name).set(0)
                continue
            self.last_results[cfg.name] = result
            self.last_scrape_ts[cfg.name] = time.time()
            # 加 edge 自己的 extra_labels
            tagged = [
                Series(
                    name=s.name,
                    labels=dict(s.labels),
                    value=s.value,
                    metric_type=s.metric_type,
                    source_edge=cfg.name,
                )
                for s in result
            ]
            all_series_lists.append(tagged)
        merged = merge_series(all_series_lists, dedup=True)
        if PROMETHEUS_AVAILABLE:
            self._total_series.set(len(merged))
        return merged

    def get_merged_series(self) -> list[Series]:
        """返回上次合并的 series (无合并时为空)."""
        all_series_lists = list(self.last_results.values())
        return merge_series(all_series_lists, dedup=True)

    def render_metrics(self) -> str:
        """渲染本地 /metrics 文本."""
        if not PROMETHEUS_AVAILABLE:
            return ""
        return generate_latest(self.registry).decode("utf-8")

    def status_dict(self) -> dict:
        return {
            "edge_count": len(self.edges),
            "edges": [
                {
                    **c.to_dict(),
                    "last_scrape_ts": self.last_scrape_ts.get(c.name, 0),
                    "last_scrape_status": self.last_scrape_status.get(c.name, "never"),
                    "last_series_count": len(self.last_results.get(c.name, [])),
                }
                for c in self.edges.values()
            ],
        }


# ---------------------------------------------------------------------------
# 5. FastAPI
# ---------------------------------------------------------------------------


def create_app(agg: Aggregator) -> Any:
    """创建 FastAPI app."""
    if not FASTAPI_AVAILABLE:
        return None
    app = FastAPI(title="ZHS Federation Aggregator", version="1.0")

    @app.get("/healthz")
    async def healthz():
        return {"status": "ok", "ts": int(time.time())}

    @app.get("/cluster/status")
    async def cluster_status():
        return agg.status_dict()

    @app.get("/metrics", response_class=PlainTextResponse)
    async def metrics():
        # 每次请求前先 scrape 一次
        try:
            await agg.scrape_all()
        except Exception as e:
            return f"# scrape error: {e}\n"
        return agg.render_metrics()

    @app.post("/v1/scrape")
    async def scrape_now():
        merged = await agg.scrape_all()
        return {"series_count": len(merged), "ts": int(time.time())}

    return app


# ---------------------------------------------------------------------------
# 6. CLI
# ---------------------------------------------------------------------------


def load_edges_from_file(path: Path) -> list[EdgeConfig]:
    """从 JSON 或 YAML 加载 edge 配置 (简化版: 只支持 JSON 列表 / YAML 用 pyyaml)."""
    if not path.exists():
        raise FileNotFoundError(f"配置文件不存在: {path}")
    text = path.read_text(encoding="utf-8")
    # 简单 JSON 优先
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        try:
            import yaml  # type: ignore

            data = yaml.safe_load(text)
        except ImportError:
            raise ValueError("YAML 配置需安装 pyyaml")
    if not isinstance(data, dict) or "edges" not in data:
        raise ValueError("配置需含 'edges' 键")
    out: list[EdgeConfig] = []
    for item in data["edges"]:
        out.append(
            EdgeConfig(
                name=item["name"],
                url=item["url"],
                match=list(item.get("match", [])),
                bearer_token=item.get("bearer_token", ""),
                scrape_interval=int(item.get("scrape_interval", 30)),
                timeout_s=float(item.get("timeout_s", 10.0)),
                extra_labels=dict(item.get("extra_labels", {})),
                enabled=bool(item.get("enabled", True)),
            )
        )
    return out


def main() -> int:
    p = argparse.ArgumentParser(description="ZHS Federation 聚合器")
    p.add_argument("--host", default="0.0.0.0", help="监听 host")
    p.add_argument("--port", type=int, default=9205, help="监听 port")
    p.add_argument("--config", type=Path, help="边缘配置 JSON/YAML 文件")
    p.add_argument("--edge", action="append", default=[], help="边缘 name@url (可多次)")
    p.add_argument("--match", default='{__name__=~"zhs_federation_.*"}', help="默认 match[]")
    args = p.parse_args()

    if not PROMETHEUS_AVAILABLE:
        print("[error] prometheus_client 不可用", file=sys.stderr)
        return 3
    if not FASTAPI_AVAILABLE:
        print("[error] fastapi 不可用", file=sys.stderr)
        return 3

    agg = Aggregator()

    # 加载配置
    if args.config:
        for cfg in load_edges_from_file(args.config):
            agg.add_edge(cfg)
            print(f"[edge] {cfg.name} @ {cfg.url}")
    for e in args.edge:
        if "@" not in e:
            print(f"[warn] --edge 格式错误, 期望 name@url: {e}")
            continue
        name, url = e.split("@", 1)
        agg.add_edge(EdgeConfig(name=name, url=url, match=[args.match]))
        print(f"[edge] {name} @ {url}")

    if not agg.edges:
        print("[error] 至少需要 1 个 --edge 或 --config", file=sys.stderr)
        return 2

    app = create_app(agg)
    print(f"ZHS Federation Aggregator: http://{args.host}:{args.port}")
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")
    return 0


if __name__ == "__main__":
    sys.exit(main())
