<template>
  <div class="order-detail">
    <!-- ① 页面头 -->
    <header class="page-header">
      <div class="header-text">
        <h1 class="page-title">{{ t('edu.order.detailTitle') }}</h1>
        <p class="page-subtitle">{{ t('edu.order.detailSubtitle') }}</p>
      </div>
      <div class="header-actions">
        <el-button :icon="ArrowLeft" @click="goBack">
          {{ t('edu.profile.back') || t('edu.live.leaveLive') }}
        </el-button>
        <el-button :icon="Refresh" :loading="loading" @click="loadOrder">
          {{ t('edu.profile.retry') }}
        </el-button>
      </div>
    </header>

    <el-alert
      v-if="error"
      type="error"
      :title="t('edu.profile.loadFailed')"
      show-icon
      :closable="false"
      class="error-alert"
    />

    <!-- ② 订单信息卡 -->
    <div v-loading="loading" class="detail-body">
      <section v-if="order" class="info-card">
        <div class="info-header">
          <span class="info-order-no">{{ order.order_no }}</span>
          <el-tag :type="statusTagType(order.status)" effect="light" size="default">
            {{ statusLabel(order.status) }}
          </el-tag>
        </div>

        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">{{ t('edu.order.orderNo') }}</span>
            <span class="info-value">{{ order.order_no }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ t('edu.order.orderType') }}</span>
            <span class="info-value">{{ orderTypeLabel(order.order_type) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ t('edu.order.totalAmount') }}</span>
            <span class="info-value">¥{{ formatAmount(order.total_amount) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ t('edu.order.paidAmount') }}</span>
            <span class="info-value highlight">¥{{ formatAmount(order.paid_amount) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ t('edu.order.discountAmount') }}</span>
            <span class="info-value">¥{{ formatAmount(order.discount_amount) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ t('edu.order.status') }}</span>
            <el-tag :type="statusTagType(order.status)" effect="light" size="small">
              {{ statusLabel(order.status) }}
            </el-tag>
          </div>
          <div class="info-item">
            <span class="info-label">{{ t('edu.order.payMethod') }}</span>
            <span class="info-value">{{ order.pay_method || '-' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ t('edu.order.paidAt') }}</span>
            <span class="info-value">{{ formatTime(order.paid_at) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ t('edu.order.createdAt') }}</span>
            <span class="info-value">{{ formatTime(order.created_at) }}</span>
          </div>
        </div>
      </section>

      <el-empty
        v-else-if="!loading"
        :description="t('edu.order.empty')"
        class="empty-state"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ArrowLeft, Refresh } from '@element-plus/icons-vue'
import { orderApi } from '@/api/edu'
import type { EduOrder } from '@/api/edu'

const props = defineProps<{ orderId?: string }>()

const { t } = useI18n()
const router = useRouter()

const loading = ref(false)
const error = ref(false)
const order = ref<EduOrder | null>(null)

function resolveOrderId(): number {
  const raw = props.orderId
  if (!raw) return 0
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

async function loadOrder() {
  const id = resolveOrderId()
  if (!id) {
    error.value = true
    return
  }
  loading.value = true
  error.value = false
  try {
    const res = await orderApi.getOrder(id)
    order.value = res.data?.data ?? null
  } catch (e) {
    error.value = true
    order.value = null
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.back()
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: t('edu.order.statusPending'),
    paid: t('edu.order.statusPaid'),
    cancelled: t('edu.order.statusCancelled'),
    refunded: t('edu.order.statusRefunded'),
  }
  return map[status] || status
}

function statusTagType(status: string): 'danger' | 'info' | 'success' | 'warning' {
  switch (status) {
    case 'pending':
      return 'warning'
    case 'paid':
      return 'success'
    case 'cancelled':
      return 'info'
    case 'refunded':
      return 'danger'
    default:
      return 'info'
  }
}

function orderTypeLabel(orderType: string): string {
  const map: Record<string, string> = {
    course: t('edu.order.orderTypeCourse'),
    exam: t('edu.order.orderTypeExam'),
    member: t('edu.order.orderTypeMember'),
  }
  return map[orderType] || orderType
}

function formatAmount(value: number): string {
  if (value == null) return '0.00'
  return Number(value).toFixed(2)
}

function formatTime(value?: string): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

onMounted(loadOrder)
</script>

<style scoped lang="scss">
.order-detail {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.header-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.page-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.page-subtitle {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.header-actions {
  display: flex;
  gap: 8px;
}

.error-alert {
  margin: 0;
}

.detail-body {
  min-height: 200px;
}

.info-card {
  padding: 24px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
}

.info-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 16px;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.info-order-no {
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  font-variant-numeric: tabular-nums;
  word-break: break-all;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 20px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.info-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.info-value {
  font-size: 14px;
  color: var(--el-text-color-primary);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  word-break: break-all;
}

.info-value.highlight {
  color: var(--el-color-danger);
  font-size: 16px;
  font-weight: 700;
}

.empty-state {
  padding: 60px 0;
}

/* 禁止蓝光边框 */
:deep(.el-button:focus-visible) {
  outline: none;
  box-shadow: none;
}

@media (max-width: 640px) {
  .page-header {
    flex-direction: column;
    align-items: stretch;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }
}
</style>
