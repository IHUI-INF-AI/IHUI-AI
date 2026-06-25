#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成 legacy_compat.py - 严格业务域匹配的 alias 路由"""
import re
import json
from pathlib import Path
from collections import defaultdict

CLASSIFICATION = json.loads(
    Path(r"G:\IHUI-AI\docs\archive\endpoint_classification_v2.json").read_text(encoding="utf-8")
)
alias_only = CLASSIFICATION["alias_only"]
G_DRIVE_API = Path(r"G:\IHUI-AI\server\app\api")

# 缓存 Python endpoint -> handler function
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

# 按 Python 目标文件分组
by_target = defaultdict(list)
unresolved = []
for ep in alias_only:
    py_match = ep["py_match"]
    handler = find_py_handler(py_match["file"], py_match["http"], py_match["path"])
    if not handler:
        unresolved.append(ep)
        continue
    by_target[py_match["file"]].append({
        "java_http": ep["http"],
        "java_path": ep["path"],
        "java_norm": ep["norm"],
        "py_path": py_match["path"],
        "py_http": py_match["http"],
        "handler": handler,
    })

print(f"alias 总数: {len(alias_only)}")
print(f"已解析 handler: {sum(len(v) for v in by_target.values())}")
print(f"未解析: {len(unresolved)}")

# 生成 legacy_compat.py
output = '''"""
Java 历史项目 API 兼容层 (Legacy Compatibility Layer)
=====================================================

为 Java 旧 API 路径 (/auth-api/* /public-api/*) 提供 URL 别名, 内部调用现有 Python handler。

核心原则:
- 0 业务逻辑, 100% import-and-reuse 避免代码重复
- 所有 alias 路由直接调用现有 Python handler 函数
- 业务实现 100% 在现有 handler 中, 此文件仅做 URL 重写

生成时间: 2026-06-26
alias 路由: {total} 个
目标文件: {files} 个
"""
from fastapi import APIRouter, Request

router = APIRouter(prefix="", tags=["legacy-compat"])

# 导入目标 handler (避免代码重复)
{imports}

# === 别名路由 ===
{aliases}
'''

# 收集 import
imports_set = set()
for f, aliases in by_target.items():
    f_mod = f.replace(".py", "").replace("/", ".")
    for alias in aliases:
        imports_set.add(f"from app.api.{f_mod} import {alias['handler']}")

# 生成 alias 路由代码
aliases_code = []
for f in sorted(by_target.keys()):
    aliases_code.append(f"\n# === {f} ===")
    for alias in by_target[f]:
        # Java path 转 Python path
        py_path = alias["java_path"]
        py_path = re.sub(r'(/auth-api/)+', '/auth-api/', py_path)
        py_path = re.sub(r'(/public-api/)+', '/public-api/', py_path)
        py_path = re.sub(r'/+', '/', py_path)
        if not py_path.startswith('/'):
            py_path = '/' + py_path
        py_path = py_path.rstrip("/") or "/"

        method = alias["java_http"].lower()
        handler = alias["handler"]
        # 简化别名函数名
        safe = re.sub(r'[^a-zA-Z0-9_]', '_', py_path).strip("_")[:50]
        unique_id = abs(hash(f"{method}{py_path}{handler}")) % 100000
        aliases_code.append(f'@router.{method}("{py_path}", include_in_schema=False)')
        aliases_code.append(f'async def legacy_{method}_{safe}_{unique_id}(request: Request):')
        aliases_code.append(f'    """Legacy alias: {alias["java_path"]} -> {handler}()"""')
        # 提取 path 参数
        path_params = re.findall(r'\{(\w+)\}', py_path)
        body = f'    return await {handler}('
        if path_params:
            args = ', '.join([f'{p}=request.path_params.get("{p}")' for p in path_params])
            body += args + ', '
        body += 'request=request)'
        aliases_code.append(body)
        aliases_code.append('')

output_code = output.format(
    total=sum(len(v) for v in by_target.values()),
    files=len(by_target),
    imports='\n'.join(sorted(imports_set)),
    aliases='\n'.join(aliases_code)
)

out_path = Path(r"G:\IHUI-AI\server\app\api\legacy_compat.py")
out_path.write_text(output_code, encoding="utf-8")
print(f"\n生成: {out_path}")
print(f"代码行数: {len(output_code.splitlines())}")
print(f"alias 路由: {sum(len(v) for v in by_target.values())}")
