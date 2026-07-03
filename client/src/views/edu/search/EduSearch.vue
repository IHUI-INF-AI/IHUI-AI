<template>
  <div class="edu-search">
    <!-- ① 页面头 -->
    <header class="page-header">
      <div class="header-text">
        <h1 class="page-title">{{ t('edu.search.title') }}</h1>
        <p class="page-subtitle">{{ t('edu.search.subtitle') }}</p>
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

    <!-- ② 大搜索框 -->
    <div class="search-box">
      <el-input
        v-model="query"
        :placeholder="t('edu.search.searchPlaceholder')"
        size="large"
        clearable
        class="search-input"
        @keyup.enter="handleSearch"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
      <el-button
        type="primary"
        size="large"
        :icon="Search"
        :loading="loading"
        @click="handleSearch"
      >
        {{ t('edu.search.searchButton') }}
      </el-button>
    </div>

    <!-- ③ 类型筛选 -->
    <div v-if="searched" class="filter-bar">
      <el-radio-group v-model="entityType" @change="handleFilterChange">
        <el-radio-button value="">{{ t('edu.search.filterAll') }}</el-radio-button>
        <el-radio-button value="course">{{ t('edu.search.filterCourse') }}</el-radio-button>
        <el-radio-button value="article">{{ t('edu.search.filterArticle') }}</el-radio-button>
        <el-radio-button value="question">{{ t('edu.search.filterQuestion') }}</el-radio-button>
      </el-radio-group>
    </div>

    <!-- ④ 结果数提示 -->
    <div v-if="searched && !error && query" class="result-meta">
      <span v-if="loading">{{ t('edu.profile.retry') }}...</span>
      <span v-else>{{ t('edu.search.resultCount', { n: total }) }}</span>
    </div>

    <!-- ⑤ 搜索结果列表 -->
    <div v-loading="loading" class="results-body">
      <div v-if="results.length" class="results-list">
        <el-card
          v-for="item in results"
          :key="itemKey(item)"
          class="result-card"
          shadow="hover"
        >
          <div class="result-header">
            <span class="result-title" :title="item.title">{{ item.title || '-' }}</span>
            <el-tag size="small" effect="plain" :type="entityTagType(item.entity_type)">
              {{ entityLabel(item.entity_type) }}
            </el-tag>
          </div>
          <p class="result-summary">{{ item.content || item.summary || '-' }}</p>
        </el-card>
      </div>

      <!-- 空状态 -->
      <el-empty
        v-else-if="!loading && searched && query"
        :description="t('edu.search.noResults')"
        class="empty-state"
      />
      <el-empty
        v-else-if="!loading && !searched"
        :description="t('edu.search.empty')"
        class="empty-state"
      />
    </div>

    <!-- ⑥ 分页 -->
    <div v-if="total > 0" class="pagination-wrap">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="size"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next, jumper"
        background
        @current-change="loadSearch"
        @size-change="handleSizeChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search } from '@element-plus/icons-vue'
import { searchApi } from '@/api/edu'

interface SearchResultItem {
  id?: number | string
  entity_type?: string
  entity_id?: number
  title?: string
  content?: string
  summary?: string
  tags?: string
  [key: string]: unknown
}

const { t } = useI18n()

const loading = ref(false)
const error = ref(false)
const query = ref('')
const entityType = ref('')
const results = ref<SearchResultItem[]>([])
const total = ref(0)
const page = ref(1)
const size = ref(10)
const searched = ref(false)

async function loadSearch() {
  const q = query.value.trim()
  if (!q) {
    searched.value = false
    results.value = []
    total.value = 0
    return
  }
  loading.value = true
  error.value = false
  try {
    const res = await searchApi.search({
      q,
      entity_type: entityType.value || undefined,
      page: page.value,
      size: size.value,
    })
    const data = res.data?.data
    if (data) {
      results.value = data.items as SearchResultItem[]
      total.value = data.total
    } else {
      results.value = []
      total.value = 0
    }
  } catch (e) {
    error.value = true
    results.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  if (!query.value.trim()) {
    searched.value = false
    results.value = []
    total.value = 0
    return
  }
  page.value = 1
  searched.value = true
  loadSearch()
}

function handleFilterChange() {
  page.value = 1
  loadSearch()
}

function handleSizeChange() {
  page.value = 1
  loadSearch()
}

function itemKey(item: SearchResultItem): string | number {
  return `${item.entity_type || ''}_${item.entity_id ?? item.id ?? Math.random()}`
}

function entityLabel(type?: string): string {
  switch (type) {
    case 'course':
      return t('edu.search.filterCourse')
    case 'article':
      return t('edu.search.filterArticle')
    case 'question':
      return t('edu.search.filterQuestion')
    default:
      return type || '-'
  }
}

function entityTagType(type?: string): 'primary' | 'success' | 'warning' | 'info' {
  switch (type) {
    case 'course':
      return 'primary'
    case 'article':
      return 'success'
    case 'question':
      return 'warning'
    default:
      return 'info'
  }
}

// 搜索页不在挂载时加载数据，等待用户输入关键词后触发 handleSearch
</script>

<style scoped lang="scss">
.edu-search {
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

.error-alert {
  margin: 0;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
}

.search-input {
  flex: 1;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
}

.result-meta {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  padding: 0 4px;
}

.results-body {
  min-height: 200px;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.result-card {
  border-radius: 8px;
  transition: border-color 0.2s ease;

  :deep(.el-card__body) {
    padding: 16px 20px;
  }
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.result-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.result-summary {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-regular);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
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
:deep(.el-radio-button__inner) {
  transition: border-color 0.2s ease, color 0.2s ease, background-color 0.2s ease;
  box-shadow: none !important;
  border-radius: 0;
}

:deep(.el-radio-button:first-child .el-radio-button__inner) {
  border-top-left-radius: 8px;
  border-bottom-left-radius: 8px;
}

:deep(.el-radio-button:last-child .el-radio-button__inner) {
  border-top-right-radius: 8px;
  border-bottom-right-radius: 8px;
}

:deep(.el-radio-button__original-radio:focus-visible + .el-radio-button__inner) {
  box-shadow: none !important;
}

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
  .search-box {
    flex-direction: column;
    align-items: stretch;
  }

  .page-header {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
