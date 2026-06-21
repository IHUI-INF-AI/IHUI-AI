"""验证 4 个 Grafana dashboard JSON 的合法性."""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent  # scripts/ci/.. -> zhs-platform
dashboards = sorted((ROOT / "deploy" / "grafana" / "dashboards").glob("*.json"))

print(f"==> 检查 {len(dashboards)} 个 dashboard")
ok = True
for f in dashboards:
    try:
        d = json.loads(f.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"X {f.name}: JSON 解析失败: {e}")
        ok = False
        continue
    required = ["title", "uid", "panels", "schemaVersion", "tags", "templating", "time"]
    missing = [k for k in required if k not in d]
    if missing:
        print(f"X {f.name}: 缺字段 {missing}")
        ok = False
        continue
    uid = d["uid"]
    if not uid.startswith("zhs-"):
        print(f"X {f.name}: uid 不以 zhs- 开头: {uid}")
        ok = False
        continue
    if not d["panels"]:
        print(f"X {f.name}: panels 为空")
        ok = False
        continue
    for p in d["panels"]:
        for k in ("id", "type", "title", "gridPos", "datasource"):
            if k not in p:
                print(f"X {f.name}: panel id={p.get('id', '?')} 缺字段 {k}")
                ok = False
    tvars = [t["name"] for t in d["templating"]["list"]]
    if "DS_PROMETHEUS" not in tvars:
        print(f"X {f.name}: 缺 DS_PROMETHEUS 变量")
        ok = False
        continue
    print(f"V {f.name}: uid={uid}, panels={len(d['panels'])}, tags={d['tags']}", flush=True)

if not ok:
    sys.exit(1)
print("==> V 全部 dashboard 合法", flush=True)
