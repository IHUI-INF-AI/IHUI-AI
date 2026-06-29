/**
 * API 统一导出文件 index.ts 单元测试
 * 目标: 验证所有模块都被正确导出, 提升覆盖率
 */

import { describe, it, expect } from 'vitest'
import * as apiIndex from '../index'
import apiDefault, { api as apiNamed } from '../index'

describe('api/index.ts 统一导出', () => {
  // ========== 核心 API 客户端 ==========
  describe('核心 API 客户端导出', () => {
    it('应该导出 ApiClient 类', () => {
      expect(apiIndex.ApiClient).toBeDefined()
      expect(typeof apiIndex.ApiClient).toBe('function')
    })

    it('应该导出 coreApiClient 实例', () => {
      expect(apiIndex.coreApiClient).toBeDefined()
    })
  })

  // ========== 生成的 API 客户端 ==========
  describe('生成的 API 客户端导出', () => {
    it('应该导出 apiClient 实例', () => {
      expect(apiIndex.apiClient).toBeDefined()
    })

    it('应该导出 APIClient 类', () => {
      expect(apiIndex.APIClient).toBeDefined()
      expect(typeof apiIndex.APIClient).toBe('function')
    })
  })

  // ========== v2 业务封装层 ==========
  describe('v2 业务封装层导出', () => {
    it('应该导出 v2Agents', () => {
      expect(apiIndex.v2Agents).toBeDefined()
      expect(typeof apiIndex.v2Agents).toBe('object')
    })

    it('应该导出 v2Courses', () => {
      expect(apiIndex.v2Courses).toBeDefined()
      expect(typeof apiIndex.v2Courses).toBe('object')
    })

    it('应该导出 probeV2Available 函数', () => {
      expect(typeof apiIndex.probeV2Available).toBe('function')
    })
  })

  // ========== 认证相关 API ==========
  describe('认证相关 API 命名空间', () => {
    const authModules = [
      'authApi',
      'authAccountsApi',
      'authInfoApi',
      'authTokensApi',
      'authUserApi',
      'authUserVipApi',
      'authVipLevelApi',
      'authVeriCodesApi',
    ]
    it.each(authModules)('应该导出 %s 命名空间', (name) => {
      expect((apiIndex as Record<string, unknown>)[name]).toBeDefined()
      expect(typeof (apiIndex as Record<string, unknown>)[name]).toBe('object')
    })
  })

  // ========== 用户相关 API ==========
  describe('用户相关 API 命名空间', () => {
    const userModules = [
      'userApi',
      'userExportApi',
      'userMarginApi',
      'userPlatformApi',
      'userSysLinkApi',
    ]
    it.each(userModules)('应该导出 %s 命名空间', (name) => {
      expect((apiIndex as Record<string, unknown>)[name]).toBeDefined()
    })
  })

  // ========== 文件相关 API ==========
  describe('文件相关 API 命名空间', () => {
    it('应该导出 filesApi', () => {
      expect(apiIndex.filesApi).toBeDefined()
    })
    it('应该导出 fileUploadApi', () => {
      expect(apiIndex.fileUploadApi).toBeDefined()
    })
  })

  // ========== 聊天相关 API ==========
  describe('聊天相关 API 命名空间', () => {
    const chatModules = ['chatApi', 'chatHistoryApi', 'aiChatApi']
    it.each(chatModules)('应该导出 %s 命名空间', (name) => {
      expect((apiIndex as Record<string, unknown>)[name]).toBeDefined()
    })
  })

  // ========== Agent 相关 API ==========
  describe('Agent 相关 API 命名空间', () => {
    const agentModules = [
      'agentsApi',
      'agentApi',
      'agentBuyApi',
      'agentCategoryApi',
      'agentCategoryCacheApi',
      'agentDeveloperApi',
      'agentExamineApi',
      'agentSettlementApi',
      'agentTaskApi',
      'agentWithdrawalApi',
      'openclawApi',
    ]
    it.each(agentModules)('应该导出 %s 命名空间', (name) => {
      expect((apiIndex as Record<string, unknown>)[name]).toBeDefined()
    })
  })

  // ========== AI 相关 API ==========
  describe('AI 相关 API 命名空间', () => {
    const aiModules = [
      'aiApi',
      'aiCareerApi',
      'aiChatTypesApi',
      'aiCommunityApi',
      'aiGenerationApi',
      'aiIndexApi',
      'aiModelsApi',
      'aiProxyApi',
      'aiTeamApi',
      'aiWorldApi',
      'aiModelInfoApi',
      'aigcApi',
    ]
    it.each(aiModules)('应该导出 %s 命名空间', (name) => {
      expect((apiIndex as Record<string, unknown>)[name]).toBeDefined()
    })
  })

  // ========== 课程/业务相关 API ==========
  describe('课程/业务相关 API 命名空间', () => {
    const courseModules = [
      'businessCardApi',
      'communityApi',
      'coursesApi',
      'courseApi',
      'courseAuditApi',
      'coursePayApi',
      'coursePayLogApi',
      'coursePlanetApi',
    ]
    it.each(courseModules)('应该导出 %s 命名空间', (name) => {
      expect((apiIndex as Record<string, unknown>)[name]).toBeDefined()
    })
  })

  // ========== 支付相关 API ==========
  describe('支付相关 API 命名空间', () => {
    const payModules = [
      'paymentApi',
      'aliPayApi',
      'topUpApi',
      'refundApi',
      'ordersApi',
      'billingApi',
      'walletApi',
      'withdrawalApi',
      'commissionApi',
    ]
    it.each(payModules)('应该导出 %s 命名空间', (name) => {
      expect((apiIndex as Record<string, unknown>)[name]).toBeDefined()
    })
  })

  // ========== 会员/平台/内容相关 API ==========
  describe('会员/平台/内容相关 API 命名空间', () => {
    const modules = [
      'vipApi',
      'platformsApi',
      'appsApi',
      'appVersionApi',
      'miniprogramApi',
      'favoritesApi',
      'feedbackApi',
      'shareApi',
      'knowledgeApi',
      'knowledgePlanetApi',
      'docsApi',
      'xuqiuApi',
    ]
    it.each(modules)('应该导出 %s 命名空间', (name) => {
      expect((apiIndex as Record<string, unknown>)[name]).toBeDefined()
    })
  })

  // ========== 统计/任务/设置相关 API ==========
  describe('统计/任务/设置相关 API 命名空间', () => {
    const modules = [
      'statisticsApi',
      'rankingsApi',
      'tokenValueApi',
      'tasksApi',
      'messageApi',
      'notificationApi',
      'ticketsApi',
      'settingsApi',
      'securityApi',
      'helpApi',
    ]
    it.each(modules)('应该导出 %s 命名空间', (name) => {
      expect((apiIndex as Record<string, unknown>)[name]).toBeDefined()
    })
  })

  // ========== 开发者/API管理相关 API ==========
  describe('开发者/API管理相关 API 命名空间', () => {
    const modules = [
      'developerApi',
      'developerPermissionsApi',
      'sdksApi',
      'webhooksApi',
      'oauthApi',
      'oauthAppsApi',
      'ssoApi',
      'modelsApi',
      'apisApi',
      'apiServiceApi',
      'apiUtilsApi',
      'groupsApi',
      'packagesApi',
      'gatewayApi',
    ]
    it.each(modules)('应该导出 %s 命名空间', (name) => {
      expect((apiIndex as Record<string, unknown>)[name]).toBeDefined()
    })
  })

  // ========== N8N/MCP/技能/工具相关 API ==========
  describe('N8N/MCP/技能/工具相关 API 命名空间', () => {
    const modules = [
      'n8nApi',
      'n8nAgentsApi',
      'mcpApi',
      'skillsApi',
      'skillsBackendApi',
      'skillsEnhancedAiApi',
      'toolsApi',
      'pluginsApi',
      'workflowsApi',
    ]
    it.each(modules)('应该导出 %s 命名空间', (name) => {
      expect((apiIndex as Record<string, unknown>)[name]).toBeDefined()
    })
  })

  // ========== 分类/分销/服务相关 API ==========
  describe('分类/分销/服务相关 API 命名空间', () => {
    const modules = [
      'categoryApi',
      'categoryLinkApi',
      'categoryDictionaryApi',
      'distributionApi',
      'traderApi',
      'fundApi',
      'shopApi',
      'customerServiceApi',
      'serviceAppointmentApi',
      'contentGenerationApi',
      'batchOperationsApi',
    ]
    it.each(modules)('应该导出 %s 命名空间', (name) => {
      expect((apiIndex as Record<string, unknown>)[name]).toBeDefined()
    })
  })

  // ========== 智汇商/其他 API ==========
  describe('智汇商/其他 API 命名空间', () => {
    const modules = [
      'zhsActivityApi',
      'zhsAdvertiseApi',
      'zhsAgentApi',
      'zhsBannerCarouselApi',
      'homeApi',
      'fastapiApi',
      'remoteApi',
      'remoteAgentTaskApi',
      'monitoringApi',
      'productIdentityApi',
      'userAgentContextApi',
      'unifiedAiApi',
      'unifiedAuthApi',
      'unifiedWechatApi',
      'studyApi',
      'subordinatesApi',
      'invoiceApi',
      'pricingApi',
    ]
    it.each(modules)('应该导出 %s 命名空间', (name) => {
      expect((apiIndex as Record<string, unknown>)[name]).toBeDefined()
    })
  })

  // ========== api 命名空间对象 ==========
  describe('api 命名空间对象', () => {
    it('应该导出 api 空对象', () => {
      expect(apiNamed).toBeDefined()
      expect(typeof apiNamed).toBe('object')
    })

    it('默认导出应该是 api 对象', () => {
      expect(apiDefault).toBeDefined()
      expect(apiDefault).toBe(apiNamed)
    })
  })
})
