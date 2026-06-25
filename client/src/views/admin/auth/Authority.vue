<template>
  <AdminTableV2
    :data="list"
    :columns="columns"
    :total="total"
    :page="page"
    :size="size"
    :loading="loading"
    :keyword="keyword"
    :search-placeholder="t('adminAuth.searchPlaceholder.authority')"
    :selectable="true"
    @search="onSearch"
    @page-change="onPageChange"
    @add="onAdd"
    @batch-delete="onBatchDelete"
    @batch-edit="onBatchEdit"
  />
  <AdminEditDialog
    v-model:visible="dialogVisible"
    :mode="dialogMode"
    :fields="formFields"
    :form-data="formData"
    :submitting="submitting"
    @submit="onSubmit"
    @submit-continue="onSubmitContinue"
  />
  <AdminBatchEditDialog
    v-model:visible="batchEditVisible"
    :rows="batchEditRows"
    :fields="formFields"
    :submitting="submitting"
    :progress="batchEditProgress"
    @submit="onBatchEditSubmit"
    @retry="onBatchEditRetry"
  />
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { onMounted, h } from 'vue'
import { ElButton, type Column } from 'element-plus'
import AdminTableV2 from '@/components/admin/AdminTableV2.vue'
import AdminEditDialog, { type FormField } from '@/components/admin/AdminEditDialog.vue'
import AdminBatchEditDialog from '@/components/admin/AdminBatchEditDialog.vue'
import { adminApi } from '@/api/admin/admin'
import { useAdminTable } from '@/composables/useAdminTable'
import { useAdminCrud } from '@/composables/useAdminCrud'

const formFields: FormField[] = [
  { prop: 'name', label: '权限名称', required: true, minLength: 1, maxLength: 50 },
  { prop: 'code', label: '权限代码', required: true, minLength: 2, maxLength: 50, pattern: '^[a-zA-Z][a-zA-Z0-9_]*$', patternMessage: '代码只能包含字母、数字和下划线，且以字母开头' },
]

const { keyword, page, size, total, loading, list, reload, onSearch, onPageChange } = useAdminTable({
  fetchFn: (params) => adminApi.authorityList(params),
})

const { dialogVisible, dialogMode, formData, submitting, onAdd, onEdit, onDelete, onBatchDelete, onSubmit, onSubmitContinue, batchEditVisible, batchEditRows, batchEditProgress, onBatchEdit, onBatchEditSubmit, onBatchEditRetry } = useAdminCrud({
  fields: formFields,
  createFn: (data) => adminApi.authorityCreate(data),
  updateFn: (id, data) => adminApi.authorityUpdate(id, data),
  deleteFn: (id) => adminApi.authorityDelete(id),
  batchDeleteFn: (ids) => adminApi.authorityBatchDelete(ids),
  onSuccess: reload,
})

const columns: Column<any>[] = [
  { key: 'id', dataKey: 'id', title: 'ID', width: 80 },
  { key: 'name', dataKey: 'name', title: '权限名称', width: 220 },
  { key: 'code', dataKey: 'code', title: '权限代码', width: 220 },
  {
    key: 'actions',
    title: '操作',
    width: 180,
    fixed: 'right' as any,
    cellRenderer: ({ rowData: row }) => h('div', {}, [
      h(ElButton, { size: 'small', link: true, type: 'primary', onClick: () => onEdit(row) }, t('common.edit')),
      h(ElButton, { size: 'small', link: true, type: 'danger', onClick: () => onDelete(row) }, t('common.delete')),
    ]),
  },
]

onMounted(reload)
</script>
