<template>
  <AdminTableV2
    :data="list"
    :columns="columns"
    :total="total"
    :page="page"
    :size="size"
    :loading="loading"
    :keyword="keyword"
    :search-placeholder="t('learn.searchPlaceholder.topic')"
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
  { prop: 'title', label: t('adminCommon.label.title'), required: true, minLength: 1, maxLength: 100 },
  { prop: 'image', label: t('adminCommon.label.image'), maxLength: 1000 },
  { prop: 'description', label: t('adminCommon.label.description'), type: 'textarea', rows: 3, maxLength: 500 },
  { prop: 'price', label: t('adminCommon.label.price'), type: 'number', min: 0, max: 9999999, step: 0.01 },
  {
    prop: 'status',
    label: t('adminCommon.label.status'),
    type: 'select',
    options: [
      { label: t('adminCommon.label.draft'), value: 'draft' },
      { label: t('adminCommon.label.published'), value: 'published' },
    ],
  },
]

const { keyword, page, size, total, loading, list, reload, onSearch, onPageChange } = useAdminTable({
  fetchFn: (params) => adminApi.learnTopicList(params),
})

const { dialogVisible, dialogMode, formData, submitting, onAdd, onEdit, onDelete, onBatchDelete, onSubmit, onSubmitContinue, batchEditVisible, batchEditRows, batchEditProgress, onBatchEdit, onBatchEditSubmit, onBatchEditRetry } = useAdminCrud({
  fields: formFields,
  createFn: (data) => adminApi.learnTopicCreate(data),
  updateFn: (id, data) => adminApi.learnTopicUpdate(id, data),
  deleteFn: (id) => adminApi.learnTopicDelete(id),
  batchDeleteFn: (ids) => adminApi.learnTopicBatchDelete(ids),
  onSuccess: reload,
})

const columns: Column<unknown>[] = [
  { key: 'id', dataKey: 'id', title: 'ID', width: 80 },
  { key: 'title', dataKey: 'title', title: t('adminCommon.label.title'), width: 220 },
  { key: 'status', dataKey: 'status', title: t('adminCommon.label.status'), width: 120 },
  { key: 'price', dataKey: 'price', title: t('adminCommon.label.price'), width: 120 },
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
