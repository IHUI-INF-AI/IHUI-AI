<template>
  <AdminTableV2
    :data="list"
    :columns="columns"
    :total="total"
    :page="page"
    :size="size"
    :loading="loading"
    :keyword="keyword"
    search-placeholder="请输入专区名称"
    :selectable="true"
    row-key="id"
    @search="onSearch"
    @page-change="onPageChange"
    @add="onAdd"
    @batch-delete="onBatchDelete"
  >
    <template #toolbar>
      <el-select v-model="statusFilter" placeholder="状态" clearable class="filter-select" @change="onFilter">
        <el-option label="正常" value="0" />
        <el-option label="停用" value="1" />
      </el-select>
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
import { ElButton, ElTag, type Column } from 'element-plus'
import AdminTableV2 from '@/components/admin/AdminTableV2.vue'
import AdminEditDialog, { type FormField } from '@/components/admin/AdminEditDialog.vue'
import { zoneApi, type ZoneItem } from '@/api/admin/admin-zone'
import { useAdminTable } from '@/composables/useAdminTable'
import { useAdminCrud } from '@/composables/useAdminCrud'

const statusFilter = ref('')

const formFields: FormField[] = [
  { prop: 'name', label: '专区名称', required: true, minLength: 1, maxLength: 100 },
  { prop: 'description', label: '专区描述', type: 'textarea', rows: 3, maxLength: 500 },
  { prop: 'sort', label: '显示排序', type: 'number', min: 0, max: 9999, step: 1 },
  { prop: 'status', label: '状态', type: 'select', options: [
    { label: '正常', value: '0' },
    { label: '停用', value: '1' },
  ] },
]

const { keyword, page, size, total, loading, list, reload, onSearch, onPageChange } = useAdminTable<ZoneItem>({
  fetchFn: (params) => zoneApi.zoneList({
    ...params,
    status: statusFilter.value || undefined,
  }),
})

const { dialogVisible, dialogMode, formData, submitting, onAdd, onEdit, onDelete, onBatchDelete, onSubmit, onSubmitContinue } = useAdminCrud({
  fields: formFields,
  idField: 'id',
  createFn: (data) => zoneApi.zoneCreate(data as Partial<ZoneItem>),
  updateFn: (id, data) => zoneApi.zoneUpdate({ ...(data as Partial<ZoneItem>), id: id as number }),
  deleteFn: (id) => zoneApi.zoneDelete([id]),
  batchDeleteFn: (ids) => zoneApi.zoneDelete(ids),
  onSuccess: reload,
})

const onFilter = () => {
  page.value = 1
  void reload()
}

const formatTime = (t: string | null | undefined) => {
  if (!t) return '-'
  return String(t).replace('T', ' ').slice(0, 19)
}

const columns: Column<any>[] = [
  { key: 'id', dataKey: 'id', title: 'ID', width: 80 },
  { key: 'name', dataKey: 'name', title: '专区名称', width: 200 },
  { key: 'description', dataKey: 'description', title: '专区描述', width: 280, cellRenderer: ({ cellData }: any) => cellData || '-' },
  { key: 'sort', dataKey: 'sort', title: '排序', width: 90, cellRenderer: ({ cellData }: any) => cellData ?? 0 },
  { key: 'status', dataKey: 'status', title: '状态', width: 100, cellRenderer: ({ cellData }: any) => {
    const ok = String(cellData) === '0'
    return h(ElTag, { type: ok ? 'success' : 'info', size: 'small' }, ok ? '正常' : '停用')
  } },
  { key: 'create_time', dataKey: 'create_time', title: '创建时间', width: 180, cellRenderer: ({ cellData }: any) => formatTime(cellData) },
  {
    key: 'actions',
    title: '操作',
    width: 180,
    fixed: 'right' as any,
    cellRenderer: ({ rowData: row }) => h('div', {}, [
      h(ElButton, { size: 'small', link: true, type: 'primary', onClick: () => onEdit(row) }, '编辑'),
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
