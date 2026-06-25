#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成 488 个 stub routes - URL 1:1 兼容 Java 旧 API, 业务实现标记 TODO"""
import re
import json
from pathlib import Path
from collections import defaultdict

MISSING = json.loads(
    Path(r"G:\IHUI-AI\docs\archive\endpoint_classification_v2.json").read_text(encoding="utf-8")
)
all_missing = MISSING["alias_only"] + MISSING["truly_missing"]

# 收集现有 Python handler (用于 alias 路由)
G_DRIVE_API = Path(r"G:\IHUI-AI\server\app\api")
py_handler_cache = {}

def find_py_handler(py_file, http, path):
    if py_file in py_handler_cache and f"{http}:{path}" in py_handler_cache[py_file]:
        return py_handler_cache[py_file][f"{http}:{path}"]
    target_file = G_DRIVE_API / py_file
    if not target_file.exists():
        return None
    content = target_file.read_text(encoding="utf-8")
    if py_file not in py_handler_cache:
        py_handler_cache[py_file] = {}
    py_norm = re.sub(r'\{[^}]+\}', '{id}', path)
    id_pattern = r'\{[^}]+\}'
    pat_str = '@router\\.' + http.lower() + r'\s*\(\s*["\']' + re.escape(py_norm).replace(r"\{id\}", id_pattern) + r'["\']'
    pat = re.compile(pat_str)
    for m in pat.finditer(content):
        idx = m.end()
        rest = content[idx:]
        func_match = re.search(r'async def (\w+)\(', rest)
        if func_match:
            handler = func_match.group(1)
            py_handler_cache[py_file][f"{http}:{path}"] = handler
            return handler
    return None

# 按 Java 服务 -> 业务域文件映射
SERVICE_TO_PY_PREFIX = {
    "ihui-ai-edu-ask-service": "ask",
    "ihui-ai-edu-auth-service": "auth",
    "ihui-ai-edu-behavior-service": "behavior",
    "ihui-ai-edu-circle-service": "circle",
    "ihui-ai-edu-content-service": "content",
    "ihui-ai-edu-exam-service": "exam",
    "ihui-ai-edu-gateway-service": "auth",
    "ihui-ai-edu-learn-service": "learn",
    "ihui-ai-edu-live-service": "live",
    "ihui-ai-edu-member-service": "member",
    "ihui-ai-edu-message-service": "message",
    "ihui-ai-edu-notification-service": "notification",
    "ihui-ai-edu-order-service": "orders",
    "ihui-ai-edu-oss-service": "upload",
    "ihui-ai-edu-pay-service": "payments",
    "ihui-ai-edu-point-service": "point",
    "ihui-ai-edu-resource-service": "resource",
    "ihui-ai-edu-schedule-service": "schedule",
    "ihui-ai-edu-search-service": "search",
    "ihui-ai-edu-setting-service": "content",
    "ihui-ai-edu-usercenter-service": "system",
    "ihui-ai-edu-visit-tracking-service": "visit",
}

# 生成 legacy_compat.py
output = '''"""
Java 历史项目 API 兼容层 (Legacy Compatibility Layer) - STUB
============================================================

为 Java 旧 API 路径提供 URL 1:1 兼容, 内部实现状态:
- alias 路由: 调用现有 Python handler (URL 重写, 0 业务代码重复)
- stub 路由: 抛 NotImplementedError, 业务实现标记为 TODO

生成时间: 2026-06-26
总路由数: {total}
  - alias 路由 (复用现有): {alias_count}
  - stub 路由 (待实现): {stub_count}
目标 Java 服务: 22 个

后续迭代计划:
- 按 Controller 优先级分批实现 stub 路由的真实业务逻辑
- 每个 Controller 实现完成后, 移除其 stub, 改为真实 handler
"""
from __future__ import annotations

from fastapi import APIRouter, Request, HTTPException
from loguru import logger

router = APIRouter(prefix="", tags=["legacy-compat"], include_in_schema=False)


def _not_implemented(java_path: str, controller: str):
    """Stub handler - 标记待实现."""
    logger.warning(f"[legacy-stub] Not implemented: {{java_path}} ({{controller}})")
    raise HTTPException(
        status_code=501,
        detail=f"Legacy endpoint not yet implemented: {{java_path}} ({{controller}})"
    )


# 导入目标 handler (alias 路由使用)
{imports}


# === 路由定义 (488 个) ===
{routes}
'''

# 收集 import
imports_set = set()
alias_count = 0
stub_count = 0
routes_code = []

for ep in all_missing:
    java_path = ep["path"]
    java_http = ep["http"]
    method = java_http.lower()
    service = ep["service"]
    controller = ep["controller"]
    py_match = ep.get("py_match")

    # 标准化 path
    py_path = java_path
    py_path = re.sub(r'(/auth-api/)+', '/auth-api/', py_path)
    py_path = re.sub(r'(/public-api/)+', '/public-api/', py_path)
    py_path = re.sub(r'/+', '/', py_path)
    if not py_path.startswith('/'):
        py_path = '/' + py_path
    py_path = py_path.rstrip("/") or "/"

    # 检查是否为 alias (有 py_match 且能找到 handler)
    handler = None
    if py_match:
        handler = find_py_handler(py_match["file"], py_match["http"], py_match["path"])

    if handler:
        # alias 路由
        alias_count += 1
        f_mod = py_match["file"].replace(".py", "").replace("/", ".")
        imports_set.add(f"from app.api.{f_mod} import {handler}")
        # 提取 path 参数
        path_params = re.findall(r'\{(\w+)\}', py_path)
        safe = re.sub(r'[^a-zA-Z0-9_]', '_', py_path).strip("_")[:40]
        unique_id = abs(hash(f"alias{method}{py_path}")) % 100000
        routes_code.append(f'@router.{method}("{py_path}", include_in_schema=False)')
        routes_code.append(f'async def legacy_alias_{method}_{safe}_{unique_id}(request: Request):')
        routes_code.append(f'    """Legacy alias: {java_path} -> {handler}"""')
        args_str = ""
        if path_params:
            args_list = [f'{p}=request.path_params.get("{p}")' for p in path_params]
            args_str = ", " + ", ".join(args_list)
        routes_code.append(f'    return await {handler}(request=request{args_str})')
        routes_code.append('')
    else:
        # stub 路由
        stub_count += 1
        safe = re.sub(r'[^a-zA-Z0-9_]', '_', py_path).strip("_")[:40]
        unique_id = abs(hash(f"stub{method}{py_path}")) % 100000
        routes_code.append(f'@router.{method}("{py_path}", include_in_schema=False)')
        routes_code.append(f'async def legacy_stub_{method}_{safe}_{unique_id}(request: Request):')
        routes_code.append(f'    """Legacy stub: {java_path} ({controller})"""')
        routes_code.append(f'    return _not_implemented("{java_path}", "{controller}")')
        routes_code.append('')

output_code = output.format(
    total=alias_count + stub_count,
    alias_count=alias_count,
    stub_count=stub_count,
    imports='\n'.join(sorted(imports_set))
)

out_path = Path(r"G:\IHUI-AI\server\app\api\legacy_compat.py")
out_path.write_text(output_code, encoding="utf-8")
print(f"生成: {out_path}")
print(f"总路由: {alias_count + stub_count}")
print(f"  - alias (复用现有): {alias_count}")
print(f"  - stub (待实现): {stub_count}")
print(f"代码行数: {len(output_code.splitlines())}")
