<template>
  <AdminTableV2
    :data="list"
    :columns="columns"
    :total="total"
    :page="page"
    :size="size"
    :loading="loading"
    :keyword="keyword"
    :search-placeholder="t('admin.sms.searchPlaceholder')"
    :selectable="true"
    @search="onSearch"
    @page-change="onPageChange"
    @add="onAdd"
    @batch-delete="onBatchDelete"
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
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { onMounted, h } from 'vue'
import { ElButton, ElTag, type Column } from 'element-plus'
import AdminTableV2 from '@/components/admin/AdminTableV2.vue'
import AdminEditDialog, { type FormField } from '@/components/admin/AdminEditDialog.vue'
import { adminApi } from '@/api/admin'
import { useAdminTable } from '@/composables/useAdminTable'
import { useAdminCrud } from '@/composables/useAdminCrud'

const formFields: FormField[] = [
  { prop: 'templateName', label: t('admin.sms.templateName'), required: true, minLength: 1, maxLength: 100 },
  { prop: 'templateCode', label: t('admin.sms.templateCode'), required: true, minLength: 1, maxLength: 64 },
  { prop: 'templateContent', label: t('admin.sms.templateContent'), required: true, type: 'textarea', minLength: 1, maxLength: 500 },
  { prop: 'templateType', label: t('admin.sms.templateType'), type: 'select', options: [
    { label: t('admin.sms.typeVerify'), value: '1' },
    { label: t('admin.sms.typeNotice'), value: '2' },
    { label: t('admin.sms.typeMarketing'), value: '3' },
  ] },
  { prop: 'signName', label: t('admin.sms.signName'), maxLength: 64 },
  { prop: 'status', label: t('admin.sms.status'), type: 'select', options: [
    { label: t('admin.sms.statusEnabled'), value: '0' },
    { label: t('admin.sms.statusDisabled'), value: '1' },
  ] },
  { prop: 'remark', label: t('admin.sms.remark'), type: 'textarea', maxLength: 200 },
]

// 后端列表返回 { list, total }, 需自定义 dataExtractor
const { keyword, page, size, total, loading, list, reload, onSearch, onPageChange } = useAdminTable({
  fetchFn: (params) => adminApi.smsTemplateList(params),
  dataExtractor: (res: any) => ({
    records: (res.data as any)?.list || [],
    total: (res.data as any)?.total || 0,
  }),
})

// 适配后端: 更新用 PUT body(含 templateId), 删除用 DELETE /:ids(逗号分隔)
const { dialogVisible, dialogMode, formData, submitting, onAdd, onEdit, onDelete, onBatchDelete, onSubmit, onSubmitContinue } = useAdminCrud({
  fields: formFields,
  idField: 'templateId',
  createFn: (data) => adminApi.smsTemplateCreate(data),
  updateFn: (id, data) => adminApi.smsTemplateUpdate({ ...data, templateId: id }),
  deleteFn: (id) => adminApi.smsTemplateDelete([id]),
  batchDeleteFn: (ids) => adminApi.smsTemplateDelete(ids),
  onSuccess: reload,
})

const columns: Column<any>[] = [
  { key: 'templateId', dataKey: 'templateId', title: 'ID', width: 80 },
  { key: 'templateName', dataKey: 'templateName', title: t('admin.sms.templateName'), width: 200 },
  { key: 'templateCode', dataKey: 'templateCode', title: t('admin.sms.templateCode'), width: 180 },
  { key: 'templateType', dataKey: 'templateType', title: t('admin.sms.templateType'), width: 120, cellRenderer: ({ cellData }: any) => {
    const map: Record<string, string> = { '1': t('admin.sms.typeVerify'), '2': t('admin.sms.typeNotice'), '3': t('admin.sms.typeMarketing') }
    return map[String(cellData)] || cellData
  }},
  { key: 'signName', dataKey: 'signName', title: t('admin.sms.signName'), width: 120 },
  { key: 'status', dataKey: 'status', title: t('admin.sms.status'), width: 100, cellRenderer: ({ cellData }: any) => {
    const enabled = String(cellData) === '0'
    return h(ElTag, { type: enabled ? 'success' : 'info', size: 'small' }, enabled ? t('admin.sms.statusEnabled') : t('admin.sms.statusDisabled'))
  }},
  { key: 'createTime', dataKey: 'createTime', title: t('admin.sms.createTime'), width: 180 },
  {
    key: 'actions',
    title: t('common.action'),
    width: 180,
    fixed: 'right' as any,
    cellRenderer: ({ rowData: row }: any) => h('div', {}, [
      h(ElButton, { size: 'small', link: true, type: 'primary', onClick: () => onEdit(row) }, t('common.edit')),
      h(ElButton, {
        size: 'small', link: true, type: 'warning',
        onClick: async () => {
          const newStatus = String(row.status) === '0' ? '1' : '0'
          await adminApi.smsTemplateChangeStatus(row.templateId, newStatus)
          reload()
        },
      }, t('admin.sms.toggleStatus')),
      h(ElButton, { size: 'small', link: true, type: 'danger', onClick: () => onDelete(row) }, t('common.delete')),
    ]),
  },
]

onMounted(reload)
</script>
