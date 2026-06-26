"""对比 RuoYi Controller 路径前缀与当前 OpenAPI spec, 找出缺失的 Controller."""
import json
import urllib.request

# 1. 获取当前 OpenAPI spec 的所有路径
try:
    with urllib.request.urlopen("http://localhost:8000/openapi.json", timeout=15) as resp:
        spec = json.loads(resp.read().decode("utf-8"))
    existing_paths = set(spec.get("paths", {}).keys())
    print(f"[COMPARE] Current OpenAPI paths: {len(existing_paths)}")
except Exception as e:
    print(f"[COMPARE] ERROR fetching OpenAPI: {e}")
    existing_paths = set()

# 2. RuoYi Controller 路径前缀列表 (来自调研)
ruoyi_controllers = {
    # ai-program/auth/controller/login (6)
    "AliLoginController": "/login/ali",
    "FeishuLoginController": "/login/feishu",
    "PwdLoginController": "/login/pwd",
    "WechatLoginController": "/login/wechat",
    "GoogleLoginController": "/login/google",
    "EnterpriseWeChatLoginController": "/login/enterprise",
    # ai-program/auth/controller/fund (4)
    "FundController": "/fund",
    "FundAliPayController": "/fund/ali/pay",
    "RemoteDeviceController": "/remote",
    "RemoteDeviceByTaskController": "/remote/agent/task",
    # ai-program/auth/controller/ali (1)
    "AuthIdentityController": "/auth",
    # ai-program/auth/controller (11)
    "UsersController": "/users",
    "UserThirdPartyAccountsController": "/auth_accounts",
    "UserAuthInfoController": "/auth_info",
    "UserFundInfoController": "/auth_find_info",
    "UserLoginLogsController": "/login_logs",
    "UserMarginController": "/AuthuserMargin",
    "UserTokensController": "/auth_tokens",
    "UserVipController": "/auth_user_vip",
    "VipLevelController": "/auth_vip_level",
    "SmsTempController": "/auth_sms_temp",
    "VerificationCodesController": "/auth_veri_codes",
    # ai-program/slave/controller (40)
    "AgentCategoryController": "/category",
    "AgentCategoryLinkController": "/category_link",
    "AgentNeedTaskController": "/agentTask",
    "AgentRuleController": "/agentRule",
    "AgentRuleParamController": "/agentRuleParam",
    "AgentTaskDeveloperController": "/taskDeveloper",
    "AgentsController": "/agents",
    "AiUserFeedbackController": "/userFeedback",
    "AppVersionController": "/appVersion",
    "PowerPurchaseRuleController": "/powerPurchaseRule",
    "ZhsActivityController": "/zhs_activity",
    "ZhsAdvertiseController": "/advertise",
    "ZhsAgentBuyController": "/agentBuy",
    "ZhsAgentCategoryController": "/agentCategory",
    "ZhsAgentController": "/zhsAgent",
    "ZhsAgentExamineController": "/examine",
    "ZhsAgentSettlementController": "/agentSettlement",
    "ZhsAgentUsedetailController": "/agentUseDetail",
    "ZhsAgentWithdrawalDetailController": "/agentWithdrawalDetail",
    "ZhsBannerCarouselController": "/carousel",
    "ZhsCommissionFlowController": "/flow",
    "ZhsDeveloperController": "/developer",
    "ZhsDeveloperFundLogsController": "/developerFundLogs",
    "ZhsDeveloperLinkController": "/developerLink",
    "ZhsDictionaryController": "/dictionary",
    "ZhsIdentityProportionController": "/identity_proportion",
    "ZhsInformationController": "/information",
    "ZhsOperateTokenFlowController": "/token_flow",
    "ZhsPopularCoursesController": "/courses",
    "ZhsOrderController": "/order",
    "ZhsProductController": "/zhs_product",
    "ZhsProductIdentityController": "/product_identity",
    "ZhsUserAgentAudioController": "/userAgentAudio",
    "ZhsUserAgentContextController": "/userAgentContext",
    "ZhsUserAgentImageController": "/userAgentImage",
    "ZhsUserController": "/zhs_user",
    "ZhsUserVipController": "/user_vip",
    "ZhsVipLevelController": "/vip_level",
    "ZhsWithdrawalDetailController": "/Withdrawaldetail",
    "ZhsWithdrawalFlowController": "/withdrawal_flow",
    # ai-program/course/controller (17)
    "ZhsCategoryDictionaryController": "/categoryDictionary",
    "ZhsCourseAuditController": "/courseAudit",
    "ZhsCourseController": "/course",
    "ZhsCoursePayController": "/coursePay",
    "ZhsCoursePayLogController": "/coursePayLog",
    "ZhsCoursePlatformLogController": "/coursePlatformLog",
    "ZhsCourseTempController": "/courseTemp",
    "ZhsCourseVideoController": "/courseVideo",
    "ZhsCourseVideoTempController": "/courseVideoTemp",
    "ZhsEducationPlatformController": "/educationPlatform",
    "ZhsIdentityController": "/zhsIdentity",
    "ZhsOrganizationController": "/organization",
    "ZhsUserCommentLogController": "/userCommentLog",
    "ZhsUserPlatformController": "/userPlatform",
    "ZhsUserSysLinkController": "/userSysLink",
    "ZhsUserVideoCommentController": "/userVideoComment",
    "ZhsUserVideoLogController": "/userVideoLog",
    # 其他模块
    "GoogleAuthenticationController": "/google",
    "AiGcController": "/ai_gc",
    "AuthorizationManagementController": "/auth_management",
    "RankingController": "/ranking",
    "RemoteThirdController": "/remote/third",
    "VideoPreloadController": "/api/video",
    "VideoBreakpointController": "/api/video/breakpoint",
    "CozeChatController": "/coze/chat",
    "CozeBotController": "/coze/bot",
    "AgentsController_coze": "/coze/agents",
    "GenController": "/gen",
    "SysJobController": "/job",
    "SysJobLogController": "/job/log",
    "SysUserController": "/user",
    "SysRoleController": "/role",
    "SysProfileController": "/user/profile",
    "SysPostController": "/post",
    "SysMenuController": "/menu",
    "SysDeptController": "/dept",
    "SysDictTypeController": "/dict/type",
    "SysDictDataController": "/dict/data",
    "SysConfigController": "/config",
    "SysNoticeController": "/notice",
    "SysOperlogController": "/operlog",
    "SysLogininforController": "/logininfor",
    "SysUserOnlineController": "/online",
    "AiNewsController": "/news",
    "AiContactController": "/contact",
    "AiAboutUsController": "/us",
    "AiFileStorageController": "/official/storage",
}

# 3. 检查每个 Controller 的路径前缀是否在 OpenAPI 中存在
missing = []
found = []
for ctrl_name, prefix in ruoyi_controllers.items():
    # 检查是否有路径以该前缀开头
    has_path = any(p == prefix or p.startswith(prefix + "/") or p.startswith(prefix + "?") for p in existing_paths)
    if has_path:
        found.append((ctrl_name, prefix))
    else:
        missing.append((ctrl_name, prefix))

print(f"\n[COMPARE] Already migrated: {len(found)} controllers")
print(f"[COMPARE] Missing: {len(missing)} controllers")
print("\n[MISSING] Controllers not in OpenAPI:")
for name, prefix in missing:
    print(f"  {name}: {prefix}")

print(f"\n[FOUND] Controllers already in OpenAPI:")
for name, prefix in found:
    print(f"  {name}: {prefix}")
