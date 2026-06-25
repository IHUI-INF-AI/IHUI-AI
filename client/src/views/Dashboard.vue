<script setup lang="ts">
/**
 * Dashboard.vue - 数据仪表盘 (Premium Tech Edition)
 * 
 * @description 高科技工业风格数据可视化仪表盘
 * @author AI Design System
 */

import { ref, computed, onMounted, nextTick } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { logger } from '../utils/logger'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { User, Cpu, FileText, DollarSign, Eye, Settings, Activity, TrendingUp, BarChart3, ArrowUpRight, ArrowRight, Zap, Clock } from '@/lib/lucide-fallback'
import { getAgentExamineStats, type AgentExamineStats } from '@/api/agent/agent/agent-examine'
import { getAgentCategoryStats } from '@/api/agent/agent/agent-category'
import { getSystemStatistics } from '@/api/statistics/statistics'
import { useApiError } from '@/composables/useApiError'
import { usePageState } from '@/composables/usePageState'
import { useOperationFeedback } from '@/composables/useOperationFeedback'

const { t } = useI18n()
const router = useRouter()
const { loading: apiLoading, execute } = useApiError()
const { showError: showErrorMsg } = useOperationFeedback()
const cleanup = useCleanup()

// ============ 高级动效系统 ============
let scrollObserver: IntersectionObserver | null = null
const observedElements = ref<Set<Element>>(new Set())

const initScrollAnimations = () => {
  scrollObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement
          const delay = el.dataset.delay || '0'
          setTimeout(() => {
            el.classList.add('scroll-animated', 'animate-fadeInUp')
          }, parseInt(delay))
          observedElements.value.add(el)
        }
      })
    },
    { threshold: 0.1 }
  )
  nextTick(() => {
    document.querySelectorAll('.scroll-reveal').forEach((el) => {
      if (!observedElements.value.has(el)) {
        scrollObserver?.observe(el)
      }
    })
  })
}

// 数字动画
const animatedValues = ref({
  totalUsers: 0,
  totalAgents: 0,
  totalExamines: 0,
  totalRevenue: 0,
  pending: 0,
  approved: 0,
  rejected: 0
})

const animateRafIds = new Set<number>()

const animateNumber = (key: keyof typeof animatedValues.value, target: number, duration: number = 1500) => {
  const start = performance.now()
  const startVal = animatedValues.value[key]
  
  const update = (now: number) => {
    const elapsed = now - start
    const progress = Math.min(elapsed / duration, 1)
    const eased = 1 - Math.pow(2, -10 * progress)
    animatedValues.value[key] = Math.floor(startVal + (target - startVal) * eased)
    if (progress < 1) requestAnimationFrame(update)
  }
  requestAnimationFrame(update)
}

// 涟漪效果
const createRipple = (e: MouseEvent, el: HTMLElement) => {
  const rect = el.getBoundingClientRect()
  const ripple = document.createElement('span')
  const size = Math.max(rect.width, rect.height)
  ripple.style.width = ripple.style.height = `${size}px`
  ripple.style.left = `${e.clientX - rect.left - size / 2}px`
  ripple.style.top = `${e.clientY - rect.top - size / 2}px`
  ripple.classList.add('ripple-effect')
  el.appendChild(ripple)
  setTimeout(() => ripple.remove(), 600)
}

// 统计数据
interface SystemStats {
  totalUsers: number
  totalAgents: number
  totalExamines: number
  totalRevenue: number
}

const statsPageState = usePageState<SystemStats>({ autoShowError: false })
const _stats = computed<SystemStats>(() => statsPageState.data.value || {
  totalUsers: 0, totalAgents: 0, totalExamines: 0, totalRevenue: 0
})

const examineStats = ref<AgentExamineStats | null>(null)
const categoryStats = ref<{
  free_count?: number
  limit_free_count?: number
  paid_count?: number
  total_agents?: number
} | null>(null)
const loading = computed(() => apiLoading.value || statsPageState.loading.value)

const loadStats = async (): Promise<void> => {
  try {
    const [systemResult, examineResult, categoryResult] = await Promise.all([
      execute(() => getSystemStatistics(), { showMessage: false }),
      execute(() => getAgentExamineStats(), { showMessage: false }),
      execute(() => getAgentCategoryStats(), { showMessage: false }),
    ])

    if (examineResult) {
      examineStats.value = examineResult as AgentExamineStats
      // 动画显示审核统计
      animateNumber('pending', examineResult.pending || 0)
      animateNumber('approved', examineResult.approved || 0)
      animateNumber('rejected', examineResult.rejected || 0)
    }

    if (categoryResult) {
      categoryStats.value = categoryResult as typeof categoryStats.value
    }

    if (systemResult && typeof systemResult === 'object' && 'users' in systemResult) {
      const systemData = systemResult as {
        users?: { totalUsers?: number }
        orders?: { totalRevenue?: number }
        agents?: { totalExamines?: number }
      }

      const statsData: SystemStats = {
        totalUsers: systemData.users?.totalUsers || 0,
        totalRevenue: systemData.orders?.totalRevenue || 0,
        totalAgents: systemData.agents?.totalExamines || categoryStats.value?.total_agents || 0,
        totalExamines: examineStats.value?.total || 0,
      }

      statsPageState.data.value = statsData
      
      // 动画显示主要统计
      animateNumber('totalUsers', statsData.totalUsers)
      animateNumber('totalAgents', statsData.totalAgents)
      animateNumber('totalExamines', statsData.totalExamines)
      animateNumber('totalRevenue', statsData.totalRevenue)
    }
  } catch (error) {
    logger.error('[Dashboard] Failed to load statistics:', error)
    showErrorMsg(t('dashboard.loadStatsFailed'))
  }
}

// 导航
const safeNavigate = (path: string): void => {
  router.push(path).catch((error: any) => {
    if (error && typeof error === 'object' && 'name' in error) return
    logger.error('[Dashboard] Navigation failed:', error)
    showErrorMsg(t('dashboard.navigationFailed'))
  })
}

const quickActions = [
  { icon: Settings, label: t('data.dashboard.模型管理'), path: '/models-management', color: 'primary' },
  { icon: FileText, label: t('data.dashboard.费用配置1'), path: '/agent-category-management', color: 'success' },
  { icon: Eye, label: t('data.dashboard.审核管理2'), path: '/agent-examine-management', color: 'warning' },
  { icon: User, label: t('data.dashboard.用户中心3'), path: '/user', color: 'info' },
  { icon: DollarSign, label: t('data.dashboard.结算管理4'), path: '/settlement-management', color: 'danger' },
]

onMounted(() => {
  initScrollAnimations()
  loadStats()
})

cleanup.add(() => {
  animateRafIds.forEach(id => cancelAnimationFrame(id))
  animateRafIds.clear()
  scrollObserver?.disconnect()
})
</script>

<template>
  <div
    class="dashboard-root"
    id="dashboard"
    role="main"
    :aria-label="t('dashboard.title')"
    v-loading="loading"
  >
    <!-- 深度背景系统 -->
    <div class="bg-system" aria-hidden="true">
      <div class="bg-glow glow-1"></div>
      <div class="bg-glow glow-2"></div>
    </div>

    <div class="dashboard-container">
      <!-- 页面头部 -->
      <header class="dashboard-header scroll-reveal">
        <div class="header-content">
          <div class="header-left">
            <div class="header-badge">
              <Activity class="badge-icon" :size="14" />
              <span class="badge-text font-edix">{{ t('dashboard.badge') }}</span>
            </div>
            <h1 class="header-title">{{ t('dashboard.title') }}</h1>
            <p class="header-desc">{{ t('dashboard.subtitle') }}</p>
          </div>
          <div class="header-actions">
            <button
              class="btn-refresh"
              type="button"
              :aria-label="t('dashboard.refresh')"
              :aria-busy="loading"
              @click="loadStats"
            >
              <Zap :size="16" />
              <span>{{ t('dashboard.refresh') }}</span>
            </button>
          </div>
        </div>
      </header>

      <!-- 主要统计卡片 -->
      <section class="stats-section" id="dashboard-stats" aria-labelledby="dashboard-stats-heading">
        <h2 id="dashboard-stats-heading" class="sr-only">{{ t('dashboard.title') }} {{ t('dashboard.totalUsers') }}</h2>
        <div class="stats-grid">
          <div 
            class="stat-card glass-card scroll-reveal"
            data-delay="0"
          >
            <div class="stat-icon-wrap">
              <User class="stat-icon" :size="28" />
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ animatedValues.totalUsers.toLocaleString() }}</div>
              <div class="stat-label">{{ t('dashboard.totalUsers') }}</div>
            </div>
            <div class="stat-trend positive">
              <ArrowUpRight :size="14" />
              <span>+12%</span>
            </div>
            <div class="stat-glow"></div>
          </div>

          <div 
            class="stat-card glass-card scroll-reveal"
            data-delay="100"
          >
            <div class="stat-icon-wrap">
              <Cpu class="stat-icon" :size="28" />
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ animatedValues.totalAgents.toLocaleString() }}</div>
              <div class="stat-label">{{ t('dashboard.totalAgents') }}</div>
            </div>
            <div class="stat-trend positive">
              <ArrowUpRight :size="14" />
              <span>+8%</span>
            </div>
            <div class="stat-glow"></div>
          </div>

          <div 
            class="stat-card glass-card scroll-reveal"
            data-delay="200"
          >
            <div class="stat-icon-wrap">
              <FileText class="stat-icon" :size="28" />
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ animatedValues.totalExamines.toLocaleString() }}</div>
              <div class="stat-label">{{ t('dashboard.totalExamines') }}</div>
            </div>
            <div class="stat-trend neutral">
              <TrendingUp :size="14" />
              <span>+3%</span>
            </div>
            <div class="stat-glow"></div>
          </div>

          <div 
            class="stat-card glass-card scroll-reveal"
            data-delay="300"
          >
            <div class="stat-icon-wrap revenue">
              <DollarSign class="stat-icon" :size="28" />
            </div>
            <div class="stat-content">
              <div class="stat-value">¥{{ animatedValues.totalRevenue.toLocaleString() }}</div>
              <div class="stat-label">{{ t('dashboard.totalRevenue') }}</div>
            </div>
            <div class="stat-trend positive">
              <ArrowUpRight :size="14" />
              <span>+25%</span>
            </div>
            <div class="stat-glow"></div>
          </div>
        </div>
      </section>

      <!-- 审核与分类统计 -->
      <section class="detail-section">
        <div class="detail-grid">
          <!-- 审核统计 -->
          <div class="detail-card glass-card scroll-reveal" data-delay="100">
            <div class="card-header">
              <div class="card-title">
                <BarChart3 :size="20" />
                <span>{{ t('dashboard.examineStats') }}</span>
              </div>
              <div class="card-tag">{{ t('dashboard.realTime') }}</div>
            </div>
            <div class="examine-stats-grid" v-if="examineStats">
              <div class="examine-stat-item">
                <div class="examine-value total">{{ examineStats.total || 0 }}</div>
                <div class="examine-label">{{ t('dashboard.totalExaminesCount') }}</div>
              </div>
              <div class="examine-stat-item">
                <div class="examine-value pending">{{ animatedValues.pending }}</div>
                <div class="examine-label">{{ t('dashboard.pendingExamine') }}</div>
                <div class="examine-bar">
                  <div class="bar-fill pending" :style="{ width: `${(animatedValues.pending / (examineStats.total || 1)) * 100}%` }"></div>
                </div>
              </div>
              <div class="examine-stat-item">
                <div class="examine-value approved">{{ animatedValues.approved }}</div>
                <div class="examine-label">{{ t('dashboard.approvedExamine') }}</div>
                <div class="examine-bar">
                  <div class="bar-fill approved" :style="{ width: `${(animatedValues.approved / (examineStats.total || 1)) * 100}%` }"></div>
                </div>
              </div>
              <div class="examine-stat-item">
                <div class="examine-value rejected">{{ animatedValues.rejected }}</div>
                <div class="examine-label">{{ t('dashboard.rejectedExamine') }}</div>
                <div class="examine-bar">
                  <div class="bar-fill rejected" :style="{ width: `${(animatedValues.rejected / (examineStats.total || 1)) * 100}%` }"></div>
                </div>
              </div>
            </div>
            <div v-else class="empty-state">
              <Clock :size="32" />
              <span>{{ t('dashboard.noData') }}</span>
            </div>
          </div>

          <!-- 分类统计 -->
          <div class="detail-card glass-card scroll-reveal" data-delay="200">
            <div class="card-header">
              <div class="card-title">
                <BarChart3 :size="20" />
                <span>{{ t('dashboard.categoryStats') }}</span>
              </div>
              <div class="card-tag">{{ t('dashboard.analytics') }}</div>
            </div>
            <div class="category-stats-grid" v-if="categoryStats">
              <div class="category-item">
                <div class="category-icon free">
                  <Zap :size="20" />
                </div>
                <div class="category-info">
                  <div class="category-value">{{ categoryStats.free_count || 0 }}</div>
                  <div class="category-label">{{ t('dashboard.freeCount') }}</div>
                </div>
              </div>
              <div class="category-item">
                <div class="category-icon limit">
                  <Clock :size="20" />
                </div>
                <div class="category-info">
                  <div class="category-value">{{ categoryStats.limit_free_count || 0 }}</div>
                  <div class="category-label">{{ t('dashboard.limitFreeCount') }}</div>
                </div>
              </div>
              <div class="category-item">
                <div class="category-icon paid">
                  <DollarSign :size="20" />
                </div>
                <div class="category-info">
                  <div class="category-value">{{ categoryStats.paid_count || 0 }}</div>
                  <div class="category-label">{{ t('dashboard.paidCount') }}</div>
                </div>
              </div>
            </div>
            <div v-else class="empty-state">
              <Clock :size="32" />
              <span>{{ t('dashboard.noData') }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 快速操作 -->
      <section class="actions-section scroll-reveal" id="dashboard-actions" data-delay="300" aria-labelledby="dashboard-actions-heading">
        <div class="section-header">
          <h2 id="dashboard-actions-heading">{{ t('dashboard.quickActions') }}</h2>
          <span class="section-tag">{{ t('dashboard.shortcuts') }}</span>
        </div>
        <div class="actions-grid">
          <button
            v-for="(action, index) in quickActions"
            :key="action.path"
            type="button"
            class="action-card glass-card"
            :aria-label="action.label"
            @click="(e) => { createRipple(e, $event.currentTarget as HTMLElement); safeNavigate(action.path) }"
          >
            <component :is="action.icon" class="action-icon" :size="24" />
            <span class="action-label">{{ action.label }}</span>
            <ArrowRight class="action-arrow" :size="16" />
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<style lang="scss" scoped>
// 设计令牌
$bg-page: var(--el-bg-color-page);
$bg-card: var(--el-bg-color);
$text-main: var(--el-text-color-primary);
$text-sec: var(--el-text-color-secondary);
$border-light: var(--el-border-color-lighter);
$brand-primary: var(--el-text-color-primary);
$brand-secondary: var(--el-text-color-secondary);
$accent-green: var(--el-color-success);
$accent-yellow: var(--el-color-warning);
$accent-red: var(--el-color-danger);

.dashboard-root {
  min-height: 100vh;
  background: $bg-page;
  position: relative;
  overflow-x: hidden;
}

// 背景系统
.bg-system {
  position: fixed;
  inset: 0;
  z-index: var(--z-0);
  pointer-events: none;
  
  .bg-glow {
    position: absolute;
    width: 500px;
    height: 500px;
    border-radius: var(--global-border-radius);
    filter: blur(100px);
    opacity: 0.1;
    
    &.glow-1 { top: -150px; right: -150px; background: $brand-secondary; }
    &.glow-2 { bottom: -150px; left: -150px; background: $brand-secondary; }
  }
}

.dashboard-container {
  position: relative;
  z-index: var(--z-base);
  max-width: 1400px;
  margin: 0 auto;
  padding: 32px;
}

// 玻璃卡片
.glass-card {
  background: var(--color-white-70);
  backdrop-filter: blur(20px);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  
  &:hover {
    border-color: color-mix(in srgb, var(--el-text-color-primary) 15%, transparent);
  }
}

// 页面头部
.dashboard-header {
  margin-bottom: 40px;
  
  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 24px;
    flex-wrap: wrap;
  }
  
  .header-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.1em;
    color: $text-sec;
    margin-bottom: 16px;
    
    .badge-icon { color: $accent-green; }
  }
  
  .header-title {
    font-size: 32px;
    font-weight: 900;
    color: $text-main;
    letter-spacing: -0.03em;
    margin: 0 0 8px;
  }
  
  .header-desc {
    font-size: 15px;
    color: $text-sec;
    margin: 0;
  }
  
  .btn-refresh {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    background: $brand-primary;
    color: var(--el-bg-color-page);
    border: none;
    border-radius: var(--global-border-radius);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.3s;
    
    &:hover {
      transform: translateY(-2px);
    }
  }
}

// 统计卡片
.stats-section {
  margin-bottom: 32px;
  
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
    
    @media (width <= 1024px) { grid-template-columns: repeat(2, 1fr); }

    @media (width <= 640px) { grid-template-columns: 1fr; }
  }
}

.stat-card {
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  cursor: default;
  
  .stat-icon-wrap {
    width: 52px;
    height: 52px;
    background: color-mix(in srgb, var(--el-text-color-primary) 8%, transparent);
    border-radius: var(--global-border-radius);
    display: flex;
    align-items: center;
    justify-content: center;
    
    .stat-icon { color: $brand-primary; }
    
    &.revenue {
      background: rgba($accent-green, 0.1);
      .stat-icon { color: $accent-green; }
    }
  }
  
  .stat-content {
    flex: 1;
    
    .stat-value {
      font-size: 32px;
      font-weight: 900;
      color: $text-main;
      letter-spacing: -0.02em;
      font-variant-numeric: tabular-nums;
    }
    
    .stat-label {
      font-size: 13px;
      color: $text-sec;
      margin-top: 4px;
      font-weight: 600;
    }
  }
  
  .stat-trend {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    font-weight: 700;
    padding: 4px 10px;
    border-radius: var(--global-border-radius);
    align-self: flex-start;
    
    &.positive {
      background: rgba($accent-green, 0.1);
      color: $accent-green;
    }
    
    &.neutral {
      background: rgba($accent-yellow, 0.1);
      color: $accent-yellow;
    }
  }
  
  .stat-glow {
    position: absolute;
    inset: 0;
    background: color-mix(in srgb, var(--el-text-color-primary) 2%, transparent);
    pointer-events: none;
  }
}

// 详情区域
.detail-section {
  margin-bottom: 32px;
  
  .detail-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 24px;
    
    @media (width <= 768px) { grid-template-columns: 1fr; }
  }
}

.detail-card {
  padding: 28px;
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    
    .card-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 16px;
      font-weight: 800;
      color: $text-main;
    }
    
    .card-tag {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.1em;
      color: $accent-green;
      padding: 4px 10px;
      background: rgba($accent-green, 0.1);
      border-radius: var(--global-border-radius);
    }
  }
  
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
    color: $text-sec;
    gap: 12px;
  }
}

// 审核统计
.examine-stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.examine-stat-item {
  .examine-value {
    font-size: 28px;
    font-weight: 900;
    margin-bottom: 4px;
    font-variant-numeric: tabular-nums;
    
    &.total { color: $text-main; }
    &.pending { color: $accent-yellow; }
    &.approved { color: $accent-green; }
    &.rejected { color: $accent-red; }
  }
  
  .examine-label {
    font-size: 12px;
    color: $text-sec;
    margin-bottom: 8px;
  }
  
  .examine-bar {
    height: 4px;
    background: color-mix(in srgb, var(--el-text-color-primary) 8%, transparent);
    border-radius: var(--global-border-radius);
    overflow: hidden;
    
    .bar-fill {
      height: 100%;
      border-radius: var(--global-border-radius);
      transition: width 1s ease-out;
      
      &.pending { background: $accent-yellow; }
      &.approved { background: $accent-green; }
      &.rejected { background: $accent-red; }
    }
  }
}

// 分类统计
.category-stats-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.category-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: color-mix(in srgb, var(--el-text-color-primary) 2%, transparent);
  border-radius: var(--global-border-radius);
  transition: all 0.3s;
  
  &:hover {
    background: color-mix(in srgb, var(--el-text-color-primary) 4%, transparent);
  }
  
  .category-icon {
    width: 44px;
    height: 44px;
    border-radius: var(--global-border-radius);
    display: flex;
    align-items: center;
    justify-content: center;
    
    &.free { background: rgba($accent-green, 0.1); color: $accent-green; }
    &.limit { background: rgba($accent-yellow, 0.1); color: $accent-yellow; }
    &.paid { background: color-mix(in srgb, var(--el-text-color-primary) 8%, transparent); color: var(--el-text-color-primary); }
  }
  
  .category-info {
    flex: 1;
    
    .category-value {
      font-size: 22px;
      font-weight: 800;
      color: $text-main;
    }
    
    .category-label {
      font-size: 12px;
      color: $text-sec;
    }
  }
}

// 快速操作
.actions-section {
  .section-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 24px;
    
    h2 {
      font-size: 20px;
      font-weight: 800;
      color: $text-main;
      margin: 0;
    }
    
    .section-tag {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.1em;
      color: $text-sec;
      padding: 4px 10px;
      border: var(--unified-border);
      border-radius: var(--global-border-radius);
    }
  }
  
  .actions-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 16px;
    
    @media (width <= 1024px) { grid-template-columns: repeat(3, 1fr); }

    @media (width <= 640px) { grid-template-columns: repeat(2, 1fr); }
  }
}

.action-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 28px 20px;
  cursor: pointer;
  border: none;
  background: var(--color-white-70);
  
  .action-icon { color: $brand-primary; }
  
  .action-label {
    font-size: 14px;
    font-weight: 700;
    color: $text-main;
  }
  
  .action-arrow {
    color: $text-sec;
    opacity: 0;
    transform: translateX(-8px);
    transition: all 0.3s;
  }
  
  &:hover .action-arrow {
    opacity: 1;
    transform: translateX(0);
  }
}

// 滚动动画
.scroll-reveal {
  opacity: 0;
  transform: translateY(20px);
  transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  
  &.scroll-animated {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes rippleExpand {
  to { transform: scale(4); opacity: 0; }
}

// 暗色模式
:global(html.dark) {
  .dashboard-root { background: var(--el-bg-color-page); }
  
  .glass-card {
    background: var(--color-dark-141414-80);
    border-color: var(--color-white-8);
  }
  
  .category-item { background: var(--color-white-3); }
  
  .stat-icon-wrap { background: var(--color-white-8); }
}
</style>
