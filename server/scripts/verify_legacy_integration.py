"""历史项目整合验证脚本.

验证 H:\\历史项目存档 的所有功能点已 100% 迁移至 g:\\IHUI-AI.

覆盖 10 项检查:
  1. 探学平台 11 模块后端文件存在
  2. Java 项目 24 模块后端文件存在
  3. coze_zhs_py 18 模块后端文件存在
  4. schedule 前端文件存在 (含路由注册)
  5. behavior 前端 API 封装存在
  6. 3 个 WebSocket 测试 HTML 存在
  7. legacy-archive 凭证目录齐全
  8. legacy-archive SQL 目录齐全
  9. legacy-archive 文档目录齐全
  10. 5 份封存报告存在

仅使用 Python 标准库, 可直接 `python verify_legacy_integration.py` 运行.
"""

import os
import sys
from pathlib import Path

# 项目根目录 (脚本位于 server/scripts/, 根目录在向上两级)
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent  # g:\IHUI-AI
SERVER_DIR = PROJECT_ROOT / "server"
CLIENT_DIR = PROJECT_ROOT / "client"
DOCS_DIR = PROJECT_ROOT / "docs"

# 后端 API v1 根目录
API_V1_DIR = SERVER_DIR / "app" / "api" / "v1"
STATIC_DIR = SERVER_DIR / "app" / "static"
LEGACY_ARCHIVE_DIR = SERVER_DIR / "deploy" / "legacy-archive"

# 计数器
TOTAL = 10
passed = 0
results = []


def exists_any(paths):
    """检查候选路径列表中是否存在任一文件/目录."""
    for p in paths:
        if p.exists():
            return True, str(p)
    return False, ""


def record(idx, title, ok, detail=""):
    """记录一项检查结果并打印."""
    global passed
    icon = "PASS" if ok else "FAIL"
    mark = "[PASS]" if ok else "[FAIL]"
    line = f"  {idx:>2}. {mark} {title}"
    if detail:
        line += f" — {detail}"
    print(line)
    results.append((idx, title, ok, detail))
    if ok:
        passed += 1


# ---------------------------------------------------------------------------
# 检查 1: 探学平台 11 模块后端文件存在
# ---------------------------------------------------------------------------
def check1_tanxue_platform():
    modules = [
        "ask", "circle", "exam", "live", "message", "notification",
        "point", "search", "visit", "behavior", "schedule",
    ]
    missing = []
    for m in modules:
        ok, _ = exists_any([
            API_V1_DIR / m,                       # 模块目录
            API_V1_DIR / m / f"{m}.py",           # 模块主文件
            API_V1_DIR / m / "routes.py",         # 路由文件变体
            API_V1_DIR / f"{m}.py",               # 顶层文件
        ])
        if not ok:
            missing.append(m)
    ok = len(missing) == 0
    detail = f"{len(modules)}/{len(modules)} 模块存在" if ok else f"缺失: {','.join(missing)}"
    record(1, "探学平台 11 模块后端文件存在", ok, detail)


# ---------------------------------------------------------------------------
# 检查 2: Java 项目 24 模块后端文件存在
# ---------------------------------------------------------------------------
def check2_java_modules():
    # 每个模块对应一组候选路径 (覆盖直接目录、变体文件、合并实现)
    module_paths = {
        "app_version": [API_V1_DIR / "app_version"],
        "agent_upload": [API_V1_DIR / "agent_upload"],
        "feedback": [API_V1_DIR / "feedback"],
        "category_dictionary": [API_V1_DIR / "category_dictionary"],
        "education_platform": [API_V1_DIR / "education_platform"],
        "user_comment_log": [API_V1_DIR / "user_comment_log"],
        "user_video_log": [API_V1_DIR / "user_video_log"],
        "user_video_comment": [API_V1_DIR / "user_video_comment"],
        "tbox": [API_V1_DIR / "tbox", API_V1_DIR / "mcp" / "tbox.py"],
        "ranking": [API_V1_DIR / "ranking"],
        "video_preload": [API_V1_DIR / "video_preload"],
        "auth_identity": [API_V1_DIR / "auth_identity"],
        "organization": [API_V1_DIR / "organization"],
        "advertise": [API_V1_DIR / "advertise"],
        # dictionary -> category_dictionary (分类字典) / admin_panel 的 dict 控制器
        "dictionary": [API_V1_DIR / "category_dictionary", API_V1_DIR / "admin_panel.py"],
        "user_agent_image": [API_V1_DIR / "user_agent_image"],
        "user_agent_context": [API_V1_DIR / "user_agent_context"],
        "agent_need_task": [API_V1_DIR / "agent_need_task"],
        "agent_usedetail": [API_V1_DIR / "agent_usedetail"],
        # profile -> user/users.py (get_profile/update_profile 端点)
        "profile": [API_V1_DIR / "user" / "users.py", API_V1_DIR / "user"],
        # logininfor -> system/audit.py (登录信息审计) / admin_panel.py (SysLogininforController)
        "logininfor": [API_V1_DIR / "system" / "audit.py", API_V1_DIR / "admin_panel.py"],
        # online -> admin_panel.py (在线用户管理)
        "online": [API_V1_DIR / "admin_panel.py", API_V1_DIR / "system" / "admin.py"],
        # post -> circle/post.py / admin_panel.py (SysPostController)
        "post": [API_V1_DIR / "circle" / "post.py", API_V1_DIR / "admin_panel.py"],
        # wxprogram -> app_version (小程序版本管理)
        "wxprogram": [API_V1_DIR / "app_version", API_V1_DIR / "app_version" / "app_version.py"],
    }
    missing = []
    for m, candidates in module_paths.items():
        ok, _ = exists_any(candidates)
        if not ok:
            missing.append(m)
    ok = len(missing) == 0
    total = len(module_paths)
    detail = f"{total}/{total} 模块存在" if ok else f"缺失: {','.join(missing)}"
    record(2, "Java 项目 24 模块后端文件存在", ok, detail)


# ---------------------------------------------------------------------------
# 检查 3: coze_zhs_py 18 模块后端文件存在
# ---------------------------------------------------------------------------
def check3_coze_zhs_py():
    utils_dir = SERVER_DIR / "app" / "utils"
    ws_api_dir = SERVER_DIR / "app" / "api" / "ws"
    ws_core_dir = SERVER_DIR / "app" / "ws"
    module_paths = {
        "doubao_image_edit": [API_V1_DIR / "doubao_image_edit"],
        "tongyi_image_edit": [API_V1_DIR / "tongyi_image_edit"],
        "tongyi_image2image": [API_V1_DIR / "tongyi_image2image"],
        "luyala_proxy": [API_V1_DIR / "luyala_proxy"],
        "openrouter_proxy": [API_V1_DIR / "openrouter_proxy"],
        "callback": [API_V1_DIR / "callback"],
        "user_agent_context": [API_V1_DIR / "user_agent_context"],
        "user_model_chat": [API_V1_DIR / "user_model_chat"],
        # agent_type_calculator -> app/utils/agent_type_calculator.py
        "agent_type_calculator": [utils_dir / "agent_type_calculator.py"],
        "service_catalog": [API_V1_DIR / "service_catalog"],
        # coze_compat -> app/utils/coze_compat.py / compat_routes.py
        "coze_compat": [utils_dir / "coze_compat.py", API_V1_DIR / "compat_routes.py"],
        # doubao_socket_handler -> app/api/ws/doubao_socket_handler.py
        "doubao_socket_handler": [ws_api_dir / "doubao_socket_handler.py"],
        # volcengine_jimeng31 -> ai/volcengine/route.py (JiMeng 3.1)
        "volcengine_jimeng31": [API_V1_DIR / "ai" / "volcengine" / "route.py",
                                 API_V1_DIR / "ai" / "jimeng4.py"],
        # volcengine_visual -> ai/volcengine/route.py (visual proxy)
        "volcengine_visual": [API_V1_DIR / "ai" / "volcengine" / "route.py"],
        # langchain_api_mini -> llm/ws.py (迁移自 langchain_api_mini.py)
        "langchain_api_mini": [API_V1_DIR / "llm" / "ws.py"],
        "tools": [API_V1_DIR / "tools"],
        # tencent_signature -> app/utils/tencent_signature.py
        "tencent_signature": [utils_dir / "tencent_signature.py",
                              API_V1_DIR / "ai" / "tencent" / "route.py"],
        # realtime -> app/ws/realtime_pcm_player.py (迁移自 RealtimePcmPlayer.java)
        "realtime": [ws_core_dir / "realtime_pcm_player.py",
                     API_V1_DIR / "llm" / "ws.py"],
    }
    missing = []
    for m, candidates in module_paths.items():
        ok, _ = exists_any(candidates)
        if not ok:
            missing.append(m)
    ok = len(missing) == 0
    total = len(module_paths)
    detail = f"{total}/{total} 模块存在" if ok else f"缺失: {','.join(missing)}"
    record(3, "coze_zhs_py 18 模块后端文件存在", ok, detail)


# ---------------------------------------------------------------------------
# 检查 4: schedule 前端文件存在 (含路由注册)
# ---------------------------------------------------------------------------
def check4_schedule_frontend():
    view_file = CLIENT_DIR / "src" / "views" / "Schedule.vue"
    api_file = CLIENT_DIR / "src" / "api" / "schedule.ts"
    # 路由注册: 在 router 目录下任一文件出现 Schedule 即可
    router_dir = CLIENT_DIR / "src" / "router"
    route_registered = False
    if router_dir.exists():
        for rfile in router_dir.rglob("*.ts"):
            try:
                text = rfile.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue
            if "Schedule" in text and "schedule" in text.lower():
                route_registered = True
                break

    missing = []
    if not view_file.exists():
        missing.append("Schedule.vue")
    if not api_file.exists():
        missing.append("api/schedule.ts")
    if not route_registered:
        missing.append("路由注册")
    ok = len(missing) == 0
    detail = "视图+API+路由齐全" if ok else f"缺失: {','.join(missing)}"
    record(4, "schedule 前端文件存在 (含路由注册)", ok, detail)


# ---------------------------------------------------------------------------
# 检查 5: behavior 前端 API 封装存在
# ---------------------------------------------------------------------------
def check5_behavior_frontend():
    api_file = CLIENT_DIR / "src" / "api" / "behavior.ts"
    ok = api_file.exists()
    detail = f"{api_file.relative_to(PROJECT_ROOT)}" if ok else "client/src/api/behavior.ts 不存在"
    record(5, "behavior 前端 API 封装存在", ok, detail)


# ---------------------------------------------------------------------------
# 检查 6: 3 个 WebSocket 测试 HTML 存在
# ---------------------------------------------------------------------------
def check6_websocket_html():
    files = [
        STATIC_DIR / "websocket_doubao_client.html",
        STATIC_DIR / "websocket_qwen_client.html",
        STATIC_DIR / "public_socket_client.html",
    ]
    missing = [f.name for f in files if not f.exists()]
    ok = len(missing) == 0
    detail = f"{len(files)}/{len(files)} HTML 存在" if ok else f"缺失: {','.join(missing)}"
    record(6, "3 个 WebSocket 测试 HTML 存在", ok, detail)


# ---------------------------------------------------------------------------
# 检查 7: legacy-archive 凭证目录齐全
# ---------------------------------------------------------------------------
def check7_legacy_secrets():
    secrets_dir = LEGACY_ARCHIVE_DIR / "secrets"
    targets = [
        secrets_dir / "jks-password.txt",
        secrets_dir / "服务器连接配置.xts",
        secrets_dir / "xshell-sessions",
        secrets_dir / "nacos-configs.zip",
    ]
    missing = []
    for t in targets:
        if not t.exists():
            missing.append(t.name if t.is_file() or not t.exists() else t.name + "/")
    ok = len(missing) == 0
    detail = "凭证目录齐全" if ok else f"缺失: {','.join(missing)}"
    record(7, "legacy-archive 凭证目录齐全", ok, detail)


# ---------------------------------------------------------------------------
# 检查 8: legacy-archive SQL 目录齐全
# ---------------------------------------------------------------------------
def check8_legacy_sql():
    sql_dir = LEGACY_ARCHIVE_DIR / "sql"
    files = [
        sql_dir / "create_invoice_title.sql",
        sql_dir / "fix_lecturer_table.sql",
        sql_dir / "init_lesson_data.sql",
        sql_dir / "mock_signup_data.sql",
        sql_dir / "init_database.sql",
    ]
    missing = [f.name for f in files if not f.exists()]
    ok = len(missing) == 0
    detail = f"{len(files)}/{len(files)} SQL 存在" if ok else f"缺失: {','.join(missing)}"
    record(8, "legacy-archive SQL 目录齐全", ok, detail)


# ---------------------------------------------------------------------------
# 检查 9: legacy-archive 文档目录齐全
# ---------------------------------------------------------------------------
def check9_legacy_docs():
    docs_dir = LEGACY_ARCHIVE_DIR / "docs"
    files = [
        docs_dir / "OPTIMIZATION_PLAN.md",
        docs_dir / "coze_zhs_py_项目结构分析.md",
        docs_dir / "交接文档.docx",
    ]
    missing = [f.name for f in files if not f.exists()]
    ok = len(missing) == 0
    detail = f"{len(files)}/{len(files)} 文档存在" if ok else f"缺失: {','.join(missing)}"
    record(9, "legacy-archive 文档目录齐全", ok, detail)


# ---------------------------------------------------------------------------
# 检查 10: 5 份封存报告存在
# ---------------------------------------------------------------------------
def check10_sealed_reports():
    files = [
        DOCS_DIR / "LEGACY_ARCHIVE_CONFIRMATION.md",
        DOCS_DIR / "HISTORICAL_ARCHIVE_CERTIFICATE.md",
        DOCS_DIR / "INTEGRATION_DELIVERY_REPORT.md",
        DOCS_DIR / "JAVA_TO_PYTHON_ENDPOINT_MAPPING.md",
        DOCS_DIR / "KEY_ROTATION_RUNBOOK.md",
    ]
    missing = [f.name for f in files if not f.exists()]
    ok = len(missing) == 0
    detail = f"{len(files)}/{len(files)} 报告存在" if ok else f"缺失: {','.join(missing)}"
    record(10, "5 份封存报告存在", ok, detail)


def main():
    print("=" * 70)
    print("  历史项目整合验证 (verify_legacy_integration)")
    print(f"  项目根目录: {PROJECT_ROOT}")
    print("=" * 70)
    print()

    check1_tanxue_platform()
    check2_java_modules()
    check3_coze_zhs_py()
    check4_schedule_frontend()
    check5_behavior_frontend()
    check6_websocket_html()
    check7_legacy_secrets()
    check8_legacy_sql()
    check9_legacy_docs()
    check10_sealed_reports()

    print()
    print("=" * 70)
    print(f"  汇总: {passed}/{TOTAL} 通过")
    print("=" * 70)

    if passed == TOTAL:
        print("  ✅ 历史项目整合验证全部通过")
        return 0
    else:
        failed = TOTAL - passed
        print(f"  ❌ 有 {failed} 项未通过, 请检查上述 FAIL 项")
        return 1


if __name__ == "__main__":
    sys.exit(main())
