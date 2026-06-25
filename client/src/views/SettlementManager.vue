<template>
  <div class="settlement-manager">
    <el-page-header @back="goBack" class="page-header">
      <template #content>
        <h2>{{ t('settlement.title') }}</h2>
      </template>
    </el-page-header>

    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stats-cards" v-if="overview">
      <el-col :xs="24" :sm="6">
        <el-card shadow="hover">
          <div class="stat-item">
            <div class="stat-value">{{ overview.total_settlements || 0 }}</div>
            <div class="stat-label">{{ t('settlement.totalSettlements') }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="6">
        <el-card shadow="hover">
          <div class="stat-item">
            <div class="stat-value primary">
              ¥{{ (overview.total_amount / 100 || 0).toFixed(2) }}
            </div>
            <div class="stat-label">{{ t('settlement.totalAmount') }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="6">
        <el-card shadow="hover">
          <div class="stat-item">
            <div class="stat-value success">{{ overview.settled_count || 0 }}</div>
            <div class="stat-label">{{ t('settlement.settledCount') }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="6">
        <el-card shadow="hover">
          <div class="stat-item">
            <div class="stat-value warning">{{ overview.unsettled_count || 0 }}</div>
            <div class="stat-label">{{ t('settlement.unsettledCount') }}</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" class="main-card">
      <template #header>
        <div class="card-header">
          <span>{{ t('settlement.settlementList') }}</span>
          <div style="display: flex; gap: 10px">
            <el-input
              v-model="searchKeyword"
              :placeholder="t('settlement.searchPlaceholder')"
              style="width: 240px"
              clearable
              @input="debouncedLoadSettlements"
            />
            <el-select
              v-model="filterSettlement"
              @change="loadSettlements"
              style="width: 120px"
              clearable
            >
              <el-option :label="t('settlement.allStatus')" value="" />
              <el-option :label="t('settlement.unsettled')" value="0" />
              <el-option :label="t('settlement.settled')" value="1" />
            </el-select>
            <el-button @click="loadSettlements">
              <el-icon><RefreshCw /></el-icon>
              {{ t('common.refresh') }}
            </el-button>
            <el-button type="primary" @click="showSyncDialog = true">{{
              t('settlement.syncPurchaseRecords')
            }}</el-button>
          </div>
        </div>
      </template>

      <el-table :data="settlementList" stripe v-loading="loading">
        <el-table-column type="selection" width="55" />
        <el-table-column prop="agent_name" :label="t('settlement.agentName')" min-width="150" />
        <el-table-column prop="order_no" :label="t('settlement.orderNo')" min-width="150" />
        <el-table-column :label="t('settlement.amount')" width="120">
          <template #default="{ row }">
            <span style="color: var(--el-color-primary); font-weight: bold">
              ¥{{ ((row.amount || 0) / 100).toFixed(2) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="accountType" :label="t('settlement.chargeType')" width="120" />
        <el-table-column prop="total" :label="t('settlement.quantity')" width="80" />
        <el-table-column :label="t('settlement.settlementStatus')" width="100">
          <template #default="{ row }">
            <el-tag :type="row.settlement === '1' ? 'success' : 'warning'">
              {{ row.settlement === '1' ? t('settlement.settled') : t('settlement.unsettled') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('settlement.withdrawalStatus')" width="100">
          <template #default="{ row }">
            <el-tag :type="row.withdrawal === '1' ? 'success' : 'info'">
              {{
                row.withdrawal === '1' ? t('settlement.withdrawn') : t('settlement.notWithdrawn')
              }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="create_time" :label="t('settlement.createTime')" width="180">
          <template #default="{ row }">
            {{ formatTime(row.create_time) }}
          </template>
        </el-table-column>
        <el-table-column :label="t('common.actions')" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="handleViewDetail(row)">{{
              t('settlement.detail')
            }}</el-button>
            <el-button link type="danger" @click="handleDelete(row)">{{
              t('settlement.delete')
            }}</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div
        style="margin-top: 20px; display: flex; justify-content: space-between; align-items: center"
      >
        <el-button :disabled="selectedRows.length === 0" @click="handleBatchDelete">
          {{ t('settlement.batchDelete') }} ({{ selectedRows.length }})
        </el-button>
        <el-pagination
          v-if="pagination.total > 0"
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          layout="prev, pager, next, sizes, jumper, total"
          @size-change="loadSettlements"
          @current-change="loadSettlements"
        />
      </div>
    </el-card>

    <!-- 详情对话框 -->
    <el-dialog v-model="showDetailDialog" :title="t('settlement.settlementDetail')" width="800px">
      <div v-if="currentSettlement" class="settlement-detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item :label="t('settlement.agentName')">
            {{ currentSettlement.agent_name }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('settlement.orderNo')">
            {{ currentSettlement.order_no }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('settlement.amount')">
            ¥{{ ((currentSettlement.amount || 0) / 100).toFixed(2) }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('settlement.chargeType')">
            {{ currentSettlement.accountType || '-' }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('settlement.settlementStatus')">
            <el-tag :type="currentSettlement.settlement === '1' ? 'success' : 'warning'">
              {{
                currentSettlement.settlement === '1'
                  ? t('settlement.settled')
                  : t('settlement.unsettled')
              }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item :label="t('settlement.withdrawalStatus')">
            <el-tag :type="currentSettlement.withdrawal === '1' ? 'success' : 'info'">
              {{
                currentSettlement.withdrawal === '1'
                  ? t('settlement.withdrawn')
                  : t('settlement.notWithdrawn')
              }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item :label="t('settlement.createTime')">
            {{ formatTime(currentSettlement.create_time) }}
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </el-dialog>

    <!-- 同步对话框 -->
    <el-dialog
      v-model="showSyncDialog"
      :title="t('settlement.syncPurchaseToSettlement')"
      width="500px"
    >
      <el-form :model="syncForm" label-width="120px">
        <el-form-item :label="t('settlement.startDate')">
          <el-date-picker
            v-model="syncForm.start_date"
            type="date"
            :placeholder="t('settlement.selectStartDate')"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item :label="t('settlement.endDate')">
          <el-date-picker
            v-model="syncForm.end_date"
            type="date"
            :placeholder="t('settlement.selectEndDate')"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item :label="t('settlement.developerUuid')">
          <el-input
            v-model="syncForm.agent_order_uuid"
            :placeholder="t('settlement.developerUuidPlaceholder')"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showSyncDialog = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="syncSubmitting" @click="handleSync">{{
          t('settlement.startSync')
        }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
 
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { usePageState } from '@/composables/usePageState'
import { ApiErrorType } from '@/utils/errorHandler'
import { RefreshCw } from '@/lib/lucide-fallback'
import {
  getSettlementList,
  getSettlementDetail,
  getSettlementOverview,
  deleteSettlement,
  batchDeleteSettlement,
  syncExistingToSettlement,
  type AgentSettlement,
  type SettlementOverview,
} from '@/api/agent/agent-settlement'
import { useAuthStore } from '@/stores/auth'
import { formatDateTime as _formatTime } from '@/utils/format'

const { t } = useI18n()

const router = useRouter() as ReturnType<typeof useRouter> & {
  back: () => void
}
const _authStore = useAuthStore()
const { handleResult, showError: showErrorMsg } = useOperationFeedback()
const { confirmDelete } = useConfirmDialog()
const { loading, error: pageError } = usePageState()

const settlementList = ref<AgentSettlement[]>([])
const searchKeyword = ref('')
const filterSettlement = ref<string>('')
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
})

const overview = ref<SettlementOverview | null>(null)
const selectedRows = ref<AgentSettlement[]>([])

const showDetailDialog = ref(false)
const currentSettlement = ref<AgentSettlement | null>(null)

const showSyncDialog = ref(false)
const syncSubmitting = ref(false)
const syncForm = reactive({
  start_date: '',
  end_date: '',
  agent_order_uuid: '',
})

// 防抖函数
const debounce = <T extends (...args: any[]) => unknown>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout> | null = null
  return function (this: any, ...args: Parameters<T>) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const context = this
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => {
      func.apply(context, args)
    }, wait)
  }
}

const loadSettlements = async () => {
  loading.value = true
  pageError.value = null
  try {
    const response = await getSettlementList({
      page: pagination.page,
      pageSize: pagination.pageSize,
      agent_name: searchKeyword.value || undefined,
      settlement: filterSettlement.value || undefined,
    })
    if (response.code === 200 || response.success) {
      settlementList.value = response.data?.list || []
      pagination.total = response.data?.pagination?.total || 0
    } else {
      const errorMsg = response.message || t('settlement.loadFailed')
      pageError.value = {
        type: ApiErrorType.BUSINESS,
        code: response.code,
        message: errorMsg,
      }
      showErrorMsg(errorMsg)
    }
  } catch (error: any) {
    const errorMsg =
      (error instanceof Error ? error.message : String(error)) || t('settlement.loadFailed')
    pageError.value = {
      type: ApiErrorType.UNKNOWN,
      code: 500,
      message: errorMsg,
      originalError: error,
    }
    showErrorMsg(errorMsg)
  } finally {
    loading.value = false
  }
}

const debouncedLoadSettlements = debounce(loadSettlements, 300)

const loadOverview = async () => {
  try {
    const response = await getSettlementOverview()
    if (response.code === 200 || response.success) {
      overview.value = response.data || null
    }
  } catch (_error) {
    // 静默失败
  }
}

const handleViewDetail = async (settlement: AgentSettlement) => {
  if (!settlement.id) {
    showErrorMsg(t('settlement.idRequired'))
    return
  }
  try {
    const response = await getSettlementDetail(settlement.id)
    if (response.code === 200 || response.success) {
      currentSettlement.value = response.data as AgentSettlement
      showDetailDialog.value = true
    }
  } catch (error: any) {
    showErrorMsg(
      (error instanceof Error ? error.message : String(error)) || t('settlement.loadDetailFailed')
    )
  }
}

const handleDelete = async (settlement: AgentSettlement) => {
  if (!settlement.id) {
    showErrorMsg(t('settlement.idRequired'))
    return
  }
  const confirmed = await confirmDelete(`${t('settlement.agentName')} "${settlement.agent_name}"`)
  if (!confirmed) return

  await handleResult(deleteSettlement(settlement.id), {
    successMessage: t('settlement.deleteSuccess'),
    errorMessage: t('settlement.deleteFailed'),
    onSuccess: () => {
      loadSettlements()
      loadOverview()
    },
  })
}

const handleBatchDelete = async () => {
  if (selectedRows.value.length === 0) return
  const confirmed = await confirmDelete(
    `${t('settlement.batchDelete')} ${selectedRows.value.length} ${t('settlement.settlementList')}`
  )
  if (!confirmed) return

  const recordIds = selectedRows.value.map(r => r.id).filter((id): id is string => !!id)
  if (recordIds.length === 0) {
    showErrorMsg(t('settlement.noValidIds'))
    return
  }
  await handleResult(batchDeleteSettlement(recordIds), {
    successMessage: t('settlement.batchDeleteSuccess'),
    errorMessage: t('settlement.batchDeleteFailed'),
    onSuccess: () => {
      selectedRows.value = []
      loadSettlements()
      loadOverview()
    },
  })
}

const handleSync = async () => {
  syncSubmitting.value = true
  try {
    await handleResult(
      syncExistingToSettlement({
        start_date: syncForm.start_date || undefined,
        end_date: syncForm.end_date || undefined,
        agent_order_uuid: syncForm.agent_order_uuid || undefined,
      }),
      {
        successMessage: data =>
          t('settlement.syncSuccess', {
            count: (data as Record<string, unknown>)?.synced_count || 0,
          }),
        errorMessage: t('settlement.syncFailed'),
        onSuccess: () => {
          showSyncDialog.value = false
          syncForm.start_date = ''
          syncForm.end_date = ''
          syncForm.agent_order_uuid = ''
          Promise.all([loadSettlements(), loadOverview()])
        },
      }
    )
  } catch (error: any) {
    showErrorMsg(
      (error instanceof Error ? error.message : String(error)) || t('settlement.syncFailed')
    )
  } finally {
    syncSubmitting.value = false
  }
}

const formatTime = (time?: string): string => {
  return time ? _formatTime(time) : '-'
}

const goBack = () => {
  router.back()
}

onMounted(() => {
  loadSettlements()
  loadOverview()
})
</script>

<style scoped lang="scss">
.settlement-manager {
  padding: 20px;

  .page-header {
    margin-bottom: 20px;
  }

  .stats-cards {
    margin-bottom: 20px;

    .stat-item {
      text-align: center;

      .stat-value {
        font-size: 24px;
        font-weight: bold;
        margin-bottom: 8px;

        &.primary {
          color: var(--el-color-primary);
        }

        &.success {
          color: var(--el-color-success);
        }

        &.warning {
          color: var(--el-color-warning);
        }
      }

      .stat-label {
        color: var(--el-text-color-secondary);
        font-size: 14px;
      }
    }
  }

  .main-card {
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  }

  .settlement-detail {
    // 样式
  }
}
</style>
