<template>
  <div class="sdks-hub page-container">
    <!-- 头部 -->
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">{{ t('openPlatform.sdks.title') }}</h1>
        <p class="page-subtitle">{{ t('openPlatform.sdks.subtitle') }}</p>
      </div>
      <div class="header-actions">
        <el-button type="primary" @click="goToDeveloperCenter">
          <el-icon><Setting /></el-icon>
          {{ t('openPlatform.sdks.manage') }}
        </el-button>
      </div>
    </div>

    <!-- 搜索和筛选 -->
    <div class="filters-section">
      <el-input
        v-model="searchKeyword"
        :placeholder="t('openPlatform.sdks.searchPlaceholder')"
        clearable
        class="search-input"
        @input="handleSearch"
      >
        <template #prefix>
          <SearchIcon />
        </template>
      </el-input>
      <el-select
        v-model="selectedLanguage"
        :placeholder="t('openPlatform.sdks.filterLanguage')"
        clearable
        class="language-select"
        @change="handleSearch"
      >
        <el-option
          v-for="(info, lang) in SDK_LANGUAGES"
          :key="lang"
          :label="info.name"
          :value="lang"
        >
          <div class="language-option">
            <span class="language-icon">{{ info.icon }}</span>
            <span>{{ info.name }}</span>
          </div>
        </el-option>
      </el-select>
    </div>

    <!-- SDK 列表 -->
    <div class="sdks-content">
      <el-empty
        v-if="!loading && sdks.length === 0"
        :description="t('openPlatform.sdks.noSdks')"
        :image-size="120"
      />
      <div v-else class="sdks-grid">
        <el-card
          v-for="sdk in sdks"
          :key="sdk.id"
          class="sdk-card"
          shadow="hover"
          @click="handleSdkClick(sdk)"
        >
          <div class="sdk-header">
            <div class="sdk-icon">
              <el-icon :size="32">
                <Code />
              </el-icon>
            </div>
            <div class="sdk-info">
              <h3 class="sdk-name">{{ sdk.name }}</h3>
              <p class="sdk-description">{{ sdk.description || t('openPlatform.sdks.noDescription') }}</p>
            </div>
          </div>
          <div class="sdk-meta">
            <el-tag size="small" type="info">{{ SDK_LANGUAGES[sdk.language]?.name || sdk.language }}</el-tag>
            <span class="sdk-version">{{ t('openPlatform.sdks.version') }}: {{ sdk.version }}</span>
          </div>
          <div class="sdk-actions">
            <el-button type="primary" size="small" @click.stop="handleDownload(sdk)">
              <el-icon><Download /></el-icon>
              {{ t('openPlatform.sdks.download') }}
            </el-button>
            <el-button size="small" @click.stop="handleViewDocs(sdk)">
              <el-icon><Document /></el-icon>
              {{ t('openPlatform.sdks.documentation') }}
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
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { Download, Document, Setting } from '@element-plus/icons-vue'
import SearchIcon from '@/components/common/SearchIcon.vue'
import { Code } from '../../constants/icons'
import { getSdks, SDK_LANGUAGES, type SdkConfig, type SdkLanguage } from '@/api/sdks'
import { logger } from '@/utils/logger'
import { usePagination } from '@/composables/user/usePagination'

const { t } = useI18n()
const router = useRouter()

// 状态
const sdks = ref<SdkConfig[]>([])
const loading = ref(false)
const searchKeyword = ref('')
const selectedLanguage = ref<SdkLanguage | ''>('')

// 分页
const { pagination, handlePageChange, handlePageSizeChange } = usePagination({
  initialPage: 1,
  initialPageSize: 12,
  onPageChange: async () => {
    await loadSdks()
  },
  onPageSizeChange: async () => {
    await loadSdks()
  },
})

// 加载 SDK 列表
const loadSdks = async () => {
  loading.value = true
  try {
    const response = await getSdks({
      page: pagination.page,
      pageSize: pagination.pageSize,
      keyword: searchKeyword.value || undefined,
      language: selectedLanguage.value || undefined,
    })

    if (response.success && response.data) {
      sdks.value = response.data.list || []
      pagination.total = response.data.pagination?.total || 0
    } else {
      ElMessage.error(response.message || t('openPlatform.sdks.loadFailed'))
    }
  } catch (error) {
    logger.error('[SDKsHub] Failed to load SDK list:', error)
    ElMessage.error(t('openPlatform.sdks.loadFailed'))
  } finally {
    loading.value = false
  }
}

// 搜索
const handleSearch = () => {
  pagination.page = 1
  loadSdks()
}

// SDK 操作
const handleSdkClick = (sdk: SdkConfig) => {
  // 可以跳转到 SDK 详情页
  logger.info('[SDKsHub] Click SDK:', sdk)
}

const handleDownload = (sdk: SdkConfig) => {
  if (sdk.downloadUrl) {
    window.open(sdk.downloadUrl, '_blank')
  } else {
    ElMessage.info(t('openPlatform.sdks.downloadComingSoon'))
  }
}

const handleViewDocs = (sdk: SdkConfig) => {
  // 跳转到 SDK 文档
  router.push(`/open/document/center?category=sdk&sdk=${sdk.language}`)
}

const goToDeveloperCenter = () => {
  router.push('/user?tab=developer')
}

onMounted(() => {
  loadSdks()
})
</script>

<style scoped lang="scss">
.sdks-hub {
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

  .language-select {
    width: 200px;
  }
}

.sdks-content {
  .sdks-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 20px;
    margin-bottom: 24px;
  }

  .sdk-card {
    cursor: pointer;
    transition: transform 0.3s ease;

    &:hover {
      
      }

    .sdk-header {
      display: flex;
      gap: 16px;
      margin-bottom: 16px;

      .sdk-icon {
        flex-shrink: 0;
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--el-color-primary-light-9);
        border-radius: var(--global-border-radius);
        color: var(--el-color-primary);
      }

      .sdk-info {
        flex: 1;
        min-width: 0;

        .sdk-name {
          margin: 0 0 8px;
          font-size: 18px;
          font-weight: 600;
          color: var(--el-text-color-primary);
        }

        .sdk-description {
          margin: 0;
          font-size: 14px;
          color: var(--el-text-color-regular);
          line-height: 1.5;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }
      }
    }

    .sdk-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 16px;
      border-bottom: var(--unified-border-bottom);

      .sdk-version {
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }
    }

    .sdk-actions {
      display: flex;
      gap: 8px;
    }
  }

  .pagination-container {
    display: flex;
    justify-content: center;
    margin-top: 32px;
  }
}

.language-option {
  display: flex;
  align-items: center;
  gap: 8px;

  .language-icon {
    font-size: 16px;
  }
}
</style>
