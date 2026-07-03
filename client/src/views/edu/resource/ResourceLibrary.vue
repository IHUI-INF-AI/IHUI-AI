<template>
  <div class="resource-library">
    <!-- ① 页面头 -->
    <header class="page-header">
      <div class="header-text">
        <h1 class="page-title">{{ t('edu.resource.title') }}</h1>
        <p class="page-subtitle">{{ t('edu.resource.subtitle') }}</p>
      </div>
      <div class="header-actions">
        <el-button :icon="Refresh" :loading="loading" @click="loadResources">
          {{ t('edu.profile.retry') }}
        </el-button>
      </div>
    </header>

    <el-alert
      v-if="error"
      type="error"
      :title="t('edu.profile.loadFailed')"
      show-icon
      :closable="false"
      class="error-alert"
    />

    <!-- ② 搜索框 -->
    <div class="search-bar">
      <el-input
        v-model="keyword"
        :placeholder="t('edu.resource.searchPlaceholder')"
        clearable
        class="search-input"
        @keyup.enter="handleSearch"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
      <el-button type="primary" :icon="Search" :loading="loading" @click="handleSearch">
        {{ t('edu.search.searchButton') }}
      </el-button>
    </div>

    <!-- ③ 资源卡片列表 -->
    <div v-loading="loading" class="resources-body">
      <div v-if="resources.length" class="resources-grid">
        <el-card
          v-for="item in resources"
          :key="item.id"
          class="resource-card"
          shadow="hover"
        >
          <div class="card-header">
            <el-icon class="card-icon"><Document /></el-icon>
            <span class="card-name" :title="item.title">{{ item.title || '-' }}</span>
          </div>

          <div class="card-meta">
            <div class="meta-line">
              <span class="meta-label">{{ t('edu.resource.resourceType') }}:</span>
              <el-tag size="small" effect="plain" type="success">文章</el-tag>
            </div>
            <div class="meta-line">
              <span class="meta-label">{{ t('edu.resource.fileSize') }}:</span>
              <span class="meta-value">-</span>
            </div>
            <div class="meta-line">
              <span class="meta-label">{{ t('edu.resource.uploadTime') }}:</span>
              <span class="meta-value">{{ formatTime(item.created_at) }}</span>
            </div>
            <div class="meta-line">
              <span class="meta-label">{{ t('edu.resource.uploadBy') }}:</span>
              <span class="meta-value">#{{ item.author_id ?? '-' }}</span>
            </div>
          </div>

          <div class="card-actions">
            <el-button
              type="primary"
              size="small"
              :icon="Download"
              @click="handleDownload(item)"
            >
              {{ t('edu.resource.download') }}
            </el-button>
          </div>
        </el-card>
      </div>

      <!-- 空状态 -->
      <el-empty
        v-else-if="!loading"
        :description="t('edu.resource.noResources')"
        class="empty-state"
      />
    </div>

    <!-- ④ 分页 -->
    <div v-if="total > 0" class="pagination-wrap">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="size"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next, jumper"
        background
        @current-change="loadResources"
        @size-change="handleSizeChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { Refresh, Search, Download, Document } from '@element-plus/icons-vue'
import { contentApi } from '@/api/edu'

interface ResourceItem {
  id?: number
  title?: string
  content?: string
  summary?: string
  cover?: string
  author_id?: number
  category_id?: number
  tags?: string
  created_at?: string
  [key: string]: unknown
}

const { t } = useI18n()

const loading = ref(false)
const error = ref(false)
const resources = ref<ResourceItem[]>([])
const total = ref(0)
const page = ref(1)
const size = ref(10)
const keyword = ref('')

async function loadResources() {
  loading.value = true
  error.value = false
  try {
    const res = await contentApi.listArticles({
      page: page.value,
      size: size.value,
      keyword: keyword.value || undefined,
      order_by: 'latest',
    })
    const data = res.data?.data
    if (data) {
      resources.value = data.items as ResourceItem[]
      total.value = data.total
    } else {
      resources.value = []
      total.value = 0
    }
  } catch (e) {
    error.value = true
    resources.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  page.value = 1
  loadResources()
}

function handleSizeChange() {
  page.value = 1
  loadResources()
}

function handleDownload(item: ResourceItem) {
  // resource API 未封装，文章作为资源占位：有封面则打开，否则提示下载失败
  if (item.cover) {
    window.open(item.cover, '_blank')
  } else {
    ElMessage.warning(t('edu.resource.downloadFailed'))
  }
}

function formatTime(value?: string): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

onMounted(loadResources)
</script>

<style scoped lang="scss">
.resource-library {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.header-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.page-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.page-subtitle {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.header-actions {
  display: flex;
  gap: 8px;
}

.error-alert {
  margin: 0;
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
}

.search-input {
  flex: 1;
  max-width: 480px;
}

.resources-body {
  min-height: 200px;
}

.resources-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.resource-card {
  border-radius: 8px;
  transition: border-color 0.2s ease;

  :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
  }
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-icon {
  color: var(--el-color-primary);
  flex-shrink: 0;
}

.card-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.card-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
}

.meta-line {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--el-text-color-regular);
}

.meta-label {
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}

.meta-value {
  color: var(--el-text-color-primary);
  font-variant-numeric: tabular-nums;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
}

.empty-state {
  padding: 40px 0;
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  padding: 8px 0;
}

/* 禁止蓝光边框：focus 时仅 border-color 过渡 */
:deep(.el-button:focus-visible) {
  outline: none;
  box-shadow: none;
}

:deep(.el-input__wrapper) {
  border-radius: 8px;
  transition: border-color 0.2s ease;
}

:deep(.el-input__wrapper:focus-within) {
  box-shadow: none !important;
}

@media (max-width: 640px) {
  .resources-grid {
    grid-template-columns: 1fr;
  }

  .page-header {
    flex-direction: column;
    align-items: stretch;
  }

  .search-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .search-input {
    max-width: none;
  }
}
</style>
