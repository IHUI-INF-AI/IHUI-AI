<template>
  <AdminTableV2
    :data="list"
    :columns="columns"
    :total="total"
    :page="page"
    :size="size"
    :loading="loading"
    :keyword="keyword"
    search-placeholder="请输入用户名"
    :show-add="false"
    :selectable="false"
    @search="onSearch"
    @page-change="onPageChange"
  >
    <template #toolbar>
      <el-select v-model="statusFilter" placeholder="登录状态" clearable class="filter-select" @change="onFilter">
        <el-option label="成功" value="0" />
        <el-option label="失败" value="1" />
      </el-select>
      <el-date-picker
        v-model="dateRange"
        type="daterange"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        value-format="x"
        class="filter-date"
        @change="onFilter"
      />
      <el-button type="danger" :icon="Delete" @click="onClean">清理日志</el-button>
    </template>
  </AdminTableV2>

  <el-dialog v-model="detailVisible" title="登录日志详情" width="640px" append-to-body>
    <el-descriptions v-if="currentDetail" :column="2" border>
      <el-descriptions-item label="日志 ID">{{ currentDetail.info_id }}</el-descriptions-item>
      <el-descriptions-item label="用户名">{{ currentDetail.user_name }}</el-descriptions-item>
      <el-descriptions-item label="登录 IP">{{ currentDetail.ipaddr || '-' }}</el-descriptions-item>
      <el-descriptions-item label="登录地点">{{ currentDetail.login_location || '-' }}</el-descriptions-item>
      <el-descriptions-item label="浏览器">{{ currentDetail.browser || '-' }}</el-descriptions-item>
      <el-descriptions-item label="操作系统">{{ currentDetail.os || '-' }}</el-descriptions-item>
      <el-descriptions-item label="登录状态">{{ String(currentDetail.status) === '0' ? '成功' : '失败' }}</el-descriptions-item>
      <el-descriptions-item label="登录时间">{{ formatTime(currentDetail.login_time) }}</el-descriptions-item>
      <el-descriptions-item label="提示消息" :span="2">{{ currentDetail.msg || '-' }}</el-descriptions-item>
    </el-descriptions>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted, h } from 'vue'
import { Delete } from '@element-plus/icons-vue'
import { ElButton, ElTag, ElMessage, ElMessageBox, ElDialog, ElDescriptions, ElDescriptionsItem, type Column } from 'element-plus'
import AdminTableV2 from '@/components/admin/AdminTableV2.vue'
import { logApi, type LoginInfoItem } from '@/api/admin/admin-log'
import { useAdminTable } from '@/composables/useAdminTable'

const statusFilter = ref('')
const dateRange = ref<[string, string] | null>(null)

const detailVisible = ref(false)
const currentDetail = ref<LoginInfoItem | null>(null)

const formatTime = (t: string | null | undefined) => {
  if (!t) return '-'
  return String(t).replace('T', ' ').slice(0, 19)
}

// 时间范围客户端过滤(后端 list 暂不支持时间参数)
const applyTimeFilter = (rows: LoginInfoItem[]): LoginInfoItem[] => {
  if (!dateRange.value || dateRange.value.length !== 2) return rows
  const begin = Number(dateRange.value[0])
  const end = Number(dateRange.value[1]) + 86400000 - 1
  return rows.filter((r) => {
    const t = r.login_time ? new Date(r.login_time).getTime() : 0
    return t >= begin && t <= end
  })
}

const { keyword, page, size, total, loading, list, reload, onSearch, onPageChange } = useAdminTable({
  fetchFn: async (params) => {
    const res = await logApi.logininforList({
      ...params,
      status: statusFilter.value || undefined,
    })
    const records = applyTimeFilter((res.data as { records: LoginInfoItem[] }).records)
    return {
      ...res,
      data: { records, total: records.length },
    } as any
  },
})

const onFilter = () => {
  page.value = 1
  void reload()
}

const showDetail = (row: LoginInfoItem) => {
  currentDetail.value = row
  detailVisible.value = true
}

const onClean = async () => {
  try {
    const { value } = await ElMessageBox.prompt('确认清理登录日志？请输入保留天数', '清理日志', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputType: 'number',
      inputValue: '90',
      inputValidator: (v: string) => Number(v) >= 0 || '请输入非负整数',
    })
    await logApi.logininforClean(Number(value))
    ElMessage.success('清理成功')
    void reload()
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') ElMessage.error('清理失败')
  }
}

const columns: Column<any>[] = [
  { key: 'info_id', dataKey: 'info_id', title: 'ID', width: 80 },
  { key: 'user_name', dataKey: 'user_name', title: '用户名', width: 160 },
  { key: 'ipaddr', dataKey: 'ipaddr', title: '登录 IP', width: 140, cellRenderer: ({ cellData }: any) => cellData || '-' },
  { key: 'login_location', dataKey: 'login_location', title: '登录地点', width: 160, cellRenderer: ({ cellData }: any) => cellData || '-' },
  { key: 'browser', dataKey: 'browser', title: '浏览器', width: 140, cellRenderer: ({ cellData }: any) => cellData || '-' },
  { key: 'os', dataKey: 'os', title: '操作系统', width: 140, cellRenderer: ({ cellData }: any) => cellData || '-' },
  { key: 'status', dataKey: 'status', title: '状态', width: 90, cellRenderer: ({ cellData }: any) => {
    const ok = String(cellData) === '0'
    return h(ElTag, { type: ok ? 'success' : 'danger', size: 'small' }, ok ? '成功' : '失败')
  } },
  { key: 'login_time', dataKey: 'login_time', title: '登录时间', width: 180, cellRenderer: ({ cellData }: any) => formatTime(cellData) },
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

.filter-date {
  width: 260px;
}
</style>
