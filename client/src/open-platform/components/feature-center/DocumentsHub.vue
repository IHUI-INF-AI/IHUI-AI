<template>
  <div class="documents-hub page-container">
    <!-- 头部 -->
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">{{ t('openPlatform.documents.title') }}</h1>
        <p class="page-subtitle">{{ t('openPlatform.documents.subtitle') }}</p>
      </div>
      <div class="header-actions">
        <el-button type="primary" @click="goToDocumentCenter">
          <el-icon><Document /></el-icon>
          {{ t('openPlatform.documents.viewAll') }}
        </el-button>
      </div>
    </div>

    <!-- 搜索 -->
    <div class="search-section">
      <el-input
        v-model="searchQuery"
        :placeholder="t('openPlatform.documents.searchPlaceholder')"
        size="large"
        clearable
        @input="handleSearch"
      >
        <template #prefix>
          <SearchIcon />
        </template>
      </el-input>
    </div>

    <!-- 文档分类 -->
    <div class="documents-section">
      <!-- 快速开始 -->
      <div class="document-category card-neutral">
        <h2 class="category-title">
          <el-icon><Promotion /></el-icon>
          {{ t('documentCenter.quickStart') }}
        </h2>
        <div class="documents-list">
          <div
            v-for="doc in quickStartDocs"
            :key="doc.id"
            class="document-item"
            @click="handleDocClick(doc)"
          >
            <el-icon class="doc-icon"><Document /></el-icon>
            <div class="doc-info">
              <h3>{{ doc.title }}</h3>
              <p>{{ doc.description }}</p>
            </div>
            <el-icon class="arrow-icon"><ArrowRight /></el-icon>
          </div>
        </div>
      </div>

      <!-- 用户文档 -->
      <div class="document-category card-neutral">
        <h2 class="category-title">
          <el-icon><User /></el-icon>
          {{ t('documentCenter.userDocs') }}
        </h2>
        <div class="documents-list">
          <div
            v-for="doc in userDocs"
            :key="doc.id"
            class="document-item"
            @click="handleDocClick(doc)"
          >
            <el-icon class="doc-icon"><Document /></el-icon>
            <div class="doc-info">
              <h3>{{ doc.title }}</h3>
              <p>{{ doc.description }}</p>
            </div>
            <el-icon class="arrow-icon"><ArrowRight /></el-icon>
          </div>
        </div>
      </div>

      <!-- 开发者文档 -->
      <div class="document-category card-neutral">
        <h2 class="category-title">
          <el-icon><Document /></el-icon>
          {{ t('documentCenter.developerDocs') }}
        </h2>
        <div class="documents-list">
          <div
            v-for="doc in developerDocs"
            :key="doc.id"
            class="document-item"
            @click="handleDocClick(doc)"
          >
            <el-icon class="doc-icon"><Document /></el-icon>
            <div class="doc-info">
              <h3>{{ doc.title }}</h3>
              <p>{{ doc.description }}</p>
            </div>
            <el-icon class="arrow-icon"><ArrowRight /></el-icon>
          </div>
        </div>
      </div>

      <!-- API 文档 -->
      <div class="document-category card-neutral">
        <h2 class="category-title">
          <el-icon><Document /></el-icon>
          {{ t('documentCenter.apiDocs') }}
        </h2>
        <div class="documents-list">
          <div
            v-for="doc in apiDocs"
            :key="doc.id"
            class="document-item"
            @click="handleDocClick(doc)"
          >
            <el-icon class="doc-icon"><Document /></el-icon>
            <div class="doc-info">
              <h3>{{ doc.title }}</h3>
              <p>{{ doc.description }}</p>
            </div>
            <el-icon class="arrow-icon"><ArrowRight /></el-icon>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Document, Promotion, User, ArrowRight } from '@element-plus/icons-vue'
import SearchIcon from '@/components/common/SearchIcon.vue'
import { docTreeData } from '@/data/documentation'

const { t } = useI18n()
const router = useRouter()

const searchQuery = ref('')

// 文档数据
const quickStartDocs = computed(() => {
  const docs = docTreeData.user.find(cat => cat.id === 'getting-started')?.children || []
  return docs.map(doc => ({
    id: doc.id,
    title: doc.label,
    description: '',
    path: doc.path,
  }))
})

const userDocs = computed(() => {
  return docTreeData.user
    .filter(cat => cat.id !== 'getting-started')
    .flatMap(cat => (cat.children || []).map(doc => ({
      id: doc.id,
      title: doc.label,
      description: '',
      path: doc.path,
    })))
    .slice(0, 6)
})

const developerDocs = computed(() => {
  return docTreeData.developer
    .flatMap(cat => (cat.children || []).map(doc => ({
      id: doc.id,
      title: doc.label,
      description: '',
      path: doc.path,
    })))
    .slice(0, 6)
})

const apiDocs = computed(() => {
  const apiCategory = docTreeData.developer.find(cat => cat.id === 'dev-api')
  return (apiCategory?.children || []).map(doc => ({
    id: doc.id,
    title: doc.label,
    description: '',
    path: doc.path,
  }))
})

// 搜索
const handleSearch = () => {
  // 可以在这里实现搜索逻辑
}

// 文档点击：跳转到全站文档统一查看页 /docs
const handleDocClick = (doc: { id: string }) => {
  router.push({ path: '/docs', query: { doc: doc.id } })
}

const goToDocumentCenter = () => {
  router.push('/docs')
}
</script>

<style scoped lang="scss">
.documents-hub {
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

.search-section {
  margin-bottom: 32px;

  .el-input {
    max-width: 600px;
  }
}

.documents-section {
  .document-category {
    margin-bottom: 32px;

    .category-title {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 20px;
      font-size: 20px;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }

    .documents-list {
      .document-item {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px;
        border-radius: var(--global-border-radius);
        cursor: pointer;
        transition: background-color 0.3s ease;

        &:hover {
          background: var(--el-bg-color-page);
        }

        .doc-icon {
          flex-shrink: 0;
          font-size: 24px;
          color: var(--el-color-primary);
        }

        .doc-info {
          flex: 1;
          min-width: 0;

          h3 {
            margin: 0 0 4px;
            font-size: 16px;
            font-weight: 600;
            color: var(--el-text-color-primary);
          }

          p {
            margin: 0;
            font-size: 14px;
            color: var(--el-text-color-secondary);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        }

        .arrow-icon {
          flex-shrink: 0;
          color: var(--el-text-color-secondary);
        }
      }
    }
  }
}
</style>
