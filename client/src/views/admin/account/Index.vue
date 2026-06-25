<template>
  <AdminTableV2
    :data="list"
    :columns="columns"
    :total="total"
    :page="page"
    :size="size"
    :loading="loading"
    :keyword="keyword"
    :search-placeholder="t('account.searchPlaceholder.index')"
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
  { prop: 'username', label: '账号', required: true, minLength: 3, maxLength: 30, pattern: '^[a-zA-Z0-9_]+$', patternMessage: '用户名只能包含字母、数字和下划线' },
  { prop: 'role', label: '角色', maxLength: 200 },
]

const { keyword, page, size, total, loading, list, reload, onSearch, onPageChange } = useAdminTable({
  fetchFn: (params) => adminApi.accountList(params),
})

const { dialogVisible, dialogMode, formData, submitting, onAdd, onEdit, onDelete, onBatchDelete, onSubmit, onSubmitContinue, batchEditVisible, batchEditRows, batchEditProgress, onBatchEdit, onBatchEditSubmit, onBatchEditRetry } = useAdminCrud({
  fields: formFields,
  createFn: (data) => adminApi.accountCreate(data),
  updateFn: (id, data) => adminApi.accountUpdate(id, data),
  deleteFn: (id) => adminApi.accountDelete(id),
  batchDeleteFn: (ids) => adminApi.accountBatchDelete(ids),
  onSuccess: reload,
})

const columns: Column<any>[] = [
  { key: 'id', dataKey: 'id', title: 'ID', width: 80 },
  { key: 'username', dataKey: 'username', title: '账号', width: 160 },
  { key: 'role', dataKey: 'role', title: '角色', width: 120 },
  { key: 'lastLogin', dataKey: 'lastLogin', title: '最后登录', width: 180 },
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
