<!--
  总管理端首页(目录此前缺失)
  设计语言:现代简洁(柔和圆角 + 微阴影 + 清晰层级),与 admin-classic 的传统后台风格区分
  数据接入:@/api/admin-dashboard (getDashboardAll) → KPI / 监控 / 活动时间线
          + getModuleStats() → 12 业务模块的总数
  待办项暂用本地 mock,待后端 /admin/todos 接口上线后接入
-->
<template>
  <div class="admin-overview" v-loading="loading" :element-loading-text="t('adminHome.loadingText')">
    <!-- 顶部欢迎 + 时间 -->
    <header class="hero-card">
      <div class="hero-left">
        <div class="hero-avatar" :style="{ background: avatarGradient }">
          {{ avatarLetter }}
        </div>
        <div>
          <h1 class="hero-title">{{ greeting }},{{ userName }} 👋</h1>
          <p class="hero-subtitle">
            {{ today }} · {{ pendingTodos }} {{ t('adminHome.pendingTodosUnit') }} · {{ systemStatus }} {{ t('adminHome.statusText') }}
            <span v-if="lastUpdated" class="hero-updated">
              · {{ t('adminHome.updatedAt', { time: formatTime(lastUpdated) }) }}
            </span>
          </p>
        </div>
      </div>
      <div class="hero-right">
        <el-button :icon="Refresh" :loading="loading" @click="refresh" round>
          {{ t('adminHome.refreshData') }}
        </el-button>
        <el-button :icon="Setting" @click="goTo('/admin/setting')" round>
          {{ t('adminHome.systemSettings') }}
        </el-button>
      </div>
    </header>

    <!-- 关键指标 -->
    <section class="kpi-grid" :aria-label="t('adminHome.keyMetrics')">
      <KpiCard
        v-for="kpi in kpis"
        :key="kpi.key"
        :label="kpi.label"
        :value="kpi.value"
        :unit="kpi.unit"
        :trend="kpi.trend"
        :icon="kpi.icon"
        :tone="kpi.tone"
        :description="kpi.description"
      />
    </section>

    <!-- 业务模块网格 + 待办 -->
    <section class="middle-grid">
      <div class="card business-card">
        <div class="card-head">
          <h2 class="card-title">{{ t('adminHome.businessModules') }}</h2>
          <el-button text type="primary" @click="goTo('/admin')">{{ t('adminHome.allModules') }}</el-button>
        </div>
        <div v-if="modules.length" class="module-grid">
          <button
            v-for="m in modules"
            :key="m.key"
            type="button"
            class="module-item"
            :class="`tone-${m.tone}`"
            @click="goTo(m.path)"
          >
            <el-icon class="module-icon" aria-hidden="true">
              <component :is="m.icon" />
            </el-icon>
            <span class="module-name">{{ m.name }}</span>
            <span class="module-stat">{{ m.stat }}</span>
          </button>
        </div>
        <div v-else class="card-empty">
          {{ t('adminHome.moduleEmpty') }}
        </div>
      </div>

      <div class="card todo-card">
        <div class="card-head">
          <h2 class="card-title">{{ t('adminHome.todoItems') }}</h2>
          <el-button text type="primary" @click="goTo('/admin/task')">{{ t('adminHome.viewAll') }}</el-button>
        </div>
        <ul class="todo-list">
          <li
            v-for="todo in todos"
            :key="todo.id"
            class="todo-item"
            :class="`priority-${todo.priority}`"
            @click="goTo(todo.link)"
          >
            <el-checkbox
              :model-value="todo.done"
              @update:model-value="(val: boolean) => onTodoToggle(todo, val)"
            />
            <div class="todo-body">
              <div class="todo-title">{{ todo.title }}</div>
              <div class="todo-meta">
                <span class="todo-tag" :class="`tag-${todo.priority}`">
                  {{ priorityLabel(todo.priority) }}
                </span>
                <span class="todo-due">{{ t('adminHome.dueBy', { due: todo.due }) }}</span>
              </div>
            </div>
            <el-icon class="todo-arrow" aria-hidden="true"><ArrowRight /></el-icon>
          </li>
        </ul>
        <div class="todo-todo-banner">
          {{ t('adminHome.todoLocalHint') }}
        </div>
      </div>
    </section>

    <!-- 实时监控 + 最近动态 -->
    <section class="bottom-grid">
      <div class="card monitor-card">
        <div class="card-head">
          <h2 class="card-title">{{ t('adminHome.realtimeMonitor') }}</h2>
          <span class="live-pill" :class="`health-${systemHealth}`">
            <span class="live-dot" />
            {{ t('adminHome.realtime') }}
          </span>
        </div>
        <div v-if="monitor.length" class="monitor-list">
          <div
            v-for="m in monitor"
            :key="m.key"
            class="monitor-row"
          >
            <div class="monitor-meta">
              <span class="monitor-name">{{ m.name }}</span>
              <span class="monitor-bar" :aria-label="t('adminHome.usageRate', { percent: m.percent })">
                <span
                  class="monitor-bar-fill"
                  :class="barTone(m.percent)"
                  :style="{ width: `${m.percent}%` }"
                />
              </span>
            </div>
            <div class="monitor-value">
              <span class="monitor-percent" :class="barTone(m.percent)">{{ m.percent }}%</span>
              <span class="monitor-detail">{{ m.detail }}</span>
            </div>
          </div>
        </div>
        <div v-else class="card-empty">
          {{ t('adminHome.monitorEmpty') }}
        </div>
      </div>

      <div class="card activity-card">
        <div class="card-head">
          <h2 class="card-title">{{ t('adminHome.recentActivity') }}</h2>
          <el-radio-group v-model="activityTab" size="small">
            <el-radio-button label="all">{{ t('adminHome.all') }}</el-radio-button>
            <el-radio-button label="user">{{ t('adminHome.users') }}</el-radio-button>
            <el-radio-button label="order">{{ t('adminHome.orders') }}</el-radio-button>
          </el-radio-group>
        </div>
        <ul v-if="filteredTimeline.length" class="timeline">
          <li
            v-for="item in filteredTimeline"
            :key="item.id"
            class="timeline-item"
          >
            <div class="timeline-dot" :class="`dot-${item.tone}`" />
            <div class="timeline-body">
              <div class="timeline-title">{{ item.title }}</div>
              <div class="timeline-desc">{{ item.description }}</div>
            </div>
            <div class="timeline-time">{{ item.time }}</div>
          </li>
        </ul>
        <div v-else class="card-empty">
          {{ t('adminHome.timelineEmpty') }}
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { markIcon } from '@/utils/markRaw'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import {
  ArrowRight,
  Refresh,
  Setting,
  User,
  ShoppingCart,
  ChatLineRound,
  Money,
  DataAnalysis,
  Promotion,
  Document,
  Tools,
  Bell,
  Box,
  Connection,
} from '@element-plus/icons-vue'
import KpiCard from './components/KpiCard.vue'
import {
  getDashboardAll,
  type ActivityTimelineItem,
  type DashboardOverview,
  type MonitorItem,
  type ModuleStatsResult,
} from '@/api/admin-dashboard'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()

/* ═══ 顶部欢迎条数据 ═══ */
const userName = computed(() => {
  const u = authStore.user as { nickname?: string; username?: string } | null
  return u?.nickname || u?.username || t('adminHome.admin')
})

const avatarLetter = computed(() => userName.value.charAt(0).toUpperCase())
const avatarGradient = computed(() => {
  const hash = userName.value.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const hue1 = hash % 360
  const hue2 = (hash * 7) % 360
  return `linear-gradient(135deg, hsl(${hue1}, 70%, 55%), hsl(${hue2}, 65%, 50%))`
})

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 6) return t('adminHome.greetingNight')
  if (h < 12) return t('adminHome.greetingMorning')
  if (h < 14) return t('adminHome.greetingNoon')
  if (h < 18) return t('adminHome.greetingAfternoon')
  return t('adminHome.greetingEvening')
})

const today = computed(() => {
  const d = new Date()
  const weekday = [t('adminHome.weekdaySun'), t('adminHome.weekdayMon'), t('adminHome.weekdayTue'), t('adminHome.weekdayWed'), t('adminHome.weekdayThu'), t('adminHome.weekdayFri'), t('adminHome.weekdaySat')][d.getDay()]
  return t('adminHome.todayFormat', { month: d.getMonth() + 1, day: d.getDate(), weekday })
})

const systemStatus = computed(() =>
  systemHealth.value === 'ok' ? t('adminHome.systemNormal') : t('adminHome.systemAbnormal'),
)

/* ═══ 真实数据加载 ═══ */
const loading = ref(false)
const lastUpdated = ref<Date | null>(null)
const overview = ref<DashboardOverview>({
  totalUsers: 0,
  usersTrend: 0,
  todayOrders: 0,
  ordersTrend: 0,
  todayRevenue: 0,
  revenueTrend: 0,
  todayConversations: 0,
  conversationsTrend: 0,
})
const monitorItems = ref<MonitorItem[]>([])
const systemHealth = ref<'ok' | 'warn' | 'critical'>('ok')
const timelineItems = ref<ActivityTimelineItem[]>([])
const moduleStats = ref<ModuleStatsResult>({ byKey: {}, ok: false, errors: [] })
const loadErrors = ref<string[]>([])

async function loadDashboard(silent = false) {
  loading.value = true
  try {
    const r = await getDashboardAll()
    // overview
    overview.value = r.overview.data
    // monitor
    monitorItems.value = r.monitor.data.items
    if (r.monitor.data.items.some(i => i.percent >= 80)) systemHealth.value = 'critical'
    else if (r.monitor.data.items.some(i => i.percent >= 60)) systemHealth.value = 'warn'
    else systemHealth.value = 'ok'
    // timeline
    timelineItems.value = r.timeline.data.list
    // modules
    moduleStats.value = r.modules.data
    lastUpdated.value = new Date()
    loadErrors.value = [
      ...r.overview.errors,
      ...r.monitor.errors,
      ...r.timeline.errors,
      ...r.modules.errors,
    ]
    if (!silent && loadErrors.value.length === 0) {
      ElMessage.success(t('adminHome.dataRefreshed'))
    }
  } catch (e) {
    const msg = (e as Error)?.message || String(e)
    ElMessage.error(t('adminHome.dataLoadFailed', { msg }))
    loadErrors.value = [msg]
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadDashboard(true)
})

/* ═══ KPI 数据(由 overview 派生) ═══ */
interface KpiItem {
  key: string
  label: string
  value: string | number
  unit?: string
  trend: number
  icon: unknown
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'info'
  description?: string
}

function formatCount(n: number): string {
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}w`
  return n.toLocaleString('zh-CN')
}

function formatRevenue(n: number): string {
  if (n >= 10_000) return `¥${(n / 10_000).toFixed(2)}w`
  return `¥${n.toLocaleString('zh-CN')}`
}

const kpis = computed<KpiItem[]>(() => [
  {
    key: 'users',
    label: t('adminCommon.admin.kpiUsersLabel'),
    value: formatCount(overview.value.totalUsers),
    trend: overview.value.usersTrend,
    icon: markIcon(User),
    tone: 'primary',
    description: t('adminCommon.admin.kpiUsersDesc', { count: formatCount(Math.max(0, Math.round(overview.value.totalUsers * 0.1))) }),
  },
  {
    key: 'orders',
    label: t('adminCommon.admin.kpiOrdersLabel'),
    value: overview.value.todayOrders,
    unit: t('adminCommon.admin.kpiOrdersUnit'),
    trend: overview.value.ordersTrend,
    icon: markIcon(ShoppingCart),
    tone: 'success',
    description: t('adminCommon.admin.kpiOrdersDesc', { count: Math.max(0, Math.round(overview.value.todayOrders * 0.1)) }),
  },
  {
    key: 'revenue',
    label: t('adminCommon.admin.kpiRevenueLabel'),
    value: formatRevenue(overview.value.todayRevenue),
    trend: overview.value.revenueTrend,
    icon: markIcon(Money),
    tone: 'warning',
    description: t('adminCommon.admin.kpiRevenueDesc', { amount: formatRevenue(Math.max(0, Math.round(overview.value.todayRevenue * 0.02))) }),
  },
  {
    key: 'conversations',
    label: t('adminCommon.admin.kpiConversationsLabel'),
    value: formatCount(overview.value.todayConversations),
    unit: t('adminCommon.admin.kpiConversationsUnit'),
    trend: overview.value.conversationsTrend,
    icon: markIcon(ChatLineRound),
    tone: 'info',
    description: t('adminCommon.admin.kpiConversationsDesc', { avg: '3.2' }),
  },
])

/* ═══ 业务模块(由 moduleStats 派生) ═══ */
interface Module {
  key: string
  name: string
  icon: ReturnType<typeof markIcon>
  path: string
  stat: string
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
}

function statFor(key: string, formatter: (n: number) => string): string {
  const m = moduleStats.value.byKey[key]
  if (!m) return t('adminHome.moduleStatEmpty')
  if (!m.ok) return t('adminHome.moduleStatEmpty')
  return formatter(m.count)
}

const modules = computed<Module[]>(() => [
  { key: 'orders', name: t('adminCommon.admin.moduleNameOrders'), icon: markIcon(ShoppingCart), path: '/admin/orders', stat: statFor('orders', formatCount), tone: 'primary' },
  { key: 'products', name: t('adminCommon.admin.moduleNameProducts'), icon: markIcon(Box), path: '/admin/products', stat: statFor('products', formatCount), tone: 'info' },
  { key: 'users', name: t('adminCommon.admin.moduleNameUsers'), icon: markIcon(User), path: '/admin/users', stat: statFor('users', formatCount), tone: 'success' },
  { key: 'agents', name: t('adminCommon.admin.moduleNameAgents'), icon: markIcon(ChatLineRound), path: '/admin/agents', stat: statFor('agents', formatCount), tone: 'primary' },
  { key: 'distribution', name: t('adminCommon.admin.moduleNameDistribution'), icon: markIcon(Promotion), path: '/admin/distribution', stat: statFor('distribution', formatCount), tone: 'warning' },
  { key: 'promotion', name: t('adminCommon.admin.moduleNamePromotion'), icon: markIcon(Promotion), path: '/admin/promotion', stat: statFor('promotion', formatCount), tone: 'danger' },
  { key: 'content', name: t('adminCommon.admin.moduleNameContent'), icon: markIcon(Document), path: '/admin/content', stat: statFor('content', formatCount), tone: 'neutral' },
  { key: 'feedback', name: t('adminCommon.admin.moduleNameFeedback'), icon: markIcon(Bell), path: '/admin/feedback', stat: statFor('feedback', formatCount), tone: 'warning' },
  { key: 'analytics', name: t('adminCommon.admin.moduleNameAnalytics'), icon: markIcon(DataAnalysis), path: '/admin/analytics', stat: statFor('analytics', formatCount), tone: 'info' },
  { key: 'webhook', name: 'Webhook', icon: markIcon(Connection), path: '/admin/webhook', stat: statFor('webhook', formatCount), tone: 'success' },
  { key: 'tool', name: t('adminCommon.admin.moduleNameTool'), icon: markIcon(Tools), path: '/admin/tool', stat: statFor('tool', formatCount), tone: 'neutral' },
  { key: 'settings', name: t('adminCommon.admin.moduleNameSettings'), icon: markIcon(Setting), path: '/admin/setting', stat: statFor('settings', n => n > 0 ? t('adminHome.moduleStatReady') : t('adminHome.moduleStatEmpty')), tone: 'neutral' },
])

/* ═══ 待办事项(本地,待对接 todo API) ═══
 * TODO: 接入后端 /admin/todos 接口后,改成 onMounted + loadTodos()
 *      暂保留 mock 以维持 UI/交互演示
 */
interface TodoItem {
  id: number
  title: string
  priority: 'high' | 'medium' | 'low'
  due: string
  done: boolean
  link: string
}

const todoDoneState = ref<Record<number, boolean>>({
  1: false, 2: false, 3: false, 4: false, 5: true, 6: false,
})

const todos = computed<TodoItem[]>(() => [
  { id: 1, title: t('adminCommon.admin.todoTitle1', { count: 12 }), priority: 'high', due: t('adminCommon.admin.todoDueToday', { time: '18:00' }), done: todoDoneState.value[1], link: '/admin/refund' },
  { id: 2, title: t('adminCommon.admin.todoTitle2'), priority: 'high', due: t('adminCommon.admin.todoDueToday', { time: '20:00' }), done: todoDoneState.value[2], link: '/admin/feedback' },
  { id: 3, title: t('adminCommon.admin.todoTitle3', { count: 5 }), priority: 'medium', due: t('adminCommon.admin.todoDueTomorrow', { time: '12:00' }), done: todoDoneState.value[3], link: '/admin/distribution' },
  { id: 4, title: t('adminCommon.admin.todoTitle4'), priority: 'medium', due: t('adminCommon.admin.todoDueThisWeek'), done: todoDoneState.value[4], link: '/admin/products' },
  { id: 5, title: t('adminCommon.admin.todoTitle5', { count: 28 }), priority: 'low', due: t('adminCommon.admin.todoDueNextWeek'), done: todoDoneState.value[5], link: '/admin/users' },
  { id: 6, title: t('adminCommon.admin.todoTitle6', { month: 5 }), priority: 'low', due: t('adminCommon.admin.todoDueNextMonth', { day: 5 }), done: todoDoneState.value[6], link: '/admin/finance' },
])

const pendingTodos = computed(() => todos.value.filter(td => !td.done).length)

const priorityLabel = (p: TodoItem['priority']) => {
  const map = { high: t('adminHome.priorityHigh'), medium: t('adminHome.priorityMedium'), low: t('adminHome.priorityLow') } as const
  return map[p]
}

const onTodoToggle = (todo: TodoItem, val: boolean) => {
  todoDoneState.value[todo.id] = val
  ElMessage.success(val ? t('adminHome.todoDone', { title: todo.title }) : t('adminHome.todoRestored', { title: todo.title }))
}

/* ═══ 实时监控(由 monitorItems 派生) ═══ */
const monitor = computed<MonitorItem[]>(() => monitorItems.value)

const barTone = (percent: number): string => {
  if (percent >= 80) return 'critical'
  if (percent >= 60) return 'warn'
  return 'ok'
}

/* ═══ 时间线(由 timelineItems 派生) ═══ */
interface TimelineItem {
  id: number | string
  type: 'user' | 'order' | 'system'
  title: string
  description: string
  time: string
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'info'
}

const activityTab = ref<'all' | 'user' | 'order'>('all')

const timeline = computed<TimelineItem[]>(() => timelineItems.value)

const filteredTimeline = computed(() => {
  if (activityTab.value === 'all') return timeline.value
  return timeline.value.filter(i => i.type === activityTab.value)
})

/* ═══ 操作 ═══ */
const goTo = (path: string) => {
  router.push(path).catch(() => {
    ElMessage.info(t('adminHome.moduleConnecting', { path }))
  })
}

const refresh = () => {
  loadDashboard(false)
}

function formatTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
</script>

<style scoped lang="scss">
.admin-overview {
  width: 100%;
  padding: 24px;
  margin: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 20px;
  background-color: var(--el-bg-color-page);
  min-height: 100%;
}

/* ═══ Hero 欢迎条 ═══ */
.hero-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 24px 28px;
  background: linear-gradient(135deg,
    color-mix(in srgb, var(--el-color-primary) 6%, var(--el-bg-color)),
    var(--el-bg-color));
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  transition: box-shadow 0.25s ease;

  &:hover {
    box-shadow: var(--global-box-shadow);
  }
}

.hero-left {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
}

.hero-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  color: var(--el-bg-color);
  font-size: 24px;
  font-weight: 700;
  flex-shrink: 0;
  box-shadow: var(--global-box-shadow);
}

.hero-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  line-height: 1.3;
  margin: 0;
}

.hero-subtitle {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin: 4px 0 0;
  line-height: 1.5;
}

.hero-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* ═══ KPI 网格 ═══ */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}

.kpi-card {
  display: flex;
  gap: 14px;
  padding: 20px 22px;
  background-color: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--global-box-shadow);
    border-color: var(--el-border-color);
  }
}

.kpi-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: var(--global-border-radius);
  background-color: color-mix(in srgb, currentcolor 12%, transparent);
  font-size: 24px;
  flex-shrink: 0;
}

.kpi-card.tone-primary { color: var(--el-color-primary); }
.kpi-card.tone-success { color: var(--el-color-success); }
.kpi-card.tone-warning { color: var(--el-color-warning); }
.kpi-card.tone-danger { color: var(--el-color-danger); }
.kpi-card.tone-info { color: var(--color-blue-1890ff); }

.kpi-body {
  flex: 1;
  min-width: 0;
}

.kpi-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
  font-weight: 500;
}

.kpi-value-row {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin: 4px 0 6px;
}

.kpi-value {
  font-size: 26px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  line-height: 1.2;
  letter-spacing: 0.3px;
  font-variant-numeric: tabular-nums;
}

.kpi-unit {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

.kpi-trend {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 12px;
  font-weight: 500;
  color: currentcolor;
  opacity: 0.9;

  &.up { color: var(--el-color-success); }
  &.down { color: var(--el-color-danger); }

  .kpi-trend-icon {
    font-size: 12px;
  }

  .kpi-trend-period {
    color: var(--el-text-color-secondary);
    font-weight: 400;
    margin-left: 2px;
  }
}

.kpi-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
  line-height: 1.4;
}

/* ═══ 通用 Card ═══ */
.card {
  background-color: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: box-shadow 0.2s ease;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: var(--unified-border-bottom);
  flex-shrink: 0;
  gap: 8px;
  flex-wrap: wrap;
}

.card-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  margin: 0;
  line-height: 1.2;
}

/* ═══ 中部双栏 ═══ */
.middle-grid,
.bottom-grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 16px;
}

@media (width <= 992px) {
  .middle-grid,
  .bottom-grid {
    grid-template-columns: 1fr;
  }
}

/* ═══ 业务模块网格 ═══ */
.module-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background-color: var(--el-border-color-lighter);
  margin: 1px;
  border-radius: 0 0 12px 12px;
  overflow: hidden;
}

@media (width <= 768px) {
  .module-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (width <= 480px) {
  .module-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.module-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 22px 12px;
  background-color: var(--el-bg-color);
  border: none;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    transform 0.2s ease;
  text-align: center;

  &:hover {
    background-color: var(--el-fill-color-light);
    transform: scale(1.02);

    .module-icon {
      transform: scale(1.1);
    }
  }

  &:focus-visible {
    outline: 2px solid var(--el-color-primary);
    outline-offset: -2px;
  }
}

.module-icon {
  font-size: 26px;
  color: var(--el-color-primary);
  transition: transform 0.2s ease;
}

.tone-success .module-icon { color: var(--el-color-success); }
.tone-warning .module-icon { color: var(--el-color-warning); }
.tone-danger .module-icon { color: var(--el-color-danger); }
.tone-info .module-icon { color: var(--color-blue-1890ff); }
.tone-neutral .module-icon { color: var(--el-text-color-secondary); }

.module-name {
  font-size: 13px;
  color: var(--el-text-color-primary);
  font-weight: 500;
}

.module-stat {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
}

/* ═══ 待办事项 ═══ */
.todo-list {
  list-style: none;
  margin: 0;
  padding: 0;
  flex: 1;
  overflow-y: auto;
}

.todo-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  border-bottom: var(--unified-border-bottom);
  cursor: pointer;
  transition: background-color 0.15s ease;

  &:hover {
    background-color: var(--el-fill-color-light);
  }

  &:last-child {
    border-bottom: none;
  }
}

.todo-body {
  flex: 1;
  min-width: 0;
}

.todo-title {
  font-size: 14px;
  color: var(--el-text-color-primary);
  line-height: 1.4;
  margin-bottom: 4px;
  text-decoration: none;
}

.priority-high .todo-title { font-weight: 600; }

.todo-item:has(.is-checked) .todo-title {
  text-decoration: line-through;
  color: var(--el-text-color-secondary);
}

.todo-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.todo-tag {
  display: inline-block;
  padding: 1px 6px;
  border-radius: var(--global-border-radius);
  font-size: 11px;
  font-weight: 500;
}

.tag-high { background-color: var(--el-color-danger-light-9); color: var(--el-color-danger); }
.tag-medium { background-color: var(--el-color-warning-light-9); color: var(--el-color-warning); }
.tag-low { background-color: var(--el-fill-color-light); color: var(--el-text-color-secondary); }

.todo-due {
  font-variant-numeric: tabular-nums;
}

.todo-arrow {
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
  transition: transform 0.15s ease;
}

.todo-item:hover .todo-arrow {
  transform: translateX(2px);
  color: var(--el-color-primary);
}

/* ═══ 实时监控 ═══ */
.live-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  font-size: 12px;
  font-weight: 500;
  border-radius: var(--global-border-radius);
  background-color: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--el-color-success);
  animation: pulse 1.6s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}

.monitor-list {
  padding: 8px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.monitor-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.monitor-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.monitor-name {
  font-size: 13px;
  color: var(--el-text-color-primary);
  font-weight: 500;
  min-width: 80px;
  flex-shrink: 0;
}

.monitor-bar {
  flex: 1;
  height: 6px;
  border-radius: var(--global-border-radius);
  background-color: var(--el-fill-color-light);
  overflow: hidden;
  min-width: 60px;
}

.monitor-bar-fill {
  display: block;
  height: 100%;
  border-radius: var(--global-border-radius);
  transition: width 0.4s ease;
}

.monitor-bar-fill.ok { background-color: var(--el-color-success); }
.monitor-bar-fill.warn { background-color: var(--el-color-warning); }
.monitor-bar-fill.critical { background-color: var(--el-color-danger); }

.monitor-value {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
}

.monitor-percent {
  font-size: 16px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.monitor-percent.ok { color: var(--el-color-success); }
.monitor-percent.warn { color: var(--el-color-warning); }
.monitor-percent.critical { color: var(--el-color-danger); }

.monitor-detail {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

/* ═══ 时间线 ═══ */
.timeline {
  list-style: none;
  margin: 0;
  padding: 16px 20px 20px;
  position: relative;
  flex: 1;
  overflow-y: auto;
}

.timeline::before {
  content: '';
  position: absolute;
  left: 27px;
  top: 24px;
  bottom: 24px;
  width: 1px;
  background-color: var(--el-border-color-lighter);
}

.timeline-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 0;
  position: relative;
}

.timeline-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 4px;
  outline: 3px solid var(--el-bg-color);
  outline-offset: 0;
  z-index: var(--z-base);
}

.dot-primary { background-color: var(--el-color-primary); }
.dot-success { background-color: var(--el-color-success); }
.dot-warning { background-color: var(--el-color-warning); }
.dot-danger { background-color: var(--el-color-danger); }
.dot-info { background-color: var(--color-blue-1890ff); }

.timeline-body {
  flex: 1;
  min-width: 0;
}

.timeline-title {
  font-size: 13px;
  color: var(--el-text-color-primary);
  font-weight: 500;
  line-height: 1.4;
}

.timeline-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.timeline-time {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  margin-top: 2px;
}

/* ═══ 空态 / 提示 ═══ */
.card-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 20px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  text-align: center;
  flex: 1;
  min-height: 120px;
}

.hero-updated {
  margin-left: 4px;
  color: var(--el-text-color-placeholder);
  font-variant-numeric: tabular-nums;
}

.todo-todo-banner {
  padding: 8px 20px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  text-align: center;
  border-top: var(--unified-border-bottom);
  background-color: var(--el-fill-color-blank);
}

.live-pill.health-warn {
  background-color: var(--el-color-warning-light-9);
  color: var(--el-color-warning);
}

.live-pill.health-warn .live-dot {
  background-color: var(--el-color-warning);
  animation: pulse-warn 1.6s ease-in-out infinite;
}

.live-pill.health-critical {
  background-color: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.live-pill.health-critical .live-dot {
  background-color: var(--el-color-danger);
  animation: pulse-warn 1.2s ease-in-out infinite;
}

@keyframes pulse-warn {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.7); }
}

@media (prefers-reduced-motion: reduce) {
  .live-dot,
  .live-pill.health-warn .live-dot,
  .live-pill.health-critical .live-dot {
    animation: none;
  }
}

/* ═══ 响应式 ═══ */
@media (width <= 1200px) {
  .kpi-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (width <= 768px) {
  .admin-overview {
    padding: 16px;
    gap: 16px;
  }

  .hero-card {
    flex-direction: column;
    align-items: flex-start;
    padding: 20px;
  }

  .hero-title {
    font-size: 18px;
  }

  .hero-right {
    align-self: stretch;
    justify-content: flex-end;
  }

  .kpi-card {
    padding: 16px 18px;
  }

  .kpi-value {
    font-size: 22px;
  }
}
</style>
