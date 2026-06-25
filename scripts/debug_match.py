#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""调试: 测试匹配函数为什么失败"""
import re
from pathlib import Path

# 几个测试样本
java_endpoints = [
    {"service": "ihui-ai-edu-ask-service", "controller": "AnswerController", "http": "Post", "path": "/auth-api/answer", "norm": "answer", "last_seg": "answer"},
    {"service": "ihui-ai-edu-message-service", "controller": "AnnouncementController", "http": "Post", "path": "/announcement", "norm": "/announcement", "last_seg": "announcement"},
    {"service": "ihui-ai-edu-learn-service", "controller": "LessonController", "http": "Get", "path": "/lesson/list", "norm": "/lesson/list", "last_seg": "list"},
    {"service": "ihui-ai-edu-member-service", "controller": "MemberController", "http": "Get", "path": "/list", "norm": "/list", "last_seg": "list"},
    {"service": "ihui-ai-edu-usercenter-service", "controller": "UserController", "http": "Get", "path": "/user/info", "norm": "/user/info", "last_seg": "info"},
]

# 检查 Python 端点
G_DRIVE_API = Path(r"G:\IHUI-AI\server\app\api")
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
    ]
    for pat in patterns:
        for m in re.finditer(pat, content):
            http = m.group(1).upper()
            path = m.group(2)
            python_endpoints.append({"file": rel, "http": http, "path": path})

# 找几个有针对性的 Python 端点
print("Python 端点样例（前 30）:")
for p in python_endpoints[:30]:
    print(f"  {p['http']:6s} {p['path']:50s} <- {p['file']}")

# 搜索特定的端点
keywords = ["answer", "announcement", "lesson", "list", "info", "user"]
for kw in keywords:
    matches = [p for p in python_endpoints if kw in p["path"].lower()]
    print(f"\n含 '{kw}' 的 Python 端点: {len(matches)} 个")
    for m in matches[:5]:
        print(f"  {m['http']:6s} {m['path']}")
