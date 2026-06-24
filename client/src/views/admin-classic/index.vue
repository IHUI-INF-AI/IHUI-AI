<!--
  管理后台首页(经典表格风格)
  相比原版:
    - 移除 @ts-nocheck,改用 <script setup lang="ts"> + 强类型
    - 从 2 张静态卡片升级为 6 数据卡 + 8 快捷入口 + 活动列表 + 系统状态
    - 保留经典表格风格(白底 + 1px 灰边 + 无阴影)
    - 数据先用 mock 演示,真实 API 可替换 fetchStats()
-->
<template>
  <div class="admin-home">
    <!-- 欢迎区 -->
    <div class="welcome-bar">
      <div class="welcome-text">
        <h1 class="welcome-title">{{ greeting }},{{ userName }}</h1>
        <p class="welcome-subtitle">{{ today }} · {{ weatherTip }}</p>
      </div>
      <div class="welcome-meta">
        <span class="version-pill">v{{ version }}</span>
        <span class="env-pill" :class="`env-${env}`">{{ envLabel }}</span>
      </div>
    </div>

    <!-- 核心数据卡片 -->
    <section class="stats-grid" :aria-label="t('common.coreData')">
      <article
        v-for="card in stats"
        :key="card.key"
        class="stat-card"
        :class="`stat-card-${card.tone}`"
      >
        <div class="stat-icon" aria-hidden="true">
          <el-icon><component :is="card.icon" /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-label">{{ card.label }}</div>
          <div class="stat-value">
            <span class="stat-number">{{ card.value }}</span>
            <span v-if="card.unit" class="stat-unit">{{ card.unit }}</span>
          </div>
          <div class="stat-trend" :class="card.trend > 0 ? 'up' : 'down'">
            <el-icon class="trend-icon" aria-hidden="true">
              <component :is="card.trend > 0 ? 'CaretTop' : 'CaretBottom'" />
            </el-icon>
            <span>{{ Math.abs(card.trend) }}%</span>
            <span class="trend-period">{{ t('adminClassicHome.vsYesterday') }}</span>
          </div>
        </div>
      </article>
    </section>

    <!-- 主体两栏:快捷入口 + 活动 / 状态 -->
    <section class="main-grid">
      <!-- 快捷入口 -->
      <div class="panel quick-actions">
        <div class="panel-header">
          <h2 class="panel-title">{{ t('adminClassicHome.quickActions') }}</h2>
          <el-button text type="primary" @click="refreshAll">{{ t('adminClassicHome.refreshData') }}</el-button>
        </div>
        <div class="quick-grid">
          <button
            v-for="action in quickActions"
            :key="action.key"
            type="button"
            class="quick-item"
            :class="`quick-${action.tone}`"
            @click="goTo(action)"
          >
            <el-icon class="quick-icon" aria-hidden="true">
              <component :is="action.icon" />
            </el-icon>
            <span class="quick-label">{{ action.label }}</span>
            <span v-if="action.badge" class="quick-badge">{{ action.badge }}</span>
          </button>
        </div>
      </div>

      <!-- 系统状态 -->
      <div class="panel system-status">
        <div class="panel-header">
          <h2 class="panel-title">{{ t('adminClassicHome.systemStatus') }}</h2>
          <span class="status-pill" :class="overallStatus.tone">
            <span class="status-dot" :class="overallStatus.tone" />
            {{ overallStatus.text }}
          </span>
        </div>
        <ul class="status-list">
          <li
            v-for="item in systemStatus"
            :key="item.key"
            class="status-item"
          >
            <div class="status-row">
              <span class="status-name">{{ item.name }}</span>
              <span class="status-value" :class="`tone-${item.tone}`">{{ item.value }}</span>
            </div>
            <div class="status-meta">
              <span>{{ item.detail }}</span>
              <span>{{ item.updated }}</span>
            </div>
          </li>
        </ul>
      </div>
    </section>

    <!-- 最近活动 -->
    <section class="panel activity-panel">
      <div class="panel-header">
        <h2 class="panel-title">{{ t('adminClassicHome.recentActivity') }}</h2>
        <el-radio-group v-model="activityFilter" size="small">
          <el-radio-button label="all">{{ t('adminClassicHome.filterAll') }}</el-radio-button>
          <el-radio-button label="user">{{ t('adminClassicHome.filterUser') }}</el-radio-button>
          <el-radio-button label="order">{{ t('adminClassicHome.filterOrder') }}</el-radio-button>
          <el-radio-button label="system">{{ t('adminClassicHome.filterSystem') }}</el-radio-button>
        </el-radio-group>
      </div>
      <ul class="activity-list">
        <li
          v-for="item in filteredActivities"
          :key="item.id"
          class="activity-item"
        >
          <div class="activity-avatar" :class="`avatar-${item.tone}`">
            <el-icon aria-hidden="true"><component :is="item.icon" /></el-icon>
          </div>
          <div class="activity-body">
            <div class="activity-title">{{ item.title }}</div>
            <div class="activity-desc">{{ item.description }}</div>
          </div>
          <div class="activity-time">{{ item.time }}</div>
        </li>
        <li v-if="filteredActivities.length === 0" class="activity-empty">
          {{ t('adminClassicHome.noActivity') }}
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { markIcon } from '@/utils/markRaw'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import {
  User,
  ShoppingCart,
  ChatLineRound,
  Money,
  DataAnalysis,
  Promotion,
  Tools,
  Setting,
  Bell,
  Document,
  TrendCharts,
} from '@element-plus/icons-vue'

const router = useRouter()
const authStore = useAuthStore()

interface StatCard {
  key: string
  label: string
  value: string
  unit?: string
  trend: number
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'info'
  icon: any
}

interface QuickAction {
  key: string
  label: string
  icon: any
  path: string
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
  badge?: string
}

interface StatusItem {
  key: string
  name: string
  value: string
  detail: string
  updated: string
  tone: 'success' | 'warning' | 'danger'
}

interface ActivityItem {
  id: number
  type: 'user' | 'order' | 'system'
  title: string
  description: string
  time: string
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'info'
  icon: any
}

const version = '3.6.5'
const env = (import.meta.env.MODE as 'production' | 'staging' | 'development') || 'production'

const envLabel = computed(() => {
  const map: Record<string, string> = {
    production: t('adminClassicHome.envProduction'),
    staging: t('adminClassicHome.envStaging'),
    development: t('adminClassicHome.envDevelopment'),
  }
  return map[env] || env
})

const today = computed(() => {
  const d = new Date()
  const weekdays = [
    t('adminClassicHome.weekSun'),
    t('adminClassicHome.weekMon'),
    t('adminClassicHome.weekTue'),
    t('adminClassicHome.weekWed'),
    t('adminClassicHome.weekThu'),
    t('adminClassicHome.weekFri'),
    t('adminClassicHome.weekSat'),
  ]
  return t('adminClassicHome.dateFormat', {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    weekday: weekdays[d.getDay()],
  })
})

const weatherTip = computed(() => {
  // 简单随机,后续可对接真实数据
  const tips = [
    t('adminClassicHome.weatherTip1'),
    t('adminClassicHome.weatherTip2'),
    t('adminClassicHome.weatherTip3'),
  ]
  return tips[Math.floor(Date.now() / 86400000) % tips.length]
})

const userName = computed(() => {
  const u = authStore.user as { nickname?: string; username?: string } | null
  return u?.nickname || u?.username || t('adminClassicHome.admin')
})

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 6) return t('adminClassicHome.greetingNight')
  if (h < 12) return t('adminClassicHome.greetingMorning')
  if (h < 14) return t('adminClassicHome.greetingNoon')
  if (h < 18) return t('adminClassicHome.greetingAfternoon')
  return t('adminClassicHome.greetingEvening')
})

const activityFilter = ref<'all' | 'user' | 'order' | 'system'>('all')

const stats = ref<StatCard[]>([
  { key: 'users', label: t('adminClassicHome.statUsers'), value: '12,486', trend: 8.2, tone: 'primary', icon: markIcon(User) },
  { key: 'orders', label: t('adminClassicHome.statOrders'), value: '328', unit: t('adminClassicHome.unitOrder'), trend: 12.5, tone: 'success', icon: markIcon(ShoppingCart) },
  { key: 'revenue', label: t('adminClassicHome.statRevenue'), value: '¥18,260', trend: -2.3, tone: 'warning', icon: markIcon(Money) },
  { key: 'conversations', label: t('adminClassicHome.statConversations'), value: '9,142', unit: t('adminClassicHome.unitTimes'), trend: 23.6, tone: 'info', icon: markIcon(ChatLineRound) },
  { key: 'dau', label: t('adminClassicHome.statDau'), value: '3,521', trend: 5.1, tone: 'success', icon: markIcon(TrendCharts) },
  { key: 'tickets', label: t('adminClassicHome.statTickets'), value: '7', unit: t('adminClassicHome.unitPiece'), trend: -15.0, tone: 'danger', icon: markIcon(Bell) },
])

const quickActions = ref<QuickAction[]>([
  { key: 'users', label: t('adminClassicHome.actionUsers'), icon: markIcon(User), path: '/admin/user-management', tone: 'primary' },
  { key: 'orders', label: t('adminClassicHome.actionOrders'), icon: markIcon(ShoppingCart), path: '/admin/refund-audit', tone: 'success', badge: t('adminClassicHome.badgeNew') },
  { key: 'agents', label: t('adminClassicHome.actionAgents'), icon: markIcon(ChatLineRound), path: '/admin/agent-management', tone: 'info' },
  { key: 'data', label: t('adminClassicHome.actionData'), icon: markIcon(DataAnalysis), path: '/admin/monitoring-dashboard', tone: 'warning' },
  { key: 'promotion', label: t('adminClassicHome.actionPromotion'), icon: markIcon(Promotion), path: '/admin/activity-management', tone: 'danger' },
  { key: 'docs', label: t('adminClassicHome.actionDocs'), icon: markIcon(Document), path: '/admin/course-management', tone: 'neutral' },
  { key: 'tools', label: t('adminClassicHome.actionTools'), icon: markIcon(Tools), path: '/admin/webhook-management', tone: 'neutral' },
  { key: 'settings', label: t('adminClassicHome.actionSettings'), icon: markIcon(Setting), path: '/admin/home', tone: 'neutral' },
])

const systemStatus = ref<StatusItem[]>([
  { key: 'api', name: t('adminClassicHome.statusApi'), value: t('adminClassicHome.statusNormal'), detail: t('adminClassicHome.statusApiDetail'), updated: t('adminClassicHome.justNow'), tone: 'success' },
  { key: 'db', name: t('adminClassicHome.statusDb'), value: t('adminClassicHome.statusNormal'), detail: t('adminClassicHome.statusDbDetail'), updated: t('adminClassicHome.justNow'), tone: 'success' },
  { key: 'cache', name: t('adminClassicHome.statusCache'), value: t('adminClassicHome.statusNormal'), detail: t('adminClassicHome.statusCacheDetail'), updated: t('adminClassicHome.minutesAgo', { n: 1 }), tone: 'success' },
  { key: 'queue', name: t('adminClassicHome.statusQueue'), value: t('adminClassicHome.statusBusy'), detail: t('adminClassicHome.statusQueueDetail'), updated: t('adminClassicHome.minutesAgo', { n: 2 }), tone: 'warning' },
  { key: 'storage', name: t('adminClassicHome.statusStorage'), value: t('adminClassicHome.statusNormal'), detail: t('adminClassicHome.statusStorageDetail'), updated: t('adminClassicHome.minutesAgo', { n: 5 }), tone: 'success' },
  { key: 'search', name: t('adminClassicHome.statusSearch'), value: t('adminClassicHome.statusDegraded'), detail: t('adminClassicHome.statusSearchDetail'), updated: t('adminClassicHome.minutesAgo', { n: 8 }), tone: 'danger' },
])

const activities = ref<ActivityItem[]>([
  { id: 1, type: 'user', title: t('adminClassicHome.actUserRegister'), description: t('adminClassicHome.actUserRegisterDesc'), time: t('adminClassicHome.minutesAgo', { n: 2 }), tone: 'primary', icon: markIcon(User) },
  { id: 2, type: 'order', title: t('adminClassicHome.actOrderCompleted'), description: t('adminClassicHome.actOrderCompletedDesc'), time: t('adminClassicHome.minutesAgo', { n: 5 }), tone: 'success', icon: markIcon(ShoppingCart) },
  { id: 3, type: 'system', title: t('adminClassicHome.actCacheRefresh'), description: t('adminClassicHome.actCacheRefreshDesc'), time: t('adminClassicHome.minutesAgo', { n: 12 }), tone: 'info', icon: markIcon(Tools) },
  { id: 4, type: 'order', title: t('adminClassicHome.actOrderRefund'), description: t('adminClassicHome.actOrderRefundDesc'), time: t('adminClassicHome.minutesAgo', { n: 25 }), tone: 'warning', icon: markIcon(Money) },
  { id: 5, type: 'user', title: t('adminClassicHome.actUserLogin'), description: t('adminClassicHome.actUserLoginDesc'), time: t('adminClassicHome.minutesAgo', { n: 32 }), tone: 'primary', icon: markIcon(User) },
  { id: 6, type: 'system', title: t('adminClassicHome.actScheduledTask'), description: t('adminClassicHome.actScheduledTaskDesc'), time: t('adminClassicHome.hoursAgo', { n: 1 }), tone: 'info', icon: markIcon(DataAnalysis) },
  { id: 7, type: 'user', title: t('adminClassicHome.actViolation'), description: t('adminClassicHome.actViolationDesc'), time: t('adminClassicHome.hoursAgo', { n: 2 }), tone: 'danger', icon: markIcon(Bell) },
])

const filteredActivities = computed(() => {
  if (activityFilter.value === 'all') return activities.value
  return activities.value.filter(a => a.type === activityFilter.value)
})

const overallStatus = computed(() => {
  const danger = systemStatus.value.filter(s => s.tone === 'danger').length
  const warning = systemStatus.value.filter(s => s.tone === 'warning').length
  if (danger > 0) return { text: t('adminClassicHome.abnormalCount', { n: danger }), tone: 'danger' as const }
  if (warning > 0) return { text: t('adminClassicHome.attentionCount', { n: warning }), tone: 'warning' as const }
  return { text: t('adminClassicHome.allNormal'), tone: 'success' as const }
})

const goTo = (action: QuickAction) => {
  router.push(action.path).catch(() => {
    // 路由不存在时给出提示,避免静默失败
    ElMessage.info(t('adminClassicHome.moduleComingSoon', { name: action.label }))
  })
}

const refreshAll = () => {
  // 简单模拟:更新趋势 + 时间戳
  stats.value = stats.value.map(s => ({
    ...s,
    trend: Number((s.trend + (Math.random() - 0.5) * 2).toFixed(1)),
  }))
  ElMessage.success(t('adminClassicHome.dataRefreshed'))
}

onMounted(() => {
  // 占位:实际应调用后端 API
  // 预留 fetchStats / fetchActivities
})
</script>

<style scoped lang="scss">
.admin-home {
  width: 100%;
  max-width: 100%;
  padding: 20px;
  margin: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-x: hidden;
}

/* ═══ 欢迎条 ═══ */
.welcome-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px;
  background-color: var(--color-white);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  transition: border-color 0.2s ease;

  &:hover {
    border-color: var(--color-gray-d0);
  }
}

.welcome-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-gray-222);
  line-height: 1.4;
  margin: 0;
}

.welcome-subtitle {
  font-size: 13px;
  color: var(--color-gray-666);
  margin: 4px 0 0;
  line-height: 1.5;
}

.welcome-meta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.version-pill,
.env-pill {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  border-radius: var(--global-border-radius);
  background-color: var(--color-bg-page);
  border: var(--unified-border);
  color: var(--color-gray-666);
}

.env-production {
  background-color: var(--el-color-success-light-9);
  border-color: var(--el-color-success-light-7);
  color: var(--el-color-success);
}

.env-staging {
  background-color: var(--el-color-warning-light-9);
  border-color: var(--el-color-warning-light-7);
  color: var(--el-color-warning);
}

.env-development {
  background-color: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary-light-7);
  color: var(--color-blue-1890ff);
}

/* ═══ 数据卡片网格 ═══ */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.stat-card {
  display: flex;
  gap: 14px;
  padding: 18px 20px;
  background-color: var(--color-white);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  transition:
    border-color 0.2s ease,
    transform 0.2s ease,
    background-color 0.2s ease;

  &:hover {
    border-color: var(--color-gray-d0);
    transform: translateY(-1px);
  }
}

.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: var(--global-border-radius);
  background-color: var(--color-bg-page);
  color: var(--el-color-primary);
  font-size: 22px;
  flex-shrink: 0;
}

.stat-card-success .stat-icon { color: var(--el-color-success); background-color: var(--el-color-success-light-9); }
.stat-card-warning .stat-icon { color: var(--el-color-warning); background-color: var(--el-color-warning-light-9); }
.stat-card-danger .stat-icon { color: var(--el-color-danger); background-color: var(--el-color-danger-light-9); }
.stat-card-info .stat-icon { color: var(--color-blue-1890ff); background-color: var(--el-color-primary-light-9); }

.stat-body {
  flex: 1;
  min-width: 0;
}

.stat-label {
  font-size: 13px;
  color: var(--color-gray-666);
  line-height: 1.4;
}

.stat-value {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-top: 4px;
}

.stat-number {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-gray-222);
  line-height: 1.2;
  letter-spacing: 0.5px;
  font-variant-numeric: tabular-nums;
}

.stat-unit {
  font-size: 12px;
  color: var(--color-gray-999);
}

.stat-trend {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-top: 6px;
  font-size: 12px;
  font-weight: 500;

  &.up { color: var(--el-color-success); }
  &.down { color: var(--el-color-danger); }

  .trend-icon {
    font-size: 12px;
  }

  .trend-period {
    color: var(--color-gray-999);
    margin-left: 4px;
    font-weight: 400;
  }
}

/* ═══ 主体双栏 ═══ */
.main-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

@media (width <= 992px) {
  .main-grid {
    grid-template-columns: 1fr;
  }
}

.panel {
  background-color: var(--color-white);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: var(--unified-border-bottom);
  background-color: var(--color-white);
  flex-shrink: 0;
}

.panel-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-gray-222);
  margin: 0;
  line-height: 1.2;
}

/* ═══ 快捷入口 ═══ */
.quick-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background-color: var(--color-gray-f2f2f2);
  padding: 0;
}

@media (width <= 768px) {
  .quick-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (width <= 480px) {
  .quick-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.quick-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 22px 12px;
  background-color: var(--color-white);
  border: none;
  cursor: pointer;
  transition: background-color 0.2s ease;
  text-align: center;

  &:hover {
    background-color: var(--color-bg-page);

    .quick-icon {
      transform: scale(1.08);
    }
  }

  &:focus-visible {
    outline: 2px solid var(--el-color-primary);
    outline-offset: -2px;
  }
}

.quick-icon {
  font-size: 24px;
  color: var(--el-color-primary);
  transition: transform 0.2s ease;
}

.quick-success .quick-icon { color: var(--el-color-success); }
.quick-warning .quick-icon { color: var(--el-color-warning); }
.quick-danger .quick-icon { color: var(--el-color-danger); }
.quick-info .quick-icon { color: var(--color-blue-1890ff); }
.quick-neutral .quick-icon { color: var(--color-gray-666); }

.quick-label {
  font-size: 13px;
  color: var(--color-gray-333);
  font-weight: 500;
}

.quick-badge {
  position: absolute;
  top: 8px;
  right: 12px;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: var(--global-border-radius);
  background-color: var(--el-color-danger);
  color: var(--el-bg-color);
  line-height: 1.4;
}

/* ═══ 系统状态 ═══ */
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  border-radius: var(--global-border-radius);
  background-color: var(--color-bg-page);
  color: var(--color-gray-666);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}

.status-pill.tone-success,
.status-dot.tone-success { background-color: var(--el-color-success); color: var(--el-bg-color); }

.status-pill.tone-warning,
.status-dot.tone-warning { background-color: var(--el-color-warning); color: var(--el-bg-color); }

.status-pill.tone-danger,
.status-dot.tone-danger { background-color: var(--el-color-danger); color: var(--el-bg-color); }

.status-pill.tone-success { background-color: var(--el-color-success-light-9); color: var(--el-color-success); }
.status-pill.tone-warning { background-color: var(--el-color-warning-light-9); color: var(--el-color-warning); }
.status-pill.tone-danger { background-color: var(--el-color-danger-light-9); color: var(--el-color-danger); }

.status-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.status-item {
  padding: 12px 20px;
  border-bottom: var(--unified-border-bottom);

  &:last-child {
    border-bottom: none;
  }
}

.status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.status-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-gray-222);
}

.status-value {
  font-size: 13px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: var(--global-border-radius);
  background-color: var(--color-bg-page);

  &.tone-success { color: var(--el-color-success); background-color: var(--el-color-success-light-9); }
  &.tone-warning { color: var(--el-color-warning); background-color: var(--el-color-warning-light-9); }
  &.tone-danger { color: var(--el-color-danger); background-color: var(--el-color-danger-light-9); }
}

.status-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--color-gray-999);
}

/* ═══ 活动列表 ═══ */
.activity-panel .panel-header {
  flex-wrap: wrap;
  gap: 8px;
}

.activity-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  border-bottom: var(--unified-border-bottom);
  transition: background-color 0.15s ease;

  &:hover {
    background-color: var(--color-bg-page);
  }

  &:last-child {
    border-bottom: none;
  }
}

.activity-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  font-size: 16px;
  flex-shrink: 0;
  color: var(--el-bg-color);
}

.avatar-primary { background-color: var(--el-color-primary); }
.avatar-success { background-color: var(--el-color-success); }
.avatar-warning { background-color: var(--el-color-warning); }
.avatar-danger { background-color: var(--el-color-danger); }
.avatar-info { background-color: var(--color-blue-1890ff); }

.activity-body {
  flex: 1;
  min-width: 0;
}

.activity-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-gray-222);
  line-height: 1.4;
  margin-bottom: 2px;
}

.activity-desc {
  font-size: 12px;
  color: var(--color-gray-666);
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.activity-time {
  font-size: 12px;
  color: var(--color-gray-999);
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.activity-empty {
  padding: 40px 20px;
  text-align: center;
  font-size: 13px;
  color: var(--color-gray-999);
}

/* ═══ 暗色模式适配 ═══ */
:global(.theme-dark) .welcome-bar,
:global(.theme-dark) .stat-card,
:global(.theme-dark) .panel,
:global(.theme-dark) .quick-item {
  background-color: var(--color-dark-bg-1);
  border-color: var(--color-white-10);
  color: var(--color-white-90);
}

:global(.theme-dark) .panel-header,
:global(.theme-dark) .welcome-text,
:global(.theme-dark) .stat-body {
  background-color: transparent;
}

:global(.theme-dark) .stat-number,
:global(.theme-dark) .welcome-title,
:global(.theme-dark) .panel-title,
:global(.theme-dark) .status-name,
:global(.theme-dark) .activity-title {
  color: var(--color-white);
}

:global(.theme-dark) .stat-label,
:global(.theme-dark) .welcome-subtitle,
:global(.theme-dark) .activity-desc,
:global(.theme-dark) .activity-time,
:global(.theme-dark) .status-meta,
:global(.theme-dark) .quick-label {
  color: var(--color-white-60);
}

:global(.theme-dark) .version-pill,
:global(.theme-dark) .env-pill {
  background-color: var(--color-white-5);
  border-color: var(--color-white-15);
  color: var(--color-white-80);
}

:global(.theme-dark) .quick-item:hover {
  background-color: var(--color-white-5);
}

:global(.theme-dark) .status-item,
:global(.theme-dark) .activity-item {
  border-bottom-color: var(--color-white-8);
}

:global(.theme-dark) .activity-item:hover {
  background-color: var(--color-white-5);
}

:global(.theme-dark) .quick-grid {
  background-color: var(--color-white-8);
}

/* ═══ 响应式微调 ═══ */
@media (width <= 1200px) {
  .stats-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (width <= 768px) {
  .admin-home {
    padding: 12px;
  }

  .welcome-bar {
    flex-direction: column;
    align-items: flex-start;
    padding: 16px 20px;
  }

  .welcome-title {
    font-size: 18px;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .stat-card {
    padding: 14px 16px;
  }

  .stat-number {
    font-size: 20px;
  }
}

@media (width <= 480px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
