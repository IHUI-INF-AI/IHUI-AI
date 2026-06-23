<template>
  <AdminTableV2
    :data="list"
    :columns="columns"
    :total="total"
    :page="page"
    :size="size"
    :loading="loading"
    :keyword="keyword"
    :search-placeholder="t('exam.searchPlaceholder.list')"
    @search="onSearch"
    @page-change="onPageChange"
    :show-add="true"
    @add="openDialog()"
  />
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ref, reactive, onMounted, h } from 'vue'
import { ElButton, ElTag, ElMessageBox, type Column } from 'element-plus'
import AdminTableV2 from '@/components/admin/AdminTableV2.vue'
import { adminApi } from '@/api/admin'
import AdminPaperDialog from './PaperDialog.vue'

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
  if (type === 1 || type === '1') return '正式试卷'
  if (type === 2 || type === '2') return '固定试卷'
  if (type === 3 || type === '3') return '模拟试卷'
  if (type === 'random') return '随机试卷'
  return String(type ?? '')
}

const difficultyLabel = (difficulty?: number | string) => {
  if (difficulty === 1 || difficulty === '1') return '简单'
  if (difficulty === 2 || difficulty === '2') return '中等'
  if (difficulty === 3 || difficulty === '3') return '困难'
  return String(difficulty ?? '')
}

const statusLabel = (status?: number | string) => {
  if (status === 1 || status === '1') return '已上架'
  if (status === 0 || status === '0') return '已下架'
  if (status === 2 || status === '2') return '待审核'
  return String(status ?? '')
}

const columns: Column<any>[] = [
  { key: 'id', dataKey: 'id', title: 'ID', width: 80 },
  { key: 'name', dataKey: 'name', title: '试卷名称', width: 220 },
  { key: 'category', dataKey: 'category', title: '分类', width: 120 },
  { key: 'type', dataKey: 'type', title: '类型', width: 110, cellRenderer: ({ rowData: row }) => h('span', {}, typeLabel(row?.type)) },
  { key: 'difficulty', dataKey: 'difficulty', title: '难度', width: 90, cellRenderer: ({ rowData: row }) => h('span', {}, difficultyLabel(row?.difficulty)) },
  { key: 'duration', dataKey: 'duration', title: '时长(分钟)', width: 120 },
  { key: 'totalScore', dataKey: 'totalScore', title: '总分', width: 100 },
  { key: 'passScore', dataKey: 'passScore', title: '及格分', width: 100 },
  { key: 'questionNum', dataKey: 'questionNum', title: '题目数', width: 100 },
  { key: 'attemptNum', dataKey: 'attemptNum', title: '报名数', width: 100 },
  { key: 'avgScore', dataKey: 'avgScore', title: '平均分', width: 100 },
  {
    key: 'isFree',
    dataKey: 'isFree',
    title: '资费',
    width: 100,
    cellRenderer: ({ rowData: row }) => h(ElTag, { type: row?.isFree ? 'success' : 'warning' }, h('span', {}, row?.isFree ? '免费' : '付费')),
  },
  { key: 'price', dataKey: 'price', title: '价格', width: 100 },
  {
    key: 'status',
    dataKey: 'status',
    title: '状态',
    width: 100,
    cellRenderer: ({ rowData: row }) => h(ElTag, { type: row?.status === 1 ? 'success' : row?.status === 2 ? 'warning' : 'info' }, h('span', {}, statusLabel(row?.status))),
  },
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
      adminApi.examPaperList({ current: page.value, size: size.value, keyword: keyword.value }),
      adminApi.examPaperCategory({ current: 1, size: 200 }),
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
    title: '',
    description: '',
    status: 1,
    category_id: categories.value[0]?.id ?? '',
    cover: '',
    total_score: 100,
    pass_score: 60,
    duration: 60,
    type: 1,
    difficulty: 1,
    is_free: true,
    price: 0,
    sort_order: 0,
  })
}

function openDialog(mode: 'add' | 'edit' = 'add', row?: any) {
  dialogMode.value = mode
  resetFormData()
  if (row) {
    Object.assign(initialData, {
      title: row.name ?? row.title,
      description: row.description ?? '',
      category_id: row.categoryId ?? row.category_id ?? categories.value[0]?.id ?? '',
      cover: row.cover ?? '',
      total_score: row.totalScore ?? row.total_score ?? 100,
      pass_score: row.passScore ?? row.pass_score ?? 60,
      duration: row.duration ?? 60,
      type: row.type ?? 1,
      difficulty: row.difficulty ?? 1,
      is_free: row.isFree ?? row.is_free ?? true,
      price: row.price ?? 0,
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
    await adminApi.examPaperDelete(id)
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
    title: form.title,
    description: form.description,
    category_id: Number(form.category_id),
    cover: form.cover,
    total_score: Number(form.total_score),
    pass_score: Number(form.pass_score),
    duration: Number(form.duration),
    type: Number(form.type),
    difficulty: Number(form.difficulty),
    is_free: Boolean(form.is_free),
    price: Number(form.price),
    sort_order: Number(form.sort_order),
  }
  if (dialogMode.value === 'edit' && initialData.id) {
    await adminApi.examPaperUpdate(initialData.id, payload)
  } else {
    await adminApi.examPaperCreate(payload)
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
