<template>
  <div class="token-value-page page-container">
    <!-- 页面头部 -->
    <div class="page-header radius-auto">
      <h1 class="page-title">
        <el-icon class="title-icon"><Coins /></el-icon>
        {{ t('tokenValue.title') }}
      </h1>
      <p class="page-subtitle">{{ t('tokenValue.subtitle') }}</p>
    </div>

    <!-- 复用UserStatistics.vue的Token余额部分 -->
    <div class="balance-section radius-auto">
      <StatsPanel
        :title="t('tokenValue.balanceTitle')"
        :stats="tokenStats"
        :refreshing="loading"
        @refresh="loadTokenData"
      />
    </div>

    <!-- 消耗类型切换 -->
    <div class="type-tabs radius-auto">
      <el-radio-group v-model="orderType" @change="handleTypeChange">
        <el-radio-button value="0">{{ t('tokenValue.typeTabs.agent') }}</el-radio-button>
        <el-radio-button value="1">{{ t('tokenValue.typeTabs.model') }}</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 时间筛选 -->
    <div class="time-filter radius-auto">
      <el-radio-group v-model="timeRange" @change="handleTimeRangeChange">
        <el-radio-button value="w">{{ t('tokenValue.timeRange.week') }}</el-radio-button>
        <el-radio-button value="m">{{ t('tokenValue.timeRange.month') }}</el-radio-button>
        <el-radio-button value="y">{{ t('tokenValue.timeRange.year') }}</el-radio-button>
        <el-radio-button value="a">{{ t('tokenValue.timeRange.all') }}</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 消耗记录列表 -->
    <div class="records-section radius-auto">
      <el-table :data="recordsList" v-loading="loading" style="width: 100%">
        <el-table-column prop="agentName" :label="t('tokenValue.table.name')" min-width="150" />
        <el-table-column prop="create_at" :label="t('tokenValue.table.time')" width="180">
          <template #default="{ row }">
            {{ formatDate(row.create_at) }}
          </template>
        </el-table-column>
        <el-table-column prop="token" :label="t('tokenValue.table.consumption')" width="120">
          <template #default="{ row }">
            <span style="color: var(--el-color-danger); font-weight: bold">-{{ row.token }}</span>
          </template>
        </el-table-column>
      </el-table>

      <el-empty
        v-if="recordsList.length === 0 && !loading"
        :description="t('tokenValue.noRecords')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Coins } from '@/lib/lucide-fallback'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import StatsPanel from '@/components/common/StatsPanel.vue'
import type { StatItem } from '@/components/common/StatsPanel.vue'
import { useUserStatistics } from '@/composables/user/useUserStatistics'
import { getTokenValueRecords } from '@/api/statistics/token-value'
import { useApiError } from '@/composables/useApiError'
import { formatDateTime } from '@/utils/format'

const { t } = useI18n()

// 复用UserStatistics的Token余额
const { tokenBalance, tokenBalanceLoading: _tokenBalanceLoading, loadTokenBalance } = useUserStatistics()

const { loading, execute: executeApi } = useApiError({ showMessage: true })
const orderType = ref<'0' | '1'>('0')
const timeRange = ref<'w' | 'm' | 'y' | 'a'>('w')
const recordsList = ref<
  Array<{
    agentName: string
    create_at: string
    token: number
  }>
>([])

// Token统计数据
const tokenStats = computed<StatItem[]>(() => [
  {
    key: 'balance',
    label: t('tokenValue.stats.currentBalance'),
    value: tokenBalance.balance || 0,
    type: 'primary',
  },
  {
    key: 'total_earned',
    label: t('tokenValue.stats.totalEarned'),
    value: tokenBalance.total_earned || 0,
    type: 'success',
  },
  {
    key: 'total_used',
    label: t('tokenValue.stats.totalUsed'),
    value: tokenBalance.total_used || 0,
    type: 'warning',
  },
])

// 加载Token数据
const loadTokenData = async () => {
  try {
    await loadTokenBalance()
    await loadRecords()
  } catch {
    ElMessage.error(t('common.errors.dataLoadFailedRetry'))
  }
}

// 加载消耗记录
const loadRecords = async () => {
  const data = await executeApi(() => getTokenValueRecords({
    type: orderType.value,
    timeRange: timeRange.value,
  }))
  if (data !== null && typeof data === 'object') {
    const listData = data as { list?: any[] }
    recordsList.value = (listData.list || []) as Array<{
      agentName: string
      create_at: string
      token: number
    }>
  }
}

// 处理类型切换
const handleTypeChange = () => {
  loadRecords()
}

// 处理时间范围切换
const handleTimeRangeChange = () => {
  loadRecords()
}

// 工具方法
const formatDate = (date: string | Date | null | undefined) => {
  if (!date) return '-'
  return formatDateTime(date)
}

// 页面加载
onMounted(() => {
  loadTokenData()
})
</script>

<style scoped lang="scss">
@use '@/styles/desktop-layout.scss' as *;

.token-value-page {
  background-color: var(--el-bg-color-page);
  padding: $desktop-page-padding;
  max-width: 100%;
  margin: 0 auto;

  @media (width <= $desktop-breakpoint-xs) {
    padding: $desktop-page-padding-mobile;
  }
}

.balance-section {
  background-color: var(--el-bg-color);
  border-radius: var(--global-border-radius);
}

.page-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 24px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  margin: 0 0 8px;

  @media (width <= $desktop-breakpoint-sm) {
    font-size: 20px;
  }

  @media (width <= $desktop-breakpoint-xs) {
    font-size: 18px;
  }
}

.title-icon {
  color: var(--el-color-primary);
  flex-shrink: 0;
}

.page-subtitle {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin: 0;

  @media (width <= $desktop-breakpoint-xs) {
    font-size: 12px;
  }
}

.balance-section,
.type-tabs,
.time-filter,
.records-section {
  margin-bottom: $desktop-section-gap;
  padding: 24px;
  background-color: var(--el-bg-color);
  border-radius: var(--global-border-radius);

  @media (width <= $desktop-breakpoint-xs) {
    padding: 16px;
  }
}
</style>
