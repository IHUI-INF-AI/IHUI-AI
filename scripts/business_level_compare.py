#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""按业务模块级语义对比: Java Controller 业务 -> Python 业务模块"""
import os
import re
import json
from pathlib import Path
from collections import defaultdict

H_DRIVE = Path(r"H:\历史项目存档\code\edu\service\service")
G_DRIVE_API = Path(r"G:\IHUI-AI\server\app\api")

# ============ 收集 Java Controller 端点（按业务） ============
services = sorted([d.name for d in H_DRIVE.iterdir() if d.is_dir() and d.name.startswith("ihui-ai-edu-")])

# Java 22 微服务 -> Python 业务模块映射
SERVICE_TO_PY_DOMAIN = {
    "ihui-ai-edu-ask-service": "ask",
    "ihui-ai-edu-auth-service": "auth",
    "ihui-ai-edu-behavior-service": "behavior",
    "ihui-ai-edu-circle-service": "circle",
    "ihui-ai-edu-content-service": "content",
    "ihui-ai-edu-exam-service": "exam",
    "ihui-ai-edu-gateway-service": "gateway",
    "ihui-ai-edu-learn-service": "learn",
    "ihui-ai-edu-live-service": "live",
    "ihui-ai-edu-member-service": "member",
    "ihui-ai-edu-message-service": "message",
    "ihui-ai-edu-notification-service": "notification",
    "ihui-ai-edu-order-service": "order",
    "ihui-ai-edu-oss-service": "oss",
    "ihui-ai-edu-pay-service": "pay",
    "ihui-ai-edu-point-service": "point",
    "ihui-ai-edu-resource-service": "resource",
    "ihui-ai-edu-schedule-service": "schedule",
    "ihui-ai-edu-search-service": "search",
    "ihui-ai-edu-setting-service": "setting",
    "ihui-ai-edu-usercenter-service": "usercenter",
    "ihui-ai-edu-visit-tracking-service": "visit",
}

# Controller 名 -> Python 业务子模块 (按业务功能)
CTRL_TO_PY_SUBMODULE = {
    "AnswerController": "answer", "QuestionController": "question",
    "CategoryController": "category", "AskStatisticsController": "statistics",
    "AuthorityController": "rbac", "RoleController": "rbac",
    "KeyPairController": "keypair", "SsoController": "sso",
    "AuthController": "auth", "CaptchaController": "captcha",
    "CommentController": "comment", "FavoriteController": "favorite",
    "LikeController": "like", "WordController": "word", "WatchController": "watch",
    "CircleController": "circles", "DynamicController": "dynamic",
    "CircleMemberController": "member", "CircleStatisticsController": "statistics",
    "ArticleController": "article", "NewsController": "news",
    "ContentStatisticsController": "statistics",
    "ExamController": "exam", "ExamChapterController": "chapter",
    "ExamChapterSectionController": "section", "PaperController": "paper",
    "PaperCategoryController": "paper_category", "PaperQuestionController": "paper_question",
    "QuestionController": "question", "QuestionCategoryController": "question_category",
    "RecordController": "record", "SignUpController": "signup",
    "WrongQuestionController": "wrong", "ExamStatisticsController": "statistics",
    "LessonController": "lesson", "LessonChapterController": "lesson_chapter",
    "LessonChapterSectionController": "lesson_section", "LearnMapController": "learn_map",
    "LessonAccessController": "lesson_access", "LessonOrderController": "lesson_order",
    "LessonTaskController": "lesson_task", "HomeworkController": "homework",
    "HomeworkRecordController": "homework_record", "ExamPaperRecordController": "exam_paper_record",
    "RateController": "rate", "ReportController": "report",
    "CertificateController": "certificate", "CertificateTemplateController": "certificate_template",
    "TopicController": "topic", "TopicCategoryController": "topic_category",
    "StatisticsController": "statistics",
    "ChannelController": "channel", "SubscribeController": "subscribe",
    "TencentCloudLiveNotifyController": "tencent_live", "TencentCloudLiveStreamController": "tencent_live",
    "LiveStatisticsController": "statistics",
    "MemberController": "member", "MemberCompanyController": "company",
    "MemberCompanyTypeController": "company_type", "MemberLevelController": "level",
    "MemberGroupController": "group", "MemberPostController": "post",
    "MemberTagController": "tag", "CheckInController": "checkin",
    "FollowController": "follow",
    "AnnouncementController": "announcement", "NoticeController": "notice",
    "PrivateLetterController": "letter", "TemplateController": "template",
    "MessageStatisticsController": "statistics",
    "MailController": "mail", "SmsController": "sms",
    "OrderController": "order", "InvoiceApplicationController": "invoice",
    "InvoiceTitleController": "invoice_title",
    "OssController": "upload",
    "TradeController": "trade", "AliPayNotifyController": "alipay",
    "WechatpayNotifyController": "wechat",
    "PointController": "point", "PointChannelRelationController": "relation",
    "PointStatisticsController": "statistics",
    "ResourceController": "resource", "ResourceProductController": "product",
    "ResourceTagController": "tag", "ResourceStatisticsController": "statistics",
    "ContentController": "content", "HotWordController": "hotword",
    "SearchRecordController": "record",
    "AgreementController": "agreement", "CarouselController": "carousel",
    "UserController": "user", "PostController": "post",
    "DepartmentController": "dept", "CompanyController": "company",
    "LecturerController": "lecturer", "DingTalkController": "dingtalk",
    "WorkWeChatController": "enterprise_wechat", "WechatOauthController": "wechat",
    "UserCenterStatisticsController": "statistics",
    "VisitLogController": "visit",
}

# ============ 收集 Java 端点（按业务域 + 控制器） ============
java_business_map = defaultdict(lambda: defaultdict(int))  # service -> controller -> endpoint_count
java_endpoint_details = defaultdict(list)  # (service, controller) -> list of endpoints
total_java_endpoints = 0

for svc in services:
    java_path = H_DRIVE / svc / "src" / "main" / "java"
    if not java_path.exists():
        continue
    for f in java_path.rglob("*.java"):
        if "controller" not in str(f).lower():
            continue
        if f.name in ("BaseController.java", "RestControllerAdvice.java"):
            continue
        content = f.read_text(encoding="utf-8", errors="ignore")
        # 提取类级 prefix
        class_prefix = ""
        for pat in [
            r'@RequestMapping\s*\(\s*value\s*=\s*"([^"]+)"',
            r'@RequestMapping\s*\(\s*"([^"]+)"',
        ]:
            m = re.search(pat, content)
            if m:
                class_prefix = m.group(1)
                break
        # 提取所有方法
        all_methods = re.findall(
            r'@(Get|Post|Put|Delete)Mapping[^)]*?["\']([^"\']+)["\']',
            content
        )
        if not all_methods:
            all_methods = re.findall(r'@(Get|Post|Put|Delete)Mapping\s*\(\s*\)', content)
            all_methods = [(m, "") for m in all_methods]
        # 去重
        seen = set()
        for http, path in all_methods:
            full = (class_prefix + path).rstrip("/") if path else class_prefix.rstrip("/")
            key = (http, full)
            if key in seen:
                continue
            seen.add(key)
            java_business_map[svc][f.stem] += 1
            java_endpoint_details[(svc, f.stem)].append({"http": http, "path": full})
            total_java_endpoints += 1

# ============ 收集 Python 端点（按业务模块） ============
python_modules = defaultdict(int)  # file -> endpoint count
python_by_keyword = defaultdict(int)  # keyword in path -> count
all_python_endpoints = []

for py_file in G_DRIVE_API.rglob("*.py"):
    if py_file.name == "__init__.py" or "__pycache__" in str(py_file):
        continue
    try:
        content = py_file.read_text(encoding="utf-8")
    except:
        continue
    rel = str(py_file.relative_to(G_DRIVE_API)).replace("\\", "/")
    # 提取 @router.X 路径
    patterns = [
        r'@router\.(get|post|put|delete)\s*\(\s*["\']([^"\']+)["\']',
        r'@router\.(get|post|put|delete)\s*\(\s*path\s*=\s*["\']([^"\']+)["\']',
    ]
    found = set()
    for pat in patterns:
        for m in re.finditer(pat, content):
            http = m.group(1).upper()
            path = m.group(2)
            key = (http, path)
            if key in found:
                continue
            found.add(key)
            python_modules[rel] += 1
            all_python_endpoints.append({"file": rel, "http": http, "path": path})

# ============ 业务模块对比 ============
# Java 业务域 -> Python 业务域 文件
PY_DOMAIN_FILES = {
    "ask": ["v1/ask", "v1/edu/ask"],
    "auth": ["v1/auth", "v1/rbac", "v1/edu/auth"],
    "behavior": ["v1/behavior", "v1/edu/behavior"],
    "circle": ["v1/circle", "v1/edu/circle"],
    "content": ["v1/content", "v1/edu/content"],
    "exam": ["v1/exam", "v1/edu/exam"],
    "learn": ["v1/learn", "v1/edu/learn"],
    "live": ["v1/live", "v1/edu/live"],
    "member": ["v1/member", "v1/edu/member"],
    "message": ["v1/message", "v1/edu/message"],
    "notification": ["v1/notification", "v1/edu/notification"],
    "order": ["v1/orders", "v1/edu/order", "v1/refund"],
    "oss": ["v1/upload", "v1/edu/oss"],
    "pay": ["v1/payments", "v1/edu/pay"],
    "point": ["v1/point", "v1/edu/point"],
    "resource": ["v1/resource", "v1/edu/resource"],
    "schedule": ["v1/schedule", "v1/edu/schedule"],
    "search": ["v1/search", "v1/edu/search"],
    "setting": ["v1/content", "v1/edu/setting"],
    "usercenter": ["v1/user", "v1/system", "v1/edu/user"],
    "visit": ["v1/visit", "v1/edu/visit"],
    "gateway": ["v1/auth", "v1/system"],
}

def find_python_files_for_domain(domain):
    """查找该域下的 Python 端点文件"""
    candidates = PY_DOMAIN_FILES.get(domain, [])
    matched_files = []
    for file_path, count in python_modules.items():
        for c in candidates:
            if c in file_path:
                matched_files.append((file_path, count))
                break
    return matched_files

# ============ 输出对比报告 ============
print("=" * 100)
print("【Java 22 个微服务 vs Python 业务模块 端点对比】")
print("=" * 100)
print(f"{'Java 微服务':<40} {'端点数':<8} {'Python 业务模块':<50} {'端点数':<8}")
print("-" * 120)

total_java = 0
total_py_for_domains = 0
domain_results = {}

for svc in services:
    py_domain = SERVICE_TO_PY_DOMAIN.get(svc, "?")
    java_total = sum(java_business_map[svc].values())
    py_files = find_python_files_for_domain(py_domain)
    py_total = sum(c for _, c in py_files)

    total_java += java_total
    total_py_for_domains += py_total

    py_files_str = ', '.join([f"{f.replace('v1/','')}({c})" for f, c in py_files[:5]])
    if len(py_files) > 5:
        py_files_str += f" +{len(py_files)-5}个"

    print(f"{svc:<40} {java_total:<8} {py_domain + ':' + py_files_str:<50} {py_total:<8}")
    domain_results[svc] = {
        "java": java_total,
        "python": py_total,
        "py_files": [f for f, _ in py_files],
    }

print("-" * 120)
print(f"{'合计':<40} {total_java:<8} {'':<50} {total_py_for_domains:<8}")
print()
print(f"覆盖度（按业务域聚合）: {total_py_for_domains} / {total_java} = {total_py_for_domains*100/total_java:.1f}%")
print()

# ============ 按 Controller 详细对比 ============
print("=" * 100)
print("【按 Controller 详细对比】")
print("=" * 100)

controller_match = []
for svc in services:
    py_domain = SERVICE_TO_PY_DOMAIN.get(svc, "?")
    py_files = find_python_files_for_domain(py_domain)
    py_paths = set()
    for f, _ in py_files:
        for ep in all_python_endpoints:
            if ep["file"] == f:
                py_paths.add((ep["http"], ep["path"]))

    for ctrl, java_count in java_business_map[svc].items():
        py_submodule = CTRL_TO_PY_SUBMODULE.get(ctrl, "?")
        # 在 py_paths 中查找与 ctrl 相关的端点
        # 方法: 提取 ctrl 的关键词 (去除 Controller 后缀)
        keyword = ctrl.replace("Controller", "").lower()
        # 查找含 keyword 的路径
        related = [p for p in py_paths if keyword in p[1].lower()]
        controller_match.append({
            "service": svc,
            "controller": ctrl,
            "java_endpoints": java_count,
            "python_related_endpoints": len(related),
            "py_submodule": py_submodule,
            "coverage_pct": f"{len(related)*100/java_count:.0f}%" if java_count else "N/A",
        })

# 按 coverage 排序
controller_match.sort(key=lambda x: -x["java_endpoints"])

for cm in controller_match[:50]:  # 显示前 50
    flag = "✓" if cm["python_related_endpoints"] > 0 else "✗"
    print(f"  {flag} [{cm['service']:35s}] {cm['controller']:35s} Java:{cm['java_endpoints']:3d}  Py:{cm['python_related_endpoints']:3d}  ({cm['coverage_pct']})")

if len(controller_match) > 50:
    print(f"  ... 总 {len(controller_match)} 个 Controller")

# 输出
out = {
    "summary": {
        "java_total": total_java,
        "python_total_in_domains": total_py_for_domains,
        "domain_coverage": f"{total_py_for_domains*100/total_java:.1f}%",
    },
    "by_domain": domain_results,
    "by_controller": controller_match,
}
Path(r"G:\IHUI-AI\docs\archive\business_level_comparison.json").write_text(
    json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8"
)
print(f"\n详细报告写入: G:\\IHUI-AI\\docs\\archive\\business_level_comparison.json")
