<template>
  <div class="models-hub page-container">
    <!-- 头部 -->
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">{{ t('openPlatform.models.title') }}</h1>
        <p class="page-subtitle">{{ t('openPlatform.models.subtitle') }}</p>
      </div>
      <div class="header-actions">
        <el-button @click="goToModelManager">
          <el-icon><Setting /></el-icon>
          {{ t('openPlatform.models.manage') }}
        </el-button>
      </div>
    </div>

    <!-- 搜索和筛选 -->
    <div class="filters-section">
      <div class="unified-search-input-wrap">
        <el-input
          v-model="searchKeyword"
          :placeholder="t('openPlatform.models.searchPlaceholder')"
          clearable
          @input="handleSearch"
        >
          <template #prefix>
            <SearchIcon />
          </template>
        </el-input>
      </div>
      <el-select
        v-model="filterProvider"
        :placeholder="t('openPlatform.models.filterProvider')"
        clearable
        class="provider-select"
        @change="handleSearch"
      >
        <el-option
          v-for="provider in providerOptions"
          :key="provider"
          :label="provider"
          :value="provider"
        />
      </el-select>
      <el-select
        v-model="filterCategory"
        :placeholder="t('openPlatform.models.filterCategory')"
        clearable
        class="category-select"
        @change="handleSearch"
      >
        <el-option :label="t('hardcoded.models_hub.文本')" value="text" />
        <el-option :label="t('hardcoded.models_hub.图片1')" value="image" />
        <el-option :label="t('hardcoded.models_hub.视频2')" value="video" />
        <el-option :label="t('hardcoded.models_hub.音频3')" value="audio" />
      </el-select>
    </div>

    <!-- 模型列表 -->
    <div class="models-content">
      <el-empty
        v-if="!loading && models.length === 0"
        :description="t('openPlatform.models.noModels')"
        :image-size="120"
      />
      <div v-else class="models-grid">
        <el-card
          v-for="model in models"
          :key="model.id"
          class="model-card"
          shadow="hover"
          @click="handleModelClick(model)"
        >
          <div class="model-header">
            <div class="model-icon" v-if="model.icon">
              <img :src="model.icon" :alt="model.displayName" loading="lazy" />
            </div>
            <div v-else class="model-icon-placeholder">
              <el-icon :size="32"><Cpu /></el-icon>
            </div>
            <div class="model-info">
              <h3 class="model-name">{{ model.displayName || model.name }}</h3>
              <p class="model-provider">{{ model.provider }}</p>
            </div>
          </div>
          <div class="model-description">
            {{ model.description || t('openPlatform.models.noDescription') }}
          </div>
          <div class="model-capabilities">
            <el-tag
              v-for="cap in model.capabilities?.slice(0, 3)"
              :key="cap"
              size="small"
              type="info"
              class="cap-tag"
            >
              {{ cap }}
            </el-tag>
            <el-tag v-if="(model.capabilities?.length || 0) > 3" size="small" type="info">
              +{{ (model.capabilities?.length || 0) - 3 }}
            </el-tag>
          </div>
          <div class="model-footer">
            <el-tag :type="model.enabled ? 'success' : 'info'">
              {{ model.enabled ? t('common.enabled') : t('common.disabled') }}
            </el-tag>
            <el-button size="small" type="primary" @click.stop="handleViewApi(model)">
              <el-icon><Document /></el-icon>
              {{ t('openPlatform.models.viewApi') }}
            </el-button>
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
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { Setting, Cpu, Document } from '@element-plus/icons-vue'
import SearchIcon from '@/components/common/SearchIcon.vue'
import { getAvailableModels, type AIModelInfo } from '@/api/models/models'
import { logger } from '@/utils/logger'
import { usePagination } from '@/composables/user/usePagination'

const { t } = useI18n()
const router = useRouter()

// 状态
const models = ref<AIModelInfo[]>([])
const loading = ref(false)
const searchKeyword = ref('')
const filterProvider = ref<string>('')
const filterCategory = ref<string>('')

// 提供商选项
const providerOptions = computed(() => {
  const providers = new Set<string>()
  models.value.forEach(model => {
    if (model.provider) {
      providers.add(model.provider)
    }
  })
  return Array.from(providers).sort()
})

// 加载模型列表
const loadModels = async () => {
  loading.value = true
  try {
    const response = await getAvailableModels()

    if (response.success && response.data) {
      let filteredModels = response.data

      // 搜索过滤
      if (searchKeyword.value) {
        const keyword = searchKeyword.value.toLowerCase()
        filteredModels = filteredModels.filter(
          model =>
            model.name?.toLowerCase().includes(keyword) ||
            model.displayName?.toLowerCase().includes(keyword) ||
            model.description?.toLowerCase().includes(keyword)
        )
      }

      // 提供商过滤
      if (filterProvider.value) {
        filteredModels = filteredModels.filter(model => model.provider === filterProvider.value)
      }

      // 类别过滤
      if (filterCategory.value) {
        filteredModels = filteredModels.filter(model => {
          const category = model.category?.toLowerCase()
          return category === filterCategory.value
        })
      }

      // 只显示启用的模型
      filteredModels = filteredModels.filter(model => model.isAvailable !== false)

      // 分页
      const start = (pagination.page - 1) * pagination.pageSize
      const end = start + pagination.pageSize
      models.value = filteredModels.slice(start, end)
      pagination.total = filteredModels.length
    } else {
      ElMessage.error(response.message || t('openPlatform.models.loadFailed'))
    }
  } catch (error) {
    logger.error('[ModelsHub] Failed to load model list:', error)
    ElMessage.error(t('openPlatform.models.loadFailed'))
  } finally {
    loading.value = false
  }
}

// 搜索
const handleSearch = () => {
  pagination.page = 1
  loadModels()
}

// 分页
const { pagination, handlePageChange, handlePageSizeChange } = usePagination({
  initialPage: 1,
  initialPageSize: 12,
  onPageChange: async () => {
    await loadModels()
  },
  onPageSizeChange: async () => {
    await loadModels()
  },
})

// 模型操作
const handleModelClick = (model: AIModelInfo) => {
  router.push(`/open/documents?section=models&model=${model.name}`)
}

const handleViewApi = (model: AIModelInfo) => {
  router.push(`/open/documents?section=models&model=${model.name}`)
}

const goToModelManager = () => {
  router.push('/models-management')
}

onMounted(() => {
  loadModels()
})
</script>

<style scoped lang="scss">
.models-hub {
  padding: 24px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;

  .header-content {
    .page-title {
      margin: 0 0 8px;
      font-size: 28px;
      font-weight: 700;
      color: var(--el-text-color-primary);
    }

    .page-subtitle {
      margin: 0;
      font-size: 14px;
      color: var(--el-text-color-secondary);
    }
  }
}

.filters-section {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;

  .search-input {
    flex: 1;
    max-width: 400px;
  }

  .provider-select,
  .category-select {
    width: 150px;
  }
}

.models-content {
  .models-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 20px;
    margin-bottom: 24px;
  }

  .model-card {
    cursor: pointer;
    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-4px);
      }

    .model-header {
      display: flex;
      gap: 16px;
      margin-bottom: 16px;

      .model-icon,
      .model-icon-placeholder {
        flex-shrink: 0;
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--el-color-primary-light-9);
        border-radius: var(--global-border-radius);
        color: var(--el-color-primary);
        overflow: hidden;

        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
      }

      .model-info {
        flex: 1;
        min-width: 0;

        .model-name {
          margin: 0 0 4px;
          font-size: 18px;
          font-weight: 600;
          color: var(--el-text-color-primary);
        }

        .model-provider {
          margin: 0;
          font-size: 14px;
          color: var(--el-text-color-secondary);
        }
      }
    }

    .model-description {
      margin-bottom: 16px;
      font-size: 14px;
      color: var(--el-text-color-regular);
      line-height: 1.5;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .model-capabilities {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
      padding-bottom: 16px;
      border-bottom: var(--unified-border-bottom);
    }

    .model-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  }

  .pagination-container {
    display: flex;
    justify-content: center;
    margin-top: 32px;
  }
}
</style>
