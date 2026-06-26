<template>
  <div class="orders-root" :class="{ 'mouse-active': isMouseInViewport }">
    <!-- 滚动进度指示器 -->
    <div class="scroll-progress-bar" :style="{ transform: `scaleX(${scrollProgress})` }"></div>

    <!-- 深度背景系统 -->
    <div class="orders-bg-system">
      <div class="bg-glow-orb orb-1"></div>
      <div class="bg-glow-orb orb-2"></div>
      <div class="mouse-glow-effect"></div>
    </div>

    <div class="page-container">
      <!-- 页面头部 -->
      <div class="page-header scroll-reveal" data-animation="fadeInUp">
        <div class="header-badge">
          <span class="status-dot"></span>
          <span class="badge-text font-edix">Orders</span>
        </div>
        <h1 class="page-title">{{ t('orders.title') }}</h1>
        <p class="page-subtitle">{{ t('orders.subtitle') }}</p>
      </div>

      <!-- 搜索栏 - 使用全局统一样式 -->
      <div class="search-section glass scroll-reveal" data-animation="fadeInUp" data-delay="100">
        <div class="search-bar unified-search-native-wrap">
          <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <input
            v-model="searchText"
            link
            :placeholder="t('orders.searchPlaceholder')"
            class="search-input"
            @input="handleSearch"
          />
          <button
            v-if="searchText"
            @click="clearSearch"
            class="clear-btn ripple-btn"
            :aria-label="t('orders.clearSearch')"
            :title="t('orders.clearSearch')"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      <!-- 订单状态筛选 -->
      <div class="filter-tabs scroll-reveal" data-animation="fadeInUp" data-delay="150">
        <button
          v-for="(tab, index) in statusTabs"
          :key="tab.value"
          :class="['tab-btn ripple-btn', { active: activeTab === index }]"
          @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); switchTab(index) }"
        >
          {{ tab.label }}
          <span v-if="tab.count > 0" class="tab-count">{{ tab.count }}</span>
        </button>
      </div>

      <!-- 订单列表 -->
      <div class="orders-container">
        <div
          v-if="loadError"
          class="error-state glass scroll-reveal"
          data-animation="fadeInUp"
        >
          <div class="error-icon-wrapper">
            <svg class="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <h3>{{ t('orders.error.title') }}</h3>
          <p>{{ loadError }}</p>
          <button
            @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); retryLoad() }"
            class="retry-btn ripple-btn magnetic-btn"
            @mousemove="(e) => handleMagneticMove(e, e.currentTarget as HTMLElement)"
            @mouseleave="(e) => resetMagnetic(e.currentTarget as HTMLElement)"
          >
            <span class="btn-text">{{ t('orders.actions.retry') }}</span>
            <span class="btn-glow"></span>
          </button>
        </div>

        <div
          v-else-if="loading"
          class="loading-state scroll-reveal"
          data-animation="fadeInUp"
        >
          <div class="loading-spinner">
            <div class="spinner-ring"></div>
            <div class="spinner-ring"></div>
            <div class="spinner-ring"></div>
          </div>
          <el-skeleton animated>
            <template #template>
              <el-skeleton-item variant="rect" class="skeleton-order-card" />
              <el-skeleton-item variant="rect" class="skeleton-order-card" />
              <el-skeleton-item variant="rect" class="skeleton-order-card" />
            </template>
          </el-skeleton>
        </div>

        <div
          v-else-if="filteredOrders.length === 0"
          class="empty-state glass scroll-reveal"
          data-animation="fadeInUp"
        >
          <div class="empty-icon-wrapper">
            <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M3 3h18v18H3zM9 9h6v6H9z"></path>
            </svg>
          </div>
          <h3>{{ t('orders.empty.title') }}</h3>
          <p>{{ searchText ? t('orders.empty.noSearchResult') : t('orders.empty.noOrders') }}</p>
          <button
            v-if="!searchText"
            @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); goToShop() }"
            class="go-shop-btn ripple-btn magnetic-btn"
            @mousemove="(e) => handleMagneticMove(e, e.currentTarget as HTMLElement)"
            @mouseleave="(e) => resetMagnetic(e.currentTarget as HTMLElement)"
          >
            <span class="btn-text">{{ t('orders.actions.goShop') }}</span>
            <span class="btn-glow"></span>
          </button>
        </div>

        <div v-else class="orders-list">
          <div
            v-for="(order, idx) in filteredOrders"
            :key="order.id"
            class="order-card glass-card scroll-reveal"
            :class="`card-${getStatusType(order.status)}`"
            :data-delay="Number(idx) * 80"
            data-animation="fadeInUp"
          >
            <div class="card-header">
              <span class="order-no">
                <span class="order-label">{{ t('orders.labels.orderId') }}</span>
                <span class="order-id">{{ order.orderNo }}</span>
              </span>
              <div class="order-status" :class="`status-${getStatusType(order.status)}`">
                <span class="status-dot-sm"></span>
                {{ getStatusText(order.status) }}
              </div>
            </div>
            <div class="card-body">
              <div class="card-img">
                <div class="img-placeholder">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <path d="m21 15-5-5L5 21"></path>
                  </svg>
                </div>
              </div>
              <div class="card-info">
                <div class="card-title">{{ order.productName }}</div>
                <div class="card-desc">{{ order.productName }}</div>
              </div>
            </div>
            <div class="card-bottom-row">
              <div class="card-time">
                <div class="time-item">
                  <span class="time-label">{{ t('orders.labels.createTime') }}</span>
                  <span class="time-value">{{ formatDate(order.createTime) }}</span>
                </div>
              </div>
              <div class="card-price">
                <span class="price-label">{{ t('orders.labels.amount') }}</span>
                <span class="price">¥{{ order.amount.toFixed(2) }}</span>
              </div>
            </div>
            <!-- 订单操作按钮 -->
            <div class="card-actions">
              <button
                v-if="order.status === 'pending'"
                class="action-btn primary ripple-btn"
                @click.stop="(e) => { createRipple(e, e.currentTarget as HTMLElement); payOrder(order) }"
              >
                {{ t('orders.actions.pay') }}
              </button>
              <button
                v-if="order.status === 'pending'"
                class="action-btn ripple-btn"
                @click.stop="(e) => { createRipple(e, e.currentTarget as HTMLElement); cancelOrder(order) }"
              >
                {{ t('orders.actions.cancel') }}
              </button>
              <button
                v-if="order.status === 'paid'"
                class="action-btn primary ripple-btn"
                @click.stop="(e) => { createRipple(e, e.currentTarget as HTMLElement); confirmReceived(order) }"
              >
                {{ t('orders.actions.confirmReceived') }}
              </button>
              <button
                v-if="canRefund(order)"
                class="action-btn warning ripple-btn"
                @click.stop="(e) => { createRipple(e, e.currentTarget as HTMLElement); requestRefund(order) }"
              >
                {{ t('orders.actions.refund') }}
              </button>
              <button
                v-if="order.productId"
                class="action-btn ripple-btn"
                @click.stop="(e) => { createRipple(e, e.currentTarget as HTMLElement); viewProduct(order) }"
              >
                {{ t('orders.actions.viewProduct') }}
              </button>
              <button
                class="action-btn ripple-btn"
                @click.stop="(e) => { createRipple(e, e.currentTarget as HTMLElement); viewOrderDetail(order) }"
              >
                {{ t('orders.actions.detail') }}
              </button>
              <el-dropdown trigger="click" @command="(cmd: string) => handleOrderCommand(cmd, order)">
                <button class="action-btn more-btn ripple-btn" :aria-label="t('common.moreActions')" @click.stop>
                  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                    <circle cx="12" cy="5" r="2"></circle>
                    <circle cx="12" cy="12" r="2"></circle>
                    <circle cx="12" cy="19" r="2"></circle>
                  </svg>
                </button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="copyOrderId">{{ t('orders.actions.copyOrderId') }}</el-dropdown-item>
                    <el-dropdown-item v-if="order.productId" command="copyProductId">{{ t('orders.actions.copyProductId') }}</el-dropdown-item>
                    <el-dropdown-item command="copyOrderInfo">{{ t('orders.actions.copyOrderInfo') }}</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
        </div>

        <!-- 加载更多 -->
        <div v-if="hasMore && !loading" class="load-more">
          <button
            @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); loadMore() }"
            class="load-more-btn ripple-btn magnetic-btn"
            @mousemove="(e) => handleMagneticMove(e, e.currentTarget as HTMLElement)"
            @mouseleave="(e) => resetMagnetic(e.currentTarget as HTMLElement)"
          >
            <span class="btn-text">{{ t('common.loadMore') }}</span>
          </button>
        </div>

        <div v-if="!hasMore && filteredOrders.length > 0" class="no-more">
          <div class="no-more-line"></div>
          <span class="no-more-text">{{ t('orders.noMore') }}</span>
          <div class="no-more-line"></div>
        </div>
      </div>

      <!-- 订单详情弹窗 -->
      <Teleport to="body">
        <Transition name="modal-fade">
          <div v-if="showOrderDetail" class="order-detail-modal" @click="closeOrderDetail">
            <div class="modal-content glass" @click.stop>
              <div class="modal-header">
                <h3>{{ t('orders.detail.title') }}</h3>
                <button @click="closeOrderDetail" class="close-btn ripple-btn" :aria-label="t('common.close')">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              <div class="modal-body">
                <div v-if="selectedOrder" class="order-detail-content">
                  <div class="detail-section">
                    <h4>
                      <span class="section-icon">📋</span>
                      {{ t('orders.detail.orderInfo') }}
                    </h4>
                    <div class="detail-item">
                      <span class="label">{{ t('orders.labels.orderId') }}</span>
                      <span class="value mono">{{ selectedOrder.id }}</span>
                    </div>
                    <div class="detail-item">
                      <span class="label">{{ t('orders.labels.status') }}</span>
                      <span class="value status" :class="`status-${getStatusType(selectedOrder.status)}`">
                        {{ getStatusText(selectedOrder.status) }}
                      </span>
                    </div>
                    <div class="detail-item">
                      <span class="label">{{ t('orders.labels.createTime') }}</span>
                      <span class="value">{{ formatDate(selectedOrder.createTime) }}</span>
                    </div>
                    <div v-if="selectedOrder.payTime" class="detail-item">
                      <span class="label">{{ t('orders.labels.payTime') }}</span>
                      <span class="value">{{ formatDate(selectedOrder.payTime) }}</span>
                    </div>
                  </div>

                  <div class="detail-section">
                    <h4>
                      <span class="section-icon">📦</span>
                      {{ t('orders.detail.productInfo') }}
                    </h4>
                    <div class="detail-item">
                      <span class="label">{{ t('orders.labels.productName') }}</span>
                      <span class="value">{{ selectedOrder.productName }}</span>
                    </div>
                    <div class="detail-item">
                      <span class="label">{{ t('orders.labels.productType') }}</span>
                      <span class="value">{{ getProductType(selectedOrder.type) }}</span>
                    </div>
                  </div>

                  <div class="detail-section">
                    <h4>
                      <span class="section-icon">💳</span>
                      {{ t('orders.detail.paymentInfo') }}
                    </h4>
                    <div class="detail-item">
                      <span class="label">{{ t('orders.labels.paymentMethod') }}</span>
                      <span class="value">{{ getPaymentMethod(selectedOrder.paymentMethod) }}</span>
                    </div>
                    <div class="detail-item">
                      <span class="label">{{ t('orders.labels.amount') }}</span>
                      <span class="value amount">¥{{ selectedOrder.amount.toFixed(2) }}</span>
                    </div>
                    <div v-if="selectedOrder.expireTime" class="detail-item">
                      <span class="label">{{ t('orders.labels.expireTime') }}</span>
                      <span class="value">{{ formatDate(selectedOrder.expireTime) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Orders.vue - 订单管理页面 (Premium Industrial Edition)
 *
 * @description 高科技工业风格设计，玻璃态卡片，滚动入场动画
 */

import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { type Order } from '@/api/payment/orders'
import { v2Orders } from '@/api/v2-business'
import { ElMessageBox } from 'element-plus'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useMouseGlow } from '@/composables/useMouseGlow'
import { useApiError } from '@/composables/useApiError'
import { useDebounceSearch } from '@/composables/useDebounceSearch'
import { logger } from '@/utils/logger'
import { useCleanup } from '@/composables/useCleanup'

// ============ 高级动效系统 ============
// 滚动动画观察器
let scrollObserver: IntersectionObserver | null = null
const observedElements = ref<Set<Element>>(new Set())

const { isMouseInViewport } = useMouseGlow()

// 滚动进度
const scrollProgress = ref(0)

const cleanup = useCleanup()

// 初始化滚动动画观察器
const initScrollAnimations = () => {
  scrollObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement
          const delay = el.dataset.delay || '0'
          const animation = el.dataset.animation || 'fadeInUp'

          setTimeout(() => {
            el.classList.add('scroll-animated', `animate-${animation}`)
          }, parseInt(delay))

          observedElements.value.add(el)
        }
      })
    },
    {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    }
  )
  cleanup.add(() => scrollObserver?.disconnect())

  nextTick(() => {
    document.querySelectorAll('.scroll-reveal').forEach((el) => {
      if (!observedElements.value.has(el)) {
        scrollObserver?.observe(el)
      }
    })
  })
}

// 滚动进度计算
let scrollRafId: number | null = null
const handleScroll = () => {
  if (scrollRafId !== null) return
  scrollRafId = requestAnimationFrame(() => {
    scrollRafId = null
    const scrollTop = window.scrollY
    const docHeight = document.documentElement.scrollHeight - window.innerHeight
    scrollProgress.value = docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0

    document.documentElement.style.setProperty('--scroll-progress', `${scrollProgress.value}`)
  })
}
cleanup.add(() => { if (scrollRafId !== null) cancelAnimationFrame(scrollRafId) })

// 磁吸按钮效果
const handleMagneticMove = (e: MouseEvent, btnRef: HTMLElement | null) => {
  if (!btnRef) return

  const rect = btnRef.getBoundingClientRect()
  const x = e.clientX - rect.left - rect.width / 2
  const y = e.clientY - rect.top - rect.height / 2

  btnRef.style.transform = `translate(${x * 0.2}px, ${y * 0.2}px)`
}

const resetMagnetic = (btnRef: HTMLElement | null) => {
  if (!btnRef) return
  btnRef.style.transform = 'translate(0, 0)'
}

// 涟漪点击效果
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

// 统一工具 composables
const { handleResult, showSuccess, showError, showInfo } = useOperationFeedback()
const { confirm: showConfirm } = useConfirmDialog()
const router = useRouter()
const { t } = useI18n()
const { loading: apiLoading, error: _apiError, execute } = useApiError()

// 响应式数据
const activeTab = ref(0)
const orders = ref<Order[]>([])
const currentPage = ref(1)
const pageSize = ref(20)
const hasMore = ref(true)
const showOrderDetail = ref(false)
const selectedOrder = ref<Order | null>(null)
const loading = computed(() => apiLoading.value)
const loadError = ref<string | null>(null)

const retryLoad = () => {
  loadError.value = null
  loadOrders(true)
}

onMounted(() => {
  // 初始化高级动效系统
  initScrollAnimations()

  // 添加事件监听
  cleanup.addEventListener(window, 'scroll', handleScroll as EventListener, { passive: true })

  // 初始滚动进度计算
  handleScroll()
})

// 订单状态标签
const statusTabs = ref([
  { label: t('orders.tabs.all'), value: 'all', count: 0 },
  { label: t('orders.tabs.pending'), value: 'pending', count: 0 },
  { label: t('orders.tabs.shipping'), value: 'shipping', count: 0 },
  { label: t('orders.tabs.completed'), value: 'completed', count: 0 },
  { label: t('orders.tabs.cancelled'), value: 'cancelled', count: 0 },
  { label: t('orders.tabs.refunded'), value: 'refunded', count: 0 },
])

// 计算属性
const filteredOrders = computed(() => {
  let filtered = orders.value

  if (activeTab.value > 0) {
    const status = statusTabs.value[activeTab.value].value
    filtered = filtered.filter((order: Order) => {
      if (status === 'pending') return order.status === 'pending'
      if (status === 'shipping') return order.status === 'paid' || order.status === 'processing'
      if (status === 'completed') return order.status === 'completed'
      if (status === 'cancelled') return order.status === 'cancelled'
      if (status === 'refunded') return order.status === 'refunded'
      return true
    })
  }

  if (searchText.value) {
    const keyword = searchText.value.toLowerCase()
    filtered = filtered.filter(
      (order: Order) =>
        order.id.toLowerCase().includes(keyword) ||
        (order.productName || '').toLowerCase().includes(keyword)
    )
  }

  return filtered
})

// 搜索防抖
const { searchKeyword: searchText } = useDebounceSearch(
  (_keyword: string) => {
    if (currentPage.value !== 1) {
      currentPage.value = 1
    }
    loadOrders(true)
  },
  { delay: 300 }
)

// 方法
let loadDebounceTimer: { cancel: () => void; id: ReturnType<typeof setTimeout> } | null = null
let loadingGuard = false
const loadOrders = async (reset = false) => {
  if (loadingGuard) return
  loadingGuard = true
  loadError.value = null

  try {
    if (reset) {
      currentPage.value = 1
      orders.value = []
      hasMore.value = true
    }
    let apiStatus: string | undefined = undefined
    if (activeTab.value > 0) {
      const tabStatus = statusTabs.value[activeTab.value].value
      apiStatus = mapTabToApiStatus(tabStatus)
    }

    const result = await execute(
      () => v2Orders.list({
          page: currentPage.value,
          pageSize: pageSize.value,
          status: apiStatus,
        }) as any,
      {
        showMessage: false,
      }
    )

    if (result && typeof result === 'object' && 'list' in (result as object)) {
      const list = ((result as { list?: any[] }).list) || []
      const fetched = list.map((item: any) => transformApiOrder(item as Order | Record<string, unknown>))
      if (reset) {
        orders.value = fetched
      } else {
        orders.value.push(...fetched)
      }
      hasMore.value = fetched.length === pageSize.value
      updateStatusCounts()
    } else {
      if (reset) {
        orders.value = []
      }
      hasMore.value = false
      updateStatusCounts()
    }
  } catch (err: any) {
    loadError.value = err?.message || t('orders.messages.loadFailed')
    logger.error('Failed to load order list', err)
  } finally {
    loadingGuard = false
  }
}

const scheduleLoadOrders = (reset = false) => {
  if (loadDebounceTimer) {
    loadDebounceTimer.cancel()
  }
  loadDebounceTimer = cleanup.addCancellableTimer(() => {
    loadOrders(reset)
  }, 250)
}

const mapTabToApiStatus = (tabStatus: string): string | undefined => {
  // 视图状态到API状态的映射
  // 视图: pending|paid|cancelled|refunded
  // API: pending|processing|completed|failed|cancelled
  switch (tabStatus) {
    case 'pending':
      return 'pending'
    case 'paid':
      return 'completed'
    case 'cancelled':
      return 'cancelled'
    case 'refunded':
      return 'refunded' // 若后端返回其他表示，后续适配
    default:
      return undefined
  }
}

// transformApiOrder 函数：将 @/api/payment/orders 返回的 Order 转换为视图需要的 Order 格式
// 注意：@/api/payment/orders 返回的 Order 已经包含了视图需要的字段，这里只需要类型转换
const transformApiOrder = (o: Order | Record<string, unknown>): Order => {
  const order = o as Record<string, unknown>
  return {
    id: String(order.id || ''),
    orderNo: String(order.orderNo || order.id || ''),
    userId: String(order.userId || ''),
    type: mapOrderTypeToViewType(String(order.type || '')),
    productId: String(order.productId || ''),
    productName: order.productName
      ? String(order.productName)
      : order.description
        ? String(order.description)
        : t('orders.labels.productName'),
    amount: Number(order.amount || 0),
    originalAmount: Number(order.originalAmount || order.amount || 0),
    discount: Number(order.discount || 0),
    status: mapOrderStatusToViewStatus(String(order.status || '')),
    paymentMethod: (order.paymentMethod || 'balance') as 'wechat' | 'alipay' | 'balance',
    paymentId: order.paymentId ? String(order.paymentId) : undefined,
    createTime: String(order.createTime || new Date().toISOString()),
    updateTime: String(order.updateTime || order.createTime || new Date().toISOString()),
    completeTime: order.completeTime ? String(order.completeTime) : undefined,
    payTime: order.payTime
      ? String(order.payTime)
      : order.completeTime
        ? String(order.completeTime)
        : undefined,
    expireTime: order.expireTime
      ? String(order.expireTime)
      : new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
  }
}

// 映射订单类型到视图类型
const mapOrderTypeToViewType = (
  type: string | unknown
): 'product' | 'service' | 'subscription' | 'vip' | 'tokens' | 'tool' | 'agent' | 'recharge' | 'consumption' | 'refund' | 'withdraw' => {
  const t = String(type || '').toLowerCase()
  if (t.includes('vip') || t === 'recharge') return 'vip'
  if (t.includes('token') || t === 'consumption') return 'tokens'
  if (t.includes('tool')) return 'tool'
  if (t.includes('agent')) return 'agent'
  if (t === 'recharge') return 'recharge'
  if (t === 'consumption') return 'consumption'
  if (t === 'refund') return 'refund'
  if (t === 'withdraw') return 'withdraw'
  if (t === 'product') return 'product'
  if (t === 'service') return 'service'
  if (t === 'subscription') return 'subscription'
  return 'agent'
}

// 映射订单状态到视图状态
const mapOrderStatusToViewStatus = (
  status: string | unknown
): 'pending' | 'paid' | 'cancelled' | 'refunded' | 'processing' | 'completed' | 'failed' => {
  const s = String(status || '').toLowerCase()
  if (s === 'completed' || s === 'paid') return 'paid'
  if (s === 'cancelled') return 'cancelled'
  if (s === 'failed' || s === 'refunded') return 'refunded'
  if (s === 'processing') return 'processing'
  if (s === 'completed') return 'completed'
  if (s === 'failed') return 'failed'
  return 'pending'
}

const updateStatusCounts = () => {
  statusTabs.value[0].count = orders.value.length
  statusTabs.value[1].count = orders.value.filter((o: Order) => o.status === 'pending').length
  statusTabs.value[2].count = orders.value.filter((o: Order) => o.status === 'paid').length
  statusTabs.value[3].count = orders.value.filter((o: Order) => o.status === 'cancelled').length
  statusTabs.value[4].count = orders.value.filter((o: Order) => o.status === 'refunded').length
}

const switchTab = (index: number) => {
  activeTab.value = index
  scheduleLoadOrders(true)
}

// 添加timer类型声明
let searchTimer: { cancel: () => void; id: ReturnType<typeof setTimeout> } | null = null

const handleSearch = () => {
  // 防抖处理
  if (searchTimer) {
    searchTimer.cancel()
  }
  searchTimer = cleanup.addCancellableTimer(() => {
    scheduleLoadOrders(true)
  }, 500)
}

const clearSearch = () => {
  searchText.value = ''
  scheduleLoadOrders(true)
}

const loadMore = () => {
  if (hasMore.value && !loading.value) {
    currentPage.value++
    loadOrders()
  }
}

// 获取状态文本
const getStatusText = (status: string) => {
  const statusMap: { [key: string]: string } = {
    pending: t('orders.status.pending'),
    paid: t('orders.status.paid'),
    processing: t('orders.status.paid'),
    completed: t('orders.status.completed'),
    cancelled: t('orders.status.cancelled'),
    refunded: t('orders.status.refunded'),
  }
  return statusMap[status] || t('orders.status.pending')
}

// 获取状态类型
const getStatusType = (status: string) => {
  const typeMap: { [key: string]: string } = {
    pending: 'pending',
    paid: 'shipping',
    processing: 'shipping',
    completed: 'finished',
    cancelled: 'cancelled',
    refunded: 'refund',
  }
  return typeMap[status] || 'pending'
}

// 获取产品类型文本
const getProductType = (type: string) => {
  const typeMap: { [key: string]: string } = {
    vip: t('orders.productType.vip'),
    tokens: t('orders.productType.tokens'),
    tool: t('orders.productType.tool'),
    agent: t('orders.productType.agent'),
  }
  return typeMap[type] || t('orders.productType.unknown')
}

// 获取支付方式文本
const getPaymentMethod = (method: string) => {
  const methodMap: { [key: string]: string } = {
    wechat: t('orders.paymentMethod.wechat'),
    alipay: t('orders.paymentMethod.alipay'),
    balance: t('orders.paymentMethod.balance'),
  }
  return methodMap[method] || t('orders.paymentMethod.unknown')
}

const canRefund = (order: Order) => {
  return order.status === 'paid' && order.type !== 'tokens' // 使用次数类商品不支持退款
}

const formatDate = (timestamp: string) => {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// 订单操作方法
const payOrder = (order: Order) => {
  // 跳转到支付页面
  router.push({
    path: '/payment',
    query: {
      orderId: order.id,
      orderNo: order.orderNo,
      amount: String(order.amount),
      productName: order.productName || '',
    },
  } as { path: string; query: Record<string, string> })
}

const cancelOrder = async (order: Order) => {
  const confirmed = await showConfirm(
    t('orders.dialogs.cancel.confirm'),
    t('orders.dialogs.cancel.title'),
    { type: 'warning' }
  )

  if (!confirmed) return

  // 乐观更新
  const previousStatus = order.status
  order.status = 'cancelled'
  updateStatusCounts()

  // P14-1: 调 v2Orders.cancel 替换临时 fake Promise
  await handleResult(
    v2Orders.cancel(order.id) as any,
    {
      successMessage: t('orders.messages.cancelled'),
      errorMessage: t('orders.messages.cancelFailed'),
      onError: () => {
        // 回滚状态
        order.status = previousStatus
        updateStatusCounts()
      },
    }
  )
}

const confirmReceived = async (order: Order) => {
  const confirmed = await showConfirm(
    t('orders.dialogs.received.confirm'),
    t('orders.dialogs.received.title'),
    { type: 'info' }
  )

  if (!confirmed) return

  // 乐观更新
  const previousStatus = order.status
  order.status = 'paid'
  updateStatusCounts()

  // 调用真实确认收货接口，禁止使用假 Promise
  await handleResult(
    v2Orders.confirm(order.id) as any,
    {
      successMessage: t('orders.messages.received'),
      errorMessage: t('orders.messages.receiveFailed'),
      onError: () => {
        // 回滚状态
        order.status = previousStatus
        updateStatusCounts()
      },
    }
  )
}

const requestRefund = async (order: Order) => {
  if (!canRefund(order)) {
    showInfo(t('orders.messages.refundNotAvailable'))
    return
  }

  try {
    const { value: form } = await ElMessageBox.prompt(
      t('orders.refundReasonPlaceholder'),
      t('orders.applyRefund'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        inputType: 'textarea',
        inputPlaceholder: t('orders.refundReasonPlaceholder'),
        inputValidator: (value: string) => {
          if (!value || value.trim().length === 0) {
            return t('orders.refundReasonRequired')
          }
          if (value.trim().length < 5) {
            return t('orders.refundReasonMinLength')
          }
          return true
        },
      }
    )

    if (!form || !form.trim()) return

    const { applyRefund } = await import('@/api/payment/refund')
    const response = await applyRefund({
      orderNo: order.orderNo || order.id,
      reason: form.trim(),
      description: form.trim(),
    })

    if (response.success || response.code === 200) {
      showSuccess(t('orders.messages.refundApplied'))
      await loadOrders(true)
    } else {
      showError(response.message || t('orders.messages.refundApplyFailed'))
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      logger.error('Refund application failed:', error)
      showError(t('orders.messages.refundApplyFailed'))
    }
  }
}

const viewProduct = (order: Order) => {
  if (order.type === 'agent' && order.productId) {
    router.push(`/agents/${order.productId}`)
    return
  }
  if (order.type === 'tool' && order.productId) {
    router.push(`/agents/${order.productId}`)
    return
  }
  showSuccess(t('orders.messages.navigateNotSupported'))
}

const copyOrderId = async (order: Order) => {
  try {
    await navigator.clipboard.writeText(order.id)
    showSuccess(t('orders.messages.copyOrderIdSuccess'))
  } catch (_error) {
    showError(t('common.copyError'))
  }
}

const copyProductId = async (order: Order) => {
  if (!order.productId) return
  try {
    await navigator.clipboard.writeText(order.productId)
    showSuccess(t('orders.messages.copyProductIdSuccess'))
  } catch (_error) {
    showError(t('common.copyError'))
  }
}

const copyOrderInfo = async (order: Order) => {
  try {
    await navigator.clipboard.writeText(JSON.stringify(order))
    showSuccess(t('orders.messages.copyOrderInfoSuccess'))
  } catch (_error) {
    showError(t('common.copyError'))
  }
}

const viewOrderDetail = (order: Order) => {
  selectedOrder.value = order
  showOrderDetail.value = true
}

// 处理下拉菜单命令
const handleOrderCommand = async (command: string, order: Order) => {
  switch (command) {
    case 'copyOrderId':
      await copyOrderId(order)
      break
    case 'copyProductId':
      await copyProductId(order)
      break
    case 'copyOrderInfo':
      await copyOrderInfo(order)
      break
  }
}

const closeOrderDetail = () => {
  showOrderDetail.value = false
  selectedOrder.value = null
}

const goToShop = () => {
  // 跳转到首页的工具区域，或AI模型页面
  router.push('/') // AI模型选择已集成到首页对话框内
}

// 生命周期
onMounted(() => {
  loadOrders(true)
})

// 监听器
watch(activeTab, () => {
  scheduleLoadOrders(true)
})

// 订单加载后重新初始化动画
watch(orders, () => {
  nextTick(() => {
    document.querySelectorAll('.scroll-reveal:not(.scroll-animated)').forEach((el) => {
      if (!observedElements.value.has(el)) {
        scrollObserver?.observe(el)
      }
    })
  })
}, { deep: true })
</script>

<style scoped lang="scss">
@use '@/styles/breakpoints' as bp;

// ============ 设计变量 ============
$bg-page: var(--el-bg-color-page);
$text-main: var(--el-text-color-primary);
$text-sec: var(--el-text-color-secondary);
$border-light: var(--el-border-color-lighter);
$brand-primary: var(--el-text-color-primary);
$brand-secondary: var(--el-text-color-primary);

// ============ 根容器 ============
.orders-root {
  background: $bg-page;
  color: $text-main;
  min-height: 100vh;
  position: relative;
  overflow-x: hidden;
  font-family: var(--font-family-chinese);
  padding-top: 80px;

  &.mouse-active .mouse-glow-effect {
    opacity: 0;
  }
}

// ============ 深度背景系统 ============
.orders-bg-system {
  position: fixed;
  inset: 0;
  z-index: var(--z-0);
  pointer-events: none;

  .bg-glow-orb {
    position: absolute;
    border-radius: var(--global-border-radius);
    filter: blur(80px);
    opacity: 0.1;
    animation: floatOrb 15s ease-in-out infinite;

    &.orb-1 {
      width: 300px;
      height: 300px;
      top: 10%;
      right: 10%;
      background: color-mix(in srgb, var(--el-color-primary) 15%, transparent);
    }

    &.orb-2 {
      width: 250px;
      height: 250px;
      bottom: 20%;
      left: 5%;
      background: color-mix(in srgb, var(--el-color-primary) 15%, transparent);
      animation-delay: -7s;
    }
  }

  .mouse-glow-effect {
    position: absolute;
    left: 0;
    top: 0;
    width: 500px;
    height: 500px;
    border-radius: var(--global-border-radius);
    background: color-mix(in srgb, var(--el-color-primary) 11%, transparent);
    opacity: 0;
    pointer-events: none;
  }
}

// ============ 容器 ============
.page-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 40px 80px;
  position: relative;
  z-index: var(--z-base);
}

// ============ 页面头部 ============
.page-header {
  text-align: center;
  margin-bottom: 48px;
  padding-top: 40px;

  .header-badge {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 8px 20px;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 0.05em;
    margin-bottom: 16px;
    background: var(--color-white-50);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);

    .status-dot {
      width: 6px;
      height: 6px;
      background: $brand-primary;
      border-radius: var(--global-border-radius);
      animation: pulse 2s infinite;
    }
  }

  .page-title {
    font-size: clamp(32px, 4vw, 48px);
    font-weight: 800;
    letter-spacing: -0.03em;
    margin: 0 0 12px;
  }

  .page-subtitle {
    font-size: 16px;
    color: $text-sec;
    margin: 0;
  }
}

// ============ 搜索栏 ============
.search-section {
  margin-bottom: 24px;
  padding: 6px;
  border-radius: var(--global-border-radius);
}

.search-bar {
  position: relative;
  display: flex;
  align-items: center;
  padding: 16px 24px;
  background: var(--color-white-60);
  border-radius: var(--global-border-radius);
  transition: background-color 0.3s ease;

  &:focus-within {
    background: var(--color-white-90);
    }
}

.search-icon {
  width: 20px;
  height: 20px;
  color: $text-sec;
  margin-right: 12px;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 15px;
  background: transparent;
  color: $text-main;

  &::placeholder {
    color: $text-sec;
  }
}

.clear-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--el-text-color-primary) 5%, transparent);
  border: none;
  border-radius: var(--global-border-radius);
  cursor: pointer;
  color: $text-sec;
  transition: background-color 0.2s, color 0.2s;

  &:hover {
    background: color-mix(in srgb, var(--el-text-color-primary) 10%, transparent);
    color: $text-main;
  }

  svg {
    width: 16px;
    height: 16px;
  }
}

// ============ 筛选标签 ============
.filter-tabs {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-bottom: 32px;
  flex-wrap: wrap;
}

.tab-btn {
  position: relative;
  overflow: hidden;
  padding: 12px 24px;
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
  background: var(--color-white-60);
  color: $text-sec;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), color 0.3s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  Backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);

  &:hover {
    background: var(--color-white-90);
    border-color: color-mix(in srgb, var(--el-text-color-primary) 20%, transparent);
    
    }

  &.active {
    background: $brand-primary;
    color: var(--el-bg-color);
    border-color: $brand-primary;
    .tab-count {
      background: var(--color-white-20);
      color: var(--el-bg-color);
    }
  }
}

.tab-count {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 8px;
  font-size: 12px;
  font-weight: 800;
  background: color-mix(in srgb, var(--el-text-color-primary) 10%, transparent);
  color: $brand-primary;
  border-radius: var(--global-border-radius);
  min-width: 24px;
  text-align: center;
}

// ============ 订单容器 ============
.orders-container {
  width: 100%;
}

// ============ 加载状态 ============
.loading-state {
  text-align: center;
  padding: 60px 20px;
}

.loading-spinner {
  width: 60px;
  height: 60px;
  margin: 0 auto 24px;
  position: relative;

  .spinner-ring {
    position: absolute;
    inset: 0;
    border: 2px solid transparent;
    border-top-color: $brand-primary;
    border-radius: var(--global-border-radius);
    animation: spin 1s linear infinite;

    &:nth-child(2) {
      inset: 6px;
      animation-duration: 1.5s;
      animation-direction: reverse;
      border-top-color: $brand-secondary;
    }

    &:nth-child(3) {
      inset: 12px;
      animation-duration: 2s;
      border-top-color: var(--el-text-color-secondary);
    }
  }
}

.skeleton-order-card {
  height: 180px;
  margin-bottom: 16px;
  border-radius: var(--global-border-radius);
}

// ============ 空状态 ============
.empty-state {
  text-align: center;
  padding: 80px 40px;
  border-radius: var(--global-border-radius);

  .empty-icon-wrapper {
    width: 100px;
    height: 100px;
    margin: 0 auto 24px;
    background: color-mix(in srgb, var(--el-text-color-primary) 5%, transparent);
    border-radius: var(--global-border-radius);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .empty-icon {
    width: 48px;
    height: 48px;
    color: $text-sec;
  }

  h3 {
    font-size: 24px;
    font-weight: 900;
    margin: 0 0 12px;
  }

  p {
    font-size: 15px;
    color: $text-sec;
    margin: 0 0 32px;
  }
}

.go-shop-btn {
  position: relative;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 56px;
  padding: 0 40px;
  background: $brand-primary;
  color: var(--el-bg-color);
  border: none;
  border-radius: var(--global-border-radius);
  font-size: 15px;
  font-weight: 800;
  cursor: pointer;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  .btn-text {
    position: relative;
    z-index: calc(var(--z-base) + 1);
  }

  // 扫光效果已移至全局样式 (styles/index.scss)

  &:hover {
    
    }
}

.retry-btn {
  position: relative;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 48px;
  padding: 0 32px;
  background: transparent;
  color: $brand-primary;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), color 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  .btn-text {
    position: relative;
    z-index: calc(var(--z-base) + 1);
  }

  &:hover {
    background: $brand-primary;
    color: var(--el-bg-color);
    
  }
}

.error-state {
  text-align: center;
  padding: 60px 40px;
  border-radius: var(--global-border-radius);

  .error-icon-wrapper {
    width: 80px;
    height: 80px;
    margin: 0 auto 20px;
    background: color-mix(in srgb, var(--el-text-color-primary) 5%, transparent);
    border-radius: var(--global-border-radius);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .error-icon {
    width: 40px;
    height: 40px;
    color: $brand-primary;
  }

  h3 {
    font-size: 20px;
    font-weight: 800;
    margin: 0 0 8px;
  }

  p {
    font-size: 14px;
    color: $text-sec;
    margin: 0 0 24px;
    max-width: 400px;
    margin-left: auto;
    margin-right: auto;
  }
}

// ============ 订单列表 ============
.orders-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

// ============ 订单卡片 ============
.order-card {
  position: relative;
  padding: 28px;
  border-radius: var(--global-border-radius);
  background: var(--color-white-70);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: var(--unified-border);
  transition: border-color 0.2s ease;

  &:hover {
    border: var(--el-border-width-primary) solid var(--el-color-primary);
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  position: relative;
  z-index: var(--z-base);
}

.order-no {
  display: flex;
  flex-direction: column;
  gap: 4px;

  .order-label {
    font-size: 12px;
    font-weight: 700;
    color: $text-sec;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .order-id {
    font-size: 14px;
    font-weight: 800;
    font-family: var(--font-family-mono);
    color: $text-main;
  }
}

// ============ 订单状态标签优化 ============
.order-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: var(--global-border-radius);
  font-size: 13px;
  font-weight: 800;
  transition: background-color 0.3s, color 0.3s;

  .status-dot-sm {
    width: 6px;
    height: 6px;
    border-radius: var(--global-border-radius);
    background: currentcolor;
    animation: pulse 2s infinite;
  }
}

.status-pending {
  background: var(--el-color-warning);
  color: var(--el-bg-color);
  }

.status-shipping {
  background: $brand-primary;
  color: var(--el-bg-color);
  }

.status-finished {
  background: var(--el-text-color-primary);
  color: var(--el-bg-color);
  }

.status-cancelled {
  background: var(--el-text-color-placeholder);
  color: var(--el-bg-color);
  }

.status-refund {
  background: var(--el-text-color-primary);
  color: var(--el-bg-color);
  }

.card-body {
  display: flex;
  align-items: center;
  gap: 20px;
  position: relative;
  z-index: var(--z-base);
}

.card-img {
  width: 80px;
  height: 80px;
  border-radius: var(--global-border-radius);
  background: color-mix(in srgb, var(--el-text-color-primary) 3%, transparent);
  border: var(--unified-border);
  flex-shrink: 0;
  overflow: hidden;

  .img-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;

    svg {
      width: 32px;
      height: 32px;
      color: $text-sec;
      opacity: 0.5;
    }
  }
}

.card-info {
  flex: 1;
  min-width: 0;
}

.card-title {
  font-size: 18px;
  font-weight: 900;
  color: $text-main;
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-desc {
  font-size: 14px;
  color: $text-sec;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-bottom-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-top: 24px;
  padding-top: 20px;
  border-top: var(--unified-border);
  position: relative;
  z-index: var(--z-base);
}

.card-time {
  .time-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .time-label {
    font-size: 12px;
    font-weight: 700;
    color: $text-sec;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .time-value {
    font-size: 14px;
    font-weight: 700;
    color: $text-main;
  }
}

.card-price {
  text-align: right;

  .price-label {
    display: block;
    font-size: 12px;
    font-weight: 700;
    color: $text-sec;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 4px;
  }

  .price {
    font-size: 24px;
    font-weight: 800;
    color: $brand-primary;
    letter-spacing: -0.02em;
  }
}

// ============ 操作按钮 ============
.card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: var(--unified-border);
  position: relative;
  z-index: var(--z-base);
}

.action-btn {
  position: relative;
  overflow: hidden;
  padding: 10px 20px;
  font-size: 13px;
  font-weight: 800;
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
  background: var(--color-white-80);
  color: $text-sec;
  cursor: pointer;
  transition: background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), color 0.3s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;

  &:hover {
    background: color-mix(in srgb, var(--el-text-color-primary) 5%, transparent);
    border-color: color-mix(in srgb, var(--el-text-color-primary) 20%, transparent);
    color: $brand-primary;
    
  }

  &.primary {
    background: $brand-primary;
    color: var(--el-bg-color);
    border-color: $brand-primary;

    &:hover {
      background: $brand-secondary;
      border-color: $brand-secondary;
      }
  }

  &.warning {
    background: var(--el-color-warning);
    color: var(--el-bg-color);
    border-color: transparent;
  }

  &.more-btn {
    padding: 10px;
    min-width: auto;
  }
}

// ============ 加载更多 ============
.load-more {
  text-align: center;
  margin-top: 40px;
}

.load-more-btn {
  position: relative;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 52px;
  padding: 0 40px;
  background: color-mix(in srgb, var(--el-text-color-primary) 5%, transparent);
  color: $brand-primary;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  transition: background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), color 0.3s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    background: $brand-primary;
    color: var(--el-bg-color);
    border-color: $brand-primary;
    
    }
}

.no-more {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 40px;
  gap: 16px;
}

.no-more-line {
  flex: 1;
  max-width: 100px;
  height: 1px;
  background: $border-light;
}

.no-more-text {
  font-size: 13px;
  font-weight: 700;
  color: $text-sec;
}

// ============ 弹窗样式 ============
.order-detail-modal {
  position: fixed;
  inset: 0;
  background: var(--color-black-60);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  padding: 24px;
}

.modal-content {
  width: 100%;
  max-width: 560px;
  max-height: 85vh;
  overflow-y: auto;
  border-radius: var(--global-border-radius);
  background: var(--color-white-95);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: var(--unified-border);
  }

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 28px 32px;
  border-bottom: var(--unified-border-bottom);

  h3 {
    font-size: 22px;
    font-weight: 900;
    margin: 0;
  }
}

.close-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--el-text-color-primary) 5%, transparent);
  border: none;
  border-radius: var(--global-border-radius);
  cursor: pointer;
  color: $text-sec;
  transition: background-color 0.2s, color 0.2s;

  &:hover {
    background: color-mix(in srgb, var(--el-text-color-primary) 10%, transparent);
    color: $text-main;
  }

  svg {
    width: 18px;
    height: 18px;
  }
}

.modal-body {
  padding: 32px;
}

.detail-section {
  margin-bottom: 32px;

  &:last-child {
    margin-bottom: 0;
  }

  h4 {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 16px;
    font-weight: 900;
    color: $text-main;
    margin: 0 0 20px;
    padding-bottom: 12px;
    border-bottom: 2px solid var(--border-unified-color);

    .section-icon {
      font-size: 18px;
    }
  }
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 0;
  border-bottom: var(--unified-border-bottom);

  &:last-child {
    border-bottom: none;
  }

  .label {
    font-size: 14px;
    font-weight: 700;
    color: $text-sec;
  }

  .value {
    font-size: 14px;
    font-weight: 800;
    color: $text-main;

    &.mono {
      font-family: var(--font-family-mono);
    }

    &.amount {
      font-size: 20px;
      font-weight: 800;
      color: $brand-primary;
    }

    &.status {
      padding: 6px 14px;
      border-radius: var(--global-border-radius);
      font-size: 12px;
    }
  }
}

// ============ 玻璃态效果 ============
.glass {
  background: var(--color-white-60);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: var(--unified-border);
}

.glass-card {
  background: var(--color-white-70);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: var(--unified-border);
}

// ============ 滚动动画系统 ============
.scroll-reveal {
  opacity: 0;
  transform: translateY(30px);
  transition: none;

  &.scroll-animated {
    transition: opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1), transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  }

  &.animate-fadeInUp {
    opacity: 1;
    transform: translateY(0);
  }

  &.animate-fadeInLeft {
    opacity: 1;
    transform: translateX(0);
  }
}

.scroll-reveal[data-animation="fadeInLeft"] {
  transform: translateX(-30px);
}

// ============ 涟漪效果 ============
.ripple-btn {
  position: relative;
  overflow: hidden;
}

// ============ 磁吸按钮 ============
.magnetic-btn {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

// ============ 关键帧动画 ============
@keyframes gridMove {
  0% { transform: translate(0, 0); }
  100% { transform: translate(60px, 60px); }
}

@keyframes floatOrb {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(30px, -20px) scale(1.05); }
  50% { transform: translate(-20px, 30px) scale(0.95); }
  75% { transform: translate(-30px, -10px) scale(1.02); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes rippleExpand {
  0% {
    transform: scale(0);
    opacity: 0.6;
  }

  100% {
    transform: scale(4);
    opacity: 0;
  }
}

@keyframes borderGlow {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

// ============ 弹窗过渡动画 ============
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1);

  .modal-content {
    transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  }
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;

  .modal-content {
    transform: scale(0.95) translateY(20px);
    opacity: 0;
  }
}

// ============ 响应式设计 ============
@include bp.mobile-only {
  .page-container {
    padding: 0 20px 60px;
  }

  .page-header {
    padding-top: 24px;
    margin-bottom: 32px;

    .header-badge {
      padding: 6px 14px;
      font-size: 12px;
    }
  }

  .filter-tabs {
    gap: 8px;
    overflow-x: auto;
    flex-wrap: nowrap;
    justify-content: flex-start;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;

    .tab-btn {
      padding: 10px 16px;
      font-size: 13px;
      min-height: 44px;
      flex-shrink: 0;
    }
  }

  .order-card {
    padding: 20px;
    border-radius: var(--global-border-radius);
  }

  .card-body {
    flex-direction: column;
    align-items: flex-start;
  }

  .card-img {
    width: 100%;
    height: 120px;
    border-radius: var(--global-border-radius);
  }

  .card-bottom-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .card-price {
    text-align: left;
  }

  .card-actions {
    gap: 8px;

    .action-btn {
      padding: 8px 14px;
      font-size: 12px;
    }
  }

  .modal-content {
    max-width: 100%;
    margin: 0 16px;
    border-radius: var(--global-border-radius);
  }

  .modal-header {
    padding: 20px 24px;
  }

  .modal-body {
    padding: 24px;
  }
}
</style>

