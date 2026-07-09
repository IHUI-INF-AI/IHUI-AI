<template>
  <div class="settlement-manager">
    <el-page-header @back="goBack" class="page-header">
      <template #content>
        <h2>{{ t('settlement.title') }}</h2>
      </template>
    </el-page-header>

    <!-- 统计卡片 -->
    <div class="flex flex-wrap gap-5 stats-cards" v-if="overview">
      <div class="w-full sm:w-1/4">
        <Card class="transition-shadow hover:shadow-md p-5">
          <div class="stat-item">
            <div class="stat-value">{{ overview.total_settlements || 0 }}</div>
            <div class="stat-label">{{ t('settlement.totalSettlements') }}</div>
          </div>
        </Card>
      </div>
      <div class="w-full sm:w-1/4">
        <Card class="transition-shadow hover:shadow-md p-5">
          <div class="stat-item">
            <div class="stat-value primary">
              ¥{{ (overview.total_amount / 100 || 0).toFixed(2) }}
            </div>
            <div class="stat-label">{{ t('settlement.totalAmount') }}</div>
          </div>
        </Card>
      </div>
      <div class="w-full sm:w-1/4">
        <Card class="transition-shadow hover:shadow-md p-5">
          <div class="stat-item">
            <div class="stat-value success">{{ overview.settled_count || 0 }}</div>
            <div class="stat-label">{{ t('settlement.settledCount') }}</div>
          </div>
        </Card>
      </div>
      <div class="w-full sm:w-1/4">
        <Card class="transition-shadow hover:shadow-md p-5">
          <div class="stat-item">
            <div class="stat-value warning">{{ overview.unsettled_count || 0 }}</div>
            <div class="stat-label">{{ t('settlement.unsettledCount') }}</div>
          </div>
        </Card>
      </div>
    </div>

    <Card class="main-card shadow-none"><CardHeader>
        <div class="card-header">
          <span>{{ t('settlement.settlementList') }}</span>
          <div style="display: flex; gap: 10px">
            <Input
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
            <Button variant="outline" @click="loadSettlements">
              <RefreshCw class="h-4 w-4" />
              {{ t('common.refresh') }}
            </Button>
            <Button variant="default" @click="showSyncDialog = true">{{
              t('settlement.syncPurchaseRecords')
            }}</Button>
          </div>
        </div>
      </CardHeader><CardContent class="p-5">
      
      <div v-if="loading" class="flex justify-center py-8 text-muted-foreground">Loading...</div>
      <Table v-else>
        <TableHeader>
          <TableRow>
            <TableHead class="w-[55px]"><input type="checkbox" :checked="allSelected" @change="toggleAll($event)" /></TableHead>
            <TableHead class="min-w-[150px]">{{ t('settlement.agentName') }}</TableHead>
            <TableHead class="min-w-[150px]">{{ t('settlement.orderNo') }}</TableHead>
            <TableHead class="w-[120px]">{{ t('settlement.amount') }}</TableHead>
            <TableHead class="w-[120px]">{{ t('settlement.chargeType') }}</TableHead>
            <TableHead class="w-[80px]">{{ t('settlement.quantity') }}</TableHead>
            <TableHead class="w-[100px]">{{ t('settlement.settlementStatus') }}</TableHead>
            <TableHead class="w-[100px]">{{ t('settlement.withdrawalStatus') }}</TableHead>
            <TableHead class="w-[180px]">{{ t('settlement.createTime') }}</TableHead>
            <TableHead class="w-[150px]">{{ t('common.actions') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="(row, index) in settlementList" :key="row.id ?? index">
            <TableCell class="w-[55px]"><input type="checkbox" :checked="selectedRows.includes(row)" @change="toggleRow(row)" /></TableCell>
            <TableCell>{{ row.agent_name }}</TableCell>
            <TableCell>{{ row.order_no }}</TableCell>
            <TableCell>
              <span style="color: hsl(var(--primary)); font-weight: bold">
                ¥{{ ((row.amount || 0) / 100).toFixed(2) }}
              </span>
            </TableCell>
            <TableCell>{{ row.accountType }}</TableCell>
            <TableCell>{{ row.total }}</TableCell>
            <TableCell>
              <Tag :type="row.settlement === '1' ? 'success' : 'warning'">
                {{ row.settlement === '1' ? t('settlement.settled') : t('settlement.unsettled') }}
              </Tag>
            </TableCell>
            <TableCell>
              <Tag :type="row.withdrawal === '1' ? 'success' : 'info'">
                {{
                  row.withdrawal === '1' ? t('settlement.withdrawn') : t('settlement.notWithdrawn')
                }}
              </Tag>
            </TableCell>
            <TableCell>{{ formatTime(row.create_time) }}</TableCell>
            <TableCell>
              <Button variant="link" @click="handleViewDetail(row)">{{
                t('settlement.detail')
              }}</Button>
              <Button variant="link" @click="handleDelete(row)">{{
                t('settlement.delete')
              }}</Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <div
        style="margin-top: 20px; display: flex; justify-content: space-between; align-items: center"
      >
        <Button variant="outline" :disabled="selectedRows.length === 0" @click="handleBatchDelete">
          {{ t('settlement.batchDelete') }} ({{ selectedRows.length }})
        </Button>
        <Pagination
          v-if="pagination.total > 0"
          v-model:page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          layout="prev, pager, next, sizes, jumper, total"
          @size-change="loadSettlements"
          @current-change="loadSettlements"
        />
      </div>
    </CardContent></Card>

    <!-- 详情对话框 -->
    <Dialog v-model="showDetailDialog" width="800px">
      <DialogHeader>
        <DialogTitle>{{ t('settlement.settlementDetail') }}</DialogTitle>
      </DialogHeader>
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
            <Tag :type="currentSettlement.settlement === '1' ? 'success' : 'warning'">
              {{
                currentSettlement.settlement === '1'
                  ? t('settlement.settled')
                  : t('settlement.unsettled')
              }}
            </Tag>
          </el-descriptions-item>
          <el-descriptions-item :label="t('settlement.withdrawalStatus')">
            <Tag :type="currentSettlement.withdrawal === '1' ? 'success' : 'info'">
              {{
                currentSettlement.withdrawal === '1'
                  ? t('settlement.withdrawn')
                  : t('settlement.notWithdrawn')
              }}
            </Tag>
          </el-descriptions-item>
          <el-descriptions-item :label="t('settlement.createTime')">
            {{ formatTime(currentSettlement.create_time) }}
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </Dialog>

    <!-- 同步对话框 -->
    <Dialog v-model="showSyncDialog" width="500px">
      <DialogHeader>
        <DialogTitle>{{ t('settlement.syncPurchaseToSettlement') }}</DialogTitle>
      </DialogHeader>
      <form @submit.prevent>
        <div class="mb-4 flex items-center gap-4">
          <label class="w-28 shrink-0 text-sm font-medium text-foreground">{{ t('settlement.startDate') }}</label>
          <div class="flex-1">
            <el-date-picker
              v-model="syncForm.start_date"
              type="date"
              :placeholder="t('settlement.selectStartDate')"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              style="width: 100%"
            />
          </div>
        </div>
        <div class="mb-4 flex items-center gap-4">
          <label class="w-28 shrink-0 text-sm font-medium text-foreground">{{ t('settlement.endDate') }}</label>
          <div class="flex-1">
            <el-date-picker
              v-model="syncForm.end_date"
              type="date"
              :placeholder="t('settlement.selectEndDate')"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              style="width: 100%"
            />
          </div>
        </div>
        <div class="mb-4 flex items-center gap-4">
          <label class="w-28 shrink-0 text-sm font-medium text-foreground">{{ t('settlement.developerUuid') }}</label>
          <div class="flex-1">
            <Input
              v-model="syncForm.agent_order_uuid"
              :placeholder="t('settlement.developerUuidPlaceholder')"
            />
          </div>
        </div>
      </form>
      <DialogFooter>
        <Button variant="outline" @click="showSyncDialog = false">{{ t('common.cancel') }}</Button>
        <Button variant="default" @click="handleSync">{{
          t('settlement.startSync')
        }}</Button>
      </DialogFooter>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
 
import { ref, reactive, onMounted, computed } from 'vue'
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
} from '@/api/agent-settlement'
import { useAuthStore } from '@/stores/auth'
import { formatDateTime as _formatTime } from '@/utils/format'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import Button from '@/components/ui/Button.vue'
import { Pagination } from '@/components/ui/pagination'
import { Input } from '@/components/ui/input'
import { Tag } from '@/components/ui/tag'

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

const allSelected = computed(
  () =>
    settlementList.value.length > 0 &&
    settlementList.value.every(r => selectedRows.value.includes(r))
)

const toggleAll = (event: Event) => {
  const checked = (event.target as HTMLInputElement).checked
  if (checked) {
    selectedRows.value = [...settlementList.value]
  } else {
    selectedRows.value = []
  }
}

const toggleRow = (row: AgentSettlement) => {
  const idx = selectedRows.value.indexOf(row)
  if (idx >= 0) {
    selectedRows.value.splice(idx, 1)
  } else {
    selectedRows.value.push(row)
  }
}

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
const debounce = <T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout> | null = null
  return function (this: unknown, ...args: Parameters<T>) {
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
  } catch (error: unknown) {
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
  } catch (error: unknown) {
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
  } catch (error: unknown) {
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
          color: hsl(var(--primary));
        }

        &.success {
          color: hsl(var(--success));
        }

        &.warning {
          color: hsl(var(--warning));
        }
      }

      .stat-label {
        color: hsl(var(--muted-foreground));
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
