# -*- coding: utf-8 -*-
"""批量提取原注册页面的标题/首文本 + 新 screen 的用途线索,输出功能对照表"""
import json
import os
import re

OLD_ROOT = r"D:\历史项目存档\zhs_app-ZZ\Ai-WXMiniVue\src"
NEW_ROOT = r"G:\IHUI-AI\apps\mobile-rn\src"

# 原注册页面 → 新 screen 映射(来自 gen_diff_report 的 PAGE_TO_SCREEN)
PAGE_TO_SCREEN = {
    "pages/login-app/login": "LoginScreen",
    "pages/table/aiIndex/ai_index": "HomeScreen",
    "pages/table/tools/index": "AgentScreen",
    "pages/table/tools/category-detail": "CategoryDetailScreen",
    "pages/table/square/index": "DeveloperScreen",
    "pages/table/user/index": "ProfileScreen",
    "pages/table/share/index": "ShareScreen",
    "pages/tools/ai_index2": "ChatScreen",
    "pages/tools/ai_index3": "ChatScreen",
    "pages/tools/token_value": "TokenValueScreen",
    "pages/tools/ai_group/index": "AiGroupScreen",
    "pages/tools/ai_assistant": "AiAssistantScreen",
    "pages/tools/ai_assistant_n8n": "AiAssistantN8nScreen",
    "pages/tools/ranking-detail": "RankingDetailScreen",
    "pages/tools/aigc/index": "AigcListScreen",
    "pages/tools/aigc/publish": "AigcPublishScreen",
    "pages/tools/model-plaza/index": "ModelPlazaScreen",
    "pages/income/index": "IncomeScreen",
    "pages/income/withdraw/index": "WithdrawScreen",
    "pages/distribution_personnel_list/index": "TeamScreen",
    "pages/distribution_personnel_list/detail": "TeamDetailScreen",
    "pages/distribution_order_list/index": "DistributionOrderListScreen",
    "pages/user_order_list/index": "OrderScreen",
    "pagesA/vip_info/index": "VipScreen",
    "pagesA/distribution/index": "DistributionScreen",
    "pagesA/plaza/developer": "DeveloperScreen",
    "pagesA/fankui/index": "FeedbackScreen",
    "pagesA/earn_commission/index": "EarnCommissionScreen",
    "pagesA/business-card/index": "BusinessCardScreen",
    "pagesA/recruitment/index": "RecruitmentScreen",
    "pagesA/topup-success/index": "TopupSuccessScreen",
    "pagesA/topup-fail/index": "TopupFailScreen",
    "pagesA/withdrawal/index": "WithdrawScreen",
    "pagesA/webview/index": "WorkPanelScreen",
    "pagesA/vip/details": "VipLevelScreen",
    "pagesA/vip/index": "VipScreen",
    "pagesA/vip/trader": "VipTraderScreen",
    "pagesA/top-up/index": "AppTopupScreen",
    "pagesA/agreement/user-agreement": "AgreementScreen",
    "pagesA/agreement/privacy-policy": "PrivacyScreen",
    "pagesA/plaza/index": "PlazaScreen",
    "pagesA/dev_enter/index": "DevEnterScreen",
    "pagesA/dev_enter/nbn_model": "N8nModelScreen",
    "pagesA/dev_enter/model_income": "ModelIncomeScreen",
    "pagesA/dev_enter/model_edit": "ModelEditScreen",
    "pagesA/ai_career/index": "AiCareerScreen",
    "pagesA/message/index": "MessageCenterScreen",
    "pagesA/assistant/index": "AssistantScreen",
    "pagesA/settings/index": "SettingsScreen",
    "pagesA/settings/account": "SettingsAccountScreen",
    "pagesA/settings/about": "AboutScreen",
    "pagesA/settings/account-cancel": "AccountCancelScreen",
    "pagesA/settings/change-phone": "ChangePhoneScreen",
    "pagesA/settings/privacy": "PrivacyScreen",
    "pagesA/settings/business-license": "BusinessLicenseScreen",
    "pagesA/settings/icp-record": "IcpRecordScreen",
    "pagesA/settings/model-record": "ModelRecordScreen",
    "pagesA/settings/usage-rules": "UsageRulesScreen",
    "pagesA/settings/app-permission": "AppPermissionScreen",
    "pagesA/studyindex/index": "StudyIndexScreen",
    "pagesA/study/video_detail": "VideoPlayerScreen",
    "pagesA/study/publish": "StudyPublishScreen",
    "pages/login-app-other/register": "RegisterScreen",
    "pages/login-app-other/changePwd": "ChangePwdScreen",
    "pages/login-app-other/changePhone": "ChangePhoneScreen",
}


def extract_old_title(filepath):
    """提取原页面标题:pages.json navigationBarTitleText 优先,否则 template 首文本"""
    if not filepath or not os.path.exists(filepath):
        return ""
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()
    # 提取 template 中第一个 text/标题文本
    texts = re.findall(r">([^<>{}]{2,20})<", content)
    meaningful = [t.strip() for t in texts if t.strip() and not t.strip().startswith("{{") and not t.strip().startswith("//") and "rpx" not in t and not t.startswith("@") and not t.startswith(":")][:5]
    return " | ".join(meaningful)


def extract_new_usage(filepath):
    """提取新 screen 的用途线索:文件头注释(对齐说明)"""
    if not filepath or not os.path.exists(filepath):
        return ""
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()
    m = re.search(r"/\*\*([\s\S]*?)\*/", content)
    if m:
        head = m.group(1)
        # 取前 6 行注释
        lines = [l.strip().lstrip("*").strip() for l in head.splitlines() if l.strip()]
        return " / ".join(lines[:6])
    return ""


# 从 pages.json 取标题
def load_pages_json():
    with open(os.path.join(OLD_ROOT, "pages.json"), "r", encoding="utf-8") as f:
        data = json.load(f)
    titles = {}
    for p in data.get("pages", []):
        titles[p["path"]] = p.get("style", {}).get("navigationBarTitleText", "")
    for sub in data.get("subPackages", []):
        root = sub.get("root", "")
        for p in sub.get("pages", []):
            titles[f"{root}/{p['path']}"] = p.get("style", {}).get("navigationBarTitleText", "")
    return titles


titles = load_pages_json()

print(f"{'原页面':<42}{'原标题':<16}{'新Screen':<24}{'功能线索'}")
print("-" * 140)
for page, screen in PAGE_TO_SCREEN.items():
    old_file = os.path.join(OLD_ROOT, page + ".vue")
    new_file = os.path.join(NEW_ROOT, "screens", screen + ".tsx")
    title = titles.get(page, "")
    old_text = extract_old_title(old_file)
    new_usage = extract_new_usage(new_file)
    clue = new_usage if new_usage else (f"文件不存在: {screen}")
    print(f"{page:<42}{title or '-':<16}{screen:<24}{clue[:60]}")
