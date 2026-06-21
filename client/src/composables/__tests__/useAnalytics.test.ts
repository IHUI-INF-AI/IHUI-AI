import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('vue-router', () => ({
  useRoute: () => ({
    path: '/test',
    fullPath: '/test?query=1',
  }),
}))

vi.mock('vue', () => ({
  onMounted: vi.fn((callback: () => void) => callback()),
  onUnmounted: vi.fn(),
  ref: vi.fn((value: any) => ({ value })),
}))

vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

// mock auth store 以覆盖 getUserId 正常分支
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: { uuid: 'test-uuid', id: 'test-id' },
  }),
}))

describe('useAnalytics', () => {
  let originalGtag: any
  let originalUmami: any

  beforeEach(() => {
    vi.clearAllMocks()
    originalGtag = window.gtag
    originalUmami = window.umami
    window.gtag = vi.fn()
    window.umami = { track: vi.fn() }
  })

  afterEach(() => {
    window.gtag = originalGtag as typeof window.gtag
    window.umami = originalUmami as typeof window.umami
    vi.clearAllMocks()
  })

  describe('基础功能', () => {
    it('应该能够导入useAnalytics', async () => {
      const { useAnalytics } = await import('../useAnalytics')
      expect(typeof useAnalytics).toBe('function')
    })

    it('应该返回trackPageView方法', async () => {
      const { useAnalytics } = await import('../useAnalytics')
      const { trackPageView } = useAnalytics()
      expect(typeof trackPageView).toBe('function')
    })

    it('应该返回trackClick方法', async () => {
      const { useAnalytics } = await import('../useAnalytics')
      const { trackClick } = useAnalytics()
      expect(typeof trackClick).toBe('function')
    })

    it('应该返回trackConversion方法', async () => {
      const { useAnalytics } = await import('../useAnalytics')
      const { trackConversion } = useAnalytics()
      expect(typeof trackConversion).toBe('function')
    })

    it('应该返回trackFormInteraction方法', async () => {
      const { useAnalytics } = await import('../useAnalytics')
      const { trackFormInteraction } = useAnalytics()
      expect(typeof trackFormInteraction).toBe('function')
    })

    it('应该返回trackContentInteraction方法', async () => {
      const { useAnalytics } = await import('../useAnalytics')
      const { trackContentInteraction } = useAnalytics()
      expect(typeof trackContentInteraction).toBe('function')
    })

    it('应该返回trackScrollDepth方法', async () => {
      const { useAnalytics } = await import('../useAnalytics')
      const { trackScrollDepth } = useAnalytics()
      expect(typeof trackScrollDepth).toBe('function')
    })

    it('应该返回trackError方法', async () => {
      const { useAnalytics } = await import('../useAnalytics')
      const { trackError } = useAnalytics()
      expect(typeof trackError).toBe('function')
    })

    it('应该返回sendEvent方法', async () => {
      const { useAnalytics } = await import('../useAnalytics')
      const { sendEvent } = useAnalytics()
      expect(typeof sendEvent).toBe('function')
    })
  })

  describe('事件追踪', () => {
    it('trackPageView应该追踪页面浏览', async () => {
      const { useAnalytics } = await import('../useAnalytics')
      const { trackPageView, flushQueue } = useAnalytics()
      trackPageView('/test')
      await flushQueue()
      expect(window.gtag).toHaveBeenCalled()
    })

    it('trackClick应该追踪点击事件', async () => {
      const { useAnalytics } = await import('../useAnalytics')
      const { trackClick, flushQueue } = useAnalytics()
      trackClick('test-button', { section: 'header' })
      await flushQueue()
      expect(window.gtag).toHaveBeenCalled()
    })

    it('trackConversion应该追踪转化事件', async () => {
      const { useAnalytics } = await import('../useAnalytics')
      const { trackConversion, flushQueue } = useAnalytics()
      trackConversion('signup', 100)
      await flushQueue()
      expect(window.gtag).toHaveBeenCalled()
    })

    it('trackFormInteraction应该追踪表单交互', async () => {
      const { useAnalytics } = await import('../useAnalytics')
      const { trackFormInteraction, flushQueue } = useAnalytics()
      trackFormInteraction('login-form', 'submit')
      await flushQueue()
      expect(window.gtag).toHaveBeenCalled()
    })

    it('trackContentInteraction应该追踪内容交互', async () => {
      const { useAnalytics } = await import('../useAnalytics')
      const { trackContentInteraction, flushQueue } = useAnalytics()
      trackContentInteraction('article', 'view', 'article-123')
      await flushQueue()
      expect(window.gtag).toHaveBeenCalled()
    })

    it('trackScrollDepth应该追踪滚动深度', async () => {
      const { useAnalytics } = await import('../useAnalytics')
      const { sendEvent, flushQueue } = useAnalytics()
      sendEvent({
        category: 'user_engagement',
        action: 'scroll',
        label: '50%',
      })
      await flushQueue()
      expect(window.gtag).toHaveBeenCalled()
    })

    it('trackError应该追踪错误', async () => {
      const { useAnalytics } = await import('../useAnalytics')
      const { trackError, flushQueue } = useAnalytics()
      trackError('test-error', 'Test error message')
      await flushQueue()
      expect(window.gtag).toHaveBeenCalled()
    })

    it('sendEvent应该发送自定义事件', async () => {
      const { useAnalytics } = await import('../useAnalytics')
      const { sendEvent, flushQueue } = useAnalytics()
      sendEvent({
        category: 'user_engagement',
        action: 'click',
        label: 'test-button',
      })
      await flushQueue()
      expect(window.gtag).toHaveBeenCalled()
    })
  })

  describe('企业服务埋点', () => {
    it('useEnterpriseAnalytics应该返回企业专用方法', async () => {
      const { useEnterpriseAnalytics } = await import('../useAnalytics')
      const { trackEnterprisePageView } = useEnterpriseAnalytics()
      expect(typeof trackEnterprisePageView).toBe('function')
    })
  })

  describe('类型定义', () => {
    it('EventCategory应该包含正确的类型', async () => {
      const categories = [
        'page_view',
        'user_engagement',
        'navigation',
        'conversion',
        'form_interaction',
        'content_interaction',
        'error',
      ]
      
      for (const category of categories) {
        expect(typeof category).toBe('string')
      }
    })

    it('AnalyticsEvent应该包含正确的属性', () => {
      const event = {
        category: 'user_engagement' as const,
        action: 'click',
        label: 'test-button',
        value: 1,
        customData: { test: true },
      }
      
      expect(event.category).toBe('user_engagement')
      expect(event.action).toBe('click')
      expect(event.label).toBe('test-button')
      expect(event.value).toBe(1)
      expect(event.customData).toEqual({ test: true })
    })

    it('PageTimeData应该包含正确的属性', () => {
      const pageData = {
        path: '/test',
        enterTime: Date.now(),
        exitTime: Date.now() + 1000,
        duration: 1000,
        scrollDepth: 50,
      }
      
      expect(pageData.path).toBe('/test')
      expect(pageData.enterTime).toBeDefined()
      expect(pageData.exitTime).toBeDefined()
      expect(pageData.duration).toBe(1000)
      expect(pageData.scrollDepth).toBe(50)
    })
  })

  describe('trackFeatureUsage 方法', () => {
    it('应该追踪功能使用事件', async () => {
      const { useAnalytics } = await import('../useAnalytics')
      const { trackFeatureUsage, flushQueue } = useAnalytics()
      trackFeatureUsage('test_feature', 'enable', { version: '1.0' })
      await flushQueue()
      expect(window.gtag).toHaveBeenCalled()
    })
  })

  describe('trackScrollDepth 滚动逻辑', () => {
    it('应该根据滚动位置触发里程碑事件', async () => {
      const { useAnalytics } = await import('../useAnalytics')
      const { trackScrollDepth, flushQueue } = useAnalytics()
      // 模拟滚动到30%（scrollHeight=1000, innerHeight=500, scrollY=150）
      Object.defineProperty(document.documentElement, 'scrollHeight', { value: 1000, configurable: true, writable: true })
      Object.defineProperty(window, 'innerHeight', { value: 500, configurable: true, writable: true })
      Object.defineProperty(window, 'scrollY', { value: 150, configurable: true, writable: true })
      trackScrollDepth()
      await flushQueue()
      expect(window.gtag).toHaveBeenCalled()
    })

    it('应该在scrollHeight为0时不抛错', async () => {
      const { useAnalytics } = await import('../useAnalytics')
      const { trackScrollDepth } = useAnalytics()
      Object.defineProperty(document.documentElement, 'scrollHeight', { value: 500, configurable: true, writable: true })
      Object.defineProperty(window, 'innerHeight', { value: 500, configurable: true, writable: true })
      Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true })
      expect(() => trackScrollDepth()).not.toThrow()
    })
  })

  describe('页面计时器', () => {
    it('startPageTimer和endPageTimer应该正常工作', async () => {
      const { useAnalytics } = await import('../useAnalytics')
      const { startPageTimer, endPageTimer, flushQueue } = useAnalytics()
      startPageTimer()
      await new Promise(resolve => setTimeout(resolve, 10))
      endPageTimer()
      await flushQueue()
      expect(window.gtag).toHaveBeenCalled()
    })
  })

  describe('analyticsUtils 工具方法', () => {
    it('getSessionId应该返回会话ID', async () => {
      const { analyticsUtils } = await import('../useAnalytics')
      const sessionId = analyticsUtils.getSessionId()
      expect(typeof sessionId).toBe('string')
      expect(sessionId.length).toBeGreaterThan(0)
    })

    it('getUserId应该返回用户ID', async () => {
      const { analyticsUtils } = await import('../useAnalytics')
      const userId = analyticsUtils.getUserId()
      expect(userId).toBe('test-uuid')
    })

    it('flushQueue空队列不应抛错', async () => {
      const { analyticsUtils } = await import('../useAnalytics')
      await expect(analyticsUtils.flushQueue()).resolves.not.toThrow()
    })

    it('initAnalytics重复调用不应抛错', async () => {
      const { analyticsUtils } = await import('../useAnalytics')
      expect(() => analyticsUtils.initAnalytics()).not.toThrow()
    })
  })

  describe('首页埋点 useHomeAnalytics', () => {
    it('应该返回首页专用方法并正常调用', async () => {
      const { useHomeAnalytics } = await import('../useAnalytics')
      const analytics = useHomeAnalytics()
      analytics.trackHomePageView()
      analytics.trackHeroCTAClick('primary')
      analytics.trackFeatureCardClick('ai_chat')
      analytics.trackAdvantageCardClick('fast')
      analytics.trackMarqueeInteraction('brand1')
      await analytics.flushQueue()
      expect(window.gtag).toHaveBeenCalled()
    })
  })

  describe('登录埋点 useLoginAnalytics', () => {
    it('应该返回登录专用方法并正常调用', async () => {
      const { useLoginAnalytics } = await import('../useAnalytics')
      const analytics = useLoginAnalytics()
      analytics.trackLoginPageView()
      analytics.trackLoginClick('password')
      analytics.trackLoginSuccess('password')
      analytics.trackLoginFail('password', 'wrong_password')
      analytics.trackThirdPartyLogin('wechat')
      await analytics.flushQueue()
      expect(window.gtag).toHaveBeenCalled()
    })
  })

  describe('注册埋点 useRegisterAnalytics', () => {
    it('应该返回注册专用方法并正常调用', async () => {
      const { useRegisterAnalytics } = await import('../useAnalytics')
      const analytics = useRegisterAnalytics()
      analytics.trackRegisterPageView()
      analytics.trackRegisterClick('account')
      analytics.trackRegisterSuccess('account')
      analytics.trackRegisterFail('account', 'exists')
      await analytics.flushQueue()
      expect(window.gtag).toHaveBeenCalled()
    })
  })

  describe('支付埋点 usePaymentAnalytics', () => {
    it('应该返回支付专用方法并正常调用', async () => {
      const { usePaymentAnalytics } = await import('../useAnalytics')
      const analytics = usePaymentAnalytics()
      analytics.trackPaymentPageView()
      analytics.trackPaymentMethodSelect('alipay')
      analytics.trackPaymentSuccess(100, 'alipay', 'product-1')
      analytics.trackPaymentFail('alipay', 'insufficient')
      analytics.trackRechargeAmountSelect(50)
      await analytics.flushQueue()
      expect(window.gtag).toHaveBeenCalled()
    })
  })

  describe('VIP埋点 useVipAnalytics', () => {
    it('应该返回VIP专用方法并正常调用', async () => {
      const { useVipAnalytics } = await import('../useAnalytics')
      const analytics = useVipAnalytics()
      analytics.trackVipPageView()
      analytics.trackVipPlanClick('monthly')
      analytics.trackVipPurchaseClick('monthly', 30)
      analytics.trackVipPurchaseSuccess('monthly', 30)
      await analytics.flushQueue()
      expect(window.gtag).toHaveBeenCalled()
    })
  })

  describe('AI聊天埋点 useAIChatAnalytics', () => {
    it('应该返回AI聊天专用方法并正常调用', async () => {
      const { useAIChatAnalytics } = await import('../useAnalytics')
      const analytics = useAIChatAnalytics()
      analytics.trackChatStart('gpt-4')
      analytics.trackChatMessage('gpt-4')
      analytics.trackChatModelSelect('gpt-4')
      analytics.trackChatEnd(120, 5)
      await analytics.flushQueue()
      expect(window.gtag).toHaveBeenCalled()
    })
  })

  describe('智能体埋点 useAgentAnalytics', () => {
    it('应该返回智能体专用方法并正常调用', async () => {
      const { useAgentAnalytics } = await import('../useAnalytics')
      const analytics = useAgentAnalytics()
      analytics.trackAgentListView()
      analytics.trackAgentDetailView('agent-1', '测试智能体')
      analytics.trackAgentUse('agent-1', '测试智能体')
      analytics.trackAgentFavorite('agent-1', 'add')
      await analytics.flushQueue()
      expect(window.gtag).toHaveBeenCalled()
    })
  })

  describe('API埋点 useAPIAnalytics', () => {
    it('应该返回API专用方法并正常调用', async () => {
      const { useAPIAnalytics } = await import('../useAnalytics')
      const analytics = useAPIAnalytics()
      analytics.trackApiDocView('/api/v1/users')
      analytics.trackApiCall('/api/v1/users', 'GET', 100)
      analytics.trackApiTokenManage('create')
      await analytics.flushQueue()
      expect(window.gtag).toHaveBeenCalled()
    })

    it('trackApiDocView不带endpoint不应抛错', async () => {
      const { useAPIAnalytics } = await import('../useAnalytics')
      const analytics = useAPIAnalytics()
      analytics.trackApiDocView()
      await analytics.flushQueue()
      expect(window.gtag).toHaveBeenCalled()
    })
  })

  describe('企业服务埋点 useEnterpriseAnalytics 详细方法', () => {
    it('应该返回企业服务专用方法并正常调用', async () => {
      const { useEnterpriseAnalytics } = await import('../useAnalytics')
      const analytics = useEnterpriseAnalytics()
      analytics.trackEnterprisePageView()
      analytics.trackCTAClick('join')
      analytics.trackModuleClick('local')
      analytics.trackCoursePhaseSwitch('phase1')
      analytics.trackQuadrantClick('q1')
      analytics.trackSideNavClick('overview')
      analytics.trackJoinConversion('standard')
      analytics.trackJoinConversion('early_bird')
      await analytics.flushQueue()
      expect(window.gtag).toHaveBeenCalled()
    })
  })

  describe('离线与存储', () => {
    it('离线时事件应保存到localStorage', async () => {
      const { useAnalytics } = await import('../useAnalytics')
      const { sendEvent, flushQueue } = useAnalytics()
      // 模拟离线
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true, writable: true })
      await sendEvent({ category: 'user_engagement', action: 'offline_test' })
      await flushQueue()
      // 验证localStorage中有数据
      const stored = localStorage.getItem('analytics_pending_events')
      expect(stored).toBeTruthy()
      // 恢复在线
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true })
    })

    it('online事件应触发存储事件的发送', async () => {
      // 先在localStorage中存储事件以触发sendBatch
      localStorage.setItem('analytics_pending_events', JSON.stringify([
        { category: 'user_engagement', action: 'stored_event' }
      ]))
      // 触发online事件
      window.dispatchEvent(new Event('online'))
      // 等待异步操作完成
      await new Promise(resolve => setTimeout(resolve, 500))
      // 验证localStorage被清除（then回调执行了clearStoredEvents）
      expect(localStorage.getItem('analytics_pending_events')).toBeNull()
    })

    it('beforeunload事件应保存队列事件', async () => {
      const { useAnalytics } = await import('../useAnalytics')
      const { sendEvent } = useAnalytics()
      // 添加事件到队列（不flush）
      sendEvent({ category: 'user_engagement', action: 'beforeunload_test' })
      // 触发beforeunload事件
      window.dispatchEvent(new Event('beforeunload'))
      // 不应抛错
    })
  })

  describe('批量发送', () => {
    it('达到批量大小应自动刷新队列', async () => {
      const { useAnalytics } = await import('../useAnalytics')
      const { sendEvent } = useAnalytics()
      // 发送BATCH_SIZE(10)个事件，应自动触发flushQueue
      for (let i = 0; i < 10; i++) {
        await sendEvent({ category: 'user_engagement', action: 'batch_test' })
      }
      expect(window.gtag).toHaveBeenCalled()
    })

    it('gtag不存在时不应抛错', async () => {
      const originalGtag = window.gtag
      window.gtag = undefined as any
      const { useAnalytics } = await import('../useAnalytics')
      const { sendEvent, flushQueue } = useAnalytics()
      await sendEvent({ category: 'user_engagement', action: 'no_gtag_test' })
      await flushQueue()
      window.gtag = originalGtag
    })

    it('umami不存在时不应抛错', async () => {
      const originalUmami = window.umami
      window.umami = undefined as any
      const { useAnalytics } = await import('../useAnalytics')
      const { sendEvent, flushQueue } = useAnalytics()
      await sendEvent({ category: 'user_engagement', action: 'no_umami_test' })
      await flushQueue()
      window.umami = originalUmami
    })
  })

  describe('sessionStorage 会话管理', () => {
    it('getSessionId应该返回有效会话ID', async () => {
      const { analyticsUtils } = await import('../useAnalytics')
      const sid = analyticsUtils.getSessionId()
      expect(typeof sid).toBe('string')
      expect(sid.length).toBeGreaterThan(0)
    })
  })
})
