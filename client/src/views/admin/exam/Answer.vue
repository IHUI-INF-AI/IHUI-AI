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
    :selectable="true"
    @add="openDetailDialog()"
    @batch-delete="onBatchDelete"
  />
  <AdminAnswerDetailDialog v-model:visible="detailVisible" :initial-data="detailInitialData" @close="detailVisible = false" />
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ref, onMounted, h } from 'vue'
import { ElTag, ElMessage, ElMessageBox, type Column } from 'element-plus'
import AdminTableV2 from '@/components/admin/AdminTableV2.vue'
import { adminApi } from '@/api/admin'
import AdminAnswerDetailDialog from './AnswerDetailDialog.vue'

const keyword = ref('')
const page = ref(1)
const size = ref(50)
const total = ref(0)
const loading = ref(false)
const list = ref<any[]>([])
const detailVisible = ref(false)
const detailInitialData = reactive<Record<string, any>>({ id: null })

const columns: Column<any>[] = [
  { key: 'id', dataKey: 'id', title: 'ID', width: 80 },
  { key: 'user', dataKey: 'user', title: '用户', width: 140 },
  { key: 'paper', dataKey: 'paper', title: '试卷', width: 220 },
  { key: 'score', dataKey: 'score', title: '得分', width: 100 },
  { key: 'totalScore', dataKey: 'totalScore', title: '总分', width: 100 },
  {
    key: 'status',
    dataKey: 'status',
    title: '状态',
    width: 100,
    cellRenderer: ({ rowData: row }) => {
      const status = Number(row?.status)
      if (status === 2) return h(ElTag, { type: 'success' }, h('span', {}, '已批改'))
      if (status === 1) return h(ElTag, { type: 'warning' }, h('span', {}, '待批改'))
      return h(ElTag, { type: 'info' }, h('span', {}, '未提交'))
    },
  },
  { key: 'submitTime', dataKey: 'submitTime', title: '提交时间', width: 180 },
]

const reload = async () => {
  loading.value = true
  try {
    const res = await adminApi.examAnswerList({ current: page.value, size: size.value, keyword: keyword.value })
    list.value = (res.data as any)?.records || []
    total.value = (res.data as any)?.total || 0
  } catch (e) { console.error(e) } finally {
    loading.value = false
  }
}

function openDetailDialog(row?: any) {
  Object.assign(detailInitialData, row || { id: '' })
  detailVisible.value = true
}

async function onBatchDelete(ids: (string | number)[]) {
  if (!ids.length) return
  try {
    await ElMessageBox.confirm(`${t('common.confirmBatchDelete')} (${ids.length})`, t('common.tip'), { type: 'warning' })
    await adminApi.examAnswerBatchDelete(ids)
    ElMessage.success(t('common.messages.deleteSuccess'))
    reload()
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') {
      ElMessage.error(t('common.errors.deleteFailed'))
    }
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
