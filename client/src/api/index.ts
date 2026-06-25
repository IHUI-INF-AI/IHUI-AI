/**
 * API 模块统一导出
 * 提供便捷的 API 访问入口
 */

// 导出核心 API 客户端
export { ApiClient, apiClient as coreApiClient } from './core/client'
export type { ApiClientConfig as CoreApiClientConfig, ApiRequestConfig, ApiError } from './core/types'

// 导出生成的 API 客户端
export { apiClient, APIClient } from './generated-client'
export type { APIClientConfig, ApiResponse, ApiErrorResponse } from './generated-client'

// v2 业务封装层 (已简化为纯 v1 调用, 保留导出名称兼容)
export { v2Agents, v2Courses, v2Orders, v2User, probeV2Available } from './v2-business'

// 导出认证相关 API
export * as authApi from './auth/auth'
export * as authAccountsApi from './auth/auth-accounts'
export * as authInfoApi from './auth/auth-info'
export * as authTokensApi from './auth/auth-tokens'
export * as authUserApi from './auth/auth-user'
export * as authUserVipApi from './auth/auth-user-vip'
export * as authVipLevelApi from './auth/auth-vip-level'
export * as authVeriCodesApi from './auth/auth-veri-codes'

// 导出用户相关 API
export * as userApi from './user/user'
export * as userExportApi from './user/user-export'
export * as userMarginApi from './user/user-margin'
export * as userPlatformApi from './user/user-platform'
export * as userSysLinkApi from './user/user-sys-link'

// 导出文件相关 API
export * as filesApi from './file/files'
export * as fileUploadApi from './file/file-upload'

// 导出聊天相关 API
export * as chatApi from './chat/chat'
export * as chatHistoryApi from './chat/chat-history'
export * as aiChatApi from './ai/aiChat'

// 导出代理/Agent相关 API
export * as agentsApi from './agent/agents'
export * as agentApi from './agent/agent'
export * as agentBuyApi from './agent/agent-buy'
export * as agentCategoryApi from './agent/agent-category'
export * as agentCategoryCacheApi from './agent/agent-category-cache'
export * as agentDeveloperApi from './agent/agent-developer'
export * as agentExamineApi from './agent/agent-examine'
export * as agentSettlementApi from './agent/agent-settlement'
export * as agentTaskApi from './agent/agent-task'
export * as agentWithdrawalApi from './agent/agent-withdrawal'

// 导出 OpenClaw AI Agent API
export * as openclawApi from './tools/openclaw'

// 导出 AI 相关 API
export * as aiApi from './ai/ai'
export * as aiCareerApi from './ai/ai-career'
export * as aiChatTypesApi from './ai/ai-chat-types'
export * as aiCommunityApi from './ai/ai-community'
export * as aiGenerationApi from './ai/ai-generation'
export * as aiIndexApi from './ai/ai-index'
export * as aiModelsApi from './ai/ai-models'
export * as aiProxyApi from './ai/ai-proxy'
export * as aiTeamApi from './ai/ai-team'
export * as aiWorldApi from './ai/ai-world'
export * as aiModelInfoApi from './ai/aiModelInfo'
export * as aigcApi from './ai/aigc'

// 导出业务相关 API
export * as businessCardApi from './content/business-card'
export * as communityApi from './content/community'
export * as coursesApi from './course/courses'
export * as courseApi from './course/course'
export * as courseAuditApi from './course/course-audit'
export * as coursePayApi from './course/course-pay'
export * as coursePayLogApi from './course/course-pay-log'
export * as coursePlanetApi from './course/course-planet'

// 导出支付相关 API
export * as paymentApi from './payment/payment'
export * as aliPayApi from './payment/ali-pay'
export * as topUpApi from './payment/top-up'
export * as refundApi from './payment/refund'
export * as ordersApi from './payment/orders'
export * as billingApi from './payment/billing'
export * as walletApi from './payment/wallet'
export * as withdrawalApi from './payment/withdrawal'
export * as commissionApi from './payment/commission'

// 导出会员相关 API
export * as vipApi from './vip'

// 导出平台相关 API
export * as platformsApi from './platform/platforms'
export * as appsApi from './app/apps'
export * as appVersionApi from './app/app-version'
export * as miniprogramApi from './platform/miniprogram'

// 导出内容相关 API
export * as favoritesApi from './content/favorites'
export * as feedbackApi from './content/feedback'
export * as shareApi from './content/share'
export * as knowledgeApi from './knowledge/knowledge'
export * as knowledgePlanetApi from './knowledge/knowledge-planet'
export * as docsApi from './learn/docs'
export * as xuqiuApi from './content/xuqiu'

// 导出统计相关 API
export * as statisticsApi from './statistics/statistics'
export * as rankingsApi from './ranking/rankings'
export * as tokenValueApi from './statistics/token-value'

// 导出任务相关 API
export * as tasksApi from './system/tasks'
export * as messageApi from './system/message'
export * as notificationApi from './system/notification'
export * as ticketsApi from './system/tickets'

// 导出设置相关 API
export * as settingsApi from './system/settings'
export * as securityApi from './system/security'
export * as helpApi from './system/help'

// 导出开发者相关 API
export * as developerApi from './developer/developer'
export * as developerPermissionsApi from './developer/developer-permissions'
export * as sdksApi from './sdks'
export * as webhooksApi from './webhooks'
export * as oauthApi from './oauth/oauth'
export * as oauthAppsApi from './oauth/oauth2-auth'
export * as ssoApi from './sso'

// 导出模型相关 API
export * as modelsApi from './models/models'

// 导出API管理相关
export * as apisApi from './system/apis'
export * as apiServiceApi from './api-mgmt/api-service'
export * as apiUtilsApi from './api-mgmt/api-utils'
export * as groupsApi from './groups'
export * as packagesApi from './packages'
export * as gatewayApi from './platform/gateway'

// 导出N8N相关 API
export * as n8nApi from './n8n/n8n'
export * as n8nAgentsApi from './n8n/n8n-agents'

// 导出MCP相关 API
export * as mcpApi from './tools/mcp'

// 导出技能相关 API
export * as skillsApi from './skills/skills'
export * as skillsBackendApi from './skills/skills-backend'
export * as skillsEnhancedAiApi from './skills/skills-enhanced-ai'

// 导出工具相关 API
export * as toolsApi from './tools/tools'
export * as pluginsApi from './platform/plugins'
export * as workflowsApi from './tools/workflows'

// 导出分类相关 API
export * as categoryApi from './category/category'
export * as categoryLinkApi from './category/category-link'
export * as categoryDictionaryApi from './category/category-dictionary'

// 导出分销相关 API
export * as distributionApi from './distribution/distribution'
export * as traderApi from './payment/trader'
export * as fundApi from './payment/fund'
export * as shopApi from './distribution/shop'

// 导出服务相关 API
export * as customerServiceApi from './customer-service'
export * as serviceAppointmentApi from './service-appointment'

// 导出内容生成相关 API
export * as contentGenerationApi from './content/content-generation'
export * as batchOperationsApi from './batchOperations'

// 导出智汇商相关 API
export * as zhsActivityApi from './zhs/zhs-activity'
export * as zhsAdvertiseApi from './zhs/zhs-advertise'
export * as zhsAgentApi from './zhs/zhs-agent'
export * as zhsBannerCarouselApi from './zhs/zhs-banner-carousel'

// 导出其他 API
export * as homeApi from './system/home'
export * as fastapiApi from './system/fastapi'
export * as remoteApi from './remote/remote'
export * as remoteAgentTaskApi from './remote/remote-agent-task'
export * as monitoringApi from './system/monitoring'
export * as productIdentityApi from './platform/product-identity'
export * as userAgentContextApi from './user/user-agent-context'
export * as unifiedAiApi from './unified/unified-ai'
export * as unifiedAlipayApi from './unified/unified-alipay'
export * as unifiedAuthApi from './unified/unified-auth'
export * as unifiedWechatApi from './unified/unified-wechat'
export * as studyApi from './learn/study'
export * as subordinatesApi from './distribution/subordinates'
export * as invoiceApi from './payment/invoice'
export * as pricingApi from './pricing'

// 导出业务相关 API
export const api = {}

// 默认导出
export default api
