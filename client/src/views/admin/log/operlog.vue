<template>
  <AdminTableV2
    :data="list"
    :columns="columns"
    :total="total"
    :page="page"
    :size="size"
    :loading="loading"
    :keyword="keyword"
    search-placeholder="请输入系统模块(标题)"
    :show-add="false"
    :selectable="false"
    @search="onSearch"
    @page-change="onPageChange"
  >
    <template #toolbar>
      <el-input v-model="operNameFilter" placeholder="操作人" clearable class="filter-input" @keyup.enter="onFilter" @clear="onFilter" />
      <el-select v-model="bizTypeFilter" placeholder="业务类型" clearable class="filter-select" @change="onFilter">
        <el-option label="其它" :value="0" />
        <el-option label="新增" :value="1" />
        <el-option label="修改" :value="2" />
        <el-option label="删除" :value="3" />
        <el-option label="查询" :value="4" />
        <el-option label="导出" :value="5" />
      </el-select>
      <el-date-picker
        v-model="dateRange"
        type="daterange"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        value-format="x"
        class="filter-date"
        @change="onFilter"
      />
      <el-button type="danger" :icon="Delete" @click="onClean">清理日志</el-button>
    </template>
  </AdminTableV2>

  <el-dialog v-model="detailVisible" title="操作日志详情" width="720px" append-to-body>
    <el-descriptions v-if="currentDetail" :column="2" border>
      <el-descriptions-item label="日志 ID">{{ currentDetail.oper_id }}</el-descriptions-item>
      <el-descriptions-item label="系统模块">{{ currentDetail.title }}</el-descriptions-item>
      <el-descriptions-item label="业务类型">{{ bizTypeLabel(currentDetail.business_type) }}</el-descriptions-item>
      <el-descriptions-item label="请求方式">{{ currentDetail.request_method || '-' }}</el-descriptions-item>
      <el-descriptions-item label="操作人">{{ currentDetail.oper_name }}</el-descriptions-item>
      <el-descriptions-item label="操作 IP">{{ currentDetail.oper_ip || '-' }}</el-descriptions-item>
      <el-descriptions-item label="请求方法" :span="2">{{ currentDetail.method || '-' }}</el-descriptions-item>
      <el-descriptions-item label="操作 URL" :span="2">{{ currentDetail.oper_url || '-' }}</el-descriptions-item>
      <el-descriptions-item label="操作状态">{{ Number(currentDetail.status) === 0 ? '成功' : '失败' }}</el-descriptions-item>
      <el-descriptions-item label="操作时间">{{ formatTime(currentDetail.oper_time) }}</el-descriptions-item>
      <el-descriptions-item label="错误消息" :span="2">{{ currentDetail.error_msg || '-' }}</el-descriptions-item>
    </el-descriptions>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted, h } from 'vue'
import { Delete } from '@element-plus/icons-vue'
import { ElButton, ElTag, ElMessage, ElMessageBox, ElDialog, ElDescriptions, ElDescriptionsItem, type Column } from 'element-plus'
import AdminTableV2 from '@/components/admin/AdminTableV2.vue'
import { logApi, type OperLogItem } from '@/api/admin/admin-log'
import { useAdminTable } from '@/composables/useAdminTable'

const operNameFilter = ref('')
const bizTypeFilter = ref<number | ''>('')
const dateRange = ref<[string, string] | null>(null)

const detailVisible = ref(false)
const currentDetail = ref<OperLogItem | null>(null)

const BIZ_TYPE_MAP: Record<number, string> = { 0: '其它', 1: '新增', 2: '修改', 3: '删除', 4: '查询', 5: '导出' }

const bizTypeLabel = (v: number) => BIZ_TYPE_MAP[Number(v)] || String(v)

const formatTime = (t: string | null | undefined) => {
  if (!t) return '-'
  return String(t).replace('T', ' ').slice(0, 19)
}

// 时间范围客户端过滤(后端 list 暂不支持时间参数)
const applyTimeFilter = (rows: OperLogItem[]): OperLogItem[] => {
  if (!dateRange.value || dateRange.value.length !== 2) return rows
  const begin = Number(dateRange.value[0])
  const end = Number(dateRange.value[1]) + 86400000 - 1
  return rows.filter((r) => {
    const t = r.oper_time ? new Date(r.oper_time).getTime() : 0
    return t >= begin && t <= end
  })
}

const { keyword, page, size, total, loading, list, reload, onSearch, onPageChange } = useAdminTable({
  fetchFn: async (params) => {
    const res = await logApi.operlogList({
      ...params,
      operName: operNameFilter.value,
      businessType: bizTypeFilter.value === '' ? undefined : bizTypeFilter.value,
    })
    const records = applyTimeFilter((res.data as { records: OperLogItem[] }).records)
    return {
      ...res,
      data: { records, total: records.length },
    } as any
  },
})

const onFilter = () => {
  page.value = 1
  void reload()
}

const showDetail = (row: OperLogItem) => {
  currentDetail.value = row
  detailVisible.value = true
}

const onClean = async () => {
  try {
    const { value } = await ElMessageBox.prompt('确认清理操作日志？请输入保留天数', '清理日志', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputType: 'number',
      inputValue: '90',
      inputValidator: (v: string) => Number(v) >= 0 || '请输入非负整数',
    })
    await logApi.operlogClean(Number(value))
    ElMessage.success('清理成功')
    void reload()
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') ElMessage.error('清理失败')
  }
}

const columns: Column<any>[] = [
  { key: 'oper_id', dataKey: 'oper_id', title: 'ID', width: 80 },
  { key: 'title', dataKey: 'title', title: '系统模块', width: 160 },
  { key: 'business_type', dataKey: 'business_type', title: '业务类型', width: 100, cellRenderer: ({ cellData }: any) => h(ElTag, { type: 'info', size: 'small' }, bizTypeLabel(cellData)) },
  { key: 'request_method', dataKey: 'request_method', title: '请求方式', width: 90 },
  { key: 'oper_name', dataKey: 'oper_name', title: '操作人', width: 120 },
  { key: 'oper_ip', dataKey: 'oper_ip', title: '操作 IP', width: 140, cellRenderer: ({ cellData }: any) => cellData || '-' },
  { key: 'status', dataKey: 'status', title: '状态', width: 90, cellRenderer: ({ cellData }: any) => {
    const ok = Number(cellData) === 0
    return h(ElTag, { type: ok ? 'success' : 'danger', size: 'small' }, ok ? '成功' : '失败')
  } },
  { key: 'oper_time', dataKey: 'oper_time', title: '操作时间', width: 180, cellRenderer: ({ cellData }: any) => formatTime(cellData) },
  {
    key: 'actions',
    title: '操作',
    width: 100,
    fixed: 'right' as any,
    cellRenderer: ({ rowData: row }) => h(ElButton, { size: 'small', link: true, type: 'primary', onClick: () => showDetail(row) }, '详情'),
  },
]

onMounted(reload)
</script>

<style scoped>
.filter-input {
  width: 160px;
}

.filter-select {
  width: 130px;
}

.filter-date {
  width: 260px;
}
</style>
