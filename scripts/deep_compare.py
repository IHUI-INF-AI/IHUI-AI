#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""深度逐 Controller 比对: Java 端点 vs Python 端点"""
import os
import re
import json
from pathlib import Path
from collections import defaultdict

H_DRIVE = Path(r"H:\历史项目存档\code\edu\service\service")
G_DRIVE_API = Path(r"G:\IHUI-AI\server\app\api")

# ============ 收集 Java Controller 端点 ============
services = sorted([d.name for d in H_DRIVE.iterdir() if d.is_dir() and d.name.startswith("ihui-ai-edu-")])

java_endpoints = []  # 全部端点
java_by_controller = defaultdict(list)

# 端点路径前缀映射 (Java 业务前缀 -> Python 路由模块)
SERVICE_TO_PYTHON_PREFIX = {
    "ihui-ai-edu-ask-service": ["/ask", "edu_ask"],
    "ihui-ai-edu-auth-service": ["/auth", "/system", "edu_auth"],
    "ihui-ai-edu-behavior-service": ["/behavior", "edu_behavior"],
    "ihui-ai-edu-circle-service": ["/circle", "edu_circle"],
    "ihui-ai-edu-content-service": ["/content", "edu_content"],
    "ihui-ai-edu-exam-service": ["/exam", "edu_exam"],
    "ihui-ai-edu-gateway-service": ["/", "(gateway)"],
    "ihui-ai-edu-learn-service": ["/learn", "edu_learn"],
    "ihui-ai-edu-live-service": ["/live", "edu_live"],
    "ihui-ai-edu-member-service": ["/member", "edu_member"],
    "ihui-ai-edu-message-service": ["/message", "edu_message"],
    "ihui-ai-edu-notification-service": ["/notification", "edu_notification"],
    "ihui-ai-edu-order-service": ["/order", "edu_order"],
    "ihui-ai-edu-oss-service": ["/oss", "/upload", "edu_oss"],
    "ihui-ai-edu-pay-service": ["/pay", "/payments", "edu_pay"],
    "ihui-ai-edu-point-service": ["/point", "edu_point"],
    "ihui-ai-edu-resource-service": ["/resource", "edu_resource"],
    "ihui-ai-edu-schedule-service": ["/schedule", "edu_schedule"],
    "ihui-ai-edu-search-service": ["/search", "edu_search"],
    "ihui-ai-edu-setting-service": ["/setting", "edu_setting"],
    "ihui-ai-edu-usercenter-service": ["/user", "/system", "edu_user"],
    "ihui-ai-edu-visit-tracking-service": ["/visit", "edu_visit"],
}

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

        # 提取类级 @RequestMapping
        class_prefix = ""
        for pat in [
            r'@RequestMapping\s*\(\s*value\s*=\s*"([^"]+)"',
            r'@RequestMapping\s*\(\s*"([^"]+)"',
        ]:
            m = re.search(pat, content)
            if m:
                class_prefix = m.group(1)
                break

        # 提取所有方法级 @xxxMapping
        method_pattern = r'@(Get|Post|Put|Delete)Mapping\s*(?:\(\s*value\s*=\s*)?(?:"([^"]*)")?\s*(?:\)|,\s*"(name|value)\s*=\s*"([^"]+)")?'
        # 简化: 提取所有 @XxxMapping 块
        all_methods = re.findall(
            r'@(Get|Post|Put|Delete)Mapping[^)]*?["\']([^"\']+)["\']',
            content
        )
        # 如果类前缀为空且没有方法级路径, 也提取无参 @XxxMapping
        if not all_methods:
            all_methods = re.findall(r'@(Get|Post|Put|Delete)Mapping\s*\(\s*\)', content)
            all_methods = [(m, "") for m in all_methods]

        for http_method, method_path in all_methods:
            full_path = (class_prefix + method_path) if method_path else class_prefix
            full_path = full_path.rstrip("/")
            if not full_path:
                full_path = "/"
            java_endpoints.append({
                "service": svc,
                "controller": f.stem,
                "http": http_method,
                "path": full_path,
                "python_module": SERVICE_TO_PYTHON_PREFIX.get(svc, ["?"])[0],
            })
            java_by_controller[(svc, f.stem)].append((http_method, full_path))

# ============ 收集 Python 路由端点 ============
python_endpoints = []
for py_file in G_DRIVE_API.rglob("*.py"):
    if py_file.name == "__init__.py" or "__pycache__" in str(py_file):
        continue
    try:
        content = py_file.read_text(encoding="utf-8")
    except:
        continue
    # 提取 @router.get/post/put/delete 路径
    # 匹配 @router.X("path", ...) 或 @router.X(path="...", ...)
    patterns = [
        r'@router\.(get|post|put|delete)\s*\(\s*["\']([^"\']+)["\']',
        r'@router\.(get|post|put|delete)\s*\(\s*path\s*=\s*["\']([^"\']+)["\']',
        r'@router\.(get|post|put|delete)\s*\(\s*"([^"]+)"\s*,\s*',
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
            python_endpoints.append({
                "file": str(py_file.relative_to(G_DRIVE_API)).replace("\\", "/"),
                "http": http,
                "path": path,
            })

print(f"Java 端点总数: {len(java_endpoints)}")
print(f"Python 端点总数: {len(python_endpoints)}")

# ============ 比对 ============
# 将 Python 端点索引化
py_path_index = defaultdict(list)  # path -> list of (http, file)
for ep in python_endpoints:
    py_path_index[ep["path"]].append((ep["http"], ep["file"]))

# 对每个 Java 端点, 检查 Python 是否有等价端点
matched = 0
unmatched = []
for jep in java_endpoints:
    java_path = jep["path"]
    http = jep["http"]
    # 尝试不同匹配
    candidates = [java_path, java_path + "/", java_path.rstrip("/")]
    # 也尝试参数化: {id} -> {x}
    candidates.append(re.sub(r'/\d+', '/{id}', java_path))
    candidates.append(re.sub(r'/\d+', '/{x}', java_path))

    found_match = False
    for c in candidates:
        for (py_http, py_file) in py_path_index.get(c, []):
            if py_http == http:
                found_match = True
                matched += 1
                break
        if found_match:
            break

    if not found_match:
        unmatched.append(jep)

print(f"匹配成功: {matched} / {len(java_endpoints)}")
print(f"未匹配: {len(unmatched)}")
print()
print("=" * 80)
print("未匹配的 Java 端点（按服务聚合）:")
print("=" * 80)
unmatched_by_svc = defaultdict(list)
for u in unmatched:
    unmatched_by_svc[u["service"]].append(u)
for svc, eps in sorted(unmatched_by_svc.items()):
    print(f"\n[{svc}] 未匹配 {len(eps)} 个端点")
    for u in eps[:5]:  # 只显示前 5 个
        print(f"  {u['http']:6s} {u['path']:50s} <- {u['controller']}")
    if len(eps) > 5:
        print(f"  ... 还有 {len(eps)-5} 个")

# 输出详细 JSON
out = {
    "java_total_endpoints": len(java_endpoints),
    "python_total_endpoints": len(python_endpoints),
    "matched": matched,
    "unmatched": len(unmatched),
    "coverage": f"{matched*100/len(java_endpoints):.1f}%" if java_endpoints else "N/A",
    "unmatched_details": [
        {
            "service": u["service"],
            "controller": u["controller"],
            "http": u["http"],
            "path": u["path"],
            "python_module_hint": u["python_module"],
        } for u in unmatched
    ]
}
Path(r"G:\IHUI-AI\docs\archive\deep_comparison_report.json").write_text(
    json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8"
)
print(f"\n详细报告写入: G:\\IHUI-AI\\docs\\archive\\deep_comparison_report.json")
