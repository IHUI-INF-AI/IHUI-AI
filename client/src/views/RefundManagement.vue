<template>
  <div class="refund-management-page page-container">
    <!-- 页面头部 -->
    <div class="page-header">
      <h1 class="page-title">{{ t('refund.title') }}</h1>
      <p class="page-subtitle">{{ t('refund.subtitle') }}</p>
    </div>

    <!-- 筛选和搜索 -->
    <el-card class="filter-card" :shadow="false">
      <div class="filter-content">
        <el-input
          v-model="searchText"
          :placeholder="t('refund.searchPlaceholder')"
          class="search-input"
          clearable
          @clear="handleSearch"
          @keyup.enter="handleSearch"
        >
          <template #prefix>
            <SearchIcon />
          </template>
        </el-input>

        <el-select
          v-model="filterStatus"
          :placeholder="t('refund.filterStatus')"
          class="status-select"
          clearable
          @change="handleSearch"
        >
          <el-option
            v-for="status in refundStatuses"
            :key="status.value"
            :label="status.label"
            :value="status.value"
          />
        </el-select>

        <el-date-picker
          v-model="dateRange"
          type="daterange"
          :range-separator="t('common.to')"
          :start-placeholder="t('refund.startDate')"
          :end-placeholder="t('refund.endDate')"
          class="date-picker"
          @change="handleSearch"
        />
      </div>
    </el-card>

    <!-- 退款列表 -->
    <el-card class="refund-list-card" :shadow="false">
      <template #header>
        <div class="card-header">
          <span>{{ t('refund.list') }}</span>
          <el-button
            type="primary"
            size="small"
            :loading="loading"
            @click="loadRefunds(true)"
          >
            <el-icon><Refresh /></el-icon>
            {{ t('common.refresh') }}
          </el-button>
        </div>
      </template>

      <div v-loading="loading" class="refund-list">
        <el-empty
          v-if="!loading && refunds.length === 0"
          :description="t('refund.empty')"
        />

        <div v-else class="refund-items">
          <div
            v-for="refund in refunds"
            :key="refund.id"
            class="refund-item"
          >
            <div class="refund-header">
              <div class="refund-info">
                <span class="refund-no">
                  {{ t('refund.refundNo') }}: {{ refund.refund_no }}
                </span>
                <el-tag
                  :type="getStatusTagType(refund.status)"
                  size="small"
                  class="status-tag"
                >
                  {{ getStatusText(refund.status) }}
                </el-tag>
              </div>
              <div class="refund-amount">
                <span class="amount-label">{{ t('refund.amount') }}:</span>
                <span class="amount-value">¥{{ (refund.amount / 100).toFixed(2) }}</span>
              </div>
            </div>

            <div class="refund-details">
              <div class="detail-row">
                <span class="detail-label">{{ t('refund.orderNo') }}:</span>
                <span class="detail-value">{{ refund.order_no }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">{{ t('refund.reason.title') }}:</span>
                <span class="detail-value">{{ refund.reason }}</span>
              </div>
              <div v-if="refund.description" class="detail-row">
                <span class="detail-label">{{ t('refund.description') }}:</span>
                <span class="detail-value">{{ refund.description }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">{{ t('refund.createTime') }}:</span>
                <span class="detail-value">{{ formatDate(refund.create_time) }}</span>
              </div>
              <div v-if="refund.approved_at" class="detail-row">
                <span class="detail-label">{{ t('refund.approvedAt') }}:</span>
                <span class="detail-value">{{ formatDate(refund.approved_at) }}</span>
              </div>
              <div v-if="refund.completed_at" class="detail-row">
                <span class="detail-label">{{ t('refund.completedAt') }}:</span>
                <span class="detail-value">{{ formatDate(refund.completed_at) }}</span>
              </div>
              <div v-if="refund.reject_reason" class="detail-row">
                <span class="detail-label reject-reason">{{ t('refund.rejectReason') }}:</span>
                <span class="detail-value reject-reason">{{ refund.reject_reason }}</span>
              </div>
            </div>

            <div class="refund-actions">
              <el-button
                v-if="refund.status === 'pending'"
                type="warning"
                size="small"
                @click="handleCancelRefund(refund)"
              >
                {{ t('refund.cancel') }}
              </el-button>
              <el-button
                type="primary"
                size="small"
                link
                @click="handleViewDetail(refund)"
              >
                {{ t('refund.viewDetail') }}
              </el-button>
            </div>
          </div>
        </div>
      </div>

      <!-- 分页 -->
      <div v-if="pagination.total > 0" class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handlePageSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessageBox } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import SearchIcon from '@/components/common/SearchIcon.vue'
import { getRefundList, cancelRefund, type RefundRecord } from '@/api/refund'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { logger } from '@/utils/logger'
import { useApiError } from '@/composables/useApiError'

const router = useRouter()
const { t } = useI18n()
const { showSuccess, showError } = useOperationFeedback()

// 响应式数据
const { loading, execute: executeApi } = useApiError({ showMessage: true })
const searchText = ref('')
const filterStatus = ref<RefundRecord['status'] | ''>('')
const dateRange = ref<[Date, Date] | null>(null)
const refunds = ref<RefundRecord[]>([])
const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0,
})

// 退款状态选项
const refundStatuses = computed(() => [
  { label: t('refund.status.pending'), value: 'pending' },
  { label: t('refund.status.processing'), value: 'processing' },
  { label: t('refund.status.approved'), value: 'approved' },
  { label: t('refund.status.rejected'), value: 'rejected' },
  { label: t('refund.status.completed'), value: 'completed' },
  { label: t('refund.status.failed'), value: 'failed' },
])

// 加载退款列表
const loadRefunds = async (_showLoading = false) => {
  const [startDate, endDate] = dateRange.value || [null, null]
  const data = await executeApi(() => getRefundList({
    page: pagination.value.page,
    pageSize: pagination.value.pageSize,
    orderNo: searchText.value || undefined,
    refundNo: searchText.value || undefined,
    status: filterStatus.value || undefined,
    startDate: startDate ? startDate.toISOString().split('T')[0] : undefined,
    endDate: endDate ? endDate.toISOString().split('T')[0] : undefined,
  }))

  if (data !== null && typeof data === 'object') {
    const listData = data as { list?: unknown[]; pagination?: { total?: number } }
    refunds.value = (listData.list || []) as RefundRecord[]
    pagination.value.total = listData.pagination?.total || 0
  }
}

// 搜索
const handleSearch = () => {
  pagination.value.page = 1
  loadRefunds(true)
}

// 分页变化
const handlePageChange = (page: number) => {
  pagination.value.page = page
  loadRefunds(true)
}

const handlePageSizeChange = (pageSize: number) => {
  pagination.value.pageSize = pageSize
  pagination.value.page = 1
  loadRefunds(true)
}

// 取消退款
const handleCancelRefund = async (refund: RefundRecord) => {
  try {
    await ElMessageBox.confirm(
      t('refund.cancelConfirm'),
      t('refund.cancel'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
      }
    )

    const response = await cancelRefund(refund.refund_no)
    if (response.success) {
      showSuccess(t('refund.cancelSuccess'))
      await loadRefunds(true)
    } else {
      showError(response.message || t('refund.cancelFailed'))
    }
  } catch (error) {
    if (error !== 'cancel') {
      logger.error('Failed to cancel refund application:', error)
      showError(t('refund.cancelFailed'))
    }
  }
}

// 查看详情
const handleViewDetail = (refund: RefundRecord) => {
  router.push(`/refunds/${refund.refund_no}`)
}

// 获取状态文本
const getStatusText = (status: RefundRecord['status']) => {
  const statusMap: Record<string, string> = {
    pending: t('refund.status.pending'),
    processing: t('refund.status.processing'),
    approved: t('refund.status.approved'),
    rejected: t('refund.status.rejected'),
    completed: t('refund.status.completed'),
    failed: t('refund.status.failed'),
  }
  return statusMap[status] || status
}

// 获取状态标签类型
const getStatusTagType = (status: RefundRecord['status']) => {
  const typeMap: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
    pending: 'warning',
    processing: 'info',
    approved: 'success',
    rejected: 'danger',
    completed: 'success',
    failed: 'danger',
  }
  return typeMap[status] || 'info'
}

// 格式化日期
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

onMounted(() => {
  loadRefunds(true)
})
</script>

<style scoped lang="scss">
.refund-management-page {
  padding: 24px;
}

.page-header {
  margin-bottom: 24px;

  .page-title {
    font-size: 24px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    margin-bottom: 8px;
  }

  .page-subtitle {
    font-size: 14px;
    color: var(--el-text-color-regular);
  }
}

.filter-card {
  margin-bottom: 24px;
  border-radius: var(--global-border-radius);
  border: var(--unified-border);

  .filter-content {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;

    .search-input {
      flex: 1;
      min-width: 200px;
    }

    .status-select {
      width: 150px;
    }

    .date-picker {
      width: 300px;
    }
  }
}

.refund-list-card {
  border-radius: var(--global-border-radius);
  border: var(--unified-border);

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .refund-list {
    min-height: 400px;
  }

  .refund-items {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .refund-item {
    padding: 16px;
    background: var(--el-bg-color);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    transition: all 0.3s ease;

    &:hover {
      background: var(--el-fill-color-light);
    }

    .refund-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: var(--unified-border-bottom);

      .refund-info {
        display: flex;
        align-items: center;
        gap: 12px;

        .refund-no {
          font-weight: 600;
          color: var(--el-text-color-primary);
        }
      }

      .refund-amount {
        display: flex;
        align-items: center;
        gap: 8px;

        .amount-label {
          color: var(--el-text-color-regular);
        }

        .amount-value {
          font-size: 18px;
          font-weight: 600;
          color: var(--el-color-primary);
        }
      }
    }

    .refund-details {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 12px;

      .detail-row {
        display: flex;
        gap: 8px;

        .detail-label {
          color: var(--el-text-color-regular);
          min-width: 100px;
        }

        .detail-value {
          color: var(--el-text-color-primary);
          flex: 1;

          &.reject-reason {
            color: var(--el-color-danger);
          }
        }
      }
    }

    .refund-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
  }

  .pagination-wrapper {
    margin-top: 24px;
    display: flex;
    justify-content: center;
  }
}
</style>