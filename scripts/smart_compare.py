#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""按业务功能关键词对比: Java Controller 端点 vs Python 端点"""
import os
import re
import json
from pathlib import Path
from collections import defaultdict

H_DRIVE = Path(r"H:\历史项目存档\code\edu\service\service")
G_DRIVE_API = Path(r"G:\IHUI-AI\server\app\api")

# ============ 收集 Java Controller 端点 ============
services = sorted([d.name for d in H_DRIVE.iterdir() if d.is_dir() and d.name.startswith("ihui-ai-edu-")])

# Java 22 微服务 -> Python 业务域
SERVICE_TO_PY_DOMAIN = {
    "ihui-ai-edu-ask-service": "v1/ask,v1/edu",
    "ihui-ai-edu-auth-service": "v1/auth,v1/rbac,v1/system,v1/edu",
    "ihui-ai-edu-behavior-service": "v1/behavior,v1/edu",
    "ihui-ai-edu-circle-service": "v1/circle,v1/edu",
    "ihui-ai-edu-content-service": "v1/content,v1/edu",
    "ihui-ai-edu-exam-service": "v1/exam,v1/edu",
    "ihui-ai-edu-gateway-service": "v1/auth,v1/system",
    "ihui-ai-edu-learn-service": "v1/learn,v1/edu",
    "ihui-ai-edu-live-service": "v1/live,v1/edu",
    "ihui-ai-edu-member-service": "v1/member,v1/edu",
    "ihui-ai-edu-message-service": "v1/message,v1/edu",
    "ihui-ai-edu-notification-service": "v1/notification,v1/edu",
    "ihui-ai-edu-order-service": "v1/orders,v1/refund,v1/edu",
    "ihui-ai-edu-oss-service": "v1/upload,v1/edu",
    "ihui-ai-edu-pay-service": "v1/payments,v1/edu",
    "ihui-ai-edu-point-service": "v1/point,v1/edu",
    "ihui-ai-edu-resource-service": "v1/resource,v1/edu",
    "ihui-ai-edu-schedule-service": "v1/schedule,v1/edu",
    "ihui-ai-edu-search-service": "v1/search,v1/edu",
    "ihui-ai-edu-setting-service": "v1/content,v1/edu",
    "ihui-ai-edu-usercenter-service": "v1/user,v1/system,v1/edu",
    "ihui-ai-edu-visit-tracking-service": "v1/visit,v1/edu",
}

# ============ 收集 Java 端点 ============
java_endpoints = []  # [(service, controller, http, path, last_segment)]
for svc in services:
    java_path = H_DRIVE / svc / "src" / "main" / "java"
    if not java_path.exists():
        continue
    for f in java_path.rglob("*.java"):
        if "controller" not in str(f).lower():
            continue
        if f.name in ("BaseController.java", "RestControllerAdvice.java"):
            continue
        content = f.read_text(encoding="utf-8", errors="ignore")
        class_prefix = ""
        for pat in [
            r'@RequestMapping\s*\(\s*value\s*=\s*"([^"]+)"',
            r'@RequestMapping\s*\(\s*"([^"]+)"',
        ]:
            m = re.search(pat, content)
            if m:
                class_prefix = m.group(1)
                break
        all_methods = re.findall(
            r'@(Get|Post|Put|Delete)Mapping[^)]*?["\']([^"\']+)["\']',
            content
        )
        if not all_methods:
            all_methods = re.findall(r'@(Get|Post|Put|Delete)Mapping\s*\(\s*\)', content)
            all_methods = [(m, "") for m in all_methods]
        seen = set()
        for http, path in all_methods:
            full = (class_prefix + path).rstrip("/") if path else class_prefix.rstrip("/")
            key = (http, full)
            if key in seen:
                continue
            seen.add(key)
            # 标准化 + 提取最后段
            norm = full
            for prefix in ["/auth-api/", "/public-api/"]:
                if norm.startswith(prefix):
                    norm = norm[len(prefix):]
            # 提取路径段
            segments = [s for s in re.split(r'[/\{\}]', norm) if s]
            last_seg = segments[-1] if segments else ""
            java_endpoints.append({
                "service": svc, "controller": f.stem, "http": http,
                "path": full, "norm": norm, "last_seg": last_seg,
            })

# ============ 收集 Python 端点 ============
python_endpoints = []
for py_file in G_DRIVE_API.rglob("*.py"):
    if py_file.name == "__init__.py" or "__pycache__" in str(py_file):
        continue
    try:
        content = py_file.read_text(encoding="utf-8")
    except:
        continue
    rel = str(py_file.relative_to(G_DRIVE_API)).replace("\\", "/")
    patterns = [
        r'@router\.(get|post|put|delete)\s*\(\s*["\']([^"\']+)["\']',
        r'@router\.(get|post|put|delete)\s*\(\s*path\s*=\s*["\']([^"\']+)["\']',
    ]
    found = set()
    for pat in patterns:
        for m in re.finditer(pat, content):
            http = m.group(1).upper()
            path = m.group(2)
            key = (http, path)
            if key in found:
                continue
            found.add(key)
            python_endpoints.append({"file": rel, "http": http, "path": path})

# ============ 智能匹配 ============
# 对每个 Java 端点: 在 Python 域中查找"包含 java 路径段"的端点
def match_endpoint(java_ep, py_eps):
    """匹配策略: 1) 标准化路径相等 2) 路径段完全匹配 3) 末段匹配 + 同方法"""
    java_path = java_ep["norm"]
    java_segs = [s for s in re.split(r'[/\{\}]', java_path) if s]
    java_last = java_ep["last_seg"]
    java_http = java_ep["http"]

    for py in py_eps:
        py_path = py["path"]
        py_segs = [s for s in re.split(r'[/\{\}]', py_path) if s]
        py_last = py_segs[-1] if py_segs else ""

        # 1) 末段相同 + 方法相同
        if java_last and py_last and java_last.lower() == py_last.lower() and java_http == py["http"]:
            return py

        # 2) 路径段完全包含 (后2段相同)
        if len(java_segs) >= 2 and len(py_segs) >= 2:
            if java_segs[-2:] == py_segs[-2:] and java_http == py["http"]:
                return py

        # 3) 包含 java 末段关键词 (针对 list, page, info, detail 等通用词)
        # 排除过于通用的词
        if java_last in ["list", "page", "info", "detail", "tree", "all", "count"]:
            if java_last == py_last and java_http == py["http"]:
                return py

    return None

# 对每个服务, 域内匹配
print("=" * 100)
print("【按业务域: Java 端点 vs Python 端点 智能匹配】")
print("=" * 100)

all_results = []
total_java = 0
total_matched = 0
total_py = 0

for svc in services:
    domain_prefixes = SERVICE_TO_PY_DOMAIN.get(svc, "").split(",")
    # Java 端点
    java_in_svc = [e for e in java_endpoints if e["service"] == svc]
    # Python 端点 (在该域内)
    py_in_domain = [e for e in python_endpoints if any(p in e["file"] for p in domain_prefixes)]

    matched_count = 0
    for je in java_in_svc:
        m = match_endpoint(je, py_in_domain)
        if m:
            matched_count += 1

    total_java += len(java_in_svc)
    total_matched += matched_count
    total_py += len(py_in_domain)
    coverage = matched_count * 100 / len(java_in_svc) if java_in_svc else 0
    print(f"  {svc:42s} Java: {len(java_in_svc):3d}  Py: {len(py_in_domain):3d}  匹配: {matched_count:3d}  覆盖率: {coverage:5.1f}%")
    all_results.append({
        "service": svc, "java": len(java_in_svc),
        "py_in_domain": len(py_in_domain), "matched": matched_count,
        "coverage": f"{coverage:.1f}%",
    })

print("-" * 100)
print(f"  {'合计':42s} Java: {total_java:3d}  Py: {total_py:3d}  匹配: {total_matched:3d}  覆盖率: {total_matched*100/total_java:5.1f}%")

# 输出
out = {
    "summary": {
        "java_total_endpoints": total_java,
        "python_in_domains": total_py,
        "matched": total_matched,
        "coverage": f"{total_matched*100/total_java:.1f}%",
    },
    "by_service": all_results,
}
Path(r"G:\IHUI-AI\docs\archive\smart_comparison.json").write_text(
    json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8"
)
print(f"\n详细报告写入: G:\\IHUI-AI\\docs\\archive\\smart_comparison.json")
