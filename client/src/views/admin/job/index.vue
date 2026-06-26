<template>
  <AdminTableV2
    :data="list"
    :columns="columns"
    :total="total"
    :page="page"
    :size="size"
    :loading="loading"
    :keyword="keyword"
    search-placeholder="请输入任务名称"
    :selectable="true"
    row-key="job_id"
    @search="onSearch"
    @page-change="onPageChange"
    @add="onAdd"
    @batch-delete="onBatchDelete"
  >
    <template #toolbar>
      <el-select v-model="statusFilter" placeholder="状态" clearable class="filter-select" @change="onFilter">
        <el-option label="正常" value="0" />
        <el-option label="暂停" value="1" />
      </el-select>
      <el-select v-model="groupFilter" placeholder="任务组" clearable class="filter-select" @change="onFilter">
        <el-option label="DEFAULT" value="DEFAULT" />
        <el-option label="SYSTEM" value="SYSTEM" />
      </el-select>
      <el-button :icon="Document" @click="goLog">执行日志</el-button>
    </template>
  </AdminTableV2>
  <AdminEditDialog
    v-model:visible="dialogVisible"
    :mode="dialogMode"
    :fields="formFields"
    :form-data="formData"
    :submitting="submitting"
    @submit="onSubmit"
    @submit-continue="onSubmitContinue"
  />
</template>

<script setup lang="ts">
import { ref, onMounted, h } from 'vue'
import { useRouter } from 'vue-router'
import { Document } from '@element-plus/icons-vue'
import { ElButton, ElTag, ElMessage, ElMessageBox, type Column } from 'element-plus'
import AdminTableV2 from '@/components/admin/AdminTableV2.vue'
import AdminEditDialog, { type FormField } from '@/components/admin/AdminEditDialog.vue'
import { jobApi, type JobItem } from '@/api/admin/admin-job'
import { useAdminTable } from '@/composables/useAdminTable'
import { useAdminCrud } from '@/composables/useAdminCrud'

const router = useRouter()

const statusFilter = ref('')
const groupFilter = ref('')

const formFields: FormField[] = [
  { prop: 'job_name', label: '任务名称', required: true, minLength: 1, maxLength: 64 },
  { prop: 'job_group', label: '任务组', required: true, maxLength: 64 },
  { prop: 'invoke_target', label: '调用目标', required: true, minLength: 1, maxLength: 500 },
  { prop: 'cron_expression', label: 'cron 表达式', required: true, minLength: 1, maxLength: 255, placeholder: '如: 0 0 2 * * ?' },
  { prop: 'misfire_policy', label: '错误策略', type: 'select', options: [
    { label: '立即执行', value: '1' },
    { label: '执行一次', value: '2' },
    { label: '放弃执行', value: '3' },
  ] },
  { prop: 'concurrent', label: '并发执行', type: 'select', options: [
    { label: '允许', value: '0' },
    { label: '禁止', value: '1' },
  ] },
  { prop: 'status', label: '状态', type: 'select', options: [
    { label: '正常', value: '0' },
    { label: '暂停', value: '1' },
  ] },
]

const { keyword, page, size, total, loading, list, reload, onSearch, onPageChange } = useAdminTable<JobItem>({
  fetchFn: (params) => jobApi.jobList({
    ...params,
    status: statusFilter.value || undefined,
    jobGroup: groupFilter.value || undefined,
  }),
})

const { dialogVisible, dialogMode, formData, submitting, onAdd, onEdit, onDelete, onBatchDelete, onSubmit, onSubmitContinue } = useAdminCrud({
  fields: formFields,
  idField: 'job_id',
  createFn: (data) => jobApi.jobCreate(data as Partial<JobItem>),
  updateFn: (id, data) => jobApi.jobUpdate({ ...(data as Partial<JobItem>), job_id: id as number }),
  deleteFn: (id) => jobApi.jobDelete([id]),
  batchDeleteFn: (ids) => jobApi.jobDelete(ids),
  onSuccess: reload,
})

const onFilter = () => {
  page.value = 1
  void reload()
}

const goLog = () => {
  router.push('/admin/job/log')
}

// 启动 / 暂停
const toggleStatus = async (row: JobItem) => {
  const next = String(row.status) === '0' ? '1' : '0'
  try {
    await ElMessageBox.confirm(
      `确认${next === '0' ? '启动' : '暂停'}任务「${row.job_name}」？`,
      '操作确认',
      { type: 'warning' },
    )
    await jobApi.jobChangeStatus(row.job_id, next)
    ElMessage.success(next === '0' ? '已启动' : '已暂停')
    void reload()
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') ElMessage.error('操作失败')
  }
}

// 执行一次
const runOnce = async (row: JobItem) => {
  try {
    await ElMessageBox.confirm(`确认立即执行任务「${row.job_name}」？`, '执行一次', { type: 'warning' })
    await jobApi.jobRunOnce(row.job_id)
    ElMessage.success('已触发执行')
    void reload()
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') ElMessage.error('操作失败')
  }
}

const formatTime = (t: string | null | undefined) => {
  if (!t) return '-'
  return String(t).replace('T', ' ').slice(0, 19)
}

const columns: Column<any>[] = [
  { key: 'job_id', dataKey: 'job_id', title: 'ID', width: 80 },
  { key: 'job_name', dataKey: 'job_name', title: '任务名称', width: 180 },
  { key: 'job_group', dataKey: 'job_group', title: '任务组', width: 120, cellRenderer: ({ cellData }: any) => cellData || '-' },
  { key: 'invoke_target', dataKey: 'invoke_target', title: '调用目标', width: 220, cellRenderer: ({ cellData }: any) => cellData || '-' },
  { key: 'cron_expression', dataKey: 'cron_expression', title: 'cron 表达式', width: 160, cellRenderer: ({ cellData }: any) => cellData || '-' },
  { key: 'status', dataKey: 'status', title: '状态', width: 90, cellRenderer: ({ cellData }: any) => {
    const ok = String(cellData) === '0'
    return h(ElTag, { type: ok ? 'success' : 'info', size: 'small' }, ok ? '正常' : '暂停')
  } },
  { key: 'next_time', dataKey: 'next_time', title: '下次执行时间', width: 180, cellRenderer: ({ cellData }: any) => formatTime(cellData) },
  {
    key: 'actions',
    title: '操作',
    width: 280,
    fixed: 'right' as any,
    cellRenderer: ({ rowData: row }) => h('div', {}, [
      h(ElButton, { size: 'small', link: true, type: 'primary', onClick: () => onEdit(row) }, '编辑'),
      h(ElButton, {
        size: 'small', link: true, type: 'warning', onClick: () => toggleStatus(row),
      }, String(row.status) === '0' ? '暂停' : '启动'),
      h(ElButton, { size: 'small', link: true, type: 'success', onClick: () => runOnce(row) }, '执行一次'),
      h(ElButton, { size: 'small', link: true, type: 'danger', onClick: () => onDelete(row) }, '删除'),
    ]),
  },
]

onMounted(reload)
</script>

<style scoped>
.filter-select {
  width: 130px;
}
</style>
