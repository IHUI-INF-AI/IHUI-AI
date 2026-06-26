<template>
  <AdminTableV2
    :data="list"
    :columns="columns"
    :total="total"
    :page="page"
    :size="size"
    :loading="loading"
    :keyword="keyword"
    search-placeholder="请输入用户 ID 或 Agent ID"
    :show-add="false"
    :selectable="true"
    @search="onSearch"
    @page-change="onPageChange"
    @batch-delete="onBatchDelete"
  >
    <template #toolbar>
      <el-input v-model="userIdFilter" placeholder="按用户 ID 筛选" clearable class="filter-input" @keyup.enter="onFilter" @clear="onFilter" />
      <el-button :icon="Refresh" @click="onFilter">筛选</el-button>
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
import { Refresh } from '@element-plus/icons-vue'
import { ElButton, ElTag, ElMessage, type Column } from 'element-plus'
import AdminTableV2 from '@/components/admin/AdminTableV2.vue'
import AdminEditDialog, { type FormField } from '@/components/admin/AdminEditDialog.vue'
import { developerApi } from '@/api/admin/admin-developer'
import { useAdminTable } from '@/composables/useAdminTable'
import { useAdminCrud } from '@/composables/useAdminCrud'

const userIdFilter = ref('')

const formFields: FormField[] = [
  { prop: 'price', label: '开发者价格', type: 'number', min: 0, max: 999999, step: 0.01 },
  { prop: 'status', label: '状态', type: 'select', options: [
    { label: '启用', value: 1 },
    { label: '禁用', value: 0 },
  ] },
]

const { keyword, page, size, total, loading, list, reload, onSearch, onPageChange } = useAdminTable({
  fetchFn: (params) => developerApi.developerList({ current: params.current, size: params.size, keyword: params.keyword, userId: userIdFilter.value }),
})

const { dialogVisible, dialogMode, formData, submitting, onEdit, onDelete, onBatchDelete, onSubmit, onSubmitContinue } = useAdminCrud({
  fields: formFields,
  idField: 'id',
  createFn: async () => Promise.resolve(),
  updateFn: async (id, data) => {
    const row = list.value.find((r: any) => r.id === id) as any
    if (!row) return
    const tasks: Promise<unknown>[] = []
    if (data.price !== undefined) {
      tasks.push(developerApi.developerUpdatePrice({ agentId: row.agent_id, price: Number(data.price) }))
    }
    if (data.status !== undefined) {
      tasks.push(developerApi.developerToggleStatus({ agentId: row.agent_id, userId: row.user_id, status: Number(data.status) }))
    }
    await Promise.all(tasks)
  },
  deleteFn: (id) => developerApi.developerLinkDelete([id]),
  batchDeleteFn: (ids) => developerApi.developerLinkDelete(ids),
  onSuccess: reload,
})

const onFilter = () => {
  page.value = 1
  void reload()
}

// 快速切换启用/禁用
const toggleStatus = async (row: any) => {
  const next = row.status === 1 ? 0 : 1
  try {
    await developerApi.developerToggleStatus({ agentId: row.agent_id, userId: row.user_id, status: next })
    ElMessage.success(next === 1 ? '已启用' : '已禁用')
    void reload()
  } catch {
    ElMessage.error('操作失败，后端可能未提供该接口')
  }
}

const columns: Column<any>[] = [
  { key: 'id', dataKey: 'id', title: 'ID', width: 80 },
  { key: 'user_name', dataKey: 'user_name', title: '用户名', width: 140, cellRenderer: ({ rowData: row }) => row.user_name || row.user_id || '-' },
  { key: 'user_id', dataKey: 'user_id', title: '用户 UUID', width: 220 },
  { key: 'agent_id', dataKey: 'agent_id', title: 'Agent ID', width: 200 },
  { key: 'order_no', dataKey: 'order_no', title: '订单号', width: 180 },
  { key: 'price', dataKey: 'price', title: '价格', width: 100 },
  { key: 'type', dataKey: 'type', title: '类型', width: 100, cellRenderer: ({ cellData }: any) => cellData || '-' },
  { key: 'expiration_date', dataKey: 'expiration_date', title: '到期时间', width: 180, cellRenderer: ({ cellData }: any) => cellData ? String(cellData).replace('T', ' ').slice(0, 19) : '-' },
  { key: 'status', dataKey: 'status', title: '状态', width: 90, cellRenderer: ({ cellData }: any) => {
    const ok = Number(cellData) === 1
    return h(ElTag, { type: ok ? 'success' : 'info', size: 'small' }, ok ? '启用' : '禁用')
  } },
  {
    key: 'actions',
    title: '操作',
    width: 220,
    fixed: 'right' as any,
    cellRenderer: ({ rowData: row }) => h('div', {}, [
      h(ElButton, { size: 'small', link: true, type: 'primary', onClick: () => onEdit(row) }, '编辑'),
      h(ElButton, {
        size: 'small', link: true, type: 'warning', onClick: () => toggleStatus(row),
      }, Number(row.status) === 1 ? '禁用' : '启用'),
      h(ElButton, { size: 'small', link: true, type: 'danger', onClick: () => onDelete(row) }, '删除'),
    ]),
  },
]

onMounted(reload)
</script>

<style scoped>
.filter-input {
  width: 220px;
}
</style>
