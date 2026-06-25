<template>
  <div class="user-purchase-records">
    <h3 class="section-title">{{ t('userComponents.purchaseRecords.title') }}</h3>
    <div class="records-list">
      <div v-for="record in records" :key="record.id" class="record-item">
        <div class="record-header">
          <span class="record-no">{{ t('userComponents.purchaseRecords.orderNo') }}: {{ record.orderNo }}</span>
          <span class="record-status" :class="record.status">{{ formatStatus(record.status) }}</span>
        </div>
        <div class="record-content">
          <div class="product-info">
            <h4 class="product-name">{{ record.productName }}</h4>
            <p v-if="record.description" class="product-desc">{{ record.description }}</p>
          </div>
          <div class="record-amount">
            <span class="amount">¥{{ record.amount }}</span>
          </div>
        </div>
        <div class="record-footer">
          <span class="record-time">{{ formatTime(record.purchaseTime) }}</span>
          <div class="record-actions">
            <el-button type="primary" link @click="handleView(record)">{{ t('userComponents.purchaseRecords.viewDetails') }}</el-button>
            <el-button v-if="record.invoiceAvailable" type="success" link @click="handleInvoice(record.id)">{{ t('userComponents.purchaseRecords.applyInvoice') }}</el-button>
          </div>
        </div>
      </div>
      <div v-if="records.length === 0" class="empty-state">
        <el-icon :size="48"><Document /></el-icon>
        <p>{{ t('userComponents.purchaseRecords.empty') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Document } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { formatTime as _formatTime } from '@/utils/format'

const { t } = useI18n()

interface PurchaseRecord {
  id: string
  orderNo: string
  productName: string
  description?: string
  amount: number
  status: 'completed' | 'pending' | 'refunded'
  purchaseTime: string
  invoiceAvailable?: boolean
}

const _props = defineProps<{
  records?: PurchaseRecord[]
}>()

const emit = defineEmits<{
  (e: 'view', record: PurchaseRecord): void
  (e: 'invoice', id: string): void
}>()

const formatStatus = (status: string) => {
  const statusMap: Record<string, string> = {
    completed: t('userComponents.purchaseRecords.status.completed'),
    pending: t('userComponents.purchaseRecords.status.pending'),
    refunded: t('userComponents.purchaseRecords.status.refunded'),
  }
  return statusMap[status] || status
}

const formatTime = (time: string) => _formatTime(time, 'YYYY-MM-DD')

const handleView = (record: PurchaseRecord) => {
  emit('view', record)
}

const handleInvoice = (id: string) => {
  emit('invoice', id)
}
</script>

<style scoped>
.user-purchase-records {
  background: var(--bg-card);
  border-radius: var(--global-border-radius);
  padding: 24px;
  }

.section-title {
  margin: 0 0 20px;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.records-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.record-item {
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: var(--global-border-radius);
  transition: background 0.2s;
}

.record-item:hover {
  background: var(--bg-hover);
}

.record-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: var(--unified-border-bottom);
}

.record-no {
  font-size: 14px;
  color: var(--text-secondary);
}

.record-status {
  padding: 4px 12px;
  font-size: 12px;
  border-radius: var(--global-border-radius);
}

.record-status.completed {
  background: var(--success-light);
  color: var(--success-color);
}

.record-status.pending {
  background: var(--warning-light);
  color: var(--warning-color);
}

.record-status.refunded {
  background: var(--info-light);
  color: var(--info-color);
}

.record-content {
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

.record-amount {
  flex-shrink: 0;
  margin-left: 16px;
}

.amount {
  font-size: 18px;
  font-weight: 600;
  color: var(--danger-color);
}

.record-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.record-time {
  font-size: 12px;
  color: var(--text-secondary);
}

.record-actions {
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
