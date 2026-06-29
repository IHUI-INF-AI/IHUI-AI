<template>
  <div class="statistics-container page-container" v-loading="loadingStats">
    <el-card shadow="hover" class="header-card radius-auto">
      <h2 class="page-title">{{ t('user.statistics.title') }}</h2>
      <p class="page-description">{{ t('user.statistics.description') }}</p>
    </el-card>

    <el-card shadow="hover" class="filter-card radius-auto">
      <el-row :gutter="15">
        <el-col :xs="24" :sm="8" :md="6">
          <el-select
            v-model="timeRange"
            :placeholder="t('statistics.selectTimeRange')"
            @change="handleTimeRangeChange"
          >
            <el-option :label="t('statistics.timeRanges.today')" value="today" />
            <el-option :label="t('statistics.timeRanges.week')" value="week" />
            <el-option :label="t('statistics.timeRanges.month')" value="month" />
            <el-option :label="t('statistics.timeRanges.all')" value="all" />
          </el-select>
        </el-col>
        <el-col :xs="24" :sm="8" :md="6">
          <el-date-picker
            v-model="customDateRange"
            type="daterange"
            :range-separator="t('common.rangeSeparator')"
            :start-placeholder="t('statistics.startDate')"
            :end-placeholder="t('statistics.endDate')"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            @change="handleCustomDateChange"
          />
        </el-col>
      </el-row>
    </el-card>

    <el-row :gutter="15" class="stats-cards">
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="stat-card radius-auto">
          <div class="stat-content">
            <div class="stat-icon visit">
              <el-icon><View /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ formatNumber(usageStats.visits || 0) }}</div>
              <div class="stat-label">{{ t('statistics.labels.visits') }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="stat-card radius-auto">
          <div class="stat-content">
            <div class="stat-icon duration">
              <el-icon><Timer /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ usageStats.duration || t('statisticsPage.zeroHour') }}</div>
              <div class="stat-label">{{ t('statistics.labels.duration') }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="stat-card radius-auto">
          <div class="stat-content">
            <div class="stat-icon conversation">
              <el-icon><ChatLineRound /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ formatNumber(usageStats.conversations || 0) }}</div>
              <div class="stat-label">{{ t('statistics.labels.conversations') }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="stat-card radius-auto">
          <div class="stat-content">
            <div class="stat-icon share">
              <el-icon><Share /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ formatNumber(usageStats.shares || 0) }}</div>
              <div class="stat-label">{{ t('statistics.labels.shares') }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="hover" class="detail-card radius-auto">
      <h3 class="detail-title">{{ t('statistics.detailTitle') }}</h3>
      <div class="detail-list">
        <div class="detail-item">
          <span class="detail-label">{{ t('statistics.labels.registerTime') }}</span>
          <span class="detail-value">{{ usageStats.registerTime || '--' }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">{{ t('statistics.labels.loginDays') }}</span>
          <span class="detail-value">{{ usageStats.loginDays || 0 }} {{ t('statistics.days') }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">{{ t('statistics.labels.totalDuration') }}</span>
          <span class="detail-value">{{ usageStats.totalDuration || t('statisticsPage.zeroHour') }}</span>
        </div>
      </div>
    </el-card>

    <el-card shadow="hover" class="tabs-card radius-auto">
      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <el-tab-pane :label="t('statistics.tabs.usage')" name="usage">
          <UsageStatistics :time-range="timeRange" :custom-date-range="customDateRange" />
        </el-tab-pane>
        <el-tab-pane :label="t('statistics.tabs.behavior')" name="behavior">
          <BehaviorStatistics :time-range="timeRange" />
        </el-tab-pane>
        <el-tab-pane :label="t('statistics.tabs.orders')" name="orders">
          <OrderStatistics :time-range="timeRange" />
        </el-tab-pane>
        <el-tab-pane :label="t('statistics.tabs.agents')" name="agents" v-if="isAgentCreator">
          <AgentStatistics :time-range="timeRange" />
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup lang="ts">
 
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { logger } from '@/utils/logger'
import { useApiError } from '@/composables/useApiError'
import { usePageState } from '@/composables/usePageState'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import {
  ChatLineRound,
  Timer,
  Share,
  View,
} from '@/lib/lucide-fallback'
import { useAuthStore } from '@/stores/auth'
import { getUsageStatistics, getAgentStatistics } from '@/api/statistics'
import UsageStatistics from '@/components/statistics/UsageStatistics.vue'
import BehaviorStatistics from '@/components/statistics/BehaviorStatistics.vue'
import OrderStatistics from '@/components/statistics/OrderStatistics.vue'
import AgentStatistics from '@/components/statistics/AgentStatistics.vue'

const { t } = useI18n()
const _authStore = useAuthStore()
const { loading: apiLoading, execute } = useApiError()
const { showError: showErrorMsg } = useOperationFeedback()

interface UsageStats {
  visits: number
  duration: string
  conversations: number
  shares: number
  registerTime: string
  loginDays: number
  totalDuration: string
  chat?: {
    totalSessions: number
    totalMessages: number
    totalTokens: number
  }
  files?: {
    totalFiles: number
    totalSize: number
  }
}

type TimeRange = 'today' | 'week' | 'month' | 'all'
type TabName = 'usage' | 'behavior' | 'orders' | 'agents'

const usageStatsPageState = usePageState<UsageStats>({ autoShowError: false })

const timeRange = ref<TimeRange>('month')
const customDateRange = ref<[string, string] | null>(null)
const activeTab = ref<TabName>('usage')
const loadingStats = computed(() => apiLoading.value || usageStatsPageState.loading.value)

const defaultUsageStats: UsageStats = {
  visits: 0,
  duration: t('statistics.zeroHour'),
  conversations: 0,
  shares: 0,
  registerTime: '--',
  loginDays: 0,
  totalDuration: t('statistics.zeroHour2'),
}

const usageStats = computed<UsageStats>(() => usageStatsPageState.data.value || defaultUsageStats)

const isAgentCreator = ref(false)

const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M'
  } else if (num >= 1000) {
    return (num / 1000).toFixed(2) + 'K'
  }
  return num.toString()
}

const handleTimeRangeChange = (): void => {
  customDateRange.value = null
  loadStatistics()
}

const handleCustomDateChange = (): void => {
  if (customDateRange.value) {
    timeRange.value = 'all'
  }
  loadStatistics()
}

const handleTabChange = (): void => {}

const loadStatistics = async (): Promise<void> => {
  try {
    const params: {
      type: TimeRange
      startDate?: string
      endDate?: string
    } = {
      type: timeRange.value,
    }

    if (customDateRange.value) {
      params.startDate = customDateRange.value[0]
      params.endDate = customDateRange.value[1]
    }

    const [usageResult, agentResult] = await Promise.all([
      execute(() => getUsageStatistics(params), { showMessage: false }),
      execute(() => getAgentStatistics({ type: timeRange.value }), { showMessage: false }).catch(
        () => null
      ),
    ])

    if (
      usageResult &&
      typeof usageResult === 'object' &&
      'chat' in usageResult &&
      'files' in usageResult
    ) {
      const usageData = usageResult as {
        visits?: number
        duration?: string
        conversations?: number
        shares?: number
        registerTime?: string
        loginDays?: number
        totalDuration?: string
        chat?: { totalSessions?: number; totalMessages?: number; totalTokens?: number }
        files?: { totalFiles?: number; totalSize?: number }
      }

      usageStatsPageState.data.value = {
        visits: usageData.visits || 0,
        duration: usageData.duration || '0小时',
        conversations: usageData.conversations || 0,
        shares: usageData.shares || 0,
        registerTime: usageData.registerTime || '--',
        loginDays: usageData.loginDays || 0,
        totalDuration: usageData.totalDuration || '0小时',
        chat: {
          totalSessions: usageData.chat?.totalSessions || 0,
          totalMessages: usageData.chat?.totalMessages || 0,
          totalTokens: usageData.chat?.totalTokens || 0,
        },
        files: {
          totalFiles: usageData.files?.totalFiles || 0,
          totalSize: usageData.files?.totalSize || 0,
        },
      }
    }

    isAgentCreator.value = !!agentResult
  } catch (error) {
    logger.error('[Statistics] Failed to load statistics:', error)
    showErrorMsg(t('statistics.loadFailed'))
  }
}

onMounted(() => {
  loadStatistics()
})
</script>

<style scoped lang="scss">
.statistics-container {
  padding: 20px;
  width: 100%;
  margin: 0 auto;

  .header-card {
    margin-bottom: 20px;

    .page-title {
      margin: 0 0 10px;
      font-size: 24px;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }

    .page-description {
      margin: 0;
      color: var(--el-text-color-secondary);
      font-size: 14px;
    }
  }

  .filter-card {
    margin-bottom: 20px;
  }

  :where(.stats-cards) {
    margin-bottom: 20px;

    .stat-card {
      .stat-content {
        display: flex;
        align-items: center;
        padding: 10px;

        .stat-icon {
          width: 60px;
          height: 60px;
          border-radius: var(--global-border-radius);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          margin-right: 15px;

          &.visit,
          &.duration,
          &.conversation,
          &.share {
            background: var(--el-bg-color);
            color: var(--el-text-color-primary);
          }
        }

        .stat-info {
          flex: 1;

          .stat-value {
            font-size: 28px;
            font-weight: 600;
            color: var(--el-text-color-primary);
            line-height: 1;
            margin-bottom: 8px;
          }

          .stat-label {
            font-size: 14px;
            color: var(--el-text-color-secondary);
          }
        }
      }
    }
  }

  .detail-card {
    margin-bottom: 20px;

    .detail-title {
      margin: 0 0 16px;
      font-size: 18px;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }

    .detail-list {
      display: flex;
      flex-direction: column;
    }

    .detail-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: var(--unified-border-bottom);

      &:last-child {
        border-bottom: none;
      }
    }

    .detail-label {
      font-size: 14px;
      color: var(--el-text-color-secondary);
    }

    .detail-value {
      font-size: 14px;
      color: var(--el-text-color-primary);
      font-weight: 500;
    }
  }

  .tabs-card {
    margin-top: 20px;
  }
}

@media (width <= 768px) {
  .statistics-container {
    padding: 10px;

    :where(.stats-cards) {
      .stat-card {
        .stat-content {
          .stat-icon {
            width: 50px;
            height: 50px;
            font-size: 24px;
          }

          .stat-info {
            .stat-value {
              font-size: 24px;
            }
          }
        }
      }
    }
  }
}
</style>
