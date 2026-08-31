# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# -*- coding: utf-8 -*-
"""生成完整差异审计报告(HTML)"""
import json
import os
import re
from collections import defaultdict

NEW_APP = r"G:\IHUI-AI\apps\mobile-rn"

r = json.load(open(os.path.join(NEW_APP, "report", "uniapp_diff_audit.json"), encoding="utf-8"))

old_pages = r["old_page_component_usage"]
new_screens = r["new_screen_component_usage"]
new_routes = set(r["new_routes"])
old_comps = r["old_components"]
new_comps = set(r["new_components"])

# ===== 1. 原注册页面 vs 新路由 =====
registered = r["old_registered_pages"]

# 页面路径 -> 功能语义(人工标注)
PAGE_SEMANTIC = {
    "pages/login-app/login": "登录",
    "pages/table/aiIndex/ai_index": "智汇社区(首页)",
    "pages/table/tools/index": "AI agent 首页",
    "pages/table/tools/category-detail": "分类详情",
    "pages/table/square/index": "开发者详情",
    "pages/table/user/index": "我的",
    "pages/table/share/index": "分享星球(AI资讯)",
    "pages/tools/ai_index2": "智汇社区对话页2",
    "pages/tools/ai_index3": "智汇社区对话页3",
    "pages/tools/token_value": "我的智汇值",
    "pages/tools/ai_group/index": "AI团队",
    "pages/tools/ai_assistant": "AI生成助手",
    "pages/tools/ai_assistant_n8n": "N8N助手",
    "pages/tools/ranking-detail": "排行榜详情",
    "pages/tools/aigc/index": "灵感(AIGC列表)",
    "pages/tools/aigc/publish": "发布作品",
    "pages/tools/model-plaza/index": "模型广场",
    "pages/income/index": "我的佣金",
    "pages/income/withdraw/index": "提现明细",
    "pages/distribution_personnel_list/index": "我邀请的团队",
    "pages/distribution_personnel_list/detail": "下级成员",
    "pages/distribution_order_list/index": "分销订单列表",
    "pages/user_order_list/index": "订单列表",
    "pagesA/vip_info/index": "会员",
    "pagesA/distribution/index": "我的公司",
    "pagesA/plaza/developer": "开发者详情",
    "pagesA/fankui/index": "反馈",
    "pagesA/earn_commission/index": "分佣计划",
    "pagesA/business-card/index": "个人名片",
    "pagesA/recruitment/index": "操盘手计划",
    "pagesA/topup-success/index": "充值成功",
    "pagesA/topup-fail/index": "充值失败",
    "pagesA/withdrawal/index": "提现",
    "pagesA/webview/index": "WebView",
    "pagesA/vip/details": "会员详情",
    "pagesA/vip/index": "VIP会员",
    "pagesA/vip/trader": "成为操盘手",
    "pagesA/top-up/index": "充值",
    "pagesA/agreement/user-agreement": "用户服务协议",
    "pagesA/agreement/privacy-policy": "隐私政策",
    "pagesA/plaza/index": "开发者广场",
    "pagesA/dev_enter/index": "我的智能体",
    "pagesA/dev_enter/nbn_model": "n8n智能体",
    "pagesA/dev_enter/model_income": "智能体收入",
    "pagesA/ai_career/index": "AI生涯指导",
    "pagesA/message/index": "消息",
    "pagesA/assistant/index": "AI助手",
    "pagesA/settings/index": "设置",
    "pagesA/settings/account": "账号管理",
    "pagesA/settings/about": "关于我们",
    "pagesA/settings/account-cancel": "账号注销",
    "pagesA/settings/change-phone": "更换手机号",
    "pagesA/settings/privacy": "隐私与权限",
    "pagesA/settings/business-license": "营业执照",
    "pagesA/settings/icp-record": "ICP备案",
    "pagesA/settings/model-record": "模型备案",
    "pagesA/settings/usage-rules": "使用规范",
    "pagesA/settings/app-permission": "应用权限",
    "pagesA/studyindex/index": "AI视频(学习)",
    "pagesA/study/video_detail": "视频详情",
    "pagesA/study/publish": "发布",
    "pages/login-app-other/register": "注册",
    "pages/login-app-other/changePwd": "修改密码",
    "pages/login-app-other/changePhone": "更换手机号",
}

# 人工映射: 原页面 -> 新 screen(全部注册页面)
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

# 检查哪些 screen 文件存在
missing_screens = []
for page, screen in PAGE_TO_SCREEN.items():
    if screen not in new_screens:
        missing_screens.append((page, screen))

# 未注册但存在于 pagesA 的功能页面(原项目实际在用)
extra_pages = {
    "pagesA/AICircle/index.vue": "AI圈子(CircleDetailScreen?)",
    "pagesA/AgentDialoguePage/index.vue": "智能体对话页(AgentChatScreen?)",
    "pagesA/ConfirmPurchasePopUp/index.vue": "确认购买弹窗",
    "pagesA/carte/index.vue": "课程表(CarteScreen)",
    "pagesA/course/MoreCourse.vue": "更多课程(MoreCourseScreen)",
    "pagesA/course/detail.vue": "课程详情(CourseDetailScreen)",
    "pagesA/coursePlanet/index.vue": "课程星球(CoursePlanetScreen)",
    "pagesA/learn_develop/index.vue": "学开发(LearnDevelopScreen)",
    "pagesA/live-streaming/index.vue": "直播(LiveScreen)",
    "pagesA/news/detail.vue": "资讯详情(NewsScreen?)",
    "pagesA/pay/index.vue": "支付(PaymentScreen)",
    "pagesA/payment/index.vue": "支付(PaymentScreen)",
    "pagesA/phone-login/index.vue": "手机登录(LoginScreen)",
    "pagesA/study/my_study.vue": "我的学习(StudyRecordScreen)",
    "pagesA/user_ord/index.vue": "用户订单(OrderScreen)",
    "pagesA/vip/paySuccess.vue": "会员支付成功",
    "pagesA/test/cloud.vue": "测试",
    "pagesA/plaza/set_need.vue": "需求提交(SetNeedScreen)",
    "pagesA/plaza/cover.vue": "广场封面(PlazaCoverScreen)",
    "pagesA/dev_enter/cover.vue": "开发者封面(DevEnterCoverScreen)",
    "pagesA/dev_enter/model_edit.vue": "模型编辑(ModelEditScreen)",
    "pagesA/settings/api-settings.vue": "API设置(ApiSettingsScreen)",
}

# ===== 2. 组件清单差异 =====
old_comp_basename = {}
for c in old_comps:
    base = c.split("/")[-1]
    old_comp_basename[c] = base

# 规范化匹配
def norm(t):
    return re.sub(r"[^a-z0-9]", "", t.lower())

new_comp_norm = {norm(c): c for c in new_comps}

missing_comps = []
for c in old_comps:
    base = c.split("/")[-1]
    if norm(base) not in new_comp_norm:
        missing_comps.append(c)

# ===== 3. 页面组件使用差异 =====
NATIVE = {
    "scroll-view", "rich-text", "swiper-item", "web-view", "view", "text", "image", "button",
    "input", "textarea", "picker", "switch", "checkbox", "radio", "slider", "form", "label",
    "canvas", "video", "audio", "map", "cover-view", "cover-image", "movable-area",
    "movable-view", "block", "template", "slot", "navigator", "page-container", "match-media",
}

def norm_comp(t):
    return norm(re.sub(r"(Screen|Component|Vue|PopUp|Popup|Pops|Modal)$", "", t))

usage_diffs = []
for page, screen in PAGE_TO_SCREEN.items():
    if page not in old_pages or screen not in new_screens:
        continue
    old_tags = set(old_pages[page])
    old_biz = {t for t in old_tags if norm(t) not in NATIVE and t[0].isupper() or norm(t) not in NATIVE and "-" in t}
    # 更精确过滤: 只保留与组件同名的标签
    old_biz = {t for t in old_biz if norm_comp(t) in {norm_comp(c) for c in old_comps} or norm_comp(t) in new_comp_norm}
    if not old_biz:
        continue
    new_tags = set(new_screens.get(screen, []))
    new_norm = {norm_comp(t) for t in new_tags}
    missing = [t for t in sorted(old_biz) if norm_comp(t) not in new_norm]
    if missing:
        usage_diffs.append({"page": page, "screen": screen, "old_components": sorted(old_biz), "missing": missing})

# ===== 生成 HTML 报告 =====
rows_page = ""
for page in registered:
    semantic = PAGE_SEMANTIC.get(page, "")
    screen = PAGE_TO_SCREEN.get(page)
    status = "✅"
    status_color = "#16a34a"
    if screen is None:
        status = "❌ 无映射"
        status_color = "#dc2626"
    elif screen not in new_screens:
        status = f"❌ {screen} 不存在"
        status_color = "#dc2626"
    rows_page += f"<tr><td>{page}</td><td>{semantic}</td><td>{screen or '—'}</td><td style='color:{status_color};font-weight:600'>{status}</td></tr>"

rows_comp = ""
for c in missing_comps:
    rows_comp += f"<tr><td>{c}</td><td style='color:#dc2626'>无对应组件</td></tr>"
if not rows_comp:
    rows_comp = "<tr><td colspan='2' style='color:#16a34a'>全部组件已覆盖</td></tr>"

rows_usage = ""
for d in usage_diffs:
    rows_usage += (
        f"<tr><td>{d['page']}<br/><small>→ {d['screen']}</small></td>"
        f"<td>{', '.join(d['old_components'])}</td>"
        f"<td style='color:#dc2626'>{', '.join(d['missing'])}</td></tr>"
    )
if not rows_usage:
    rows_usage = "<tr><td colspan='3' style='color:#16a34a'>无组件使用差异</td></tr>"

# 高频组件使用频率对比
from collections import Counter
old_counter = Counter()
for p, tags in old_pages.items():
    for t in tags:
        old_counter[t] += 1
new_counter = Counter()
for s, tags in new_screens.items():
    for t in tags:
        new_counter[t] += 1

freq_rows = ""
CORE_COMPONENTS = [
    "NavigationBars", "DrawerComponent", "ModelList", "InputArea", "BottomActionBar",
    "IntelligentAssistant", "Carousel", "AgentList", "MaterialList", "ModelConfigDialog",
    "SearchInput", "FloatBox", "BottomPops", "StudyBar", "UserInfoCard", "ConfirmPurchasePopUp",
    "BottomFigure", "CommissionFloatingIcon", "VerifyCodeModal", "EarningsStatisticsCard",
    "FunctionBlockColumn", "PersonalInformationCard", "UserMembershipBenefits", "MoreTitles",
    "Toolbar", "KnowledgePlanet", "CourseCarousel", "PopularCourses", "VoiceInput", "Menu",
    "CardWithList", "FullRankingList", "AiModelCard", "HandPlatePops", "IntroducePopup",
    "LoginPopUp", "PayButton", "TabBar", "TitleSwitch", "ToggleButtonGroup",
]
for c in CORE_COMPONENTS:
    n_old = old_counter.get(c, 0)
    n_new = new_counter.get(c, 0)
    flag = "✅" if n_new >= n_old or n_old == 0 else "⚠️"
    color = "#16a34a" if flag == "✅" else "#f59e0b"
    freq_rows += f"<tr><td>{c}</td><td>{n_old}</td><td>{n_new}</td><td style='color:{color};font-weight:600'>{flag}</td></tr>"

html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"/>
<title>mobile-rn vs Uniapp 差异审计报告</title>
<style>
  body {{ font-family: -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif; margin: 0; padding: 32px; background: #f6f7f9; color: #1f2328; }}
  .wrap {{ max-width: 1080px; margin: 0 auto; }}
  h1 {{ font-size: 24px; margin: 0 0 4px; }}
  .sub {{ color: #6b7280; font-size: 13px; margin-bottom: 24px; }}
  .stats {{ display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 28px; }}
  .stat {{ background: #fff; border-radius: 10px; padding: 14px 20px; box-shadow: 0 1px 3px rgba(0,0,0,.06); }}
  .stat .num {{ font-size: 26px; font-weight: 700; }}
  .stat .label {{ font-size: 12px; color: #6b7280; }}
  .card {{ background: #fff; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,.06); }}
  .card h2 {{ font-size: 17px; margin: 0 0 14px; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 13px; }}
  th, td {{ text-align: left; padding: 8px 10px; border-bottom: 1px solid #eef0f3; }}
  th {{ background: #fafbfc; font-weight: 600; color: #374151; }}
  tr:hover td {{ background: #fafbfc; }}
  small {{ color: #9ca3af; }}
</style>
</head>
<body>
<div class="wrap">
  <h1>📋 mobile-rn 与历史 Uniapp 项目差异审计报告</h1>
  <div class="sub">比对基准: D:\\历史项目存档\\zhs_app-ZZ\\Ai-WXMiniVue | 目标: G:\\IHUI-AI\\apps\\mobile-rn | 生成时间: 2026-08-21</div>

  <div class="stats">
    <div class="stat"><div class="num">{len(registered)}</div><div class="label">原注册页面</div></div>
    <div class="stat"><div class="num">{len(new_screens)}</div><div class="label">新 Screen 文件</div></div>
    <div class="stat"><div class="num">{len(new_routes)}</div><div class="label">新注册路由</div></div>
    <div class="stat"><div class="num">{len(old_comps)}</div><div class="label">原组件</div></div>
    <div class="stat"><div class="num">{len(new_comps)}</div><div class="label">新组件</div></div>
  </div>

  <div class="card">
    <h2>① 页面映射(原注册页面 → 新 Screen)</h2>
    <table><tr><th>原页面路径</th><th>功能</th><th>新 Screen</th><th>状态</th></tr>{rows_page}</table>
  </div>

  <div class="card">
    <h2>② 组件清单差异(原组件 → 新组件)</h2>
    <table><tr><th>原组件</th><th>状态</th></tr>{rows_comp}</table>
  </div>

  <div class="card">
    <h2>③ 高频组件使用频率对比</h2>
    <table><tr><th>组件</th><th>原页面使用数</th><th>新 Screen 使用数</th><th>是否达标</th></tr>{freq_rows}</table>
    <p style="color:#6b7280;font-size:12px">⚠️ = 新项目使用数低于原项目(可能存在"组件未在各页面用上")</p>
  </div>

  <div class="card">
    <h2>④ 页面-组件使用差异(原页面用了但新页面未接)</h2>
    <table><tr><th>原页面 → 新 Screen</th><th>原页面使用组件</th><th>新页面缺失</th></tr>{rows_usage}</table>
  </div>
</div>
</body>
</html>"""

out = os.path.join(NEW_APP, "report", "uniapp_diff_audit.html")
with open(out, "w", encoding="utf-8") as f:
    f.write(html)

print(f"报告已生成: {out}")
print(f"页面映射缺失: {len([m for m in missing_screens])}")
for p, s in missing_screens:
    print(f"  ❌ {p} -> {s}")
print(f"组件缺失: {len(missing_comps)}")
for c in missing_comps:
    print(f"  ❌ {c}")
print(f"组件使用差异页面数: {len(usage_diffs)}")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
