#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""改进版深度比对: 去除 Java 的 auth-api/public-api 前缀, 进行语义匹配"""
import os
import re
import json
from pathlib import Path
from collections import defaultdict

H_DRIVE = Path(r"H:\历史项目存档\code\edu\service\service")
G_DRIVE_API = Path(r"G:\IHUI-AI\server\app\api")

# ============ 收集 Java Controller 端点 ============
services = sorted([d.name for d in H_DRIVE.iterdir() if d.is_dir() and d.name.startswith("ihui-ai-edu-")])

# Java 端点路径去掉前缀
JAVA_PREFIXES_TO_STRIP = ["/auth-api/", "/public-api/", "/api/"]

def normalize_path(path):
    """标准化路径: 去除 /auth-api/ /public-api/ 前缀, 统一 ID 参数"""
    p = path
    for prefix in JAVA_PREFIXES_TO_STRIP:
        if p.startswith(prefix):
            p = p[len(prefix):]
            break
    # 标准化: {id} 等
    p = re.sub(r'/\d+', '/{id}', p)
    return p

def path_similarity(p1, p2):
    """计算两个路径的相似度: 基于最后 2 段路径"""
    s1 = [s for s in p1.split('/') if s]
    s2 = [s for s in p2.split('/') if s]
    if not s1 or not s2:
        return 0
    # 取后 2 段
    tail1 = '/'.join(s1[-2:]) if len(s1) >= 2 else s1[-1]
    tail2 = '/'.join(s2[-2:]) if len(s2) >= 2 else s2[-1]
    return tail1 == tail2

# Controller 名 -> Python 业务模块映射
CONTROLLER_TO_PYTHON = {
    # ask
    "AnswerController": "edu_ask.answer", "QuestionController": "edu_ask.question",
    "CategoryController": "edu_ask.category", "AskStatisticsController": "edu_ask.statistics",
    # auth
    "AuthorityController": "rbac", "RoleController": "rbac", "KeyPairController": "auth.keypair",
    "SsoController": "auth.sso", "AuthController": "auth.login", "CaptchaController": "auth.captcha",
    # behavior
    "CommentController": "behavior.comment", "FavoriteController": "behavior.favorite",
    "LikeController": "behavior.like", "WordController": "behavior.word",
    "WatchController": "behavior.watch",
    # circle
    "CircleController": "circle.circles", "DynamicController": "circle.dynamic",
    "CircleMemberController": "circle.member", "CategoryController": "circle.category",
    "CircleStatisticsController": "circle.statistics",
    # content
    "ArticleController": "content.article", "NewsController": "content.news",
    "ContentStatisticsController": "content.statistics",
    # exam
    "ExamController": "exam.exam", "ExamChapterController": "exam.chapter",
    "ExamChapterSectionController": "exam.section", "PaperController": "exam.paper",
    "PaperCategoryController": "exam.paper_category", "PaperQuestionController": "exam.paper_question",
    "QuestionController": "exam.question", "QuestionCategoryController": "exam.question_category",
    "RecordController": "exam.record", "SignUpController": "exam.signup",
    "WrongQuestionController": "exam.wrong", "ExamStatisticsController": "exam.statistics",
    # learn
    "LessonController": "learn.lesson", "LessonChapterController": "learn.lesson_chapter",
    "LessonChapterSectionController": "learn.lesson_section", "LearnMapController": "learn.learn_map",
    "LessonAccessController": "learn.lesson_access", "LessonOrderController": "learn.lesson_order",
    "LessonTaskController": "learn.lesson_task", "HomeworkController": "learn.homework",
    "HomeworkRecordController": "learn.homework_record", "ExamPaperRecordController": "learn.exam_paper_record",
    "RateController": "learn.rate", "RecordController": "learn.record",
    "ReportController": "learn.report", "SignUpController": "learn.signup",
    "CertificateController": "learn.certificate", "CertificateTemplateController": "learn.certificate_template",
    "TopicController": "learn.topic", "TopicCategoryController": "learn.topic_category",
    "StatisticsController": "learn.statistics", "CategoryController": "learn.category",
    # live
    "ChannelController": "live.channel", "SubscribeController": "live.subscribe",
    "CategoryController": "live.category", "LiveStatisticsController": "live.statistics",
    "TencentCloudLiveNotifyController": "live.tencent", "TencentCloudLiveStreamController": "live.tencent",
    # member
    "MemberController": "member", "MemberCompanyController": "member.company",
    "MemberCompanyTypeController": "member.company_type", "MemberLevelController": "member.level",
    "MemberGroupController": "member.group", "MemberPostController": "member.post",
    "MemberTagController": "member.tag", "CheckInController": "member.checkin",
    "FollowController": "member.follow",
    # message
    "AnnouncementController": "message.announcement", "NoticeController": "message.notice",
    "PrivateLetterController": "message.letter", "TemplateController": "message.template",
    "MessageStatisticsController": "message.statistics",
    # notification
    "MailController": "notification.mail", "SmsController": "notification.sms",
    # order
    "OrderController": "orders", "InvoiceApplicationController": "orders.invoice",
    "InvoiceTitleController": "orders.invoice_title",
    # oss
    "OssController": "upload", "OssController2": "upload",
    # pay
    "TradeController": "payments.fund", "AliPayNotifyController": "payments.alipay",
    "WechatpayNotifyController": "payments.wechat",
    # point
    "PointController": "point", "ChannelController": "point.channel",
    "PointChannelRelationController": "point.relation", "RecordController": "point.record",
    "PointStatisticsController": "point.statistics",
    # resource
    "ResourceController": "resource", "ResourceProductController": "resource.product",
    "ResourceTagController": "resource.tag", "ResourceStatisticsController": "resource.statistics",
    # schedule
    "WatchController": "schedule.watch",
    # search
    "ContentController": "search.content", "HotWordController": "search.hotword",
    "RecordController": "search.record",
    # setting
    "AgreementController": "content.agreement", "CarouselController": "content.carousel",
    # usercenter
    "UserController": "system.user", "PostController": "system.post",
    "DepartmentController": "system.dept", "CompanyController": "system.company",
    "LecturerController": "user.lecturer", "DingTalkController": "auth.dingtalk",
    "WorkWeChatController": "auth.enterprise_wechat", "WechatOauthController": "auth.wechat",
    "UserCenterStatisticsController": "user.statistics",
    # visit
    "VisitLogController": "visit",
}

# Controller 名去重 - 多个服务有同名 Controller 时, 用 (service, controller) 唯一标识
java_endpoints = []  # 全部端点
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

        class_prefix = ""
        for pat in [
            r'@RequestMapping\s*\(\s*value\s*=\s*"([^"]+)"',
            r'@RequestMapping\s*\(\s*"([^"]+)"',
        ]:
            m = re.search(pat, content)
            if m:
                class_prefix = m.group(1)
                break

        all_methods = re.findall(
            r'@(Get|Post|Put|Delete)Mapping[^)]*?["\']([^"\']+)["\']',
            content
        )
        if not all_methods:
            all_methods = re.findall(r'@(Get|Post|Put|Delete)Mapping\s*\(\s*\)', content)
            all_methods = [(m, "") for m in all_methods]

        for http_method, method_path in all_methods:
            full_path = (class_prefix + method_path) if method_path else class_prefix
            full_path = full_path.rstrip("/")
            if not full_path:
                full_path = "/"
            java_endpoints.append({
                "service": svc,
                "controller": f.stem,
                "http": http_method,
                "path": full_path,
                "normalized": normalize_path(full_path),
            })

# ============ 收集 Python 路由端点 ============
python_endpoints = []
for py_file in G_DRIVE_API.rglob("*.py"):
    if py_file.name == "__init__.py" or "__pycache__" in str(py_file):
        continue
    try:
        content = py_file.read_text(encoding="utf-8")
    except:
        continue
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
            python_endpoints.append({
                "file": str(py_file.relative_to(G_DRIVE_API)).replace("\\", "/"),
                "http": http,
                "path": path,
                "normalized": normalize_path(path),
                "tail": '/'.join([s for s in path.split('/') if s][-2:]) if '/' in path else path,
            })

# ============ 智能匹配 ============
# 1) 标准化路径完全匹配
# 2) Tail 匹配 (后2段)
# 3) 控制器名 -> Python 模块 (按业务模块分文件)

py_norm_index = defaultdict(list)  # normalized -> list of (http, file)
py_tail_index = defaultdict(list)  # tail -> list of (http, file)
for ep in python_endpoints:
    py_norm_index[ep["normalized"]].append((ep["http"], ep["file"]))
    py_tail_index[ep["tail"]].append((ep["http"], ep["file"]))

matched_norm = 0
matched_tail = 0
unmatched = []
for jep in java_endpoints:
    http = jep["http"]
    norm = jep["normalized"]
    tail = '/'.join([s for s in norm.split('/') if s][-2:]) if '/' in norm else norm

    # 1) 标准化匹配
    found = False
    for (py_http, py_file) in py_norm_index.get(norm, []):
        if py_http == http:
            found = True
            matched_norm += 1
            break

    if not found:
        # 2) tail 匹配
        for (py_http, py_file) in py_tail_index.get(tail, []):
            if py_http == http:
                found = True
                matched_tail += 1
                break

    if not found:
        unmatched.append(jep)

print("=" * 80)
print("深度比对结果")
print("=" * 80)
print(f"Java 端点总数: {len(java_endpoints)}")
print(f"Python 端点总数: {len(python_endpoints)}")
print(f"标准化完全匹配: {matched_norm}")
print(f"Tail 后缀匹配: {matched_tail}")
print(f"未匹配: {len(unmatched)}")
total_matched = matched_norm + matched_tail
print(f"总匹配率: {total_matched*100/len(java_endpoints):.1f}%")
print()
print("=" * 80)
print("未匹配的 Java 端点 (按服务聚合):")
print("=" * 80)
unmatched_by_svc = defaultdict(list)
for u in unmatched:
    unmatched_by_svc[u["service"]].append(u)
for svc, eps in sorted(unmatched_by_svc.items()):
    print(f"\n[{svc}] 未匹配 {len(eps)} 个端点")
    for u in eps[:8]:
        ctrl_mod = CONTROLLER_TO_PYTHON.get(u["controller"], "?")
        print(f"  {u['http']:6s} {u['path']:45s} 归一化: {u['normalized']:40s} 控制器: {u['controller']:30s} -> Python: {ctrl_mod}")
    if len(eps) > 8:
        print(f"  ... 还有 {len(eps)-8} 个")

# 输出详细
out = {
    "java_total": len(java_endpoints),
    "python_total": len(python_endpoints),
    "matched_norm": matched_norm,
    "matched_tail": matched_tail,
    "unmatched_count": len(unmatched),
    "coverage": f"{total_matched*100/len(java_endpoints):.1f}%",
    "unmatched_details": [
        {
            "service": u["service"],
            "controller": u["controller"],
            "http": u["http"],
            "path": u["path"],
            "normalized": u["normalized"],
            "python_module_hint": CONTROLLER_TO_PYTHON.get(u["controller"], "?"),
        } for u in unmatched
    ]
}
Path(r"G:\IHUI-AI\docs\archive\deep_comparison_v2.json").write_text(
    json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8"
)
print(f"\n详细报告写入: G:\\IHUI-AI\\docs\\archive\\deep_comparison_v2.json")
