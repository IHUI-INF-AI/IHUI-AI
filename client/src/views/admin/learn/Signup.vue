<template>
  <AdminTableV2
    :data="list"
    :columns="columns"
    :total="total"
    :page="page"
    :size="size"
    :loading="loading"
    :keyword="keyword"
    :search-placeholder="t('learn.searchPlaceholder.signup')"
    :show-add="false"
    @search="onSearch"
    @page-change="onPageChange"
  />
</template>

<script setup lang="ts">
import { FIXED_RIGHT } from '@/utils/tableConstants'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ref, onMounted, h } from 'vue'
import { ElButton, ElMessage, ElMessageBox, type Column } from 'element-plus'
import AdminTableV2 from '@/components/admin/AdminTableV2.vue'
import { adminApi } from '@/api/admin'
import { useAdminTable } from '@/composables/useAdminTable'
import { logger } from '@/utils/logger'

const { keyword, page, size, total, loading, list, reload, onSearch, onPageChange } = useAdminTable({
  fetchFn: (params) => adminApi.learnSignupList(params),
})

const acting = ref(false)

const onComplete = async (row: Record<string, unknown>) => {
  const id = row.id as string | number
  try {
    await ElMessageBox.confirm(t('adminCommon.label.complete') + '?', t('common.tip'), { type: 'warning' })
    acting.value = true
    await adminApi.learnSignupComplete(id)
    ElMessage.success(t('common.messages.updateSuccess'))
    reload()
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') {
      logger.error('Signup complete failed:', e)
      ElMessage.error(t('common.errors.saveFailed'))
    }
  } finally {
    acting.value = false
  }
}

const onCancel = async (row: Record<string, unknown>) => {
  const id = row.id as string | number
  try {
    await ElMessageBox.confirm(t('adminCommon.label.cancel') + '?', t('common.tip'), { type: 'warning' })
    acting.value = true
    await adminApi.learnSignupCancel(id)
    ElMessage.success(t('common.messages.updateSuccess'))
    reload()
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') {
      logger.error('Signup cancel failed:', e)
      ElMessage.error(t('common.errors.saveFailed'))
    }
  } finally {
    acting.value = false
  }
}

const columns: Column<unknown>[] = [
  { key: 'id', dataKey: 'id', title: 'ID', width: 80 },
  { key: 'lesson_id', dataKey: 'lesson_id', title: t('adminCommon.label.lesson'), width: 140 },
  { key: 'member_id', dataKey: 'member_id', title: t('adminCommon.label.member'), width: 140 },
  { key: 'status', dataKey: 'status', title: t('adminCommon.label.status'), width: 140 },
  { key: 'created_at', dataKey: 'created_at', title: t('adminCommon.label.signupTime'), width: 180 },
  {
    key: 'actions',
    title: t('adminCommon.label.operation'),
    width: 180,
    fixed: FIXED_RIGHT,
    cellRenderer: ({ rowData: row }) => {
      const r = row as Record<string, unknown>
      const status = r.status as string
      if (status !== 'enrolled') return h('span', {}, '-')
      return h('div', {}, [
        h(ElButton, { size: 'small', link: true, type: 'success', disabled: acting.value, onClick: () => onComplete(r) }, t('adminCommon.label.complete')),
        h(ElButton, { size: 'small', link: true, type: 'warning', disabled: acting.value, onClick: () => onCancel(r) }, t('adminCommon.label.cancel')),
      ])
    },
  },
]

onMounted(reload)
</script>
