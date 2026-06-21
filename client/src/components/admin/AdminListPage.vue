<template>
  <div class="admin-list-page">
    <div class="page-header">
      <div class="header-left">
        <h1>{{ title }}</h1>
        <p v-if="description">{{ description }}</p>
      </div>
      <div class="header-right">
        <el-button v-if="showAdd" type="primary" @click="$emit('add')">
          <el-icon><Plus /></el-icon>
          {{ addButtonText ?? t('adminComponents.listPage.add') }}
        </el-button>
        <el-button v-if="showRefresh" @click="handleRefresh">
          <el-icon><Refresh /></el-icon>
          {{ t('adminComponents.listPage.refresh') }}
        </el-button>
        <slot name="header-actions" />
      </div>
    </div>

    <div class="filter-section">
      <el-form :inline="true" :model="filterForm" class="filter-form">
        <el-form-item v-if="showSearch" :label="searchLabel ?? t('adminComponents.listPage.keyword')">
          <el-input
            v-model="filterForm.keyword"
            :placeholder="searchPlaceholder ?? t('adminComponents.listPage.keywordPlaceholder')"
            clearable
            @keyup.enter="handleSearch"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </el-form-item>
        <slot name="filters" :filter-form="filterForm" />
        <el-form-item>
          <el-button type="primary" @click="handleSearch">{{ t('adminComponents.listPage.search') }}</el-button>
          <el-button @click="handleReset">{{ t('adminComponents.listPage.reset') }}</el-button>
        </el-form-item>
      </el-form>
    </div>

    <el-card class="table-card">
      <el-table
        v-loading="loading"
        :data="tableData"
        :row-key="rowKey"
        stripe
        style="width: 100%"
        @selection-change="handleSelectionChange"
      >
        <el-table-column v-if="showSelection" type="selection" width="55" />
        <el-table-column v-if="showIndex" type="index" label="#" width="60" />
        <el-table-column
          v-for="col in columns"
          :key="col.prop"
          :prop="col.prop"
          :label="col.label"
          :width="col.width"
          :min-width="col.minWidth"
          :sortable="col.sortable"
          :show-overflow-tooltip="col.showOverflowTooltip !== false"
        >
          <template v-if="col.slot" #default="scope">
            <slot :name="`col-${col.prop}`" :row="scope.row" :$index="scope.$index" />
          </template>
          <template v-else-if="col.type === 'image'" #default="scope">
            <el-image
              :src="scope.row[col.prop]"
              :preview-src-list="[scope.row[col.prop]]"
              style="width: 50px; height: 50px"
              fit="cover"
            />
          </template>
          <template v-else-if="col.type === 'tag'" #default="scope">
            <el-tag :type="getTagType(scope.row[col.prop], col.tagMap)">
              {{ formatTag(scope.row[col.prop], col.tagMap) }}
            </el-tag>
          </template>
          <template v-else-if="col.type === 'date'" #default="scope">
            {{ formatDate(scope.row[col.prop], col.dateFormat) }}
          </template>
          <template v-else-if="col.type === 'money'" #default="scope">
            ¥{{ Number(scope.row[col.prop]).toFixed(2) }}
          </template>
        </el-table-column>
        <el-table-column v-if="showActions" :label="t('adminComponents.listPage.actions')" :width="actionsWidth" fixed="right">
          <template #default="scope">
            <slot name="actions" :row="scope.row" :$index="scope.$index">
              <el-button type="primary" link size="small" @click="$emit('view', scope.row)">{{ t('adminComponents.listPage.view') }}</el-button>
              <el-button type="primary" link size="small" @click="$emit('edit', scope.row)">{{ t('adminComponents.listPage.edit') }}</el-button>
              <el-popconfirm
                :title="t('adminComponents.listPage.deleteConfirm')"
                @confirm="$emit('delete', scope.row)"
              >
                <template #reference>
                  <el-button type="danger" link size="small">{{ t('adminComponents.listPage.delete') }}</el-button>
                </template>
              </el-popconfirm>
            </slot>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-section">
        <div class="pagination-info">
          {{ t('adminComponents.listPage.totalRecords', { total }) }}
          <template v-if="selectedRows.length > 0">
            {{ t('adminComponents.listPage.selectedCount', { count: selectedRows.length }) }}
          </template>
        </div>
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="pageSizes"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="$emit('size-change', pageSize)"
          @current-change="$emit('page-change', currentPage)"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, Refresh, Search } from '@element-plus/icons-vue'

const { t } = useI18n()

export interface TableColumn {
  prop: string
  label: string
  width?: number | string
  minWidth?: number | string
  sortable?: boolean | 'custom'
  showOverflowTooltip?: boolean
  type?: 'text' | 'image' | 'tag' | 'date' | 'money'
  slot?: boolean
  tagMap?: Record<string, { text: string; type: string }>
  dateFormat?: string
}

interface Props {
  title: string
  description?: string
  columns: TableColumn[]
  data: unknown[]
  total?: number
  loading?: boolean
  rowKey?: string
  showAdd?: boolean
  showRefresh?: boolean
  showSearch?: boolean
  showSelection?: boolean
  showIndex?: boolean
  showActions?: boolean
  actionsWidth?: number | string
  addButtonText?: string
  searchLabel?: string
  searchPlaceholder?: string
  pageSizes?: number[]
  defaultPageSize?: number
}

const props = withDefaults(defineProps<Props>(), {
  total: 0,
  loading: false,
  rowKey: 'id',
  showAdd: true,
  showRefresh: true,
  showSearch: true,
  showSelection: false,
  showIndex: false,
  showActions: true,
  actionsWidth: 200,
  pageSizes: () => [10, 20, 50, 100],
  defaultPageSize: 20,
})

const emit = defineEmits<{
  add: []
  refresh: []
  search: [keyword: string]
  reset: []
  view: [row: unknown]
  edit: [row: unknown]
  delete: [row: unknown]
  'page-change': [page: number]
  'size-change': [size: number]
  'selection-change': [rows: unknown[]]
}>()

const filterForm = ref({ keyword: '' })
const currentPage = ref(1)
const pageSize = ref(props.defaultPageSize)
const selectedRows = ref<unknown[]>([])

const tableData = computed(() => props.data)

const handleSearch = () => {
  emit('search', filterForm.value.keyword)
}

const handleReset = () => {
  filterForm.value.keyword = ''
  emit('reset')
}

const handleRefresh = () => {
  emit('refresh')
}

const handleSelectionChange = (rows: unknown[]) => {
  selectedRows.value = rows
  emit('selection-change', rows)
}

const getTagType = (value: unknown, tagMap?: Record<string, { text: string; type: string }>): string => {
  if (!tagMap) return 'info'
  const key = String(value)
  return tagMap[key]?.type || 'info'
}

const formatTag = (value: unknown, tagMap?: Record<string, { text: string; type: string }>): string => {
  if (!tagMap) return String(value)
  const key = String(value)
  return tagMap[key]?.text || String(value)
}

const formatDate = (value: unknown, format?: string): string => {
  if (!value) return '-'
  const date = new Date(value as string)
  if (isNaN(date.getTime())) return String(value)
  
  const fmt = format || 'YYYY-MM-DD HH:mm:ss'
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  
  return fmt
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds)
}

watch(() => props.defaultPageSize, (val) => {
  pageSize.value = val
})
</script>

<style scoped>
.admin-list-page {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.header-left h1 {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 600;
}

.header-left p {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.header-right {
  display: flex;
  gap: 10px;
}

.filter-section {
  margin-bottom: 20px;
}

.filter-form {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.table-card {
  margin-bottom: 20px;
}

.pagination-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 20px;
  padding-top: 20px;
  border-top: var(--unified-border);
}

.pagination-info {
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

@media (width <= 768px) {
  .page-header {
    flex-direction: column;
    gap: 16px;
  }

  .header-right {
    width: 100%;
    flex-wrap: wrap;
  }

  .pagination-section {
    flex-direction: column;
    gap: 16px;
  }
}
</style>
