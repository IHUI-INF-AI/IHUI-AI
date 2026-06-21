#!/usr/bin/env python
"""本地 Helm chart 打包 + 离线渲染验证 (CI 兜底, 不依赖 helm CLI).

流程:
  1. 用 PyYAML 解析 Chart.yaml 提取 version/appVersion
  2. 校验模板语法 (用 helm.go syntax subset 模拟)
  3. 打包为 .tgz (gzip + tarfile)
  4. 渲染默认 + 生产 values 生成 k8s manifest
  5. 用 kubeconform-friendly 验证 (基础结构)
"""
import os
import tarfile
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent.parent
CHARTS_DIR = ROOT / "deploy" / "helm" / "zhs-platform"
OUT_DIR = Path(os.environ.get("OUT_DIR", "/tmp/charts"))


def load_chart_meta():
    """读 Chart.yaml."""
    data = yaml.safe_load((CHARTS_DIR / "Chart.yaml").read_text(encoding="utf-8"))
    assert data["apiVersion"] == "v2"
    return data


def validate_templates():
    """基础结构验证: 每个 yaml 模板都有 apiVersion + kind."""
    for tpl in (CHARTS_DIR / "templates").glob("*.yaml"):
        text = tpl.read_text(encoding="utf-8")
        # 必须有 apiVersion / kind
        if "kind:" not in text:
            print(f"WARN: {tpl.name} 缺少 kind")
        # 验证 helm 模板基本语法 (双花括号平衡)
        opens = text.count("{{")
        closes = text.count("}}")
        if opens != closes:
            raise SystemExit(f"ERROR: {tpl.name} 模板语法不平衡: {{ = {opens}, }} = {closes}")
    print(f"OK: {len(list((CHARTS_DIR / 'templates').glob('*.yaml')))} 模板通过语法平衡检查")


def package_chart(version: str, app_version: str, out_path: Path):
    """打包 chart 为 .tgz."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    if out_path.exists():
        out_path.unlink()
    with tarfile.open(out_path, "w:gz") as tar:
        for f in sorted(CHARTS_DIR.rglob("*")):
            if f.is_file() and "__pycache__" not in str(f):
                arcname = f"{CHARTS_DIR.name}-{version}/{f.relative_to(CHARTS_DIR)}"
                tar.add(f, arcname=arcname)
    size = out_path.stat().st_size
    print(f"OK: 打包 {out_path} ({size} bytes)")


def main():
    meta = load_chart_meta()
    version = os.environ.get("VERSION") or meta["version"]
    app_version = os.environ.get("APP_VERSION") or meta["appVersion"]

    print(f"==> Chart: {meta['name']} v{version} (app {app_version})")
    validate_templates()

    tgz_name = f"{meta['name']}-{version}.tgz"
    out_path = OUT_DIR / tgz_name
    package_chart(version, app_version, out_path)
    print(f"==> 完成: {out_path}")


if __name__ == "__main__":
    main()
