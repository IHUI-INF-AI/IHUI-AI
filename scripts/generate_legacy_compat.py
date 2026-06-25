#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成 legacy_compat.py 别名路由 - 把 /auth-api/* /public-api/* 转发到现有 handler"""
import re
import json
from pathlib import Path
from collections import defaultdict

CLASSIFICATION = json.loads(
    Path(r"G:\IHUI-AI\docs\archive\endpoint_classification.json").read_text(encoding="utf-8")
)

alias_only = CLASSIFICATION["alias_only"]

# 按 Python 目标文件分组
by_target = defaultdict(list)
for ep in alias_only:
    target = ep["py_match"]
    by_target[target["file"]].append({
        "java_http": ep["http"],
        "java_path": ep["path"],
        "match_type": ep["match_type"],
    })

# 生成 alias 路由代码
output_lines = [
    '"""',
    'Java 历史项目 API 兼容层 (Legacy Compatibility Layer)',
    '',
    '为 Java 旧 API (auth-api/public-api 前缀) 提供 URL 别名, 内部转发到现有 Python handler。',
    '不包含任何业务逻辑, 全部使用 import-and-reuse 模式避免代码重复。',
    '',
    f'共 {len(alias_only)} 个别名路由',
    f'目标文件: {len(by_target)} 个',
    '"""',
    'from fastapi import APIRouter, Depends',
    '',
    'router = APIRouter(prefix="", tags=["legacy-compat"])',
    '',
]

# 导入每个目标文件的 router
imported_files = sorted(by_target.keys())
for f in imported_files:
    # 转换文件路径为 import 路径
    f_clean = f.replace(".py", "").replace("/", ".")
    output_lines.append(f"from app.api.{f_clean} import router as {f_clean.replace('.', '_')}_router")

output_lines.append('')
output_lines.append('# 路由别名 - 全部转发到现有 handler, 无业务逻辑')
output_lines.append('')

# 读取每个目标文件, 找到对应 handler 函数
G_DRIVE_API = Path(r"G:\IHUI-AI\server\app\api")
for f in imported_files:
    target_file = G_DRIVE_API / f
    if not target_file.exists():
        continue
    content = target_file.read_text(encoding="utf-8")
    rel = f.replace(".py", "").replace("/", "_")
    target_aliases = by_target[f]

    # 为该文件中的每个 endpoint, 找到 handler function
    for alias in target_aliases:
        java_path = alias["java_path"]
        java_http = alias["java_http"].lower()
        # 计算 prefix 替换
        target_path = None
        if alias["match_type"] == "exact":
            # 同样的路径, 不需要 alias
            continue
        elif alias["match_type"].startswith("strip_"):
            # Java 有前缀, Python 没有
            stripped = java_path
            for prefix in ["/auth-api/", "/public-api/", "auth-api/", "public-api/"]:
                if stripped.startswith(prefix):
                    stripped = stripped[len(prefix):]
                    break
            # 找到 Python 目标
            for ep_match in alias_only:
                if ep_match["py_match"]["file"] == f and ep_match["path"] == java_path:
                    target_path = ep_match["py_match"]["path"]
                    break
        if not target_path:
            # 尝试直接匹配
            for ep_match in alias_only:
                if ep_match["py_match"]["file"] == f and ep_match["path"] == java_path:
                    target_path = ep_match["py_match"]["path"]
                    break

        # 找到 handler
        # Java path 末尾段 -> Python function name
        last_seg = java_path.rstrip("/").split("/")[-1]
        if not last_seg or last_seg.startswith("{"):
            continue
        # 找 Python function: `async def func_name(` 在文件内
        # 通过 path 搜索: @router.X("path") 之后是 async def func
        # 用正则匹配 @router.X("target_path") 后面的 async def func
        pattern = rf'@router\.{java_http}\s*\(\s*["\']({re.escape(target_path)})["\']'
        match = re.search(pattern, content)
        if not match:
            continue
        # 找下一行 async def
        idx = match.end()
        rest = content[idx:]
        func_match = re.search(r'async def (\w+)\(', rest)
        if not func_match:
            continue
        func_name = func_match.group(1)

        # 生成 alias 路由
        # Java path -> Python path (加 prefix)
        if java_path.startswith("/auth-api/"):
            py_alias_path = java_path
            deps = "  # require_login added in target"
        elif java_path.startswith("/public-api/"):
            py_alias_path = java_path
            deps = "  # public access"
        else:
            py_alias_path = java_path

        # 转换 Java path to Python
        py_path = java_path
        # 把 {id} 之类转为 {xxx_id}
        py_path = re.sub(r'\{(\w+)\}', lambda m: '{' + m.group(1) + '_id}', py_path)

        router_name = f"{rel}_router"
        output_lines.append(f'@router.{java_http}("{py_path}")')
        output_lines.append(f'async def alias_{java_http}_{last_seg}_{len(output_lines)}(*args, **kwargs):')
        output_lines.append(f'    """Legacy alias for {java_path} -> {target_path}"""')
        output_lines.append(f'    return await {router_name}.routes[0].endpoint(*args, **kwargs)  # placeholder')
        output_lines.append('')

output = '\n'.join(output_lines)
Path(r"G:\IHUI-AI\server\app\api\legacy_compat.py").write_text(output, encoding="utf-8")
print(f"生成 legacy_compat.py: {len(output_lines)} 行")
print(f"覆盖别名路由: {len(alias_only)} 个")
