<template>
  <AdminTableV2
    :data="list"
    :columns="columns"
    :total="total"
    :page="page"
    :size="size"
    :loading="loading"
    :keyword="keyword"
    search-placeholder="请输入需求标题"
    :show-add="false"
    :selectable="true"
    @search="onSearch"
    @page-change="onPageChange"
    @batch-delete="onBatchDelete"
  >
    <template #toolbar>
      <el-select v-model="statusFilter" placeholder="状态" clearable class="filter-select" @change="onFilter">
        <el-option label="待认领" :value="0" />
        <el-option label="已认领" :value="1" />
        <el-option label="开发中" :value="2" />
        <el-option label="已完成" :value="3" />
        <el-option label="已取消" :value="4" />
      </el-select>
      <el-select v-model="typeFilter" placeholder="类型" clearable class="filter-select" @change="onFilter">
        <el-option label="开发" value="develop" />
        <el-option label="优化" value="optimize" />
        <el-option label="修复" value="fix" />
        <el-option label="自定义" value="custom" />
      </el-select>
    </template>
  </AdminTableV2>
</template>

<script setup lang="ts">
import { ref, onMounted, h } from 'vue'
import { useRouter } from 'vue-router'
import { ElButton, ElTag, ElMessage, ElMessageBox, type Column } from 'element-plus'
import AdminTableV2 from '@/components/admin/AdminTableV2.vue'
import { demandApi } from '@/api/admin/admin-demand-square'
import { useAdminTable } from '@/composables/useAdminTable'
import { useAdminCrud } from '@/composables/useAdminCrud'

const router = useRouter()

const statusFilter = ref<number | ''>('')
const typeFilter = ref('')

const STATUS_MAP: Record<number, { label: string; type: 'info' | 'warning' | 'primary' | 'success' | 'danger' }> = {
  0: { label: '待认领', type: 'warning' },
  1: { label: '已认领', type: 'primary' },
  2: { label: '开发中', type: 'primary' },
  3: { label: '已完成', type: 'success' },
  4: { label: '已取消', type: 'info' },
}

const { keyword, page, size, total, loading, list, reload, onSearch, onPageChange } = useAdminTable({
  fetchFn: (params) => demandApi.demandList({
    ...params,
    status: statusFilter.value === '' ? undefined : statusFilter.value,
    type: typeFilter.value || undefined,
  }),
})

const { onBatchDelete } = useAdminCrud({
  fields: [],
  idField: 'id',
  deleteFn: (id) => demandApi.demandDelete(id as number),
  batchDeleteFn: async (ids) => {
    for (const id of ids) await demandApi.demandDelete(id as number)
  },
  onSuccess: reload,
})

const onFilter = () => {
  page.value = 1
  void reload()
}

const goReview = (row: any) => {
  router.push({ path: '/admin/demandSquare/review', query: { id: row.id } })
}

const review = async (row: any, pass: boolean) => {
  try {
    const { value: remark } = await ElMessageBox.prompt(
      `确认${pass ? '通过' : '拒绝'}该需求「${row.title}」？`,
      pass ? '审核通过' : '审核拒绝',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputType: 'textarea',
        inputPlaceholder: '请输入审核备注（可选）',
      },
    )
    await demandApi.demandReview({ tid: row.id, pass, remark: remark || undefined })
    ElMessage.success(pass ? '已通过' : '已拒绝')
    void reload()
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') ElMessage.error('操作失败')
  }
}

const columns: Column<any>[] = [
  { key: 'id', dataKey: 'id', title: 'ID', width: 80 },
  { key: 'title', dataKey: 'title', title: '需求标题', width: 240 },
  { key: 'user_name', dataKey: 'user_name', title: '提交人', width: 140, cellRenderer: ({ rowData: row }) => row.user_name || row.user_id || '-' },
  { key: 'type', dataKey: 'type', title: '类型', width: 100, cellRenderer: ({ cellData }: any) => cellData || '-' },
  { key: 'priority', dataKey: 'priority', title: '优先级', width: 90, cellRenderer: ({ cellData }: any) => {
    const map: Record<number, { label: string; type: 'info' | 'warning' | 'danger' }> = {
      1: { label: '低', type: 'info' },
      2: { label: '中', type: 'warning' },
      3: { label: '高', type: 'danger' },
    }
    const item = map[Number(cellData)] || { label: cellData ?? '-', type: 'info' as const }
    return h(ElTag, { type: item.type, size: 'small' }, item.label)
  } },
  { key: 'status', dataKey: 'status', title: '状态', width: 100, cellRenderer: ({ cellData }: any) => {
    const item = STATUS_MAP[Number(cellData)] || { label: String(cellData ?? '-'), type: 'info' as const }
    return h(ElTag, { type: item.type, size: 'small' }, item.label)
  } },
  { key: 'create_time', dataKey: 'create_time', title: '提交时间', width: 180, cellRenderer: ({ cellData }: any) => cellData ? String(cellData).replace('T', ' ').slice(0, 19) : '-' },
  {
    key: 'actions',
    title: '操作',
    width: 260,
    fixed: 'right' as any,
    cellRenderer: ({ rowData: row }) => h('div', {}, [
      h(ElButton, { size: 'small', link: true, type: 'primary', onClick: () => goReview(row) }, '详情'),
      h(ElButton, { size: 'small', link: true, type: 'success', onClick: () => review(row, true) }, '通过'),
      h(ElButton, { size: 'small', link: true, type: 'warning', onClick: () => review(row, false) }, '拒绝'),
    ]),
  },
]

onMounted(reload)
</script>

<style scoped>
.filter-select {
  width: 140px;
}
</style>
