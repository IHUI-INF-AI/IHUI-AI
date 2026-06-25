<template>
  <AdminTableV2
    :data="list"
    :columns="columns"
    :total="total"
    :page="page"
    :size="size"
    :loading="loading"
    :keyword="keyword"
    :search-placeholder="t('adminAiworldSite.searchPlaceholder')"
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
      <ElButton @click="onPreview">{{ t('adminAiworldSite.preview') }}</ElButton>
    </template>
  </AdminEditDialog>
  <ElDialog v-model="previewVisible" :title="t('adminAiworldSite.previewTitle')" width="700px" append-to-body>
    <div class="preview-toolbar" v-if="previewVisible">
      <ElRadioGroup v-model="previewDevice" size="small">
        <ElRadioButton value="pc">{{ t('adminAiworldSite.pcDevice') }}</ElRadioButton>
        <ElRadioButton value="mobile">{{ t('adminAiworldSite.mobileDevice') }}</ElRadioButton>
      </ElRadioGroup>
    </div>
    <div class="preview-detail" :class="{ 'preview-detail--mobile': previewDevice === 'mobile' }" v-if="previewVisible">
      <div class="preview-detail__head">
        <div class="preview-detail__icon-wrap">
          <img v-if="formData.iconUrl" :src="formData.iconUrl" class="preview-detail__icon" :alt="formData.name" />
          <span v-else class="preview-detail__icon-placeholder">{{ formData.name ? formData.name.charAt(0) : '?' }}</span>
        </div>
        <div class="preview-detail__info">
          <h3 class="preview-detail__name">{{ formData.name || t('adminAiworldSite.noSiteName') }}</h3>
          <p class="preview-detail__desc">{{ formData.shortDesc || t('adminAiworldSite.noDesc') }}</p>
          <div class="preview-detail__meta">
            <span class="preview-detail__tag" v-if="formData.section">{{ formData.section }}</span>
            <a v-if="formData.officialUrl" :href="formData.officialUrl" target="_blank" class="preview-detail__link">{{ t('adminAiworldSite.visitOfficial') }}</a>
            <router-link v-if="formData.detailUrl" :to="formData.detailUrl" target="_blank" class="preview-detail__link">{{ t('adminAiworldSite.viewDetailPage') }}</router-link>
          </div>
        </div>
      </div>
      <div class="preview-detail__panel" v-if="formData.panelHtml" v-html="sanitizeHtml(formData.panelHtml)"></div>
      <div class="preview-detail__panel-empty" v-else>{{ t('adminAiworldSite.noDetailContent') }}</div>
    </div>
  </ElDialog>
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
import { ref, onMounted, h } from 'vue'
import { ElButton, ElDialog, ElTag, ElRadioGroup, ElRadioButton, type Column } from 'element-plus'
import AdminTableV2 from '@/components/admin/AdminTableV2.vue'
import AdminEditDialog, { type FormField } from '@/components/admin/AdminEditDialog.vue'
import AdminBatchEditDialog from '@/components/admin/AdminBatchEditDialog.vue'
import { adminApi } from '@/api/admin/admin'
import { useAdminTable } from '@/composables/useAdminTable'
import { useAdminCrud } from '@/composables/useAdminCrud'
import { useI18n } from 'vue-i18n'
import { sanitizeHtml } from '@/utils/htmlSanitizer'

const { t } = useI18n()
const previewVisible = ref(false)
const previewDevice = ref<'pc' | 'mobile'>('pc')
const onPreview = () => { previewVisible.value = true }

const formFields: FormField[] = [
  { prop: 'name', label: t('adminCommon.label.siteName'), required: true, minLength: 1, maxLength: 100 },
  { prop: 'section', label: t('adminCommon.label.section'), required: true, minLength: 1, maxLength: 50, placeholder: t('adminAiworldSite.sectionPlaceholder') },
  { prop: 'shortDesc', label: t('adminCommon.label.shortDesc'), type: 'textarea', rows: 2, maxLength: 200 },
  { prop: 'iconUrl', label: t('adminCommon.label.iconUrl'), type: 'url', placeholder: 'https://example.com/favicon.ico' },
  { prop: 'officialUrl', label: t('adminCommon.label.officialUrl'), type: 'url', placeholder: 'https://example.com' },
  { prop: 'detailUrl', label: t('adminCommon.label.detailUrl'), placeholder: '/ai-world/detail/1' },
  { prop: 'panelHtml', label: t('adminCommon.label.panelHtml'), type: 'richtext', minHeight: 240 },
  { prop: 'sortOrder', label: t('adminCommon.label.sortOrder'), type: 'number', min: 0, max: 9999, step: 1 },
  { prop: 'status', label: t('adminCommon.label.status'), type: 'select', options: [
    { label: t('adminCommon.label.show'), value: 'active' },
    { label: t('adminCommon.label.hide'), value: 'inactive' },
  ] },
]

const { keyword, page, size, total, loading, list, reload, onSearch, onPageChange } = useAdminTable({
  fetchFn: (params) => adminApi.aiworldSiteList(params),
})

const { dialogVisible, dialogMode, formData, submitting, onAdd, onEdit, onDelete, onBatchDelete, onSubmit, onSubmitContinue, batchEditVisible, batchEditRows, batchEditProgress, onBatchEdit, onBatchEditSubmit, onBatchEditRetry } = useAdminCrud({
  fields: formFields,
  createFn: (data) => adminApi.aiworldSiteCreate(data),
  updateFn: (id, data) => adminApi.aiworldSiteUpdate(id, data),
  deleteFn: (id) => adminApi.aiworldSiteDelete(id),
  batchDeleteFn: (ids) => adminApi.aiworldSiteBatchDelete(ids),
  onSuccess: reload,
})

const columns: Column<any>[] = [
  { key: 'id', dataKey: 'id', title: 'ID', width: 80 },
  { key: 'name', dataKey: 'name', title: t('adminCommon.label.siteName'), width: 160 },
  { key: 'section', dataKey: 'section', title: t('adminCommon.label.category'), width: 120, cellRenderer: ({ rowData: row }) => h(ElTag, { type: 'info', size: 'small' }, row.section || '-') },
  { key: 'shortDesc', dataKey: 'shortDesc', title: t('adminCommon.label.description'), width: 240 },
  { key: 'officialUrl', dataKey: 'officialUrl', title: t('adminCommon.label.officialSite'), width: 180 },
  { key: 'sortOrder', dataKey: 'sortOrder', title: t('adminCommon.label.sort'), width: 80 },
  { key: 'status', dataKey: 'status', title: t('adminCommon.label.status'), width: 90, cellRenderer: ({ rowData: row }) => h(ElTag, { type: row.status === 'active' ? 'success' : 'danger', size: 'small' }, row.status === 'active' ? t('adminCommon.label.show') : t('adminCommon.label.hide')) },
  {
    key: 'actions',
    title: t('adminCommon.label.actions'),
    width: 180,
    fixed: 'right' as any,
    cellRenderer: ({ rowData: row }) => h('div', {}, [
      h(ElButton, { size: 'small', link: true, type: 'primary', onClick: () => onEdit(row) }, t('adminCommon.label.edit')),
      h(ElButton, { size: 'small', link: true, type: 'danger', onClick: () => onDelete(row) }, t('adminCommon.label.delete')),
    ]),
  },
]

onMounted(reload)
</script>

<style scoped>
.preview-toolbar {
  margin-bottom: 16px;
}
.preview-detail {
  padding: 16px;
}
.preview-detail--mobile {
  max-width: 375px;
  margin: 0 auto;
  padding: 12px;
  border: 8px solid var(--el-border-color-darker);
  border-radius: var(--global-border-radius);
  background: var(--el-bg-color);
  overflow: hidden;
}
.preview-detail--mobile .preview-detail__head {
  flex-direction: column;
  text-align: center;
  gap: 8px;
}
.preview-detail--mobile .preview-detail__icon-wrap {
  width: 56px;
  height: 56px;
  margin: 0 auto;
}
.preview-detail--mobile .preview-detail__name {
  font-size: 18px;
}
.preview-detail--mobile .preview-detail__meta {
  justify-content: center;
  flex-wrap: wrap;
}
.preview-detail--mobile .preview-detail__panel {
  padding: 8px;
  font-size: 13px;
}
.preview-detail--mobile .preview-detail__panel :deep(h1) { font-size: 18px; }
.preview-detail--mobile .preview-detail__panel :deep(h2) { font-size: 16px; }
.preview-detail--mobile .preview-detail__panel :deep(h3) { font-size: 15px; }
.preview-detail--mobile .preview-detail__panel :deep(img) { max-width: 100%; }
.preview-detail__head {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: var(--unified-border-bottom);
}
.preview-detail__icon-wrap {
  flex-shrink: 0;
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--global-border-radius);
  background: var(--el-fill-color-light);
  overflow: hidden;
}
.preview-detail__icon {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.preview-detail__icon-placeholder {
  font-size: 28px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}
.preview-detail__info {
  flex: 1;
  min-width: 0;
}
.preview-detail__name {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.preview-detail__desc {
  margin: 0 0 8px;
  color: var(--el-text-color-regular);
  font-size: 14px;
}
.preview-detail__meta {
  display: flex;
  gap: 12px;
  align-items: center;
}
.preview-detail__tag {
  padding: 2px 8px;
  border-radius: var(--global-border-radius);
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-size: 12px;
}
.preview-detail__link {
  color: var(--el-color-primary);
  font-size: 13px;
  text-decoration: none;
}
.preview-detail__link:hover {
  text-decoration: underline;
}
.preview-detail__panel {
  padding: 16px;
  border-radius: var(--global-border-radius);
  background: var(--el-fill-color-blank);
  color: var(--el-text-color-primary);
  line-height: 1.8;
  font-size: 14px;
}
.preview-detail__panel :deep(h1) { font-size: 22px; margin: 16px 0 12px; font-weight: 600; }
.preview-detail__panel :deep(h2) { font-size: 18px; margin: 14px 0 10px; font-weight: 600; }
.preview-detail__panel :deep(h3) { font-size: 16px; margin: 12px 0 8px; font-weight: 600; }
.preview-detail__panel :deep(p) { margin: 8px 0; }
.preview-detail__panel :deep(img) { max-width: 100%; border-radius: var(--global-border-radius); margin: 8px 0; }
.preview-detail__panel :deep(ul) { padding-left: 24px; margin: 8px 0; }
.preview-detail__panel :deep(ol) { padding-left: 24px; margin: 8px 0; }
.preview-detail__panel :deep(li) { margin: 4px 0; }
.preview-detail__panel :deep(a) { color: var(--el-color-primary); text-decoration: none; }
.preview-detail__panel :deep(a:hover) { text-decoration: underline; }
.preview-detail__panel :deep(blockquote) { margin: 12px 0; padding: 8px 16px; border-left: 4px solid var(--el-color-primary-light-5); background: var(--el-fill-color-light); border-radius: var(--global-border-radius); }
.preview-detail__panel :deep(pre) { margin: 12px 0; padding: 12px; background: var(--el-fill-color-darker); border-radius: var(--global-border-radius); overflow-x: auto; }
.preview-detail__panel :deep(code) { font-family: monospace; font-size: 13px; }
.preview-detail__panel-empty {
  padding: 24px;
  text-align: center;
  color: var(--el-text-color-secondary);
}
</style>
