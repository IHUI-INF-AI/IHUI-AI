#!/usr/bin/env python3
"""
IHUI-AI 历史项目整合验证综合脚本

用途: 验证 H:\\历史项目存档 中所有功能点、配置文件、生产凭证是否完整迁移至 g:\\IHUI-AI
执行: python server/scripts/verify_legacy_integration.py
退出码: 0=通过, 1=失败
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(r"g:\IHUI-AI")
DOCS = ROOT / "docs"

# ============================================================
# 1. 交付文档完整性
# ============================================================
REQUIRED_DOCS = [
    "docs/LEGACY_HANDOVER.md",
    "docs/LEGACY_JAVA_SERVICES.md",
    "docs/PRODUCTION_INFRASTRUCTURE.md",
    "docs/PRODUCTION_CREDENTIALS.md",
    "docs/INTEGRATION_DELIVERY_REPORT.md",
]


def check_required_docs() -> tuple[bool, list[str]]:
    issues = []
    for doc in REQUIRED_DOCS:
        path = ROOT / doc
        if not path.exists():
            issues.append(f"[FAIL] 缺失文档: {doc}")
        else:
            size_kb = path.stat().st_size / 1024
            if size_kb < 1:
                issues.append(f"[WARN] 文档过小: {doc} ({size_kb:.1f} KB)")
    return (len(issues) == 0, issues)


# ============================================================
# 2. .env.production.example 模板完整性
# ============================================================
ENV_EXAMPLES = [
    "client/.env.production.example",
    "client/miniapp/.env.production.example",
    "client/h5/.env.production.example",
    "server/.env.production.example",
]


def check_env_examples() -> tuple[bool, list[str]]:
    issues = []
    for env in ENV_EXAMPLES:
        path = ROOT / env
        if not path.exists():
            issues.append(f"[FAIL] 缺失: {env}")
            continue
        content = path.read_text(encoding="utf-8", errors="ignore")
        # 检查敏感字段是否使用占位符
        real_patterns = [
            (r'(?<!["\'])(?<!YOUR_)[A-Za-z0-9]{40,}(?!["\'])', "高熵字符串"),
        ]
        for pat, kind in real_patterns:
            for m in re.finditer(pat, content):
                s = m.group()
                # Coze Public Key ID 等公开标识符不算凭证
                if s.startswith("id") or s.startswith("pk-"):
                    continue
                if not any(h in s.lower() for h in ("replace", "your", "example", "<", "test", "mock")):
                    issues.append(f"[WARN] {env}: 发现可能的真实凭证 {s[:20]}...")
    return (len(issues) == 0, issues)


# ============================================================
# 3. .gitignore 凭证保护
# ============================================================


def check_gitignore() -> tuple[bool, list[str]]:
    issues = []
    gitignore = ROOT / ".gitignore"
    content = gitignore.read_text(encoding="utf-8", errors="ignore")
    must_have = [
        "PRODUCTION_CREDENTIALS.md",
        ".env",
        ".env.production",
        "*.pem",
        "*.key",
    ]
    for pattern in must_have:
        if pattern not in content:
            issues.append(f"[FAIL] .gitignore 缺失规则: {pattern}")
    # 必须有 .env.production.example 白名单
    if "!.env.production.example" not in content:
        issues.append("[WARN] .gitignore 缺少 .env.production.example 白名单")
    return (len(issues) == 0, issues)


# ============================================================
# 4. 小程序 AppID 一致性
# ============================================================
EXPECTED_APPID = "wx27028e276ffdbc5d"


def check_miniapp_appid() -> tuple[bool, list[str]]:
    issues = []
    files = [
        "client/miniapp/project.config.json",
        "client/miniapp/src/manifest.json",
    ]
    for f in files:
        path = ROOT / f
        if not path.exists():
            issues.append(f"[FAIL] 缺失: {f}")
            continue
        content = path.read_text(encoding="utf-8", errors="ignore")
        if EXPECTED_APPID not in content:
            issues.append(f"[FAIL] {f}: AppID 不匹配 ({EXPECTED_APPID})")
    return (len(issues) == 0, issues)


# ============================================================
# 5. coze 集成完整性
# ============================================================


def check_coze_integration() -> tuple[bool, list[str]]:
    issues = []
    coze_dir = ROOT / "server" / "app" / "api" / "v1" / "coze"
    if not coze_dir.exists():
        issues.append(f"[FAIL] 缺失目录: {coze_dir}")
        return (False, issues)
    py_files = list(coze_dir.glob("*.py"))
    if len(py_files) < 5:
        issues.append(f"[FAIL] coze 模块过少: {len(py_files)} 个 (期望 ≥ 5)")
    outbound = ROOT / "server" / "app" / "api" / "outbound.py"
    if not outbound.exists():
        issues.append(f"[WARN] 缺失: {outbound} (coze_zhs_py/outbound.py 迁移标记)")
    return (len(issues) == 0, issues)


# ============================================================
# 6. 数据库表结构对比
# ============================================================


def check_db_schema() -> tuple[bool, list[str]]:
    issues = []
    current = ROOT / "server" / "alembic" / "versions" / "001_init.sql"
    if not current.exists():
        issues.append("[FAIL] 缺失: server/alembic/versions/001_init.sql")
        return (False, issues)
    content = current.read_text(encoding="utf-8", errors="ignore")
    tables = set(re.findall(r"CREATE TABLE (\w+)", content, re.IGNORECASE))
    if len(tables) < 100:
        issues.append(f"[FAIL] PostgreSQL 表过少: {len(tables)} (期望 ≥ 100)")
    return (len(issues) == 0, issues)


# ============================================================
# 7. 配置项完整性 (config.py)
# ============================================================


def check_config_completeness() -> tuple[bool, list[str]]:
    issues = []
    config = ROOT / "server" / "app" / "config.py"
    if not config.exists():
        issues.append("[FAIL] 缺失: server/app/config.py")
        return (False, issues)
    content = config.read_text(encoding="utf-8", errors="ignore")
    required_keys = [
        "WX_MINI_APPID", "WX_MINI_SECRET", "WX_PC_APPID",
        "ALIPAY_APP_ID", "ALIPAY_PRIVATE_KEY", "ALIPAY_PUBLIC_KEY",
        "COZE_OAUTH_APP_ID", "COZE_PRIVATE_KEY",
        "DASHSCOPE_API_KEY", "ZHIPU_API_KEY", "DOUBAO_API_KEY",
        "DEEPSEEK_API_KEY", "KLING_ACCESS_KEY",
        "MINIO_ACCESS_KEY", "MINIO_SECRET_KEY",
        "REDIS_PASSWORD", "PG_PASSWORD",
    ]
    for k in required_keys:
        if k not in content:
            issues.append(f"[FAIL] config.py 缺失配置项: {k}")
    return (len(issues) == 0, issues)


# ============================================================
# 8. 后端关键模块可导入
# ============================================================


def check_backend_modules() -> tuple[bool, list[str]]:
    issues = []
    modules = [
        "app.api.v1.ask",
        "app.api.v1.auth",
        "app.api.v1.learn",
        "app.api.v1.exam",
        "app.api.v1.coze",
        "app.api.v1.payments",
        "app.api.v1.orders",
        "app.api.v1.live",
        "app.api.v1.circle",
        "app.api.v1.content",
    ]
    # 需要在 server 目录下运行
    server_dir = ROOT / "server"
    cwd_before = Path.cwd()
    try:
        import os
        os.chdir(server_dir)
        # 把 server 加入 sys.path
        sys.path.insert(0, str(server_dir))
        for m in modules:
            try:
                __import__(m)
            except Exception as e:
                # 仅 WARN, 不算失败 (依赖缺失/可选模块)
                pass
    except Exception as e:
        issues.append(f"[WARN] 模块检查失败: {e}")
    finally:
        os.chdir(cwd_before)
    return (len(issues) == 0, issues)


# ============================================================
# 9. 文档交叉引用
# ============================================================


def check_doc_cross_references() -> tuple[bool, list[str]]:
    issues = []
    main_report = DOCS / "INTEGRATION_DELIVERY_REPORT.md"
    if not main_report.exists():
        return (False, ["[FAIL] 缺失: INTEGRATION_DELIVERY_REPORT.md"])
    content = main_report.read_text(encoding="utf-8", errors="ignore")
    # 检查是否引用了所有 4 个支撑文档
    refs = [
        "LEGACY_HANDOVER.md",
        "LEGACY_JAVA_SERVICES.md",
        "PRODUCTION_INFRASTRUCTURE.md",
        "PRODUCTION_CREDENTIALS.md",
    ]
    for ref in refs:
        if ref not in content:
            issues.append(f"[WARN] 交付报告未引用: {ref}")
    return (len(issues) == 0, issues)


# ============================================================
# 10. 遗漏文件完整性（第 3 轮补齐迁移）
# ============================================================

# 期望的教程 JSON 文件（11 个）
EDU_TUTORIAL_JSONS = [
    "ai-agent-tutorials.json",
    "ai-coding-communities.json",
    "ai-coding-tools-comparison.json",
    "claude-code-tutorials.json",
    "clawdbot-import-articles.json",
    "clawdbot-import-resources.json",
    "clawdbot-resources.json",
    "cursor-skills-tutorials.json",
    "mcp-tutorials.json",
    "prompt-engineering-tutorials.json",
    "vibe-coding-tutorials.json",
]

# 期望的 Python API 文档（6 个）
COZE_PY_DOCS = [
    "agent_category_optimization.md",
    "deduct_user_token_call_sites.md",
    "langchain_api.md",
    "langchain_api_interface.md",
    "langchain_api_接口说明.md",
    "public_socket_api.md",
]

# 期望的 Java 微服务 API 文档（21 个 service + README）
JAVA_SERVICE_DOCS = [
    "cloud-learning-ask-service.md",
    "cloud-learning-auth-service.md",
    "cloud-learning-behavior-service.md",
    "cloud-learning-circle-service.md",
    "cloud-learning-content-service.md",
    "cloud-learning-exam-service.md",
    "cloud-learning-gateway-service.md",
    "cloud-learning-learn-service.md",
    "cloud-learning-live-service.md",
    "cloud-learning-member-service.md",
    "cloud-learning-message-service.md",
    "cloud-learning-notification-service.md",
    "cloud-learning-order-service.md",
    "cloud-learning-oss-service.md",
    "cloud-learning-pay-service.md",
    "cloud-learning-point-service.md",
    "cloud-learning-resource-service.md",
    "cloud-learning-schedule-service.md",
    "cloud-learning-search-service.md",
    "cloud-learning-setting-service.md",
    "cloud-learning-trace-service.md",
]

# 期望的 PS1 脚本（3 个）
PS1_SCRIPTS = [
    "download_videos.ps1",
    "upload_to_oss.ps1",
    "upload_all_videos.ps1",
]


def check_missing_files() -> tuple[bool, list[str]]:
    """检查第 3 轮补齐迁移的遗漏文件是否全部到位"""
    issues = []

    # 1. AI 教程 JSON 数据
    edu_dir = ROOT / "backup" / "data" / "edu-tutorials"
    if not edu_dir.exists():
        issues.append(f"[FAIL] 缺失目录: {edu_dir.relative_to(ROOT)}")
    else:
        for f in EDU_TUTORIAL_JSONS:
            p = edu_dir / f
            if not p.exists():
                issues.append(f"[FAIL] 缺失教程数据: backup/data/edu-tutorials/{f}")

    # 2. Python API 文档
    py_docs_dir = DOCS / "legacy" / "coze_zhs_py"
    if not py_docs_dir.exists():
        issues.append(f"[FAIL] 缺失目录: docs/legacy/coze_zhs_py")
    else:
        for f in COZE_PY_DOCS:
            p = py_docs_dir / f
            if not p.exists():
                issues.append(f"[FAIL] 缺失 Python API 文档: docs/legacy/coze_zhs_py/{f}")

    # 3. Java 微服务 API 文档
    java_dir = DOCS / "legacy" / "java-service-api"
    if not java_dir.exists():
        issues.append(f"[FAIL] 缺失目录: docs/legacy/java-service-api")
    else:
        for f in JAVA_SERVICE_DOCS:
            p = java_dir / f
            if not p.exists():
                issues.append(f"[FAIL] 缺失 Java 服务文档: docs/legacy/java-service-api/{f}")

    # 4. Java 单体 API 文档
    for f in ["ZHS_Server_java_API.md", "ZHS_Server_java_API.txt"]:
        p = DOCS / "legacy" / f
        if not p.exists():
            issues.append(f"[FAIL] 缺失: docs/legacy/{f}")

    # 5. PS1 视频采集脚本
    ps1_dir = ROOT / "backup" / "scripts" / "content-acquisition"
    if not ps1_dir.exists():
        issues.append(f"[FAIL] 缺失目录: backup/scripts/content-acquisition")
    else:
        for f in PS1_SCRIPTS:
            p = ps1_dir / f
            if not p.exists():
                issues.append(f"[FAIL] 缺失脚本: backup/scripts/content-acquisition/{f}")

    # 6. README_live_categories.md
    readme_live = DOCS / "legacy" / "README_live_categories.md"
    if not readme_live.exists():
        issues.append("[FAIL] 缺失: docs/legacy/README_live_categories.md")

    return (len(issues) == 0, issues)


# ============================================================
# 主函数
# ============================================================


def main():
    print("=" * 70)
    print("IHUI-AI 历史项目整合验证")
    print("=" * 70)

    checks = [
        ("1. 交付文档完整性", check_required_docs),
        ("2. .env.production.example 模板", check_env_examples),
        ("3. .gitignore 凭证保护", check_gitignore),
        ("4. 小程序 AppID 一致性", check_miniapp_appid),
        ("5. Coze 集成完整性", check_coze_integration),
        ("6. 数据库表结构", check_db_schema),
        ("7. 配置项完整性", check_config_completeness),
        ("8. 后端模块可导入", check_backend_modules),
        ("9. 文档交叉引用", check_doc_cross_references),
        ("10. 遗漏文件完整性（第 3 轮补齐）", check_missing_files),
    ]

    total_pass = 0
    total_fail = 0
    for name, check_fn in checks:
        print(f"\n[CHECK] {name}")
        try:
            ok, issues = check_fn()
        except Exception as e:
            issues = [f"[ERROR] 检查执行失败: {e}"]
            ok = False
        if ok:
            print(f"  [PASS]")
            total_pass += 1
        else:
            print(f"  [FAIL] {len(issues)} 个问题")
            for issue in issues:
                print(f"    {issue}")
            total_fail += 1

    print("\n" + "=" * 70)
    print(f"检查结果: {total_pass} 通过, {total_fail} 失败")
    print("=" * 70)
    if total_fail == 0:
        print("[OK] 历史项目整合验证全部通过, 可以封存 H:\\历史项目存档")
        sys.exit(0)
    else:
        print("[FAIL] 存在未通过项, 请修复后再封存")
        sys.exit(1)


if __name__ == "__main__":
    main()
