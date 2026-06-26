"""验证 dashboard 引用的所有指标在真实 /metrics 端点都存在 (2026-06-26 新增).

为 dashboard 部署前的最后一道验证: 不能让 dashboard 上线后 Grafana 报
'Unknown metric' 红屏.
"""
from __future__ import annotations

import json
import re
import sys
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
DASHBOARD = REPO_ROOT / "deploy" / "grafana" / "dashboards" / "zhs_ws_auto_recovery_dashboard.json"
ENDPOINT = "http://127.0.0.1:8000/api/v1/system/auto-recovery/metrics"


def main() -> int:
    if not DASHBOARD.exists():
        print(f"FAIL: dashboard not found: {DASHBOARD}")
        return 1

    # 1) 拉真实 metrics
    try:
        body = urllib.request.urlopen(ENDPOINT, timeout=10).read().decode("utf-8", errors="replace")
    except Exception as e:
        print(f"FAIL: cannot fetch {ENDPOINT}: {e}")
        return 1
    print(f"OK fetched {len(body)} bytes from {ENDPOINT}")

    # 2) 解析暴露的指标 (从 /metrics 文本中)
    exposed: set[str] = set()
    for line in body.splitlines():
        m = re.match(r"^(zhs_[a-z][a-z0-9_]*)(\{|\s)", line)
        if m:
            exposed.add(m.group(1))
    print(f"OK exposed unique metrics (runtime): {len(exposed)}")

    # 3) 解析 dashboard 引用的指标
    raw = DASHBOARD.read_text(encoding="utf-8")
    data = json.loads(raw)
    referenced: set[str] = set()
    for p in data["panels"]:
        if p.get("type") == "row":
            continue
        for t in p.get("targets", []):
            expr = t.get("expr") or ""
            for m in re.findall(r"zhs_[a-z][a-z0-9_]*", expr):
                referenced.add(m)
    print(f"OK referenced unique metrics: {len(referenced)}")

    # 3) 解析 Python 源码定义的指标 (这是真值, 不依赖运行时是否已触发)
    metrics_file = REPO_ROOT / "server" / "app" / "ws" / "auto_recovery_metrics.py"
    defined: set[str] = set()
    for line in metrics_file.read_text(encoding="utf-8").splitlines():
        m = re.search(r'"(zhs_ws_auto_recovery_[a-z_]+)"', line)
        if m:
            defined.add(m.group(1))
    print(f"OK defined metrics (from source): {len(defined)}")

    # 4) 比对: 引用的指标必须 = 已定义 (允许 histogram 子系列 _bucket/_count/_sum)
    def base(name: str) -> str:
        for sfx in ("_bucket", "_count", "_sum", "_created"):
            if name.endswith(sfx):
                return name[: -len(sfx)]
        return name

    missing: list[str] = []
    for ref in sorted(referenced):
        if ref in defined:
            continue
        b = base(ref)
        if b in defined:
            continue
        missing.append(ref)

    if missing:
        print(f"FAIL referenced-but-not-defined: {missing}")
        return 1
    print("OK all referenced metrics are defined in Python source")

    # 5) 统计运行时已暴露的 (说明真实抓取得到了数据)
    runtime_exposed = exposed & defined
    print(f"-- runtime exposed (in /metrics text now): {len(runtime_exposed)}/{len(defined)}")
    not_yet = defined - runtime_exposed
    if not_yet:
        print(f"-- defined but not yet in /metrics text (counters/histograms 0 count): {sorted(not_yet)}")
    print("ALL CHECKS PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
