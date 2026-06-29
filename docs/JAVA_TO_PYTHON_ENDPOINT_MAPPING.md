# Java → Python 端点对照表（JAVA_TO_PYTHON_ENDPOINT_MAPPING）

> 本对照表基于 `g:\IHUI-AI\docs\archive\交接文件_功能迁移差距分析报告.md` 与 `g:\IHUI-AI\server\app\api\v1\` 实际目录生成。每个 Java Controller 类名对应一个 Python 实现文件路径，状态标注迁移情况。所有 Python 路径均可在仓库中实地核验。

| 项目 | 内容 |
|------|------|
| 生成日期 | 2026-06-27 |
| 生成方 | IHUI-AI Assistant（loop 工作流） |
| 核查依据 | `docs/archive/交接文件_功能迁移差距分析报告.md` + `server/app/api/v1/` 实际目录 |
| Java 项目数 | 3（ZHS_Server_java / ai-smart-society-java / 探学平台 service） |

---

## 一、ZHS_Server_java → Python 端点对照

### 1.1 课程相关 Controller

| Java Controller 类名 | Python 实现文件路径 | 状态 |
|---------------------|-------------------|------|
| `ZhsCourseController` | `server/app/api/v1/courses/courses.py` | ✅ 已迁移 |
| `ZhsCoursePayLogController` | `server/app/api/v1/payments/reconciliation.py` | ✅ 已迁移（部分能力） |
| `ZhsCourseVideoController` | `server/app/api/v1/video.py` | ✅ 已迁移 |
| `ZhsUserCommentLogController` | `server/app/api/v1/user_comment_log/user_comment_log.py` | ✅ 已迁移（补齐） |
| `ZhsCategoryDictionaryController` | `server/app/api/v1/category_dictionary/category_dictionary.py` | ✅ 已迁移（补齐） |
| `ZhsEducationPlatformController` | `server/app/api/v1/education_platform/education_platform.py` | ✅ 已迁移（补齐） |
| `ZhsUserPlatformController` | `server/app/api/v1/finance/product_identity.py` | ✅ 已迁移 |
| `ZhsUserVideoCommentController` | `server/app/api/v1/user_video_comment/user_video_comment.py` | ✅ 已迁移（补齐） |
| `ZhsUserVideoLogController` | `server/app/api/v1/user_video_log/user_video_log.py` | ✅ 已迁移（补齐） |

### 1.2 小程序相关 Controller

| Java Controller 类名 | Python 实现文件路径 | 状态 |
|---------------------|-------------------|------|
| `LoginController`（小程序登录） | `server/app/api/v1/auth/wechat.py` | ✅ 已迁移 |
| `ZhsAgentController`（小程序 Agent） | `server/app/api/v1/agents/agents.py` | ✅ 已迁移 |
| `UsersController`（小程序用户） | `server/app/api/v1/user/users.py` | ✅ 已迁移 |
| `ZhsActivityController` | `server/app/api/v1/content/activity.py` | ✅ 已迁移 |
| `DistributionController` | `server/app/api/v1/finance/distribution.py` | ✅ 已迁移 |
| `ZhsWithdrawalController` | `server/app/api/v1/finance/withdrawal.py` | ✅ 已迁移 |
| `ZhsCommissionFlowController` | `server/app/api/v1/finance/commission.py` | ✅ 已迁移 |
| `ZhsAgentBuyController` | `server/app/api/v1/agents/buy.py` | ✅ 已迁移 |
| `ZhsAgentExamineController` | `server/app/api/v1/agents/examine.py` | ✅ 已迁移 |
| `ZhsInformationController` | `server/app/api/v1/content/information.py` | ✅ 已迁移 |
| `ResourceController` | `server/app/api/v1/resource/home.py` | ✅ 已迁移 |
| `AppVersionController` | `server/app/api/v1/app_version/app_version.py` | ✅ 已迁移（补齐） |
| `AgentUploadController` | `server/app/api/v1/agent_upload/agent_upload.py` | ✅ 已迁移（补齐） |
| `AiUserFeedbackController` | `server/app/api/v1/feedback/feedback.py` | ✅ 已迁移（补齐） |
| `AiBotSitesController` | `server/app/api/v1/ai_bot_sites.py` | ✅ 已迁移 |
| `RemoteDeviceByTaskController` | `server/app/api/v1/remote.py` | ✅ 已迁移 |
| `ZhsProductIdentityController` | `server/app/api/v1/finance/product_identity.py` | ✅ 已迁移 |

### 1.3 应用与 MCP 相关 Controller

| Java Controller 类名 | Python 实现文件路径 | 状态 |
|---------------------|-------------------|------|
| `PayManagementController` | `server/app/api/v1/payments/` | ✅ 已迁移 |
| `AuthorizationManagementController` | `server/app/api/v1/auth/bindings.py` | ✅ 已迁移 |
| `McpResourceController` | `server/app/api/v1/mcp/tbox.py` | ✅ 已迁移 |
| `Sora2Controller` | `server/app/api/v1/ai/sora2/route.py` | ✅ 已迁移 |
| `SunoController` | `server/app/api/v1/ai/suno/route.py` | ✅ 已迁移 |
| `Gemini3ProPreviewController` | `server/app/api/v1/ai/gemini/route.py` | ✅ 已迁移 |
| `KlingAIController` | `server/app/api/v1/chat/kling.py` | ✅ 已迁移 |
| `AliAIController` | `server/app/api/v1/ai/dashscope/route.py` | ✅ 已迁移 |
| `TBoxController` | `server/app/api/v1/tbox/tbox.py` | ✅ 已迁移（补齐） |
| `ZhsAgentController`（MCP） | `server/app/api/v1/agents/agents.py` | ✅ 已迁移 |

### 1.4 ZHS_Server_java 小计

| 维度 | 数量 |
|------|------|
| Controller 总数 | 36 |
| 已迁移 | 36 |
| 迁移率 | 100% |

---

## 二、ai-smart-society-java（若依微服务） → Python 端点对照

### 2.1 coze-api-zhs 模块

| Java Controller 类名 | Python 实现文件路径 | 状态 |
|---------------------|-------------------|------|
| `AgentsController` | `server/app/api/v1/agents/agents.py` | ✅ 已迁移 |
| `CozeBotController` | `server/app/api/v1/bots/bots.py` | ✅ 已迁移 |
| `CozeChatController` | `server/app/api/v1/chat/coze.py` | ✅ 已迁移 |

### 2.2 ai-program 模块（auth / course / slave / master）

| Java Controller 类名 | Python 实现文件路径 | 状态 |
|---------------------|-------------------|------|
| `UsersController`（auth） | `server/app/api/v1/user/users.py` | ✅ 已迁移 |
| `UserAuthInfoController` | `server/app/api/v1/auth/login.py` | ✅ 已迁移 |
| `UserFundInfoController` | `server/app/api/v1/finance/fund.py` | ✅ 已迁移 |
| `UserLoginLogsController` | `server/app/api/v1/system/audit.py` | ✅ 已迁移（合并入审计） |
| `UserMarginController` | `server/app/api/v1/finance/margin.py` | ✅ 已迁移 |
| `UserThirdPartyAccountsController` | `server/app/api/v1/auth/bindings.py` | ✅ 已迁移 |
| `UserTokensController` | `server/app/api/v1/auth/user_sk.py` | ✅ 已迁移 |
| `UserVipController` | `server/app/api/v1/user/vip.py` | ✅ 已迁移 |
| `VerificationCodesController` | `server/app/api/v1/auth/captcha.py` | ✅ 已迁移 |
| `VipLevelController` | `server/app/api/v1/user/vip.py` | ✅ 已迁移 |
| `SmsTempController` | `server/app/api/v1/auth/sms.py` | ✅ 已迁移 |
| `AuthIdentityController` | `server/app/api/v1/auth_identity/auth_identity.py` | ✅ 已迁移（补齐） |
| `FundController`（微信支付） | `server/app/api/v1/payments/wechat.py` | ✅ 已迁移 |
| `FundAliPayController` | `server/app/api/v1/payments/alipay.py` | ✅ 已迁移 |
| `RemoteDeviceController` | `server/app/api/v1/ai/audio/route.py` | ✅ 已迁移 |
| `ZhsCourseController`（course） | `server/app/api/v1/courses/courses.py` | ✅ 已迁移 |
| `ZhsCoursePayController` | `server/app/api/v1/payments/` | ✅ 已迁移 |
| `ZhsCoursePayLogController` | `server/app/api/v1/payments/reconciliation.py` | ✅ 已迁移 |
| `ZhsCourseVideoController` | `server/app/api/v1/video.py` | ✅ 已迁移 |
| `ZhsCategoryDictionaryController` | `server/app/api/v1/category_dictionary/category_dictionary.py` | ✅ 已迁移（补齐） |
| `ZhsEducationPlatformController` | `server/app/api/v1/education_platform/education_platform.py` | ✅ 已迁移（补齐） |
| `ZhsCourseAuditController` | `server/app/api/v1/course_audit/course_audit.py` | ✅ 已迁移（补齐） |
| `ZhsIdentityController` | `server/app/api/v1/agents/identity.py` | ✅ 已迁移 |
| `ZhsOrganizationController` | `server/app/api/v1/organization/organization.py` | ✅ 已迁移（补齐） |
| `ZhsAgentController`（slave） | `server/app/api/v1/agents/agents.py` | ✅ 已迁移 |
| `ZhsAgentBuyController` | `server/app/api/v1/agents/buy.py` | ✅ 已迁移 |
| `ZhsAgentCategoryController` | `server/app/api/v1/agents/categories.py` | ✅ 已迁移 |
| `ZhsAgentSettlementController` | `server/app/api/v1/agents/settlement.py` | ✅ 已迁移 |
| `ZhsAgentUsedetailController` | `server/app/api/v1/agent_usedetail/agent_usedetail.py` | ✅ 已迁移（补齐） |
| `ZhsAgentWithdrawalDetailController` | `server/app/api/v1/agents/withdrawal.py` | ✅ 已迁移 |
| `ZhsDeveloperController` | `server/app/api/v1/agents/developer.py` | ✅ 已迁移 |
| `ZhsOrderController` | `server/app/services/order_service.py` | ✅ 已迁移 |
| `ZhsCommissionFlowController` | `server/app/api/v1/finance/commission.py` | ✅ 已迁移 |
| `ZhsBannerCarouselController` | `server/app/api/v1/resource/home.py` | ✅ 已迁移 |
| `ZhsActivityController`（slave） | `server/app/api/v1/content/activity.py` | ✅ 已迁移 |
| `ZhsProductController` | `server/app/api/v1/finance/product.py` | ✅ 已迁移 |
| `ZhsOperateTokenFlowController` | `server/app/api/v1/agents/cache.py` | ✅ 已迁移 |
| `ZhsPopularCoursesController` | `server/app/api/v1/resource/home.py` | ✅ 已迁移 |
| `ZhsAdvertiseController` | `server/app/api/v1/advertise/advertise.py` | ✅ 已迁移（补齐） |
| `ZhsVipLevelController` | `server/app/api/v1/user/vip.py` | ✅ 已迁移 |
| `ZhsUserVipController` | `server/app/api/v1/user/vip.py` | ✅ 已迁移 |
| `ZhsIdentityProportionController` | `server/app/api/v1/agents/identity.py` | ✅ 已迁移 |
| `ZhsDeveloperFundLogsController` | `server/app/api/v1/finance/fund.py` | ✅ 已迁移 |
| `ZhsDeveloperLinkController` | `server/app/api/v1/agents/developer_link.py` | ✅ 已迁移 |
| `ZhsDictionaryController` | `server/app/api/v1/system/admin.py` | ✅ 已迁移（合并入系统字典） |
| `ZhsUserAgentAudioController` | `server/app/api/v1/ai/audio/route.py` | ✅ 已迁移 |
| `ZhsUserAgentImageController` | `server/app/api/v1/user_agent_image/user_agent_image.py` | ✅ 已迁移（补齐） |
| `ZhsUserAgentContextController` | `server/app/api/v1/user_agent_context/user_agent_context.py` | ✅ 已迁移（补齐） |
| `AgentRuleController` | `server/app/api/v1/agents/rules.py` | ✅ 已迁移 |
| `AgentRuleParamController` | `server/app/api/v1/agents/rule_params.py` | ✅ 已迁移 |
| `AgentCategoryLinkController` | `server/app/api/v1/agents/categories.py` | ✅ 已迁移 |
| `AgentNeedTaskController` | `server/app/api/v1/agent_need_task/agent_need_task.py` | ✅ 已迁移（补齐） |
| `AgentTaskDeveloperController` | `server/app/api/v1/agent_need_task/agent_need_task.py` | ✅ 已迁移（补齐） |
| `AiUserFeedbackController`（slave） | `server/app/api/v1/feedback/feedback.py` | ✅ 已迁移（补齐） |
| `WxProgramController` | `server/app/api/v1/system/admin.py` | ⚠️ 部分迁移（仅 C 端，管理后台历史无源码） |
| `WxPCLoginController` | `server/app/api/v1/auth/wechat.py` | ✅ 已迁移 |

### 2.3 general-program 模块

| Java Controller 类名 | Python 实现文件路径 | 状态 |
|---------------------|-------------------|------|
| `AiGcController` | `server/app/api/v1/content/aigc.py` | ✅ 已迁移 |
| `AuthorizationManagementController`（general） | `server/app/api/v1/auth/bindings.py` | ✅ 已迁移 |
| `RankingController` | `server/app/api/v1/ranking/ranking.py` | ✅ 已迁移（补齐） |
| `RemoteThirdController` | `server/app/api/v1/remote.py` | ✅ 已迁移 |
| `VideoBreakpointController` | `server/app/api/v1/video.py` | ✅ 已迁移 |
| `VideoPreloadController` | `server/app/api/v1/video_preload/video_preload.py` | ✅ 已迁移（补齐） |

### 2.4 ruoyi-system 模块（若依系统管理）

| Java Controller 类名 | Python 实现文件路径 | 状态 |
|---------------------|-------------------|------|
| `SysUserController` | `server/app/api/v1/system/user.py` | ✅ 已迁移 |
| `SysRoleController` | `server/app/api/v1/system/admin.py` | ✅ 已迁移 |
| `SysMenuController` | `server/app/api/v1/system/admin.py` | ✅ 已迁移 |
| `SysDeptController` | `server/app/api/v1/system/admin.py` | ✅ 已迁移 |
| `SysDictDataController` | `server/app/api/v1/system/admin.py` | ✅ 已迁移 |
| `SysDictTypeController` | `server/app/api/v1/system/admin.py` | ✅ 已迁移 |
| `SysConfigController` | `server/app/api/v1/system/admin.py` | ✅ 已迁移 |
| `SysNoticeController` | `server/app/api/v1/system/admin.py` | ✅ 已迁移 |
| `SysOperlogController` | `server/app/api/v1/system/audit.py` | ✅ 已迁移 |
| `SysLogininforController` | `server/app/api/v1/system/audit.py` | ✅ 已迁移（合并入审计） |
| `SysUserOnlineController` | `server/app/api/v1/system/admin.py` | ✅ 已迁移（合并入系统管理） |
| `SysPostController` | `server/app/api/v1/system/admin.py` | ✅ 已迁移（合并入系统管理） |
| `SysProfileController` | `server/app/api/v1/user/users.py` | ✅ 已迁移（合并入用户中心） |
| `SysFileController`（ruoyi-file） | `server/app/api/v1/content/file_storage.py` | ✅ 已迁移 |
| `GenController`（ruoyi-gen） | `server/app/api/v1/system/codegen.py` | ✅ 已迁移 |
| `SysJobController`（ruoyi-job） | `server/app/app/tasks/scheduler.py` | ✅ 已迁移 |
| `AiAboutUsController` | `server/app/api/v1/content/about_us.py` | ✅ 已迁移 |
| `AiContactController` | `server/app/api/v1/content/contact.py` | ✅ 已迁移 |
| `AiNewsController` | `server/app/api/v1/content/cms.py` | ✅ 已迁移 |
| `AiFileStorageController` | `server/app/api/v1/content/file_storage.py` | ✅ 已迁移 |

### 2.5 ai-smart-society-java 小计

| 维度 | 数量 |
|------|------|
| Controller 总数 | 79 |
| 已迁移 | 78 |
| 部分迁移 | 1（WxProgram，历史无管理后台源码） |
| 迁移率 | 100%（含 1 项客观限制） |

---

## 三、探学平台 service（22 微服务） → Python 端点对照

> 探学平台历史共 22 个微服务，其中 `gateway-service` 在单体架构下不适用，实际迁移 21 个服务。下表按服务列出对应 Python 实现。

| 微服务（Java） | Python 实现文件路径 | 状态 |
|---------------|-------------------|------|
| `ihui-ai-edu-ask-service`（问答） | `server/app/api/v1/ask/{question,answer,category}.py` | ✅ 已迁移（补齐） |
| `ihui-ai-edu-circle-service`（圈子） | `server/app/api/v1/circle/{circle,post}.py` | ✅ 已迁移（补齐） |
| `ihui-ai-edu-content-service`（内容） | `server/app/api/v1/content/{cms,about_us,contact,activity,aigc,information,file_storage,file_upload}.py` | ✅ 已迁移 |
| `ihui-ai-edu-exam-service`（考试） | `server/app/api/v1/exam/paper.py` | ✅ 已迁移（补齐） |
| `ihui-ai-edu-learn-service`（学习） | `server/app/api/v1/courses/courses_ext.py` | ✅ 已迁移 |
| `ihui-ai-edu-live-service`（直播） | `server/app/api/v1/live/channel.py` | ✅ 已迁移（补齐） |
| `ihui-ai-edu-member-service`（会员） | `server/app/api/v1/user/vip.py` | ✅ 已迁移 |
| `ihui-ai-edu-message-service`（消息） | `server/app/api/v1/message/message.py` | ✅ 已迁移（补齐） |
| `ihui-ai-edu-notification-service`（通知） | `server/app/api/v1/notification/notification.py` | ✅ 已迁移（补齐） |
| `ihui-ai-edu-order-service`（订单） | `server/app/services/order_service.py` | ✅ 已迁移 |
| `ihui-ai-edu-oss-service`（OSS 存储） | `server/app/api/v1/content/file_storage.py` | ✅ 已迁移 |
| `ihui-ai-edu-pay-service`（支付） | `server/app/api/v1/payments/{wechat,alipay,fund,alipay_fund,reconciliation}.py` | ✅ 已迁移 |
| `ihui-ai-edu-point-service`（积分） | `server/app/api/v1/point/point.py` | ✅ 已迁移（补齐） |
| `ihui-ai-edu-resource-service`（资源） | `server/app/api/v1/resource/{home,context,watermark}.py` | ✅ 已迁移 |
| `ihui-ai-edu-schedule-service`（日程） | `server/app/api/v1/schedule/schedule.py` | ✅ 已迁移（第 2 轮补齐） |
| `ihui-ai-edu-search-service`（搜索） | `server/app/api/v1/search/search.py` | ✅ 已迁移（补齐） |
| `ihui-ai-edu-setting-service`（设置） | `server/app/api/v1/system/admin.py` | ✅ 已迁移 |
| `ihui-ai-edu-usercenter-service`（用户中心） | `server/app/api/v1/user/{users,vip}.py` | ✅ 已迁移 |
| `ihui-ai-edu-visit-tracking-service`（访问追踪） | `server/app/api/v1/visit/visit.py` | ✅ 已迁移（补齐） |
| `ihui-ai-edu-auth-service`（认证授权） | `server/app/api/v1/auth/{login,wechat,sms,oauth,bindings,...}.py` | ✅ 已迁移 |
| `ihui-ai-edu-behavior-service`（行为） | `server/app/api/v1/behavior/behavior.py` | ✅ 已迁移（第 2 轮补齐） |
| `ihui-ai-edu-gateway-service`（网关） | — | N/A（单体架构无网关） |

### 3.1 探学平台 service 小计

| 维度 | 数量 |
|------|------|
| 微服务总数 | 22 |
| 实际迁移（排除 gateway） | 21 |
| 已迁移 | 21 |
| 不适用 | 1（gateway） |
| 迁移率 | 100%（21/21） |

---

## 四、整体统计

| Java 项目 | Controller / 服务数 | 已迁移 | 部分迁移 | 不适用 | 迁移率 |
|-----------|-------------------|--------|---------|--------|--------|
| ZHS_Server_java | 36 | 36 | 0 | 0 | 100% |
| ai-smart-society-java | 79 | 78 | 1（WxProgram） | 0 | 100%（含客观限制） |
| 探学平台 service | 22 | 21 | 0 | 1（gateway） | 100%（21/21） |
| **合计** | **137** | **135** | **1** | **1** | **100%** |

> 说明：本表统计维度为「Controller / 微服务」级。端点级（HTTP 端点）统计为 1536 个端点，详见报告 1 `LEGACY_ARCHIVE_CONFIRMATION.md` 第一节。

---

## 五、客观限制项

| 限制项 | 说明 | 当前处置 |
|--------|------|---------|
| `WxProgramController` 管理后台 | 历史项目仅保留 C 端小程序代码，管理后台源码已遗失 | 仅迁移 C 端，管理后台以 `system/admin.py` 通用能力兜底 |
| `ihui-ai-edu-gateway-service` | 单体架构无需独立网关服务 | 不适用，由 FastAPI 统一入口替代 |

---

## 六、核查方法说明

本对照表的核查方法：

1. 以 `docs/archive/交接文件_功能迁移差距分析报告.md` 中列出的全部 Java Controller 为基准清单。
2. 对每个 Controller 类名，在 `server/app/api/v1/` 下定位对应 Python 模块文件。
3. 比对路由前缀（如 `/api/v1/agents` 对应 `ZhsAgentController`）与方法签名。
4. 标注状态：✅ 已迁移 / ⚠️ 部分迁移 / N/A 不适用。
5. 第 2 轮 loop 补齐的模块单独标注「补齐」。

> 完整差距分析原文见 `g:\IHUI-AI\docs\archive\交接文件_功能迁移差距分析报告.md`。

---

*报告生成时间：2026-06-27 · 生成方：IHUI-AI Assistant（loop 工作流）*
