<template>
  <div class="favorites-container page-container" role="main">
    <!-- 页面头部 -->
    <header class="favorites-header">
      <div class="header-content">
        <div class="page-title-group">
          <h1 class="page-title">{{ t('favorites.title') }}</h1>
          <p class="page-subtitle">{{ t('favorites.subtitle') }}</p>
        </div>
      </div>
    </header>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <el-select
        v-model="selectedResourceType"
        :placeholder="t('favorites.selectType')"
        clearable
        class="type-select"
        @change="handleFilterChange"
      >
        <el-option :label="t('favorites.all')" value="" />
        <el-option :label="t('favorites.agent')" value="agent" />
        <el-option :label="t('favorites.tool')" value="tool" />
        <el-option :label="t('favorites.knowledge')" value="knowledge" />
        <el-option :label="t('favorites.conversation')" value="conversation" />
      </el-select>
    </div>

    <!-- 收藏列表 -->
    <div class="favorites-content">
      <div v-if="loading" class="loading-container">
        <el-skeleton :rows="6" animated />
      </div>

      <el-empty
        v-else-if="favorites.length === 0 && !error"
        :description="t('favorites.noFavorites')"
      />

      <!-- 错误状态 -->
      <div v-else-if="error" class="error-container">
        <el-empty :description="error">
          <el-button type="primary" @click="loadFavorites">{{ t('favorites.retry') }}</el-button>
        </el-empty>
      </div>

      <!-- 收藏卡片列表 -->
      <div v-else class="favorites-grid">
        <el-card
          v-for="favorite in favorites"
          :key="favorite.id"
          class="favorite-card"
          shadow="hover"
        >
          <div class="card-content">
            <div class="card-header">
              <div class="card-info">
                <el-tag :type="getResourceTypeColor(favorite.resourceType)">
                  {{ getResourceTypeText(favorite.resourceType) }}
                </el-tag>
                <span class="resource-id">{{ favorite.resourceId }}</span>
              </div>
              <el-button link type="danger" size="small" @click="handleRemoveFavorite(favorite)">
                {{ t('favorites.removeFavorite') }}
              </el-button>
            </div>
            <div v-if="favorite.metadata" class="card-metadata">
              <pre>{{ JSON.stringify(favorite.metadata, null, 2) }}</pre>
            </div>
            <div class="card-meta">
              <span class="meta-item">
                <el-icon><Clock /></el-icon>
                {{ formatDate(favorite.createdAt) }}
              </span>
            </div>
          </div>
        </el-card>
      </div>

      <!-- 分页 -->
      <div v-if="pagination.total > 0" class="pagination-container">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[12, 24, 48]"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="handlePageChange"
          @size-change="handlePageSizeChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
 
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Clock } from '@element-plus/icons-vue'
import {
  getFavorites,
  removeFavorite,
  type Favorite,
  type FavoriteResourceType,
} from '@/api/favorites'
import type { PaginationParams } from '@/types'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { useApiError } from '@/composables/useApiError'
import { usePagination } from '@/composables/user/usePagination'

const { t } = useI18n()

// Composables
const { confirmDelete } = useConfirmDialog()
const { handleResult } = useOperationFeedback()
const { loading, error, execute } = useApiError()

// 响应式数据
const favorites = ref<Favorite[]>([])
const selectedResourceType = ref<FavoriteResourceType | ''>('')

// 使用 usePagination composable
const { pagination, handlePageChange, handlePageSizeChange, resetPagination } = usePagination({
  initialPage: 1,
  initialPageSize: 12,
  onPageChange: async () => {
    await loadFavorites()
  },
  onPageSizeChange: async () => {
    await loadFavorites()
  },
})

// 加载收藏列表
const loadFavorites = async () => {
  const result = await execute(async () => {
    const params: PaginationParams & { resourceType?: string } = {
      page: pagination.page,
      pageSize: pagination.pageSize,
    }

    if (selectedResourceType.value) {
      params.resourceType = selectedResourceType.value
    }

    return await getFavorites(params)
  })

  if (result && 'items' in result && 'total' in result) {
    favorites.value = result.items || []
    pagination.total = result.total || 0
  }
}

// 筛选变化
const handleFilterChange = () => {
  resetPagination()
  loadFavorites()
}

// 取消收藏
const handleRemoveFavorite = async (favorite: Favorite) => {
  const confirmed = await confirmDelete(t('favorites.removeFavoriteConfirm'))
  if (!confirmed) return

  await handleResult(removeFavorite(favorite.resourceType, favorite.resourceId), {
    successMessage: t('favorites.removeFavoriteSuccess'),
    errorMessage: t('favorites.removeFavoriteFailed'),
    onSuccess: () => {
      loadFavorites()
    },
  })
}

// 获取资源类型颜色
const getResourceTypeColor = (type: string): 'success' | 'warning' | 'danger' | 'info' => {
  const colorMap: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
    agent: 'success',
    tool: 'warning',
    knowledge: 'info',
    conversation: 'warning',
  }
  return colorMap[type] || 'info'
}

// 获取资源类型文本
const getResourceTypeText = (type: string): string => {
  const textMap: Record<string, string> = {
    agent: t('favorites.agent'),
    tool: t('favorites.tool'),
    knowledge: t('favorites.knowledge'),
    conversation: t('favorites.conversation'),
  }
  return textMap[type] || type
}

// 格式化日期
const formatDate = (date: string | Date) => {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// 初始化
onMounted(() => {
  loadFavorites()
})
</script>

<style scoped lang="scss">
.favorites-container {
  padding: 24px;
  width: 100%;
  margin: 0 auto;
}

.favorites-header {
  margin-bottom: 24px;

  .page-title {
    font-size: 28px;
    font-weight: 600;
    margin: 0 0 8px;
    color: var(--el-text-color-primary);
  }

  .page-subtitle {
    font-size: 14px;
    color: var(--el-text-color-regular);
    margin: 0;
  }
}

.filter-bar {
  margin-bottom: 24px;

  .type-select {
    width: 200px;
  }
}

.favorites-content {
  .loading-container,
  .error-container {
    padding: 40px 0;
  }

  .favorites-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 20px;
    margin-bottom: 24px;
  }

  .favorite-card {
    .card-content {
      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;

        .card-info {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;

          .resource-id {
            font-size: 14px;
            color: var(--el-text-color-regular);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        }
      }

      .card-metadata {
        margin-bottom: 12px;
        font-size: 12px;
        color: var(--el-text-color-regular);
        background: var(--el-fill-color-light);
        padding: 8px;
        border-radius: var(--global-border-radius);
        max-height: 100px;
        overflow-y: auto;

        pre {
          margin: 0;
          font-size: 12px;
        }
      }

      .card-meta {
        font-size: 12px;
        color: var(--el-text-color-regular);

        .meta-item {
          display: flex;
          align-items: center;
          gap: 4px;
        }
      }
    }
  }
}

.pagination-container {
  display: flex;
  justify-content: center;
  margin-top: 24px;
}
</style>
