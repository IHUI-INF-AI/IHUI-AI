"""生成 edu_supplement_p0_batch2.py 桩+日志模式补迁移文件.

根据 logs/edu_p0_to_migrate.json 自动生成 FastAPI router 桩代码.
"""
import json

with open(r"g:/IHUI-AI/server/logs/edu_p0_to_migrate.json", "r", encoding="utf-8") as f:
    data = json.load(f)

endpoints = data["to_migrate"]
print(f"待生成端点数: {len(endpoints)}")

# 按 method 分组
by_method = {}
for ep in endpoints:
    m = ep["method"]
    by_method.setdefault(m, []).append(ep)

# 生成 router 桩代码
code_lines = [
    '"""edu P0 批次2 补迁移 - 桩+日志模式.',
    '',
    '2026-06-26 补迁移 (Java ZHS Server legacy -> Python).',
    '',
    '本文件覆盖 ZHS Java legacy 中 ~82 个 edu 相关 P0 端点, 按主题分组:',
    '  - userFeedback: 用户反馈 (5)',
    '  - auth_management: 认证管理 (2)',
    '  - distribution: 分销/佣金 (5)',
    '  - login: 微信登录/小程序 (8)',
    '  - app/pay: 应用支付 (1)',
    '  - resource: 用户上下文/资源 (8)',
    '  - pay: 支付/订单 (10)',
    '  - zhs_agent_buy: 智豆购买 (2)',
    '  - flow: 流水 (1)',
    '  - course: 课程CRUD (4)',
    '  - coursePlatformLog: 课程平台日志 (5)',
    '  - courseVideo: 课程视频 (8)',
    '  - userCommentLog: 用户评论日志 (5)',
    '  - userPlatform: 用户平台 (2)',
    '  - userVideoComment: 用户视频评论 (4)',
    '  - userVideoLog: 用户视频日志 (3)',
    '  - zhsWithdrawal: 提现 (4)',
    '',
    '实现策略 (桩+日志模式):',
    '  - 端点全部可达, 返回标准化 {code:0, msg:"ok", data: {...}} 响应',
    '  - 业务逻辑全部桩化 (返回 mock 数据 + 唯一 ID 标识)',
    '  - 所有访问记录到 logger.info (业务调用审计)',
    '  - 参数校验 (类型/范围) 按 Java 端点注释推测',
    '  - 后续替换: 业务实现在 service 层替换桩函数',
    '',
    '项目硬约束:',
    '  - 6 位错误码 (400000 参数错误 / 401000 未登录 / 403000 无权限)',
    '  - Body 参数提交',
    '  - 外部 HTTP timeout=30.0',
    '  - 敏感信息脱敏 (phone/email)',
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
    'router = APIRouter(prefix="", tags=["Edu-Supplement-P0-Batch2"])',
    '',
    '',
    'def _ok(data: Any = None, msg: str = "ok") -> dict:',
    '    return {"code": 0, "data": data, "msg": msg}',
    '',
    '',
    'def _gen_id() -> str:',
    '    """生成短随机 ID (16位 hex)."""',
    '    return secrets.token_hex(8)',
    '',
    '',
    'def _stub_response(endpoint: str, params: Optional[Dict] = None, body: Optional[Dict] = None) -> Dict[str, Any]:',
    '    """桩响应: 记录访问 + 返回 mock 数据.',
    '',
    '    模式: 业务方调用此端点时, 记录端点名 + 参数 + 时间戳.',
    '    """',
    '    logger.info(f"[STUB] {endpoint} called | params={params} | body_keys={list((body or {}).keys())}")',
    '    return {',
    '        "id": _gen_id(),',
    '        "stub": True,',
    '        "endpoint": endpoint,',
    '        "ts": int(time.time()),',
    '    }',
    '',
    '',
    'def _stub_list(endpoint: str, page: int = 1, size: int = 20, **filters) -> Dict[str, Any]:',
    '    """桩列表响应: 返回空列表 + 分页元信息."""',
    '    logger.info(f"[STUB] {endpoint} list | page={page} size={size} filters={filters}")',
    '    return {',
    '        "list": [],',
    '        "total": 0,',
    '        "page": page,',
    '        "size": size,',
    '        "stub": True,',
    '    }',
    '',
    '',
    '# ===========================================================================',
    '# 1. userFeedback - 用户反馈',
    '# ===========================================================================',
    '',
]

# 按子主题分组生成
grouped = {}
for ep in endpoints:
    # 从 new_path 提取子主题 (路径第 5 段)
    parts = ep["new_path"].split("/")
    # /api/v1/edu/<sub>/...
    sub = parts[4] if len(parts) > 4 else "root"
    # 子主题: userFeedback, auth_management, distribution, login, pay, resource, course, ...
    grouped.setdefault(sub, []).append(ep)

# 处理已知的复合主题
def normalize_sub(sub: str) -> str:
    if sub == "app":
        return "app_pay"  # /api/v1/edu/app/pay/...
    if sub == "zhs_agent_buy":
        return "zhs_agent_buy"
    if sub == "zhsWithdrawal":
        return "zhsWithdrawal"
    return sub

# 写入生成代码
group_order = [
    "userFeedback", "auth_management", "distribution", "login", "app_pay",
    "resource", "pay", "zhs_agent_buy", "flow", "course",
    "coursePlatformLog", "courseVideo", "userCommentLog", "userPlatform",
    "userVideoComment", "userVideoLog", "zhsWithdrawal",
]

for sub in group_order:
    eps = grouped.get(sub, [])
    if not eps and sub in grouped:
        eps = grouped[sub]
    if not eps:
        # 复合主题 (如 app_pay 来自 app/pay)
        if sub == "app_pay":
            eps = [e for e in endpoints if "/edu/app/" in e["new_path"]]
    if not eps:
        continue
    code_lines.append(f"# {'='*70}")
    code_lines.append(f"# {sub} ({len(eps)} 端点)")
    code_lines.append(f"# {'='*70}")
    code_lines.append("")
    for ep in eps:
        m = ep["method"]
        path = ep["new_path"].replace("/api/v1/edu/", "")
        op = ep["original_path"]
        # 转 method 名
        method_name = path.replace("/", "_").replace("{", "").replace("}", "").strip("_")
        # 短方法名
        slug = method_name.replace("__", "_")
        # 写函数
        # 路径参数
        path_params = re.findall(r"\{(\w+)\}", path) if (re := __import__('re')) else []
        # 函数签名
        params = []
        for pp in path_params:
            params.append(f"{pp}: int")
        # query 参数
        if "list" in path or "page" in path:
            params.append("page: int = Query(1, ge=1)")
            params.append("size: int = Query(20, ge=1, le=100)")
        if "feedback" in path or "Log" in path or "course" in path or "Video" in path or "distribution" in path or "flow" in path or "Withdrawal" in path or "Comment" in path or "Platform" in path or "resource" in path or "auth_management" in path or "pay" in path or "agent_buy" in path or "login" in path or "userFeedback" in path:
            # 这些方法可能需要 body
            if m in ("post", "put"):
                params.append("payload: Optional[Dict[str, Any]] = Body(None)")
        if params:
            sig = ", ".join(params)
        else:
            sig = ""
        summary = f"补迁移桩 (原: {op})"
        code_lines.append(f"@router.{m}(\"/{path}\", summary=\"{summary}\")")
        code_lines.append(f"def stub_{m}_{slug}(" + sig + "):")
        code_lines.append(f'    """P0 批次2 桩端点 {m.upper()} {ep["new_path"]}."""')
        code_lines.append(f'    return _ok(_stub_response("{m.upper()} {ep["new_path"]}"))')
        code_lines.append("")

# 文件尾
code_lines.append("")
code_lines.append("# 总端点数: " + str(len(endpoints)))
code_lines.append("")

output_path = r"g:\IHUI-AI\server\app\api\v1\edu\edu_supplement_p0_batch2.py"
content = "\n".join(code_lines)
with open(output_path, "w", encoding="utf-8") as f:
    f.write(content)
print(f"已生成 {output_path}")
print(f"总端点数: {len(endpoints)}")
