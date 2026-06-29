<template>
  <div class="admin-list-page" v-loading="loading">
    <div class="toolbar">
      <el-input
        v-model="keywordModel"
        :placeholder="searchPlaceholder ?? t('adminTableV2.searchPlaceholder')"
        clearable
        class="search-input"
        @keyup.enter="onSearch"
        @clear="onSearch"
      />
      <slot name="toolbar" :reload="onSearch" />
      <el-button type="primary" :icon="Plus" @click="emit('add')" v-if="showAdd">{{ t('common.add') }}</el-button>
      <!-- P22.3: 批量操作 -->
      <template v-if="selectable && selectedIds.length > 0">
        <el-button type="warning" :icon="Edit" @click="onBatchEdit">
          {{ t('common.batchEdit') }} ({{ selectedIds.length }})
        </el-button>
        <el-button type="danger" :icon="Delete" @click="onBatchDelete">
          {{ t('common.batchDelete') }} ({{ selectedIds.length }})
        </el-button>
        <el-button :icon="Download" @click="onBatchExport">
          {{ t('common.export') }}
        </el-button>
      </template>
    </div>
    <el-auto-resizer>
      <template #default="{ height, width }">
        <el-table-v2
          :data="data"
          :columns="tableColumns"
          :width="width"
          :height="height"
          :row-key="rowKey"
          :estimated-row-height="rowHeight"
          :header-height="headerHeight"
          :fixed="true"
          @column-sort="onColumnSort"
        />
      </template>
    </el-auto-resizer>
    <el-pagination
      v-if="showPagination && total > 0"
      class="pager"
      :current-page="page"
      :page-size="size"
      :total="total"
      :page-sizes="[20, 50, 100, 200]"
      :layout="pagerLayout"
      :small="pagerSmall"
      :background="true"
      @size-change="(s: number) => $emit('page-change', page, s)"
      @current-change="(p: number) => $emit('page-change', p, size)"
    />
    <el-empty v-if="!loading && !data.length" :description="emptyText ?? t('adminTableV2.emptyText')" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, h } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, Delete, Download, Edit } from '@element-plus/icons-vue'
import { ElCheckbox, ElMessage, ElMessageBox, type Column } from 'element-plus'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    data: unknown[]
    columns: Column<unknown>[]
    total?: number
    page?: number
    size?: number
    loading?: boolean
    keyword?: string
    searchPlaceholder?: string
    emptyText?: string
    showAdd?: boolean
    showPagination?: boolean
    rowKey?: string | ((row: unknown) => string)
    rowHeight?: number
    headerHeight?: number
    pagerLayout?: string
    pagerSmall?: boolean
    /** P22.3: 是否开启多选 */
    selectable?: boolean
  }>(),
  {
    total: 0,
    page: 1,
    size: 50,
    loading: false,
    keyword: '',
    showAdd: true,
    showPagination: true,
    rowKey: 'id',
    rowHeight: 40,
    headerHeight: 44,
    pagerLayout: 'total, sizes, prev, pager, next, jumper',
    pagerSmall: false,
    selectable: false,
  }
)

const emit = defineEmits<{
  (e: 'search', keyword: string): void
  (e: 'page-change', page: number, size: number): void
  (e: 'add'): void
  (e: 'sort-change', payload: { key: string; order: 'asc' | 'desc' }): void
  /** P22.3: 批量删除 */
  (e: 'batch-delete', ids: (string | number)[]): void
  /** P24.1: 批量编辑 */
  (e: 'batch-edit', rows: unknown[]): void
  /** P22.3: 批量导出 */
  (e: 'batch-export', rows: unknown[]): void
}>()

const keywordModel = ref(props.keyword)
watch(() => props.keyword, (v) => (keywordModel.value = v))

const onSearch = () => emit('search', keywordModel.value)
const onColumnSort = ({ key, order }: { key: string; order: 'asc' | 'desc' }) => emit('sort-change', { key, order })

// P22.3: 多选状态
const selectedIds = ref<(string | number)[]>([])
const selectedRows = ref<unknown[]>([])
const allChecked = computed(() => props.data.length > 0 && selectedIds.value.length === props.data.length)

const getRowId = (row: unknown): string | number => {
  if (typeof props.rowKey === 'function') return props.rowKey(row)
  return (row as Record<string, unknown>)[props.rowKey as string] as string | number
}

const toggleRow = (row: unknown, checked: boolean) => {
  const id = getRowId(row)
  if (checked) {
    if (!selectedIds.value.includes(id)) {
      selectedIds.value.push(id)
      selectedRows.value.push(row)
    }
  } else {
    selectedIds.value = selectedIds.value.filter((i) => i !== id)
    selectedRows.value = selectedRows.value.filter((r) => getRowId(r) !== id)
  }
}

const toggleAll = (checked: boolean) => {
  if (checked) {
    selectedIds.value = props.data.map(getRowId)
    selectedRows.value = [...props.data]
  } else {
    selectedIds.value = []
    selectedRows.value = []
  }
}

// P22.3: 带多选列的 columns
const tableColumns = computed<Column<unknown>[]>(() => {
  if (!props.selectable) return props.columns
  const selectCol: Column<unknown> = {
    key: '__selection',
    width: 50,
    cellRenderer: ({ rowData: row }: { rowData: unknown }) =>
      h(ElCheckbox, {
        modelValue: selectedIds.value.includes(getRowId(row)),
        'onUpdate:modelValue': (val: boolean) => toggleRow(row, val),
      }),
    headerCellRenderer: () =>
      h(ElCheckbox, {
        modelValue: allChecked.value,
        'onUpdate:modelValue': (val: boolean) => toggleAll(val),
      }),
  }
  return [selectCol, ...props.columns]
})

// P22.3: 批量删除
const onBatchDelete = async () => {
  try {
    await ElMessageBox.confirm(
      `${t('common.confirmBatchDelete')} (${selectedIds.value.length})`,
      t('common.tip'),
      { type: 'warning' }
    )
    emit('batch-delete', [...selectedIds.value])
    selectedIds.value = []
    selectedRows.value = []
  } catch {
    // 用户取消
  }
}

// P24.1: 批量编辑
const onBatchEdit = () => {
  emit('batch-edit', [...selectedRows.value])
}

// P22.3: 批量导出 (CSV)
const onBatchExport = () => {
  const rows = selectedRows.value.length > 0 ? selectedRows.value : props.data
  emit('batch-export', rows)
  ElMessage.success(`${t('common.exportSuccess')} (${rows.length})`)
}

// 数据变化时清空选中
watch(() => props.data, () => {
  selectedIds.value = []
  selectedRows.value = []
})
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
