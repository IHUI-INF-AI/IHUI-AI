#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成 488 个缺失端点的完整清单, 含 Java 源文件路径, 供后续补齐使用"""
import re
import json
from pathlib import Path
from collections import defaultdict

H_DRIVE = Path(r"H:\历史项目存档\code\edu\service\service")
G_DRIVE_API = Path(r"G:\IHUI-AI\server\app\api")

SERVICE_TO_PY = {
    "ihui-ai-edu-ask-service": "v1/ask",
    "ihui-ai-edu-auth-service": "v1/auth,v1/rbac",
    "ihui-ai-edu-behavior-service": "v1/behavior",
    "ihui-ai-edu-circle-service": "v1/circle",
    "ihui-ai-edu-content-service": "v1/content",
    "ihui-ai-edu-exam-service": "v1/exam",
    "ihui-ai-edu-gateway-service": "v1/auth",
    "ihui-ai-edu-learn-service": "v1/learn",
    "ihui-ai-edu-live-service": "v1/live",
    "ihui-ai-edu-member-service": "v1/member",
    "ihui-ai-edu-message-service": "v1/message",
    "ihui-ai-edu-notification-service": "v1/notification",
    "ihui-ai-edu-order-service": "v1/orders,v1/refund",
    "ihui-ai-edu-oss-service": "v1/upload",
    "ihui-ai-edu-pay-service": "v1/payments",
    "ihui-ai-edu-point-service": "v1/point",
    "ihui-ai-edu-resource-service": "v1/resource",
    "ihui-ai-edu-schedule-service": "v1/schedule",
    "ihui-ai-edu-search-service": "v1/search",
    "ihui-ai-edu-setting-service": "v1/content",
    "ihui-ai-edu-usercenter-service": "v1/system,v1/user",
    "ihui-ai-edu-visit-tracking-service": "v1/visit",
}

services = sorted([d.name for d in H_DRIVE.iterdir() if d.is_dir() and d.name.startswith("ihui-ai-edu-")])

# 收集 Java 端点
java_endpoints = []
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
            norm = full
            for prefix in ["/auth-api/", "/public-api/"]:
                if norm.startswith(prefix):
                    norm = norm[len(prefix):]
            java_endpoints.append({
                "service": svc, "controller": f.stem, "http": http,
                "path": full, "norm": norm, "java_file": str(f.relative_to(H_DRIVE)),
            })

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

def match(je, py_eps):
    http = je["http"].upper()
    norm = je["norm"].lstrip("/")
    segs = [s for s in re.split(r'[/\{\}]', norm) if s]
    last1 = segs[-1] if segs else ""
    last2 = "/".join(segs[-2:]) if len(segs) >= 2 else last1
    for py in py_eps:
        if py["http"] != http:
            continue
        py_path = py["path"].lstrip("/")
        py_segs = [s for s in re.split(r'[/\{\}]', py_path) if s]
        py_last1 = py_segs[-1] if py_segs else ""
        py_last2 = "/".join(py_segs[-2:]) if len(py_segs) >= 2 else py_last1
        if last2 and last2 == py_last2:
            return py
        if last1 and last1 == py_last1 and last1 not in ["list", "info", "page", "tree", "all", "count"]:
            return py
        if last1 and py_last1 and last1 == py_last1 and len(last1) >= 4:
            return py
    return None

# 生成缺失清单
missing = []
for je in java_endpoints:
    py_prefixes = SERVICE_TO_PY.get(je["service"], "").split(",")
    py_eps = [e for e in python_endpoints if any(p in e["file"] for p in py_prefixes)]
    if not match(je, py_eps):
        missing.append(je)

# 按服务分组
by_svc = defaultdict(list)
for m in missing:
    by_svc[m["service"]].append(m)

print(f"总共缺失端点: {len(missing)}")
print()
for svc in services:
    if svc in by_svc:
        eps = by_svc[svc]
        print(f"[{svc}] 缺失 {len(eps)} 端点")

# 输出 JSON 供后续使用
out = {
    "total_missing": len(missing),
    "by_service": {
        svc: [
            {
                "controller": e["controller"],
                "http": e["http"],
                "path": e["path"],
                "norm": e["norm"],
                "java_file": e["java_file"],
            } for e in eps
        ] for svc, eps in by_svc.items()
    }
}
Path(r"G:\IHUI-AI\docs\archive\missing_endpoints.json").write_text(
    json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8"
)
print(f"\n详细清单写入: G:\\IHUI-AI\\docs\\archive\\missing_endpoints.json")
