"""同步可观测性配置到 helm chart (建议 86).

源 -> 目标:
  deploy/monitoring/rules.yml          -> deploy/helm/zhs-platform/prometheus/rules.yml
  deploy/monitoring/alertmanager.yml   -> deploy/helm/zhs-platform/prometheus/alertmanager.yml
  deploy/grafana/dashboards/*.json     -> deploy/helm/zhs-platform/dashboards/*.json

helm 3.14 的 .Files.Get 不允许 .. 路径, 所以文件必须放在 chart 内部.
对应 chart 模板: prometheus-rules-configmap.yaml / alertmanager-configmap.yaml / grafana-dashboards-configmap.yaml.

用法:
    python scripts/ci/sync_observability_config.py             # 同步
    python scripts/ci/sync_observability_config.py --check     # 仅检查, 不修改
    python scripts/ci/sync_observability_config.py --diff      # 检查 + 输出 unified diff
"""

import argparse
import difflib
import shutil
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent
SRC_RULES = REPO / "deploy" / "monitoring" / "rules.yml"
SRC_ALERTMANAGER = REPO / "deploy" / "monitoring" / "alertmanager.yml"
SRC_DASHBOARDS = REPO / "deploy" / "grafana" / "dashboards"
DST_DIR = REPO / "deploy" / "helm" / "zhs-platform" / "prometheus"
DST_DASHBOARDS = REPO / "deploy" / "helm" / "zhs-platform" / "dashboards"

PAIRS = [
    (SRC_RULES, DST_DIR / "rules.yml"),
    (SRC_ALERTMANAGER, DST_DIR / "alertmanager.yml"),
]

EXIT_OK = 0
EXIT_DRIFT = 1
EXIT_SOURCE_MISSING = 2


def _unified_diff(src: Path, dst: Path) -> str:
    """生成 src/dst 的 unified diff 字符串."""
    src_lines = src.read_text(encoding="utf-8").splitlines(keepends=True) if src.exists() else []
    dst_lines = dst.read_text(encoding="utf-8").splitlines(keepends=True) if dst.exists() else []
    diff = difflib.unified_diff(src_lines, dst_lines, fromfile=str(src), tofile=str(dst))
    return "".join(diff)


def sync(check: bool = False, show_diff: bool = False):
    """同步或检查可观测性配置.

    Args:
        check: True=仅检查不修改, False=执行同步
        show_diff: True=检查时输出 unified diff (隐含 check=True)

    Returns:
        (rc, drifts, synced, missing)
        rc: EXIT_OK / EXIT_DRIFT / EXIT_SOURCE_MISSING
        drifts: 不一致信息列表
        synced: 已同步/一致信息列表
        missing: 源文件缺失信息列表
    """
    drifts = []
    synced = []
    missing = []
    rc = EXIT_OK

    # 在函数内部从 REPO 动态构建路径, 以便测试 monkeypatch REPO 生效
    src_dashboards = REPO / "deploy" / "grafana" / "dashboards"
    dst_dashboards = REPO / "deploy" / "helm" / "zhs-platform" / "dashboards"

    for src, dst in PAIRS:
        if not src.exists():
            missing.append(f"源文件不存在: {src}")
            rc = EXIT_SOURCE_MISSING
            continue
        if check:
            if not dst.exists():
                drifts.append(f"目标不存在: {dst}")
                rc = EXIT_DRIFT
                continue
            src_text = src.read_text(encoding="utf-8")
            dst_text = dst.read_text(encoding="utf-8")
            if src_text != dst_text:
                drifts.append(f"DRIFT: {dst.name}")
                if show_diff:
                    drifts.append(_unified_diff(src, dst))
                rc = EXIT_DRIFT
            else:
                synced.append(f"OK: {dst.name} 一致")
        else:
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
            synced.append(f"已同步: {src.name} -> {dst.relative_to(REPO)}")

    # 同步 Grafana dashboard JSON
    if src_dashboards.exists():
        if check:
            if dst_dashboards.exists():
                for src_json in src_dashboards.glob("*.json"):
                    dst_json = dst_dashboards / src_json.name
                    if not dst_json.exists():
                        drifts.append(f"目标不存在: {dst_json}")
                        rc = EXIT_DRIFT
                        continue
                    src_text = src_json.read_text(encoding="utf-8")
                    dst_text = dst_json.read_text(encoding="utf-8")
                    if src_text != dst_text:
                        drifts.append(f"DRIFT: {dst_json.name}")
                        if show_diff:
                            drifts.append(_unified_diff(src_json, dst_json))
                        rc = EXIT_DRIFT
                    else:
                        synced.append(f"OK: {dst_json.name} 一致")
            else:
                drifts.append(f"目标目录不存在: {dst_dashboards}")
                rc = EXIT_DRIFT
        else:
            dst_dashboards.mkdir(parents=True, exist_ok=True)
            for src_json in src_dashboards.glob("*.json"):
                dst_json = dst_dashboards / src_json.name
                shutil.copy2(src_json, dst_json)
                synced.append(f"已同步: {src_json.name} -> {dst_json.relative_to(REPO)}")
    else:
        missing.append(f"dashboard 源目录不存在: {src_dashboards}")

    return rc, drifts, synced, missing


def main() -> int:
    parser = argparse.ArgumentParser(description="同步可观测性配置到 helm chart")
    parser.add_argument("--check", action="store_true", help="仅检查, 不修改文件")
    parser.add_argument("--diff", action="store_true", help="检查 + 输出 unified diff")
    args = parser.parse_args()

    check = args.check or args.diff
    show_diff = args.diff

    rc, drifts, synced, missing = sync(check=check, show_diff=show_diff)

    for msg in synced:
        print(msg)
    for msg in drifts:
        print(msg)
    for msg in missing:
        print(msg)

    if check:
        if rc == EXIT_OK:
            print("\nPASS: 所有配置一致")
        elif rc == EXIT_DRIFT:
            print("\nFAIL: 存在 drift, 请运行 sync 修复")
        elif rc == EXIT_SOURCE_MISSING:
            print("\nFAIL: 源文件缺失")
    else:
        print(f"\n合计: {len(synced)} 个文件已同步")

    return rc


if __name__ == "__main__":
    raise SystemExit(main())
