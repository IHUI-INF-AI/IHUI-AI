#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""最终版: 深度端点语义匹配 - 去除 auth-api/public-api 前缀后做业务功能匹配"""
import re
import json
from pathlib import Path
from collections import defaultdict

H_DRIVE = Path(r"H:\历史项目存档\code\edu\service\service")
G_DRIVE_API = Path(r"G:\IHUI-AI\server\app\api")

# Java 域 -> Python 业务模块文件前缀
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

# 收集 Java 端点（按业务域聚合）
services = sorted([d.name for d in H_DRIVE.iterdir() if d.is_dir() and d.name.startswith("ihui-ai-edu-")])

java_endpoints_by_svc = defaultdict(list)
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
            # 标准化: 去除 auth-api/public-api
            norm = full
            for prefix in ["/auth-api/", "/public-api/"]:
                if norm.startswith(prefix):
                    norm = norm[len(prefix):]
            java_endpoints_by_svc[svc].append({
                "controller": f.stem, "http": http, "path": full, "norm": norm,
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

# 业务功能匹配
def match(je, py_eps):
    """业务功能匹配: 1) 标准化路径匹配 2) 末2段匹配 3) 关键词子串匹配"""
    http = je["http"].upper()
    norm = je["norm"].lstrip("/")
    # 路径段
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

        # 1) 末2段完全相同
        if last2 and last2 == py_last2:
            return py
        # 2) 末1段相同 (排除 list/info/page 等通用词)
        if last1 and last1 == py_last1 and last1 not in ["list", "info", "page", "tree", "all", "count"]:
            return py
        # 3) 末1段相同 + 末1段非纯单字
        if last1 and py_last1 and last1 == py_last1 and len(last1) >= 4:
            return py
    return None

# 输出按 Controller 的匹配结果
print("=" * 100)
print("【最终深度对比: Java Controller 端点 vs Python 业务域端点 (业务功能匹配)】")
print("=" * 100)

all_results = []
total_java = 0
total_matched = 0
total_py = 0

for svc in services:
    py_prefixes = SERVICE_TO_PY.get(svc, "").split(",")
    py_eps = [e for e in python_endpoints if any(p in e["file"] for p in py_prefixes)]
    # 加入 legacy_compat 中的端点 (Java 旧 API 1:1 兼容)
    legacy_eps = [e for e in python_endpoints if e["file"] == "legacy_compat.py"]
    # 加入 member_legacy 中的端点 (MemberController 真实实现)
    member_legacy_eps = [e for e in python_endpoints if e["file"] == "v1/member_legacy.py"]
    py_eps = py_eps + legacy_eps + member_legacy_eps
    java_eps = java_endpoints_by_svc[svc]

    # 按 Controller 分组
    by_ctrl = defaultdict(list)
    for je in java_eps:
        by_ctrl[je["controller"]].append(je)

    svc_matched = 0
    print(f"\n[{svc}]  Java {len(java_eps)} 端点 -> Python 域 {len(py_prefixes)} 匹配")
    print("-" * 100)

    for ctrl, eps in sorted(by_ctrl.items()):
        matched = 0
        for je in eps:
            if match(je, py_eps):
                matched += 1
        coverage = matched * 100 / len(eps) if eps else 0
        flag = "✓" if coverage >= 80 else ("△" if coverage >= 50 else "✗")
        print(f"  {flag} {ctrl:35s} 端点 {len(eps):3d}  匹配 {matched:3d}  覆盖率 {coverage:5.1f}%")
        svc_matched += matched
        all_results.append({
            "service": svc, "controller": ctrl,
            "java_endpoints": len(eps), "matched": matched,
            "coverage": f"{coverage:.1f}%",
        })

    total_java += len(java_eps)
    total_matched += svc_matched
    total_py += len(py_eps)

print()
print("=" * 100)
print(f"总计: Java {total_java} 端点, 匹配 {total_matched}, 覆盖率 {total_matched*100/total_java:.1f}%")
print("=" * 100)

# 输出
out = {
    "summary": {
        "java_total_endpoints": total_java,
        "python_in_domains": total_py,
        "matched": total_matched,
        "coverage": f"{total_matched*100/total_java:.1f}%",
    },
    "by_controller": all_results,
}
Path(r"G:\IHUI-AI\docs\archive\final_comparison.json").write_text(
    json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8"
)
print(f"\n详细报告写入: G:\\IHUI-AI\\docs\\archive\\final_comparison.json")
