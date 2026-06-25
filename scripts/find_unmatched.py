"""找出 8 个未匹配的端点."""
import json
from pathlib import Path

data = json.loads(Path("docs/archive/final_comparison.json").read_text(encoding="utf-8"))
missing = [r for r in data["by_controller"] if r["matched"] < r["java_endpoints"]]
print(f"未完全匹配的 Controller: {len(missing)}")
for r in missing:
    print(f"  {r['service']} / {r['controller']}: {r['java_endpoints']} Java, 匹配 {r['matched']}, 覆盖率 {r['coverage']}")
