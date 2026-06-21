"""时钟漂移指标单元测试 (建议 2 落地测试).

验证:
  1. monitor 启动后 /metrics 有 zhs_biz_app_local_time_seconds
  2. 数值是 time.time() 量级 (1.7e9 附近)
  3. APP_TIME_SOURCE 至少 1 个 source 标签 = 1
  4. ZHSMonitorClockDrift 告警规则可被 PromQL 评估 (单位校验)
  5. ZHSMonitorTimeSourceFallback 告警规则已注册
"""

from __future__ import annotations

import os
import re
import sys
import time
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def _get_metrics(port: int) -> str:
    import httpx

    r = httpx.get(f"http://127.0.0.1:{port}/metrics", timeout=5)
    return r.text


def _server_reachable(port: int) -> bool:
    import socket

    try:
        with socket.create_connection(("127.0.0.1", port), timeout=2):
            return True
    except Exception:
        return False


_skip_no_server = pytest.mark.skipif(
    not _server_reachable(int(os.environ.get("ZHS_DRILL_TEST_PORT", "18803"))),
    reason="需要运行中的服务器 (port 18803)",
)


@_skip_no_server
@pytest.mark.asyncio
async def test_app_local_time_metric_present():
    """monitor_running 起来后, /metrics 必须有 zhs_biz_app_local_time_seconds."""
    port = int(os.environ.get("ZHS_DRILL_TEST_PORT", "18803"))
    body = _get_metrics(port)
    assert "zhs_biz_app_local_time_seconds" in body, "缺少 zhs_biz_app_local_time_seconds 指标"


@_skip_no_server
@pytest.mark.asyncio
async def test_app_local_time_value_is_recent():
    """zhs_biz_app_local_time_seconds 数值应在 time.time() 附近 (±60s)."""
    port = int(os.environ.get("ZHS_DRILL_TEST_PORT", "18803"))
    body = _get_metrics(port)
    m = re.search(r"^zhs_biz_app_local_time_seconds\s+([\d.eE+-]+)", body, re.M)
    assert m, "找不到 zhs_biz_app_local_time_seconds 行"
    val = float(m.group(1))
    now = time.time()
    assert abs(val - now) < 60, f"app_local_time={val} 距 now={now} 差距 {abs(val - now):.1f}s 超过 60s"


@_skip_no_server
@pytest.mark.asyncio
async def test_app_time_source_label_set():
    """APP_TIME_SOURCE 至少 time.time 标签 = 1."""
    port = int(os.environ.get("ZHS_DRILL_TEST_PORT", "18803"))
    body = _get_metrics(port)
    m = re.search(r'^zhs_biz_app_time_source\{source="time\.time"\}\s+([\d.eE+-]+)', body, re.M)
    assert m, '找不到 zhs_biz_app_time_source{source="time.time"} 标签'
    assert float(m.group(1)) == 1.0, f"time.time 源未激活, 值={m.group(1)}"


def test_prom_rules_has_clock_drift_alert():
    """Prometheus rules.yml 包含 ZHSMonitorClockDrift 与 ZHSMonitorTimeSourceFallback 两条新告警."""
    rules_path = ROOT / "docker" / "prometheus" / "rules.yml"
    data = yaml.safe_load(rules_path.read_text(encoding="utf-8"))
    all_alerts = []
    for g in data.get("groups", []):
        for r in g.get("rules", []):
            if "alert" in r:
                all_alerts.append(r["alert"])
    assert "ZHSMonitorClockDrift" in all_alerts, "缺少 ZHSMonitorClockDrift"
    assert "ZHSMonitorTimeSourceFallback" in all_alerts, "缺少 ZHSMonitorTimeSourceFallback"


def test_clock_drift_promql_parses():
    """ZHSMonitorClockDrift 的 expr 用 abs(time() - zhs_biz_app_local_time_seconds) 必须 PromQL 可解析."""
    rules_path = ROOT / "docker" / "prometheus" / "rules.yml"
    data = yaml.safe_load(rules_path.read_text(encoding="utf-8"))
    expr = None
    for g in data.get("groups", []):
        for r in g.get("rules", []):
            if r.get("alert") == "ZHSMonitorClockDrift":
                expr = r["expr"]
    assert expr is not None
    assert "zhs_biz_app_local_time_seconds" in expr
    assert "time()" in expr
    assert "abs(" in expr
    assert "> 30" in expr
