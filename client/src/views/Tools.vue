<template>
  <div class="tools-page">
    <div class="tools-layout">
      <!-- 左侧分类侧边栏 -->
      <aside class="tools-sidebar">
        <div class="sidebar-header">
          <h2 class="sidebar-title">{{ t('tools.title') }}</h2>
          <input v-model="searchKeyword" class="sidebar-search" :placeholder="t('toolsPage.searchPlaceholder')" @input="debouncedLoad" />
        </div>
        <div class="sidebar-categories">
          <div
            v-for="cat in categories"
            :key="cat.key"
            class="category-item"
            :class="{ active: activeCategory === cat.key }"
            @click="handleCategoryClick(cat.key)"
          >
            <span class="category-icon">{{ cat.icon }}</span>
            <span class="category-name">{{ cat.name }}</span>
            <span class="category-count">{{ cat.count }}</span>
          </div>
        </div>
      </aside>

      <!-- 右侧工具卡片网格 -->
      <main class="tools-main">
        <div class="tools-toolbar">
          <span class="toolbar-info">
            {{ t('toolsPage.totalCount', { count: tools.length }) }}
            <span v-if="activeCategory !== 'all'"> · {{ activeCategoryName }}</span>
            <span v-if="dataSource === 'api'" class="source-tag">· {{ t('tools.realtimeData') }}</span>
            <span v-else class="source-tag source-fallback">· {{ t('tools.localData') }}</span>
          </span>
          <select v-model="sortBy" class="toolbar-sort" @change="loadTools">
            <option value="default">{{ t('tools.sortDefault') }}</option>
            <option value="name">{{ t('tools.sortByName') }}</option>
            <option value="hot">{{ t('tools.sortByHot') }}</option>
          </select>
        </div>

        <div v-if="loading" class="tools-loading">
          <p>{{ t('tools.loading') }}...</p>
        </div>

        <div v-else-if="tools.length === 0" class="tools-empty">
          <p>{{ t('tools.noMatch') }}</p>
        </div>

        <div v-else class="tools-grid">
          <div
            v-for="tool in tools"
            :key="tool.id"
            class="tool-card"
            @click="handleUseTool(tool)"
          >
            <div class="tool-card-header">
              <span class="tool-icon">{{ tool.icon }}</span>
              <span v-if="tool.hot" class="tool-badge-hot">HOT</span>
            </div>
            <h3 class="tool-name">{{ tool.name }}</h3>
            <p class="tool-desc">{{ tool.description }}</p>
            <div class="tool-card-footer">
              <span class="tool-tag">{{ categoryName(tool.category) }}</span>
              <span class="tool-usage">{{ tool.usage }} {{ t('tools.usage') }}</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getToolsList, getToolCategoriesList } from '@/api/tools/tools'
import { logger } from '@/utils/logger'
import { useSEO } from '@/composables/useSEO'

const { t } = useI18n()

useSEO({
  title: t('toolsPage.seoTitle'),
  description: t('toolsPage.seoDescription'),
  keywords: t('toolsPage.seoKeywords'),
  ogTitle: t('toolsPage.seoTitle'),
  ogDescription: t('toolsPage.seoDescription'),
  canonical: 'https://www.zhihui-ai.com/tools'
})

interface Tool {
  id: string
  name: string
  description: string
  category: string
  icon: string
  hot?: boolean
  usage: number
  url?: string
}

interface Category {
  key: string
  name: string
  icon: string
  count: number
}

const router = useRouter()
const searchKeyword = ref('')
const activeCategory = ref('all')
const sortBy = ref<'default' | 'name' | 'hot'>('default')
const tools = ref<Tool[]>([])
const categories = ref<Category[]>([
  { key: 'all', name: t('toolsPage.categoryAll'), icon: '✦', count: 0 },
])
const loading = ref(false)
const dataSource = ref<'api' | 'fallback'>('api')

// 本地兜底数据 (后端不可用时使用)
const FALLBACK_TOOLS: Tool[] = [
  { id: 't1', name: t('toolsPage.fallbackToolChatName'), description: t('toolsPage.fallbackToolChatDesc'), category: 'chat', icon: '💬', hot: true, usage: 12500 },
  { id: 'i1', name: 'Stable Diffusion', description: t('toolsPage.fallbackToolImageDesc'), category: 'image', icon: '🎨', hot: true, usage: 15300 },
  { id: 'v1', name: t('toolsPage.fallbackToolVideoName'), description: t('toolsPage.fallbackToolVideoDesc'), category: 'video', icon: '🎬', hot: true, usage: 11200 },
  { id: 'a3', name: t('toolsPage.fallbackToolAudioName'), description: t('toolsPage.fallbackToolAudioDesc'), category: 'audio', icon: '🎙', hot: true, usage: 7200 },
  { id: 'c1', name: t('toolsPage.fallbackToolCodeName'), description: t('toolsPage.fallbackToolCodeDesc'), category: 'code', icon: '⌨', hot: true, usage: 13700 },
  { id: 'x2', name: t('toolsPage.fallbackToolTextName'), description: t('toolsPage.fallbackToolTextDesc'), category: 'text', icon: '📱', hot: true, usage: 10100 },
  { id: 'g1', name: t('toolsPage.fallbackToolAgentName'), description: t('toolsPage.fallbackToolAgentDesc'), category: 'agent', icon: '🤖', hot: true, usage: 9200 },
  { id: 's1', name: t('toolsPage.fallbackToolStockName'), description: t('toolsPage.fallbackToolStockDesc'), category: 'stock', icon: '📈', hot: true, usage: 8400 },
]

const FALLBACK_CATEGORIES: Category[] = [
  { key: 'all', name: t('toolsPage.fallbackCategoryAll'), icon: '✦', count: 8 },
  { key: 'chat', name: t('toolsPage.fallbackCategoryChat'), icon: '💬', count: 1 },
  { key: 'image', name: t('toolsPage.fallbackCategoryImage'), icon: '🎨', count: 1 },
  { key: 'video', name: t('toolsPage.fallbackCategoryVideo'), icon: '🎬', count: 1 },
  { key: 'audio', name: t('toolsPage.fallbackCategoryAudio'), icon: '🔊', count: 1 },
  { key: 'code', name: t('toolsPage.fallbackCategoryCode'), icon: '⌨', count: 1 },
  { key: 'text', name: t('toolsPage.fallbackCategoryText'), icon: '📝', count: 1 },
  { key: 'agent', name: t('toolsPage.fallbackCategoryAgent'), icon: '🤖', count: 1 },
  { key: 'stock', name: t('toolsPage.fallbackCategoryStock'), icon: '📈', count: 1 },
]

const activeCategoryName = computed(() => {
  return categories.value.find((c) => c.key === activeCategory.value)?.name || ''
})

function categoryName(key: string) {
  return categories.value.find((c) => c.key === key)?.name || key
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null
function debouncedLoad() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    loadTools()
  }, 300)
}

function handleCategoryClick(key: string) {
  activeCategory.value = key
  loadTools()
}

async function loadCategories() {
  try {
    const res = await getToolCategoriesList()
    if (res.success && res.data && Array.isArray(res.data) && res.data.length > 0) {
      const cats: Category[] = (res.data as any[]).map((c) => ({
        key: c.key || c.id,
        name: c.name,
        icon: c.icon || '◆',
        count: c.count || 0,
      }))
      // 确保 "all" 在最前
      if (!cats.find((c) => c.key === 'all')) {
        cats.unshift({ key: 'all', name: t('toolsPage.categoryAll'), icon: '✦', count: cats.reduce((s, c) => s + c.count, 0) })
      }
      categories.value = cats
    } else {
      throw new Error('empty data')
    }
  } catch (err) {
    logger.warn('[Tools] Category API unavailable, using local data:', err)
    categories.value = FALLBACK_CATEGORIES
  }
}

async function loadTools() {
  loading.value = true
  try {
    const res = await getToolsList({
      page: 1,
      pageSize: 100,
      category: activeCategory.value === 'all' ? undefined : activeCategory.value,
      keyword: searchKeyword.value || undefined,
      sortBy: sortBy.value,
    } as any)
    if (res.success && res.data) {
      // 后端返回格式: { items: [...], total }
      const payload: any = res.data
      let list: any[] = []
      if (Array.isArray(payload)) {
        list = payload
      } else if (payload.items) {
        list = payload.items
      } else if (payload.list) {
        list = payload.list
      } else if (payload.data) {
        list = Array.isArray(payload.data) ? payload.data : (payload.data.items || payload.data.list || [])
      }
      if (list.length > 0) {
        tools.value = list.map((tool) => ({
          id: tool.id,
          name: tool.name,
          description: tool.description,
          category: tool.category,
          icon: tool.icon || '◆',
          hot: tool.hot || false,
          usage: tool.usage || tool.usageCount || 0,
          url: tool.url,
        }))
        dataSource.value = 'api'
        return
      }
    }
    throw new Error('empty data')
  } catch (err) {
    logger.warn('[Tools] Tool list API unavailable, using local data:', err)
    tools.value = FALLBACK_TOOLS.filter((tool) => {
      if (activeCategory.value !== 'all' && tool.category !== activeCategory.value) return false
      if (searchKeyword.value) {
        const kw = searchKeyword.value.toLowerCase()
        return tool.name.toLowerCase().includes(kw) || tool.description.toLowerCase().includes(kw)
      }
      return true
    })
    dataSource.value = 'fallback'
  } finally {
    loading.value = false
  }
}

function handleUseTool(tool: Tool) {
  logger.info('[Tools] Using tool:', tool.name)
  if (tool.url) {
    router.push(tool.url)
  } else {
    ElMessage.info(t('toolsPage.startTool', { name: tool.name }))
  }
}

watch(activeCategory, () => {
  loadTools()
})

onMounted(async () => {
  try { await loadCategories(); await loadTools() } catch (e) { console.error(e) }
})
</script>

<style scoped>
.tools-page {
  min-height: 100vh;
  background: var(--el-bg-color-page);
  padding: 24px;
  color: var(--el-text-color-primary);
}

.tools-layout {
  max-width: 1280px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 24px;
  min-height: calc(100vh - 48px);
}

.tools-sidebar {
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: fit-content;
  position: sticky;
  top: 24px;
}
.sidebar-header { display: flex; flex-direction: column; gap: 12px; }
.sidebar-title { font-size: 16px; font-weight: 600; color: var(--el-text-color-primary); margin: 0; }

.sidebar-search {
  background: var(--el-bg-color-overlay);
  border: var(--unified-border);
  color: var(--el-text-color-primary);
  padding: 6px 10px;
  border-radius: var(--global-border-radius);
  font-size: 13px;
  width: 100%;
  box-sizing: border-box;
}
.sidebar-search:focus { outline: none; border-color: var(--el-color-primary); }
.sidebar-categories { display: flex; flex-direction: column; gap: 4px; }

.category-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--global-border-radius);
  cursor: pointer;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  transition: background 0.15s;
}
.category-item:hover { background: var(--el-fill-color-dark); }

.category-item.active {
  background: var(--el-color-primary);
  color: var(--color-on-primary);
}
.category-icon { font-size: 16px; }
.category-name { flex: 1; }

.category-count {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  background: var(--el-fill-color-light);
  padding: 1px 6px;
  border-radius: var(--global-border-radius);
}
.category-item.active .category-count { background: var(--color-white-20); color: var(--color-on-primary); }
.tools-main { display: flex; flex-direction: column; gap: 16px; }

.tools-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.toolbar-info strong { color: var(--el-text-color-primary); font-weight: 600; }

.source-tag {
  margin-left: 8px;
  color: var(--el-color-success);
  font-size: 12px;
  background: var(--el-color-success-light-9);
  padding: 1px 6px;
  border-radius: var(--global-border-radius);
}

.source-fallback {
  color: var(--el-color-warning);
  background: var(--el-color-warning-light-9);
}

.toolbar-sort {
  background: var(--el-fill-color-light);
  border: var(--unified-border);
  color: var(--el-text-color-primary);
  padding: 4px 8px;
  border-radius: var(--global-border-radius);
  font-size: 13px;
  cursor: pointer;
}

.tools-loading, .tools-empty {
  text-align: center;
  padding: 60px 0;
  color: var(--el-text-color-placeholder);
  font-size: 14px;
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.tool-card {
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tool-card:hover {
  border-color: var(--el-color-primary);
  transform: translateY(-2px);
  }

.tool-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.tool-icon { font-size: 28px; }

.tool-badge-hot {
  background: var(--color-rank-gold);
  color: var(--el-color-white);
  font-size: 12px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: var(--global-border-radius);
}
.tool-name { font-size: 15px; font-weight: 600; color: var(--el-text-color-primary); margin: 0; }

.tool-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
  margin: 0;
  flex: 1;
}

.tool-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 8px;
  border-top: var(--unified-border);
}

.tool-tag {
  font-size: 12px;
  color: var(--el-color-primary-light-5);
  background: var(--el-color-primary-light-9);
  padding: 2px 8px;
  border-radius: var(--global-border-radius);
}

html.dark .tool-tag {
  color: var(--el-color-primary);
  background: var(--el-bg-color);
}
.tool-usage { font-size: 12px; color: var(--el-text-color-placeholder); }

/* ==================== 移动端响应式 ==================== */
@media (max-width: 1024px) {
  .tools-layout {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  .tools-sidebar {
    position: static;
    height: auto;
  }
  .sidebar-categories {
    flex-direction: row;
    overflow-x: auto;
    padding-bottom: 8px;
    gap: 8px;
  }
  .category-item {
    flex-shrink: 0;
    padding: 10px 14px;
    min-height: 44px;
  }
}

@media (max-width: 768px) {
  .tools-page { padding: 12px; }
  .tools-layout { gap: 12px; }
  .tools-sidebar { padding: 12px; }
  .sidebar-search {
    padding: 10px 12px;
    font-size: 14px;
    min-height: 44px;
  }
  .category-item {
    padding: 10px 12px;
    font-size: 13px;
    min-height: 44px;
  }
  .tools-toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  .toolbar-sort {
    padding: 10px 12px;
    font-size: 14px;
    min-height: 44px;
    width: 100%;
  }
  .tools-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 12px;
  }
  .tool-card { padding: 12px; }
  .tool-name { font-size: 14px; }
  .tool-desc { font-size: 12px; line-height: 1.45; }
}

@media (max-width: 375px) {
  .tools-grid { grid-template-columns: 1fr; }
}
</style>
