#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""对单个 Java Controller, 详细展示其端点 vs Python 域中可能的对应端点"""
import re
import json
from pathlib import Path
from collections import defaultdict

H_DRIVE = Path(r"H:\历史项目存档\code\edu\service\service")
G_DRIVE_API = Path(r"G:\IHUI-AI\server\app\api")

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

# 找特定 Controller 的 Java 端点
def extract_java_endpoints(svc, ctrl_name):
    """从指定微服务中提取指定 Controller 的端点"""
    java_path = H_DRIVE / svc / "src" / "main" / "java"
    if not java_path.exists():
        return []
    results = []
    for f in java_path.rglob(f"{ctrl_name}.java"):
        if "controller" not in str(f).lower():
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
        for http, path in all_methods:
            full = (class_prefix + path).rstrip("/") if path else class_prefix.rstrip("/")
            results.append({"http": http, "path": full})
    return results

# 验证: ask-service.AnswerController
test_cases = [
    ("ihui-ai-edu-ask-service", "AnswerController", "v1/ask"),
    ("ihui-ai-edu-message-service", "AnnouncementController", "v1/message"),
    ("ihui-ai-edu-learn-service", "LessonController", "v1/learn"),
    ("ihui-ai-edu-member-service", "MemberController", "v1/member"),
    ("ihui-ai-edu-usercenter-service", "UserController", "v1/system"),
]

for svc, ctrl, py_prefix in test_cases:
    print(f"\n{'='*100}")
    print(f"Java: {svc}.{ctrl}")
    print(f"{'='*100}")

    java_eps = extract_java_endpoints(svc, ctrl)
    py_eps = [e for e in python_endpoints if py_prefix in e["file"]]

    print(f"Java 端点 ({len(java_eps)}):")
    for j in java_eps:
        # 寻找 Python 中路径含 j 关键词的
        norm = j["path"]
        for prefix in ["/auth-api/", "/public-api/"]:
            if norm.startswith(prefix):
                norm = norm[len(prefix):]
        # 找含 norm 段的 Python 端点
        py_matches = [p for p in py_eps if p["http"] == j["http"].upper() and (
            (norm and norm in p["path"]) or
            ("/" + norm.split("/")[-1] in p["path"])
        )]
        flag = "✓" if py_matches else "✗"
        sample = py_matches[0] if py_matches else None
        if sample:
            print(f"  {flag} {j['http']:6s} {j['path']:40s} -> {sample['http']:6s} {sample['path']:40s} <- {sample['file']}")
        else:
            print(f"  {flag} {j['http']:6s} {j['path']:40s} -> (无匹配)")

    print(f"\nPython 域端点 (v1/{py_prefix.split('/')[-1]}*): {len(py_eps)}")
