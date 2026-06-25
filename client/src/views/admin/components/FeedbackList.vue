<template>
  <AdminListPage
    :title="t('adminComponents.feedback.title')"
    :description="t('adminComponents.feedback.desc')"
    :columns="columns"
    :data="feedbacks"
    :total="total"
    :loading="loading"
    :show-selection="true"
    :show-index="true"
    @search="handleSearch"
    @refresh="fetchFeedbacks"
    @page-change="handlePageChange"
    @size-change="handleSizeChange"
    @selection-change="handleSelectionChange"
  >
    <template #filters>
      <el-form-item :label="t('adminComponents.feedback.filterStatus')">
        <el-select v-model="filterStatus" :placeholder="t('adminComponents.feedback.statusAll')" clearable @change="fetchFeedbacks">
          <el-option :label="t('adminComponents.feedback.statusPending')" value="pending" />
          <el-option :label="t('adminComponents.feedback.statusProcessing')" value="processing" />
          <el-option :label="t('adminComponents.feedback.statusResolved')" value="resolved" />
          <el-option :label="t('adminComponents.feedback.statusClosed')" value="closed" />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('adminComponents.feedback.filterType')">
        <el-select v-model="filterType" :placeholder="t('adminComponents.feedback.typeAll')" clearable @change="fetchFeedbacks">
          <el-option :label="t('adminComponents.feedback.typeBug')" value="bug" />
          <el-option :label="t('adminComponents.feedback.typeFeature')" value="feature" />
          <el-option :label="t('adminComponents.feedback.typeUx')" value="ux" />
          <el-option :label="t('adminComponents.feedback.typeOther')" value="other" />
        </el-select>
      </el-form-item>
    </template>

    <template #col-type="{ row }">
      <el-tag :type="getTypeStyle(row.type)">
        {{ getTypeText(row.type) }}
      </el-tag>
    </template>

    <template #col-status="{ row }">
      <el-tag :type="getStatusStyle(row.status)">
        {{ getStatusText(row.status) }}
      </el-tag>
    </template>

    <template #col-priority="{ row }">
      <el-tag :type="getPriorityStyle(row.priority)" size="small">
        {{ getPriorityText(row.priority) }}
      </el-tag>
    </template>

    <template #actions="{ row }">
      <el-button type="primary" link size="small" @click="viewFeedback(row)">
        {{ t('adminComponents.feedback.detail') }}
      </el-button>
      <el-button
        v-if="row.status === 'pending'"
        type="warning"
        link
        size="small"
        @click="processFeedback(row)"
      >
        {{ t('adminComponents.feedback.process') }}
      </el-button>
      <el-button
        v-if="['pending', 'processing'].includes(row.status)"
        type="success"
        link
        size="small"
        @click="resolveFeedback(row)"
      >
        {{ t('adminComponents.feedback.resolve') }}
      </el-button>
      <el-button
        v-if="row.status !== 'closed'"
        type="info"
        link
        size="small"
        @click="closeFeedback(row)"
      >
        {{ t('adminComponents.feedback.close') }}
      </el-button>
    </template>
  </AdminListPage>

  <el-dialog v-model="detailVisible" :title="t('adminComponents.feedback.detailTitle')" width="600px">
    <el-descriptions v-if="currentFeedback" :column="2" border>
      <el-descriptions-item :label="t('adminComponents.feedback.labelId')">{{ currentFeedback.id }}</el-descriptions-item>
      <el-descriptions-item :label="t('adminComponents.feedback.labelUser')">{{ currentFeedback.userName }}</el-descriptions-item>
      <el-descriptions-item :label="t('adminComponents.feedback.labelType')">{{ getTypeText(currentFeedback.type) }}</el-descriptions-item>
      <el-descriptions-item :label="t('adminComponents.feedback.labelStatus')">{{ getStatusText(currentFeedback.status) }}</el-descriptions-item>
      <el-descriptions-item :label="t('adminComponents.feedback.labelPriority')">{{ getPriorityText(currentFeedback.priority) }}</el-descriptions-item>
      <el-descriptions-item :label="t('adminComponents.feedback.labelCreatedAt')">{{ currentFeedback.createdAt }}</el-descriptions-item>
      <el-descriptions-item :label="t('adminComponents.feedback.labelContent')" :span="2">{{ currentFeedback.content }}</el-descriptions-item>
    </el-descriptions>
    <div v-if="currentFeedback?.images?.length" class="feedback-images">
      <h4>{{ t('adminComponents.feedback.screenshots') }}</h4>
      <el-image
        v-for="(img, index) in currentFeedback.images"
        :key="index"
        :src="img"
        :preview-src-list="currentFeedback.images"
        style="width: 100px; height: 100px; margin-right: 10px"
        fit="cover"
      />
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import AdminListPage from '@/components/admin/AdminListPage.vue'
import type { TableColumn } from '@/components/admin/AdminListPage.vue'
import {
  getFeedbacks,
  updateFeedbackStatus,
  type Feedback as ApiFeedback,
  type FeedbackStatus,
} from '@/api/content/feedback'

interface Feedback {
  id: string
  userId: string
  userName: string
  type: string
  status: string
  priority: string
  content: string
  images?: string[]
  createdAt: string
  updatedAt: string
}

const { t } = useI18n()

function mapApiToFeedback(api: ApiFeedback): Feedback {
  return {
    id: api.id,
    userId: api.userId ?? '',
    userName: api.userId ?? '-',
    type: api.type === 'experience' ? 'ux' : api.type,
    status: api.status,
    priority: 'medium',
    content: api.content,
    images: api.images,
    createdAt: api.createTime ?? '',
    updatedAt: api.updateTime ?? '',
  }
}

const columns = computed<TableColumn[]>(() => [
  { prop: 'userName', label: t('adminComponents.feedback.colUser'), width: 120 },
  { prop: 'type', label: t('adminComponents.feedback.labelType'), width: 100, slot: true },
  { prop: 'content', label: t('adminComponents.feedback.colContent'), minWidth: 200, showOverflowTooltip: true },
  { prop: 'priority', label: t('adminComponents.feedback.colPriority'), width: 80, slot: true },
  { prop: 'status', label: t('adminComponents.feedback.labelStatus'), width: 100, slot: true },
  { prop: 'createdAt', label: t('adminComponents.feedback.colCreatedAt'), width: 180, type: 'date' },
])

const feedbacks = ref<Feedback[]>([])
const total = ref(0)
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const filterStatus = ref('')
const filterType = ref('')
const detailVisible = ref(false)
const currentFeedback = ref<Feedback | null>(null)

const typeMap = computed<Record<string, { text: string; style: string }>>(() => ({
  bug: { text: t('adminComponents.feedback.typeBug'), style: 'danger' },
  feature: { text: t('adminComponents.feedback.typeFeature'), style: 'primary' },
  ux: { text: t('adminComponents.feedback.typeUx'), style: 'warning' },
  other: { text: t('adminComponents.feedback.typeOther'), style: 'info' },
}))

const statusMap = computed<Record<string, { text: string; style: string }>>(() => ({
  pending: { text: t('adminComponents.feedback.statusPending'), style: 'warning' },
  processing: { text: t('adminComponents.feedback.statusProcessing'), style: 'primary' },
  resolved: { text: t('adminComponents.feedback.statusResolved'), style: 'success' },
  closed: { text: t('adminComponents.feedback.statusClosed'), style: 'info' },
}))

const priorityMap = computed<Record<string, { text: string; style: string }>>(() => ({
  high: { text: t('adminComponents.feedback.priorityHigh'), style: 'danger' },
  medium: { text: t('adminComponents.feedback.priorityMedium'), style: 'warning' },
  low: { text: t('adminComponents.feedback.priorityLow'), style: 'info' },
}))

const getTypeText = (type: string): string => typeMap.value[type]?.text || type
const getTypeStyle = (type: string): string => typeMap.value[type]?.style || 'info'
const getStatusText = (status: string): string => statusMap.value[status]?.text || status
const getStatusStyle = (status: string): string => statusMap.value[status]?.style || 'info'
const getPriorityText = (priority: string): string => priorityMap.value[priority]?.text || priority
const getPriorityStyle = (priority: string): string => priorityMap.value[priority]?.style || 'info'

const fetchFeedbacks = async () => {
  loading.value = true
  try {
    const typeParam = filterType.value === 'ux' ? 'experience' : filterType.value
    const res = await getFeedbacks({
      page: currentPage.value,
      pageSize: pageSize.value,
      type: typeParam as ApiFeedback['type'] | undefined,
      status: filterStatus.value as FeedbackStatus | undefined,
    })
    if (res?.success && res.data) {
      const list = res.data.list ?? []
      feedbacks.value = list.map(mapApiToFeedback)
      total.value = res.data.total ?? 0
    } else {
      feedbacks.value = []
      total.value = 0
      if (res && res.code !== 200) ElMessage.warning(res.message || '加载失败')
    }
  } finally {
    loading.value = false
  }
}

const handleSearch = (_keyword: string) => {
  fetchFeedbacks()
}

const handlePageChange = (page: number) => {
  currentPage.value = page
  fetchFeedbacks()
}

const handleSizeChange = (size: number) => {
  pageSize.value = size
  fetchFeedbacks()
}

const handleSelectionChange = (_rows: any[]) => {
  // 选择变更
}

const viewFeedback = (feedback: Feedback) => {
  currentFeedback.value = feedback
  detailVisible.value = true
}

const processFeedback = async (feedback: Feedback) => {
  const res = await updateFeedbackStatus(feedback.id, 'processing')
  if (res?.success) {
    ElMessage.success(t('adminFeedbackList.setProcessing'))
    fetchFeedbacks()
  } else {
    ElMessage.error(res?.message || '操作失败')
  }
}

const resolveFeedback = async (feedback: Feedback) => {
  const res = await updateFeedbackStatus(feedback.id, 'resolved')
  if (res?.success) {
    ElMessage.success(t('adminFeedbackList.resolved'))
    fetchFeedbacks()
  } else {
    ElMessage.error(res?.message || '操作失败')
  }
}

const closeFeedback = async (feedback: Feedback) => {
  const res = await updateFeedbackStatus(feedback.id, 'closed')
  if (res?.success) {
    ElMessage.success(t('adminFeedbackList.closed'))
    fetchFeedbacks()
  } else {
    ElMessage.error(res?.message || '操作失败')
  }
}

onMounted(() => {
  fetchFeedbacks()
})
</script>

<style scoped>
.feedback-images {
  margin-top: 20px;
}

.feedback-images h4 {
  margin-bottom: 10px;
}
</style>
