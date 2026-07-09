<template>
  <div class="agent-examine-manager">
    <el-page-header @back="goBack" class="page-header">
      <template #content>
        <h2>{{ t('agentExamine.title') }}</h2>
      </template>
    </el-page-header>

    <!-- 统计卡片 -->
    <div class="flex flex-wrap gap-5 stats-cards" v-if="stats">
      <div class="w-full sm:w-1/4">
        <Card class="transition-shadow hover:shadow-md p-5">
          <div class="stat-item">
            <div class="stat-value">{{ stats.total || 0 }}</div>
            <div class="stat-label">{{ t('agentExamine.totalExamineCount') }}</div>
          </div>
        </Card>
      </div>
      <div class="w-full sm:w-1/4">
        <Card class="transition-shadow hover:shadow-md p-5">
          <div class="stat-item">
            <div class="stat-value warning">{{ stats.pending || 0 }}</div>
            <div class="stat-label">{{ t('agentExamine.pendingExamine') }}</div>
          </div>
        </Card>
      </div>
      <div class="w-full sm:w-1/4">
        <Card class="transition-shadow hover:shadow-md p-5">
          <div class="stat-item">
            <div class="stat-value success">{{ stats.approved || 0 }}</div>
            <div class="stat-label">{{ t('agentExamine.approvedExamine') }}</div>
          </div>
        </Card>
      </div>
      <div class="w-full sm:w-1/4">
        <Card class="transition-shadow hover:shadow-md p-5">
          <div class="stat-item">
            <div class="stat-value danger">{{ stats.rejected || 0 }}</div>
            <div class="stat-label">{{ t('agentExamine.rejectedExamine') }}</div>
          </div>
        </Card>
      </div>
    </div>

    <Card class="main-card shadow-none"><CardHeader>
        <div class="card-header">
          <span>{{ t('agentExamine.examineList') }}</span>
          <div style="display: flex; gap: 10px">
            <Input
              v-model="searchKeyword"
              :placeholder="t('agentExamine.searchPlaceholder')"
              style="width: 240px"
              clearable
              @input="debouncedLoadExamines"
            />
            <Select v-model="filterStatus" @change="loadExamines" style="width: 120px" clearable>
              <SelectOption :label="t('agentExamine.allStatus')" value="" />
              <SelectOption :label="t('agentExamine.examining')" :value="1" />
              <SelectOption :label="t('agentExamine.approved')" :value="2" />
              <SelectOption :label="t('agentExamine.rejected')" :value="3" />
              <SelectOption :label="t('agentExamine.returned')" :value="4" />
            </Select>
            <Button variant="outline" @click="loadExamines">
              <RefreshCw class="h-4 w-4" />
              {{ t('common.refresh') }}
            </Button>
          </div>
        </div>
      </CardHeader><CardContent class="p-5">
      
      <Empty
        v-if="!loading && examineList.length === 0"
        :description="t('agentExamine.noExamineRecords')"
        :image-size="120"
      />
      <div v-else-if="loading" class="flex justify-center py-8 text-muted-foreground">Loading...</div>
      <Table v-else>
        <TableHeader>
          <TableRow>
            <TableHead class="w-[55px]"><input type="checkbox" :checked="allSelected" @change="toggleAll($event)" /></TableHead>
            <TableHead class="min-w-[150px]">{{ t('agentCategory.agentName') }}</TableHead>
            <TableHead class="w-[120px]">{{ t('agentCategory.agentId') }}</TableHead>
            <TableHead class="w-[120px]">{{ t('agentExamine.initiator') }}</TableHead>
            <TableHead class="w-[100px]">{{ t('agentExamine.status') }}</TableHead>
            <TableHead class="w-[180px]">{{ t('agentExamine.startTime') }}</TableHead>
            <TableHead class="w-[180px]">{{ t('agentExamine.examineTime') }}</TableHead>
            <TableHead class="w-[120px]">{{ t('agentExamine.examiner') }}</TableHead>
            <TableHead class="w-[200px]">{{ t('common.actions') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="(row, index) in examineList" :key="row.id ?? index">
            <TableCell class="w-[55px]"><input type="checkbox" :checked="selectedRows.includes(row)" @change="toggleRow(row)" /></TableCell>
            <TableCell>
              <div style="display: flex; align-items: center; gap: 8px">
                <Avatar
                  v-if="row.agent_avatar"
                  :src="row.agent_avatar"
                  :size="32"
                  shape="square"
                />
                <span>{{ row.agent_name }}</span>
              </div>
            </TableCell>
            <TableCell>{{ row.agent_id }}</TableCell>
            <TableCell>{{ row.start_name }}</TableCell>
            <TableCell>
              <Tag :type="getStatusTagType(row.status)">
                {{ getStatusText(row.status) }}
              </Tag>
            </TableCell>
            <TableCell>{{ formatTime(row.start_time) }}</TableCell>
            <TableCell>{{ row.examine_time ? formatTime(row.examine_time) : '-' }}</TableCell>
            <TableCell>{{ row.examine_user }}</TableCell>
            <TableCell>
              <Button variant="link" @click="handleViewDetail(row)">{{
                t('agentExamine.detail')
              }}</Button>
              <Button
                variant="link"
                @click="handleSyncAvatar(row)"
              >
                {{ t('agentExamine.syncAvatar') }}
              </Button>
              <Button v-if="row.status === 1" variant="link" @click="handleApprove(row)">
                {{ t('agentExamine.approve') }}
              </Button>
              <Button v-if="row.status === 1" variant="link" @click="handleReject(row)">
                {{ t('agentExamine.reject') }}
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <Pagination
        v-if="pagination.total > 0"
        v-model:page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        layout="prev, pager, next, sizes, jumper, total"
        @size-change="loadExamines"
        @current-change="loadExamines"
        style="margin-top: 20px"
      />
    </CardContent></Card>

    <!-- 详情对话框 -->
    <Dialog v-model="showDetailDialog" width="800px">
      <DialogHeader>
        <DialogTitle>{{ t('agentExamine.examineDetail') }}</DialogTitle>
      </DialogHeader>
      <div v-if="currentExamine" class="examine-detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item :label="t('agentCategory.agentName')">
            {{ currentExamine.agent_name }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('agentCategory.agentId')">
            {{ currentExamine.agent_id }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('agentExamine.initiator')">
            {{ currentExamine.start_name }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('agentExamine.startTime')">
            {{ formatTime(currentExamine.start_time) }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('agentExamine.status')">
            <Tag :type="getStatusTagType(currentExamine.status)">
              {{ getStatusText(currentExamine.status) }}
            </Tag>
          </el-descriptions-item>
          <el-descriptions-item :label="t('agentExamine.examiner')">
            {{ currentExamine.examine_user || '-' }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('agentExamine.examineTime')">
            {{ currentExamine.examine_time ? formatTime(currentExamine.examine_time) : '-' }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('agentExamine.description')" :span="2">
            {{ currentExamine.desc || '-' }}
          </el-descriptions-item>
        </el-descriptions>
        <div v-if="currentExamine.category_info" style="margin-top: 20px">
          <h4>{{ t('agentExamine.categoryInfo') }}</h4>
          <el-descriptions :column="2" border>
            <el-descriptions-item :label="t('agentCategory.type')">
              {{ getTypeText(currentExamine.category_info.type) }}
            </el-descriptions-item>
            <el-descriptions-item :label="t('agentCategory.price')">
              <span v-if="currentExamine.category_info.account">
                ¥{{ (currentExamine.category_info.account / 100).toFixed(2) }}/{{
                  t('agentCategory.pricePerMonth')
                }}
              </span>
              <span v-else>-</span>
            </el-descriptions-item>
          </el-descriptions>
        </div>
      </div>
    </Dialog>

    <!-- 审核对话框 -->
    <Dialog v-model="showReviewDialog" width="500px">
      <DialogHeader>
        <DialogTitle>
          {{
            reviewAction === 'approve'
              ? t('agentExamine.approveExamine')
              : t('agentExamine.rejectExamine')
          }}
        </DialogTitle>
      </DialogHeader>
      <form @submit.prevent>
        <div class="mb-4 flex items-center gap-4">
          <label class="w-24 shrink-0 text-sm font-medium text-foreground">{{ t('agentExamine.description') }}</label>
          <div class="flex-1">
            <Textarea
              v-model="reviewForm.desc"
              :rows="4"
              :placeholder="
                reviewAction === 'approve'
                  ? t('agentExamine.approveReasonPlaceholder')
                  : t('agentExamine.rejectReasonPlaceholder')
              "
            />
          </div>
        </div>
      </form>
      <DialogFooter>
        <Button variant="outline" @click="showReviewDialog = false">{{ t('common.cancel') }}</Button>
        <Button variant="default" @click="handleSubmitReview">
          {{ t('common.confirm') }}
        </Button>
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
  getAgentExamineList,
  getAgentExamineDetail,
  getAgentExamineStats,
  approveAgentExamine,
  rejectAgentExamine,
  syncAgentAvatar,
  batchSyncAgentAvatar,
  type AgentExamine,
  type AgentExamineStats,
} from '@/api/agent-examine'
import { useAuthStore } from '@/stores/auth'
import { formatDateTime as _formatTime } from '@/utils/format'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import Button from '@/components/ui/Button.vue'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tag } from '@/components/ui/tag'
import { Avatar } from '@/components/ui/avatar'
import { Pagination } from '@/components/ui/pagination'
import { Empty } from '@/components/ui/empty'
import { Select, SelectOption } from '@/components/ui/select'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const {
  handleResult,
  showSuccess: _showSuccess,
  showError: showErrorMsg,
  showWarning,
} = useOperationFeedback()
const { confirmDelete: _confirmDelete } = useConfirmDialog()
const { loading, error: pageError } = usePageState()

const examineList = ref<AgentExamine[]>([])
const searchKeyword = ref('')
const filterStatus = ref<number | ''>('')
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
})

const stats = ref<AgentExamineStats | null>(null)

const showDetailDialog = ref(false)
const currentExamine = ref<AgentExamine | null>(null)

const showReviewDialog = ref(false)
const reviewAction = ref<'approve' | 'reject'>('approve')
const reviewSubmitting = ref(false)
const reviewForm = reactive({
  desc: '',
})
const syncingAvatar = ref<string | null>(null)
const selectedRows = ref<AgentExamine[]>([])

const allSelected = computed(
  () =>
    examineList.value.length > 0 &&
    examineList.value.every(r => selectedRows.value.includes(r))
)

const toggleAll = (event: Event) => {
  const checked = (event.target as HTMLInputElement).checked
  if (checked) {
    selectedRows.value = [...examineList.value]
  } else {
    selectedRows.value = []
  }
}

const toggleRow = (row: AgentExamine) => {
  const idx = selectedRows.value.indexOf(row)
  if (idx >= 0) {
    selectedRows.value.splice(idx, 1)
  } else {
    selectedRows.value.push(row)
  }
}

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

const loadExamines = async () => {
  loading.value = true
  pageError.value = null
  try {
    const response = await getAgentExamineList({
      page: pagination.page,
      pageSize: pagination.pageSize,
      keyword: searchKeyword.value || undefined,
      status: filterStatus.value ? Number(filterStatus.value) : undefined,
    })
    if (response.code === 200 || response.success) {
      examineList.value = response.data?.list || []
      pagination.total = response.data?.pagination?.total || 0
    } else {
      const errorMsg = response.message || t('agentExamine.loadFailed')
      pageError.value = {
        type: ApiErrorType.BUSINESS,
        code: response.code,
        message: errorMsg,
      }
      showErrorMsg(errorMsg)
    }
  } catch (error: unknown) {
    const errorMsg =
      (error instanceof Error ? error.message : String(error)) || t('agentExamine.loadFailed')
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

const debouncedLoadExamines = debounce(loadExamines, 300)

const loadStats = async () => {
  try {
    const response = await getAgentExamineStats()
    if (response.code === 200 || response.success) {
      stats.value = response.data as AgentExamineStats
    }
  } catch (_error) {
    // 静默失败
  }
}

const handleViewDetail = async (examine: AgentExamine) => {
  try {
    const response = await getAgentExamineDetail(examine.id)
    if (response.code === 200 || response.success) {
      currentExamine.value = response.data as AgentExamine
      showDetailDialog.value = true
    }
  } catch (error: unknown) {
    showErrorMsg(
      (error instanceof Error ? error.message : String(error)) || t('agentExamine.loadDetailFailed')
    )
  }
}

const handleApprove = (examine: AgentExamine) => {
  currentExamine.value = examine
  reviewAction.value = 'approve'
  reviewForm.desc = ''
  showReviewDialog.value = true
}

const handleReject = (examine: AgentExamine) => {
  currentExamine.value = examine
  reviewAction.value = 'reject'
  reviewForm.desc = ''
  showReviewDialog.value = true
}

// 同步单个智能体头像
const handleSyncAvatar = async (examine: AgentExamine) => {
  syncingAvatar.value = examine.id
  try {
    await handleResult(syncAgentAvatar(examine.agent_id), {
      successMessage: t('agentExamine.avatarSyncSuccess'),
      errorMessage: t('agentExamine.avatarSyncFailed'),
      onSuccess: () => {
        loadExamines()
      },
    })
  } catch (error: unknown) {
    showErrorMsg(
      (error instanceof Error ? error.message : String(error)) || t('agentExamine.avatarSyncFailed')
    )
  } finally {
    syncingAvatar.value = null
  }
}

// 批量同步头像
const _handleBatchSyncAvatar = async () => {
  if (selectedRows.value.length === 0) {
    showWarning(t('agentExamine.pleaseSelectAgents'))
    return
  }
  try {
    const agentIds = selectedRows.value.map(r => r.agent_id)
    await handleResult(batchSyncAgentAvatar(agentIds), {
      successMessage: t('agentExamine.batchSyncSuccess'),
      errorMessage: t('agentExamine.batchSyncFailed'),
      onSuccess: () => {
        selectedRows.value = []
        loadExamines()
      },
    })
  } catch (error: unknown) {
    showErrorMsg(
      (error instanceof Error ? error.message : String(error)) || t('agentExamine.batchSyncFailed')
    )
  }
}

const handleSubmitReview = async () => {
  if (!currentExamine.value) return
  if (reviewAction.value === 'reject' && !reviewForm.desc.trim()) {
    showWarning(t('agentExamine.pleaseInputRejectReason'))
    return
  }
  reviewSubmitting.value = true
  try {
    const data = {
      desc: reviewForm.desc,
      examine_user:
        (authStore.user as { name?: string; uuid?: string })?.name ||
        (authStore.user as { name?: string; uuid?: string })?.uuid ||
        '',
      examine_user_id: (authStore.user as { uuid?: string })?.uuid || '',
    }
    const apiCall =
      reviewAction.value === 'approve'
        ? approveAgentExamine(currentExamine.value.id, data)
        : rejectAgentExamine(currentExamine.value.id, data)

    await handleResult(apiCall, {
      successMessage:
        reviewAction.value === 'approve'
          ? t('agentExamine.approveExamine')
          : t('agentExamine.rejectExamine'),
      errorMessage: t('agentExamine.operationFailed'),
      onSuccess: () => {
        showReviewDialog.value = false
        Promise.all([loadExamines(), loadStats()])
      },
    })
  } catch (error: unknown) {
    showErrorMsg(
      (error instanceof Error ? error.message : String(error)) || t('agentExamine.operationFailed')
    )
  } finally {
    reviewSubmitting.value = false
  }
}

const getStatusText = (status?: number): string => {
  const map: Record<number, string> = {
    0: t('agentExamine.statusPending'),
    1: t('agentExamine.statusExamining'),
    2: t('agentExamine.statusApproved'),
    3: t('agentExamine.statusRejected'),
    4: t('agentExamine.statusReturned'),
  }
  return map[status || 0] || t('agentExamine.unknown')
}

const getStatusTagType = (status?: number): string => {
  const map: Record<number, string> = {
    0: 'info',
    1: 'warning',
    2: 'success',
    3: 'danger',
    4: 'info',
  }
  return map[status || 0] || 'info'
}

const getTypeText = (type?: string): string => {
  const map: Record<string, string> = {
    '1': t('agentExamine.typeFree'),
    '2': t('agentExamine.typeLimitedFree'),
    '3': t('agentExamine.typePaid'),
  }
  return map[type || ''] || t('agentExamine.typeUnknown')
}

const formatTime = (time?: string): string => {
  return time ? _formatTime(time) : '-'
}

const goBack = () => {
  router.back()
}

onMounted(() => {
  loadExamines()
  loadStats()
})
</script>

<style scoped lang="scss">
.agent-examine-manager {
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

        &.warning {
          color: var(--el-color-warning);
        }

        &.success {
          color: var(--el-color-success);
        }

        &.danger {
          color: var(--el-color-danger);
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

  .examine-detail {
    h4 {
      margin-bottom: 10px;
    }
  }
}
</style>
