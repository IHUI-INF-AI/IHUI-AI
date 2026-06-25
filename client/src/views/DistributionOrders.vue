<template>
  <div class="distribution-orders-page page-container">
    <!-- 页面头部 -->
    <div class="page-header radius-auto">
      <h1 class="page-title">
        <el-icon class="title-icon"><FileText /></el-icon>
        {{ t('distributionOrders.title') }}
      </h1>
      <p class="page-subtitle">{{ t('distributionOrders.subtitle') }}</p>
    </div>

    <!-- 搜索和筛选 -->
    <div class="search-section radius-auto">
      <div class="search-bar">
        <el-input
          v-model="searchText"
          :placeholder="t('distributionOrder.searchPlaceholder')"
          prefix-icon="Search"
          clearable
          @input="handleSearch"
        />
      </div>
      
      <!-- Tab筛选 -->
      <div class="tab-container">
        <div
          v-for="tab in tabs"
          :key="tab.value"
          class="tab-item"
          :class="{ active: currentTab === tab.value }"
          @click="handleTabChange(tab.value)"
        >
          {{ tab.label }}
        </div>
      </div>
      
      <!-- 统计信息 -->
      <div class="stats-bar">
        <span>{{ t('distributionOrder.totalOrders', { count: filteredOrders.length }) }}</span>
        <span>{{ t('distributionOrder.totalCommission', { amount: totalCommission }) }}</span>
      </div>
    </div>

    <!-- 订单列表 -->
    <div class="orders-container radius-auto">
      <GlobalLoading v-if="loading" />

      <el-empty
        v-else-if="filteredOrders.length === 0"
        :description="t('distributionOrder.noOrders')"
      />

      <div v-else class="order-list">
        <div
          v-for="order in paginatedOrders"
          :key="order.id"
          class="order-card"
          @click="viewOrderDetail(order.id)"
        >
          <div class="order-card-header">
            <div>
              <span class="order-label">{{ t('distributionOrder.orderNo') }}：</span>
              <span class="order-value">{{ order.order_no }}</span>
            </div>
            <div class="order-status-group">
              <el-tag
                :type="getOrderStatusType(order.status)"
                size="small"
              >
                {{ getOrderStatusText(order.status) }}
              </el-tag>
            </div>
          </div>
          
          <div class="order-card-user">
            <span class="order-label">{{ t('distributionOrder.buyer') }}：</span>
            <span class="order-value">{{ order.nickname || order.user_id }}</span>
          </div>
          
          <div class="order-card-main">
            <img
              v-if="order.images"
              class="order-product-img"
              :src="order.images"
              :alt="order.product_name"
            />
            <div class="order-product-info">
              <div class="order-product-title">{{ order.product_name || t('distributionOrders.unknownProduct') }}</div>
            </div>
          </div>
          
          <div class="order-product-price">
            ¥{{ (order.amount / 100).toFixed(2) }}
          </div>
          
          <div class="order-card-footer">
            <div>
              <span class="order-label">{{ t('distributionOrder.orderTime') }}：</span>
              <span class="order-value">{{ formatFullTime(order.create_time) }}</span>
            </div>
            <div class="order-commission">
              <span class="order-label">{{ t('distributionOrder.commission') }}</span>
              <span class="order-commission-amount">
                ¥{{ (order.commission || 0).toFixed(2) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="filteredOrders.length"
          layout="total, sizes, prev, pager, next, jumper"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { FileText } from '@/lib/lucide-fallback'
import { getUserAndChildrenOrders, type DistributionOrder } from '@/api/distribution/distribution'
import GlobalLoading from '@/components/common/GlobalLoading.vue'
import { useApiError } from '@/composables/useApiError'

const router = useRouter()
const { t } = useI18n()

const { loading, execute: executeApi } = useApiError({ showMessage: false })
const allOrders = ref<DistributionOrder[]>([])
const searchText = ref('')
const statusFilter = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const currentTab = ref('all')

// Tab 配置
const tabs = computed(() => [
  { label: t('distributionOrders.tabAll'), value: 'all' },
  { label: t('distributionOrders.tabPending'), value: 'pending' },
  { label: t('distributionOrders.tabPaid'), value: 'paid' },
  { label: t('distributionOrders.tabCancelled'), value: 'cancelled' },
])

// 总佣金
const totalCommission = computed(() => {
  return filteredOrders.value.reduce((sum, order) => Number(sum) + Number(order.commission || 0), 0).toFixed(2)
})

// 加载订单列表
const loadOrders = async () => {
  const data = await executeApi(() => getUserAndChildrenOrders({
    page: currentPage.value,
    quantity: pageSize.value,
  }))

  if (data !== null && typeof data === 'object') {
    const ordersData = data as { list?: DistributionOrder[] }
    allOrders.value = ordersData.list || []
  }
}

// 筛选后的订单列表
const filteredOrders = computed(() => {
  let result = allOrders.value

  if (searchText.value) {
    result = result.filter(order => order.order_no?.includes(searchText.value))
  }

  if (statusFilter.value) {
    result = result.filter(order => order.status === Number(statusFilter.value))
  }

  return result
})

// 分页后的订单列表
// 注意：如果API支持服务端分页，应该直接使用API返回的分页数据
// 如果API不支持服务端分页，则使用客户端分页
const paginatedOrders = computed(() => {
  // 如果API已经返回了分页数据，直接使用
  // 否则进行客户端分页
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredOrders.value.slice(start, end)
})

// 处理搜索
const handleSearch = () => {
  currentPage.value = 1
}

// 处理 Tab 切换
const handleTabChange = (tabValue: string) => {
  currentTab.value = tabValue
  // 根据 tab 设置状态筛选
  const statusMap: Record<string, string> = {
    all: '',
    pending: '0',
    paid: '1',
    cancelled: '2',
  }
  statusFilter.value = statusMap[tabValue] || ''
  handleFilter()
}

// 处理筛选
const handleFilter = () => {
  currentPage.value = 1
}

// 格式化完整时间
const formatFullTime = (date: string | Date | number | null | undefined) => {
  if (!date) return '-'
  const d = typeof date === 'number' ? new Date(date) : (date instanceof Date ? date : new Date(date))
  return isNaN(d.getTime()) ? '-' : d.toLocaleString('zh-CN')
}

const getOrderStatusType = (status: number): 'success' | 'warning' | 'danger' | 'info' => {
  const types: Record<number, 'success' | 'warning' | 'danger' | 'info'> = {
    0: 'warning',
    1: 'success',
    2: 'danger',
  }
  return types[status] || 'info'
}

const getOrderStatusText = (status: number): string => {
  const texts: Record<number, string> = {
    0: t('distributionOrders.statusPending'),
    1: t('distributionOrders.statusPaid'),
    2: t('distributionOrders.statusCancelled'),
  }
  return texts[status] || t('distributionOrders.statusUnknown')
}

// 查看订单详情
const viewOrderDetail = (orderId: string) => {
  router.push(`/orders/${orderId}`)
}

// 页面加载
onMounted(() => {
  loadOrders()
})

// 监听分页变化，重新加载数据
watch([currentPage, pageSize], () => {
  loadOrders()
})
</script>

<style scoped lang="scss">
@use '@/styles/desktop-layout.scss' as *;

.distribution-orders-page {
  background-color: var(--el-bg-color-page);
  padding: $desktop-page-padding;
  max-width: 100%;
  margin: 0 auto;

  @media (width <= $desktop-breakpoint-xs) {
    padding: $desktop-page-padding-mobile;
  }
}

.page-header {
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
}

.title-icon {
  color: var(--el-color-primary);
}

.page-subtitle {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin: 0;
}

.search-section {
  margin-bottom: $desktop-section-gap;
  padding: 24px;
  background-color: var(--el-bg-color);
  border-radius: var(--global-border-radius);

  @media (width <= $desktop-breakpoint-xs) {
    padding: 16px;
  }
}

.search-bar {
  display: flex;
  gap: 12px;
  align-items: center;
}

.orders-container {
  margin-bottom: $desktop-section-gap;
  padding: 24px;
  background-color: var(--el-bg-color);
  border-radius: var(--global-border-radius);

  @media (width <= $desktop-breakpoint-xs) {
    padding: 16px;
  }
}

.pagination-wrapper {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>
