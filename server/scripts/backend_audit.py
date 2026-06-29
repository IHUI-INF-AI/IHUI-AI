"""后端静态审计脚本.

审计 g:\\IHUI-AI\\server 后端代码, 检查是否有明显问题.

审计项:
  A. 扫描 server/app/api/v1/ 下所有 .py 路由文件
  B. 检查每个模块是否注册到 router.py (grep import 语句)
  C. 检查是否有空的/stub 路由文件 (文件过小或只有 pass)
  D. 检查是否有明显的明文凭证 (password/secret/key = "xxx" 模式,
     排除注释和 .env.example)

输出审计报告 (PASS/WARN/FAIL), 最终汇总.
仅使用 Python 标准库, 可直接 `python backend_audit.py` 运行.
"""

import os
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent  # g:\IHUI-AI
SERVER_DIR = PROJECT_ROOT / "server"
API_V1_DIR = SERVER_DIR / "app" / "api" / "v1"
ROUTER_FILE = API_V1_DIR / "router.py"

# 统计
stats = {"pass": 0, "warn": 0, "fail": 0}
findings = []  # (level, category, message)


def add_pass(category, msg):
    stats["pass"] += 1
    findings.append(("PASS", category, msg))


def add_warn(category, msg):
    stats["warn"] += 1
    findings.append(("WARN", category, msg))


def add_fail(category, msg):
    stats["fail"] += 1
    findings.append(("FAIL", category, msg))


# ---------------------------------------------------------------------------
# A. 扫描 server/app/api/v1/ 下所有 .py 路由文件
# ---------------------------------------------------------------------------
# 这些目录/文件属于基础设施, 不作为"业务模块"审计注册情况
INFRA_FILES = {
    "__init__.py", "router.py", "admin_panel.py", "ai_bot_sites.py",
    "canary_routes.py", "compat_routes.py",
    "remote.py", "video.py", "ws_admin.py",
}
INFRA_DIRS = {"_legacy_internal", "docs"}


def collect_route_files():
    """收集所有路由 .py 文件 (排除 __init__.py 与基础设施文件)."""
    route_files = []
    for path in sorted(API_V1_DIR.rglob("*.py")):
        name = path.name
        if name == "__init__.py":
            continue
        # 跳过基础设施顶层文件
        if path.parent == API_V1_DIR and name in INFRA_FILES:
            continue
        # 跳过基础设施目录
        rel = path.relative_to(API_V1_DIR)
        if rel.parts and rel.parts[0] in INFRA_DIRS:
            continue
        route_files.append(path)
    return route_files


# ---------------------------------------------------------------------------
# B. 检查每个模块是否注册到 router.py
# ---------------------------------------------------------------------------
def load_router_text():
    if not ROUTER_FILE.exists():
        return ""
    try:
        return ROUTER_FILE.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return ""


def is_module_registered(router_text, module_name):
    """检查 router.py 是否 import 了该模块 (按模块名出现)."""
    # 匹配 from app.api.v1.<...>.<module_name> 或 from app.api.v1.<module_name>
    # 也匹配 include_router 调用中含模块名
    needle = re.escape(module_name)
    patterns = [
        rf"from\s+app\.api\.v1\.[\w.]*\b{needle}\b",
        rf"\b{needle}_router\b",
        rf"include_router\([^)]*\b{needle}\b",
    ]
    for pat in patterns:
        if re.search(pat, router_text):
            return True
    return False


# ---------------------------------------------------------------------------
# C. 检查空的/stub 路由文件
# ---------------------------------------------------------------------------
# 阈值: 去除注释/空行后, 有效代码行数 < 5 视为 stub
STUB_MIN_LINES = 5


def strip_code(source):
    """去除注释、空行、docstring, 返回有效代码行列表."""
    lines = []
    in_docstring = False
    docstring_delim = None
    for raw in source.splitlines():
        stripped = raw.strip()
        # 处理 docstring 状态
        if in_docstring:
            if docstring_delim in stripped:
                in_docstring = False
            continue
        # 跳过空行
        if not stripped:
            continue
        # 跳过单行注释
        if stripped.startswith("#"):
            continue
        # 检测 docstring 起始
        if stripped.startswith('"""') or stripped.startswith("'''"):
            delim = stripped[:3]
            # 单行 docstring
            if stripped.endswith(delim) and len(stripped) > 3:
                continue
            in_docstring = True
            docstring_delim = delim
            continue
        lines.append(stripped)
    return lines


def is_stub_file(path):
    """判断文件是否为 stub (有效代码过少或仅 pass)."""
    try:
        source = path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return True, 0
    code_lines = strip_code(source)
    # 仅含 pass/... 的视为 stub
    meaningful = [l for l in code_lines if l not in ("pass", "...")]
    return len(meaningful) < STUB_MIN_LINES, len(meaningful)


# ---------------------------------------------------------------------------
# D. 检查明显的明文凭证
# ---------------------------------------------------------------------------
# 排除的占位符/示例值 (大小写不敏感包含即跳过)
PLACEHOLDER_TOKENS = [
    "your_", "example", "placeholder", "change_me", "changeme",
    "xxx", "todo", "fixme", "<", ">", "test", "demo", "sample",
    "os.getenv", "os.environ", "settings.", "config.", "${", "none", "null",
    "getenv", "environ",
]

# 凭证赋值正则: name = "value" 或 name = 'value' (value 长度 >= 6)
CRED_PATTERN = re.compile(
    r"""(?ix)
    \b(password|passwd|pwd|secret|api[_-]?key|access[_-]?key|
       secret[_-]?key|private[_-]?key|client[_-]?secret|
       access[_-]?token|auth[_-]?token|db[_-]?password)\s*
    [:=]\s*
    (["'])([^"']{6,})\3
    """,
    re.IGNORECASE,
)

# 排除的文件名/扩展
EXCLUDED_FILE_SUFFIXES = (".env.example", ".env.sample", ".example", ".bak")
EXCLUDED_DIR_NAMES = {"__pycache__", ".venv", "venv", "node_modules", ".git"}


def is_excluded_file(path):
    name = path.name.lower()
    for suf in EXCLUDED_FILE_SUFFIXES:
        if name.endswith(suf):
            return True
    # 测试文件中的凭证常为测试用例, 单独标记但降级为 WARN
    return False


def is_test_file(path):
    name = path.name.lower()
    return name.startswith("test_") or name.endswith("_test.py") or "conftest" in name


def scan_plaintext_credentials():
    """扫描 server/app 下所有 .py 文件中的明文凭证."""
    app_dir = SERVER_DIR / "app"
    hits = []
    if not app_dir.exists():
        return hits
    for path in sorted(app_dir.rglob("*.py")):
        # 排除目录
        if any(part in EXCLUDED_DIR_NAMES for part in path.parts):
            continue
        if is_excluded_file(path):
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        for lineno, line in enumerate(text.splitlines(), start=1):
            stripped = line.strip()
            # 跳过注释行
            if stripped.startswith("#"):
                continue
            for m in CRED_PATTERN.finditer(line):
                value = m.group(4)
                low = value.lower()
                # 跳过占位符/环境变量引用
                if any(tok in low for tok in PLACEHOLDER_TOKENS):
                    continue
                # 跳过纯变量名引用 (如 ${PASSWORD})
                if not value.strip():
                    continue
                hits.append((path, lineno, line.rstrip()))
    return hits


# ---------------------------------------------------------------------------
# 主审计流程
# ---------------------------------------------------------------------------
def audit_route_files():
    """审计 A/B/C: 路由文件扫描 + 注册检查 + stub 检查."""
    route_files = collect_route_files()
    if not route_files:
        add_fail("路由文件扫描", f"未在 {API_V1_DIR} 下找到任何 .py 路由文件")
        return

    add_pass("路由文件扫描", f"共扫描到 {len(route_files)} 个路由 .py 文件")

    router_text = load_router_text()
    if not router_text:
        add_fail("router.py", "router.py 不存在或为空, 无法校验模块注册")
    else:
        add_pass("router.py", "router.py 已加载, 开始校验模块注册情况")

    unregistered = []
    stubs = []
    for path in route_files:
        # 模块名 = 文件名去扩展名 (用于注册检查); 同时也用父目录名做候选
        module_name = path.stem
        parent_name = path.parent.name if path.parent != API_V1_DIR else ""
        candidates = [module_name]
        if parent_name and parent_name != module_name:
            candidates.append(parent_name)

        # B. 注册检查 (任一候选命中即视为已注册)
        if router_text:
            registered = any(is_module_registered(router_text, c) for c in candidates)
            if not registered:
                unregistered.append(str(path.relative_to(API_V1_DIR)))

        # C. stub 检查
        is_stub, n = is_stub_file(path)
        if is_stub:
            stubs.append((str(path.relative_to(API_V1_DIR)), n))

    # B. 汇总
    if not router_text:
        pass  # 已在上方记录 FAIL
    elif unregistered:
        sample = unregistered[:5]
        add_warn(
            "模块注册检查",
            f"{len(unregistered)} 个文件未在 router.py 中显式注册 (可能为内部子路由/按需加载): "
            + ", ".join(sample)
            + (" ..." if len(unregistered) > 5 else ""),
        )
    else:
        add_pass("模块注册检查", "所有路由文件均已在 router.py 中注册")

    # C. 汇总
    if stubs:
        sample = stubs[:5]
        add_warn(
            "Stub 文件检查",
            f"{len(stubs)} 个文件疑似 stub (有效代码 < {STUB_MIN_LINES} 行): "
            + ", ".join(s[0] for s in sample)
            + (" ..." if len(stubs) > 5 else ""),
        )
    else:
        add_pass("Stub 文件检查", f"未发现 stub 路由文件 (所有文件有效代码 >= {STUB_MIN_LINES} 行)")


def audit_credentials():
    """审计 D: 明文凭证检查."""
    hits = scan_plaintext_credentials()
    real_hits = [h for h in hits if not is_test_file(h[0])]
    test_hits = [h for h in hits if is_test_file(h[0])]

    if real_hits:
        sample = real_hits[:5]
        detail = "; ".join(f"{p.relative_to(SERVER_DIR)}:{ln}" for p, ln, _ in sample)
        add_fail(
            "明文凭证检查",
            f"发现 {len(real_hits)} 处疑似明文凭证: {detail}"
            + (" ..." if len(real_hits) > 5 else ""),
        )
    else:
        add_pass("明文凭证检查", "未发现明显的明文凭证 (已排除注释/占位符/.env.example)")

    if test_hits:
        add_warn(
            "测试代码凭证",
            f"测试文件中发现 {len(test_hits)} 处凭证字面量 (通常为测试用例, 建议确认)",
        )


def main():
    print("=" * 70)
    print("  后端静态审计 (backend_audit)")
    print(f"  审计目录: {SERVER_DIR}")
    print("=" * 70)
    print()

    if not SERVER_DIR.exists():
        print(f"[FAIL] 后端目录不存在: {SERVER_DIR}")
        return 1

    audit_route_files()
    audit_credentials()

    # 输出明细
    print("-" * 70)
    print("  审计明细")
    print("-" * 70)
    for level, category, msg in findings:
        icon = {"PASS": "[PASS]", "WARN": "[WARN]", "FAIL": "[FAIL]"}[level]
        print(f"  {icon} {category} — {msg}")

    print()
    print("=" * 70)
    print(
        f"  汇总: PASS={stats['pass']}  WARN={stats['warn']}  FAIL={stats['fail']}"
    )
    print("=" * 70)

    if stats["fail"] > 0:
        print(f"  ❌ 审计发现 {stats['fail']} 项 FAIL, 请处理")
        return 1
    elif stats["warn"] > 0:
        print(f"  ⚠️  审计通过, 但有 {stats['warn']} 项 WARN 需关注")
        return 0
    else:
        print("  ✅ 后端静态审计全部通过")
        return 0


if __name__ == "__main__":
    sys.exit(main())
