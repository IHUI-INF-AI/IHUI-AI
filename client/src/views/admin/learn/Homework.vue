<template>
  <AdminTableV2
    :data="list"
    :columns="columns"
    :total="total"
    :page="page"
    :size="size"
    :loading="loading"
    :keyword="keyword"
    :search-placeholder="t('learn.searchPlaceholder.homework')"
    :show-add="false"
    @search="onSearch"
    @page-change="onPageChange"
  />
  <ElDialog v-model="reviewVisible" :title="t('adminCommon.label.review')" width="480px" :close-on-click-modal="false">
    <ElForm :model="reviewForm" label-width="100px" v-loading="submitting">
      <ElFormItem :label="t('adminCommon.label.lesson')">
        <span>{{ reviewForm.lessonId }}</span>
      </ElFormItem>
      <ElFormItem :label="t('adminCommon.label.member')">
        <span>{{ reviewForm.memberId }}</span>
      </ElFormItem>
      <ElFormItem :label="t('adminCommon.label.status')" required>
        <ElSelect v-model="reviewForm.status" :placeholder="t('adminCommon.label.status')" style="width: 100%">
          <ElOption :label="t('adminCommon.label.pass')" value="pass_approval" />
          <ElOption :label="t('adminCommon.label.reject')" value="reject_approval" />
        </ElSelect>
      </ElFormItem>
      <ElFormItem :label="t('adminCommon.label.reviewOpinion')">
        <ElInput v-model="reviewForm.remark" type="textarea" :rows="3" :placeholder="t('adminCommon.label.reviewOpinion')" />
      </ElFormItem>
    </ElForm>
    <template #footer>
      <ElButton @click="reviewVisible = false">{{ t('common.cancel') }}</ElButton>
      <ElButton type="primary" :loading="submitting" @click="onReviewSubmit">{{ t('common.save') }}</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
import { FIXED_RIGHT } from '@/utils/tableConstants'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ref, reactive, onMounted, h } from 'vue'
import { ElButton, ElDialog, ElForm, ElFormItem, ElSelect, ElOption, ElInput, ElMessage, type Column } from 'element-plus'
import AdminTableV2 from '@/components/admin/AdminTableV2.vue'
import { adminApi } from '@/api/admin'
import { useAdminTable } from '@/composables/useAdminTable'
import { logger } from '@/utils/logger'

const { keyword, page, size, total, loading, list, reload, onSearch, onPageChange } = useAdminTable({
  fetchFn: (params) => adminApi.learnHomeworkList(params),
})

const reviewVisible = ref(false)
const submitting = ref(false)
const currentId = ref<string | number | null>(null)
const reviewForm = reactive({ lessonId: '' as string | number, memberId: '' as string | number, status: 'pass_approval', remark: '' })

const onReview = (row: Record<string, unknown>) => {
  currentId.value = row.id as string | number
  reviewForm.lessonId = (row.lesson_id ?? '') as string | number
  reviewForm.memberId = (row.member_id ?? '') as string | number
  reviewForm.status = 'pass_approval'
  reviewForm.remark = ''
  reviewVisible.value = true
}

const onReviewSubmit = async () => {
  if (currentId.value === null) return
  submitting.value = true
  try {
    await adminApi.learnHomeworkReview(currentId.value, { status: reviewForm.status, remark: reviewForm.remark })
    ElMessage.success(t('common.messages.updateSuccess'))
    reviewVisible.value = false
    reload()
  } catch (e) {
    logger.error('Homework review failed:', e)
    ElMessage.error(t('common.errors.saveFailed'))
  } finally {
    submitting.value = false
  }
}

const columns: Column<unknown>[] = [
  { key: 'id', dataKey: 'id', title: 'ID', width: 80 },
  { key: 'lesson_id', dataKey: 'lesson_id', title: t('adminCommon.label.lesson'), width: 140 },
  { key: 'member_id', dataKey: 'member_id', title: t('adminCommon.label.member'), width: 140 },
  { key: 'status', dataKey: 'status', title: t('adminCommon.label.status'), width: 140 },
  { key: 'created_at', dataKey: 'created_at', title: t('adminCommon.label.submitTime'), width: 180 },
  {
    key: 'actions',
    title: t('adminCommon.label.operation'),
    width: 140,
    fixed: FIXED_RIGHT,
    cellRenderer: ({ rowData: row }) => h(ElButton, { size: 'small', link: true, type: 'primary', onClick: () => onReview(row as Record<string, unknown>) }, t('adminCommon.label.review')),
  },
]

onMounted(reload)
</script>
