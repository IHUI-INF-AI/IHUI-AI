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
    :show-add="false"
    :selectable="false"
    row-key="job_log_id"
    @search="onSearch"
    @page-change="onPageChange"
  >
    <template #toolbar>
      <el-select v-model="statusFilter" placeholder="执行状态" clearable class="filter-select" @change="onFilter">
        <el-option label="成功" value="0" />
        <el-option label="失败" value="1" />
      </el-select>
      <el-button type="danger" :icon="Delete" @click="onClean">清理日志</el-button>
    </template>
  </AdminTableV2>

  <el-dialog v-model="detailVisible" title="执行日志详情" width="720px" append-to-body>
    <el-descriptions v-if="currentDetail" :column="2" border>
      <el-descriptions-item label="日志 ID">{{ currentDetail.job_log_id }}</el-descriptions-item>
      <el-descriptions-item label="任务名称">{{ currentDetail.job_name }}</el-descriptions-item>
      <el-descriptions-item label="任务组">{{ currentDetail.job_group || '-' }}</el-descriptions-item>
      <el-descriptions-item label="执行状态">{{ String(currentDetail.status) === '0' ? '成功' : '失败' }}</el-descriptions-item>
      <el-descriptions-item label="调用目标" :span="2">{{ currentDetail.invoke_target || '-' }}</el-descriptions-item>
      <el-descriptions-item label="日志信息" :span="2">{{ currentDetail.job_message || '-' }}</el-descriptions-item>
      <el-descriptions-item label="耗时">{{ currentDetail.cost_time != null ? `${currentDetail.cost_time} ms` : '-' }}</el-descriptions-item>
      <el-descriptions-item label="执行时间">{{ formatTime(currentDetail.create_time) }}</el-descriptions-item>
      <el-descriptions-item label="异常信息" :span="2">{{ currentDetail.exception_info || '-' }}</el-descriptions-item>
    </el-descriptions>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted, h } from 'vue'
import { Delete } from '@element-plus/icons-vue'
import { ElButton, ElTag, ElMessage, ElMessageBox, ElDialog, ElDescriptions, ElDescriptionsItem, type Column } from 'element-plus'
import AdminTableV2 from '@/components/admin/AdminTableV2.vue'
import { jobApi, type JobLogItem } from '@/api/admin/admin-job'
import { useAdminTable } from '@/composables/useAdminTable'

const statusFilter = ref('')

const detailVisible = ref(false)
const currentDetail = ref<JobLogItem | null>(null)

const formatTime = (t: string | null | undefined) => {
  if (!t) return '-'
  return String(t).replace('T', ' ').slice(0, 19)
}

const { keyword, page, size, total, loading, list, reload, onSearch, onPageChange } = useAdminTable<JobLogItem>({
  fetchFn: (params) => jobApi.jobLogList({
    ...params,
    status: statusFilter.value || undefined,
  }),
})

const onFilter = () => {
  page.value = 1
  void reload()
}

const showDetail = (row: JobLogItem) => {
  currentDetail.value = row
  detailVisible.value = true
}

const onClean = async () => {
  try {
    const { value } = await ElMessageBox.prompt('确认清理任务执行日志？请输入保留天数', '清理日志', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputType: 'number',
      inputValue: '90',
      inputValidator: (v: string) => Number(v) >= 0 || '请输入非负整数',
    })
    await jobApi.jobLogClean(Number(value))
    ElMessage.success('清理成功')
    void reload()
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') ElMessage.error('清理失败')
  }
}

const columns: Column<any>[] = [
  { key: 'job_log_id', dataKey: 'job_log_id', title: 'ID', width: 80 },
  { key: 'job_name', dataKey: 'job_name', title: '任务名称', width: 180 },
  { key: 'job_group', dataKey: 'job_group', title: '任务组', width: 120, cellRenderer: ({ cellData }: any) => cellData || '-' },
  { key: 'invoke_target', dataKey: 'invoke_target', title: '调用目标', width: 220, cellRenderer: ({ cellData }: any) => cellData || '-' },
  { key: 'status', dataKey: 'status', title: '执行状态', width: 100, cellRenderer: ({ cellData }: any) => {
    const ok = String(cellData) === '0'
    return h(ElTag, { type: ok ? 'success' : 'danger', size: 'small' }, ok ? '成功' : '失败')
  } },
  { key: 'cost_time', dataKey: 'cost_time', title: '耗时', width: 110, cellRenderer: ({ cellData }: any) => cellData != null ? `${cellData} ms` : '-' },
  { key: 'create_time', dataKey: 'create_time', title: '执行时间', width: 180, cellRenderer: ({ cellData }: any) => formatTime(cellData) },
  {
    key: 'actions',
    title: '操作',
    width: 100,
    fixed: 'right' as any,
    cellRenderer: ({ rowData: row }) => h(ElButton, { size: 'small', link: true, type: 'primary', onClick: () => showDetail(row) }, '详情'),
  },
]

onMounted(reload)
</script>

<style scoped>
.filter-select {
  width: 130px;
}
</style>
