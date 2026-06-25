#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""严格按业务域匹配: Java 端点 -> Python 端点 (同业务域内)"""
import re
import json
from pathlib import Path
from collections import defaultdict

H_DRIVE = Path(r"H:\历史项目存档\code\edu\service\service")
G_DRIVE_API = Path(r"G:\IHUI-AI\server\app\api")

# Java 服务 -> Python 业务域 (限定范围)
SERVICE_TO_PY = {
    "ihui-ai-edu-ask-service": ["v1/ask"],
    "ihui-ai-edu-auth-service": ["v1/auth", "v1/rbac", "v1/system"],
    "ihui-ai-edu-behavior-service": ["v1/behavior"],
    "ihui-ai-edu-circle-service": ["v1/circle"],
    "ihui-ai-edu-content-service": ["v1/content"],
    "ihui-ai-edu-exam-service": ["v1/exam"],
    "ihui-ai-edu-gateway-service": ["v1/auth"],
    "ihui-ai-edu-learn-service": ["v1/learn"],
    "ihui-ai-edu-live-service": ["v1/live"],
    "ihui-ai-edu-member-service": ["v1/member"],
    "ihui-ai-edu-message-service": ["v1/message"],
    "ihui-ai-edu-notification-service": ["v1/notification"],
    "ihui-ai-edu-order-service": ["v1/orders", "v1/refund"],
    "ihui-ai-edu-oss-service": ["v1/upload"],
    "ihui-ai-edu-pay-service": ["v1/payments"],
    "ihui-ai-edu-point-service": ["v1/point"],
    "ihui-ai-edu-resource-service": ["v1/resource"],
    "ihui-ai-edu-schedule-service": ["v1/schedule"],
    "ihui-ai-edu-search-service": ["v1/search"],
    "ihui-ai-edu-setting-service": ["v1/content"],
    "ihui-ai-edu-usercenter-service": ["v1/system", "v1/user"],
    "ihui-ai-edu-visit-tracking-service": ["v1/visit"],
}

# 读取已生成的 missing 清单
missing_data = json.loads(
    Path(r"G:\IHUI-AI\docs\archive\missing_endpoints.json").read_text(encoding="utf-8")
)

# 收集 Python 端点 (按域分组)
python_endpoints = []  # 全量
python_by_domain = defaultdict(list)  # domain -> list
for py_file in G_DRIVE_API.rglob("*.py"):
    if py_file.name == "__init__.py" or "__pycache__" in str(py_file):
        continue
    try:
        content = py_file.read_text(encoding="utf-8")
    except:
        continue
    rel = str(py_file.relative_to(G_DRIVE_API)).replace("\\", "/")
    for pat in [r'@router\.(get|post|put|delete)\s*\(\s*["\']([^"\']+)["\']']:
        for m in re.finditer(pat, content):
            ep = {
                "file": rel,
                "http": m.group(1).upper(),
                "path": m.group(2),
            }
            python_endpoints.append(ep)
            # 按文件路径分配到对应域
            for domain, files_prefix in SERVICE_TO_PY.items():
                if any(rel.startswith(p) for p in files_prefix):
                    python_by_domain[files_prefix[0]].append(ep)
                    break

# 严格按域匹配
def match_in_domain(java_ep, py_eps):
    java_http = java_ep["http"].upper()
    java_norm = java_ep["norm"].lstrip("/")
    java_norm_p = re.sub(r'\{[^}]+\}', '{id}', java_norm)
    segs = [s for s in re.split(r'[/\{\}]', java_norm_p) if s]
    last1 = segs[-1] if segs else ""
    last2 = "/".join(segs[-2:]) if len(segs) >= 2 else last1

    for py in py_eps:
        if py["http"] != java_http:
            continue
        py_path = py["path"].lstrip("/")
        py_norm_p = re.sub(r'\{[^}]+\}', '{id}', py_path)
        if java_norm_p == py_norm_p:
            return py
        # 末2段匹配
        py_segs = [s for s in re.split(r'[/\{\}]', py_norm_p) if s]
        py_last1 = py_segs[-1] if py_segs else ""
        py_last2 = "/".join(py_segs[-2:]) if len(py_segs) >= 2 else py_last1
        if last2 and last2 == py_last2:
            return py
        if last1 and last1 == py_last1 and last1 not in ["list", "info", "page", "tree", "all", "count"]:
            return py
    return None

# 重新分类
alias_only = []
truly_missing = []

for svc, eps in missing_data["by_service"].items():
    py_prefixes = SERVICE_TO_PY.get(svc, [])
    # 合并该服务所有域的 Python 端点
    py_in_domain = []
    for p in py_prefixes:
        py_in_domain.extend(python_by_domain.get(p, []))

    for ep in eps:
        match = match_in_domain(ep, py_in_domain)
        if match:
            alias_only.append({**ep, "service": svc, "py_match": match, "match_type": "domain_strict"})
        else:
            truly_missing.append({**ep, "service": svc})

print(f"严格按业务域匹配:")
print(f"  仅需 URL 别名: {len(alias_only)}")
print(f"  真正业务缺失: {len(truly_missing)}")
print()

# 按服务统计
by_svc_truly = defaultdict(int)
by_svc_alias = defaultdict(int)
for ep in truly_missing:
    by_svc_truly[ep["service"]] += 1
for ep in alias_only:
    by_svc_alias[ep["service"]] += 1

print("【按服务统计】")
for svc in sorted(set(list(by_svc_truly.keys()) + list(by_svc_alias.keys()))):
    print(f"  {svc:45s} 真正缺失 {by_svc_truly[svc]:3d}  仅需别名 {by_svc_alias[svc]:3d}")

# 输出分类
Path(r"G:\IHUI-AI\docs\archive\endpoint_classification_v2.json").write_text(
    json.dumps({
        "summary": {
            "total_missing": missing_data["total_missing"],
            "alias_only": len(alias_only),
            "truly_missing": len(truly_missing),
        },
        "alias_only": alias_only,
        "truly_missing": truly_missing,
    }, ensure_ascii=False, indent=2), encoding="utf-8"
)
print(f"\n分类写入: G:\\IHUI-AI\\docs\\archive\\endpoint_classification_v2.json")
