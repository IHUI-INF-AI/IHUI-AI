<template>
  <AdminTableV2
    :data="list"
    :columns="columns"
    :total="total"
    :page="page"
    :size="size"
    :loading="loading"
    :keyword="keyword"
    :search-placeholder="t('live.searchPlaceholder.lecturer')"
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
import { FIXED_RIGHT } from '@/utils/tableConstants'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { onMounted, h } from 'vue'
import { ElButton, type Column } from 'element-plus'
import AdminTableV2 from '@/components/admin/AdminTableV2.vue'
import AdminEditDialog, { type FormField } from '@/components/admin/AdminEditDialog.vue'
import AdminBatchEditDialog from '@/components/admin/AdminBatchEditDialog.vue'
import { adminApi } from '@/api/admin'
import { useAdminTable } from '@/composables/useAdminTable'
import { useAdminCrud } from '@/composables/useAdminCrud'

const formFields: FormField[] = [
  { prop: 'name', label: t('adminCommon.label.fullName'), required: true, minLength: 1, maxLength: 50 },
  { prop: 'title', label: t('adminCommon.label.jobTitle'), maxLength: 200 },
]

const { keyword, page, size, total, loading, list, reload, onSearch, onPageChange } = useAdminTable({
  fetchFn: (params) => adminApi.liveLecturerList(params),
})

const { dialogVisible, dialogMode, formData, submitting, onAdd, onEdit, onDelete, onBatchDelete, onSubmit, onSubmitContinue, batchEditVisible, batchEditRows, batchEditProgress, onBatchEdit, onBatchEditSubmit, onBatchEditRetry } = useAdminCrud({
  fields: formFields,
  createFn: (data) => adminApi.liveLecturerCreate(data),
  updateFn: (id, data) => adminApi.liveLecturerUpdate(id, data),
  deleteFn: (id) => adminApi.liveLecturerDelete(id),
  batchDeleteFn: (ids) => adminApi.liveLecturerBatchDelete(ids),
  onSuccess: reload,
})

const columns: Column<unknown>[] = [
  { key: 'id', dataKey: 'id', title: 'ID', width: 80 },
  { key: 'name', dataKey: 'name', title: t('adminCommon.label.fullName'), width: 140 },
  { key: 'title', dataKey: 'title', title: t('adminCommon.label.jobTitle'), width: 140 },
  { key: 'liveCount', dataKey: 'liveCount', title: '直播数', width: 100 },
  {
    key: 'actions',
    title: t('adminCommon.label.operation'),
    width: 180,
    fixed: FIXED_RIGHT,
    cellRenderer: ({ rowData: row }) => h('div', {}, [
      h(ElButton, { size: 'small', link: true, type: 'primary', onClick: () => onEdit(row) }, t('common.edit')),
      h(ElButton, { size: 'small', link: true, type: 'danger', onClick: () => onDelete(row) }, t('common.delete')),
    ]),
  },
]

onMounted(reload)
</script>
