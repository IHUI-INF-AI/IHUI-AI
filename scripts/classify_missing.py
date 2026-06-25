#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""对每个 Java 缺失端点, 找其在 Python 中的等价端点（去除前缀后完全匹配）"""
import re
import json
from pathlib import Path
from collections import defaultdict

H_DRIVE = Path(r"H:\历史项目存档\code\edu\service\service")
G_DRIVE_API = Path(r"G:\IHUI-AI\server\app\api")

# 读取 missing 清单
missing_data = json.loads(Path(r"G:\IHUI-AI\docs\archive\missing_endpoints.json").read_text(encoding="utf-8"))

# 收集 Python 端点
python_endpoints = []
for py_file in G_DRIVE_API.rglob("*.py"):
    if py_file.name == "__init__.py" or "__pycache__" in str(py_file):
        continue
    try:
        content = py_file.read_text(encoding="utf-8")
    except:
        continue
    rel = str(py_file.relative_to(G_DRIVE_API)).replace("\\", "/")
    for pat in [
        r'@router\.(get|post|put|delete)\s*\(\s*["\']([^"\']+)["\']',
    ]:
        for m in re.finditer(pat, content):
            python_endpoints.append({
                "file": rel, "http": m.group(1).upper(), "path": m.group(2)
            })

# 建立 Python 端点索引
py_norm_index = defaultdict(list)  # normalized path -> list
for ep in python_endpoints:
    p = ep["path"]
    # 标准化: 去除 {x} -> {id}
    p_norm = re.sub(r'\{[^}]+\}', '{id}', p)
    py_norm_index[p_norm].append(ep)

# 对每个缺失端点分类
categories = {
    "alias_only": [],      # 仅需添加 URL 别名 (auth-api/public-api 前缀)
    "truly_missing": [],   # 真正缺失, 需要新增业务逻辑
    "param_mismatch": [],  # 参数命名不同, 需要调整
}

for svc, eps in missing_data["by_service"].items():
    for ep in eps:
        ep_with_svc = {**ep, "service": svc}
        java_http = ep["http"].upper()
        java_norm = ep["norm"]
        # 标准化 Java path (去 {x} -> {id})
        java_norm_p = re.sub(r'\{[^}]+\}', '{id}', java_norm)

        # 1. 完全匹配
        if java_norm_p in py_norm_index:
            for py in py_norm_index[java_norm_p]:
                if py["http"] == java_http:
                    categories["alias_only"].append({**ep_with_svc, "py_match": py, "match_type": "exact"})
                    break
            else:
                continue
            continue

        # 2. 去掉 /auth-api/ /public-api/ 前缀后匹配
        candidates = []
        for prefix in ["/auth-api/", "/public-api/", "auth-api/", "public-api/"]:
            if java_norm_p.startswith(prefix):
                stripped = java_norm_p[len(prefix):]
                if stripped in py_norm_index:
                    for py in py_norm_index[stripped]:
                        if py["http"] == java_http:
                            categories["alias_only"].append({**ep_with_svc, "py_match": py, "match_type": f"strip_{prefix}"})
                            break
                    else:
                        continue
                    break
        else:
            # 3. 末段匹配
            java_last = java_norm_p.split("/")[-1]
            for py_path, py_eps in py_norm_index.items():
                py_last = py_path.split("/")[-1]
                if java_last == py_last and len(java_last) >= 4:
                    for py in py_eps:
                        if py["http"] == java_http:
                            categories["alias_only"].append({**ep_with_svc, "py_match": py, "match_type": "last_seg"})
                            break
                    else:
                        continue
                    break
            else:
                # 4. 真正缺失
                categories["truly_missing"].append(ep_with_svc)

# 统计
print("=" * 80)
print("【488 个缺失端点 详细分类】")
print("=" * 80)
print(f"  仅需 URL 别名 (auth-api/public-api/stripped): {len(categories['alias_only'])}")
print(f"  真正业务缺失 (需要新实现): {len(categories['truly_missing'])}")
print()

# 按服务统计
by_svc_truly = defaultdict(int)
by_svc_alias = defaultdict(int)
for ep in categories["truly_missing"]:
    svc_name = ep.get("service", "unknown")
    by_svc_truly[svc_name] += 1
for ep in categories["alias_only"]:
    svc_name = ep.get("service", "unknown")
    by_svc_alias[svc_name] += 1

print("【按服务统计真正缺失】")
for svc, count in sorted(by_svc_truly.items(), key=lambda x: -x[1]):
    alias_count = by_svc_alias.get(svc, 0)
    print(f"  {svc:45s} 真正缺失 {count:3d}  仅需别名 {alias_count:3d}")

# 真正缺失的端点（按服务）
print()
print("=" * 80)
print("【真正业务缺失的端点 (需要新实现)】")
print("=" * 80)
for svc, count in sorted(by_svc_truly.items(), key=lambda x: -x[1]):
    print(f"\n[{svc}] {count} 个")
    eps_in_svc = [e for e in categories["truly_missing"] if e.get("service") == svc]
    for e in eps_in_svc[:10]:
        print(f"  {e['http']:6s} {e['path']:50s} 控制器: {e['controller']}")
    if len(eps_in_svc) > 10:
        print(f"  ... 还有 {len(eps_in_svc)-10} 个")

# 输出
Path(r"G:\IHUI-AI\docs\archive\endpoint_classification.json").write_text(
    json.dumps({
        "summary": {
            "total_missing": missing_data["total_missing"],
            "alias_only": len(categories["alias_only"]),
            "truly_missing": len(categories["truly_missing"]),
        },
        "alias_only": categories["alias_only"],
        "truly_missing": categories["truly_missing"],
    }, ensure_ascii=False, indent=2), encoding="utf-8"
)
print(f"\n详细分类写入: G:\\IHUI-AI\\docs\\archive\\endpoint_classification.json")
