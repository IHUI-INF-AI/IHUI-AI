#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""为每个 Java 缺失端点生成 Python alias 路由 - 直接调用真实 handler"""
import re
import json
from pathlib import Path
from collections import defaultdict

CLASSIFICATION = json.loads(
    Path(r"G:\IHUI-AI\docs\archive\endpoint_classification.json").read_text(encoding="utf-8")
)

alias_only = CLASSIFICATION["alias_only"]
G_DRIVE_API = Path(r"G:\IHUI-AI\server\app\api")

# 缓存 Python endpoint -> handler function
py_handler_cache = {}

def find_py_handler(py_file, http, path):
    """找到 Python 文件中匹配 http+path 的 handler 函数名"""
    if py_file in py_handler_cache:
        cache_key = f"{http}:{path}"
        if cache_key in py_handler_cache[py_file]:
            return py_handler_cache[py_file][cache_key]

    target_file = G_DRIVE_API / py_file
    if not target_file.exists():
        return None
    content = target_file.read_text(encoding="utf-8")

    if py_file not in py_handler_cache:
        py_handler_cache[py_file] = {}

    # 找 @router.X("path") 后面的 async def func_name
    # 处理 path 中的 {x} 参数
    pattern_path = re.escape(path).replace(r'\{id\}', r'\{[^}]+\}')
    pat = rf'@router\.{http.lower()}\s*\(\s*["\']({pattern_path})["\']'
    matches = list(re.finditer(pat, content))
    for m in matches:
        idx = m.end()
        rest = content[idx:]
        func_match = re.search(r'async def (\w+)\(', rest)
        if func_match:
            handler = func_match.group(1)
            py_handler_cache[py_file][f"{http}:{path}"] = handler
            return handler

    # 备用: 标准化匹配
    py_norm = re.sub(r'\{[^}]+\}', '{id}', path)
    id_pattern = r'\{[^}]+\}'
    pat2_str = '@router\\.' + http.lower() + r'\s*\(\s*["\']?' + re.escape(py_norm).replace(r"\{id\}", id_pattern) + r'["\']?'
    pat2 = re.compile(pat2_str)
    matches2 = list(pat2.finditer(content))
    for m in matches2:
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
        "match_type": ep["match_type"],
    })

print(f"待生成 alias 总数: {len(alias_only)}")
print(f"已解析 handler: {sum(len(v) for v in by_target.values())}")
print(f"未解析: {len(unresolved)}")
if unresolved[:5]:
    print("未解析样例:")
    for u in unresolved[:5]:
        print(f"  {u['http']:6s} {u['path']:40s} -> {u['py_match']['file']} {u['py_match']['path']}")

# 生成 legacy_compat.py
output = '''"""
Java 历史项目 API 兼容层 (Legacy Compatibility Layer)
=====================================================

为 Java 旧 API 路径 (/auth-api/* /public-api/*) 提供 URL 别名, 内部调用现有 Python handler。

核心原则:
- 不包含任何业务逻辑, 全部 import-and-reuse 避免代码重复
- 所有 alias 路由直接调用现有 Python handler 函数
- 业务实现 100% 在现有 handler 中, 此文件仅做 URL 重写

生成时间: 2026-06-26
覆盖范围: {total} 个 Java 端点
目标文件: {files} 个
"""
from fastapi import APIRouter

router = APIRouter(prefix="", tags=["legacy-compat"])

# 导入目标 handler
{imports}

# 别名路由 - 全部转发到现有 handler
{aliases}
'''

# 收集 import
imports = []
for f in sorted(by_target.keys()):
    f_mod = f.replace(".py", "").replace("/", ".")
    # 检查文件是否定义了 router
    target_file = G_DRIVE_API / f
    if not target_file.exists():
        continue
    content = target_file.read_text(encoding="utf-8")
    # 找到 handler 函数定义
    handlers_in_file = set()
    for alias in by_target[f]:
        handlers_in_file.add(alias["handler"])
    for h in sorted(handlers_in_file):
        imports.append(f"from app.api.{f_mod} import {h}")

# 生成 alias 路由
aliases = []
for f in sorted(by_target.keys()):
    aliases.append(f"\n# === {f} ===")
    for alias in by_target[f]:
        # Java path 转 Python path - 保持 {x} 形式
        py_path = alias["java_path"]
        # 处理重复前缀: auth-api/auth-api -> auth-api
        py_path = re.sub(r'(/auth-api/)+', '/auth-api/', py_path)
        py_path = re.sub(r'(/public-api/)+', '/public-api/', py_path)
        py_path = re.sub(r'//+', '/', py_path)
        py_path = py_path.rstrip("/")
        if not py_path:
            py_path = "/"
        method = alias["java_http"].lower()
        handler = alias["handler"]
        # 别名函数名: alias_<method>_<java_path_safe>
        safe_name = re.sub(r'[^a-zA-Z0-9_]', '_', alias["java_path"])[:40]
        aliases.append(f'@router.{method}("{py_path}")')
        aliases.append(f'async def alias_{method}_{safe_name}():')
        aliases.append(f'    """Legacy alias: {alias["java_path"]} -> {handler}"""')
        aliases.append(f'    from fastapi import Request')
        aliases.append(f'    return await {handler}()')
        aliases.append('')

output_code = output.format(
    total=sum(len(v) for v in by_target.values()),
    files=len(by_target),
    imports='\n'.join(imports),
    aliases='\n'.join(aliases)
)

out_path = Path(r"G:\IHUI-AI\server\app\api\legacy_compat.py")
out_path.write_text(output_code, encoding="utf-8")
print(f"\n生成: {out_path}")
print(f"代码行数: {len(output_code.splitlines())}")
print(f"alias 路由: {sum(len(v) for v in by_target.values())}")
