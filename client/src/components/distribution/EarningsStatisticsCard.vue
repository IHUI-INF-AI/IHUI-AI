<template>
  <div class="earnings-card-container">
    <div class="stats-header">
      <h3 class="stats-title">{{ t('distribution.earningsStatistics.title') }}</h3>
      <el-radio-group v-model="currentTab" size="small" @change="handleTabChange">
        <el-radio-button value="today">{{
          t('distribution.earningsStatistics.today')
        }}</el-radio-button>
        <el-radio-button value="month">{{
          t('distribution.earningsStatistics.month')
        }}</el-radio-button>
        <el-radio-button value="total">{{
          t('distribution.earningsStatistics.total')
        }}</el-radio-button>
      </el-radio-group>
    </div>
    <StatsPanel :title="''" :stats="currentStats" :refreshing="loading" @refresh="handleRefresh" />

    <div class="bottom-stats">
      <div class="stat-item">
        <div class="stat-value">{{ currentData.order }}</div>
        <div class="stat-label">
          {{ tabLabel }}{{ t('distribution.earningsStatistics.companyPerformance') }}
        </div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{{ currentData.strength }}</div>
        <div class="stat-label">
          {{ tabLabel }}{{ t('distribution.earningsStatistics.newMembers') }}
        </div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{{ formatPrice(currentData.endAmount) }}</div>
        <div class="stat-label">
          {{ tabLabel }}{{ t('distribution.earningsStatistics.performance') }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import StatsPanel from '@/components/common/StatsPanel.vue'
import type { StatItem } from '@/components/common/StatsPanel.vue'

const { t } = useI18n()

interface EarningsData {
  amount: number // 收益
  incomplete: number // 待结算
  finish: number // 已结算
  order: number // 公司业绩
  strength: number // 新增人数
  endAmount: number // 业绩
}

interface Props {
  dayStatistics?: EarningsData
  monthStatistics?: EarningsData
  sumStatistics?: EarningsData
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  dayStatistics: () => ({
    amount: 0,
    incomplete: 0,
    finish: 0,
    order: 0,
    strength: 0,
    endAmount: 0,
  }),
  monthStatistics: () => ({
    amount: 0,
    incomplete: 0,
    finish: 0,
    order: 0,
    strength: 0,
    endAmount: 0,
  }),
  sumStatistics: () => ({
    amount: 0,
    incomplete: 0,
    finish: 0,
    order: 0,
    strength: 0,
    endAmount: 0,
  }),
  loading: false,
})

const emit = defineEmits<{
  tabChange: [tab: 'today' | 'month' | 'total']
  refresh: []
}>()

const currentTab = ref<'today' | 'month' | 'total'>('today')

const tabLabel = computed(() => {
  switch (currentTab.value) {
    case 'today':
      return t('distribution.earningsStatistics.day')
    case 'month':
      return t('distribution.earningsStatistics.month')
    case 'total':
      return t('distribution.earningsStatistics.total')
    default:
      return t('distribution.earningsStatistics.day')
  }
})

const currentData = computed<EarningsData>(() => {
  switch (currentTab.value) {
    case 'today':
      return props.dayStatistics
    case 'month':
      return props.monthStatistics
    case 'total':
      return props.sumStatistics
    default:
      return props.dayStatistics
  }
})

const currentStats = computed<StatItem[]>(() => [
  {
    key: 'amount',
    label: t('distribution.earningsStatistics.earnings'),
    value: currentData.value.amount,
    type: 'primary',
    prefix: '¥',
  },
  {
    key: 'incomplete',
    label: t('distribution.earningsStatistics.pendingSettlement'),
    value: currentData.value.incomplete,
    type: 'warning',
    prefix: '¥',
  },
  {
    key: 'finish',
    label: t('distribution.earningsStatistics.settled'),
    value: currentData.value.finish,
    type: 'success',
    prefix: '¥',
  },
])

const formatPrice = (value: number): string => {
  if (value >= 10000) {
    return (value / 10000).toFixed(2) + 'w'
  }
  return value.toFixed(2)
}

const handleTabChange = (tab: 'today' | 'month' | 'total') => {
  currentTab.value = tab
  emit('tabChange', tab)
}

const handleRefresh = () => {
  emit('refresh')
}
</script>

<style scoped lang="scss">
.earnings-card-container {
  background-color: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  padding: 20px;
  margin-bottom: 20px;
}

.stats-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.stats-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0;
}

.bottom-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-top: 24px;
  padding-top: 24px;
  border-top: var(--unified-border);
}

.stat-item {
  text-align: center;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  margin-bottom: 8px;
}

.stat-label {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}
</style>
