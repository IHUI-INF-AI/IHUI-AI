# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# -*- coding: utf-8 -*-
"""页面-组件使用差异分析(读 uniapp_diff_audit.json)"""
import json
import re

r = json.load(open(r"G:\IHUI-AI\apps\mobile-rn\report\uniapp_diff_audit.json", encoding="utf-8"))
old_usage = r["old_page_component_usage"]
new_usage = r["new_screen_component_usage"]

PAGE_MAP = {
    "pages/table/aiIndex/ai_index": "HomeScreen",
    "pages/table/tools/index": "AgentScreen",
    "pages/table/tools/category-detail": "CategoryDetailScreen",
    "pages/table/square/index": "DeveloperScreen",
    "pages/table/user/index": "ProfileScreen",
    "pages/table/share/index": "ShareScreen",
    "pages/tools/ai_index2.vue": "ChatScreen",
    "pages/tools/ai_index3": "ChatScreen",
    "pages/tools/token_value": "TokenValueScreen",
    "pages/tools/ai_group/index": "AiGroupScreen",
    "pages/tools/ai_assistant.vue": "AiAssistantScreen",
    "pages/tools/ai_assistant_n8n": "AiAssistantN8nScreen",
    "pages/tools/ranking-detail": "RankingDetailScreen",
    "pages/tools/aigc/index": "AigcListScreen",
    "pages/tools/aigc/cover": "AigcCoverScreen",
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
    "pagesA/study/my_study": "StudyRecordScreen",
    "pagesA/course/MoreCourse": "MoreCourseScreen",
    "pagesA/course/detail": "CourseDetailScreen",
    "pagesA/coursePlanet/index": "CoursePlanetScreen",
    "pagesA/learn_develop/index": "LearnDevelopScreen",
    "pagesA/live-streaming/index": "LiveScreen",
    "pagesA/news/detail": "NewsScreen",
    "pagesA/pay/index": "PaymentScreen",
    "pagesA/payment/index": "PaymentScreen",
    "pagesA/phone-login/index": "LoginScreen",
    "pagesA/index/index": "HomeScreen",
    "pagesA/AICircle/index": "CircleDetailScreen",
    "pagesA/AgentDialoguePage/index": "AgentChatScreen",
    "pagesA/carte/index": "CarteScreen",
    "pagesA/set/index": "SettingsScreen",
    "pagesA/set/about": "AboutScreen",
}

NATIVE = {
    "scroll-view", "rich-text", "swiper-item", "web-view", "view", "text", "image", "button",
    "input", "textarea", "picker", "switch", "checkbox", "radio", "slider", "form", "label",
    "canvas", "video", "audio", "map", "cover-view", "cover-image", "movable-area",
    "movable-view", "block", "template", "slot", "navigator", "page-container", "match-media",
}


def norm(t):
    return t.lower().replace("-", "").replace("_", "")


def norm_comp(t):
    return norm(re.sub(r"(Screen|Component|Vue|PopUp|Popup|Pops|Modal)$", "", t))


print("=" * 72)
print("页面组件使用差异(原页面用了但新页面未找到对应组件)")
print("=" * 72)
for old_page, new_screen in PAGE_MAP.items():
    if old_page not in old_usage:
        continue
    old_tags = set(old_usage[old_page])
    old_biz = {t for t in old_tags if norm(t) not in NATIVE and not t.startswith("import")}
    if not old_biz:
        continue
    new_tags = set(new_usage.get(new_screen, []))
    new_norm = {norm_comp(t) for t in new_tags}
    missing = []
    for t in sorted(old_biz):
        tn = norm_comp(t)
        if tn not in new_norm:
            missing.append(t)
    if missing:
        print(f"\n[{old_page}] -> {new_screen}")
        print(f"  旧: {sorted(old_biz)}")
        print(f"  缺: {missing}")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
