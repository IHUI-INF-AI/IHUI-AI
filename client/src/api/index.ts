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
export * as authApi from './auth'
export * as authAccountsApi from './auth-accounts'
export * as authInfoApi from './auth-info'
export * as authTokensApi from './auth-tokens'
export * as authUserApi from './auth-user'
export * as authUserVipApi from './auth-user-vip'
export * as authVipLevelApi from './auth-vip-level'
export * as authVeriCodesApi from './auth-veri-codes'

// 导出用户相关 API
export * as userApi from './user'
export * as userExportApi from './user-export'
export * as userMarginApi from './user-margin'
export * as userPlatformApi from './user-platform'
export * as userSysLinkApi from './user-sys-link'

// 导出文件相关 API
export * as filesApi from './files'
export * as fileUploadApi from './file-upload'

// 导出聊天相关 API
export * as chatApi from './chat'
export * as chatHistoryApi from './chat-history'
export * as aiChatApi from './aiChat'

// 导出代理/Agent相关 API
export * as agentsApi from './agents'
export * as agentApi from './agent'
export * as agentBuyApi from './agent-buy'
export * as agentCategoryApi from './agent-category'
export * as agentCategoryCacheApi from './agent-category-cache'
export * as agentDeveloperApi from './agent-developer'
export * as agentExamineApi from './agent-examine'
export * as agentSettlementApi from './agent-settlement'
export * as agentTaskApi from './agent-task'
export * as agentWithdrawalApi from './agent-withdrawal'

// 导出 OpenClaw AI Agent API
export * as openclawApi from './openclaw'

// 导出 AI 相关 API
export * as aiApi from './ai'
export * as aiCareerApi from './ai-career'
export * as aiChatTypesApi from './ai-chat-types'
export * as aiCommunityApi from './ai-community'
export * as aiGenerationApi from './ai-generation'
export * as aiIndexApi from './ai-index'
export * as aiModelsApi from './ai-models'
export * as aiProxyApi from './ai-proxy'
export * as aiTeamApi from './ai-team'
export * as aiWorldApi from './ai-world'
export * as aiModelInfoApi from './aiModelInfo'
export * as aigcApi from './aigc'

// 导出业务相关 API
export * as businessCardApi from './business-card'
export * as communityApi from './community'
export * as coursesApi from './courses'
export * as courseApi from './course'
export * as courseAuditApi from './course-audit'
export * as coursePayApi from './course-pay'
export * as coursePayLogApi from './course-pay-log'
export * as coursePlanetApi from './course-planet'

// 导出支付相关 API
export * as paymentApi from './payment'
export * as aliPayApi from './ali-pay'
export * as topUpApi from './top-up'
export * as refundApi from './refund'
export * as ordersApi from './orders'
export * as billingApi from './billing'
export * as walletApi from './wallet'
export * as withdrawalApi from './withdrawal'
export * as commissionApi from './commission'

// 导出会员相关 API
export * as vipApi from './vip'

// 导出平台相关 API
export * as platformsApi from './platforms'
export * as appsApi from './apps'
export * as appVersionApi from './app-version'
export * as miniprogramApi from './miniprogram'

// 导出内容相关 API
export * as favoritesApi from './favorites'
export * as feedbackApi from './feedback'
export * as shareApi from './share'
export * as knowledgeApi from './knowledge'
export * as knowledgePlanetApi from './knowledge-planet'
export * as docsApi from './docs'
export * as xuqiuApi from './xuqiu'

// 导出统计相关 API
export * as statisticsApi from './statistics'
export * as rankingsApi from './rankings'
export * as tokenValueApi from './token-value'

// 导出任务相关 API
export * as tasksApi from './tasks'
export * as messageApi from './message'
export * as notificationApi from './notification'
export * as ticketsApi from './tickets'

// 导出设置相关 API
export * as settingsApi from './settings'
export * as securityApi from './security'
export * as helpApi from './help'

// 导出开发者相关 API
export * as developerApi from './developer'
export * as developerPermissionsApi from './developer-permissions'
export * as sdksApi from './sdks'
export * as webhooksApi from './webhooks'
export * as oauthApi from './oauth'
export * as oauthAppsApi from './oauth2-auth'
export * as ssoApi from './sso'

// 导出模型相关 API
export * as modelsApi from './models'

// 导出API管理相关
export * as apisApi from './apis'
export * as apiServiceApi from './api-service'
export * as apiUtilsApi from './api-utils'
export * as groupsApi from './groups'
export * as packagesApi from './packages'
export * as gatewayApi from './gateway'

// 导出N8N相关 API
export * as n8nApi from './n8n'
export * as n8nAgentsApi from './n8n-agents'

// 导出MCP相关 API
export * as mcpApi from './mcp'

// 导出技能相关 API
export * as skillsApi from './skills'
export * as skillsBackendApi from './skills-backend'
export * as skillsEnhancedAiApi from './skills-enhanced-ai'

// 导出工具相关 API
export * as toolsApi from './tools'
export * as pluginsApi from './plugins'
export * as workflowsApi from './workflows'

// 导出分类相关 API
export * as categoryApi from './category'
export * as categoryLinkApi from './category-link'
export * as categoryDictionaryApi from './category-dictionary'

// 导出分销相关 API
export * as distributionApi from './distribution'
export * as traderApi from './trader'
export * as fundApi from './fund'
export * as shopApi from './shop'

// 导出服务相关 API
export * as customerServiceApi from './customer-service'
export * as serviceAppointmentApi from './service-appointment'

// 导出内容生成相关 API
export * as contentGenerationApi from './content-generation'
export * as batchOperationsApi from './batchOperations'

// 导出智汇商相关 API
export * as zhsActivityApi from './zhs-activity'
export * as zhsAdvertiseApi from './zhs-advertise'
export * as zhsAgentApi from './zhs-agent'
export * as zhsBannerCarouselApi from './zhs-banner-carousel'

// 导出其他 API
export * as homeApi from './home'
export * as fastapiApi from './fastapi'
export * as remoteApi from './remote'
export * as remoteAgentTaskApi from './remote-agent-task'
export * as monitoringApi from './monitoring'
export * as productIdentityApi from './product-identity'
export * as userAgentContextApi from './user-agent-context'
export * as unifiedAiApi from './unified-ai'
export * as unifiedAlipayApi from './unified-alipay'
export * as unifiedAuthApi from './unified-auth'
export * as unifiedWechatApi from './unified-wechat'
export * as studyApi from './study'
export * as subordinatesApi from './subordinates'
export * as invoiceApi from './invoice'
export * as pricingApi from './pricing'

// 导出业务相关 API
export const api = {}

// 默认导出
export default api
