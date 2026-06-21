<template>
  <div class="agent-examine-manager">
    <el-page-header @back="goBack" class="page-header">
      <template #content>
        <h2>{{ t('agentExamine.title') }}</h2>
      </template>
    </el-page-header>

    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stats-cards" v-if="stats">
      <el-col :xs="24" :sm="6">
        <el-card shadow="hover">
          <div class="stat-item">
            <div class="stat-value">{{ stats.total || 0 }}</div>
            <div class="stat-label">{{ t('agentExamine.totalExamineCount') }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="6">
        <el-card shadow="hover">
          <div class="stat-item">
            <div class="stat-value warning">{{ stats.pending || 0 }}</div>
            <div class="stat-label">{{ t('agentExamine.pendingExamine') }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="6">
        <el-card shadow="hover">
          <div class="stat-item">
            <div class="stat-value success">{{ stats.approved || 0 }}</div>
            <div class="stat-label">{{ t('agentExamine.approvedExamine') }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="6">
        <el-card shadow="hover">
          <div class="stat-item">
            <div class="stat-value danger">{{ stats.rejected || 0 }}</div>
            <div class="stat-label">{{ t('agentExamine.rejectedExamine') }}</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" class="main-card">
      <template #header>
        <div class="card-header">
          <span>{{ t('agentExamine.examineList') }}</span>
          <div style="display: flex; gap: 10px">
            <el-input
              v-model="searchKeyword"
              :placeholder="t('agentExamine.searchPlaceholder')"
              style="width: 240px"
              clearable
              @input="debouncedLoadExamines"
            />
            <el-select v-model="filterStatus" @change="loadExamines" style="width: 120px" clearable>
              <el-option :label="t('agentExamine.allStatus')" value="" />
              <el-option :label="t('agentExamine.examining')" :value="1" />
              <el-option :label="t('agentExamine.approved')" :value="2" />
              <el-option :label="t('agentExamine.rejected')" :value="3" />
              <el-option :label="t('agentExamine.returned')" :value="4" />
            </el-select>
            <el-button @click="loadExamines">
              <el-icon><RefreshCw /></el-icon>
              {{ t('common.refresh') }}
            </el-button>
          </div>
        </div>
      </template>

      <el-empty
        v-if="!loading && examineList.length === 0"
        :description="t('agentExamine.noExamineRecords')"
        :image-size="120"
      />
      <el-table
        v-else
        :data="examineList"
        stripe
        v-loading="loading"
        @selection-change="selectedRows = $event"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="agent_name" :label="t('agentCategory.agentName')" min-width="150">
          <template #default="{ row }">
            <div style="display: flex; align-items: center; gap: 8px">
              <el-avatar
                v-if="row.agent_avatar"
                :src="row.agent_avatar"
                :size="32"
                shape="square"
              />
              <span>{{ row.agent_name }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="agent_id" :label="t('agentCategory.agentId')" width="120" />
        <el-table-column prop="start_name" :label="t('agentExamine.initiator')" width="120" />
        <el-table-column :label="t('agentExamine.status')" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="start_time" :label="t('agentExamine.startTime')" width="180">
          <template #default="{ row }">
            {{ formatTime(row.start_time) }}
          </template>
        </el-table-column>
        <el-table-column prop="examine_time" :label="t('agentExamine.examineTime')" width="180">
          <template #default="{ row }">
            {{ row.examine_time ? formatTime(row.examine_time) : '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="examine_user" :label="t('agentExamine.examiner')" width="120" />
        <el-table-column :label="t('common.actions')" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="handleViewDetail(row)">{{
              t('agentExamine.detail')
            }}</el-button>
            <el-button
              link
              type="info"
              @click="handleSyncAvatar(row)"
              :loading="syncingAvatar === row.id"
            >
              {{ t('agentExamine.syncAvatar') }}
            </el-button>
            <el-button v-if="row.status === 1" link type="success" @click="handleApprove(row)">
              {{ t('agentExamine.approve') }}
            </el-button>
            <el-button v-if="row.status === 1" link type="danger" @click="handleReject(row)">
              {{ t('agentExamine.reject') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-if="pagination.total > 0"
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        layout="prev, pager, next, sizes, jumper, total"
        @size-change="loadExamines"
        @current-change="loadExamines"
        style="margin-top: 20px"
      />
    </el-card>

    <!-- 详情对话框 -->
    <el-dialog v-model="showDetailDialog" :title="t('agentExamine.examineDetail')" width="800px">
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
            <el-tag :type="getStatusTagType(currentExamine.status)">
              {{ getStatusText(currentExamine.status) }}
            </el-tag>
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
    </el-dialog>

    <!-- 审核对话框 -->
    <el-dialog
      v-model="showReviewDialog"
      :title="
        reviewAction === 'approve'
          ? t('agentExamine.approveExamine')
          : t('agentExamine.rejectExamine')
      "
      width="500px"
    >
      <el-form :model="reviewForm" label-width="100px">
        <el-form-item :label="t('agentExamine.description')" required>
          <el-input
            v-model="reviewForm.desc"
            type="textarea"
            :rows="4"
            :placeholder="
              reviewAction === 'approve'
                ? t('agentExamine.approveReasonPlaceholder')
                : t('agentExamine.rejectReasonPlaceholder')
            "
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showReviewDialog = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="reviewSubmitting" @click="handleSubmitReview">
          {{ t('common.confirm') }}
        </el-button>
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
  } catch (error: any) {
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
  } catch (error: any) {
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
  } catch (error: any) {
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
  } catch (error: any) {
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
  } catch (error: any) {
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
  ;(router as any).back()
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
