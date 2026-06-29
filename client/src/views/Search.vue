<template>
  <div class="search-page page-container">
    <div class="search-header">
      <h1 class="page-title">{{ t('common.search') }}</h1>
      <div class="search-bar">
        <input
          v-model="keyword"
          type="text"
          class="search-input"
          :placeholder="t('search.searchPlaceholder.searchPage')"
          @keydown.enter="handleSearch"
        />
        <button class="search-btn" @click="handleSearch">{{ t('common.search') }}</button>
      </div>
    </div>

    <div v-if="!searched" class="hot-section">
      <h2 class="section-title">{{ t('searchPage.hotSearch') }}</h2>
      <div v-if="hotLoading" class="loading">{{ t('searchPage.loading') }}</div>
      <div v-else-if="hotKeywords.length" class="hot-tags">
        <button v-for="h in hotKeywords" :key="h.id" class="hot-tag" @click="quickSearch(h.keyword)">
          {{ h.keyword }}
        </button>
      </div>
      <div v-else class="empty-hot">{{ t('searchPage.emptyHot') }}</div>
    </div>

    <div v-else class="result-section">
      <div class="result-summary">{{ t('searchPage.resultSummary', { total }) }}</div>
      <div v-loading="searching" class="result-list">
        <div v-if="results.length === 0" class="empty-state">
          <div class="empty-icon">🔍</div>
          <p>{{ t('searchPage.noResult') }}</p>
        </div>
        <div v-for="r in results" :key="r.id" class="result-card" @click="openResult(r)">
          <span :class="['result-type', `type-${r.target_type}`]">{{ getTypeLabel(r.target_type) }}</span>
          <h3 class="result-title">{{ r.title }}</h3>
          <p class="result-content">{{ r.content }}</p>
          <div class="result-meta">
            <span v-if="r.user_name">{{ r.user_name }}</span>
            <span v-if="r.view_num">👁 {{ r.view_num }}</span>
            <span v-if="r.like_num">♥ {{ r.like_num }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { useRouter } from 'vue-router'
import { loadModule, getCurrentLocale } from '@/locales'
import http from '@/utils/request'

interface SearchResult {
  id?: number | string
  url?: string
  target_type?: string
  target_id?: string | number
  title?: string
  content?: string
  user_name?: string
  view_num?: number
  like_num?: number
}

const router = useRouter()
const keyword = ref('')
const hotKeywords = ref<Array<{ id: number; keyword: string }>>([])
const hotLoading = ref(false)
const searching = ref(false)
const searched = ref(false)
const results = ref<SearchResult[]>([])
const total = ref(0)

async function loadHotKeywords() {
  hotLoading.value = true
  try {
    const res = await http.get('/search/hot')
    hotKeywords.value = (res?.data || []).filter((h: Record<string, unknown>) => !!h.keyword)
  } catch {
    /* silent */
  } finally {
    hotLoading.value = false
  }
}

async function handleSearch() {
  if (!keyword.value.trim()) return
  searching.value = true
  searched.value = true
  try {
    const res = await http.get('/search/query', { params: { keyword: keyword.value, page: 1, limit: 30 } })
    results.value = res?.data?.data || res?.data || []
    total.value = res?.data?.total || results.value.length
  } catch {
    results.value = []
  } finally {
    searching.value = false
  }
}

function quickSearch(kw: string) {
  keyword.value = kw
  handleSearch()
}

function getTypeLabel(type: string) {
  return {
    agent: t('searchPage.typeAgent'),
    course: t('searchPage.typeCourse'),
    content: t('searchPage.typeContent'),
    ask: t('searchPage.typeAsk'),
    circle: t('searchPage.typeCircle'),
  }[type] || type
}

function openResult(r: SearchResult) {
  if (r.url) {
    router.push(r.url)
  } else if (r.target_type === 'agent') {
    router.push(`/agents/${r.target_id}`)
  } else if (r.target_type === 'course') {
    router.push(`/courses/${r.target_id}`)
  }
}

onMounted(() => {
  // 加载 search i18n 模块, 确保 t('searchPage.xxx') 能正确翻译
  loadModule(getCurrentLocale(), 'search').catch((e) => console.warn('[Search] i18n 模块加载失败', e))
  loadHotKeywords()
})
</script>

<style scoped>
.page-container {
  max-width: 960px;
  margin: 0 auto;
  padding: 24px 16px;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0 0 16px;
}

.search-bar {
  display: flex;
  gap: 8px;
}

.search-input {
  flex: 1;
  padding: 10px 16px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  font-size: 15px;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  outline: none;
}

.search-input:focus {
  border-color: var(--el-color-primary);
}

.search-btn {
  padding: 10px 24px;
  background: var(--el-color-primary);
  color: var(--el-bg-color);
  border: none;
  border-radius: var(--global-border-radius);
  font-size: 15px;
  cursor: pointer;
}

.section-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  margin: 24px 0 12px;
}

.loading {
  color: var(--el-text-color-secondary);
  font-size: 14px;
  padding: 20px;
  text-align: center;
}

.empty-hot {
  color: var(--el-text-color-secondary);
  font-size: 14px;
  padding: 20px;
  text-align: center;
}

.hot-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.hot-tag {
  padding: 6px 14px;
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  font-size: 14px;
  color: var(--el-text-color-primary);
  cursor: pointer;
  transition: all 0.15s;
}

.hot-tag:hover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}

.result-summary {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin-bottom: 12px;
}

.result-list {
  min-height: 200px;
}

.result-card {
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  padding: 16px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: border-color 0.15s;
}

.result-card:hover {
  border-color: var(--el-color-primary);
}

.result-type {
  font-size: 12px;
  padding: 1px 8px;
  border-radius: var(--global-border-radius);
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
  display: inline-block;
  margin-bottom: 6px;
}

.result-type.type-agent {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.result-type.type-course {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.result-type.type-content {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.result-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  margin: 0 0 6px;
}

.result-content {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin: 0 0 8px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.result-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--el-text-color-secondary);
}

.empty-icon {
  font-size: 40px;
  margin-bottom: 12px;
}
</style>
