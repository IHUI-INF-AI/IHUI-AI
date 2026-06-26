<template>
  <div class="dict-data-page">
    <div class="data-header">
      <el-button :icon="ArrowLeft" @click="goBack">返回</el-button>
      <span class="data-header__label">当前字典类型：</span>
      <el-select
        v-model="currentDictType"
        placeholder="请选择字典类型"
        filterable
        clearable
        class="data-header__select"
        @change="onDictTypeChange"
      >
        <el-option
          v-for="item in dictTypeOptions"
          :key="item.dictType"
          :label="`${item.dictName} (${item.dictType})`"
          :value="item.dictType"
        />
      </el-select>
    </div>
    <AdminTableV2
      :data="list"
      :columns="columns"
      :total="total"
      :page="page"
      :size="size"
      :loading="loading"
      :keyword="keyword"
      search-placeholder="请输入字典标签"
      :selectable="true"
      @search="onSearch"
      @page-change="onPageChange"
      @add="handleAdd"
      @batch-delete="onBatchDelete"
    />
    <AdminEditDialog
      v-model:visible="dialogVisible"
      :mode="dialogMode"
      :fields="formFields"
      :form-data="formData"
      :submitting="submitting"
      @submit="onSubmit"
      @submit-continue="onSubmitContinue"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, h, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import { ElButton, ElTag, type Column } from 'element-plus'
import AdminTableV2 from '@/components/admin/AdminTableV2.vue'
import AdminEditDialog, { type FormField } from '@/components/admin/AdminEditDialog.vue'
import { dictApi, type DictTypeItem } from '@/api/admin/admin-dict'
import { useAdminTable } from '@/composables/useAdminTable'
import { useAdminCrud } from '@/composables/useAdminCrud'

const route = useRoute()
const router = useRouter()

const currentDictType = ref((route.query.dictType as string) || '')
const dictTypeOptions = ref<DictTypeItem[]>([])

const formFields: FormField[] = [
  { prop: 'dictType', label: '字典类型', required: true, minLength: 2, maxLength: 100 },
  { prop: 'dictLabel', label: '字典标签', required: true, minLength: 1, maxLength: 100 },
  { prop: 'dictValue', label: '字典键值', required: true, minLength: 1, maxLength: 100 },
  { prop: 'dictSort', label: '显示排序', type: 'number', min: 0, max: 9999, step: 1 },
  { prop: 'isDefault', label: '是否默认', type: 'select', options: [
    { label: '是', value: 'Y' },
    { label: '否', value: 'N' },
  ] },
  { prop: 'status', label: '状态', type: 'select', options: [
    { label: '正常', value: '0' },
    { label: '停用', value: '1' },
  ] },
]

const { keyword, page, size, total, loading, list, reload, onSearch, onPageChange } = useAdminTable({
  fetchFn: (params) => dictApi.dictDataList({ current: params.current, size: params.size, keyword: params.keyword, dictType: currentDictType.value }),
})

const { dialogVisible, dialogMode, formData, submitting, onAdd, onEdit, onDelete, onBatchDelete, onSubmit, onSubmitContinue } = useAdminCrud({
  fields: formFields,
  idField: 'dictCode',
  createFn: (data) => dictApi.dictDataCreate(data as any),
  updateFn: (id, data) => dictApi.dictDataUpdate({ ...(data as any), dictCode: id as number }),
  deleteFn: (id) => dictApi.dictDataDelete([id]),
  batchDeleteFn: (ids) => dictApi.dictDataDelete(ids),
  onSuccess: reload,
})

const handleAdd = () => {
  onAdd()
  if (currentDictType.value) formData.dictType = currentDictType.value
}

const onDictTypeChange = () => {
  page.value = 1
  void reload()
}

const goBack = () => router.push('/admin/dict')

const loadDictTypeOptions = async () => {
  try {
    const res = await dictApi.dictTypeOptionselect()
    dictTypeOptions.value = (res.data as DictTypeItem[]) || []
  } catch {
    dictTypeOptions.value = []
  }
}

// 路由 query 变化时同步
watch(() => route.query.dictType, (val) => {
  const t = (val as string) || ''
  if (t && t !== currentDictType.value) {
    currentDictType.value = t
    page.value = 1
    void reload()
  }
})

const columns: Column<any>[] = [
  { key: 'dictCode', dataKey: 'dictCode', title: 'ID', width: 80 },
  { key: 'dictSort', dataKey: 'dictSort', title: '排序', width: 80 },
  { key: 'dictLabel', dataKey: 'dictLabel', title: '字典标签', width: 180 },
  { key: 'dictValue', dataKey: 'dictValue', title: '字典键值', width: 180 },
  { key: 'dictType', dataKey: 'dictType', title: '字典类型', width: 180 },
  { key: 'isDefault', dataKey: 'isDefault', title: '默认', width: 80, cellRenderer: ({ cellData }: any) => {
    const isY = String(cellData) === 'Y'
    return h(ElTag, { type: isY ? 'success' : 'info', size: 'small' }, isY ? '是' : '否')
  } },
  { key: 'status', dataKey: 'status', title: '状态', width: 100, cellRenderer: ({ cellData }: any) => {
    const ok = String(cellData) === '0'
    return h(ElTag, { type: ok ? 'success' : 'info', size: 'small' }, ok ? '正常' : '停用')
  } },
  {
    key: 'actions',
    title: '操作',
    width: 180,
    fixed: 'right' as any,
    cellRenderer: ({ rowData: row }) => h('div', {}, [
      h(ElButton, { size: 'small', link: true, type: 'primary', onClick: () => onEdit(row) }, '编辑'),
      h(ElButton, { size: 'small', link: true, type: 'danger', onClick: () => onDelete(row) }, '删除'),
    ]),
  },
]

onMounted(async () => {
  await loadDictTypeOptions()
  void reload()
})
</script>

<style scoped>
.dict-data-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.data-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--el-border-color);
}
.data-header__label {
  color: var(--el-text-color-regular);
  font-size: 14px;
}
.data-header__select {
  width: 280px;
}
</style>
