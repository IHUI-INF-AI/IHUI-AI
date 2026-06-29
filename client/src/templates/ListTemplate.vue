<!-- 
  列表组件模板
  适用于：数据列表、商品列表、文章列表等
  
  特性：
  - 自动适配暗色模式
  - 支持加载状态
  - 支持空状态
  - 支持分页
  - 支持响应式布局
-->

<template>
  <div class="list-template">
    <!-- 列表头部 -->
    <div v-if="$slots.header || title" class="list-header">
      <slot name="header">
        <h3 class="list-title">{{ title }}</h3>
        <div v-if="$slots.actions" class="list-actions">
          <slot name="actions" />
        </div>
      </slot>
    </div>
    
    <!-- 筛选区域 -->
    <div v-if="$slots.filters" class="list-filters">
      <slot name="filters" />
    </div>
    
    <!-- 列表内容 -->
    <div class="list-body" :class="{ 'is-loading': loading }">
      <!-- 加载状态 -->
      <div v-if="loading" class="list-loading">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>{{ t('listTemplate.loading') }}</span>
      </div>
      
      <!-- 空状态 -->
      <div v-else-if="empty" class="list-empty">
        <slot name="empty">
          <el-empty :description="emptyText || '暂无数据'" />
        </slot>
      </div>
      
      <!-- 列表项 -->
      <div v-else class="list-items">
        <slot />
      </div>
    </div>
    
    <!-- 分页 -->
    <div v-if="showPagination && !empty" class="list-pagination">
      <slot name="pagination">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="pageSizes"
          layout="total, sizes, prev, pager, next"
          background
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref } from 'vue'
import { Loading } from '@element-plus/icons-vue'

const { t } = useI18n()

interface Props {
  title?: string
  loading?: boolean
  empty?: boolean
  emptyText?: string
  showPagination?: boolean
  total?: number
  pageSizes?: number[]
}

const _props = withDefaults(defineProps<Props>(), {
  loading: false,
  empty: false,
  showPagination: false,
  total: 0,
  pageSizes: () => [10, 20, 50, 100],
})

const emit = defineEmits<{
  'update:page': [page: number]
  'update:size': [size: number]
}>()

const currentPage = ref(1)
const pageSize = ref(10)

function handleSizeChange(size: number) {
  emit('update:size', size)
}

function handleCurrentChange(page: number) {
  emit('update:page', page)
}
</script>

<style lang="scss" scoped>
.list-template {
  --list-bg: var(--el-bg-color);
  --list-border: var(--el-border-color-lighter);
  --list-radius: var(--global-border-radius);
  --list-padding: 16px;
  
  background: var(--list-bg);
  border: var(--unified-border);
  border-radius: var(--list-radius);
  overflow: hidden;
}

// 列表头部
.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--list-padding);
  border-bottom: var(--unified-border-bottom);
}

.list-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.list-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

// 筛选区域
.list-filters {
  padding: var(--list-padding);
  border-bottom: var(--unified-border-bottom);
  background: var(--el-fill-color-lighter);
}

// 列表内容
.list-body {
  min-height: 200px;
  position: relative;
  
  &.is-loading {
    pointer-events: none;
  }
}

.list-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px;
  color: var(--el-text-color-secondary);
  
  .el-icon {
    font-size: 24px;
    color: var(--el-color-primary);
  }
}

.list-empty {
  padding: 48px;
}

.list-items {
  display: flex;
  flex-direction: column;
  
  :deep(> *) {
    border-bottom: var(--unified-border-bottom);
    
    &:last-child {
      border-bottom: none;
    }
  }
}

// 分页
.list-pagination {
  display: flex;
  justify-content: flex-end;
  padding: var(--list-padding);
  border-top: var(--unified-border);
  background: var(--el-fill-color-lighter);
}

// 暗色模式
:global(html.dark) {
  .list-filters,
  .list-pagination {
    background: var(--el-fill-color);
  }
}

// 响应式
@media (width <= 768px) {
  .list-template {
    --list-padding: 12px;
  }
  
  .list-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .list-pagination {
    justify-content: center;
    
    :deep(.el-pagination) {
      flex-wrap: wrap;
      justify-content: center;
    }
  }
}
</style>
