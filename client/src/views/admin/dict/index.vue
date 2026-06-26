<template>
  <AdminTableV2
    :data="list"
    :columns="columns"
    :total="total"
    :page="page"
    :size="size"
    :loading="loading"
    :keyword="keyword"
    search-placeholder="请输入字典名称"
    :selectable="true"
    @search="onSearch"
    @page-change="onPageChange"
    @add="onAdd"
    @batch-delete="onBatchDelete"
  >
    <template #toolbar>
      <el-select v-model="statusFilter" placeholder="状态" clearable class="filter-select" @change="reload">
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
import { useRouter } from 'vue-router'
import { ElButton, ElTag, type Column } from 'element-plus'
import AdminTableV2 from '@/components/admin/AdminTableV2.vue'
import AdminEditDialog, { type FormField } from '@/components/admin/AdminEditDialog.vue'
import { dictApi } from '@/api/admin/admin-dict'
import { useAdminTable } from '@/composables/useAdminTable'
import { useAdminCrud } from '@/composables/useAdminCrud'

const router = useRouter()

const statusFilter = ref('')

const formFields: FormField[] = [
  { prop: 'dictName', label: '字典名称', required: true, minLength: 1, maxLength: 100 },
  { prop: 'dictType', label: '字典类型', required: true, minLength: 2, maxLength: 100, pattern: '^[a-zA-Z][a-zA-Z0-9_]*$', patternMessage: '类型只能包含字母、数字和下划线，且以字母开头' },
  { prop: 'status', label: '状态', type: 'select', options: [
    { label: '正常', value: '0' },
    { label: '停用', value: '1' },
  ] },
]

const { keyword, page, size, total, loading, list, reload, onSearch, onPageChange } = useAdminTable({
  fetchFn: (params) => dictApi.dictTypeList({ ...params, status: statusFilter.value }),
})

const { dialogVisible, dialogMode, formData, submitting, onAdd, onEdit, onDelete, onBatchDelete, onSubmit, onSubmitContinue } = useAdminCrud({
  fields: formFields,
  idField: 'dictId',
  createFn: (data) => dictApi.dictTypeCreate(data as { dictName: string; dictType: string; status?: string }),
  updateFn: (id, data) => dictApi.dictTypeUpdate({ ...(data as { dictName?: string; dictType?: string; status?: string }), dictId: id as number }),
  deleteFn: (id) => dictApi.dictTypeDelete([id]),
  batchDeleteFn: (ids) => dictApi.dictTypeDelete(ids),
  onSuccess: reload,
})

const goData = (row: any) => {
  router.push({ path: '/admin/dict/data', query: { dictType: row.dictType } })
}

const columns: Column<any>[] = [
  { key: 'dictId', dataKey: 'dictId', title: 'ID', width: 80 },
  { key: 'dictName', dataKey: 'dictName', title: '字典名称', width: 200 },
  { key: 'dictType', dataKey: 'dictType', title: '字典类型', width: 200 },
  { key: 'status', dataKey: 'status', title: '状态', width: 100, cellRenderer: ({ cellData }: any) => {
    const ok = String(cellData) === '0'
    return h(ElTag, { type: ok ? 'success' : 'info', size: 'small' }, ok ? '正常' : '停用')
  } },
  {
    key: 'actions',
    title: '操作',
    width: 220,
    fixed: 'right' as any,
    cellRenderer: ({ rowData: row }) => h('div', {}, [
      h(ElButton, { size: 'small', link: true, type: 'primary', onClick: () => goData(row) }, '数据'),
      h(ElButton, { size: 'small', link: true, type: 'primary', onClick: () => onEdit(row) }, '编辑'),
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
