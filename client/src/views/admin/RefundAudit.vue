<template>
  <div class="refund-audit-page page-container">
    <!-- 页面头部 -->
    <div class="page-header">
      <h1 class="page-title">{{ t('refundAudit.title') }}</h1>
      <p class="page-subtitle">{{ t('refundAudit.subtitle') }}</p>
    </div>

    <!-- SLA 监控卡片 -->
    <div class="sla-grid">
      <div class="sla-card sla-green">
        <span class="sla-label">{{ t('refundAudit.slaNormal') }}</span>
        <span class="sla-value">{{ slaData.sla_buckets?.green || 0 }}</span>
      </div>
      <div class="sla-card sla-yellow">
        <span class="sla-label">{{ t('refundAudit.slaWarning') }}</span>
        <span class="sla-value">{{ slaData.sla_buckets?.yellow || 0 }}</span>
      </div>
      <div class="sla-card sla-red">
        <span class="sla-label">{{ t('refundAudit.slaOvertime') }}</span>
        <span class="sla-value">{{ slaData.sla_buckets?.red || 0 }}</span>
      </div>
      <div class="sla-card sla-critical">
        <span class="sla-label">{{ t('refundAudit.slaCritical') }}</span>
        <span class="sla-value">{{ slaData.sla_buckets?.critical || 0 }}</span>
      </div>
    </div>

    <!-- 过滤�?+ 批量操作 -->
    <div class="filter-bar">
      <div class="filter-fields">
        <input
          v-model="filterKeyword"
          type="text"
          class="filter-input"
          :placeholder="t('refundAudit.searchPlaceholder')"
          @keyup.enter="loadList(true)"
        />
        <select v-model="filterStatus" class="filter-select" @change="loadList(true)">
          <option value="">{{ t('refundAudit.allStatus') }}</option>
          <option value="pending">{{ t('refundAudit.statusPending') }}</option>
          <option value="reviewing">{{ t('refundAudit.statusReviewing') }}</option>
          <option value="approved">{{ t('refundAudit.statusApproved') }}</option>
          <option value="rejected">{{ t('refundAudit.statusRejected') }}</option>
          <option value="processing">{{ t('refundAudit.statusProcessing') }}</option>
          <option value="completed">{{ t('refundAudit.statusCompleted') }}</option>
          <option value="failed">{{ t('refundAudit.statusFailed') }}</option>
          <option value="cancelled">{{ t('refundAudit.statusCancelled') }}</option>
        </select>
        <select v-model="filterSla" class="filter-select" @change="loadList(true)">
          <option value="">{{ t('refundAudit.allSla') }}</option>
          <option value="green">{{ t('refundAudit.slaGreen') }}</option>
          <option value="yellow">{{ t('refundAudit.slaYellow') }}</option>
          <option value="red">{{ t('refundAudit.slaRed') }}</option>
          <option value="critical">{{ t('refundAudit.slaCriticalLabel') }}</option>
        </select>
        <button class="filter-btn" @click="loadList(true)">{{ t('refundAudit.query') }}</button>
      </div>
      <div class="batch-actions">
        <span class="batch-hint">{{ t('refundAudit.selected', { count: selectedIds.length }) }}</span>
        <button
          class="batch-btn primary"
          :disabled="selectedIds.length === 0"
          @click="batchReview(true)"
        >{{ t('refundAudit.batchApprove') }}</button>
        <button
          class="batch-btn danger"
          :disabled="selectedIds.length === 0"
          @click="batchReview(false)"
        >{{ t('refundAudit.batchReject') }}</button>
      </div>
    </div>

    <!-- 列表 -->
    <div v-loading="loading" class="audit-table">
      <div v-if="!loading && list.length === 0" class="empty-state">
        <div class="empty-icon">📭</div>
        <p>{{ t('refundAudit.empty') }}</p>
      </div>

      <div v-else class="table-wrap">
        <div class="table-head">
          <label class="th check">
            <input
              type="checkbox"
              :checked="allSelected"
              @change="toggleAll"
            />
          </label>
          <span class="th id-col">{{ t('refundAudit.colId') }}</span>
          <span class="th order-col">{{ t('refundAudit.colOrder') }}</span>
          <span class="th amount-col">{{ t('refundAudit.colAmount') }}</span>
          <span class="th reason-col">{{ t('refundAudit.colReason') }}</span>
          <span class="th status-col">{{ t('refundAudit.colStatus') }}</span>
          <span class="th sla-col">SLA</span>
          <span class="th time-col">{{ t('refundAudit.colElapsed') }}</span>
          <span class="th op-col">{{ t('refundAudit.colOp') }}</span>
        </div>
        <div
          v-for="item in list"
          :key="item.id"
          class="table-row"
          :class="`row-sla-${item.sla_level}`"
        >
          <label class="td check">
            <input
              type="checkbox"
              :checked="selectedIds.includes(item.id)"
              :disabled="!['pending', 'reviewing'].includes(item.status)"
              @change="toggleOne(item.id)"
            />
          </label>
          <span class="td id-col">{{ item.id }}</span>
          <span class="td order-col">{{ item.order_no }}</span>
          <span class="td amount-col">¥{{ formatAmount(item.amount) }}</span>
          <span class="td reason-col">{{ item.reason }}</span>
          <span class="td status-col">
            <span :class="['status-pill', `status-${item.status}`]">
              {{ statusLabel(item.status) }}
            </span>
          </span>
          <span class="td sla-col">
            <span :class="['sla-pill', `sla-${item.sla_level}`]">
              {{ slaLabel(item.sla_level) }}
            </span>
            <span class="sla-hours">{{ item.elapsed_hours }}h</span>
          </span>
          <span class="td time-col">{{ formatTime(item.created_at) }}</span>
          <span class="td op-col">
            <button
              v-if="['pending', 'reviewing'].includes(item.status)"
              class="op-btn primary"
              @click="singleReview(item.id, true)"
            >{{ t('refundAudit.approve') }}</button>
            <button
              v-if="['pending', 'reviewing'].includes(item.status)"
              class="op-btn danger"
              @click="singleReview(item.id, false)"
            >{{ t('refundAudit.reject') }}</button>
            <button
              v-else
              class="op-btn"
              @click="viewDetail(item)"
            >{{ t('common.view') }}</button>
          </span>
        </div>
      </div>
    </div>

    <!-- 详情弹窗 -->
    <el-dialog
      v-model="detailVisible"
      :title="t('refundAudit.detailTitle')"
      width="640px"
    >
      <div v-if="detail" class="detail-grid">
        <div class="detail-row">
          <span class="detail-label">{{ t('refundAudit.detailId') }}</span>
          <span class="detail-value">{{ detail.id }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">{{ t('refundAudit.detailOrder') }}</span>
          <span class="detail-value">{{ detail.order_no }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">{{ t('refundAudit.detailAmount') }}</span>
          <span class="detail-value">¥{{ formatAmount(detail.amount) }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">{{ t('refundAudit.detailStatus') }}</span>
          <span :class="['status-pill', `status-${detail.status}`]">
            {{ statusLabel(detail.status) }}
          </span>
        </div>
        <div class="detail-row full">
          <span class="detail-label">{{ t('refundAudit.detailReason') }}</span>
          <span class="detail-value">{{ detail.reason }}</span>
        </div>
        <div v-if="detail.description" class="detail-row full">
          <span class="detail-label">{{ t('refundAudit.detailDescription') }}</span>
          <span class="detail-value">{{ detail.description }}</span>
        </div>
        <div v-if="detail.evidence?.length" class="detail-row full">
          <span class="detail-label">{{ t('refundAudit.detailEvidence') }}</span>
          <span class="detail-value">{{ t('refundAudit.evidenceCount', { count: detail.evidence.length }) }}</span>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ref, computed, onMounted } from 'vue'
import { ElMessageBox } from 'element-plus'
import { useToast } from '@/composables/useToast'
import http from '@/utils/request'
import type { ApiResponse } from '@/types'

interface Refund {
  id: string
  order_no: string
  amount: number
  reason: string
  description?: string
  status: string
  sla_level: string
  elapsed_hours: number
  created_at: string
  evidence?: unknown[]
}

const toast = useToast()
const loading = ref(false)
const list = ref<Refund[]>([])
const selectedIds = ref<string[]>([])
const filterKeyword = ref('')
const filterStatus = ref('')
const filterSla = ref('')
const detail = ref<Refund | null>(null)
const detailVisible = ref(false)
const slaData = ref<unknown>({ sla_buckets: { green: 0, yellow: 0, red: 0, critical: 0 } })

const allSelected = computed(() => {
  const selectable = list.value.filter((i) => ['pending', 'reviewing'].includes(i.status))
  return selectable.length > 0 && selectable.every((i) => selectedIds.value.includes(i.id))
})

function formatAmount(cents: number | undefined): string {
  if (cents === undefined || cents === null) return '0.00'
  return (cents / 100).toFixed(2)
}

function statusLabel(s: string): string {
  return {
    pending: t('refundAudit.statusPending'),
    reviewing: t('refundAudit.statusReviewing'),
    approved: t('refundAudit.statusApproved'),
    rejected: t('refundAudit.statusRejected'),
    processing: t('refundAudit.statusProcessing'),
    completed: t('refundAudit.statusCompleted'),
    failed: t('refundAudit.statusFailed'),
    cancelled: t('refundAudit.statusCancelled'),
  }[s] || s
}

function slaLabel(l: string): string {
  return {
    green: t('refundAudit.slaNormal'),
    yellow: t('refundAudit.slaWarning'),
    red: t('refundAudit.slaOvertime'),
    critical: t('refundAudit.slaCritical'),
  }[l] || l
}

async function loadSla() {
  try {
    const res = await http.get<ApiResponse<unknown>>('/api/v1/refunds/sla/monitor')
    if (res.data?.code === 0) slaData.value = res.data.data
  } catch (_e) {
    // 静默
  }
}

async function loadList(reset = false) {
  if (reset) selectedIds.value = []
  loading.value = true
  try {
    const params: Record<string, unknown> = { page: 1, page_size: 50 }
    if (filterStatus.value) params.status = filterStatus.value
    if (filterSla.value) params.sla_level = filterSla.value
    if (filterKeyword.value.trim()) params.keyword = filterKeyword.value.trim()
    const res = await http.get<ApiResponse<{ list: Refund[] }>>('/api/v1/refunds/admin/list', { params })
    if (res.data?.code === 0) {
      list.value = res.data.data?.list || []
    }
  } catch (_e) {
    toast.error(t('refundAudit.loadFailed'))
  } finally {
    loading.value = false
  }
}

function toggleAll(e: Event) {
  const checked = (e.target as HTMLInputElement).checked
  const selectable = list.value.filter((i) => ['pending', 'reviewing'].includes(i.status))
  if (checked) {
    selectedIds.value = selectable.map((i) => i.id)
  } else {
    selectedIds.value = []
  }
}

function toggleOne(id: string) {
  const idx = selectedIds.value.indexOf(id)
  if (idx >= 0) selectedIds.value.splice(idx, 1)
  else selectedIds.value.push(id)
}

async function singleReview(id: string, approved: boolean) {
  try {
    await ElMessageBox.confirm(
      t('refundAudit.confirmSingle', { action: approved ? t('refundAudit.approve') : t('refundAudit.reject') }),
      approved ? t('refundAudit.reviewApproved') : t('refundAudit.reviewRejected'),
      { confirmButtonText: t('common.confirm'), cancelButtonText: t('common.cancel'), type: 'warning' }
    )
  } catch (_e) { return }
  try {
    const res = await http.post<ApiResponse<unknown>>(`/api/v1/refunds/${id}/review`, { approved, note: '' })
    if (res.data?.code === 0) {
      toast.success(approved ? t('refundAudit.approvedToast') : t('refundAudit.rejectedToast'))
      loadList()
      loadSla()
    } else {
      toast.error(t('refundAudit.operationFailed'))
    }
  } catch (_e) {
    toast.error(t('refundAudit.operationFailed'))
  }
}

async function batchReview(approved: boolean) {
  if (selectedIds.value.length === 0) return
  try {
    await ElMessageBox.confirm(
      t('refundAudit.confirmBatch', { action: approved ? t('refundAudit.approve') : t('refundAudit.reject'), count: selectedIds.value.length }),
      t('refundAudit.batchReview'),
      { confirmButtonText: t('common.confirm'), cancelButtonText: t('common.cancel'), type: 'warning' }
    )
  } catch (_e) { return }
  try {
    const res = await http.post<ApiResponse<{ success: number; failed: number }>>('/api/v1/refunds/batch/review', {
      items: selectedIds.value.map((id) => ({ refund_id: id, approved, note: '' })),
      operator: 'admin',
    })
    if (res.data?.code === 0) {
      const d = res.data.data
      toast.success(t('refundAudit.batchResult', { success: d?.success ?? 0, failed: d?.failed ?? 0 }))
      selectedIds.value = []
      loadList()
      loadSla()
    } else {
      toast.error(t('refundAudit.operationFailed'))
    }
  } catch (_e) {
    toast.error(t('refundAudit.operationFailed'))
  }
}

function viewDetail(item: Refund) {
  detail.value = item
  detailVisible.value = true
}

onMounted(() => {
  loadSla()
  loadList()
})
</script>

<style scoped lang="scss">
@use '@/styles/variables' as v;

$text-sec: var(--el-text-color-secondary);
$text-main: var(--el-text-color-primary);
$brand-primary: v.$primary-color;

.refund-audit-page {
  max-width: 1280px;
  margin: 0 auto;
  padding: 24px;
}

.page-header {
  margin-bottom: 20px;

  .page-title {
    font-size: 24px;
    font-weight: 800;
    margin: 0 0 4px;
    color: $text-main;
  }

  .page-subtitle {
    font-size: 13px;
    color: $text-sec;
    margin: 0;
  }
}

.sla-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.sla-card {
  padding: 16px 20px;
  border-radius: var(--global-border-radius);
  display: flex;
  flex-direction: column;
  gap: 6px;
  border: var(--unified-border);

  .sla-label {
    font-size: 12px;
    font-weight: 600;
  }

  .sla-value {
    font-size: 28px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }

  &.sla-green { background: var(--el-color-success-light-9); border-color: var(--el-color-success-light-7); .sla-value { color: var(--el-color-success); } }
  &.sla-yellow { background: var(--el-color-warning-light-9); border-color: var(--el-color-warning-light-7); .sla-value { color: var(--el-color-warning); } }
  &.sla-red { background: var(--el-color-danger-light-9); border-color: var(--el-color-danger-light-7); .sla-value { color: var(--el-color-danger); } }

  &.sla-critical {
    background: var(--el-text-color-primary);
    color: var(--el-bg-color);
    border-color: var(--el-text-color-primary);
    .sla-value { color: var(--el-bg-color); }
  }
}

.filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}

.filter-fields {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

.filter-input,
.filter-select {
  height: 32px;
  padding: 0 12px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  font-size: 13px;
  background: var(--el-bg-color);
  outline: none;

  &:focus {
    border-color: $brand-primary;
  }
}

.filter-input { min-width: 220px; }
.filter-select { min-width: 130px; }

.filter-btn {
  height: 32px;
  padding: 0 16px;
  border-radius: var(--global-border-radius);
  background: $brand-primary;
  color: var(--el-bg-color);
  border: none;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;

  &:hover { opacity: 0.85; }
}

.batch-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.batch-hint {
  font-size: 12px;
  color: $text-sec;
  margin-right: 4px;
}

.batch-btn {
  height: 32px;
  padding: 0 14px;
  border-radius: var(--global-border-radius);
  border: none;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;

  &.primary {
    background: var(--el-color-success);
    color: var(--el-bg-color);
  }

  &.danger {
    background: var(--el-color-danger);
    color: var(--el-bg-color);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.audit-table {
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  overflow: hidden;
}

.empty-state {
  padding: 60px 20px;
  text-align: center;
  color: $text-sec;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.table-head,
.table-row {
  display: grid;
  grid-template-columns: 40px 140px 140px 100px 1fr 90px 130px 100px 130px;
  align-items: center;
  padding: 10px 16px;
  gap: 8px;
}

.table-head {
  background: var(--color-black-2);
  font-size: 12px;
  font-weight: 700;
  color: $text-sec;
  border-bottom: var(--unified-border-bottom);
}

.table-row {
  font-size: 13px;
  border-bottom: var(--unified-border-bottom);

  &:last-child { border-bottom: none; }
  &:hover { background: var(--color-black-2); }

  &.row-sla-critical {
    background: var(--el-color-danger-light-9);
    border-left: 3px solid var(--el-color-danger);
  }

  &.row-sla-red {
    background: var(--el-color-danger-light-9);
    border-left: 3px solid var(--el-color-danger-light-5);
  }

  &.row-sla-yellow {
    border-left: 3px solid var(--el-color-warning);
  }
}

.td,
.th {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.id-col { font-family: monospace; font-size: 12px; }
.amount-col { font-weight: 700; font-variant-numeric: tabular-nums; }

.status-pill {
  display: inline-block;
  padding: 2px 8px;
  border-radius: var(--global-border-radius);
  font-size: 11px;
  font-weight: 700;

  &.status-pending, &.status-reviewing { background: var(--el-color-primary-light-9); color: var(--color-blue-1890ff); }
  &.status-approved, &.status-completed, &.status-processing { background: var(--el-color-success-light-9); color: var(--el-color-success); }
  &.status-rejected, &.status-failed { background: var(--el-color-danger-light-9); color: var(--el-color-danger); }
  &.status-cancelled { background: var(--color-black-6); color: $text-sec; }
}

.sla-pill {
  display: inline-block;
  padding: 2px 6px;
  border-radius: var(--global-border-radius);
  font-size: 10px;
  font-weight: 700;
  margin-right: 4px;

  &.sla-green { background: var(--el-color-success-light-7); color: var(--el-color-success); }
  &.sla-yellow { background: var(--el-color-warning-light-7); color: var(--el-color-warning); }
  &.sla-red { background: var(--el-color-danger-light-7); color: var(--el-color-danger); }
  &.sla-critical { background: var(--el-text-color-primary); color: var(--el-bg-color); }
}

.sla-hours {
  font-size: 11px;
  color: $text-sec;
  font-variant-numeric: tabular-nums;
}

.op-col {
  display: flex;
  gap: 6px;
}

.op-btn {
  height: 26px;
  padding: 0 10px;
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
  background: transparent;
  font-size: 12px;
  cursor: pointer;
  color: $text-main;

  &.primary {
    background: var(--el-color-success);
    color: var(--el-bg-color);
    border-color: var(--el-color-success);
  }

  &.danger {
    background: var(--el-color-danger);
    color: var(--el-bg-color);
    border-color: var(--el-color-danger);
  }
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px 20px;
}

.detail-row {
  display: flex;
  flex-direction: column;
  gap: 4px;

  &.full { grid-column: 1 / -1; }

  .detail-label {
    font-size: 12px;
    color: $text-sec;
  }

  .detail-value {
    font-size: 14px;
    color: $text-main;
    font-weight: 500;
  }
}

@media (width <= 960px) {
  .sla-grid { grid-template-columns: repeat(2, 1fr); }

  .table-head, .table-row {
    grid-template-columns: 32px 1fr 100px 80px 110px;
    .order-col, .reason-col, .time-col { display: none; }
  }
}
</style>
