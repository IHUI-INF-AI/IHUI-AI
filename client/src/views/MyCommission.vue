<template>
  <div class="commission-page">
    <div class="page-header">
      <h1 class="page-title">{{ t('myCommission.title') }}</h1>
    </div>

    <div class="content-wrapper">
      <div class="commission-card">
        <div class="commission-left">
          <div class="title">{{ t('myCommission.totalCommission') }}</div>
          <div class="main-amount">
            <span class="amount-highlight">{{ totalEarnings }}</span>
            <span class="unit">{{ t('myCommission.yuan') }}</span>
          </div>
          <div class="row">
            <span>{{ t('myCommission.available') }}</span>
            <span class="amount-highlight">{{ available }}</span>
            <span class="unit">{{ t('myCommission.yuan') }}</span>
          </div>
          <div class="row">
            <span>{{ t('myCommission.withdrawn') }}</span>
            <span class="amount-highlight">{{ withdrawn }}</span>
            <span class="unit">{{ t('myCommission.yuan') }}</span>
          </div>
          <div class="row">
            <span>{{ t('myCommission.pending') }}</span>
            <span class="amount-highlight">{{ pending }}</span>
            <span class="unit">{{ t('myCommission.yuan') }}</span>
          </div>
        </div>
        <div class="commission-right">
          <div class="today-row">
            <span>{{ t('myCommission.todayCommission') }}</span>
            <span class="amount-highlight">{{ today }}</span>
            <span class="unit">{{ t('myCommission.yuan') }}</span>
          </div>
          <el-button type="primary" class="withdraw-btn" @click="handleWithdraw">
            {{ t('myCommission.withdraw') }}
          </el-button>
          <div class="withdraw-detail" @click="handleDetail">
            {{ t('myCommission.withdrawDetail') }}
          </div>
        </div>
      </div>

      <div class="tab-section">
        <div
          v-for="(tab, idx) in tabList"
          :key="tab.id"
          class="tab-item"
          :class="{ active: activeTab === idx }"
          @click="activeTab = idx"
        >
          {{ tab.name }}
        </div>
      </div>

      <div class="commission-list">
        <div v-if="filteredList.length > 0" class="list-items">
          <div v-for="item in filteredList" :key="item.id" class="list-item">
            <div class="item-left">
              <div class="status pending">
                <span>{{ t('myCommission.commission') }}</span>
                <span style="margin-left: 20px">{{ t('myCommission.pending') }}</span>
                <span style="margin-left: 370px">¥{{ item.amount }}</span>
              </div>
              <div class="order-user">{{ t('myCommission.buyer') }}：{{ item.buyer_nickname }}</div>
              <div class="order-id">
                {{ t('myCommission.orderTime') }}：{{ formatTime(item.time) }}
              </div>
              <div class="order-id">
                {{ t('myCommission.relatedOrder') }}：{{ item.out_trade_no }}
              </div>
            </div>
            <el-button class="copy-btn" @click="copyOrderId(item.order_id)">
              {{ t('myCommission.copy') }}
            </el-button>
          </div>
        </div>

        <div v-else class="empty-state">
          <img src="/images/common/empty-box.svg" alt="Empty" class="empty-icon" />
          <p class="empty-text">{{ t('myCommission.noCommission') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { getUserCommissionDetail } from '@/api/distribution/distribution'
import { logger } from '@/utils/logger'

interface CommissionItem {
  id: string
  amount: number
  buyer_nickname: string
  time: number
  out_trade_no: string
  order_id: string
  status: number
}

const { t } = useI18n()

const activeTab = ref(0)
const totalEarnings = ref('0.00')
const today = ref('0.00')
const available = ref('0.00')
const withdrawn = ref('0.00')
const pending = ref('0.00')
const commissionList = ref<CommissionItem[]>([])

const tabList = [
  { id: 1, name: 'myCommission.tabs.all' },
  { id: 2, name: 'myCommission.tabs.pending' },
  { id: 3, name: 'myCommission.tabs.settled' },
  { id: 4, name: 'myCommission.tabs.cancelled' },
]

const filteredList = computed(() => {
  let list = commissionList.value

  if (activeTab.value === 1) {
    list = list.filter(item => item.status === 0)
  } else if (activeTab.value === 2) {
    list = list.filter(item => item.status === 1)
  } else if (activeTab.value === 3) {
    list = list.filter(item => item.status === 2)
  }

  return list
})

const formatTime = (timestamp: number): string => {
  if (!timestamp) return ''

  const ts = String(timestamp).length === 10 ? Number(timestamp) * 1000 : Number(timestamp)

  const date = new Date(ts)

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}`
}

const fetchCommissionDetail = async () => {
  try {
    const response = await getUserCommissionDetail() as { data?: { total_earnings?: number; today_commission?: number; balance?: number; commission_list?: Array<{ status?: number; amount?: number }> } }
    const data = response.data
    if (data) {
      totalEarnings.value = (data.total_earnings || 0).toFixed(2)
      today.value = (data.today_commission || 0).toFixed(2)
      available.value = (data.balance || 0).toFixed(2)
      withdrawn.value = ((data.total_earnings || 0) - (data.balance || 0)).toFixed(2)
      pending.value = (data.commission_list || [])
        .filter((item: { status?: number }) => item.status === 0)
        .reduce((sum: number, item: { amount?: number }) => sum + (item.amount || 0), 0)
        .toFixed(2)
      commissionList.value = (data.commission_list || []) as CommissionItem[]
    }
  } catch (error) {
    logger.error('Failed to fetch commission detail:', error)
  }
}

const handleWithdraw = () => {
  ElMessage.success(t('myCommission.withdrawSuccess'))
}

const handleDetail = () => {
  ElMessage.info(t('myCommission.withdrawDetailInfo'))
}

const copyOrderId = (orderId: string) => {
  navigator.clipboard
    .writeText(String(orderId))
    .then(() => {
      ElMessage.success(t('myCommission.copySuccess'))
    })
    .catch(() => {
      ElMessage.error(t('myCommission.copyFailed'))
    })
}

onMounted(() => {
  fetchCommissionDetail()
})
</script>

<style scoped lang="scss">
.commission-page {
  min-height: 100vh;
  background: var(--color-gray-f5f7fa);
  padding: 20px;
}

.page-header {
  margin-bottom: 24px;
}

.page-title {
  font-size: 28px;
  font-weight: 600;
  color: var(--color-dark-bg-3);
  margin: 0;
}

.content-wrapper {
  width: 100%;
  margin: 0 auto;
}

.commission-card {
  margin: 0 auto 24px;
  background: var(--el-text-color-primary);
  border-radius: var(--global-border-radius);
  display: flex;
  align-items: flex-start;
  padding: 24px;
  position: relative;
  border-bottom: 4px solid var(--border-unified-color);
}

.commission-left {
  flex: 1.2;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 8px;
}

.title {
  font-size: 16px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
  font-weight: 500;
}

.main-amount {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-orange-ff9800);
  margin-bottom: 8px;
  display: flex;
  align-items: baseline;
}

.amount-highlight {
  color: var(--color-orange-ff9800);
  font-size: 28px;
  font-weight: 700;
  margin: 0 4px;
}

.unit {
  color: var(--el-text-color-secondary);
  font-size: 14px;
  margin-left: 2px;
}

.row {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin-bottom: 4px;
  display: flex;
  align-items: baseline;
}

.commission-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: flex-start;
  gap: 12px;
  margin-left: 24px;
}

.today-row {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
  display: flex;
  align-items: baseline;
}

.withdraw-btn {
  color: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  font-size: 14px;
  padding: 0 30px;
  height: 40px;
  background: var(--color-purple-8278f0);
  border: var(--unified-border);
  font-weight: 500;
}

.withdraw-detail {
  color: var(--color-purple-4d45a8);
  font-size: 13px;
  text-align: center;
  margin-top: 0;
  margin-right: 10px;
  cursor: pointer;
  transition: color 0.3s ease;

  &:hover {
    color: var(--color-purple-8278f0);
  }
}

.tab-section {
  display: flex;
  background: var(--el-text-color-primary);
  border-radius: var(--global-border-radius);
  padding: 4px;
  margin-bottom: 20px;
  overflow: hidden;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 12px 16px;
  font-size: 15px;
  color: var(--el-text-color-placeholder);
  cursor: pointer;
  transition: all 0.3s ease;
  border-radius: var(--global-border-radius);
  font-weight: 500;

  &.active {
    background: var(--el-color-primary-light-7);
    color: var(--el-text-color-primary);
    font-weight: 600;
  }

  &:hover:not(.active) {
    background: var(--el-fill-color-light);
  }
}

.commission-list {
  min-height: 400px;
}

.list-items {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: var(--unified-border-bottom);
  margin-bottom: 12px;
  border-radius: var(--global-border-radius);
  background: var(--el-text-color-primary);
  position: relative;
}

.item-left {
  flex: 1;
}

.status {
  font-size: 15px;
  margin-bottom: 8px;
  display: block;
  font-weight: 500;
}

.status.pending {
  color: var(--color-orange-ff9900);
}

.status.completed {
  color: var(--color-green-19be6b);
}

.status.canceled {
  color: var(--color-red-ed3f14);
}

.order-user,
.order-id {
  font-size: 13px;
  color: var(--el-text-color-regular);
  display: block;
  margin-bottom: 4px;
}

.copy-btn {
  background-color: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
  font-size: 13px;
  padding: 6px 16px;
  height: 32px;
  border-radius: var(--global-border-radius);
  border: none;
  position: absolute;
  right: 20px;
  top: 60%;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background-color: var(--el-fill-color);
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
}

.empty-icon {
  width: 120px;
  height: 120px;
  margin-bottom: 20px;
  opacity: 0.6;
}

.empty-text {
  font-size: 16px;
  color: var(--el-text-color-secondary);
  margin: 0;
}

@media (width <= 768px) {
  .commission-page {
    padding: 16px;
  }

  .page-title {
    font-size: 24px;
  }

  .commission-card {
    flex-direction: column;
    padding: 20px;
  }

  .commission-left,
  .commission-right {
    flex: 1;
    margin-left: 0;
    width: 100%;
  }

  .commission-right {
    align-items: flex-start;
    margin-top: 20px;
  }

  .main-amount {
    font-size: 24px;
  }

  .amount-highlight {
    font-size: 24px;
  }

  .tab-item {
    font-size: 14px;
    padding: 10px 12px;
  }

  .list-item {
    padding: 16px;
  }

  .copy-btn {
    position: static;
    margin-top: 12px;
  }
}

@media (width <= 480px) {
  .commission-page {
    padding: 12px;
  }

  .page-title {
    font-size: 20px;
  }

  .commission-card {
    padding: 16px;
  }

  .main-amount {
    font-size: 22px;
  }

  .amount-highlight {
    font-size: 22px;
  }

  .title,
  .row,
  .today-row {
    font-size: 13px;
  }

  .tab-item {
    font-size: 13px;
    padding: 8px 10px;
  }

  .list-item {
    padding: 12px;
  }

  .status {
    font-size: 14px;
  }

  .order-user,
  .order-id {
    font-size: 12px;
  }
}
</style>
