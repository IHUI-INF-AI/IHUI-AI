#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""深度比对脚本: 提取 22 个微服务的 Java Controller 清单 + Python 路由映射"""
import os
import re
import json
from pathlib import Path
from collections import defaultdict

H_DRIVE = Path(r"H:\历史项目存档\code\edu\service\service")
G_DRIVE = Path(r"G:\IHUI-AI\server\app\api")

# 提取 22 个微服务
services = sorted([d.name for d in H_DRIVE.iterdir() if d.is_dir() and d.name.startswith("ihui-ai-edu-")])

print("=" * 80)
print(f"22 个微服务清单:")
for svc in services:
    print(f"  - {svc}")
print()

# 收集所有 Controller 信息
controllers = []
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

        # 提取 RequestMapping 路径
        path = ""
        for pat in [
            r'@RequestMapping\s*\(\s*value\s*=\s*"([^"]+)"',
            r'@RequestMapping\s*\(\s*"([^"]+)"',
        ]:
            m = re.search(pat, content)
            if m:
                path = m.group(1)
                break

        # 提取 Api tags
        api_tag = ""
        m = re.search(r'@Api\(tags\s*=\s*"([^"]+)"', content)
        if m:
            api_tag = m.group(1)

        # 统计 HTTP 方法
        get_count = len(re.findall(r'@GetMapping', content))
        post_count = len(re.findall(r'@PostMapping', content))
        put_count = len(re.findall(r'@PutMapping', content))
        del_count = len(re.findall(r'@DeleteMapping', content))
        total = get_count + post_count + put_count + del_count

        # 提取 FQN (相对路径)
        rel = f.relative_to(java_path)
        fqn = str(rel).replace("\\", ".").replace(".java", "")

        controllers.append({
            "service": svc,
            "controller": f.stem,
            "fqn": fqn,
            "path": path,
            "api_tag": api_tag,
            "get": get_count,
            "post": post_count,
            "put": put_count,
            "delete": del_count,
            "total": total,
        })

# 按服务分组打印
print("=" * 80)
print("22 个微服务 Controller 端点清单")
print("=" * 80)
by_svc = defaultdict(list)
for c in controllers:
    by_svc[c["service"]].append(c)

for svc in services:
    if svc not in by_svc:
        continue
    ctrls = by_svc[svc]
    svc_total = sum(c["total"] for c in ctrls)
    print(f"\n[{svc}]  共 {len(ctrls)} 个 Controller, {svc_total} 个端点")
    print("-" * 80)
    for c in ctrls:
        print(f"  {c['controller']:35s} | {c['path']:35s} | GET:{c['get']} POST:{c['post']} PUT:{c['put']} DEL:{c['delete']} 合计:{c['total']}")

# 总计
total_ctrl = len(controllers)
total_endpoints = sum(c["total"] for c in controllers)
print()
print("=" * 80)
print(f"总业务 Controller: {total_ctrl}")
print(f"总 API 端点: {total_endpoints}")
print("=" * 80)

# 输出 JSON 供后续分析
out_path = Path(r"G:\IHUI-AI\docs\archive\java_controllers_inventory.json")
out_path.write_text(json.dumps(controllers, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"\n详细清单已写入: {out_path}")
