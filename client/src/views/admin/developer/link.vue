<template>
  <AdminTableV2
    :data="list"
    :columns="columns"
    :total="total"
    :page="page"
    :size="size"
    :loading="loading"
    :keyword="keyword"
    search-placeholder="请输入用户 ID"
    :selectable="true"
    @search="onSearch"
    @page-change="onPageChange"
    @add="onAdd"
    @batch-delete="onBatchDelete"
  >
    <template #toolbar>
      <el-select v-model="statusFilter" placeholder="状态" clearable class="filter-select" @change="onFilter">
        <el-option label="启用" :value="1" />
        <el-option label="禁用" :value="0" />
      </el-select>
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

const statusFilter = ref<number | ''>('')

const formFields: FormField[] = [
  { prop: 'user_id', label: '用户 ID', required: true, minLength: 1, maxLength: 64 },
  { prop: 'coze_account_id', label: 'Coze 账号 ID', maxLength: 64 },
  { prop: 'coze_account_name', label: 'Coze 账号名称', maxLength: 200 },
  { prop: 'status', label: '状态', type: 'select', options: [
    { label: '启用', value: 1 },
    { label: '禁用', value: 0 },
  ] },
]

const { keyword, page, size, total, loading, list, reload, onSearch, onPageChange } = useAdminTable({
  fetchFn: (params) => developerApi.developerLinkList({ current: params.current, size: params.size, userId: params.keyword, status: statusFilter.value === '' ? undefined : statusFilter.value }),
})

const { dialogVisible, dialogMode, formData, submitting, onAdd, onEdit, onDelete, onBatchDelete, onSubmit, onSubmitContinue } = useAdminCrud({
  fields: formFields,
  idField: 'id',
  createFn: (data) => developerApi.developerLinkCreate({
    userId: data.user_id,
    cozeAccountId: data.coze_account_id ?? null,
    cozeAccountName: data.coze_account_name ?? null,
    status: data.status === '' ? 1 : Number(data.status),
  }),
  updateFn: (id, data) => developerApi.developerLinkUpdate({
    id: id as number,
    userId: data.user_id,
    cozeAccountId: data.coze_account_id ?? null,
    cozeAccountName: data.coze_account_name ?? null,
    status: data.status === '' ? undefined : Number(data.status),
  }),
  deleteFn: (id) => developerApi.developerLinkDelete([id]),
  batchDeleteFn: (ids) => developerApi.developerLinkDelete(ids),
  onSuccess: reload,
})

const onFilter = () => {
  page.value = 1
  void reload()
}

const toggleStatus = async (row: any) => {
  const next = Number(row.status) === 1 ? 0 : 1
  try {
    await developerApi.developerLinkUpdate({ id: row.id, status: next })
    ElMessage.success(next === 1 ? '已启用' : '已禁用')
    void reload()
  } catch {
    ElMessage.error('操作失败')
  }
}

const columns: Column<any>[] = [
  { key: 'id', dataKey: 'id', title: 'ID', width: 80 },
  { key: 'user_id', dataKey: 'user_id', title: '用户 ID', width: 220 },
  { key: 'coze_account_id', dataKey: 'coze_account_id', title: 'Coze 账号 ID', width: 180, cellRenderer: ({ cellData }: any) => cellData || '-' },
  { key: 'coze_account_name', dataKey: 'coze_account_name', title: 'Coze 账号名称', width: 200, cellRenderer: ({ cellData }: any) => cellData || '-' },
  { key: 'status', dataKey: 'status', title: '状态', width: 90, cellRenderer: ({ cellData }: any) => {
    const ok = Number(cellData) === 1
    return h(ElTag, { type: ok ? 'success' : 'info', size: 'small' }, ok ? '启用' : '禁用')
  } },
  { key: 'created_at', dataKey: 'created_at', title: '创建时间', width: 180, cellRenderer: ({ cellData }: any) => cellData ? String(cellData).replace('T', ' ').slice(0, 19) : '-' },
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
.filter-select {
  width: 120px;
}
</style>
