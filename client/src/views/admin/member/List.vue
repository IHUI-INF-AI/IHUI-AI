<template>
  <AdminTableV2
    :data="list"
    :columns="columns"
    :total="total"
    :page="page"
    :size="size"
    :loading="loading"
    :keyword="keyword"
    :search-placeholder="t('member.searchPlaceholder.list')"
    @search="onSearch"
    @page-change="onPageChange"
    :show-add="false"
  />
</template>

<script setup lang="ts">
import { FIXED_RIGHT } from '@/utils/tableConstants'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ref, onMounted, h } from 'vue'
import { ElButton, ElTag, type Column } from 'element-plus'
import AdminTableV2 from '@/components/admin/AdminTableV2.vue'
import { adminApi } from '@/api/admin'

const keyword = ref('')
const page = ref(1)
const size = ref(50)
const total = ref(0)
const loading = ref(false)
const list = ref<unknown[]>([])

const columns: Column<unknown>[] = [
  { key: 'id', dataKey: 'id', title: 'ID', width: 80 },
  { key: 'username', dataKey: 'username', title: '用户名', width: 140 },
  { key: 'nickname', dataKey: 'nickname', title: '昵称', width: 140 },
  { key: 'mobile', dataKey: 'mobile', title: '手机号', width: 140 },
  { key: 'level', dataKey: 'level', title: '等级', width: 100 },
  { key: 'status', dataKey: 'status', title: '状态', width: 100, cellRenderer: ({ cellData }) => h(ElTag, { type: cellData === 1 ? 'success' : 'info' }, cellData === 1 ? '正常' : '禁用') },
  { key: 'createdAt', dataKey: 'createdAt', title: '注册时间', width: 180 },
  {
    key: 'actions',
    title: '操作',
    width: 180,
    fixed: FIXED_RIGHT,
    cellRenderer: () => h('div', {}, [
      h(ElButton, { size: 'small', link: true, type: 'primary' }, '编辑'),
      h(ElButton, { size: 'small', link: true, type: 'danger' }, '删除'),
    ]),
  },
]

const reload = async () => {
  loading.value = true
  try {
    const res = await adminApi.memberList({ current: page.value, size: size.value, keyword: keyword.value })
    list.value = (res.data as { records?: unknown[]; total?: number })?.records || []
    total.value = (res.data as { records?: unknown[]; total?: number })?.total || 0
  } catch (e) { console.error(e) } finally {
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
