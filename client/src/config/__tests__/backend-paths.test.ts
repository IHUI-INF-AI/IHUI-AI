import { describe, it, expect } from 'vitest'
import {
  JAVA_CONTEXT_PATH,
  JAVA_API_BASE,
  JAVA_CHAT_HISTORY_PREFIX,
  JAVA_CHAT_HISTORY_BASE,
  AUTH_PATHS,
  LOGIN_PWD_PATHS,
  DEVELOPER_PATHS,
  COZE_PREFIX,
  COZE_PATHS,
  SERVICE_APPOINTMENT_PATHS,
  NOTIFICATION_PATHS,
  CUSTOMER_SERVICE_PATHS,
  WALLET_PATHS,
  COMMUNITY_PATHS,
  API_V1_PATHS,
  TOOLS_PATHS,
  CONTENT_PATHS,
  REMOTE_PATHS,
  UPLOAD_PATHS,
  API_AGENTS_PATHS,
  AGENTS_LEGACY_PATHS,
  API_ORDERS_PATHS,
  API_USER_PATHS,
  API_MODELS_PATHS,
  API_SERVICE_PATHS,
  UNIFIED_AI_PATHS,
  PRODUCT_IDENTITY_PATHS,
  AGENT_CATEGORY_PATHS,
  COURSES_API_PATHS,
  COURSE_PATHS,
  MOBILE_ORDERS_PATHS,
  DEVELOPER_ORDERS_PATHS,
  DISTRIBUTION_PATHS,
  OPENCLAW_PATHS,
  USER_SETTINGS_PATHS,
} from '../backend-paths'

// 后端 API 路径常量测试，覆盖所有导出项

describe('backend-paths.ts', () => {
  // Java 后端基础前缀
  describe('Java后端路径', () => {
    it('基础常量应该正确', () => {
      expect(JAVA_CONTEXT_PATH).toBe('/ai-program')
      expect(JAVA_API_BASE).toBe('/api/ai-program')
      expect(JAVA_CHAT_HISTORY_PREFIX).toBe('/ai/chat-history')
      expect(JAVA_CHAT_HISTORY_BASE).toBe('/api/ai-program/ai/chat-history')
    })
  })

  // 认证路径 (2026-06-21 联调: 对齐后端 v1/auth)
  describe('AUTH_PATHS', () => {
    it('应该包含正确的认证路径', () => {
      expect(AUTH_PATHS.login).toBe('/api/v1/auth/login')
      expect(AUTH_PATHS.register).toBe('/api/v1/auth/register')
      expect(AUTH_PATHS.logout).toBe('/api/v1/auth/logout')
      expect(AUTH_PATHS.profile).toBe('/api/v1/auth/profile')
      expect(AUTH_PATHS.health).toBe('/api/v1/auth/health')
      expect(AUTH_PATHS.code).toBe('/api/code')
      expect(AUTH_PATHS.user).toBe('/api/v1/auth/user')
    })
  })

  // 登录密码路径 (2026-06-21 联调: 对齐后端 v1/auth)
  describe('LOGIN_PWD_PATHS', () => {
    it('应该包含正确的登录密码路径', () => {
      expect(LOGIN_PWD_PATHS.registerLogin).toBe('/api/v1/auth/register')
      expect(LOGIN_PWD_PATHS.refreshToken).toBe('/api/v1/auth/refresh')
      expect(LOGIN_PWD_PATHS.editPasswd).toBe('/api/v1/auth/profile/password')
      expect(LOGIN_PWD_PATHS.smsVerify).toBe('/api/v1/auth/sms/verify')
      expect(LOGIN_PWD_PATHS.login).toBe('/api/v1/auth/login')
      expect(LOGIN_PWD_PATHS.verify).toBe('/api/v1/auth/sms/verify')
      expect(LOGIN_PWD_PATHS.replacePhone).toBe('/api/v1/auth/profile/phone')
      expect(LOGIN_PWD_PATHS.setEmail).toBe('/api/v1/auth/profile/email')
      expect(LOGIN_PWD_PATHS.modifyPassword).toBe('/api/v1/auth/profile/password')
      expect(LOGIN_PWD_PATHS.sendBatchSms).toBe('/api/v1/auth/sms/code')
    })
  })

  // 开发者路径
  describe('DEVELOPER_PATHS', () => {
    it('基础与 apiKeys 路径应该正确', () => {
      expect(DEVELOPER_PATHS.base).toBe('/api/developer')
      expect(DEVELOPER_PATHS.apiKeys).toBe('/api/developer/api-keys')
    })

    it('aiChat 路径应该正确', () => {
      expect(DEVELOPER_PATHS.aiChat.sessions).toBe('/api/developer/ai/chat/sessions')
      expect(DEVELOPER_PATHS.aiChat.sessionById('123')).toBe('/api/developer/ai/chat/sessions/123')
      expect(DEVELOPER_PATHS.aiChat.sessionMessages('s1')).toBe('/api/developer/ai/chat/sessions/s1/messages')
    })

    it('workflows 路径应该正确', () => {
      const w = DEVELOPER_PATHS.workflows
      expect(w.list).toBe('/api/developer/workflows')
      expect(w.byId('w1')).toBe('/api/developer/workflows/w1')
      expect(w.publish('w1')).toBe('/api/developer/workflows/w1/publish')
      expect(w.execute('w1')).toBe('/api/developer/workflows/w1/execute')
      expect(w.executions('w1')).toBe('/api/developer/workflows/w1/executions')
      expect(w.executionById('w1', 'e1')).toBe('/api/developer/workflows/w1/executions/e1')
      expect(w.executionCancel('w1', 'e1')).toBe('/api/developer/workflows/w1/executions/e1/cancel')
    })

    it('mcp 路径应该正确', () => {
      const m = DEVELOPER_PATHS.mcp
      expect(m.servers).toBe('/api/developer/mcp/servers')
      expect(m.serverById('s1')).toBe('/api/developer/mcp/servers/s1')
      expect(m.test('s1')).toBe('/api/developer/mcp/servers/s1/test')
      expect(m.capabilities('s1')).toBe('/api/developer/mcp/servers/s1/capabilities')
      expect(m.tool('s1', 't1')).toBe('/api/developer/mcp/servers/s1/tools/t1')
      expect(m.resource('s1', 'res://x')).toBe('/api/developer/mcp/servers/s1/resources/res%3A%2F%2Fx')
      expect(m.prompt('s1', 'p1')).toBe('/api/developer/mcp/servers/s1/prompts/p1')
    })

    it('models 路径应该正确', () => {
      const m = DEVELOPER_PATHS.models
      expect(m.list).toBe('/api/developer/models')
      expect(m.byId('m1')).toBe('/api/developer/models/m1')
      expect(m.test('m1')).toBe('/api/developer/models/m1/test')
      expect(m.chat('m1')).toBe('/api/developer/models/m1/chat')
      expect(m.batch).toBe('/api/developer/models/batch')
      expect(m.batchToggle).toBe('/api/developer/models/batch/toggle')
      expect(m.pricing('m1')).toBe('/api/developer/models/m1/pricing')
      expect(m.proxy('m1')).toBe('/api/developer/models/m1/proxy')
      expect(m.proxyTest('m1')).toBe('/api/developer/models/m1/proxy/test')
      expect(m.proxyHealth('m1')).toBe('/api/developer/models/m1/proxy/health')
    })

    it('sdks 路径应该正确', () => {
      const s = DEVELOPER_PATHS.sdks
      expect(s.list).toBe('/api/developer/sdks')
      expect(s.byId('s1')).toBe('/api/developer/sdks/s1')
      expect(s.generate('s1')).toBe('/api/developer/sdks/s1/generate')
      expect(s.download('s1')).toBe('/api/developer/sdks/s1/download')
    })

    it('platforms 路径应该正确', () => {
      const p = DEVELOPER_PATHS.platforms
      expect(p.list).toBe('/api/developer/platforms')
      expect(p.byId('p1')).toBe('/api/developer/platforms/p1')
      expect(p.test).toBe('/api/developer/platforms/test')
      expect(p.stats).toBe('/api/developer/platforms/stats')
      expect(p.sync('p1')).toBe('/api/developer/platforms/p1/sync')
    })

    it('plugins 路径应该正确', () => {
      const p = DEVELOPER_PATHS.plugins
      expect(p.list).toBe('/api/developer/plugins')
      expect(p.byId('p1')).toBe('/api/developer/plugins/p1')
      expect(p.publish('p1')).toBe('/api/developer/plugins/p1/publish')
      expect(p.test('p1')).toBe('/api/developer/plugins/p1/test')
    })

    it('gateways 路径应该正确', () => {
      const g = DEVELOPER_PATHS.gateways
      expect(g.list).toBe('/api/developer/gateways')
      expect(g.byId('g1')).toBe('/api/developer/gateways/g1')
      expect(g.endpoints('g1')).toBe('/api/developer/gateways/g1/endpoints')
      expect(g.endpointDelete('g1', 'e1')).toBe('/api/developer/gateways/g1/endpoints/e1')
      expect(g.endpointTest('g1', 'e1')).toBe('/api/developer/gateways/g1/endpoints/e1/test')
      expect(g.stats('g1')).toBe('/api/developer/gateways/g1/stats')
    })

    it('apis 路径应该正确', () => {
      const a = DEVELOPER_PATHS.apis
      expect(a.list).toBe('/api/developer/apis')
      expect(a.byId('a1')).toBe('/api/developer/apis/a1')
      expect(a.test('a1')).toBe('/api/developer/apis/a1/test')
      expect(a.documentation('a1')).toBe('/api/developer/apis/a1/documentation')
      expect(a.documentationGenerate('a1')).toBe('/api/developer/apis/a1/documentation/generate')
      expect(a.documentationExport('a1')).toBe('/api/developer/apis/a1/documentation/export')
      expect(a.versions('a1')).toBe('/api/developer/apis/a1/versions')
      expect(a.versionSwitch('a1', 'v1')).toBe('/api/developer/apis/a1/versions/v1/switch')
      expect(a.testCases('a1')).toBe('/api/developer/apis/a1/test-cases')
      expect(a.testCaseById('a1', 't1')).toBe('/api/developer/apis/a1/test-cases/t1')
      expect(a.testHistory('a1')).toBe('/api/developer/apis/a1/test-history')
    })

    it('webhooks 路径应该正确', () => {
      const w = DEVELOPER_PATHS.webhooks
      expect(w.list).toBe('/api/developer/webhooks')
      expect(w.byId('w1')).toBe('/api/developer/webhooks/w1')
      expect(w.test('w1')).toBe('/api/developer/webhooks/w1/test')
      expect(w.events('w1')).toBe('/api/developer/webhooks/w1/events')
      expect(w.eventTypes).toBe('/api/developer/webhooks/events/types')
      expect(w.stats).toBe('/api/developer/webhooks/stats')
      expect(w.batch).toBe('/api/developer/webhooks/batch')
    })

    it('statistics 路径应该正确', () => {
      const s = DEVELOPER_PATHS.statistics
      expect(s.performance).toBe('/api/developer/statistics/performance')
      expect(s.errors).toBe('/api/developer/statistics/errors')
      expect(s.errorResolve('e1')).toBe('/api/developer/statistics/errors/e1/resolve')
      expect(s.export).toBe('/api/developer/statistics/export')
      expect(s.realtime).toBe('/api/developer/statistics/realtime')
    })

    it('pricing 路径应该正确', () => {
      expect(DEVELOPER_PATHS.pricing.calculate).toBe('/api/developer/pricing/calculate')
    })
  })

  // COZE 路径
  describe('COZE_PATHS', () => {
    it('COZE_PREFIX 应该正确', () => {
      expect(COZE_PREFIX).toBe('/cozeZhsApi')
    })

    it('aiModelInfo 路径应该正确', () => {
      const a = COZE_PATHS.aiModelInfo
      expect(a.list).toBe('/ihui-ai-api/llm/models-unify')
      expect(a.add).toBe('/cozeZhsApi/ai-model-info/add')
      expect(a.update).toBe('/cozeZhsApi/ai-model-info/update')
      expect(a.delete).toBe('/cozeZhsApi/ai-model-info/delete')
    })

    it('aiModels 路径应该正确', () => {
      expect(COZE_PATHS.aiModels.list).toBe('/cozeZhsApi/ai/models')
      expect(COZE_PATHS.aiModels.byId('m1')).toBe('/cozeZhsApi/ai/models/m1')
    })

    it('chat 路径应该正确', () => {
      expect(COZE_PATHS.chat).toBe('/cozeZhsApi/chat')
      // 2026-06-24 联调: chatStream 对齐后端 /api/v1/chat/message/stream
      expect(COZE_PATHS.chatStream).toBe('/api/v1/chat/message/stream')
    })

    it('n8n 路径应该正确', () => {
      expect(COZE_PATHS.n8n.workflows).toBe('/cozeZhsApi/n8n/workflows')
    })

    it('agent 路径应该正确', () => {
      const a = COZE_PATHS.agent
      expect(a.search).toBe('/cozeZhsApi/agent/search')
      expect(a.categories).toBe('/cozeZhsApi/agent/categories')
      expect(a.favorite('a1')).toBe('/cozeZhsApi/agent/a1/favorite')
      expect(a.usage('a1')).toBe('/cozeZhsApi/agent/a1/usage')
      expect(a.reviews('a1')).toBe('/cozeZhsApi/agent/a1/reviews')
    })

    it('file 路径应该正确', () => {
      const f = COZE_PATHS.file
      // 2026-06-24 修复: uploadForm 对齐后端 /cozeZhsApi/file/upload/form (content/file_upload.py)
      expect(f.uploadForm).toBe('/cozeZhsApi/file/upload/form')
      expect(f.uploadBase64).toBe('/api/upload/base64')
      expect(f.uploadOctet('文件.txt')).toBe('/api/upload/octet?file_name=%E6%96%87%E4%BB%B6.txt')
      expect(f.uploadAgentExamine).toBe('/api/upload/agent-examine')
      expect(f.list).toBe('/cozeZhsApi/file/list')
      expect(f.download('a b.txt')).toBe('/cozeZhsApi/file/download/a%20b.txt')
      expect(f.byId('f1')).toBe('/cozeZhsApi/file/f1')
      expect(f.fundUpload).toBe('/cozeZhsApi/fund/file/upload')
      expect(f.mobileUploadBase64).toBe('/cozeZhsApi/api/mobile/files/upload/base64')
    })

    it('ai 路径应该正确', () => {
      const a = COZE_PATHS.ai
      expect(a.models).toBe('/cozeZhsApi/ai/models')
      expect(a.modelById('m1')).toBe('/cozeZhsApi/ai/models/m1')
      expect(a.chatSessions).toBe('/cozeZhsApi/ai/chat/sessions')
      expect(a.chatSessionById('s1')).toBe('/cozeZhsApi/ai/chat/sessions/s1')
      expect(a.generate).toBe('/cozeZhsApi/ai/generate')
      expect(a.generateStream).toBe('/cozeZhsApi/ai/generate/stream')
      expect(a.providers).toBe('/cozeZhsApi/ai/providers')
      expect(a.usage).toBe('/cozeZhsApi/ai/usage')
      expect(a.chatCompletions).toBe('/cozeZhsApi/ai/chat/completions')
      expect(a.chatCompletionsStream).toBe('/cozeZhsApi/ai/chat/completions/stream')
    })

    it('payment 路径应该正确', () => {
      const p = COZE_PATHS.payment
      expect(p.status('o1')).toBe('/cozeZhsApi/payment/status/o1')
      expect(p.callbackVerify).toBe('/cozeZhsApi/payment/callback/verify')
      expect(p.statusSync('o1')).toBe('/cozeZhsApi/payment/status/sync/o1')
      expect(p.cancel('o1')).toBe('/cozeZhsApi/payment/cancel/o1')
      expect(p.alipayCreate).toBe('/cozeZhsApi/payment/alipay/create')
      expect(p.wechatCreate).toBe('/cozeZhsApi/payment/wechat/create')
      expect(p.cardCreate).toBe('/cozeZhsApi/payment/card/create')
      // 2026-06-24 联调: refund 路径对齐后端 /api/v1/refunds 真实路由
      const r = p.refund
      expect(r.apply).toBe('/api/v1/refunds')
      expect(r.list).toBe('/api/v1/refunds')
      expect(r.byRefundNo('r1')).toBe('/api/v1/refunds/r1')
      expect(r.cancel('r1')).toBe('/api/v1/refunds/r1/cancel')
      expect(r.status('r1')).toBe('/api/v1/refunds/r1')
      expect(r.audit('r1')).toBe('/api/v1/refunds/r1/review')
      expect(r.process('r1')).toBe('/api/v1/refunds/r1/review')
    })

    it('userAgentContext 路径应该正确', () => {
      expect(COZE_PATHS.userAgentContext.history).toBe('/cozeZhsApi/user-agent-context/history')
    })

    it('users 路径应该正确', () => {
      const u = COZE_PATHS.users
      expect(u.meCoze).toBe('/cozeZhsApi/users/me/coze')
      expect(u.bind).toBe('/cozeZhsApi/users/bind')
      expect(u.refreshToken).toBe('/cozeZhsApi/user/refresh-token')
    })

    it('ws 路径应该正确', () => {
      const w = COZE_PATHS.ws
      expect(w.qwen).toBe('/cozeZhsApi/ws/qwen/stream')
      expect(w.chatomni).toBe('/cozeZhsApi/ws/chatomni/stream')
      expect(w.zhipu).toBe('/cozeZhsApi/ws/zhipu/stream')
      expect(w.chatdeepseek).toBe('/cozeZhsApi/ws/chatdeepseek/stream')
      expect(w.doubao).toBe('/cozeZhsApi/ws/doubao/streamDou')
      expect(w.chat('c1')).toBe('/cozeZhsApi/ws/chat/c1')
    })

    it('index 路径应该正确', () => {
      expect(COZE_PATHS.index.resources('img')).toBe('/cozeZhsApi/index/resources/img')
    })

    it('dashscope 路径应该正确', () => {
      const d = COZE_PATHS.dashscope
      expect(d.imageGenerate('m1')).toBe('/cozeZhsApi/dashscope/image/generate/m1')
      expect(d.imageEdit).toBe('/cozeZhsApi/dashscope/image/edit')
      expect(d.imageToImage).toBe('/cozeZhsApi/dashscope/image-to-image/generate')
      expect(d.visionChat).toBe('/cozeZhsApi/dashscope/vision/chat')
      expect(d.videoGenerate).toBe('/cozeZhsApi/dashscope/video/generate')
      expect(d.videoSynthesisWs).toBe('/cozeZhsApi/dashscope/video-synthesis/ws')
    })

    it('hunyuan 路径应该正确', () => {
      expect(COZE_PATHS.hunyuan.threeDSubmit).toBe('/cozeZhsApi/hunyuan/3d/submit')
      expect(COZE_PATHS.hunyuan.threeDQuery).toBe('/cozeZhsApi/hunyuan/3d/query')
    })

    it('kling 路径应该正确', () => {
      expect(COZE_PATHS.kling.videoIdentify).toBe('/cozeZhsApi/kling/video/identify')
      expect(COZE_PATHS.kling.videoCreate).toBe('/cozeZhsApi/kling/video/create')
    })

    it('oneClickVideo 路径应该正确', () => {
      const o = COZE_PATHS.oneClickVideo
      expect(o.start).toBe('/cozeZhsApi/http/one_click_video/start')
      expect(o.status('t1')).toBe('/cozeZhsApi/http/one_click_video/status/t1')
    })

    it('proxy 路径应该正确', () => {
      expect(COZE_PATHS.proxy.doubaoImageGeneration).toBe('/cozeZhsApi/proxy/doubao-image-generation')
      expect(COZE_PATHS.proxy.jimeng4Image).toBe('/cozeZhsApi/proxy/jimeng4/image')
    })

    it('luyala 路径应该正确', () => {
      expect(COZE_PATHS.luyala.chatCompletions).toBe('/cozeZhsApi/luyala/chat/completions')
      expect(COZE_PATHS.luyala.videoCreate).toBe('/cozeZhsApi/luyala/video/create')
    })

    it('doubao 路径应该正确', () => {
      expect(COZE_PATHS.doubao.seedream40).toBe('/cozeZhsApi/doubao/seedream/4.0')
    })

    it('proxyOpenrouter 路径应该正确', () => {
      expect(COZE_PATHS.proxyOpenrouter.chatCompletions).toBe('/cozeZhsApi/proxy/openrouter/chat/completions')
    })

    it('userModelChat 路径应该正确', () => {
      const u = COZE_PATHS.userModelChat
      expect(u.create).toBe('/cozeZhsApi/user-model-chat/create')
      expect(u.query).toBe('/cozeZhsApi/user-model-chat/query')
      expect(u.updateMark).toBe('/cozeZhsApi/user-model-chat/update/mark')
      expect(u.byId('c1')).toBe('/cozeZhsApi/user-model-chat/c1')
    })

    it('userAgentContextQuery 路径应该正确', () => {
      expect(COZE_PATHS.userAgentContextQuery).toBe('/cozeZhsApi/user-agent-context/query')
    })

    it('aiCareer 路径应该正确', () => {
      expect(COZE_PATHS.aiCareer.submit).toBe('/cozeZhsApi/ai-career/submit')
    })

    it('oauthAlipay 路径应该正确', () => {
      const o = COZE_PATHS.oauthAlipay
      expect(o.qrCode).toBe('/cozeZhsApi/oauth/alipay/qr-code')
      expect(o.checkStatus).toBe('/cozeZhsApi/oauth/alipay/check-status')
      expect(o.callback).toBe('/cozeZhsApi/oauth/alipay/callback')
    })

    it('tokenValue 路径应该正确', () => {
      const t = COZE_PATHS.tokenValue
      expect(t.records).toBe('/cozeZhsApi/token-value/records')
      expect(t.balance).toBe('/cozeZhsApi/token-value/balance')
      expect(t.statistics).toBe('/cozeZhsApi/token-value/statistics')
      expect(t.packages).toBe('/cozeZhsApi/token-value/packages')
      expect(t.purchase).toBe('/cozeZhsApi/token-value/purchase')
      expect(t.orderStatus).toBe('/cozeZhsApi/token-value/order/status')
      expect(t.redeem).toBe('/cozeZhsApi/token-value/redeem')
    })

    it('developer 路径应该正确', () => {
      const d = COZE_PATHS.developer
      expect(d.apply).toBe('/cozeZhsApi/developer/apply')
      expect(d.info).toBe('/cozeZhsApi/developer/info')
      expect(d.list).toBe('/cozeZhsApi/developer/list')
      expect(d.setIdentity).toBe('/cozeZhsApi/developer/set-identity')
      expect(d.statusById('d1')).toBe('/cozeZhsApi/developer/d1/status')
      expect(d.permissions).toBe('/cozeZhsApi/developer/permissions')
    })

    it('topUp 路径应该正确', () => {
      expect(COZE_PATHS.topUp.create).toBe('/cozeZhsApi/top-up/create')
      expect(COZE_PATHS.topUp.status('o1')).toBe('/cozeZhsApi/top-up/status/o1')
    })

    it('agentCategory 路径应该正确', () => {
      const a = COZE_PATHS.agentCategory
      expect(a.agentById('a1')).toBe('/cozeZhsApi/agent-category/agent/a1')
      expect(a.create).toBe('/cozeZhsApi/agent-category/create')
      expect(a.byId('c1')).toBe('/cozeZhsApi/agent-category/c1')
    })

    it('agentBuy 路径应该正确', () => {
      expect(COZE_PATHS.agentBuy.create).toBe('/cozeZhsApi/agent-buy/create')
    })

    it('agentWithdrawalDetail 路径应该正确', () => {
      // 2026-06-25 修复#L: 对齐到 Python 后端真实端点
      expect(COZE_PATHS.agentWithdrawalDetail.list).toBe('/api/v1/agents/withdrawal/list')
    })

    it('agentSettlement 路径应该正确', () => {
      const a = COZE_PATHS.agentSettlement
      expect(a.incomeOverview).toBe('/cozeZhsApi/agent-settlement/stats/income-overview')
      expect(a.list).toBe('/cozeZhsApi/agent-settlement/list')
      expect(a.statsOverview).toBe('/cozeZhsApi/agent-settlement/stats/overview')
    })

    it('search 路径应该正确', () => {
      expect(COZE_PATHS.search.modelWorkflowRun).toBe('/cozeZhsApi/search/model/workflow/run')
    })

    it('mobileChat 路径应该正确', () => {
      const m = COZE_PATHS.mobileChat
      expect(m.conversations).toBe('/cozeZhsApi/api/mobile/chat/conversations')
      expect(m.conversationById('c1')).toBe('/cozeZhsApi/api/mobile/chat/conversations/c1')
      expect(m.conversationMessages('c1')).toBe('/cozeZhsApi/api/mobile/chat/conversations/c1/messages')
      expect(m.message).toBe('/cozeZhsApi/api/mobile/chat/message')
      expect(m.send).toBe('/cozeZhsApi/api/mobile/chat/send')
    })

    it('agents 路径应该正确', () => {
      const a = COZE_PATHS.agents
      expect(a.list).toBe('/cozeZhsApi/agents/list')
      expect(a.allList).toBe('/cozeZhsApi/agents/Alllist')
      expect(a.thumbs).toBe('/cozeZhsApi/agents/thumbs')
      expect(a.collect).toBe('/cozeZhsApi/agents/collect')
      expect(a.use).toBe('/cozeZhsApi/agents/use')
      expect(a.unpublish).toBe('/cozeZhsApi/agents/unpublish')
      expect(a.tokenBalance('u1')).toBe('/cozeZhsApi/agents/token/balance/u1')
      expect(a.userBilling).toBe('/cozeZhsApi/agents/user/billing')
      expect(a.clearCache).toBe('/cozeZhsApi/agents/clear-cache')
      expect(a.details('a1')).toBe('/cozeZhsApi/agents/a1/details')
      expect(a.fetchDetails('a1')).toBe('/cozeZhsApi/agents/a1/fetch-details')
      expect(a.billings).toBe('/cozeZhsApi/agents/billings')
      expect(a.billingById('b1')).toBe('/cozeZhsApi/agents/billings/b1')
    })

    it('statistics 路径应该正确', () => {
      const s = COZE_PATHS.statistics
      expect(s.usage).toBe('/cozeZhsApi/statistics/usage')
      expect(s.behavior).toBe('/cozeZhsApi/statistics/behavior')
      expect(s.orders).toBe('/cozeZhsApi/statistics/orders')
      expect(s.agents).toBe('/cozeZhsApi/statistics/agents')
      expect(s.system).toBe('/cozeZhsApi/statistics/system')
    })

    it('cache 路径应该正确', () => {
      const c = COZE_PATHS.cache.agentCategoryDict
      expect(c.info).toBe('/cozeZhsApi/cache/agent-category-dict/info')
      expect(c.reload).toBe('/cozeZhsApi/cache/agent-category-dict/reload')
      expect(c.convert).toBe('/cozeZhsApi/cache/agent-category-dict/convert')
      expect(c.categories).toBe('/cozeZhsApi/cache/agent-category-dict/categories')
    })

    it('agentExamine 路径应该正确', () => {
      const a = COZE_PATHS.agentExamine
      expect(a.list).toBe('/cozeZhsApi/agent-examine/list')
      expect(a.create).toBe('/cozeZhsApi/agent-examine/create')
      expect(a.byId('a1')).toBe('/cozeZhsApi/agent-examine/a1')
      expect(a.statsSummary).toBe('/cozeZhsApi/agent-examine/stats/summary')
      expect(a.approve('a1')).toBe('/cozeZhsApi/agent-examine/a1/approve')
      expect(a.reject('a1')).toBe('/cozeZhsApi/agent-examine/a1/reject')
      expect(a.syncAvatar('a1')).toBe('/cozeZhsApi/agent-examine/sync-avatar/a1')
      expect(a.batchSyncAvatar).toBe('/cozeZhsApi/agent-examine/batch-sync-avatar')
    })

    it('agentDeveloper 路径应该正确', () => {
      const a = COZE_PATHS.agentDeveloper
      expect(a.list).toBe('/cozeZhsApi/agent-developer/list')
      expect(a.create).toBe('/cozeZhsApi/agent-developer/create')
      expect(a.byId('r1')).toBe('/cozeZhsApi/agent-developer/r1')
    })

    it('variables 路径应该正确', () => {
      const v = COZE_PATHS.variables
      expect(v.base).toBe('/cozeZhsApi/variables')
      expect(v.retrieve).toBe('/cozeZhsApi/variables/retrieve')
      expect(v.list).toBe('/cozeZhsApi/variables/list')
      expect(v.update).toBe('/cozeZhsApi/variables/update')
    })

    it('oauth 路径应该正确', () => {
      const o = COZE_PATHS.oauth
      expect(o.appsList).toBe('/cozeZhsApi/oauth/apps/list')
      expect(o.appsCreate).toBe('/cozeZhsApi/oauth/apps/create')
      expect(o.appsById('c1')).toBe('/cozeZhsApi/oauth/apps/c1')
    })
  })

  // 服务预约路径
  describe('SERVICE_APPOINTMENT_PATHS', () => {
    it('应该包含正确的服务预约路径', () => {
      const s = SERVICE_APPOINTMENT_PATHS
      expect(s.base).toBe('/api/service-appointment')
      expect(s.byId('a1')).toBe('/api/service-appointment/a1')
      expect(s.cancel('a1')).toBe('/api/service-appointment/a1/cancel')
      expect(s.confirm('a1')).toBe('/api/service-appointment/a1/confirm')
      expect(s.complete('a1')).toBe('/api/service-appointment/a1/complete')
    })
  })

  // 通知路径
  describe('NOTIFICATION_PATHS', () => {
    it('应该包含正确的通知路径', () => {
      expect(NOTIFICATION_PATHS.send).toBe('/api/notification/send')
    })
  })

  // 客服路径
  describe('CUSTOMER_SERVICE_PATHS', () => {
    it('应该包含正确的客服路径', () => {
      const c = CUSTOMER_SERVICE_PATHS
      expect(c.messages).toBe('/api/v1/customer_service/messages')
      expect(c.messagesRead).toBe('/api/v1/customer_service/messages/read')
      expect(c.tickets).toBe('/api/v1/customer_service/ticket')
      expect(c.ticketById('t1')).toBe('/api/v1/customer_service/ticket/t1')
      expect(c.ticketReplies('t1')).toBe('/api/v1/customer_service/ticket/t1/replies')
      expect(c.ticketRate('t1')).toBe('/api/v1/customer_service/ticket/t1/rate')
      expect(c.ticketClose('t1')).toBe('/api/v1/customer_service/ticket/t1/close')
      expect(c.faqs).toBe('/api/v1/customer_service/faqs')
    })
  })

  // 钱包路径
  describe('WALLET_PATHS', () => {
    it('应该包含正确的钱包路径', () => {
      // 2026-06-24 联调: 对齐后端 compat_routes.py /api/v1/wallet/* 真实路由
      expect(WALLET_PATHS.info).toBe('/api/v1/wallet/balance')
      expect(WALLET_PATHS.transactions).toBe('/api/v1/wallet/transactions')
      expect(WALLET_PATHS.withdraw).toBe('/api/v1/wallet/withdraw')
    })
  })

  // 社区路径 (2026-06-21 联调: 对齐后端 v2_community.py 真实路由)
  describe('COMMUNITY_PATHS', () => {
    it('应该包含正确的社区路径', () => {
      const p = COMMUNITY_PATHS.posts
      expect(p.list).toBe('/api/v2/community/posts')
      expect(p.create).toBe('/api/v2/community/post')
      expect(p.batch).toBe('/api/v2/community/posts')
      expect(p.byId('p1')).toBe('/api/v2/community/post?id=p1')
      expect(p.like('p1')).toBe('/api/v2/community/like')
      expect(p.comments('p1')).toBe('/api/v2/community/comments?postId=p1')
      expect(COMMUNITY_PATHS.topics.list).toBe('/api/v2/community/groups')
    })
  })

  // API v1 路径
  describe('API_V1_PATHS', () => {
    it('应该包含正确的 API v1 路径', () => {
      const a = API_V1_PATHS
      expect(a.chat.process).toBe('/api/v1/chat/message')
      expect(a.model.switch).toBe('/api/v1/model/switch')
      expect(a.tools.navigation).toBe('/api/v1/tools/navigation')
      expect(a.agent.upload).toBe('/api/v1/agent/upload')
      expect(a.news.list).toBe('/api/v1/content/news')
      expect(a.news.detail('n1')).toBe('/api/v1/content/news/n1')
      expect(a.news.detail(123)).toBe('/api/v1/content/news/123')
    })
  })

  // 工具路径 (2026-06-21 联调: 对齐后端 v1/v2 真实路由)
  describe('TOOLS_PATHS', () => {
    it('应该包含正确的工具路径', () => {
      const t = TOOLS_PATHS
      expect(t.list).toBe('/api/v1/tools/list')
      expect(t.all).toBe('/api/v1/tools/list')
      expect(t.popular).toBe('/api/v2/tools/hot')
      expect(t.categories.list).toBe('/api/v1/tools/categories')
      expect(t.byId('t1')).toBe('/api/v2/tools/detail?id=t1')
      expect(t.use('t1')).toBe('/api/v2/tools/invoke')
      expect(t.batchUse).toBe('/api/v2/tools/invoke')
      expect(t.favorite('t1')).toBe('/api/v2/tools/favorite')
      expect(t.unfavorite('t1')).toBe('/api/v2/tools/favorite')
    })
  })

  // 内容路径 (2026-06-21 联调: 对齐后端 v2_content.py 真实路由)
  describe('CONTENT_PATHS', () => {
    it('应该包含正确的内容路径', () => {
      const g = CONTENT_PATHS.generation
      expect(g.text).toBe('/api/v2/content/create')
      expect(g.textBatch).toBe('/api/v2/content/create')
      expect(g.image).toBe('/api/v2/content/create')
      expect(g.video).toBe('/api/v2/content/create')
      expect(g.history).toBe('/api/v2/content/list')
    })
  })

  // 远程路径
  describe('REMOTE_PATHS', () => {
    it('应该包含正确的远程路径', () => {
      const r = REMOTE_PATHS
      expect(r.agents.interact).toBe('/remote/agents/interact')
      expect(r.agents.ruleSearch).toBe('/remote/agents/rule/search')
      expect(r.thumbs).toBe('/remote/thumbs')
      expect(r.collect).toBe('/remote/collect')
      expect(r.collectByAgent('a1')).toBe('/remote/collect/a1')
      expect(r.byCollect('u1')).toBe('/remote/agent/by/collect/u1')
      expect(r.byPay).toBe('/remote/agent/by/pay')
    })
  })

  // 上传路径
  describe('UPLOAD_PATHS', () => {
    it('应该包含正确的上传路径', () => {
      const u = UPLOAD_PATHS
      expect(u.default).toBe('/api/upload')
      expect(u.userFeedback.upload).toBe('/userFeedback/upload')
      expect(u.userFeedback.export).toBe('/userFeedback/export')
      expect(u.information.upload).toBe('/information/upload')
      expect(u.information.export).toBe('/information/export')
      expect(u.zhs_product.upload).toBe('/zhs_product/upload')
      expect(u.zhs_product.export).toBe('/zhs_product/export')
      expect(u.user_vip.upload).toBe('/user_vip/upload')
      expect(u.user_vip.export).toBe('/user_vip/export')
      expect(u.vip_level.upload).toBe('/vip_level/upload')
      expect(u.vip_level.export).toBe('/vip_level/export')
    })
  })

  // 智能体路径
  describe('API_AGENTS_PATHS', () => {
    it('应该包含正确的智能体路径', () => {
      const a = API_AGENTS_PATHS
      expect(a.byId('a1')).toBe('/api/agents/a1')
      expect(a.categories).toBe('/api/agents/categories')
      expect(a.favorite('a1')).toBe('/api/agents/a1/favorite')
      expect(a.reviews('a1')).toBe('/api/agents/a1/reviews')
    })
  })

  // 旧版智能体路径
  describe('AGENTS_LEGACY_PATHS', () => {
    it('应该包含正确的旧版智能体路径', () => {
      const a = AGENTS_LEGACY_PATHS
      expect(a.create).toBe('/agents')
      expect(a.update).toBe('/agents')
      expect(a.delete('1,2')).toBe('/agents/1,2')
      expect(a.byId('a1')).toBe('/agents/a1')
      expect(a.labelEdit).toBe('/agents/label/edit')
      expect(a.export).toBe('/agents/export')
      expect(a.editStatus).toBe('/agents/edit/status')
    })
  })

  // 订单路径
  describe('API_ORDERS_PATHS', () => {
    it('应该包含正确的订单路径', () => {
      expect(API_ORDERS_PATHS.invoice('o1')).toBe('/api/orders/o1/invoice')
    })
  })

  // 用户 API 路径
  describe('API_USER_PATHS', () => {
    it('应该包含正确的用户 API 路径', () => {
      const a = API_USER_PATHS
      expect(a.export).toBe('/api/user/export')
      expect(a.apiTokens).toBe('/api/user/api-tokens')
      expect(a.apiTokenById('t1')).toBe('/api/user/api-tokens/t1')
      expect(a.apiTokenRegenerate('t1')).toBe('/api/user/api-tokens/t1/regenerate')
      expect(a.apiUsageStats).toBe('/api/user/api-usage/stats')
      expect(a.apiUsageLogs).toBe('/api/user/api-usage/logs')
      expect(a.apiUsageLogById('l1')).toBe('/api/user/api-usage/logs/l1')
      expect(a.apiUsageLogsExport).toBe('/api/user/api-usage/logs/export')
      expect(a.apiBalance).toBe('/api/user/api-balance')
      expect(a.apiRechargeRecords).toBe('/api/user/api-recharge/records')
    })
  })

  // 模型路径
  describe('API_MODELS_PATHS', () => {
    it('应该包含正确的模型路径', () => {
      expect(API_MODELS_PATHS.pricing).toBe('/api/models/pricing')
      expect(API_MODELS_PATHS.apiInfo('m1')).toBe('/api/models/m1/api-info')
    })
  })

  // 服务路径
  describe('API_SERVICE_PATHS', () => {
    it('应该包含正确的服务路径', () => {
      expect(API_SERVICE_PATHS.config).toBe('/api/service/config')
    })
  })

  // 统一 AI 路径
  describe('UNIFIED_AI_PATHS', () => {
    it('应该包含正确的统一 AI 路径', () => {
      const u = UNIFIED_AI_PATHS
      expect(u.composition).toBe('/api/unified-ai/composition')
      expect(u.capabilities).toBe('/api/unified-ai/capabilities')
      expect(u.performance).toBe('/api/unified-ai/performance')
      expect(u.invoke).toBe('/api/unified-ai/invoke')
    })
  })

  // 产品身份路径
  describe('PRODUCT_IDENTITY_PATHS', () => {
    it('应该包含正确的产品身份路径', () => {
      const p = PRODUCT_IDENTITY_PATHS
      expect(p.list).toBe('/product_identity/list')
      expect(p.create).toBe('/product_identity')
      expect(p.update).toBe('/product_identity')
    })
  })

  // 智能体分类路径
  describe('AGENT_CATEGORY_PATHS', () => {
    it('应该包含正确的智能体分类路径', () => {
      expect(AGENT_CATEGORY_PATHS.list).toBe('/agentCategory/list')
      expect(AGENT_CATEGORY_PATHS.create).toBe('/agentCategory')
    })
  })

  // 课程 API 路径
  describe('COURSES_API_PATHS', () => {
    it('应该包含正确的课程 API 路径', () => {
      const c = COURSES_API_PATHS
      // 2026-06-24 修复: list/byId/categories 路径前缀对齐后端 /api/v1/courses/*
      expect(c.list).toBe('/api/v1/courses/list')
      expect(c.byId('c1')).toBe('/api/v1/courses/c1')
      expect(c.categories).toBe('/api/v1/courses/categories')
      expect(c.my).toBe('/api/courses/my')
      expect(c.enroll('c1')).toBe('/api/courses/c1/enroll')
      expect(c.progress('c1')).toBe('/api/courses/c1/progress')
      expect(c.lessonComplete('c1', 'l1')).toBe('/api/courses/c1/lessons/l1/complete')
    })
  })

  // 课程路径
  describe('COURSE_PATHS', () => {
    it('应该包含正确的课程路径', () => {
      const c = COURSE_PATHS
      expect(c.update).toBe('/course')
      expect(c.export).toBe('/course/export')
      // 2026-06-24 修复: delete 路径对齐后端 /api/v1/courses/{ids}
      expect(c.delete('1,2')).toBe('/api/v1/courses/1,2')
    })
  })

  // 移动端订单路径
  describe('MOBILE_ORDERS_PATHS', () => {
    it('应该包含正确的移动端订单路径', () => {
      expect(MOBILE_ORDERS_PATHS.list).toBe('/api/mobile/orders/list')
      expect(MOBILE_ORDERS_PATHS.byId('o1')).toBe('/api/mobile/orders/o1')
    })
  })

  // 开发者订单路径
  describe('DEVELOPER_ORDERS_PATHS', () => {
    it('应该包含正确的开发者订单路径', () => {
      expect(DEVELOPER_ORDERS_PATHS.list).toBe('/api/v1/developer/orders')
    })
  })

  // 分销路径
  describe('DISTRIBUTION_PATHS', () => {
    it('应该包含正确的分销路径', () => {
      const d = DISTRIBUTION_PATHS
      expect(d.inviteCode).toBe('/cozeZhsApi/distribution/invite-code')
      expect(d.useInviteCode).toBe('/cozeZhsApi/distribution/use-invite-code')
      expect(d.getSubordinates).toBe('/cozeZhsApi/distribution/getSubordinates')
      expect(d.stats).toBe('/cozeZhsApi/distribution/stats')
      expect(d.commissionFlows).toBe('/cozeZhsApi/distribution/commission-flows')
      expect(d.flowStatistics).toBe('/cozeZhsApi/flow/getStatistics')
      expect(d.getWxCode).toBe('/cozeZhsApi/login/getWxCode')
      expect(d.getUserAndChildrenOrders).toBe('/cozeZhsApi/distribution/getUserAndChildrenOrders')
      expect(d.getUserCommissionDetail).toBe('/cozeZhsApi/distribution/getUserCommissionDetail')
      expect(d.getUserInviteeOrderStats).toBe('/cozeZhsApi/trader/getUserInviteeOrderStats')
    })
  })

  // OpenClaw 路径
  describe('OPENCLAW_PATHS', () => {
    it('gateway 路径应该正确', () => {
      const g = OPENCLAW_PATHS.gateway
      expect(g.status).toBe('/api/openclaw/gateway/status')
      expect(g.health).toBe('/api/openclaw/gateway/health')
      expect(g.config).toBe('/api/openclaw/gateway/config')
      expect(g.restart).toBe('/api/openclaw/gateway/restart')
    })

    it('channels 路径应该正确', () => {
      const c = OPENCLAW_PATHS.channels
      expect(c.supported).toBe('/api/openclaw/channels/supported')
      expect(c.list).toBe('/api/openclaw/channels')
      expect(c.byId('c1')).toBe('/api/openclaw/channels/c1')
      expect(c.connect('c1')).toBe('/api/openclaw/channels/c1/connect')
      expect(c.disconnect('c1')).toBe('/api/openclaw/channels/c1/disconnect')
      expect(c.send('c1')).toBe('/api/openclaw/channels/c1/send')
      expect(c.status('c1')).toBe('/api/openclaw/channels/c1/status')
    })

    it('tools 路径应该正确', () => {
      const t = OPENCLAW_PATHS.tools
      expect(t.list).toBe('/api/openclaw/tools')
      expect(t.byName('t1')).toBe('/api/openclaw/tools/t1')
      expect(t.execute('t1')).toBe('/api/openclaw/tools/t1/execute')
      expect(t.register).toBe('/api/openclaw/tools/register')
    })

    it('skills 路径应该正确', () => {
      const s = OPENCLAW_PATHS.skills
      expect(s.list).toBe('/api/openclaw/skills')
      expect(s.byId('s1')).toBe('/api/openclaw/skills/s1')
      expect(s.install('s1')).toBe('/api/openclaw/skills/s1/install')
      expect(s.uninstall('s1')).toBe('/api/openclaw/skills/s1/uninstall')
      expect(s.installed).toBe('/api/openclaw/skills/installed')
      expect(s.publish).toBe('/api/openclaw/skills/publish')
    })

    it('tasks 路径应该正确', () => {
      const t = OPENCLAW_PATHS.tasks
      expect(t.list).toBe('/api/openclaw/tasks')
      expect(t.byId('t1')).toBe('/api/openclaw/tasks/t1')
      expect(t.cancel('t1')).toBe('/api/openclaw/tasks/t1/cancel')
      expect(t.retry('t1')).toBe('/api/openclaw/tasks/t1/retry')
      expect(t.execute('t1')).toBe('/api/openclaw/tasks/t1/execute')
    })

    it('automation 路径应该正确', () => {
      const a = OPENCLAW_PATHS.automation
      expect(a.cron).toBe('/api/openclaw/automation/cron')
      expect(a.cronById('c1')).toBe('/api/openclaw/automation/cron/c1')
      expect(a.webhooks).toBe('/api/openclaw/automation/webhooks')
      expect(a.webhookById('w1')).toBe('/api/openclaw/automation/webhooks/w1')
      expect(a.webhookTrigger('w1')).toBe('/api/openclaw/automation/webhooks/w1/trigger')
      expect(a.hooks).toBe('/api/openclaw/automation/hooks')
      expect(a.hookById('h1')).toBe('/api/openclaw/automation/hooks/h1')
    })

    it('sessions 路径应该正确', () => {
      const s = OPENCLAW_PATHS.sessions
      expect(s.list).toBe('/api/openclaw/sessions')
      expect(s.byId('s1')).toBe('/api/openclaw/sessions/s1')
      expect(s.messages('s1')).toBe('/api/openclaw/sessions/s1/messages')
      expect(s.end('s1')).toBe('/api/openclaw/sessions/s1/end')
    })

    it('agents 路径应该正确', () => {
      const a = OPENCLAW_PATHS.agents
      expect(a.message).toBe('/api/openclaw/agents/message')
      expect(a.status).toBe('/api/openclaw/agents/status')
      expect(a.subagent).toBe('/api/openclaw/agents/subagent')
      expect(a.subagents).toBe('/api/openclaw/agents/subagents')
    })

    it('memory 路径应该正确', () => {
      const m = OPENCLAW_PATHS.memory
      expect(m.create).toBe('/api/openclaw/memory')
      expect(m.search).toBe('/api/openclaw/memory/search')
      expect(m.context).toBe('/api/openclaw/memory/context')
      expect(m.delete).toBe('/api/openclaw/memory')
    })

    it('evolution 路径应该正确', () => {
      const e = OPENCLAW_PATHS.evolution
      expect(e.analyze).toBe('/api/openclaw/evolution/analyze')
      expect(e.generate).toBe('/api/openclaw/evolution/generate')
      expect(e.history).toBe('/api/openclaw/evolution/history')
    })

    it('nodes 路径应该正确', () => {
      const n = OPENCLAW_PATHS.nodes
      expect(n.list).toBe('/api/openclaw/nodes')
      expect(n.pair).toBe('/api/openclaw/nodes/pair')
      expect(n.unpair('n1')).toBe('/api/openclaw/nodes/n1/unpair')
      expect(n.invoke('n1')).toBe('/api/openclaw/nodes/n1/invoke')
    })

    it('stats 路径应该正确', () => {
      const s = OPENCLAW_PATHS.stats
      expect(s.usage).toBe('/api/openclaw/stats/usage')
      expect(s.tokens).toBe('/api/openclaw/stats/tokens')
    })
  })

  // 用户设置路径
  describe('USER_SETTINGS_PATHS', () => {
    it('应该包含正确的用户设置路径', () => {
      const u = USER_SETTINGS_PATHS
      expect(u.base).toBe('/user/settings')
      expect(u.notifications).toBe('/user/settings/notifications')
      expect(u.privacy).toBe('/user/settings/privacy')
      expect(u.preferences).toBe('/user/settings/preferences')
      expect(u.devices).toBe('/user/settings/devices')
      expect(u.deviceById('d1')).toBe('/user/settings/devices/d1')
      expect(u.clearData).toBe('/user/settings/clear-data')
      expect(u.exportData).toBe('/user/settings/export-data')
      expect(u.deleteAccount).toBe('/user/settings/delete-account')
      expect(u.deleteAccountStatus).toBe('/user/settings/delete-account/status')
      expect(u.deleteAccountCancel).toBe('/user/settings/delete-account/cancel')
      expect(u.sendEmailCode).toBe('/user/settings/send-email-code')
      expect(u.verifyEmail).toBe('/user/settings/verify-email')
      expect(u.sendPhoneCode).toBe('/user/settings/send-phone-code')
      expect(u.verifyPhone).toBe('/user/settings/verify-phone')
      expect(u.securityLogs).toBe('/user/settings/security-logs')
      expect(u.themeSync).toBe('/user/settings/theme/sync')
      expect(u.themePresets).toBe('/user/settings/theme/presets')
      expect(u.themePresetById('p1')).toBe('/user/settings/theme/presets/p1')
    })
  })
})
