<template>
  <div class="order-list-page">
    <div class="page-header">
      <h1 class="page-title">{{ t('orderList.title') }}</h1>
    </div>

    <div class="content-wrapper">
      <div class="search-section">
        <el-input
          v-model="searchText"
          :placeholder="t('orderList.searchPlaceholder')"
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
          v-for="(tab, index) in tabList"
          :key="tab.id"
          class="tab-item"
          :class="{ active: activeTab === index }"
          @click="handleTabChange(index)"
        >
          {{ tab.name }}
        </div>
      </div>

      <div class="order-list">
        <div v-if="filteredList.length > 0" class="order-cards">
          <div
            v-for="order in filteredList"
            :key="order.id"
            class="order-card"
            :class="['card-' + getStatusType(order.status)]"
          >
            <div class="card-header">
              <div class="order-no">
                <span class="label">{{ t('orderList.orderNo') }}</span>
                <span class="value">{{ order.outTradeNo }}</span>
              </div>
              <div class="order-status" :class="'status-' + getStatusType(order.status)">
                {{ getStatusText(order.status) }}
              </div>
            </div>

            <div class="card-body">
              <img v-if="order.images" :src="order.images" alt="Product" class="card-img" loading="lazy" />
              <div v-else class="card-img-placeholder"></div>
              <div class="card-info">
                <div class="card-title">{{ order.productName }}</div>
                <div class="card-desc">{{ order.productName }}</div>
              </div>
            </div>

            <div class="card-bottom">
              <div class="card-time">
                <span class="time-label">{{ t('orderList.orderTime') }}</span>
                <span class="time-value">{{ formatTimestamp(order.createdAt) }}</span>
              </div>
              <div class="card-price">
                <span class="price">¥{{ formatPrice(order.amount) }}</span>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="!loading" class="empty-state">
          <img src="/images/common/empty-box.svg" alt="Empty" class="empty-icon" loading="lazy" />
          <p class="empty-text">{{ t('orderList.noOrders') }}</p>
        </div>

        <div v-if="loading" class="loading-more">
          <el-icon class="is-loading"><Loading /></el-icon>
          <span>{{ t('common.loading') }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Loading } from '@element-plus/icons-vue'
import SearchIcon from '@/components/common/SearchIcon.vue'
import { getUserAndChildrenOrders } from '@/api/distribution/distribution'
import { useApiError } from '@/composables/useApiError'
import { useCleanup } from '@/composables/useCleanup'
import { fenToYuan } from '@/utils/format'

interface Order {
  id: string
  outTradeNo: string
  productName: string
  images?: string
  amount: number
  status: number
  createdAt: number
}

const { t } = useI18n()

const searchText = ref('')
const activeTab = ref(0)
const orderList = ref<Order[]>([])
const { loading, execute: executeApi } = useApiError({ showMessage: false })
const pageNum = ref(1)
const pageSize = 20

const cleanup = useCleanup()

const tabList = [
  { id: 1, name: 'orderList.tabs.all' },
  { id: 2, name: 'orderList.tabs.pending' },
  { id: 3, name: 'orderList.tabs.shipping' },
  { id: 4, name: 'orderList.tabs.completed' },
  { id: 5, name: 'orderList.tabs.refunded' },
]

const filteredList = computed(() => {
  let list = orderList.value

  if (activeTab.value === 1) {
    list = list.filter(item => item.status === 0)
  } else if (activeTab.value === 2) {
    list = list.filter(item => item.status === 1 || item.status === 2)
  } else if (activeTab.value === 3) {
    list = list.filter(item => item.status === 3)
  } else if (activeTab.value === 4) {
    list = list.filter(item => item.status === 5)
  }

  if (searchText.value) {
    list = list.filter(
      item =>
        (item.productName && item.productName.includes(searchText.value)) ||
        (item.outTradeNo && item.outTradeNo.includes(searchText.value))
    )
  }

  return list
})

const getStatusText = (status: number): string => {
  const statusMap: Record<number, string> = {
    0: 'orderList.status.pending',
    1: 'orderList.status.paid',
    2: 'orderList.status.shipped',
    3: 'orderList.status.completed',
    4: 'orderList.status.cancelled',
    5: 'orderList.status.refunded',
    6: 'orderList.status.ended',
  }
  return t(statusMap[status] || 'orderList.status.unknown')
}

const getStatusType = (status: number): string => {
  switch (status) {
    case 0:
      return 'pending'
    case 1:
      return 'cancelled'
    case 2:
      return 'shipping'
    case 3:
      return 'finished'
    case 4:
      return 'cancelled'
    case 5:
      return 'refund'
    case 6:
      return 'ended'
    default:
      return 'pending'
  }
}

const formatTimestamp = (timestamp: number): string => {
  if (!timestamp) return ''
  const date = new Date(timestamp * 1000)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

const formatPrice = (amount: number): string => fenToYuan(amount)

const getOrderList = async () => {
  const data = await executeApi(() => getUserAndChildrenOrders({
    page: pageNum.value,
    quantity: pageSize
  }))
  if (data !== null && typeof data === 'object') {
    const ordersData = data as { list?: any[] }
    if (ordersData.list && ordersData.list.length > 0) {
      if (pageNum.value === 1) {
        orderList.value = ordersData.list as Order[]
      } else {
        orderList.value = [...orderList.value, ...(ordersData.list as Order[])]
      }
    } else {
      if (pageNum.value === 1) {
        orderList.value = []
      }
    }
  }
}

const handleTabChange = (index: number) => {
  activeTab.value = index
  pageNum.value = 1
  orderList.value = []
  getOrderList()
}

let searchTimer: ReturnType<typeof setTimeout> | null = null

const handleSearch = () => {
  if (searchTimer) {
    clearTimeout(searchTimer)
  }
  searchTimer = cleanup.addTimer(() => {
    pageNum.value = 1
    orderList.value = []
    getOrderList()
  }, 500)
}

watch(activeTab, () => {
  pageNum.value = 1
  orderList.value = []
  getOrderList()
})

onMounted(() => {
  getOrderList()
})
</script>

<style scoped lang="scss">
.order-list-page {
  min-height: 100vh;
  background: var(--el-fill-color-lighter);
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
  margin-bottom: 20px;
  overflow: hidden;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 12px 16px;
  font-size: 16px;
  color: var(--color-gray-3d3d3d);
  cursor: pointer;
  transition: background-color 0.3s ease;
  border-radius: var(--global-border-radius);
  position: relative;

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
    background: var(--el-color-primary-light-8);
    font-weight: 600;
  }

  &:hover:not(.active) {
    background: var(--color-white-50);
  }
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
  padding: 20px;
  border-radius: var(--global-border-radius);
  background: var(--color-white-90);
  border: var(--unified-border);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  transition: transform 0.3s ease;

  &:hover {
    
    }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.order-no {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--el-text-color-regular);

  .label {
    font-weight: 500;
  }

  .value {
    color: var(--el-text-color-primary);
  }
}

.order-status {
  padding: 4px 16px;
  border-radius: var(--global-border-radius);
  font-size: 13px;
  font-weight: 500;
  transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
}

.status-pending {
  background: var(--el-color-warning);
  color: var(--el-color-white);
  border: var(--unified-border);
  animation: pulse-pending 2s ease-in-out infinite alternate;
}

@keyframes pulse-pending {
  0% {
    transform: scale(1);
  }

  100% {
    transform: scale(1.02);
  }
}

.status-shipping {
  background: var(--el-color-primary);
  color: var(--color-on-primary);
  }

.status-refund {
  background: var(--el-color-danger);
  color: var(--el-color-white);
  }

.status-finished {
  background: var(--el-color-success);
  color: var(--el-color-white);
  }

.status-cancelled {
  background: var(--el-text-color-placeholder);
  color: var(--el-color-white);
  }

.status-ended {
  background: var(--el-text-color-secondary);
  color: var(--el-color-white);
  }

.card-body {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.card-img {
  width: 100px;
  height: 100px;
  border-radius: var(--global-border-radius);
  object-fit: cover;
  background: var(--el-fill-color-light);
}

.card-img-placeholder {
  width: 100px;
  height: 100px;
  border-radius: var(--global-border-radius);
  background: var(--el-fill-color-light);
}

.card-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  line-height: 1.4;
}

.card-desc {
  font-size: 14px;
  color: var(--el-text-color-placeholder);
  line-height: 1.4;
}

.card-bottom {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding-top: 12px;
  border-top: var(--unified-border);
}

.card-time {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
}

.time-label {
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

.time-value {
  color: var(--el-text-color-regular);
}

.card-price {
  text-align: right;
}

.price {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-red-ff0b0b);
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

.loading-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 30px 0;
  color: var(--el-text-color-regular);
  font-size: 14px;
}

@media (width <= 768px) {
  .order-list-page {
    padding: 16px;
  }

  .page-title {
    font-size: 24px;
  }

  .tab-item {
    font-size: 14px;
    padding: 10px 12px;
  }

  .card-body {
    flex-direction: column;
    align-items: flex-start;
  }

  .card-img,
  .card-img-placeholder {
    width: 80px;
    height: 80px;
  }

  .card-title {
    font-size: 15px;
  }

  .card-desc {
    font-size: 13px;
  }

  .price {
    font-size: 18px;
  }
}

@media (width <= 480px) {
  .order-list-page {
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
    padding: 16px;
  }

  .card-img,
  .card-img-placeholder {
    width: 70px;
    height: 70px;
  }

  .card-title {
    font-size: 14px;
  }

  .card-desc {
    font-size: 12px;
  }

  .price {
    font-size: 16px;
  }
}
</style>
