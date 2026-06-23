<template>
  <div class="refund-detail-page page-container">
    <div class="page-header">
      <div class="back-action" @click="goBack">
        <span class="back-icon">←</span>
        <span class="back-text">{{ t('refundDetail.backToList') }}</span>
      </div>
      <h1 class="page-title">{{ t('refundDetail.title') }}</h1>
      <p class="page-subtitle">{{ t('refundDetail.refundNo') }}: {{ refundNo }}</p>
    </div>

    <el-card v-loading="loading" class="detail-card" :shadow="false">
      <div v-if="loadError" class="error-state">
        <div class="error-icon">⚠</div>
        <p>{{ loadError }}</p>
        <el-button type="primary" size="small" @click="loadDetail">{{ t('common.retry') }}</el-button>
      </div>

      <RefundStatus
        v-else-if="refund"
        :status="refund.status"
        :timeline="refund.timeline || []"
        :evidence="refund.evidence || []"
        :reason="refund.reason"
        @cancel="handleCancel"
      />
    </el-card>

    <el-card v-if="refund && canUploadEvidence" class="upload-card" :shadow="false">
      <template #header>
        <span>{{ t('refundDetail.supplementEvidence') }}</span>
      </template>
      <EvidenceUploader
        v-model="evidenceList"
        :refund-id="refund.id"
        @uploaded="onEvidenceUploaded"
      />
    </el-card>

    <el-card v-if="refund" class="info-card" :shadow="false">
      <template #header>
        <span>{{ t('refundDetail.refundInfo') }}</span>
      </template>
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">{{ t('refundDetail.refundNo') }}</span>
          <span class="info-value">{{ refund.id }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">{{ t('refundDetail.originalOrderNo') }}</span>
          <span class="info-value">{{ refund.order_no }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">{{ t('refundDetail.refundAmount') }}</span>
          <span class="info-value amount">¥{{ formatAmount(refund.amount) }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">{{ t('refundDetail.refundReason') }}</span>
          <span class="info-value">{{ refund.reason }}</span>
        </div>
        <div v-if="refund.description" class="info-item full">
          <span class="info-label">{{ t('refundDetail.refundDescription') }}</span>
          <span class="info-value">{{ refund.description }}</span>
        </div>
        <div v-if="refund.reject_reason" class="info-item full">
          <span class="info-label">{{ t('refundDetail.rejectReason') }}</span>
          <span class="info-value reject">{{ refund.reject_reason }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">{{ t('refundDetail.applyTime') }}</span>
          <span class="info-value">{{ formatTime(refund.created_at) }}</span>
        </div>
        <div v-if="refund.approved_at" class="info-item">
          <span class="info-label">{{ t('refundDetail.approveTime') }}</span>
          <span class="info-value">{{ formatTime(refund.approved_at) }}</span>
        </div>
        <div v-if="refund.completed_at" class="info-item">
          <span class="info-label">{{ t('refundDetail.completeTime') }}</span>
          <span class="info-value">{{ formatTime(refund.completed_at) }}</span>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import RefundStatus from '@/components/RefundStatus.vue'
import EvidenceUploader from '@/components/EvidenceUploader.vue'
import { useToast } from '@/composables/useToast'
import http from '@/utils/request'

interface TimelineEntry {
  ts: string
  action: string
  operator: string
  note: string
  status_from?: string
}

interface Evidence {
  id: string
  filename: string
  stored_path: string
  size: number
  description?: string
  uploaded_at: string
}

interface Refund {
  id: string
  order_no: string
  reason: string
  description?: string
  amount: number
  status: string
  reject_reason?: string
  created_at: string
  approved_at?: string
  completed_at?: string
  timeline?: TimelineEntry[]
  evidence?: Evidence[]
}

const route = useRoute()
const router = useRouter()
const toast = useToast()

const refundNo = (route.params.refundNo as string) || (route.query.refundNo as string) || ''
const refund = ref<Refund | null>(null)
const loading = ref(false)
const loadError = ref<string | null>(null)
const evidenceList = ref<Evidence[]>([])

const canUploadEvidence = computed(() => {
  if (!refund.value) return false
  return ['pending', 'reviewing'].includes(refund.value.status)
})

async function loadDetail() {
  if (!refundNo) {
    loadError.value = '退款单号不存在'
    return
  }
  loading.value = true
  loadError.value = null
  try {
    const res: any = await http.get(`/api/v1/refunds/${refundNo}`)
    if (res?.code === 0) {
      refund.value = res.data
      evidenceList.value = res.data.evidence || []
    } else {
      loadError.value = '加载失败'
    }
  } catch (e: any) {
    loadError.value = e?.response?.data?.detail || e?.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function formatAmount(cents: number | undefined): string {
  if (cents === undefined || cents === null) return '0.00'
  return (cents / 100).toFixed(2)
}

function goBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/refunds')
  }
}

async function handleCancel() {
  if (!refund.value) return
  try {
    await ElMessageBox.confirm(
      '确认要撤销该退款申请吗?',
      '撤销退款',
      {
        confirmButtonText: '确认撤销',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    const res: any = await http.post(`/api/v1/refunds/${refund.value.id}/cancel`, { user_id: 'self' })
    if (res?.code === 0) {
      toast.success(t('common.messages.revokeSuccess'))
      loadDetail()
    } else {
      toast.error(t('common.messages.revokeFailed'))
    }
  } catch (e: any) {
    if (e !== 'cancel' && e?.message) {
      toast.error(t('common.messages.revokeFailed'))
    }
  }
}

function onEvidenceUploaded() {
  toast.success(t('common.messages.voucherUploadSuccess'))
  loadDetail()
}

onMounted(() => {
  loadDetail()
})
</script>

<style scoped lang="scss">
@use '@/styles/variables' as v;

// 设计令牌
$text-sec: var(--el-text-color-secondary);
$text-main: var(--el-text-color-primary);
$brand-primary: v.$primary-color;

.refund-detail-page {
  max-width: 880px;
  margin: 0 auto;
  padding: 24px;
}

.page-header {
  margin-bottom: 24px;

  .back-action {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 12px;
    cursor: pointer;
    color: $text-sec;
    font-size: 13px;
    transition: color 0.2s;

    &:hover {
      color: $brand-primary;
    }
  }

  .page-title {
    font-size: 24px;
    font-weight: 700;
    margin: 0 0 4px;
    color: $text-main;
  }

  .page-subtitle {
    font-size: 13px;
    color: $text-sec;
    margin: 0;
  }
}

.detail-card,
.info-card {
  margin-bottom: 16px;
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
}

.error-state {
  padding: 60px 20px;
  text-align: center;
  color: $text-sec;

  .error-icon {
    font-size: 48px;
    margin-bottom: 12px;
    color: $brand-primary;
  }
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px 24px;

  .info-item {
    display: flex;
    flex-direction: column;
    gap: 4px;

    &.full {
      grid-column: 1 / -1;
    }

    .info-label {
      font-size: 12px;
      color: $text-sec;
    }

    .info-value {
      font-size: 14px;
      color: $text-main;
      font-weight: 500;

      &.amount {
        color: $brand-primary;
        font-size: 18px;
        font-weight: 700;
      }

      &.reject {
        color: var(--el-color-danger);
      }
    }
  }
}

@media (width <= 640px) {
  .info-grid {
    grid-template-columns: 1fr;
  }
}
</style>
