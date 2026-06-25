<template>
  <AdminTableV2
    :data="list"
    :columns="columns"
    :total="total"
    :page="page"
    :size="size"
    :loading="loading"
    :keyword="keyword"
    :search-placeholder="t('setting.placeholder.searchCarousel')"
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
  >
    <template #footer-extra>
      <ElButton @click="onPreview">{{ t('adminSettingCarousel.preview') }}</ElButton>
    </template>
  </AdminEditDialog>
  <AdminBatchEditDialog
    v-model:visible="batchEditVisible"
    :rows="batchEditRows"
    :fields="formFields"
    :submitting="submitting"
    :progress="batchEditProgress"
    @submit="onBatchEditSubmit"
    @retry="onBatchEditRetry"
  />
  <ElDialog v-model="previewVisible" :title="t('adminSettingCarousel.previewTitle')" width="700px" append-to-body>
    <div class="preview-carousel" v-if="previewVisible">
      <div class="preview-carousel__image-wrap">
        <img v-if="formData.image" :src="formData.image" class="preview-carousel__image" :alt="formData.title" loading="lazy" />
        <span v-else class="preview-carousel__image-placeholder">{{ t('adminSettingCarousel.noImage') }}</span>
      </div>
      <div class="preview-carousel__info">
        <h3 class="preview-carousel__title">{{ formData.title || t('adminSettingCarousel.noTitle') }}</h3>
        <div class="preview-carousel__meta">
          <span class="preview-carousel__tag" v-if="formData.status">{{ formData.status === 'on' ? t('adminCommon.label.show') : t('adminCommon.label.hide') }}</span>
          <a v-if="formData.link" :href="formData.link" target="_blank" class="preview-carousel__link">{{ t('adminSettingCarousel.viewJumpPage') }}</a>
        </div>
      </div>
    </div>
  </ElDialog>
</template>

<script setup lang="ts">
import { ref, onMounted, h } from 'vue'
import { ElButton, ElDialog, ElImage, ElTag, type Column } from 'element-plus'
import AdminTableV2 from '@/components/admin/AdminTableV2.vue'
import AdminEditDialog, { type FormField } from '@/components/admin/AdminEditDialog.vue'
import AdminBatchEditDialog from '@/components/admin/AdminBatchEditDialog.vue'
import { adminApi } from '@/api/admin/admin'
import { useAdminTable } from '@/composables/useAdminTable'
import { useAdminCrud } from '@/composables/useAdminCrud'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const previewVisible = ref(false)
const onPreview = () => { previewVisible.value = true }

const formFields: FormField[] = [
  { prop: 'title', label: t('adminCommon.label.title'), required: true, minLength: 1, maxLength: 100 },
  { prop: 'image', label: t('adminCommon.label.imageLink'), maxLength: 500 },
  { prop: 'link', label: t('adminCommon.label.jumpLink'), maxLength: 500 },
  { prop: 'sort', label: t('adminCommon.label.sort'), type: 'number', min: 0, max: 9999 },
  { prop: 'status', label: t('adminCommon.label.status'), type: 'select', options: [
    { label: t('adminCommon.label.show'), value: 'on' },
    { label: t('adminCommon.label.hide'), value: 'off' },
  ] },
]

const { keyword, page, size, total, loading, list, reload, onSearch, onPageChange } = useAdminTable({
  fetchFn: (params) => adminApi.settingCarousel(params),
})

const { dialogVisible, dialogMode, formData, submitting, onAdd, onEdit, onDelete, onBatchDelete, onSubmit, onSubmitContinue, batchEditVisible, batchEditRows, batchEditProgress, onBatchEdit, onBatchEditSubmit, onBatchEditRetry } = useAdminCrud({
  fields: formFields,
  createFn: (data) => adminApi.settingCarouselCreate(data),
  updateFn: (id, data) => adminApi.settingCarouselUpdate(id, data),
  deleteFn: (id) => adminApi.settingCarouselDelete(id),
  batchDeleteFn: (ids) => adminApi.settingCarouselBatchDelete(ids),
  onSuccess: reload,
})

const columns: Column<any>[] = [
  { key: 'id', dataKey: 'id', title: 'ID', width: 80 },
  { key: 'title', dataKey: 'title', title: t('adminCommon.label.title'), width: 180 },
  {
    key: 'image',
    dataKey: 'image',
    title: t('adminCommon.label.image'),
    width: 160,
    cellRenderer: ({ rowData: row }) => h(ElImage, { src: row.image, fit: 'cover', class: 'thumb' }),
  },
  { key: 'link', dataKey: 'link', title: t('adminCommon.label.jumpLink'), width: 220 },
  { key: 'sort', dataKey: 'sort', title: t('adminCommon.label.sort'), width: 80 },
  {
    key: 'status',
    dataKey: 'status',
    title: t('adminCommon.label.status'),
    width: 100,
    cellRenderer: ({ rowData: row }) => h(ElTag, { type: row.status === 'on' ? 'success' : 'info' }, row.status === 'on' ? t('adminCommon.label.show') : t('adminCommon.label.hide')),
  },
  {
    key: 'actions',
    title: t('adminCommon.label.actions'),
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

<style scoped lang="scss">
:where(.admin-list-page) {
  .toolbar {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
  }

  .search-input {
    width: 240px;
  }

  .thumb {
    width: 80px;
    height: 40px;
    border-radius: var(--global-border-radius);
  }
}

.preview-carousel { padding: 16px; }
.preview-carousel__image-wrap { width: 100%; height: 280px; border-radius: var(--global-border-radius); overflow: hidden; background: var(--el-fill-color-light); display: flex; align-items: center; justify-content: center; margin-bottom: 16px; }
.preview-carousel__image { width: 100%; height: 100%; object-fit: cover; }
.preview-carousel__image-placeholder { color: var(--el-text-color-secondary); font-size: 14px; }
.preview-carousel__info { padding: 0 4px; }
.preview-carousel__title { margin: 0 0 8px; font-size: 18px; font-weight: 600; color: var(--el-text-color-primary); }
.preview-carousel__meta { display: flex; gap: 12px; align-items: center; }
.preview-carousel__tag { padding: 2px 8px; border-radius: var(--global-border-radius); background: var(--el-color-primary-light-9); color: var(--el-color-primary); font-size: 12px; }
.preview-carousel__link { color: var(--el-color-primary); font-size: 13px; text-decoration: none; }
.preview-carousel__link:hover { text-decoration: underline; }
</style>
