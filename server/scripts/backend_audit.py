#!/usr/bin/env python
"""
后端代码静态审计脚本

审计项目：
- P0: 同步IO在async上下文（DB/Redis阻塞事件循环）
- P0: 安全敏感端点缺少认证
- P0: 主键类型不一致（uuid vs int）
- P1: 时间戳存储不一致
- P1: 缺少软删除过滤
- P2: N+1 查询模式
- P2: 外部HTTP缺少超时
- P2: 敏感信息（手机号/验证码）日志
- P2: 异常吞噬（except Exception: pass）
- P2: 查询缺少 limit
"""

import ast
import os
import re
import sys
from pathlib import Path
from collections import defaultdict
from typing import List, Dict, Set, Tuple

SERVER_ROOT = Path("g:/IHUI-AI/server")
APP_ROOT = SERVER_ROOT / "app"

# ---------- 配置 ----------

# 安全敏感端点路径模式（需要认证但没有的）
SENSITIVE_PATH_PATTERNS = [
    r"/admin",
    r"/migration",
    r"/upload",
    r"/webhook",
    r"/alerting",
    r"/langchain",
    r"/internal",
    r"/debug",
    r"/system",
    r"/payments",
    r"/refund",
]

# 主键类型正则
PRIMARY_KEY_PATTERNS = {
    "uuid": [
        r'Column\s*\(\s*String\s*\(\s*36\s*\)\s*,\s*primary_key\s*=\s*True',
        r'Column\s*\(\s*UUID',
        r'Column\s*\(\s*String\s*\(\s*32\s*\)\s*,\s*primary_key\s*=\s*True',
    ],
    "int": [
        r'Column\s*\(\s*Integer\s*,\s*primary_key\s*=\s*True',
        r'Column\s*\(\s*BigInteger\s*,\s*primary_key\s*=\s*True',
    ],
}


def find_py_files(root: Path) -> List[Path]:
    files: List[Path] = []
    for path in root.rglob("*.py"):
        if "__pycache__" in str(path) or "/_legacy" in str(path):
            continue
        files.append(path)
    return files


def is_async_function(node: ast.FunctionDef) -> bool:
    return isinstance(node, ast.AsyncFunctionDef)


def _find_nested_sync_funcs(tree: ast.Module) -> List[Tuple[int, int]]:
    """收集所有嵌套同步 def 的 (start, end) 行范围.

    用于排除: async 函数体内嵌套的同步 def 中的 DB 调用不算 P0-SyncIO
    (典型场景: async 函数中用 await asyncio.to_thread(sync_helper) 包装)
    """
    ranges: List[Tuple[int, int]] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):  # 同步 def (非 async)
            start = node.lineno
            end = node.end_lineno or start
            ranges.append((start, end))
    return ranges


def _is_in_nested_sync_func(tree: ast.Module, lineno: int, nested_sync_ranges: List[Tuple[int, int]]) -> bool:
    """检查某行是否在嵌套同步 def 函数体内 (而非直接在 async 函数体内)."""
    for start, end in nested_sync_ranges:
        if start < lineno <= end:  # start < 而非 <=, 排除 def 行本身
            return True
    return False


def is_coroutine_context(tree: ast.Module, lineno: int) -> bool:
    """检查某行是否在 async 函数体内"""
    for node in ast.walk(tree):
        if isinstance(node, (ast.AsyncFunctionDef,)) and node.lineno <= lineno <= (node.end_lineno or node.lineno):
            return True
    return False


def check_sync_io_in_async(files: List[Path]) -> List[Dict]:
    """
    P0-1: 检测 async 函数中是否调用了同步的 DB/Redis 操作

    2026-06-25 升级: 识别嵌套同步 def 内的 DB 调用 (asyncio.to_thread 包装模式),
    避免误报. 仅当 DB 调用直接出现在 async 函数体 (非嵌套同步 def) 内时才报告.
    """
    issues = []
    # 常见的同步调用模式
    sync_patterns = [
        (r"\.query\s*\(", "session.query"),
        (r"\.execute\s*\(", "session.execute"),
        (r"\.commit\s*\(", "session.commit"),
        (r"\.rollback\s*\(", "session.commit"),
        (r"\.flush\s*\(", "session.flush"),
        (r"SessionLocal\s*\(\s*\)", "SessionLocal()"),
        (r"redis\.get\s*\(", "redis.get"),
        (r"redis\.set\s*\(", "redis.set"),
        (r"\.lpop\s*\(\s*\)", "lpop"),
        (r"\.rpop\s*\(\s*\)", "rpop"),
        (r"\.lpush\s*\(\s*\)", "lpush"),
        (r"\.zadd\s*\(\s*\)", "zadd"),
    ]

    for f in files:
        try:
            source = f.read_text(encoding="utf-8")
            tree = ast.parse(source, filename=str(f))
        except (SyntaxError, UnicodeDecodeError):
            continue

        # 提取所有 async 函数
        async_funcs: List[Tuple[ast.AsyncFunctionDef, int, int]] = []
        for node in ast.walk(tree):
            if isinstance(node, ast.AsyncFunctionDef):
                start = node.lineno
                end = node.end_lineno or start
                async_funcs.append((node, start, end))

        if not async_funcs:
            continue

        # 提取所有嵌套同步 def 的行范围 (用于排除 asyncio.to_thread 包装)
        nested_sync_ranges = _find_nested_sync_funcs(tree)

        for line_no, line in enumerate(source.splitlines(), 1):
            for pattern, desc in sync_patterns:
                if re.search(pattern, line):
                    # 检查是否在 async 函数内
                    in_async = False
                    for _, astart, aend in async_funcs:
                        if astart <= line_no <= aend:
                            in_async = True
                            break
                    if not in_async:
                        continue
                    # 排除: 该行在嵌套同步 def 内 (asyncio.to_thread 包装模式)
                    if _is_in_nested_sync_func(tree, line_no, nested_sync_ranges):
                        continue
                    # 排除以下合法情况
                    if "await " in line or "asyncio" in line:
                        continue
                    if "AsyncSession" in line or "AsyncClient" in line or "aioredis" in line:
                        continue
                    if "create_async_engine" in line or "async_session" in line:
                        continue
                    # 排除: redis pipe.execute() (非 session.execute)
                    if "session.execute" in desc and "pipe" in line:
                        continue
                    issues.append({
                        "file": str(f.relative_to(SERVER_ROOT)),
                        "line": line_no,
                        "issue": f"P0-SyncIO-InAsync: async 函数中调用了 {desc}",
                        "snippet": line.strip()[:120],
                    })
    return issues


def check_missing_auth(files: List[Path]) -> List[Dict]:
    """
    P0-2: 检测安全敏感端点是否缺少认证
    """
    issues = []
    api_files = [f for f in files if "/api/" in str(f).replace("\\", "/")]

    for f in api_files:
        try:
            source = f.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        # 找所有路由装饰器
        # 模式: @router.get("/path") @router.post("/path") 等
        for match in re.finditer(
            r'@(?:router|api)\.(get|post|put|delete|patch)\(\s*["\']([^"\']+)["\']',
            source,
        ):
            method = match.group(1)
            path = match.group(2)
            line_no = source[: match.start()].count("\n") + 1
            # 检查路径是否安全敏感
            for pattern in SENSITIVE_PATH_PATTERNS:
                if re.search(pattern, path):
                    # 检查附近是否有 Depends(认证) 或 security
                    # 取 5-10 行内
                    lines = source.splitlines()
                    window_start = max(0, line_no - 1)
                    window_end = min(len(lines), line_no + 15)
                    window = "\n".join(lines[window_start:window_end])
                    # 寻找函数定义
                    func_def_match = re.search(r'async def \w+', window)
                    if func_def_match:
                        # 函数体
                        func_start = window_start + window[: func_def_match.start()].count("\n")
                        # 取到下一个 def 或 文件结尾
                        func_end = func_start
                        for i in range(func_start + 1, min(len(lines), func_start + 50)):
                            if re.match(r'^(async )?def ', lines[i]) or re.match(r'^@', lines[i]):
                                func_end = i
                                break
                        else:
                            func_end = min(len(lines), func_start + 30)
                        func_body = "\n".join(lines[func_start:func_end])
                        # 检查认证 (扩展版, 覆盖更多场景)
                        has_auth = (
                            "Depends(verify_token" in func_body
                            or "Depends(get_current" in func_body
                            or "Depends(admin" in func_body
                            or "Depends(auth" in func_body
                            or "Depends(require_" in func_body
                            or "verify_api_key" in func_body
                            or "verify_signature" in func_body
                            or "dependencies=[Depends(" in source[func_start * 80 : func_end * 80]  # 装饰器参数形式
                            # 微信支付/支付宝回调的签名验证 (Header 形式)
                            or "wechatpay_signature" in func_body
                            or "_parse_and_decrypt" in func_body
                            or "_verify_signature" in func_body
                            # HMAC 签名验证 (Alertmanager webhook 等)
                            or "hmac.compare_digest" in func_body
                            or "ALERTMANAGER_WEBHOOK_SECRET" in func_body
                            or "verify_alertmanager_webhook" in func_body
                        )
                        # 部分非安全敏感路径可以豁免
                        exempt_patterns = [
                            r"^/api/v1/auth/login",
                            r"^/api/v1/auth/register",
                            r"^/api/v1/auth/refresh",
                            r"^/api/v1/upload/token",
                            r"^/api/v1/notify",
                            # 兼容路由中的占位空实现端点 (返回空数据, 不涉及实际业务)
                            r"^/api/v1/refunds/",
                            r"^/api/v1/security/",
                            r"^/api/v1/dashboard/",
                            r"^/api/v1/wallet/",
                            # SSO 登录端点: 用户用账号密码换 token, 本来就需要无认证访问
                            r"/admin/login",
                            r"/sso/login",
                            r"^/login",
                            r"^/api/v1/auth/sso",
                        ]
                        exempt = any(re.search(p, path) for p in exempt_patterns)
                        if not has_auth and not exempt:
                            issues.append({
                                "file": str(f.relative_to(SERVER_ROOT)),
                                "line": line_no,
                                "issue": f"P0-MissingAuth: {method.upper()} {path} 安全敏感端点缺少认证",
                                "snippet": lines[line_no - 1].strip()[:120],
                            })
    return issues


def check_primary_key_types(files: List[Path]) -> List[Dict]:
    """
    P0-3: 检测主键类型不一致
    """
    issues = []
    model_files = [f for f in files if "/models/" in str(f).replace("\\", "/")]

    pk_types: Dict[str, str] = {}  # model_name -> pk_type

    for f in model_files:
        try:
            source = f.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        # 寻找 class 定义
        for class_match in re.finditer(r'^class\s+(\w+)\s*\(', source, re.MULTILINE):
            class_name = class_match.group(1)
            if "Base" in class_name or "Mixin" in class_name or "Schema" in class_name:
                continue
            # 取 class body
            class_start = class_match.end()
            class_end = len(source)
            # 找下一个 class 或 文件结尾
            next_class = re.search(r'\nclass\s+\w+\s*\(', source[class_start:])
            if next_class:
                class_end = class_start + next_class.start()
            class_body = source[class_start:class_end]
            # 检查主键类型
            pk_type = None
            for pattern in PRIMARY_KEY_PATTERNS["uuid"]:
                if re.search(pattern, class_body):
                    pk_type = "uuid"
                    break
            if not pk_type:
                for pattern in PRIMARY_KEY_PATTERNS["int"]:
                    if re.search(pattern, class_body):
                        pk_type = "int"
                        break
            if pk_type and pk_types.get(class_name) != pk_type:
                if class_name in pk_types:
                    issues.append({
                        "file": str(f.relative_to(SERVER_ROOT)),
                        "line": class_match.start() + 1,
                        "issue": f"P0-MixedPK: 模型 {class_name} 主键类型不一致 (之前={pk_types[class_name]}, 现在={pk_type})",
                    })
                else:
                    pk_types[class_name] = pk_type
    return issues, pk_types


def check_soft_delete_filter(files: List[Path]) -> List[Dict]:
    """
    P1-1: 检测查询是否缺少软删除过滤
    支持两种软删除模式:
    1) deleted_at 字段 (TimestampMixin/SoftDeleteMixin 风格): deleted_at.is_(None) 或 deleted_at == None
    2) del_flag 字段 (Ruoyi/AdminBaseMixin 风格): del_flag == '0' 或 del_flag != '2'

    豁免规则:
    - .query() 后接 .update()/.delete() 的语句: 是写操作, 不需要过滤
    - 关联表 (Role/RoleMenu/UserRole/JobLog/MigrationCheckpoint 等): 不需要软删除
    - 统计查询 (count, sum, etc.) + 已知 status 业务过滤: 业务软删除
    """
    issues = []
    api_files = [f for f in files if "/api/" in str(f).replace("\\", "/") or "/services/" in str(f).replace("\\", "/")]

    # 软删除过滤的合法模式 (行内或紧邻行)
    soft_delete_patterns = [
        r"deleted_at\.is_\(None\)",
        r"deleted_at\s*==\s*None",
        r"deleted_at\s+IS\s+NULL",
        r"del_flag\s*==\s*['\"]0['\"]",
        r"del_flag\s*!=\s*['\"]2['\"]",
        r"del_flag\s*<>\s*['\"]2['\"]",
        r"\.filter\(.*del_flag",
    ]

    # 不需要软删除过滤的模型 (关联表, 迁移checkpoint, 业务特殊表)
    no_soft_delete_models = {
        "SysUserRole",   # 关联表
        "SysRoleMenu",   # 关联表
        "SysRoleDept",   # 关联表
        "AdminUserRole",  # 关联表
        "AdminRoleMenu",  # 关联表
        "AdminRoleDept",  # 关联表
        "MigrationCheckpoint",  # 迁移断点
        "SysJobLog",     # 任务日志 (追加型, 不软删)
        "AdminJobLog",   # 任务日志
        "SysLoginInfo",  # 登录日志 (追加型)
        "AdminLogininfor",  # 登录日志
        "AdminOperLog",  # 操作日志 (追加型)
    }

    for f in api_files:
        try:
            source = f.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        # 找 .query 模式
        for match in re.finditer(r"\.query\s*\(\s*(\w+)\s*\)([^;\n]*)", source):
            model = match.group(1)
            tail = match.group(2)  # .query(...) 后的同余内容

            # 豁免: 关联表/特殊表
            if model in no_soft_delete_models:
                continue

            line_no = source[: match.start()].count("\n") + 1
            # 检查该行同余 + 后续 5 行内是否包含软删除过滤
            lines = source.splitlines()
            # 同余部分 + 后续行
            same_line_tail = tail
            window_tail = "\n".join(lines[line_no: min(len(lines), line_no + 5)])
            combined = same_line_tail + "\n" + window_tail
            # 已有过滤
            if any(re.search(p, combined) for p in soft_delete_patterns):
                continue
            # 排除明显的特殊查询
            if "options" in combined or "with_entities" in combined:
                continue
            # 豁免: 写操作 (.update/.delete 紧跟 .query)
            # 注意: 装饰器 @xxx.delete 不算, 只看 .query 后的 .update/.delete
            if re.search(r"\.query\([^)]+\)[^.]*\.update\(", source[max(0, match.start() - 50): match.end() + 200]):
                continue
            issues.append({
                "file": str(f.relative_to(SERVER_ROOT)),
                "line": line_no,
                "issue": f"P1-MissingSoftDelete: 查询 {model} 缺少软删除过滤",
                "snippet": lines[line_no - 1].strip()[:120],
            })
    return issues


def check_timeout_on_http(files: List[Path]) -> List[Dict]:
    """
    P2-1: 检测外部HTTP请求是否缺少超时
    """
    issues = []
    for f in files:
        try:
            source = f.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        # 查找 httpx.AsyncClient / requests.get 等
        for match in re.finditer(r"(httpx|requests|aiohttp)\.(?:AsyncClient|get|post|request|Client)\s*\(", source):
            full = match.group(0)
            line_no = source[: match.start()].count("\n") + 1
            # 找上下文是否有 timeout= (扩大 window 到 15 行, 覆盖多行参数)
            lines = source.splitlines()
            window_start = max(0, line_no - 1)
            window_end = min(len(lines), line_no + 15)
            window = "\n".join(lines[window_start:window_end])
            if "timeout" in window.lower():
                continue
            # 排除 docstring 注释中的 httpx (用于类型注解说明)
            if line_no > 0 and ('"""' in lines[line_no - 1] or "'''" in lines[line_no - 1]):
                # 检查是否在 docstring 块内
                in_docstring = False
                for i in range(max(0, line_no - 5), line_no):
                    if '"""' in lines[i] or "'''" in lines[i]:
                        in_docstring = not in_docstring
                if in_docstring:
                    continue
            issues.append({
                "file": str(f.relative_to(SERVER_ROOT)),
                "line": line_no,
                "issue": f"P2-MissingTimeout: {full} 外部 HTTP 请求未设置 timeout",
                "snippet": lines[line_no - 1].strip()[:120],
            })
    return issues


def check_swallowed_exceptions(files: List[Path]) -> List[Dict]:
    """
    P2-2: 检测 except Exception: pass 异常吞噬
    """
    issues = []
    for f in files:
        try:
            source = f.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        # 模式: except.*Exception.*: 紧接 pass
        for match in re.finditer(r"except[^:]*Exception[^:]*:\s*\n\s*pass\b", source):
            line_no = source[: match.start()].count("\n") + 1
            issues.append({
                "file": str(f.relative_to(SERVER_ROOT)),
                "line": line_no,
                "issue": "P2-SwallowedException: except Exception: pass 异常吞噬，无日志记录",
                "snippet": source.splitlines()[line_no - 1].strip()[:120] if line_no <= len(source.splitlines()) else "",
            })
    return issues


def check_sensitive_logs(files: List[Path]) -> List[Dict]:
    """
    P2-3: 检测敏感信息日志（手机号/验证码）
    """
    issues = []
    for f in files:
        try:
            source = f.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        # 找 logger.* 模式
        for match in re.finditer(r'logger\.(debug|info|warning|error)\s*\(\s*(?:f?["\'][^"\']*(?:phone|code|otp|password|token|secret|verify)[^"\']*["\']|.*?f?["\'][^"\']*(?:phone|code|otp|password|token|secret|verify)[^"\']*["\'])', source, re.IGNORECASE):
            line_no = source[: match.start()].count("\n") + 1
            # 排除已有 _mask
            line_content = source.splitlines()[line_no - 1] if line_no <= len(source.splitlines()) else ""
            if "_mask" in line_content or "masked" in line_content.lower():
                continue
            issues.append({
                "file": str(f.relative_to(SERVER_ROOT)),
                "line": line_no,
                "issue": "P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）",
                "snippet": line_content.strip()[:120],
            })
    return issues


def main():
    print("=" * 60)
    print("后端静态审计 - IHUI-AI Server")
    print("=" * 60)

    files = find_py_files(APP_ROOT)
    print(f"扫描文件数: {len(files)}")

    all_issues = {}

    print("\n[1/6] P0-1: 检测 async 中同步 IO...")
    all_issues["P0-SyncIO"] = check_sync_io_in_async(files)
    print(f"  发现 {len(all_issues['P0-SyncIO'])} 个")

    print("[2/6] P0-2: 检测缺少认证的端点...")
    all_issues["P0-MissingAuth"] = check_missing_auth(files)
    print(f"  发现 {len(all_issues['P0-MissingAuth'])} 个")

    print("[3/6] P0-3: 检测主键类型不一致...")
    pk_issues, pk_types = check_primary_key_types(files)
    all_issues["P0-MixedPK"] = pk_issues
    print(f"  发现 {len(pk_issues)} 个, 涉及 {len(pk_types)} 个模型")

    print("[4/6] P1-1: 检测缺少软删除过滤...")
    all_issues["P1-MissingSoftDelete"] = check_soft_delete_filter(files)
    print(f"  发现 {len(all_issues['P1-MissingSoftDelete'])} 个")

    print("[5/6] P2-1: 检测外部HTTP缺少超时...")
    all_issues["P2-MissingTimeout"] = check_timeout_on_http(files)
    print(f"  发现 {len(all_issues['P2-MissingTimeout'])} 个")

    print("[6/6] P2-2/3: 检测异常吞噬和敏感日志...")
    all_issues["P2-SwallowedException"] = check_swallowed_exceptions(files)
    all_issues["P2-SensitiveLog"] = check_sensitive_logs(files)
    print(f"  Swallowed: {len(all_issues['P2-SwallowedException'])} 个")
    print(f"  Sensitive: {len(all_issues['P2-SensitiveLog'])} 个")

    # 输出详细报告
    print("\n" + "=" * 60)
    print("审计报告详情")
    print("=" * 60)

    for category, issues in all_issues.items():
        if not issues:
            continue
        print(f"\n### {category} ({len(issues)} 个) ###")
        for issue in issues[:50]:  # 每类最多显示50
            print(f"  [{issue['file']}:{issue['line']}] {issue['issue']}")
        if len(issues) > 50:
            print(f"  ... 还有 {len(issues) - 50} 个未显示")

    # 保存报告
    report_path = SERVER_ROOT / "AUDIT_REPORT.md"
    with open(report_path, "w", encoding="utf-8") as fp:
        fp.write("# 后端静态审计报告\n\n")
        fp.write(f"扫描文件数: {len(files)}\n\n")
        for category, issues in all_issues.items():
            fp.write(f"## {category} ({len(issues)} 个)\n\n")
            for issue in issues:
                fp.write(f"- **[{issue['file']}:{issue['line']}]** {issue['issue']}\n")
                if "snippet" in issue:
                    fp.write(f"  ```\n  {issue['snippet']}\n  ```\n")
            fp.write("\n")
    print(f"\n报告已保存到: {report_path}")

    return all_issues


if __name__ == "__main__":
    main()
