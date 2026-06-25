/**
 * Admin Dashboard 聚合 API
 *
 * 集中管理后台首页所需的全部数据,封装底层多个原子接口的组合调用与降级策略。
 *
 * 失败时(后端未实现 / 网络异常 / 数据缺失)统一回退到带 *_empty 标记的空值,
 * 前端可据此显示空态或"暂无数据"。
 */

import { adminApi } from './admin/admin'
import {
  getSystemStatistics,
  getRealtimeStatistics,
  getOrderStatistics,
  getUsageStatistics,
} from './statistics/statistics'
import { getAdminActivities, type AdminActivity } from './admin/admin/admin-activities'
import { ElMessage } from 'element-plus'
import { logger } from '@/utils/logger'

/* ═══ Types ═══ */

export interface DashboardOverview {
  /** 注册用户(累计) */
  totalUsers: number
  /** 较昨日 +% */
  usersTrend: number
  /** 今日订单数 */
  todayOrders: number
  /** 较昨日 +% */
  ordersTrend: number
  /** 今日收入(元) */
  todayRevenue: number
  /** 较昨日 +% */
  revenueTrend: number
  /** AI 对话(今日) */
  todayConversations: number
  /** 较昨日 +% */
  conversationsTrend: number
}

export interface MonitorItem {
  key: string
  name: string
  percent: number
  detail: string
}

export interface MonitorOverview {
  items: MonitorItem[]
  source: 'api' | 'empty'
}

export interface ActivityTimelineItem {
  id: number | string
  type: 'user' | 'order' | 'system'
  title: string
  description: string
  time: string
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'info'
}

export interface ActivityTimelineResult {
  list: ActivityTimelineItem[]
  total: number
  source: 'api' | 'empty'
}

export interface DashboardFetchResult<T> {
  data: T
  ok: boolean
  errors: string[]
}

/* ═══ Helpers ═══ */

const ACTIVITY_TYPE_TO_TONE: Record<string, ActivityTimelineItem['tone']> = {
  user_register: 'primary',
  user_login: 'primary',
  user_violation: 'danger',
  order_created: 'info',
  order_paid: 'success',
  order_shipped: 'success',
  order_refund: 'warning',
  order_completed: 'success',
  order_cancelled: 'warning',
  system: 'info',
  system_cache: 'info',
  system_cron: 'info',
  system_alert: 'warning',
  system_error: 'danger',
}

function mapActivityType(rawType: string): ActivityTimelineItem['type'] {
  if (rawType.startsWith('user_')) return 'user'
  if (rawType.startsWith('order_')) return 'order'
  return 'system'
}

function relativeTimeFromNow(dateStr: string): string {
  if (!dateStr) return ''
  const t = new Date(dateStr).getTime()
  if (Number.isNaN(t)) return dateStr
  const diff = Date.now() - t
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return '刚刚'
  if (sec < 3600) return `${Math.floor(sec / 60)} 分钟前`
  if (sec < 86400) return `${Math.floor(sec / 3600)} 小时前`
  if (sec < 604800) return `${Math.floor(sec / 86400)} 天前`
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}-${d.getDate()}`
}

/* ═══ 1. 总览 KPI ═══ */

/**
 * 获取总览 KPI 数据
 * 调用顺序:adminApi.dashboardStats → getSystemStatistics → getOrderStatistics → getUsageStatistics
 * 任一失败不影响其他字段,缺失则返回 0
 */
export async function getDashboardOverview(): Promise<DashboardFetchResult<DashboardOverview>> {
  const errors: string[] = []
  const result: DashboardOverview = {
    totalUsers: 0,
    usersTrend: 0,
    todayOrders: 0,
    ordersTrend: 0,
    todayRevenue: 0,
    revenueTrend: 0,
    todayConversations: 0,
    conversationsTrend: 0,
  }

  // 1) 核心 4 指标(后端优先,fallback 已有)
  try {
    const r = await adminApi.dashboardStats()
    if (r.success && r.data) {
      result.totalUsers = r.data.userCount ?? 0
      result.todayOrders = r.data.orderCount ?? 0
      result.todayRevenue = r.data.revenue ?? 0
      // courseCount 暂不展示
    } else {
      errors.push('dashboardStats: 返回失败')
    }
  } catch (e) {
    errors.push(`dashboardStats: ${(e as Error)?.message || String(e)}`)
  }

  // 2) 系统统计(补 conversation 字段)
  try {
    const r = await getSystemStatistics()
    if (r.success && r.data) {
      // AI 对话数用今日累计
      result.todayConversations = r.data.chat?.totalConversations ?? 0
    }
  } catch (e) {
    errors.push(`systemStatistics: ${(e as Error)?.message || String(e)}`)
  }

  // 3) 订单统计(校验 todayOrders)
  try {
    const r = await getOrderStatistics({ type: 'today' })
    if (r.success && r.data?.summary) {
      const summary = r.data.summary
      if (summary.totalOrders > 0) result.todayOrders = summary.totalOrders
      if (summary.totalAmount > 0) result.todayRevenue = summary.totalAmount
    }
  } catch (e) {
    errors.push(`orderStatistics: ${(e as Error)?.message || String(e)}`)
  }

  // 4) 使用统计(对话数)
  try {
    const r = await getUsageStatistics({ type: 'today' })
    if (r.success && r.data?.chat) {
      result.todayConversations = r.data.chat.totalSessions || result.todayConversations
    }
  } catch (e) {
    errors.push(`usageStatistics: ${(e as Error)?.message || String(e)}`)
  }

  // 5) 趋势(暂无原子接口 → 后端预留 0)
  // 后续可对接: getDashboardTrend('1d') 之类接口

  const ok = result.totalUsers + result.todayOrders + result.todayConversations > 0

  if (!ok && errors.length > 0) {
    logger.warn('[admin-dashboard] 总览数据全空,可能后端未实现:', errors)
  }

  return { data: result, ok, errors }
}

/* ═══ 2. 实时监控 ═══ */

export async function getMonitorOverview(): Promise<DashboardFetchResult<MonitorOverview>> {
  const errors: string[] = []
  const items: MonitorItem[] = []
  let source: 'api' | 'empty' = 'empty'

  // 1) 实时 QPS / 错误率 / 延迟
  try {
    const r = await getRealtimeStatistics()
    if (r.success && r.data) {
      source = 'api'
      const data = r.data
      const qps = data.currentQPS ?? 0
      const qpsMax = Math.max(1000, qps * 5) // 估算 QPS 上限
      items.push({
        key: 'qps',
        name: 'API QPS',
        percent: Math.min(100, Math.round((qps / qpsMax) * 100)),
        detail: `当前 ${qps.toFixed(0)} · 峰值估算 ${qpsMax.toFixed(0)}`,
      })
      items.push({
        key: 'concurrency',
        name: '并发请求',
        percent: Math.min(100, Math.round((data.currentConcurrency ?? 0))),
        detail: `当前 ${data.currentConcurrency ?? 0}`,
      })
      items.push({
        key: 'error',
        name: '错误率',
        percent: Math.min(100, Math.round((data.errorRate ?? 0) * 100)),
        detail: `近实时 ${(data.errorRate ?? 0).toFixed(2)}%`,
      })
      const latency = data.avgResponseTime ?? 0
      items.push({
        key: 'latency',
        name: '平均响应',
        percent: Math.min(100, Math.round(latency / 5)),
        detail: `中位数 ${latency.toFixed(0)}ms`,
      })
    }
  } catch (e) {
    errors.push(`realtime: ${(e as Error)?.message || String(e)}`)
  }

  // 2) DB 连接池(若可用)
  try {
    const { getPoolStats } = await import('./monitoring')
    const r = await getPoolStats()
    if (r.success && r.data) {
      source = 'api'
      const total = r.data.totalConnections || 1
      const active = r.data.activeConnections || 0
      const idle = r.data.idleConnections || 0
      items.unshift({
        key: 'db',
        name: '数据库连接',
        percent: Math.round((active / total) * 100),
        detail: `活跃 ${active} · 空闲 ${idle} · 等待 ${r.data.waitingCount ?? 0}`,
      })
    }
  } catch (e) {
    // monitoring 模块失败不影响主流程
    logger.debug('[admin-dashboard] getPoolStats skipped:', e)
  }

  // 3) 内存/磁盘(后端无标准接口,留 0,前端可补充)
  // 暂用 QPS/error 之外补 2 个 0% 占位,后续对接
  if (items.length < 6) {
    const existing = new Set(items.map(i => i.key))
    if (!existing.has('cpu')) {
      items.push({ key: 'cpu', name: 'CPU 使用率', percent: 0, detail: '暂无数据' })
    }
    if (!existing.has('memory')) {
      items.push({ key: 'memory', name: '内存使用率', percent: 0, detail: '暂无数据' })
    }
    if (!existing.has('disk')) {
      items.push({ key: 'disk', name: '磁盘使用率', percent: 0, detail: '暂无数据' })
    }
  }

  return {
    data: { items, source },
    ok: items.length > 0,
    errors,
  }
}

/* ═══ 3. 活动时间线 ═══ */

export async function getActivityTimeline(limit = 10): Promise<DashboardFetchResult<ActivityTimelineResult>> {
  const errors: string[] = []
  let source: 'api' | 'empty' = 'empty'

  try {
    const r = await getAdminActivities({ page: 1, pageSize: limit })
    if (r.success && r.data?.list) {
      source = 'api'
      const list: ActivityTimelineItem[] = (r.data.list as AdminActivity[]).map(a => ({
        id: a.id,
        type: mapActivityType(a.type),
        title: a.description || activityTitleFallback(a.type),
        description: a.userName
          ? `${a.userName} · ${a.ip || '未知 IP'} · ${a.device || '未知设备'}`
          : a.ip
            ? `${a.ip} · ${a.device || '未知设备'}`
            : a.device || '',
        time: relativeTimeFromNow(a.createdAt),
        tone: ACTIVITY_TYPE_TO_TONE[a.type] || 'info',
      }))
      return {
        data: { list, total: r.data.total || list.length, source },
        ok: list.length > 0,
        errors,
      }
    } else {
      errors.push('activities: 返回失败')
    }
  } catch (e) {
    errors.push(`activities: ${(e as Error)?.message || String(e)}`)
  }

  return {
    data: { list: [], total: 0, source: 'empty' },
    ok: false,
    errors,
  }
}

function activityTitleFallback(type: string): string {
  const map: Record<string, string> = {
    user_register: '新用户注册',
    user_login: '用户登录',
    user_violation: '违规处理',
    order_created: '订单创建',
    order_paid: '订单支付',
    order_shipped: '订单发货',
    order_refund: '订单退款',
    order_completed: '订单完成',
    order_cancelled: '订单取消',
    system: '系统事件',
    system_cache: '缓存刷新',
    system_cron: '定时任务',
    system_alert: '系统告警',
    system_error: '系统错误',
  }
  return map[type] || type
}

/* ═══ 4. 业务模块统计(12 个) ═══ */

export interface ModuleStat {
  /** 模块 key,前端 UI 用 */
  key: string
  /** 显示名(留空则前端 i18n 兜底) */
  name?: string
  /** 数字统计(订单数 / 课程数 ...) */
  count: number
  /** 显示用的简短文本(若已格式化,如 "12,486" 则用 countText) */
  countText?: string
  /** 数据来源是否成功 */
  ok: boolean
}

export interface ModuleStatsResult {
  /** 按 key 索引 */
  byKey: Record<string, ModuleStat>
  /** 是否至少一个成功 */
  ok: boolean
  errors: string[]
}

/**
 * 12 个业务模块的总数统计
 * 用 size=1 的 list 接口拿 total,失败则单项 ok=false,其他不受影响
 *
 * 后端可后续提供聚合接口 /admin/dashboard/module-stats 一次返回,
 * 届时把本函数替换为调用该接口即可,前端 UI 不动
 */
export async function getModuleStats(): Promise<DashboardFetchResult<ModuleStatsResult>> {
  const errors: string[] = []
  const byKey: Record<string, ModuleStat> = {}

  // 形参为 size=1 的 ListParams —— 所有 admin list 接口都接受
  const size1 = { current: 1, size: 1 }

  // 12 个模块,key 与前端 i18n / 路由对齐
  const tasks: Array<Promise<void>> = [
    // 1. 订单
    (async () => {
      try {
        const r = await adminApi.learnOrderList(size1)
        const total = (r.data as { total?: number })?.total ?? 0
        byKey.orders = { key: 'orders', count: total, ok: r.success ?? false }
      } catch (e) {
        errors.push(`orders: ${(e as Error)?.message || String(e)}`)
        byKey.orders = { key: 'orders', count: 0, ok: false }
      }
    })(),
    // 2. 课程/产品
    (async () => {
      try {
        const r = await adminApi.learnLessonList(size1)
        const total = (r.data as { total?: number })?.total ?? 0
        byKey.products = { key: 'products', count: total, ok: r.success ?? false }
      } catch (e) {
        errors.push(`products: ${(e as Error)?.message || String(e)}`)
        byKey.products = { key: 'products', count: 0, ok: false }
      }
    })(),
    // 3. 会员
    (async () => {
      try {
        const r = await adminApi.memberList(size1)
        const total = (r.data as { total?: number })?.total ?? 0
        byKey.users = { key: 'users', count: total, ok: r.success ?? false }
      } catch (e) {
        errors.push(`users: ${(e as Error)?.message || String(e)}`)
        byKey.users = { key: 'users', count: 0, ok: false }
      }
    })(),
    // 4. AI Agent
    (async () => {
      try {
        const r = await adminApi.dashboardStats()
        // 后端无单独 agent 列表时,从 dashboard 字段推断
        const agentCount = (r.data as { agentCount?: number })?.agentCount ?? 0
        byKey.agents = { key: 'agents', count: agentCount, ok: r.success ?? false }
      } catch (e) {
        errors.push(`agents: ${(e as Error)?.message || String(e)}`)
        byKey.agents = { key: 'agents', count: 0, ok: false }
      }
    })(),
    // 5. 分销
    (async () => {
      try {
        const r = await adminApi.memberList({ ...size1, keyword: 'distribution' })
        const total = (r.data as { total?: number })?.total ?? 0
        byKey.distribution = { key: 'distribution', count: total, ok: r.success ?? false }
      } catch (e) {
        errors.push(`distribution: ${(e as Error)?.message || String(e)}`)
        byKey.distribution = { key: 'distribution', count: 0, ok: false }
      }
    })(),
    // 6. 营销活动(暂无专属列表,借 announcement 数)
    (async () => {
      try {
        const r = await adminApi.messageAnnouncement(size1)
        const total = (r.data as { total?: number })?.total ?? 0
        byKey.promotion = { key: 'promotion', count: total, ok: r.success ?? false }
      } catch (e) {
        errors.push(`promotion: ${(e as Error)?.message || String(e)}`)
        byKey.promotion = { key: 'promotion', count: 0, ok: false }
      }
    })(),
    // 7. 内容(资讯)
    (async () => {
      try {
        const r = await adminApi.newsContentList(size1)
        const total = (r.data as { total?: number })?.total ?? 0
        byKey.content = { key: 'content', count: total, ok: r.success ?? false }
      } catch (e) {
        errors.push(`content: ${(e as Error)?.message || String(e)}`)
        byKey.content = { key: 'content', count: 0, ok: false }
      }
    })(),
    // 8. 反馈/评论
    (async () => {
      try {
        const r = await adminApi.commentList(size1)
        const total = (r.data as { total?: number })?.total ?? 0
        byKey.feedback = { key: 'feedback', count: total, ok: r.success ?? false }
      } catch (e) {
        errors.push(`feedback: ${(e as Error)?.message || String(e)}`)
        byKey.feedback = { key: 'feedback', count: 0, ok: false }
      }
    })(),
    // 9. 数据分析(无列表 → 用 dashboardStats 的派生字段)
    (async () => {
      try {
        const r = await adminApi.dashboardStats()
        const total = (r.data as { orderCount?: number })?.orderCount ?? 0
        byKey.analytics = { key: 'analytics', count: total, ok: r.success ?? false }
      } catch (e) {
        errors.push(`analytics: ${(e as Error)?.message || String(e)}`)
        byKey.analytics = { key: 'analytics', count: 0, ok: false }
      }
    })(),
    // 10. Webhook(暂无列表 → 占位 0)
    (async () => {
      byKey.webhook = { key: 'webhook', count: 0, ok: false }
    })(),
    // 11. 工具(借 role 列表数)
    (async () => {
      try {
        const r = await adminApi.roleList(size1)
        const total = (r.data as { total?: number })?.total ?? 0
        byKey.tool = { key: 'tool', count: total, ok: r.success ?? false }
      } catch (e) {
        errors.push(`tool: ${(e as Error)?.message || String(e)}`)
        byKey.tool = { key: 'tool', count: 0, ok: false }
      }
    })(),
    // 12. 设置 → 用 settingBase 作为健康度探针(成功 = 1)
    (async () => {
      try {
        const r = await adminApi.settingBase()
        byKey.settings = { key: 'settings', count: r.success ? 1 : 0, ok: r.success ?? false }
      } catch (e) {
        errors.push(`settings: ${(e as Error)?.message || String(e)}`)
        byKey.settings = { key: 'settings', count: 0, ok: false }
      }
    })(),
  ]

  await Promise.allSettled(tasks)

  const okCount = Object.values(byKey).filter(m => m.ok).length
  return {
    data: {
      byKey,
      ok: okCount > 0,
      errors,
    },
    ok: okCount > 0,
    errors,
  }
}

/* ═══ 5. 聚合拉取(并行) ═══ */

/**
 * 一次性拉取 dashboard 全部数据
 * 任一失败不影响其他,整体返回
 */
export async function getDashboardAll(): Promise<{
  overview: DashboardFetchResult<DashboardOverview>
  monitor: DashboardFetchResult<MonitorOverview>
  timeline: DashboardFetchResult<ActivityTimelineResult>
  modules: DashboardFetchResult<ModuleStatsResult>
}> {
  const [overview, monitor, timeline, modules] = await Promise.all([
    getDashboardOverview(),
    getMonitorOverview(),
    getActivityTimeline(10),
    getModuleStats(),
  ])

  // 整体为空时给一个轻提示(仅 dev 模式)
  if (!overview.ok && !monitor.ok && !timeline.ok && !modules.ok && import.meta.env.DEV) {
    ElMessage.warning('仪表盘数据为空，请检查后端服务')
  }

  return { overview, monitor, timeline, modules }
}
