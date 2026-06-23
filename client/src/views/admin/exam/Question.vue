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
  <AdminQuestionDialog v-model:visible="dialogVisible" :mode="dialogMode" :initial-data="initialData" :categories="categories" @submit="onDialogSubmit" />
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ref, reactive, onMounted, h } from 'vue'
import { ElButton, ElTag, ElMessageBox, type Column } from 'element-plus'
import AdminTableV2 from '@/components/admin/AdminTableV2.vue'
import { adminApi } from '@/api/admin'
import AdminQuestionDialog from './QuestionDialog.vue'

const keyword = ref('')
const page = ref(1)
const size = ref(50)
const total = ref(0)
const loading = ref(false)
const list = ref<any[]>([])
const categories = ref<Array<{ id: number; name: string }>>([])
const dialogVisible = ref(false)
const dialogMode = ref<'add' | 'edit'>('add')
const initialData = reactive<Record<string, any>>({})

const typeLabel = (type?: number | string) => {
  if (type === 1 || type === '1') return '单选题'
  if (type === 2 || type === '2') return '多选题'
  if (type === 3 || type === '3') return '判断题'
  if (type === 4 || type === '4') return '填空题'
  if (type === 5 || type === '5') return '主观题'
  return String(type ?? '')
}

const difficultyLabel = (difficulty?: number | string) => {
  if (difficulty === 1 || difficulty === '1') return '简单'
  if (difficulty === 2 || difficulty === '2') return '中等'
  if (difficulty === 3 || difficulty === '3') return '困难'
  return String(difficulty ?? '')
}

const columns: Column<any>[] = [
  { key: 'id', dataKey: 'id', title: 'ID', width: 80 },
  { key: 'title', dataKey: 'title', title: '题目内容', width: 320 },
  { key: 'type', dataKey: 'type', title: '题型', width: 110, cellRenderer: ({ rowData: row }) => h('span', {}, typeLabel(row?.type)) },
  { key: 'difficulty', dataKey: 'difficulty', title: '难度', width: 90, cellRenderer: ({ rowData: row }) => h('span', {}, difficultyLabel(row?.difficulty)) },
  { key: 'score', dataKey: 'score', title: '分值', width: 100 },
  {
    key: 'actions',
    title: '操作',
    width: 180,
    fixed: 'right' as any,
    cellRenderer: ({ rowData: row }) => h('div', {}, [
      h(ElButton, { size: 'small', link: true, type: 'primary', onClick: () => openDialog('edit', row) }, t('common.edit')),
      h(ElButton, { size: 'small', link: true, type: 'danger', onClick: () => handleDelete(row) }, t('common.delete')),
    ]),
  },
]

const reload = async () => {
  loading.value = true
  try {
    const [listRes, categoryRes] = await Promise.all([
      adminApi.examQuestionList({ current: page.value, size: size.value, keyword: keyword.value }),
      adminApi.examQuestionCategory({ current: 1, size: 200 }),
    ])
    list.value = (listRes.data as any)?.records || []
    total.value = (listRes.data as any)?.total || 0
    categories.value = ((categoryRes.data as any)?.data || categoryRes.data || []) as Array<{ id: number; name: string }>
  } catch (e) { console.error(e) } finally {
    loading.value = false
  }
}

function resetFormData() {
  Object.assign(initialData, {
    paper_id: '',
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
    const options = row.options
    Object.assign(initialData, {
      paper_id: row.paperId ?? row.paper_id ?? '',
      type: row.type ?? 1,
      content: row.content ?? '',
      options: Array.isArray(options) ? JSON.stringify(options, null, 2) : String(options ?? '[]'),
      answer: row.answer ?? '',
      analysis: row.analysis ?? '',
      score: row.score ?? 0,
      difficulty: row.difficulty ?? 1,
      sort_order: row.sortOrder ?? row.sort_order ?? 0,
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
  let options = form.options
  if (typeof options === 'string') {
    try {
      options = JSON.parse(options)
      if (!Array.isArray(options)) {
        throw new Error('options 需要是数组')
      }
    } catch (error) {
      ElMessage.error(t('common.errors.jsonArrayError'))
      return
    }
  }
  const payload = {
    paper_id: Number(form.paper_id),
    type: Number(form.type),
    content: form.content,
    options: JSON.stringify(options),
    answer: String(form.answer ?? ''),
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

<style scoped lang="scss">
:where(.admin-list-page) {
  .toolbar {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
    flex-wrap: wrap;
    align-items: center;
  }

  .search-input {
    width: 240px;
  }

  .pager {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }

  :where(.el-table-v2) {
    font-size: 13px;
  }
}

@media (width <= 768px) {
  :where(.admin-list-page) {
    .toolbar {
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
      .search-input { width: 100%; }
    }

    .pager {
      justify-content: center;
      :where(.el-pagination__sizes, .el-pagination__jump) { display: none; }
    }
  }
}
</style>
