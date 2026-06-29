<template>
  <div class="distribution-order-page">
    <div class="page-header">
      <h1 class="page-title">{{ t('distributionOrder.title') }}</h1>
    </div>

    <div class="content-wrapper">
      <div class="search-section">
        <el-input
          v-model="searchText"
          :placeholder="t('distributionOrder.searchPlaceholder')"
          clearable
          @input="handleSearch"
          class="search-input"
        >
          <template #prefix>
            <SearchIcon />
          </template>
        </el-input>
      </div>

      <div class="tab-section">
        <div
          v-for="(tab, index) in tabs"
          :key="tab.value"
          class="tab-item"
          :class="{ active: currentTab === tab.value }"
          @click="switchTab(tab.value)"
        >
          {{ t(tab.name) }}
        </div>
      </div>

      <div class="team-total">
        {{ t('distributionOrder.totalOrders', { count: filteredOrders.length }) }}
        {{ t('distributionOrder.totalCommission', { amount: amountCount }) }}
      </div>

      <div class="order-list">
        <div v-if="filteredOrders.length > 0" class="order-cards">
          <div v-for="order in filteredOrders" :key="order.outTradeNo" class="order-card">
            <div class="order-card-header">
              <div class="order-info">
                <span class="label">{{ t('distributionOrder.orderNo') }}</span>
                <span class="value">{{ order.outTradeNo }}</span>
              </div>
              <div class="order-status-group">
                <div
                  class="order-status-finish"
                  :class="{
                    'status-pending': order.orderStatus === 0,
                    'status-settled': order.orderStatus === 1,
                    'status-canceled': order.orderStatus === 2,
                  }"
                >
                  {{ statusText(order.orderStatus) }}
                </div>
              </div>
              <div
                class="order-status-settled"
                :class="{
                  pending: order.orderStatus === 0,
                  finished: order.orderStatus === 1,
                }"
              >
                {{ statusText2(order.status) }}
              </div>
            </div>

            <div class="order-card-user">
              <span class="label">{{ t('distributionOrder.buyer') }}</span>
              <span class="value">{{ order.nickname }}</span>
            </div>

            <div class="order-card-main">
              <img :src="order.images" alt="Product" class="order-product-img" loading="lazy" />
              <div class="order-product-info">
                <div class="order-product-title">{{ order.productName }}</div>
              </div>
            </div>

            <div class="order-product-price">¥{{ formatPrice(order.orderAmount) }}</div>

            <div class="order-card-footer">
              <div class="order-time">
                <span class="label">{{ t('distributionOrder.orderTime') }}</span>
                <span class="value">{{ formatTime(order.time) }}</span>
              </div>
              <div class="order-commission">
                <span class="label">{{ t('distributionOrder.commission') }}</span>
                <span class="order-commission-amount">¥{{ order.amount.toFixed(2) }}</span>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="empty-state">
          <img src="/images/common/empty-box.svg" alt="Empty" class="empty-icon" loading="lazy" />
          <p class="empty-text">{{ t('distributionOrder.noOrders') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { useI18n } from 'vue-i18n'
import SearchIcon from '@/components/common/SearchIcon.vue'
import { getCommissionFlow } from '@/api/distribution'
import { logger } from '@/utils/logger'
import { formatMoney } from '@/utils/format'

interface DistributionOrder {
  outTradeNo: string
  nickname: string
  productName: string
  images: string
  orderAmount: number
  amount: number
  orderStatus: number
  status: number
  time: number
}

const { t } = useI18n()

const searchText = ref('')
const currentTab = ref('all')
const originalOrders = ref<DistributionOrder[]>([])
const amountCount = ref(0)

// 统一清理：组件卸载时自动执行所有注册的清理函数
const cleanup = useCleanup()

const tabs = [
  { name: 'distributionOrder.tabs.all', value: 'all' },
  { name: 'distributionOrder.tabs.pending', value: '0' },
  { name: 'distributionOrder.tabs.refund', value: '1' },
  { name: 'distributionOrder.tabs.completed', value: '2' },
]

const filteredOrders = computed(() => {
  let result = [...originalOrders.value]

  if (searchText.value) {
    const keyword = searchText.value.toLowerCase()

    let statusFilter: string | null = null
    const unsettled = t('order.status.unsettled').toLowerCase()
    const pending = t('order.status.pending').toLowerCase()
    const refunded = t('order.status.refunded').toLowerCase()
    const completed = t('order.status.completed').toLowerCase()
    
    if (keyword === unsettled || keyword === pending) {
      statusFilter = '0'
    } else if (keyword === refunded) {
      statusFilter = '1'
    } else if (keyword === completed) {
      statusFilter = '2'
    }

    result = result.filter(
      order =>
        order.outTradeNo?.toLowerCase().includes(keyword) ||
        order.nickname?.toLowerCase().includes(keyword) ||
        order.productName?.toLowerCase().includes(keyword) ||
        String(order.orderAmount || '')?.includes(keyword) ||
        String(order.amount || '')?.includes(keyword) ||
        formatTime(order.time)?.toLowerCase().includes(keyword) ||
        (statusFilter && order.orderStatus.toString() === statusFilter) ||
        statusText(order.orderStatus).includes(keyword)
    )
  }

  if (currentTab.value !== 'all') {
    result = result.filter(order => order.orderStatus.toString() === currentTab.value)
  }

  return result
})

const statusText = (status: number): string => {
  const statusMap: Record<number, string> = {
    0: 'distributionOrder.status.unsettled',
    1: 'distributionOrder.status.refund',
    2: 'distributionOrder.status.completed',
  }
  return t(statusMap[status] || 'distributionOrder.status.unknown')
}

const statusText2 = (status: number): string => {
  const statusMap: Record<number, string> = {
    0: 'distributionOrder.withdrawStatus.unwithdrawn',
    1: 'distributionOrder.withdrawStatus.withdrawn',
    2: 'distributionOrder.withdrawStatus.approving',
  }
  return t(statusMap[status] || 'distributionOrder.withdrawStatus.unknown')
}

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

const formatPrice = (amount: number): string => formatMoney(amount / 100)

const switchTab = (tabValue: string) => {
  currentTab.value = tabValue
}

let searchTimer: NodeJS.Timeout | null = null

const handleSearch = () => {
  if (searchTimer) {
    clearTimeout(searchTimer)
  }
  searchTimer = setTimeout(() => {
    listOrder()
  }, 500)
}

const listOrder = async () => {
  try {
    const response = await getCommissionFlow({
      page: 1,
      page_size: 100
    })
    if (response.code === 200 && response.data) {
      const flows = response.data.flows
      amountCount.value = flows.reduce((sum: number, flow: { amount?: number }) => sum + (flow.amount || 0), 0)
      originalOrders.value = flows.map((flow: { order_id?: string; amount?: number; status?: number; time?: number }): DistributionOrder => ({
        outTradeNo: flow.order_id || '',
        nickname: '',
        productName: '',
        images: '',
        orderAmount: flow.amount || 0,
        amount: flow.amount || 0,
        orderStatus: flow.status || 0,
        status: flow.status || 0,
        time: flow.time || 0
      }))
    }
  } catch (error) {
    logger.error('Failed to fetch distribution orders:', error)
  }
}

onMounted(() => {
  listOrder()
})

cleanup.add(() => {
  if (searchTimer) {
    clearTimeout(searchTimer)
    searchTimer = null
  }
})
</script>

<style scoped lang="scss">
.distribution-order-page {
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
  color: var(--el-text-color-primary);
  margin: 0;
}

.content-wrapper {
  width: 100%;
  margin: 0 auto;
}

.search-section {
  margin-bottom: 20px;
}

.search-input {
  width: 100%;
}

.tab-section {
  display: flex;
  background: var(--el-fill-color-light);
  border-radius: var(--global-border-radius);
  padding: 6px;
  margin-bottom: 16px;
  overflow: hidden;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 12px 16px;
  font-size: 16px;
  color: var(--el-text-color-primary);
  cursor: pointer;
  transition: all 0.3s ease;
  border-radius: var(--global-border-radius);
  position: relative;
  font-weight: 500;

  &::after {
    content: '';
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 1px;
    height: 24px;
    background: var(--el-border-color-lighter);
  }

  &:last-child::after {
    display: none;
  }

  &.active {
    background: var(--el-text-color-primary);
    font-weight: 600;
  }

  &:hover:not(.active) {
    background: var(--color-white-50);
  }
}

.team-total {
  color: var(--el-text-color-primary);
  margin: 16px 0;
  font-size: 15px;
  font-weight: 500;
}

.order-list {
  min-height: 400px;
}

.order-cards {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.order-card {
  position: relative;
  padding: 20px;
  background: color-mix(in srgb, var(--el-color-primary) 15%, transparent);
  border: var(--unified-border);
  backdrop-filter: blur(10px);
  box-shadow: var(--global-box-shadow);
  border-radius: var(--global-border-radius);
  overflow: hidden;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--global-box-shadow);
  }
}

.order-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.order-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.label {
  color: var(--el-text-color-primary);
  font-weight: 500;
}

.value {
  color: var(--el-text-color-primary);
}

.order-status-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.order-status-finish {
  color: var(--el-text-color-primary);
  font-size: 13px;
  border-radius: var(--global-border-radius);
  padding: 4px 16px;
  font-weight: 500;
}

.status-pending {
  background-color: var(--el-color-success-light-3);
  color: var(--el-color-white);
}

.status-settled {
  background-color: var(--el-color-warning-light-3);
  color: var(--el-text-color-primary);
}

.status-canceled {
  background-color: var(--el-color-success);
  color: var(--el-color-white);
}

.order-status-settled {
  font-size: 13px;
  position: absolute;
  right: 24px;
  top: 22%;
  font-weight: 500;

  &.pending {
    color: var(--el-color-danger);
  }

  &.finished {
    color: var(--el-color-success);
  }
}

.order-card-user {
  margin: 12px 0;
  font-size: 14px;
  color: var(--el-text-color-placeholder);
}

.order-card-main {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 16px 0;
}

.order-product-img {
  width: 100px;
  height: 100px;
  border-radius: var(--global-border-radius);
  object-fit: cover;
  background: var(--el-fill-color-light);
}

.order-product-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.order-product-title {
  font-size: 16px;
  color: var(--el-text-color-primary);
  font-weight: 500;
  line-height: 1.4;
}

.order-product-price {
  font-size: 18px;
  color: var(--el-text-color-primary);
  font-weight: bold;
  position: absolute;
  right: 20px;
  top: 60%;
}

.order-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
  padding-top: 16px;
  border-top: var(--unified-border);
}

.order-time {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.order-commission {
  display: flex;
  align-items: center;
  gap: 8px;
}

.order-commission-amount {
  color: var(--el-color-danger);
  font-size: 18px;
  font-weight: bold;
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
  .distribution-order-page {
    padding: 16px;
  }

  .page-title {
    font-size: 24px;
  }

  .tab-item {
    font-size: 14px;
    padding: 10px 12px;
  }

  .order-card {
    padding: 16px;
  }

  .order-card-main {
    flex-direction: column;
    align-items: flex-start;
  }

  .order-product-img {
    width: 80px;
    height: 80px;
  }

  .order-product-title {
    font-size: 15px;
  }

  .order-product-price {
    position: static;
    margin-top: 8px;
    font-size: 16px;
  }

  .order-status-settled {
    position: static;
    margin-top: 8px;
  }
}

@media (width <= 480px) {
  .distribution-order-page {
    padding: 12px;
  }

  .page-title {
    font-size: 20px;
  }

  .tab-item {
    font-size: 13px;
    padding: 8px 10px;
  }

  .order-card {
    padding: 12px;
  }

  .order-product-img {
    width: 70px;
    height: 70px;
  }

  .order-product-title {
    font-size: 14px;
  }

  .order-commission-amount {
    font-size: 16px;
  }
}
</style>
