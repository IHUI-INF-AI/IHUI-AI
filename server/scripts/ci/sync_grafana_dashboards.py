"""同步 Grafana dashboard JSON 到 helm chart 的 dashboards/ 目录.

helm 3.14 的 .Files.Get 不允许 .. 路径, 所以 JSON 必须放在 chart 内部.
源是 deploy/grafana/dashboards/, 目标是 deploy/helm/zhs-platform/dashboards/.

用法:
    python scripts/ci/sync_grafana_dashboards.py
"""

import shutil
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent
SRC = REPO / "deploy" / "grafana" / "dashboards"
DST = REPO / "deploy" / "helm" / "zhs-platform" / "dashboards"


def main() -> int:
    DST.mkdir(parents=True, exist_ok=True)
    n = 0
    for src in sorted(SRC.glob("*.json")):
        dst = DST / src.name
        shutil.copy2(src, dst)
        n += 1
    print(f"已同步 {n} 个 dashboard 到 {DST}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
