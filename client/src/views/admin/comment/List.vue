<template>
  <AdminTableV2
    :data="list"
    :columns="columns"
    :total="total"
    :page="page"
    :size="size"
    :loading="loading"
    :keyword="keyword"
    :search-placeholder="t('comment.searchPlaceholder.list')"
    @search="onSearch"
    @page-change="onPageChange"
    :show-add="false"
  />
</template>

<script setup lang="ts">
import { ref, onMounted, h } from 'vue'
import { ElButton, type Column } from 'element-plus'
import AdminTableV2 from '@/components/admin/AdminTableV2.vue'
import { adminApi } from '@/api/admin/admin'

const keyword = ref('')
const page = ref(1)
const size = ref(50)
const total = ref(0)
const loading = ref(false)
const list = ref<any[]>([])

const columns: Column<any>[] = [
  { key: 'id', dataKey: 'id', title: 'ID', width: 80 },
  { key: 'content', dataKey: 'content', title: '内容', width: 300 },
  { key: 'user', dataKey: 'user', title: '用户', width: 140 },
  { key: 'createdAt', dataKey: 'createdAt', title: '时间', width: 180 },
  {
    key: 'actions',
    title: '操作',
    width: 180,
    fixed: 'right' as any,
    cellRenderer: () => h('div', {}, [
      h(ElButton, { size: 'small', link: true, type: 'primary' }, '编辑'),
      h(ElButton, { size: 'small', link: true, type: 'danger' }, '删除'),
    ]),
  },
]

const reload = async () => {
  loading.value = true
  try {
    const res = await adminApi.commentList({ current: page.value, size: size.value, keyword: keyword.value })
    list.value = (res.data as any)?.records || []
    total.value = (res.data as any)?.total || 0
  } finally {
    loading.value = false
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
