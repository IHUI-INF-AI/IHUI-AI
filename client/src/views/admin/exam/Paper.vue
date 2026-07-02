<template>
  <AdminTableV2
    :data="list"
    :columns="columns"
    :total="total"
    :page="page"
    :size="size"
    :loading="loading"
    :keyword="keyword"
    :search-placeholder="t('exam.searchPlaceholder.paper')"
    @search="onSearch"
    @page-change="onPageChange"
    :show-add="true"
    @add="openDialog()"
  />
  <PaperDialog v-model:visible="dialogVisible" :mode="dialogMode" :initial-data="initialData" :categories="categories" :submitting="submitting" @submit="onDialogSubmit" />
</template>

<script setup lang="ts">
import { FIXED_RIGHT } from '@/utils/tableConstants'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ref, reactive, onMounted, h } from 'vue'
import { ElButton, ElMessageBox, ElMessage, type Column } from 'element-plus'
import AdminTableV2 from '@/components/admin/AdminTableV2.vue'
import { adminApi } from '@/api/admin/admin'
import PaperDialog from './PaperDialog.vue'

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
  { key: 'name', dataKey: 'name', title: t('adminCommon.label.paperName'), width: 220 },
  { key: 'type', dataKey: 'type', title: t('adminCommon.label.type'), width: 100 },
  { key: 'totalScore', dataKey: 'totalScore', title: t('adminCommon.label.totalScore'), width: 100 },
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
      adminApi.examPaperList({ current: page.value, size: size.value, keyword: keyword.value }),
      adminApi.examPaperCategory({ current: 1, size: 200 }),
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
    title: '',
    description: '',
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
      id: row.id,
      title: row.title ?? row.name ?? '',
      description: row.description ?? '',
      category_id: row.category_id ?? row.categoryId ?? categories.value[0]?.id ?? '',
      cover: row.cover ?? '',
      total_score: row.total_score ?? row.totalScore ?? 100,
      pass_score: row.pass_score ?? row.passScore ?? 60,
      duration: row.duration ?? 60,
      type: row.type ?? 1,
      difficulty: row.difficulty ?? 1,
      is_free: row.is_free ?? row.isFree ?? true,
      price: row.price ?? 0,
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
  submitting.value = true
  try {
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
