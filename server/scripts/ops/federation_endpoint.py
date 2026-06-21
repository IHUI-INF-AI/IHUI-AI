"""Phase 12 建议 2: 联邦指标 Federation Endpoint (反向被中心抓取).

目的:
  Phase 11 建议 2 把联邦路由指标暴露在本地 /metrics.
  这里实现 Prometheus Federation 协议端点 /federate,
  让中心 Prometheus 用 match[] 过滤后反向抓取.

协议: Prometheus Federation API
  GET /federate?match[]={__name__="metric_name",label="value"}
  返回 prometheus 文本格式, 只含 match[] 匹配的时间序列.

设计:
  1. 用 FastAPI 暴露 /federate 端点
  2. 支持 match[] 多个 (任一匹配即返回)
  3. 支持正则 / 多 label 过滤
  4. 指标数据从联邦 registry 拉 (Phase 11 建议 2)
  5. Bearer 鉴权 + IP 白名单 + 令牌桶限流 (Phase 13 建议 2)

用法:
  # 启动时配置鉴权/限流 (从环境变量)
  export ZHS_FEDERATION_BEARER_TOKEN="secret1,secret2"
  export ZHS_FEDERATION_ALLOW_IPS="10.0.0.0/8,127.0.0.1"
  export ZHS_FEDERATION_RATE_PER_MIN=60
  uvicorn scripts.ops.federation_endpoint:app --port 9105

  # Prometheus 配置
  scrape_configs:
    - job_name: zhs_federation
      scheme: http
      static_configs:
        - targets: ['federation.zhs.top:9105']
      authorization:
        type: Bearer
        credentials: secret1
      params:
        'match[]': ['{__name__=~"zhs_federation_.*"}']
"""

from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Any

try:
    from fastapi import FastAPI, Header, HTTPException, Query, Request
    from fastapi.responses import PlainTextResponse

    FASTAPI_AVAILABLE = True
except ImportError:
    FASTAPI_AVAILABLE = False

# 复用 federation_metrics 模块
_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_ROOT / "scripts" / "ops"))

import federation_metrics  # noqa: E402  type: ignore
import federation_security  # noqa: E402  type: ignore

app = FastAPI(title="ZHS Federation Endpoint", version="1.1") if FASTAPI_AVAILABLE else None


# ---------------------------------------------------------------------------
# 1. 匹配逻辑 (支持 Prometheus match[] 语法简化版)
# ---------------------------------------------------------------------------


def _match_label_value(series_labels: dict[str, str], matcher: dict[str, str]) -> bool:
    """判断单个 series 是否匹配单个 matcher.

    matcher 形如:
      {"__name__": "zhs_federation_*", "region": "cn-east-1"}

    支持:
      - __name__ 匹配
      - 完全等值 (str)
      - 简单前缀匹配 (通配符 * 在尾部: prefix*)
      - 完全等值 (==/=)
    """
    for k, v_pattern in matcher.items():
        actual = series_labels.get(k, "")
        if v_pattern.endswith("*"):
            if not actual.startswith(v_pattern[:-1]):
                return False
        elif v_pattern.startswith("*"):
            if not actual.endswith(v_pattern[1:]):
                return False
        elif "*" in v_pattern:
            # 简单正则替换
            regex = "^" + re.escape(v_pattern).replace(r"\*", ".*") + "$"
            if not re.match(regex, actual):
                return False
        else:
            if actual != v_pattern:
                return False
    return True


def parse_matchers(match_list: list[str]) -> list[dict[str, str]]:
    """解析 Prometheus match[] 字符串为 dict 列表.

    支持: {__name__="zhs_*",region="cn-east-1"}
    """
    result = []
    for m in match_list:
        m = m.strip()
        if not m.startswith("{") or not m.endswith("}"):
            continue
        inner = m[1:-1]
        # 拆分 key="value",key2="value2"
        parts = re.findall(r'(\w+)\s*=\s*"([^"]*)"', inner)
        result.append(dict(parts))
    return result


def _get_series_from_registry() -> list[dict[str, Any]]:
    """从 federation_metrics 的 REGISTRY 提取所有 series."""
    if federation_metrics.REGISTRY is None:
        return []
    series_list = []
    for metric in federation_metrics.REGISTRY.collect():
        for sample in metric.samples:
            series_list.append(
                {
                    "name": sample.name,
                    "labels": dict(sample.labels),
                    "value": sample.value,
                    "metric_type": metric.type,
                }
            )
    return series_list


def _filter_series(series_list: list[dict[str, Any]], matchers_list: list[dict[str, str]]) -> list[dict[str, Any]]:
    """按 matchers 过滤 series (任一 matcher 匹配即保留)."""
    if not matchers_list:
        return series_list
    out = []
    for s in series_list:
        full_labels = {"__name__": s["name"], **s["labels"]}
        for m in matchers_list:
            if _match_label_value(full_labels, m):
                out.append(s)
                break
    return out


def _format_prometheus_text(series_list: list[dict[str, Any]]) -> str:
    """格式化为 Prometheus 文本格式."""
    if not series_list:
        return "# federation 端点无匹配 series\n"
    lines = []
    # HELP + TYPE (按 metric name 分组)
    seen_meta: set[str] = set()
    for s in series_list:
        name = s["name"]
        if name not in seen_meta:
            seen_meta.add(name)
            lines.append(f"# HELP {name} federation exposed metric")
            lines.append(f"# TYPE {name} {s['metric_type']}")
    # 实际 series
    for s in series_list:
        labels_str = ""
        if s["labels"]:
            kv = ",".join(f'{k}="{v}"' for k, v in sorted(s["labels"].items()))
            labels_str = "{" + kv + "}"
        lines.append(f"{s['name']}{labels_str} {s['value']}")
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# 2. FastAPI 端点
# ---------------------------------------------------------------------------

if app is not None:

    @app.get("/federate", response_class=PlainTextResponse)
    async def federate(
        request: Request,
        match: list[str] = Query(default=[], alias="match[]"),
        authorization: str | None = Header(default=None),
    ) -> str:
        """Prometheus Federation 端点.

        Query:
          match[]: 多个匹配模式, 任一匹配即返回
                   例: ?match[]={__name__="zhs_federation_.*"}&match[]={region="cn-east-1"}

        Headers:
          Authorization: Bearer <token>  (可选, 由 ZHS_FEDERATION_BEARER_TOKEN 配置决定是否必填)

        安全 (Phase 13 建议 2):
          - Bearer token 鉴权 (ZHS_FEDERATION_BEARER_TOKEN 配置时启用)
          - IP 白名单 (ZHS_FEDERATION_ALLOW_IPS 配置时启用)
          - 令牌桶限流 (ZHS_FEDERATION_RATE_PER_MIN/BURST, 默认 60/分钟)
        """
        # 安全检查
        client_ip = request.client.host if request.client else None
        try:
            federation_security.enforce(authorization, client_ip)
        except federation_security.SecurityError as e:
            raise HTTPException(status_code=e.status_code, detail=e.detail)

        if not match:
            raise HTTPException(status_code=400, detail="至少需要 1 个 match[] 参数")
        matchers_list = parse_matchers(match)
        if not matchers_list:
            raise HTTPException(status_code=400, detail="match[] 解析失败")
        series_list = _get_series_from_registry()
        filtered = _filter_series(series_list, matchers_list)
        return _format_prometheus_text(filtered)

    @app.get("/healthz")
    async def healthz() -> dict:
        return {
            "status": "ok",
            "registry": federation_metrics.REGISTRY is not None,
            "auth_enabled": bool(federation_security._bearer_tokens),
            "ip_allowlist_enabled": bool(federation_security._allow_ips),
        }


# ---------------------------------------------------------------------------
# 3. 纯函数导出 (供测试 / 其他模块用)
# ---------------------------------------------------------------------------


def federate_filter(match_list: list[str]) -> str:
    """纯函数: 模拟 /federate 端点, 返回过滤后的 Prometheus 文本."""
    matchers_list = parse_matchers(match_list)
    series_list = _get_series_from_registry()
    filtered = _filter_series(series_list, matchers_list)
    return _format_prometheus_text(filtered)


# ---------------------------------------------------------------------------
# 4. CLI
# ---------------------------------------------------------------------------


def main() -> int:
    """CLI: 演示 /federate 行为 (无需启动 server)."""
    # 启动时加载环境变量配置 (仅在 CLI 入口执行, 不影响 import)
    try:
        federation_security.load_from_env()
    except Exception as e:
        print(f"[warn] 安全配置加载失败: {e}")

    federation_metrics.init_route_gauges()
    federation_metrics.update_source_up("cn-east-1", "prometheus-cn-east-1:9090", up=True)
    federation_metrics.set_scrape_interval("cn-east-1", 15.0)
    for prefix in ("zhs_biz", "zhs_canary", "zhs_monitor"):
        federation_metrics.inc_match("cn-east-1", prefix, n=10)

    print("--- 全部 series ---")
    print(federate_filter(['{__name__=~"zhs_federation_.*"}']))
    print("--- 只 cn-east-1 region ---")
    print(federate_filter(['{__name__=~"zhs_federation_.*",region="cn-east-1"}']))
    return 0


if __name__ == "__main__":
    sys.exit(main())
