<template>
  <AdminListPage
    :title="t('adminComponents.activity.title')"
    :description="t('adminComponents.activity.desc')"
    :columns="columns"
    :data="activities"
    :total="total"
    :loading="loading"
    :show-selection="true"
    :show-index="true"
    @search="handleSearch"
    @refresh="fetchActivities"
    @page-change="handlePageChange"
    @size-change="handleSizeChange"
    @selection-change="handleSelectionChange"
  >
    <template #filters>
      <el-form-item :label="t('adminCommon.label.type')">
        <el-select v-model="filterType" :placeholder="t('adminCommon.placeholder.allTypes')" clearable @change="fetchActivities">
          <el-option :label="t('adminCommon.label.login')" value="login" />
          <el-option :label="t('adminCommon.label.operation')" value="operation" />
          <el-option :label="t('adminCommon.label.payment')" value="payment" />
          <el-option :label="t('adminCommon.label.system')" value="system" />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('adminCommon.label.status')">
        <el-select v-model="filterStatus" :placeholder="t('adminCommon.placeholder.allStatus')" clearable @change="fetchActivities">
          <el-option :label="t('adminCommon.label.success')" value="success" />
          <el-option :label="t('adminCommon.label.failed')" value="failed" />
        </el-select>
      </el-form-item>
    </template>

    <template #col-type="{ row }">
      <el-tag :type="getTypeStyle(row.type)">
        {{ getTypeText(row.type) }}
      </el-tag>
    </template>

    <template #col-status="{ row }">
      <el-tag :type="row.status === 'success' ? 'success' : 'danger'">
        {{ row.status === 'success' ? t('adminCommon.label.success') : t('adminCommon.label.failed') }}
      </el-tag>
    </template>

    <template #col-ip="{ row }">
      <el-tooltip :content="row.ip" placement="top">
        <span class="ip-text">{{ row.ip }}</span>
      </el-tooltip>
    </template>

    <template #actions="{ row }">
      <el-button type="primary" link size="small" @click="viewDetail(row)">
        {{ t('adminCommon.label.detail') }}
      </el-button>
    </template>
  </AdminListPage>

  <el-dialog v-model="detailVisible" :title="t('adminCommon.title.activityDetail')" width="600px">
    <el-descriptions v-if="currentActivity" :column="2" border>
      <el-descriptions-item :label="t('adminCommon.label.activityId')">{{ currentActivity.id }}</el-descriptions-item>
      <el-descriptions-item :label="t('adminCommon.label.user')">{{ currentActivity.userName }}</el-descriptions-item>
      <el-descriptions-item :label="t('adminCommon.label.type')">{{ getTypeText(currentActivity.type) }}</el-descriptions-item>
      <el-descriptions-item :label="t('adminCommon.label.status')">{{ currentActivity.status === 'success' ? t('adminCommon.label.success') : t('adminCommon.label.failed') }}</el-descriptions-item>
      <el-descriptions-item :label="t('adminCommon.label.ipAddress')">{{ currentActivity.ip }}</el-descriptions-item>
      <el-descriptions-item :label="t('adminCommon.label.device')">{{ currentActivity.device }}</el-descriptions-item>
      <el-descriptions-item :label="t('adminCommon.label.time')">{{ currentActivity.createdAt }}</el-descriptions-item>
      <el-descriptions-item :label="t('adminCommon.label.description')" :span="2">{{ currentActivity.description }}</el-descriptions-item>
    </el-descriptions>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import AdminListPage from '@/components/admin/AdminListPage.vue'
import type { TableColumn } from '@/components/admin/AdminListPage.vue'
import { getAdminActivities, type AdminActivity } from '@/api/admin-activities'

const { t } = useI18n()

const columns: TableColumn[] = [
  { prop: 'userName', label: t('adminCommon.label.user'), width: 120 },
  { prop: 'type', label: t('adminCommon.label.type'), width: 100, slot: true },
  { prop: 'description', label: t('adminCommon.label.description'), minWidth: 200, showOverflowTooltip: true },
  { prop: 'ip', label: t('adminCommon.label.ipAddress'), width: 140, slot: true },
  { prop: 'status', label: t('adminCommon.label.status'), width: 80, slot: true },
  { prop: 'createdAt', label: t('adminCommon.label.time'), width: 180, type: 'date' },
]

const activities = ref<AdminActivity[]>([])
const total = ref(0)
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const filterType = ref('')
const filterStatus = ref('')
const detailVisible = ref(false)
const currentActivity = ref<AdminActivity | null>(null)

const typeMap: Record<string, { text: string; style: string }> = {
  login: { text: t('adminCommon.label.login'), style: 'primary' },
  operation: { text: t('adminCommon.label.operation'), style: 'warning' },
  payment: { text: t('adminCommon.label.payment'), style: 'success' },
  system: { text: t('adminCommon.label.system'), style: 'info' },
}

const getTypeText = (type: string): string => typeMap[type]?.text || type
const getTypeStyle = (type: string): string => typeMap[type]?.style || 'info'

const fetchActivities = async () => {
  loading.value = true
  try {
    const res = await getAdminActivities({
      page: currentPage.value,
      pageSize: pageSize.value,
      type: filterType.value || undefined,
      status: filterStatus.value || undefined,
    })
    if (res.success && res.data) {
      activities.value = res.data.list ?? []
      total.value = res.data.total ?? 0
    } else {
      activities.value = []
      total.value = 0
      if (res.code !== 200) ElMessage.warning(res.message || t('adminCommon.label.loadFailed'))
    }
  } finally {
    loading.value = false
  }
}

const handleSearch = (_keyword: string) => {
  fetchActivities()
}

const handlePageChange = (page: number) => {
  currentPage.value = page
  fetchActivities()
}

const handleSizeChange = (size: number) => {
  pageSize.value = size
  fetchActivities()
}

const handleSelectionChange = (_rows: unknown[]) => {
  // 选中处理
}

const viewDetail = (activity: AdminActivity) => {
  currentActivity.value = activity
  detailVisible.value = true
}

onMounted(() => {
  fetchActivities()
})
</script>

<style scoped>
.ip-text {
  font-family: monospace;
  font-size: 12px;
}
</style>
