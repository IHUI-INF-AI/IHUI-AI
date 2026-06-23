<template>
  <AdminTableV2
    :data="list"
    :columns="columns"
    :total="total"
    :page="page"
    :size="size"
    :loading="loading"
    :keyword="keyword"
    :search-placeholder="t('exam.searchPlaceholder.chapter')"
    @search="onSearch"
    @page-change="onPageChange"
    :show-add="true"
    @add="openDialog()"
  />
  <AdminChapterDialog v-model:visible="dialogVisible" :mode="dialogMode" :initial-data="initialData" :papers="papers" @submit="onDialogSubmit" />
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ref, reactive, onMounted, h } from 'vue'
import { ElButton, ElMessageBox, type Column } from 'element-plus'
import AdminTableV2 from '@/components/admin/AdminTableV2.vue'
import { adminApi } from '@/api/admin'
import AdminChapterDialog from './ChapterDialog.vue'

const toPaperOption = (item: any) => {
  if (!item) return null
  const id = item.id ?? item.paperId
  const name = item.title ?? item.name ?? item.paperTitle ?? ''
  return id != null && name ? { id, name } : null
}

const keyword = ref('')
const page = ref(1)
const size = ref(50)
const total = ref(0)
const loading = ref(false)
const list = ref<any[]>([])
const papers = ref<Array<{ id: number; name: string }>>([])
const dialogVisible = ref(false)
const dialogMode = ref<'add' | 'edit'>('add')
const initialData = reactive<Record<string, any>>({})

const columns: Column<any>[] = [
  { key: 'id', dataKey: 'id', title: 'ID', width: 80 },
  { key: 'title', dataKey: 'title', title: '章节标题', width: 220 },
  { key: 'paperId', dataKey: 'paperId', title: '试卷ID', width: 100 },
  { key: 'questionNum', dataKey: 'questionNum', title: '题目数', width: 100 },
  { key: 'totalScore', dataKey: 'totalScore', title: '总分', width: 100 },
  { key: 'sortOrder', dataKey: 'sortOrder', title: '排序', width: 100 },
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
    const [listRes, paperRes] = await Promise.all([
      adminApi.examChapterList({ current: page.value, size: size.value, keyword: keyword.value }),
      adminApi.examList({ current: 1, size: 200 }),
    ])
    list.value = (listRes.data as any)?.records || []
    total.value = (listRes.data as any)?.total || 0
    const paperList = ((paperRes.data as any)?.records || (paperRes.data as any)?.data || paperRes.data || [])
      .map(toPaperOption)
      .filter((item: { id: number; name: string } | null): item is { id: number; name: string } => Boolean(item))
    papers.value = paperList
  } catch (e) { console.error(e) } finally {
    loading.value = false
  }
}

function resetFormData() {
  Object.assign(initialData, {
    paper_id: papers.value[0]?.id ?? '',
    title: '',
    description: '',
    cover: '',
    question_num: 0,
    total_score: 0,
    sort_order: 0,
  })
}

function openDialog(mode: 'add' | 'edit' = 'add', row?: any) {
  dialogMode.value = mode
  resetFormData()
  if (row) {
    Object.assign(initialData, {
      paper_id: row.paperId ?? row.paper_id ?? papers.value[0]?.id ?? '',
      title: row.title ?? '',
      description: row.description ?? '',
      cover: row.cover ?? '',
      question_num: row.questionNum ?? row.question_num ?? 0,
      total_score: row.totalScore ?? row.total_score ?? 0,
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
    await adminApi.examChapterDelete(id)
    ElMessage.success(t('common.messages.deleteSuccess'))
    reload()
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') {
      ElMessage.error(t('common.errors.deleteFailed'))
    }
  }
}

async function onDialogSubmit(form: Record<string, any>) {
  const payload = {
    paper_id: Number(form.paper_id),
    title: form.title,
    description: form.description,
    cover: form.cover,
    question_num: Number(form.question_num),
    total_score: Number(form.total_score),
    sort_order: Number(form.sort_order),
  }
  if (dialogMode.value === 'edit' && initialData.id) {
    await adminApi.examChapterUpdate(initialData.id, payload)
  } else {
    await adminApi.examChapterCreate(payload)
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
