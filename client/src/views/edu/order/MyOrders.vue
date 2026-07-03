<template>
  <div class="my-orders">
    <!-- ① 页面头 -->
    <header class="page-header">
      <div class="header-text">
        <h1 class="page-title">{{ t('edu.order.title') }}</h1>
        <p class="page-subtitle">{{ t('edu.order.subtitle') }}</p>
      </div>
      <div class="header-actions">
        <el-button :icon="Refresh" :loading="loading" @click="loadOrders">
          {{ t('edu.common.retry') }}
        </el-button>
      </div>
    </header>

    <el-alert
      v-if="error"
      type="error"
      :title="t('edu.common.loadFailed')"
      show-icon
      :closable="false"
      class="error-alert"
    />

    <!-- ② 状态筛选 -->
    <div class="filter-bar">
      <el-radio-group v-model="filterStatus" @change="handleFilterChange">
        <el-radio-button value="">{{ t('edu.order.filterAll') }}</el-radio-button>
        <el-radio-button value="pending">{{ t('edu.order.filterPending') }}</el-radio-button>
        <el-radio-button value="paid">{{ t('edu.order.filterPaid') }}</el-radio-button>
        <el-radio-button value="cancelled">{{ t('edu.order.filterCancelled') }}</el-radio-button>
      </el-radio-group>
    </div>

    <!-- ③ 订单表格 -->
    <section class="table-section">
      <el-table
        v-loading="loading"
        :data="orders"
        class="orders-table"
        stripe
      >
        <el-table-column :label="t('edu.order.orderNo')" prop="order_no" min-width="180" show-overflow-tooltip />
        <el-table-column :label="t('edu.order.orderType')" prop="order_type" min-width="100">
          <template #default="{ row }">{{ orderTypeLabel(row.order_type) }}</template>
        </el-table-column>
        <el-table-column :label="t('edu.order.totalAmount')" prop="total_amount" min-width="110" align="right">
          <template #default="{ row }">¥{{ formatAmount(row.total_amount) }}</template>
        </el-table-column>
        <el-table-column :label="t('edu.order.paidAmount')" prop="paid_amount" min-width="110" align="right">
          <template #default="{ row }">¥{{ formatAmount(row.paid_amount) }}</template>
        </el-table-column>
        <el-table-column :label="t('edu.order.discountAmount')" prop="discount_amount" min-width="110" align="right">
          <template #default="{ row }">¥{{ formatAmount(row.discount_amount) }}</template>
        </el-table-column>
        <el-table-column :label="t('edu.order.status')" prop="status" min-width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" effect="light" size="small">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('edu.order.createdAt')" prop="created_at" min-width="160">
          <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column :label="t('edu.common.actions') || ''" min-width="160" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="viewDetail(row.id)">
              {{ t('edu.order.detailTitle') }}
            </el-button>
            <el-button
              v-if="row.status === 'pending'"
              size="small"
              link
              type="danger"
              :loading="cancellingId === row.id"
              @click="handleCancel(row)"
            >
              {{ t('edu.order.cancelOrder') }}
            </el-button>
          </template>
        </el-table-column>

        <template #empty>
          <el-empty :description="t('edu.order.empty')" />
        </template>
      </el-table>

      <!-- ④ 分页 -->
      <div v-if="total > 0" class="pagination-wrap">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="size"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @current-change="loadOrders"
          @size-change="handleSizeChange"
        />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { orderApi } from '@/api/edu'
import type { EduOrder } from '@/api/edu'

const { t } = useI18n()
const router = useRouter()

const loading = ref(false)
const error = ref(false)
const orders = ref<EduOrder[]>([])
const total = ref(0)
const page = ref(1)
const size = ref(10)
const filterStatus = ref<string>('')
const cancellingId = ref<number | null>(null)

async function loadOrders() {
  loading.value = true
  error.value = false
  try {
    const res = await orderApi.myOrders({
      page: page.value,
      size: size.value,
      status: filterStatus.value || undefined,
    })
    const data = res.data?.data
    if (data) {
      orders.value = data.items
      total.value = data.total
    } else {
      orders.value = []
      total.value = 0
    }
  } catch (_e) {
    error.value = true
    orders.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function handleFilterChange() {
  page.value = 1
  loadOrders()
}

function handleSizeChange() {
  page.value = 1
  loadOrders()
}

function viewDetail(orderId: number) {
  router.push({ name: 'EduOrderDetail', params: { orderId: String(orderId) } })
}

async function handleCancel(order: EduOrder) {
  try {
    await ElMessageBox.confirm(t('edu.order.cancelConfirm'), t('edu.order.cancelOrder'), {
      type: 'warning',
      confirmButtonText: t('edu.common.submit'),
      cancelButtonText: t('edu.common.cancel'),
    })
    cancellingId.value = order.id
    try {
      await orderApi.cancelOrder(order.id)
      ElMessage.success(t('edu.order.cancelSuccess'))
      await loadOrders()
    } catch (_e) {
      // 取消失败错误由全局拦截器处理
    } finally {
      cancellingId.value = null
    }
  } catch {
    // 用户取消确认，无需处理
  }
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

function formatTime(value: string): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

onMounted(loadOrders)
</script>

<style scoped lang="scss">
.my-orders {
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

.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
}

.table-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 24px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
}

.orders-table {
  width: 100%;
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  padding: 8px 0;
}

/* 禁止蓝光边框 */
:deep(.el-radio-button__inner) {
  transition: border-color 0.2s ease, color 0.2s ease, background-color 0.2s ease;
  box-shadow: none !important;
}

:deep(.el-radio-button__original-radio:focus-visible + .el-radio-button__inner) {
  box-shadow: none !important;
}

:deep(.el-button:focus-visible) {
  outline: none;
  box-shadow: none;
}

@media (width <= 640px) {
  .page-header {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
