"""生成 edu_supplement_p1p2.py 桩+日志模式补迁移文件 (402 P1/P2 端点)."""
import json
import re

with open(r"g:/IHUI-AI/server/logs/edu_p1p2_candidates.json", "r", encoding="utf-8") as f:
    data = json.load(f)

# 合并所有候选
all_candidates = []
for key in ("zhs_p1p2", "ruoyi_legacy", "ruoyi_crud", "edu_v2"):
    all_candidates.extend(data[key])
print(f"总候选: {len(all_candidates)}")

# 拉取当前已注册 edu 端点
import httpx
r = httpx.get("http://127.0.0.1:8000/openapi.json", timeout=30.0)
spec = r.json()
py_edu = set()
for p in spec.get("paths", {}).keys():
    if "/api/v1/edu/" in p:
        py_edu.add(p)

# 过滤: 只保留没在 /api/v1/edu/ 中已实现的
to_migrate = []
seen = set()
for ep in all_candidates:
    new_path = ep["new_path"]
    # 把 /api/v1/edu/ 统一为 /api/v1/edu
    if new_path not in py_edu:
        # 标准化: 处理可能的重复
        # 例如 /api/v1/edu/login 和 /api/v1/edu/login/getWxCode 同时存在
        key = (ep["method"], new_path)
        if key in seen:
            continue
        seen.add(key)
        to_migrate.append(ep)
print(f"待补迁移 (未实现): {len(to_migrate)}")

# 按主题分组
grouped = {}
for ep in to_migrate:
    # 提取主题: /api/v1/edu/<sub>/...
    parts = ep["new_path"].split("/")
    if len(parts) > 4:
        sub = parts[4]
        if sub in ("api", "v1", "edu"):
            sub = "_".join(parts[4:6]) if len(parts) > 5 else parts[4]
    else:
        sub = "root"
    grouped.setdefault(sub, []).append(ep)

print(f"\n=== 按主题分组 ===")
for sub, eps in sorted(grouped.items()):
    print(f"  {sub}: {len(eps)}")

# 生成桩代码
code_lines = [
    '"""edu P1/P2 补迁移 - 桩+日志模式.',
    '',
    '2026-06-26 补迁移 (Java ZHS/RuoYi legacy/CRUD batch -> Python).',
    '',
    f'本文件覆盖 edu P1/P2 共 {len(to_migrate)} 个端点, 按主题分组:',
]

# 主题注释
for sub in sorted(grouped.keys()):
    code_lines.append(f'  - {sub}: {len(grouped[sub])} 端点')

code_lines.extend([
    '',
    '实现策略 (桩+日志模式):',
    '  - 端点全部可达, 返回标准化 {code:0, msg:"ok", data: {...}} 响应',
    '  - 业务逻辑全部桩化 (返回 mock 数据 + 唯一 ID 标识)',
    '  - 所有访问记录到 logger.info (业务调用审计)',
    '  - 后续替换: 业务实现在 service 层替换桩函数',
    '',
    '项目硬约束:',
    '  - 6 位错误码',
    '  - Body 参数提交',
    '  - 外部 HTTP timeout=30.0',
    '  - 敏感信息脱敏',
    '  - except Exception 加 logger.debug',
    '  - 异步避免同步 I/O',
    '"""',
    'from __future__ import annotations',
    '',
    'import logging',
    'import secrets',
    'import time',
    'from typing import Any, Dict, List, Optional',
    '',
    'from fastapi import APIRouter, Body, Depends, HTTPException, Query',
    '',
    'logger = logging.getLogger(__name__)',
    '',
    'router = APIRouter(prefix="", tags=["Edu-Supplement-P1P2"])',
    '',
    '',
    'def _ok(data: Any = None, msg: str = "ok") -> dict:',
    '    return {"code": 0, "data": data, "msg": msg}',
    '',
    '',
    'def _gen_id() -> str:',
    '    return secrets.token_hex(8)',
    '',
    '',
    'def _stub_response(endpoint: str, params: Optional[Dict] = None, body: Optional[Dict] = None) -> Dict[str, Any]:',
    '    logger.info(f"[P1P2-STUB] {endpoint} called")',
    '    return {',
    '        "id": _gen_id(),',
    '        "stub": True,',
    '        "endpoint": endpoint,',
    '        "ts": int(time.time()),',
    '    }',
    '',
    '',
    'def _stub_list(endpoint: str, page: int = 1, size: int = 20, **filters) -> Dict[str, Any]:',
    '    logger.info(f"[P1P2-STUB] {endpoint} list | page={page} size={size}")',
    '    return {',
    '        "rows": [],',
    '        "total": 0,',
    '        "page": page,',
    '        "size": size,',
    '        "stub": True,',
    '    }',
    '',
    '',
])

# 按主题顺序生成
for sub in sorted(grouped.keys()):
    eps = grouped[sub]
    code_lines.append("")
    code_lines.append(f"# {'='*70}")
    code_lines.append(f"# {sub} ({len(eps)} 端点)")
    code_lines.append(f"# {'='*70}")
    code_lines.append("")
    for ep in eps:
        m = ep["method"]
        path = ep["new_path"].replace("/api/v1/edu/", "")
        # 路径参数
        path_params = re.findall(r"\{(\w+)\}", path)
        # 函数签名
        params = []
        for pp in path_params:
            # 数字类型
            if "id" in pp.lower() or "no" in pp.lower() or "version" in pp.lower() or "type" in pp.lower() or "level" in pp.lower():
                params.append(f"{pp}: int = 0")
            else:
                params.append(f"{pp}: str = \"\"")
        # query 参数 (list 类)
        if "list" in path.lower() or "page" in path.lower() or "export" in path.lower() or "kind" in path.lower() or "info" in path.lower() or "/sites/" in path.lower():
            params.append("page: int = Query(1, ge=1)")
            params.append("size: int = Query(20, ge=1, le=100)")
        if m in ("post", "put"):
            params.append("payload: Optional[Dict[str, Any]] = Body(None)")
        sig = ", ".join(params) if params else ""
        # 函数名
        slug = path.replace("/", "_").replace("{", "").replace("}", "").replace("__", "_").strip("_")
        # 限制 slug 长度
        if len(slug) > 60:
            slug = slug[:60]
        code_lines.append(f"@router.{m}(\"/{path}\", summary=\"P1/P2 桩 (原: {ep['original']})\")")
        if sig:
            code_lines.append(f"def stub_{m}_{slug}({sig}):")
        else:
            code_lines.append(f"def stub_{m}_{slug}():")
        code_lines.append(f'    """P1/P2 桩端点 {m.upper()} {ep["new_path"]}."""')
        code_lines.append(f'    return _ok(_stub_response("{m.upper()} {ep["new_path"]}"))')
        code_lines.append("")

code_lines.append("")
code_lines.append(f"# 总端点数: {len(to_migrate)}")
code_lines.append("")

output_path = r"g:/IHUI-AI/server/app/api/v1/edu/edu_supplement_p1p2.py"
content = "\n".join(code_lines)
with open(output_path, "w", encoding="utf-8") as f:
    f.write(content)
print(f"\n已生成 {output_path}")
print(f"总端点数: {len(to_migrate)}")
print(f"文件大小: {len(content)} 字符")
