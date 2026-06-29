<template>
  <div class="user-orders">
    <h3 class="section-title">{{ t('userComponents.orders.title') }}</h3>
    <div class="orders-list">
      <div v-for="order in orders" :key="order.id" class="order-item">
        <div class="order-header">
          <span class="order-no">{{ t('userComponents.orders.orderNo') }}: {{ order.orderNo }}</span>
          <span class="order-status" :class="order.status">{{ formatStatus(order.status) }}</span>
        </div>
        <div class="order-content">
          <div class="product-info">
            <h4 class="product-name">{{ order.productName }}</h4>
            <p v-if="order.description" class="product-desc">{{ order.description }}</p>
          </div>
          <div class="order-amount">
            <span class="amount">¥{{ order.amount }}</span>
          </div>
        </div>
        <div class="order-footer">
          <span class="order-time">{{ formatTime(order.createTime) }}</span>
          <div class="order-actions">
            <el-button type="primary" link @click="handleView(order)">{{ t('userComponents.orders.viewDetails') }}</el-button>
            <el-button v-if="order.status === 'pending'" type="warning" link @click="handlePay(order.id)">{{ t('userComponents.orders.payNow') }}</el-button>
          </div>
        </div>
      </div>
      <div v-if="orders.length === 0" class="empty-state">
        <el-icon :size="48"><ShoppingCart /></el-icon>
        <p>{{ t('userComponents.orders.empty') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ShoppingCart } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { formatTime as _formatTime } from '@/utils/format'

const { t } = useI18n()

interface Order {
  id: string
  orderNo: string
  productName: string
  description?: string
  amount: number
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled' | 'refunded'
  createTime: string
}

const _props = defineProps<{
  orders?: Order[]
}>()

const emit = defineEmits<{
  (e: 'view', order: Order): void
  (e: 'pay', id: string): void
}>()

const formatStatus = (status: string) => {
  const statusMap: Record<string, string> = {
    pending: t('commonText.status.pending'),
    paid: t('commonText.status.completed'),
    shipped: t('commonText.status.processing'),
    delivered: t('commonText.status.completed'),
    cancelled: t('commonText.status.cancelled'),
    refunded: t('commonText.status.refunded'),
  }
  return statusMap[status] || status
}

const formatTime = (time: string) => _formatTime(time, 'YYYY-MM-DD')

const handleView = (order: Order) => {
  emit('view', order)
}

const handlePay = (id: string) => {
  emit('pay', id)
}
</script>

<style scoped>
.user-orders {
  background: var(--bg-card);
  border-radius: var(--global-border-radius);
  padding: 24px;
  box-shadow: var(--global-box-shadow);
}

.section-title {
  margin: 0 0 20px;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.orders-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.order-item {
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: var(--global-border-radius);
  transition: background 0.2s;
}

.order-item:hover {
  background: var(--bg-hover);
}

.order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: var(--unified-border-bottom);
}

.order-no {
  font-size: 14px;
  color: var(--text-secondary);
}

.order-status {
  padding: 4px 12px;
  font-size: 12px;
  border-radius: var(--global-border-radius);
}

.order-status.pending {
  background: var(--warning-light);
  color: var(--warning-color);
}

.order-status.paid,
.order-status.delivered {
  background: var(--success-light);
  color: var(--success-color);
}

.order-status.shipped {
  background: var(--primary-light);
  color: var(--primary-color);
}

.order-status.cancelled,
.order-status.refunded {
  background: var(--info-light);
  color: var(--info-color);
}

.order-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.product-info {
  flex: 1;
  min-width: 0;
}

.product-name {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.product-desc {
  margin: 0;
  font-size: 14px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-amount {
  flex-shrink: 0;
  margin-left: 16px;
}

.amount {
  font-size: 18px;
  font-weight: 600;
  color: var(--danger-color);
}

.order-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.order-time {
  font-size: 12px;
  color: var(--text-secondary);
}

.order-actions {
  display: flex;
  gap: 8px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
  color: var(--text-secondary);
}

.empty-state .el-icon {
  margin-bottom: 16px;
  color: var(--text-secondary);
}

.empty-state p {
  margin: 0;
  font-size: 14px;
}
</style>
