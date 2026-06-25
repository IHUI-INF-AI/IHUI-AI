<template>
  <AdminTableV2
    :data="list"
    :columns="columns"
    :total="total"
    :page="page"
    :size="size"
    :loading="loading"
    :keyword="keyword"
    :search-placeholder="t('exam.searchPlaceholder.chapterSection')"
    @search="onSearch"
    @page-change="onPageChange"
    :show-add="true"
    @add="openDialog()"
  />
  <AdminChapterSectionDialog v-model:visible="dialogVisible" :mode="dialogMode" :initial-data="initialData" :chapters="chapters" @submit="onDialogSubmit" />
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ref, reactive, onMounted, h } from 'vue'
import { ElButton, ElMessageBox, type Column } from 'element-plus'
import AdminTableV2 from '@/components/admin/AdminTableV2.vue'
import { adminApi } from '@/api/admin/admin'
import AdminChapterSectionDialog from './ChapterSectionDialog.vue'

const keyword = ref('')
const page = ref(1)
const size = ref(50)
const total = ref(0)
const loading = ref(false)
const list = ref<any[]>([])
const chapters = ref<Array<{ id: number; title: string }>>([])
const dialogVisible = ref(false)
const dialogMode = ref<'add' | 'edit'>('add')
const initialData = reactive<Record<string, any>>({})

const columns: Column<any>[] = [
  { key: 'id', dataKey: 'id', title: 'ID', width: 80 },
  { key: 'title', dataKey: 'title', title: '小节标题', width: 220 },
  { key: 'chapterId', dataKey: 'chapterId', title: '章节ID', width: 100 },
  { key: 'paperId', dataKey: 'paperId', title: '试卷ID', width: 100 },
  { key: 'questionNum', dataKey: 'questionNum', title: '题目数', width: 100 },
  { key: 'totalScore', dataKey: 'totalScore', title: '总分', width: 100 },
  { key: 'duration', dataKey: 'duration', title: '学习时长(分钟)', width: 140 },
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
    const [listRes, chapterRes] = await Promise.all([
      adminApi.examChapterSectionList({ current: page.value, size: size.value, keyword: keyword.value }),
      adminApi.examChapterList({ current: 1, size: 200 }),
    ])
    list.value = (listRes.data as any)?.records || []
    total.value = (listRes.data as any)?.total || 0
    const chapterList = ((chapterRes.data as any)?.list || (chapterRes.data as any)?.records || []).filter((item: any) => item && item.id)
    chapters.value = chapterList.map((item: any) => ({ id: item.id, title: item.title ?? item.paperTitle ?? `章节 #${item.id}` }))
  } catch (e) { console.error(e) } finally {
    loading.value = false
  }
}

function resetFormData() {
  Object.assign(initialData, {
    chapter_id: chapters.value[0]?.id ?? '',
    paper_id: '',
    title: '',
    description: '',
    media_url: '',
    content: '',
    question_num: 0,
    total_score: 0,
    duration: 0,
    sort_order: 0,
  })
}

function openDialog(mode: 'add' | 'edit' = 'add', row?: any) {
  dialogMode.value = mode
  resetFormData()
  if (row) {
    Object.assign(initialData, {
      chapter_id: row.chapterId ?? row.chapter_id ?? chapters.value[0]?.id ?? '',
      paper_id: row.paperId ?? row.paper_id ?? '',
      title: row.title ?? '',
      description: row.description ?? '',
      media_url: row.mediaUrl ?? row.media_url ?? '',
      content: row.content ?? '',
      question_num: row.questionNum ?? row.question_num ?? 0,
      total_score: row.totalScore ?? row.total_score ?? 0,
      duration: row.duration ?? 0,
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
    await adminApi.examChapterSectionDelete(id)
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
    chapter_id: Number(form.chapter_id),
    paper_id: Number(form.paper_id),
    title: form.title,
    description: form.description,
    media_url: form.media_url,
    content: form.content,
    question_num: Number(form.question_num),
    total_score: Number(form.total_score),
    duration: Number(form.duration),
    sort_order: Number(form.sort_order),
  }
  if (dialogMode.value === 'edit' && initialData.id) {
    await adminApi.examChapterSectionUpdate(initialData.id, payload)
  } else {
    await adminApi.examChapterSectionCreate(payload)
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
