<template>
  <div class="trader-commission-page page-container">
    <!-- 页面头部 -->
    <div class="page-header radius-auto">
      <h1 class="page-title">
        <el-icon class="title-icon"><DollarSign /></el-icon>
        {{ t('traderCommission.title') }}
      </h1>
      <p class="page-subtitle">{{ t('traderCommission.subtitle') }}</p>
    </div>

    <GlobalLoading v-if="loading" />

    <!-- 佣金统计卡片 -->
    <div v-if="!loading" class="commission-card radius-auto">
      <div class="commission-left">
        <div class="title">{{ t('traderCommission.totalCommission') }}</div>
        <div class="main-amount">
          <span class="amount-highlight">¥{{ commissionData.total_earnings || 0 }}</span>
        </div>
        <div class="row">
          <span>{{ t('traderCommission.withdrawableCommission') }}</span>
          <span class="amount-highlight">¥{{ commissionData.balance || 0 }}</span>
        </div>
        <div class="row">
          <span>{{ t('traderCommission.withdrawnCommission') }}</span>
          <span class="amount-highlight">¥{{ withdrawnAmount || 0 }}</span>
        </div>
        <div class="row">
          <span>{{ t('traderCommission.pendingCommission') }}</span>
          <span class="amount-highlight">¥{{ pendingAmount || 0 }}</span>
        </div>
      </div>
      <div class="commission-right">
        <div class="today-row">
          <span>{{ t('traderCommission.todayCommission') }}</span>
          <span class="amount-highlight">¥{{ commissionData.today_commission || 0 }}</span>
        </div>
        <el-button type="primary" class="withdraw-btn" @click="goToWithdraw">{{
          t('traderCommission.withdraw')
        }}</el-button>
        <el-button link class="withdraw-detail-btn" @click="goToWithdrawRecords">
          {{ t('traderCommission.withdrawDetails') }}
        </el-button>
      </div>
    </div>

    <!-- 佣金明细选项卡 -->
    <div v-if="!loading" class="tabs-container radius-auto">
      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <el-tab-pane :label="t('traderCommission.tabs.all')" name="all" />
        <el-tab-pane :label="t('traderCommission.tabs.pending')" name="pending" />
        <el-tab-pane :label="t('traderCommission.tabs.settled')" name="settled" />
        <el-tab-pane :label="t('traderCommission.tabs.cancelled')" name="cancelled" />
      </el-tabs>
    </div>

    <!-- 佣金明细列表 -->
    <div v-if="!loading" class="commission-list radius-auto">
      <el-table :data="filteredCommissionList" v-loading="loading" style="width: 100%">
        <el-table-column
          prop="buyer_nickname"
          :label="t('traderCommission.table.buyer')"
          min-width="120"
        />
        <el-table-column
          prop="out_trade_no"
          :label="t('traderCommission.table.relatedOrder')"
          min-width="150"
        />
        <el-table-column
          prop="amount"
          :label="t('traderCommission.table.commissionAmount')"
          width="120"
        >
          <template #default="{ row }">
            <span class="amount-highlight">¥{{ row.amount.toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('traderCommission.table.status')" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="time" :label="t('traderCommission.table.orderTime')" width="180">
          <template #default="{ row }">
            {{ formatTime(row.time) }}
          </template>
        </el-table-column>
        <el-table-column :label="t('traderCommission.table.actions')" width="100">
          <template #default="{ row }">
            <el-button link size="small" @click="copyOrderId(row.order_id)">
              {{ t('traderCommission.table.copyOrderId') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty
        v-if="filteredCommissionList.length === 0 && !loading"
        :description="t('traderCommission.noRecords')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { DollarSign } from '@/lib/lucide-fallback'
import { useI18n } from 'vue-i18n'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import GlobalLoading from '@/components/common/GlobalLoading.vue'
import { getUserCommissionDetail } from '@/api/distribution/distribution'
import { logger } from '@/utils/logger'
import { useAuthStore } from '@/stores/auth'
import { useApiError } from '@/composables/useApiError'

const { t } = useI18n()
const router = useRouter()
const { showSuccess, showError } = useOperationFeedback()
const authStore = useAuthStore()

const { loading, execute: executeApi } = useApiError({ showMessage: true })
const activeTab = ref('all')
const commissionData = ref<{
  today_commission: number
  total_earnings: number
  balance: number
  commission_list: Array<{
    id: string
    amount: number
    buyer_nickname: string
    time: number
    out_trade_no: string
    order_id: string
    status?: number
  }>
}>({
  today_commission: 0,
  total_earnings: 0,
  balance: 0,
  commission_list: [],
})

// 已提现金额（从commission_list中计算已结算的）
const withdrawnAmount = computed(() => {
  return commissionData.value.commission_list
    .filter(item => item.status === 1)
    .reduce((sum, item) => sum + item.amount, 0)
})

// 待结算金额（从commission_list中计算待结算的）
const pendingAmount = computed(() => {
  return commissionData.value.commission_list
    .filter(item => item.status === 0)
    .reduce((sum, item) => sum + item.amount, 0)
})

// 筛选后的佣金列表
const filteredCommissionList = computed(() => {
  let list = commissionData.value.commission_list || []
  if (activeTab.value === 'pending') {
    list = list.filter(item => item.status === 0)
  } else if (activeTab.value === 'settled') {
    list = list.filter(item => item.status === 1)
  } else if (activeTab.value === 'cancelled') {
    list = list.filter(item => item.status === 4)
  }
  return list
})

// 加载佣金数据
const loadCommissionData = async () => {
  const user = authStore.user as { id?: string; uuid?: string } | null
  const userId = user?.id || user?.uuid
  const data = await executeApi(() => getUserCommissionDetail(userId as string))
  if (data !== null && typeof data === 'object') {
    commissionData.value = data
  }
}

// 处理标签切换
const handleTabChange = (tab: string) => {
  logger.debug('[TraderCommission] Switching to tab:', tab)
}

// 获取状态类型
const getStatusType = (status?: number): 'success' | 'warning' | 'danger' | 'info' => {
  if (status === 1) return 'success'
  if (status === 0) return 'warning'
  if (status === 4) return 'danger'
  return 'info'
}

// 获取状态文本
const getStatusText = (status?: number): string => {
  if (status === 1) return t('traderCommission.status.settled')
  if (status === 0) return t('traderCommission.status.pending')
  if (status === 4) return t('traderCommission.status.cancelled')
  return t('traderCommission.status.unknown')
}

// 格式化时间
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// 复制订单号
const copyOrderId = async (orderId: string) => {
  try {
    await navigator.clipboard.writeText(orderId)
    showSuccess(t('traderCommission.errors.copySuccess'))
  } catch (error) {
    logger.error('[TraderCommission] Failed to copy order number:', error)
    showError(t('traderCommission.errors.copyFailed'))
  }
}

// 跳转到提现页面
const goToWithdraw = () => {
  router.push({
    path: '/withdraw',
    query: { amount: String(commissionData.value.balance) },
  } as { path: string; query: Record<string, string> })
}

// 跳转到提现明细
const goToWithdrawRecords = () => {
  router.push('/withdraw/records')
}

// 页面加载
onMounted(() => {
  loadCommissionData()
})
</script>

<style scoped lang="scss">
@use '@/styles/desktop-layout.scss' as *;

.trader-commission-page.page-container {
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

.commission-card {
  margin-bottom: $desktop-section-gap;
  padding: 32px;
  background: var(--el-text-color-primary);
  border-radius: var(--global-border-radius);
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 24px;

  @media (width <= $desktop-breakpoint-xs) {
    flex-direction: column;
    padding: 24px;
  }
}

.commission-left {
  flex: 1.2;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.title {
  font-size: 16px;
  color: var(--el-text-color-regular);
  margin-bottom: 8px;
}

.main-amount {
  font-size: 36px;
  font-weight: 700;
  color: var(--color-orange-ff9800);
  margin-bottom: 8px;
  display: flex;
  align-items: baseline;
}

.amount-highlight {
  color: var(--color-orange-ff9800);
  font-size: 32px;
  font-weight: 700;
  margin: 0 4px;
}

.row {
  font-size: 14px;
  color: var(--el-text-color-regular);
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.commission-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 16px;
  margin-left: 24px;

  @media (width <= $desktop-breakpoint-xs) {
    align-items: stretch;
    margin-left: 0;
    margin-top: 16px;
  }
}

.today-row {
  font-size: 16px;
  color: var(--el-text-color-regular);
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 8px;
}

.withdraw-btn {
  width: 100%;
  border-radius: var(--global-border-radius);
}

.withdraw-detail-btn {
  color: var(--color-purple-4d45a8);
  font-size: 14px;
}

.tabs-container {
  margin-bottom: $desktop-section-gap;
  padding: 24px;
  background-color: var(--el-bg-color);
  border-radius: var(--global-border-radius);
}

.commission-list {
  padding: 24px;
  background-color: var(--el-bg-color);
  border-radius: var(--global-border-radius);
}
</style>
