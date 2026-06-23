/**
 * 数据分析与埋点 Composable
 * @description 提供统一的事件追踪和用户行为分析接口
 * 支持批量发送、离线存储、会话管理
 */

declare global {
  interface Window {
    gtag?: (command: string, action: string, params?: Record<string, unknown>) => void
    umami?: { track: (event: string, data?: Record<string, unknown>) => void }
  }
}

import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { logger } from '@/utils/logger'
import { useAuthStore } from '@/stores/auth'

export type EventCategory = 
  | 'page_view'
  | 'user_engagement'
  | 'navigation'
  | 'conversion'
  | 'form_interaction'
  | 'content_interaction'
  | 'error'
  | 'feature_usage'

export interface AnalyticsEvent {
  category: EventCategory
  action: string
  label?: string
  value?: number
  customData?: Record<string, unknown>
  timestamp?: number
  url?: string
  userAgent?: string
  sessionId?: string
  userId?: string
}

export interface PageTimeData {
  path: string
  enterTime: number
  exitTime?: number
  duration?: number
  scrollDepth: number
}

const BATCH_SIZE = 10
const BATCH_INTERVAL = 5000
const STORAGE_KEY = 'analytics_pending_events'
const SESSION_KEY = 'analytics_session_id'

let eventQueue: AnalyticsEvent[] = []
let batchTimer: ReturnType<typeof setInterval> | null = null
let sessionId: string = ''
let isInitialized = false

const pageTimeData = ref<PageTimeData | null>(null)

const generateSessionId = (): string => {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 15)
  return `${timestamp}-${random}`
}

const getSessionId = (): string => {
  if (sessionId) return sessionId
  
  try {
    const stored = sessionStorage.getItem(SESSION_KEY)
    if (stored) {
      sessionId = stored
      return sessionId
    }
  } catch {
    // sessionStorage 不可用
  }
  
  sessionId = generateSessionId()
  try {
    sessionStorage.setItem(SESSION_KEY, sessionId)
  } catch {
    // sessionStorage 不可用
  }
  return sessionId
}

const getUserId = (): string | undefined => {
  try {
    const authStore = useAuthStore()
    return authStore.user?.uuid || authStore.user?.id || undefined
  } catch {
    return undefined
  }
}

const saveToLocalStorage = (events: AnalyticsEvent[]): void => {
  try {
    const existing = localStorage.getItem(STORAGE_KEY)
    const existingEvents: AnalyticsEvent[] = existing ? JSON.parse(existing) : []
    const allEvents = [...existingEvents, ...events]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allEvents.slice(-100)))
  } catch (e) {
    logger.warn('[Analytics] Local storage failed:', e)
  }
}

const getStoredEvents = (): AnalyticsEvent[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

const clearStoredEvents = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

const sendBatch = async (events: AnalyticsEvent[]): Promise<boolean> => {
  if (!events.length) return true
  
  if (typeof window !== 'undefined' && window.gtag) {
    events.forEach(event => {
      window.gtag!('event', event.action, {
        event_category: event.category,
        event_label: event.label,
        value: event.value,
        ...event.customData,
      })
    })
  }

  if (typeof window !== 'undefined' && window.umami) {
    events.forEach(event => {
      window.umami!.track(event.action, {
        category: event.category,
        label: event.label,
        ...event.customData,
      })
    })
  }

  if (import.meta.env.DEV) {
    logger.debug('[Analytics] Batch sending events:', events.length, 'items')
    events.forEach(event => logger.debug('[Analytics]', event))
  }

  return true
}

const flushQueue = async (): Promise<void> => {
  if (!eventQueue.length) return
  
  const eventsToSend = [...eventQueue]
  eventQueue = []
  
  try {
    if (navigator.onLine) {
      await sendBatch(eventsToSend)
    } else {
      saveToLocalStorage(eventsToSend)
    }
  } catch (e) {
    logger.warn('[Analytics] Send failed, saving to local:', e)
    saveToLocalStorage(eventsToSend)
  }
}

const startBatchTimer = (): void => {
  if (batchTimer) return
  batchTimer = setInterval(() => {
    void flushQueue()
  }, BATCH_INTERVAL)
}

const stopBatchTimer = (): void => {
  if (batchTimer) {
    clearInterval(batchTimer)
    batchTimer = null
  }
}

// 命名函数引用，便于移除事件监听器
const handleOnline = (): void => {
  const events = getStoredEvents()
  if (events.length > 0) {
    sendBatch(events).then(() => {
      clearStoredEvents()
    }).catch((e) => { console.error(e) })
  }
}

const handleBeforeUnload = (): void => {
  if (eventQueue.length > 0) {
    saveToLocalStorage(eventQueue)
  }
  stopBatchTimer()
}

const sendEvent = async (event: AnalyticsEvent): Promise<void> => {
  const enrichedEvent: AnalyticsEvent = {
    ...event,
    timestamp: Date.now(),
    url: typeof window !== 'undefined' ? window.location.href : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    sessionId: getSessionId(),
    userId: getUserId(),
  }

  eventQueue.push(enrichedEvent)

  if (eventQueue.length >= BATCH_SIZE) {
    await flushQueue()
  }

  if (import.meta.env.DEV) {
    logger.debug('[Analytics] Event enqueued:', enrichedEvent)
  }
}

const initAnalytics = (): void => {
  if (isInitialized) return
  isInitialized = true

  startBatchTimer()

  const storedEvents = getStoredEvents()
  if (storedEvents.length > 0 && navigator.onLine) {
    sendBatch(storedEvents).then(() => {
      clearStoredEvents()
    }).catch((e) => { console.error(e) })
  }

  window.addEventListener('online', handleOnline)
  window.addEventListener('beforeunload', handleBeforeUnload)
}

// 销毁分析模块，移除事件监听器和定时器
const destroyAnalytics = (): void => {
  if (!isInitialized) return
  stopBatchTimer()
  window.removeEventListener('online', handleOnline)
  window.removeEventListener('beforeunload', handleBeforeUnload)
  isInitialized = false
}

export function useAnalytics() {
  const route = useRoute()
  let scrollDepth = 0

  if (!isInitialized) {
    initAnalytics()
  }

  const trackPageView = (pageName?: string) => {
    void sendEvent({
      category: 'page_view',
      action: 'view',
      label: pageName || route.path,
      customData: {
        title: typeof document !== 'undefined' ? document.title : '',
        referrer: typeof document !== 'undefined' ? document.referrer : '',
        routeName: route.name?.toString(),
      },
    })
  }

  const trackClick = (elementName: string, customData?: Record<string, unknown>) => {
    void sendEvent({
      category: 'user_engagement',
      action: 'click',
      label: elementName,
      customData,
    })
  }

  const trackConversion = (
    conversionType: string,
    value?: number,
    customData?: Record<string, unknown>
  ) => {
    void sendEvent({
      category: 'conversion',
      action: conversionType,
      value,
      customData,
    })
  }

  const trackFormInteraction = (
    formName: string,
    action: 'start' | 'submit' | 'error' | 'abandon',
    customData?: Record<string, unknown>
  ) => {
    void sendEvent({
      category: 'form_interaction',
      action,
      label: formName,
      customData,
    })
  }

  const trackContentInteraction = (
    contentType: string,
    action: string,
    contentId?: string,
    customData?: Record<string, unknown>
  ) => {
    void sendEvent({
      category: 'content_interaction',
      action,
      label: contentId || contentType,
      customData: {
        contentType,
        ...customData,
      },
    })
  }

  const trackFeatureUsage = (
    featureName: string,
    action: string,
    customData?: Record<string, unknown>
  ) => {
    void sendEvent({
      category: 'feature_usage',
      action,
      label: featureName,
      customData,
    })
  }

  const trackScrollDepth = () => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return
    
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
    const currentScroll = window.scrollY
    const currentDepth = scrollHeight > 0 ? Math.round((currentScroll / scrollHeight) * 100) : 0

    const milestones = [25, 50, 75, 100]
    for (const milestone of milestones) {
      if (currentDepth >= milestone && scrollDepth < milestone) {
        void sendEvent({
          category: 'user_engagement',
          action: 'scroll_depth',
          value: milestone,
          label: route.path,
        })
        scrollDepth = milestone
      }
    }
  }

  const trackError = (
    errorType: string,
    errorMessage: string,
    customData?: Record<string, unknown>
  ) => {
    void sendEvent({
      category: 'error',
      action: errorType,
      label: errorMessage,
      customData,
    })
  }

  const startPageTimer = () => {
    pageTimeData.value = {
      path: route.path,
      enterTime: Date.now(),
      scrollDepth: 0,
    }
  }

  const endPageTimer = () => {
    if (pageTimeData.value) {
      pageTimeData.value.exitTime = Date.now()
      pageTimeData.value.duration =
        pageTimeData.value.exitTime - pageTimeData.value.enterTime
      pageTimeData.value.scrollDepth = scrollDepth

      void sendEvent({
        category: 'user_engagement',
        action: 'page_time',
        value: Math.round(pageTimeData.value.duration / 1000),
        label: pageTimeData.value.path,
        customData: {
          scrollDepth: pageTimeData.value.scrollDepth,
        },
      })
    }
  }

  return {
    trackPageView,
    trackClick,
    trackConversion,
    trackFormInteraction,
    trackContentInteraction,
    trackFeatureUsage,
    trackScrollDepth,
    trackError,
    startPageTimer,
    endPageTimer,
    sendEvent,
    flushQueue,
  }
}

export { destroyAnalytics }

export function useHomeAnalytics() {
  const analytics = useAnalytics()

  const trackHomePageView = () => {
    analytics.trackPageView('首页')
  }

  const trackHeroCTAClick = (ctaType: 'primary' | 'secondary') => {
    analytics.trackClick(`hero_cta_${ctaType}`, { page: 'home' })
  }

  const trackFeatureCardClick = (featureName: string) => {
    analytics.trackClick(`feature_${featureName}`, { page: 'home' })
  }

  const trackAdvantageCardClick = (advantageName: string) => {
    analytics.trackClick(`advantage_${advantageName}`, { page: 'home' })
  }

  const trackMarqueeInteraction = (brandName: string) => {
    analytics.trackClick(`brand_${brandName}`, { page: 'home' })
  }

  return {
    ...analytics,
    trackHomePageView,
    trackHeroCTAClick,
    trackFeatureCardClick,
    trackAdvantageCardClick,
    trackMarqueeInteraction,
  }
}

export function useLoginAnalytics() {
  const analytics = useAnalytics()

  const trackLoginPageView = () => {
    analytics.trackPageView('登录页')
  }

  const trackLoginClick = (method: 'password' | 'sms' | 'third_party') => {
    analytics.trackClick('login_button', { method })
  }

  const trackLoginSuccess = (method: string) => {
    analytics.trackConversion('login_success', undefined, { method })
  }

  const trackLoginFail = (method: string, reason?: string) => {
    analytics.trackConversion('login_fail', undefined, { method, reason })
  }

  const trackThirdPartyLogin = (provider: string) => {
    analytics.trackClick(`third_party_login_${provider}`)
  }

  return {
    ...analytics,
    trackLoginPageView,
    trackLoginClick,
    trackLoginSuccess,
    trackLoginFail,
    trackThirdPartyLogin,
  }
}

export function useRegisterAnalytics() {
  const analytics = useAnalytics()

  const trackRegisterPageView = () => {
    analytics.trackPageView('注册页')
  }

  const trackRegisterClick = (method: 'account' | 'phone') => {
    analytics.trackClick('register_button', { method })
  }

  const trackRegisterSuccess = (method: string) => {
    analytics.trackConversion('register_success', undefined, { method })
  }

  const trackRegisterFail = (method: string, reason?: string) => {
    analytics.trackConversion('register_fail', undefined, { method, reason })
  }

  return {
    ...analytics,
    trackRegisterPageView,
    trackRegisterClick,
    trackRegisterSuccess,
    trackRegisterFail,
  }
}

export function usePaymentAnalytics() {
  const analytics = useAnalytics()

  const trackPaymentPageView = () => {
    analytics.trackPageView('支付页')
  }

  const trackPaymentMethodSelect = (method: string) => {
    analytics.trackClick(`payment_method_${method}`)
  }

  const trackPaymentSuccess = (amount: number, method: string, productId?: string) => {
    analytics.trackConversion('payment_success', amount, { method, productId })
  }

  const trackPaymentFail = (method: string, reason?: string) => {
    analytics.trackConversion('payment_fail', undefined, { method, reason })
  }

  const trackRechargeAmountSelect = (amount: number) => {
    analytics.trackClick('recharge_amount', { amount })
  }

  return {
    ...analytics,
    trackPaymentPageView,
    trackPaymentMethodSelect,
    trackPaymentSuccess,
    trackPaymentFail,
    trackRechargeAmountSelect,
  }
}

export function useVipAnalytics() {
  const analytics = useAnalytics()

  const trackVipPageView = () => {
    analytics.trackPageView('VIP会员页')
  }

  const trackVipPlanClick = (planType: string) => {
    analytics.trackClick(`vip_plan_${planType}`)
  }

  const trackVipPurchaseClick = (planType: string, price: number) => {
    analytics.trackClick('vip_purchase', { planType, price })
  }

  const trackVipPurchaseSuccess = (planType: string, price: number) => {
    analytics.trackConversion('vip_purchase_success', price, { planType })
  }

  return {
    ...analytics,
    trackVipPageView,
    trackVipPlanClick,
    trackVipPurchaseClick,
    trackVipPurchaseSuccess,
  }
}

export function useAIChatAnalytics() {
  const analytics = useAnalytics()

  const trackChatStart = (modelType?: string) => {
    analytics.trackFeatureUsage('ai_chat', 'start', { modelType })
  }

  const trackChatMessage = (modelType?: string) => {
    analytics.trackFeatureUsage('ai_chat', 'message', { modelType })
  }

  const trackChatModelSelect = (modelName: string) => {
    analytics.trackClick(`model_select_${modelName}`)
  }

  const trackChatEnd = (duration: number, messageCount: number) => {
    analytics.trackFeatureUsage('ai_chat', 'end', { duration, messageCount })
  }

  return {
    ...analytics,
    trackChatStart,
    trackChatMessage,
    trackChatModelSelect,
    trackChatEnd,
  }
}

export function useAgentAnalytics() {
  const analytics = useAnalytics()

  const trackAgentListView = () => {
    analytics.trackPageView('智能体列表')
  }

  const trackAgentDetailView = (agentId: string, agentName?: string) => {
    analytics.trackPageView('智能体详情')
    analytics.trackContentInteraction('agent', 'view', agentId, { agentName })
  }

  const trackAgentUse = (agentId: string, agentName?: string) => {
    analytics.trackFeatureUsage('agent', 'use', { agentId, agentName })
  }

  const trackAgentFavorite = (agentId: string, action: 'add' | 'remove') => {
    analytics.trackContentInteraction('agent', `favorite_${action}`, agentId)
  }

  return {
    ...analytics,
    trackAgentListView,
    trackAgentDetailView,
    trackAgentUse,
    trackAgentFavorite,
  }
}

export function useAPIAnalytics() {
  const analytics = useAnalytics()

  const trackApiDocView = (endpoint?: string) => {
    analytics.trackPageView('API文档')
    if (endpoint) {
      analytics.trackContentInteraction('api_doc', 'view', endpoint)
    }
  }

  const trackApiCall = (endpoint: string, method: string, responseTime?: number) => {
    analytics.trackFeatureUsage('api', 'call', { endpoint, method, responseTime })
  }

  const trackApiTokenManage = (action: 'create' | 'delete' | 'view') => {
    analytics.trackFeatureUsage('api_token', action)
  }

  return {
    ...analytics,
    trackApiDocView,
    trackApiCall,
    trackApiTokenManage,
  }
}

export function useEnterpriseAnalytics() {
  const analytics = useAnalytics()

  const trackEnterprisePageView = () => {
    analytics.trackPageView('企业服务')
    void analytics.sendEvent({
      category: 'page_view',
      action: 'enterprise_service_view',
      label: 'landing',
    })
  }

  const trackCTAClick = (ctaType: 'join' | 'learn_more' | 'contact') => {
    analytics.trackConversion(`cta_${ctaType}`, undefined, {
      page: 'enterprise_service',
    })
  }

  const trackModuleClick = (moduleName: 'local' | 'online' | 'ai_service') => {
    analytics.trackContentInteraction('service_module', 'click', moduleName)
  }

  const trackCoursePhaseSwitch = (phase: string) => {
    analytics.trackContentInteraction('course_system', 'phase_switch', phase)
  }

  const trackQuadrantClick = (quadrant: 'q1' | 'q2' | 'q3' | 'q4') => {
    analytics.trackContentInteraction('agent_compass', 'quadrant_click', quadrant)
  }

  const trackSideNavClick = (section: string) => {
    analytics.trackClick(`side_nav_${section}`, { page: 'enterprise_service' })
  }

  const trackJoinConversion = (priceType: 'standard' | 'early_bird') => {
    analytics.trackConversion('join_click', priceType === 'early_bird' ? 6000 : 18000, {
      priceType,
      page: 'enterprise_service',
    })
  }

  return {
    ...analytics,
    trackEnterprisePageView,
    trackCTAClick,
    trackModuleClick,
    trackCoursePhaseSwitch,
    trackQuadrantClick,
    trackSideNavClick,
    trackJoinConversion,
  }
}

export const analyticsUtils = {
  getSessionId,
  getUserId,
  flushQueue,
  initAnalytics,
  sendEvent,
  trackPageView: (pageName?: string, path?: string) => {
    void sendEvent({
      category: 'page_view',
      action: 'view',
      label: pageName || path || (typeof window !== 'undefined' ? window.location.pathname : ''),
      customData: {
        title: typeof document !== 'undefined' ? document.title : '',
        referrer: typeof document !== 'undefined' ? document.referrer : '',
      },
    })
  },
}
