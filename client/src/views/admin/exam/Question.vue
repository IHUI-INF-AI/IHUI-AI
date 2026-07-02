<template>
  <AdminTableV2
    :data="list"
    :columns="columns"
    :total="total"
    :page="page"
    :size="size"
    :loading="loading"
    :keyword="keyword"
    :search-placeholder="t('exam.searchPlaceholder.question')"
    @search="onSearch"
    @page-change="onPageChange"
    :show-add="true"
    @add="openDialog()"
  />
  <QuestionDialog v-model:visible="dialogVisible" :mode="dialogMode" :initial-data="initialData" :categories="categories" :submitting="submitting" @submit="onDialogSubmit" />
</template>

<script setup lang="ts">
import { FIXED_RIGHT } from '@/utils/tableConstants'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ref, reactive, onMounted, h } from 'vue'
import { ElButton, ElMessageBox, ElMessage, type Column } from 'element-plus'
import AdminTableV2 from '@/components/admin/AdminTableV2.vue'
import { adminApi } from '@/api/admin/admin'
import QuestionDialog from './QuestionDialog.vue'

const keyword = ref('')
const page = ref(1)
const size = ref(50)
const total = ref(0)
const loading = ref(false)
const list = ref<any[]>([])
const categories = ref<Array<{ id: number; name: string }>>([])
const submitting = ref(false)

const dialogVisible = ref(false)
const dialogMode = ref<'add' | 'edit'>('add')
const initialData = reactive<Record<string, any>>({})

const columns: Column<any>[] = [
  { key: 'id', dataKey: 'id', title: 'ID', width: 80 },
  { key: 'title', dataKey: 'title', title: t('adminCommon.label.questionTitle'), width: 300 },
  { key: 'type', dataKey: 'type', title: t('adminCommon.label.type'), width: 100 },
  { key: 'difficulty', dataKey: 'difficulty', title: t('adminCommon.label.difficulty'), width: 80 },
  {
    key: 'actions',
    title: t('adminCommon.label.operation'),
    width: 180,
    fixed: FIXED_RIGHT,
    cellRenderer: ({ rowData: row }) => h('div', {}, [
      h(ElButton, { size: 'small', link: true, type: 'primary', onClick: () => openDialog('edit', row) }, t('common.edit')),
      h(ElButton, { size: 'small', link: true, type: 'danger', onClick: () => handleDelete(row) }, t('common.delete')),
    ]),
  },
]

const toCategoryOption = (item: any) => {
  if (!item) return null
  const id = item.id ?? item.categoryId
  const name = item.name ?? item.title ?? item.categoryName ?? ''
  return id != null && name ? { id, name } : null
}

const reload = async () => {
  loading.value = true
  try {
    const [listRes, catRes] = await Promise.all([
      adminApi.examQuestionList({ current: page.value, size: size.value, keyword: keyword.value }),
      adminApi.examQuestionCategory({ current: 1, size: 200 }),
    ])
    list.value = (listRes.data as { records?: any[]; total?: number })?.records || []
    total.value = (listRes.data as { records?: any[]; total?: number })?.total || 0
    const catList = ((catRes.data as any) ?? []) as any[]
    categories.value = catList.map(toCategoryOption).filter((item: { id: number; name: string } | null): item is { id: number; name: string } => Boolean(item))
  } catch (e) { console.error(e) } finally {
    loading.value = false
  }
}

function resetFormData() {
  Object.assign(initialData, {
    paper_id: 1,
    type: 1,
    content: '',
    options: '[]',
    answer: '',
    analysis: '',
    score: 0,
    difficulty: 1,
    sort_order: 0,
  })
}

function openDialog(mode: 'add' | 'edit' = 'add', row?: any) {
  dialogMode.value = mode
  resetFormData()
  if (row) {
    Object.assign(initialData, {
      id: row.id,
      paper_id: row.paper_id ?? row.paperId ?? 1,
      type: row.type ?? 1,
      content: row.content ?? row.title ?? '',
      options: Array.isArray(row.options) ? JSON.stringify(row.options, null, 2) : String(row.options ?? '[]'),
      answer: row.answer ?? '',
      analysis: row.analysis ?? '',
      score: row.score ?? 0,
      difficulty: row.difficulty ?? 1,
      sort_order: row.sort_order ?? row.sortOrder ?? 0,
    })
  }
  dialogVisible.value = true
}

async function handleDelete(row: any) {
  const id = row.id
  if (!id) return
  try {
    await ElMessageBox.confirm(t('common.confirmDelete'), t('common.tip'), { type: 'warning' })
    await adminApi.examQuestionDelete(id)
    ElMessage.success(t('common.messages.deleteSuccess'))
    reload()
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') {
      ElMessage.error(t('common.errors.deleteFailed'))
    }
  }
}

async function onDialogSubmit(form: Record<string, any>) {
  submitting.value = true
  try {
    const payload = {
      paper_id: Number(form.paper_id),
      type: Number(form.type),
      content: form.content,
      options: form.options,
      answer: form.answer,
      analysis: form.analysis,
      score: Number(form.score),
      difficulty: Number(form.difficulty),
      sort_order: Number(form.sort_order),
    }
    if (dialogMode.value === 'edit' && initialData.id) {
      await adminApi.examQuestionUpdate(initialData.id, payload)
    } else {
      await adminApi.examQuestionCreate(payload)
    }
    dialogVisible.value = false
    ElMessage.success(t('common.messages.saveSuccess'))
    reload()
  } catch (e) {
    console.error(e)
    ElMessage.error(t('common.errors.saveFailed'))
  } finally {
    submitting.value = false
  }
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
