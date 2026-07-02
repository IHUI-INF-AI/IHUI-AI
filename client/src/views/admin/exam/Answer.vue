<template>
  <AdminTableV2
    :data="list"
    :columns="columns"
    :total="total"
    :page="page"
    :size="size"
    :loading="loading"
    :keyword="keyword"
    :search-placeholder="t('exam.searchPlaceholder.answer')"
    @search="onSearch"
    @page-change="onPageChange"
    :show-add="false"
  />
  <AnswerDetailDialog v-model:visible="dialogVisible" :initial-data="initialData" @submit="onDialogSubmit" @close="onDialogClose" />
</template>

<script setup lang="ts">
import { FIXED_RIGHT } from '@/utils/tableConstants'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ref, reactive, onMounted, h } from 'vue'
import { ElButton, ElMessageBox, ElMessage, type Column } from 'element-plus'
import AdminTableV2 from '@/components/admin/AdminTableV2.vue'
import { adminApi } from '@/api/admin/admin'
import AnswerDetailDialog from './AnswerDetailDialog.vue'

const keyword = ref('')
const page = ref(1)
const size = ref(50)
const total = ref(0)
const loading = ref(false)
const list = ref<any[]>([])

const dialogVisible = ref(false)
const initialData = reactive<Record<string, any>>({})

const columns: Column<any>[] = [
  { key: 'id', dataKey: 'id', title: 'ID', width: 80 },
  { key: 'user', dataKey: 'user', title: t('adminCommon.label.user'), width: 140 },
  { key: 'paper', dataKey: 'paper', title: t('adminCommon.label.paper'), width: 220 },
  { key: 'score', dataKey: 'score', title: t('adminCommon.label.score'), width: 100 },
  {
    key: 'actions',
    title: t('adminCommon.label.operation'),
    width: 180,
    fixed: FIXED_RIGHT,
    cellRenderer: ({ rowData: row }) => h('div', {}, [
      h(ElButton, { size: 'small', link: true, type: 'primary', onClick: () => openDetail(row) }, t('common.edit')),
      h(ElButton, { size: 'small', link: true, type: 'danger', onClick: () => handleDelete(row) }, t('common.delete')),
    ]),
  },
]

const reload = async () => {
  loading.value = true
  try {
    const res = await adminApi.examAnswerList({ current: page.value, size: size.value, keyword: keyword.value })
    list.value = (res.data as { records?: any[]; total?: number })?.records || []
    total.value = (res.data as { records?: any[]; total?: number })?.total || 0
  } catch (e) { console.error(e) } finally {
    loading.value = false
  }
}

function openDetail(row: any) {
  Object.assign(initialData, { id: row.id })
  dialogVisible.value = true
}

async function handleDelete(row: any) {
  const id = row.id
  if (!id) return
  try {
    await ElMessageBox.confirm(t('common.confirmDelete'), t('common.tip'), { type: 'warning' })
    await adminApi.examAnswerDelete(id)
    ElMessage.success(t('common.messages.deleteSuccess'))
    reload()
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') {
      ElMessage.error(t('common.errors.deleteFailed'))
    }
  }
}

function onDialogSubmit() {
  // AnswerDetailDialog 内部已调用 examAnswerMarkSave 保存批改, 这里只需刷新列表
  reload()
}

function onDialogClose() {
  // dialog 关闭回调, 无额外操作
}

const onSearch = (k: string) => {
  keyword.value = k
  page.value = 1
  reload()
}

const onPageChange = (p: number, s: number) => {
  page.value = p
  size.value = s
  reload()
}


onMounted(reload)
</script>
