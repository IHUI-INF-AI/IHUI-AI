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
    :selectable="true"
    row-key="token_id"
    @search="onSearch"
    @page-change="onPageChange"
    @batch-delete="onBatchForceLogout"
  >
    <template #toolbar>
      <el-button :icon="Refresh" @click="onFilter">刷新</el-button>
    </template>
  </AdminTableV2>
</template>

<script setup lang="ts">
import { ref, onMounted, h } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import { ElButton, ElMessage, ElMessageBox, type Column } from 'element-plus'
import AdminTableV2 from '@/components/admin/AdminTableV2.vue'
import { onlineApi, type OnlineItem } from '@/api/admin/admin-online'
import { useAdminTable } from '@/composables/useAdminTable'

const { keyword, page, size, total, loading, list, reload, onSearch, onPageChange } = useAdminTable<OnlineItem>({
  fetchFn: (params) => onlineApi.onlineList(params),
})

const onFilter = () => {
  page.value = 1
  void reload()
}

const formatTime = (t: string | null | undefined) => {
  if (!t) return '-'
  return String(t).replace('T', ' ').slice(0, 19)
}

// 强制下线
const forceLogout = async (row: OnlineItem) => {
  try {
    await ElMessageBox.confirm(`确认强制下线用户「${row.user_name}」？`, '强制下线', { type: 'warning' })
    await onlineApi.onlineForceLogout(row.token_id)
    ElMessage.success('已强制下线')
    void reload()
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') ElMessage.error('操作失败')
  }
}

// 批量强制下线 (复用 batch-delete 事件)
const onBatchForceLogout = async (ids: (string | number)[]) => {
  if (!ids.length) return
  try {
    await ElMessageBox.confirm(`确认强制下线选中的 ${ids.length} 个用户？`, '批量强制下线', { type: 'warning' })
    await onlineApi.onlineBatchForceLogout(ids.map(String))
    ElMessage.success('已强制下线')
    void reload()
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') ElMessage.error('操作失败')
  }
}

const columns: Column<any>[] = [
  { key: 'token_id', dataKey: 'token_id', title: '会话 ID', width: 220, cellRenderer: ({ cellData }: any) => cellData ? String(cellData).slice(0, 16) + '...' : '-' },
  { key: 'user_name', dataKey: 'user_name', title: '用户名', width: 160 },
  { key: 'user_id', dataKey: 'user_id', title: '用户 ID', width: 160, cellRenderer: ({ cellData }: any) => cellData ?? '-' },
  { key: 'ipaddr', dataKey: 'ipaddr', title: '登录 IP', width: 140, cellRenderer: ({ cellData }: any) => cellData || '-' },
  { key: 'login_location', dataKey: 'login_location', title: '登录地点', width: 140, cellRenderer: ({ cellData }: any) => cellData || '-' },
  { key: 'browser', dataKey: 'browser', title: '浏览器', width: 140, cellRenderer: ({ cellData }: any) => cellData || '-' },
  { key: 'os', dataKey: 'os', title: '操作系统', width: 140, cellRenderer: ({ cellData }: any) => cellData || '-' },
  { key: 'login_time', dataKey: 'login_time', title: '登录时间', width: 180, cellRenderer: ({ cellData }: any) => formatTime(cellData) },
  {
    key: 'actions',
    title: '操作',
    width: 120,
    fixed: 'right' as any,
    cellRenderer: ({ rowData: row }) => h(ElButton, { size: 'small', link: true, type: 'danger', onClick: () => forceLogout(row) }, '强制下线'),
  },
]

onMounted(reload)
</script>
