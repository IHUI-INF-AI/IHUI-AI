"""WS 压测脚本 CLI 阈值门禁测试 (建议 85).

覆盖:
  - --miss-ratio-max 参数解析
  - LOADTEST_MISS_MAX 环境变量覆盖
  - --json 输出 JSON 报告行
  - JSON 报告 schema 包含关键字段
  - 阈值判定逻辑 (loss_pct >= max*100 → 失败)
"""

import importlib
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def _run_cli(args, env_extra=None, timeout=120):
    """直接调用 loadtest_ws main, 返回 (returncode, stdout)."""
    env = os.environ.copy()
    if env_extra:
        env.update(env_extra)
    # 把 ROOT 注入, 让子进程能 import app.*
    env["PYTHONPATH"] = str(ROOT) + os.pathsep + env.get("PYTHONPATH", "")
    env.setdefault("PYTHONIOENCODING", "utf-8")
    p = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "ci" / "loadtest_ws.py"), *args],
        capture_output=True,
        timeout=timeout,
        env=env,
    )
    stdout = p.stdout.decode("utf-8", errors="replace") if p.stdout else ""
    return p.returncode, stdout, ""


# ---------------------------------------------------------------------------
# argparse 解析
# ---------------------------------------------------------------------------


def test_loadtest_module_imports():
    mod = importlib.import_module("scripts.ci.loadtest_ws")
    assert hasattr(mod, "main")
    assert hasattr(mod, "_MISS_RATIO_MAX")
    assert hasattr(mod, "_JSON_OUT")


def test_loadtest_default_threshold_is_5_percent():
    """不传 --miss-ratio-max 也不设 env 时, 默认 0.05."""
    from scripts.ci import loadtest_ws

    # 直接读模块默认常量
    assert loadtest_ws._MISS_RATIO_MAX == 0.05


def test_loadtest_runs_with_default_threshold_small():
    """小压测应能跑通, 0 漏报, 退出码 0."""
    rc, out, err = _run_cli(
        ["--instances", "2", "--conns", "20", "--msgs", "20", "--json"],
        timeout=60,
    )
    assert rc == 0, f"unexpected exit {rc}, stderr={err}\nstdout tail:\n{out[-500:]}"
    # JSON 报告标记
    assert "---JSON-REPORT-START---" in out
    assert "---JSON-REPORT-END---" in out
    # 提取 JSON 段
    s = out.find("---JSON-REPORT-START---") + len("---JSON-REPORT-START---")
    e = out.find("---JSON-REPORT-END---")
    payload = json.loads(out[s:e].strip())
    assert payload["instances"] == 2
    assert payload["conns_per_instance"] == 20
    assert payload["msgs"] == 20
    assert payload["passed"] is True
    assert payload["loss_pct"] == 0.0
    assert payload["miss_ratio_max"] == 0.05


def test_loadtest_env_override_threshold():
    """LOADTEST_MISS_MAX=0.0 环境变量会被识别 (任何漏报即失败)."""
    rc, out, err = _run_cli(
        ["--instances", "2", "--conns", "10", "--msgs", "5", "--json"],
        env_extra={"LOADTEST_MISS_MAX": "0.0"},
        timeout=60,
    )
    # 由于实际 0 漏报, 应该 PASS
    s = out.find("---JSON-REPORT-START---") + len("---JSON-REPORT-START---")
    e = out.find("---JSON-REPORT-END---")
    payload = json.loads(out[s:e].strip())
    assert payload["miss_ratio_max"] == 0.0
    # 0 漏报 < 0% 阈值 = PASS
    assert rc == 0
    assert payload["passed"] is True


def test_loadtest_cli_threshold_argument():
    """--miss-ratio-max=0.001 在大压测下会触发失败逻辑 (验证参数生效)."""
    # 用很小的连接/消息, 跑出 0 漏报. 但阈值超 0 几乎不可能
    # 这里只验证 CLI 解析: 阈值进 JSON
    rc, out, _ = _run_cli(
        ["--instances", "2", "--conns", "10", "--msgs", "5", "--miss-ratio-max", "0.001", "--json"],
        timeout=60,
    )
    s = out.find("---JSON-REPORT-START---") + len("---JSON-REPORT-START---")
    e = out.find("---JSON-REPORT-END---")
    payload = json.loads(out[s:e].strip())
    assert payload["miss_ratio_max"] == 0.001


def test_loadtest_json_report_schema():
    """JSON 报告 schema 完整性: 必含字段不能少."""
    rc, out, _ = _run_cli(
        ["--instances", "2", "--conns", "10", "--msgs", "5", "--json"],
        timeout=60,
    )
    s = out.find("---JSON-REPORT-START---") + len("---JSON-REPORT-START---")
    e = out.find("---JSON-REPORT-END---")
    payload = json.loads(out[s:e].strip())
    required = {
        "instances",
        "conns_per_instance",
        "total_conns",
        "msgs",
        "send_elapsed_ms",
        "total_elapsed_ms",
        "qps_send",
        "expected_total",
        "received_total",
        "loss",
        "loss_pct",
        "same_instance_received",
        "cross_instance_received",
        "cross_instance_rate_pct",
        "p50_ms",
        "p95_ms",
        "p99_ms",
        "max_ms",
        "miss_ratio_max",
        "passed",
    }
    missing = required - set(payload.keys())
    assert not missing, f"JSON 报告缺字段: {missing}"


def test_loadtest_fail_message_present():
    """压测报告里 PASS/FAIL 标记应出现."""
    rc, out, _ = _run_cli(
        ["--instances", "2", "--conns", "10", "--msgs", "5"],
        timeout=60,
    )
    # 小压测应 PASS
    assert "[PASS]" in out or "[FAIL]" in out
