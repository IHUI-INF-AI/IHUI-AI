<template>
  <div class="agent-income-page page-container">
    <!-- 页面头部 -->
    <div class="page-header radius-auto">
      <h1 class="page-title">
        <el-icon class="title-icon"><DollarSign /></el-icon>
        {{ t('agentIncome.title') }}
      </h1>
      <p class="page-subtitle">{{ t('agentIncome.subtitle') }}</p>
    </div>

    <!-- 复用UserStatistics.vue的收益统计部分 -->
    <div class="income-overview radius-auto">
      <StatsPanel
        :title="t('agentIncome.incomeOverview')"
        :stats="incomeStats"
        :refreshing="loading"
        @refresh="loadIncomeData"
      />
    </div>

    <!-- 结算状态筛选 -->
    <div class="filter-section radius-auto">
      <el-radio-group v-model="settlementFilter" @change="handleFilterChange">
        <el-radio-button value="">{{ t('agentIncome.all') }}</el-radio-button>
        <el-radio-button value="0">{{ t('agentIncome.unsettled') }}</el-radio-button>
        <el-radio-button value="1">{{ t('agentIncome.settled') }}</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 结算记录列表（复用UserStatistics.vue的结算记录） -->
    <div class="settlement-section radius-auto">
      <el-table :data="filteredSettlementList" v-loading="loading" class="full-width">
        <el-table-column prop="agent_name" :label="t('agentIncome.agentName')" min-width="150" />
        <el-table-column prop="order_no" :label="t('agentIncome.orderNo')" min-width="120" />
        <el-table-column prop="accountType" :label="t('agentIncome.chargeType')" width="120" />
        <el-table-column prop="total" :label="t('agentIncome.quantity')" width="80" />
        <el-table-column :label="t('agentIncome.settlementStatus')" width="100">
          <template #default="{ row }">
            <el-tag :type="row.settlement === '1' ? 'success' : 'warning'">
              {{ row.settlement === '1' ? t('agentIncome.settled') : t('agentIncome.unsettled') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('agentIncome.withdrawalStatus')" width="100">
          <template #default="{ row }">
            <el-tag :type="row.withdrawal === '1' ? 'success' : 'info'">
              {{
                row.withdrawal === '1' ? t('agentIncome.withdrawn') : t('agentIncome.notWithdrawn')
              }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="create_time" :label="t('agentIncome.createTime')" width="180">
          <template #default="{ row }">
            {{ formatTime(row.create_time) }}
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { DollarSign } from '@/lib/lucide-fallback'
import { ElMessage } from 'element-plus'
import { useUserStatistics } from '@/composables/user/useUserStatistics'
import StatsPanel from '@/components/common/StatsPanel.vue'
import type { StatItem } from '@/components/common/StatsPanel.vue'

const { t } = useI18n()

// 复用UserStatistics的收益统计和结算记录
const {
  incomeOverview,
  incomeLoading,
  settlementList,
  settlementLoading,
  loadIncomeOverview,
  loadSettlements,
  formatTime,
} = useUserStatistics()

const loading = computed(() => incomeLoading.value || settlementLoading.value)
const settlementFilter = ref('')

// 收益统计数据
const incomeStats = computed<StatItem[]>(() => [
  {
    key: 'todayAccount',
    label: t('agentIncome.todayIncome'),
    value: incomeOverview.todayAccount || 0,
    type: 'success',
    prefix: '¥',
  },
  {
    key: 'PendingSettlement',
    label: t('agentIncome.pendingSettlement'),
    value: incomeOverview.PendingSettlement || 0,
    type: 'warning',
    prefix: '¥',
  },
  {
    key: 'WithdrawableAmount',
    label: t('agentIncome.withdrawableAmount'),
    value: incomeOverview.WithdrawableAmount || 0,
    type: 'primary',
    prefix: '¥',
  },
  {
    key: 'AccumulatedIncome',
    label: t('agentIncome.accumulatedIncome'),
    value: incomeOverview.AccumulatedIncome || 0,
    type: 'info',
    prefix: '¥',
  },
])

// 筛选后的结算记录
const filteredSettlementList = computed(() => {
  if (!settlementFilter.value) {
    return settlementList.value
  }
  return settlementList.value.filter(
    (item: { settlement?: string }) => item.settlement === settlementFilter.value
  )
})

// 处理筛选变化
const handleFilterChange = () => {
  loadSettlements()
}

// 加载收益数据
const loadIncomeData = async () => {
  try {
    await loadIncomeOverview()
    await loadSettlements()
  } catch {
    ElMessage.error(t('common.errors.incomeLoadFailed'))
  }
}

// 页面加载
onMounted(() => {
  loadIncomeData()
})
</script>

<style scoped lang="scss">
@use '@/styles/desktop-layout.scss' as *;

.agent-income-page {
  width: 100%;
  min-height: 100vh;
  background-color: var(--el-bg-color-page);
  padding: $desktop-page-padding;
  max-width: 100%;
  margin: 0 auto;

  @media (width <= $desktop-breakpoint-xs) {
    padding: $desktop-page-padding-mobile;
  }
}

.page-header {
  margin-bottom: $desktop-section-gap;
  padding: 24px;
  background-color: var(--el-bg-color-page);
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

.income-overview,
.filter-section,
.settlement-section {
  margin-bottom: $desktop-section-gap;
  padding: 24px;
  background-color: var(--el-bg-color-page);
  border-radius: var(--global-border-radius);

  @media (width <= $desktop-breakpoint-xs) {
    padding: 16px;
  }

  .full-width {
    width: 100%;
  }
}
</style>
