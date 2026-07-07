<!--
  AI 动态聚合面板 (核心 UI)
  对标 insprira 的热榜 Tab + 趋势分析, 但完全自研

  功能:
  - 多平台动态 Tab (按分类分组: 通用热榜/AI资讯/AI论文/技术社区, sortablejs 拖拽排序)
  - 双视图模式: 列表视图 / 话题聚合视图(跨源热点)
  - 资讯卡片列表 (含趋势标签 + AI摘要 + 分类标签)
  - 无限滚动加载 (useInfiniteScroll)
  - 多维度筛选 (数据源/分类/趋势/关键词)
  - 趋势图弹窗 (点击卡片展示 ECharts 趋势曲线)
  - 骨架屏 + 错误重试 + 空状态

  设计约束:
  - 圆角: var(--global-border-radius) 8px
  - 描边: var(--unified-border) 1px
  - 无 box-shadow (扁平化)
  - 暗色模式: html.dark 覆盖
  - 图片: getProxiedImageUrl 防盗链
  - 图标: @/lib/lucide-fallback
-->
<template>
  <div class="ai-feed-panel">
    <!-- 顶部工具栏: 视图切换 + 刷新 -->
    <div class="feed-toolbar">
      <div class="view-toggle">
        <button
          class="view-btn"
          :class="{ active: viewMode === 'list' }"
          @click="switchViewMode('list')"
        >
          {{ t('newsCenter.aggregator.listView') }}
        </button>
        <button
          class="view-btn"
          :class="{ active: viewMode === 'topics' }"
          @click="switchViewMode('topics')"
        >
          {{ t('newsCenter.aggregator.topicsView') }}
        </button>
      </div>
      <button class="refresh-btn" :disabled="loading" @click="handleRefresh">
        {{ t('newsCenter.aggregator.refresh') }}
      </button>
    </div>

    <!-- 数据源分类 Tab (sortablejs 拖拽排序) -->
    <div v-if="viewMode === 'list'" ref="tabsRef" class="feed-category-tabs">
      <button
        class="cat-tab"
        :class="{ active: !activeSource }"
        data-source-code=""
        @click="selectSource('')"
      >
        {{ t('newsCenter.aggregator.allSources') }}
      </button>
      <template v-for="(group, catKey) in sourcesByCategory" :key="catKey">
        <button
          v-for="src in group"
          :key="src.source_code"
          class="cat-tab"
          :class="{ active: activeSource === src.source_code }"
          :data-source-code="src.source_code"
          :style="activeSource === src.source_code && src.color ? { color: src.color, borderColor: src.color } : {}"
          @click="selectSource(src.source_code)"
        >
          <span v-if="src.color" class="cat-dot" :style="{ background: src.color }"></span>
          {{ src.source_name }}
        </button>
      </template>
    </div>

    <!-- ============ 列表视图 ============ -->
    <template v-if="viewMode === 'list'">
      <!-- 筛选栏 -->
      <div class="feed-filter-bar">
        <div class="filter-group">
          <span class="filter-label">{{ t('newsCenter.aggregator.filter') }}:</span>
          <div class="filter-chips">
            <button
              class="chip"
              :class="{ active: !activeCategory }"
              @click="selectCategory('')"
            >
              {{ t('newsCenter.aggregator.allCategories') }}
            </button>
            <button
              v-for="cat in categoryKeys"
              :key="cat"
              class="chip"
              :class="{ active: activeCategory === cat }"
              @click="selectCategory(cat)"
            >
              {{ categoryLabel(cat) }}
            </button>
          </div>
        </div>
        <div class="filter-group">
          <div class="filter-chips">
            <button
              class="chip trend-chip"
              :class="{ active: !activeTrend }"
              @click="selectTrend('')"
            >
              {{ t('newsCenter.aggregator.allTrends') }}
            </button>
            <button
              v-for="tr in trendKeys"
              :key="tr"
              class="chip trend-chip"
              :class="{ active: activeTrend === tr }"
              :style="activeTrend === tr ? { color: trendColor(tr), borderColor: trendColor(tr) } : {}"
              @click="selectTrend(tr)"
            >
              {{ trendLabel(tr) }}
            </button>
          </div>
        </div>
        <div class="filter-search">
          <input
            v-model="searchInput"
            class="search-input"
            :placeholder="t('newsCenter.aggregator.searchPlaceholder')"
            @keyup.enter="search(searchInput)"
          />
        </div>
      </div>

      <!-- 资讯列表 -->
      <div ref="listRef" class="feed-list">
        <!-- 骨架屏 -->
        <template v-if="loading">
          <div v-for="i in 6" :key="`sk-${i}`" class="feed-card-skeleton">
            <el-skeleton :rows="3" animated />
          </div>
        </template>

        <!-- 错误 -->
        <div v-else-if="error" class="feed-error">
          <p>{{ t('newsCenter.aggregator.loadFailed') }}</p>
          <button class="retry-btn" @click="loadItems">{{ t('newsCenter.aggregator.retry') }}</button>
        </div>

        <!-- 空状态 -->
        <div v-else-if="items.length === 0" class="feed-empty">
          <p>{{ t('newsCenter.aggregator.noMoreData') }}</p>
        </div>

        <!-- 资讯卡片 -->
        <template v-else>
          <article
            v-for="item in items"
            :key="item.id"
            class="feed-card"
            @click="openTrend(item)"
          >
            <div class="card-cover" v-if="item.cover_url">
              <img
                :src="getProxiedImageUrl(item.cover_url, true)"
                :alt="item.title"
                loading="lazy"
                @error="handleImgError"
              />
            </div>
            <div class="card-body">
              <div class="card-meta-top">
                <span class="source-tag" :style="item.source_color ? { color: item.source_color, borderColor: item.source_color } : {}">
                  {{ item.source_name }}
                </span>
                <span v-if="item.trend_tag" class="trend-tag" :style="{ color: trendColor(item.trend_tag), borderColor: trendColor(item.trend_tag) }">
                  {{ trendLabel(item.trend_tag) }}
                  <template v-if="item.trend_growth_pct !== null && item.trend_growth_pct !== undefined">
                    {{ item.trend_growth_pct > 0 ? '+' : '' }}{{ item.trend_growth_pct.toFixed(0) }}%
                  </template>
                </span>
                <span v-if="item.llm_category" class="cat-tag">{{ categoryLabel(item.llm_category) }}</span>
                <span v-if="item.current_rank" class="rank-tag">#{{ item.current_rank }}</span>
              </div>
              <h3 class="card-title">{{ item.title }}</h3>
              <p v-if="item.llm_summary || item.summary" class="card-summary">
                <span v-if="item.llm_summary" class="ai-prefix">{{ t('newsCenter.aggregator.aiSummary') }}:</span>
                {{ item.llm_summary || item.summary }}
              </p>
              <div class="card-meta-bottom">
                <span v-if="item.author" class="meta-item">{{ item.author }}</span>
                <span v-if="item.publish_time" class="meta-item">{{ formatTime(item.publish_time) }}</span>
                <span v-if="item.current_hot" class="meta-item">{{ formatHot(item.current_hot) }}</span>
              </div>
            </div>
          </article>
        </template>
      </div>

      <!-- 分页器 -->
      <div v-if="!loading && !error && totalItems > feedPageSize" class="feed-pagination">
        <button
          class="page-square page-square--nav"
          :disabled="currentPage <= 1"
          @click="goToFeedPage(currentPage - 1)"
          :aria-label="t('newsCenter.prevPage')"
        >
          <el-icon><ChevronLeft /></el-icon>
        </button>
        <template v-for="p in feedPageList" :key="p">
          <span v-if="typeof p === 'string'" class="page-ellipsis">{{ p }}</span>
          <button
            v-else
            class="page-square"
            :class="{ 'page-square--active': p === currentPage }"
            @click="goToFeedPage(p)"
          >
            {{ p }}
          </button>
        </template>
        <button
          class="page-square page-square--nav"
          :disabled="currentPage >= feedTotalPages"
          @click="goToFeedPage(currentPage + 1)"
          :aria-label="t('newsCenter.nextPage')"
        >
          <el-icon><ChevronRight /></el-icon>
        </button>
      </div>
    </template>

    <!-- ============ 话题聚合视图 ============ -->
    <template v-else>
      <div class="topics-list">
        <!-- 骨架屏 -->
        <template v-if="loadingTopics">
          <div v-for="i in 4" :key="`tsk-${i}`" class="feed-card-skeleton">
            <el-skeleton :rows="4" animated />
          </div>
        </template>

        <!-- 空状态 -->
        <div v-else-if="topics.length === 0" class="feed-empty">
          <p>{{ t('newsCenter.aggregator.noTopics') }}</p>
        </div>

        <!-- 话题卡片 -->
        <article
          v-for="(topic, idx) in topics"
          :key="idx"
          class="topic-card"
        >
          <div class="topic-header">
            <span class="topic-rank">#{{ Number(idx) + 1 }}</span>
            <h3 class="topic-title">{{ topic.topic_title }}</h3>
            <span
              class="topic-trend-badge"
              :style="{ color: trendColor(topic.aggregate_trend), borderColor: trendColor(topic.aggregate_trend) }"
            >
              {{ trendLabel(topic.aggregate_trend) }}
            </span>
          </div>
          <div class="topic-meta">
            <span class="topic-source-count">
              {{ t('newsCenter.aggregator.sourceCount', { count: topic.source_count }) }}
            </span>
            <span v-if="topic.total_hot" class="topic-hot">{{ formatHot(topic.total_hot) }}</span>
            <span v-if="topic.best_rank" class="topic-best-rank">{{ t('newsCenter.aggregator.bestRank') }} #{{ topic.best_rank }}</span>
          </div>
          <div class="topic-sources">
            <span
              v-for="(srcName, si) in topic.source_names"
              :key="si"
              class="topic-source-badge"
            >
              {{ srcName }}
            </span>
          </div>
          <div v-if="topic.topic_tags.length > 0" class="topic-tags">
            <span v-for="tag in topic.topic_tags" :key="tag" class="topic-tag">{{ tag }}</span>
          </div>
          <!-- 展开子条目 -->
          <details v-if="topic.items.length > 1" class="topic-items-expand">
            <summary>{{ t('newsCenter.aggregator.viewDetails', { count: topic.item_count }) }}</summary>
            <div class="topic-sub-items">
              <div
                v-for="subItem in topic.items"
                :key="subItem.id"
                class="topic-sub-item"
                @click="openTrend(subItem)"
              >
                <span class="sub-item-source">{{ subItem.source_name }}</span>
                <span class="sub-item-title">{{ subItem.title }}</span>
                <span v-if="subItem.current_rank" class="sub-item-rank">#{{ subItem.current_rank }}</span>
              </div>
            </div>
          </details>
        </article>
      </div>
    </template>

    <!-- 趋势图弹窗 -->
    <el-dialog
      v-model="trendDialogVisible"
      :title="t('newsCenter.aggregator.trendChart')"
      width="640px"
      append-to-body
      class="trend-dialog"
    >
      <AiFeedTrendChart v-if="trendItemId" :item-id="trendItemId" :window="14" />
      <div class="trend-dialog-actions" v-if="trendItemUrl">
        <a :href="trendItemUrl" target="_blank" rel="noopener noreferrer" class="view-original-link">
          {{ t('newsCenter.aggregator.viewOriginal') }}
        </a>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onBeforeUnmount, ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useIntervalFn } from '@vueuse/core'
import { ElDialog, ElSkeleton, ElNotification, ElIcon } from 'element-plus'
import Sortable from 'sortablejs'
import { ChevronLeft, ChevronRight } from '@/lib/lucide-fallback'

import AiFeedTrendChart from './AiFeedTrendChart.vue'
import { useAiFeed } from '@/composables/useAiFeed'
import { getProxiedImageUrl } from '@/utils/imageProxy'
import { getAiFeedNotifications } from '@/api/ai-feed'
import type { AiFeedItem } from '@/api/ai-feed'

const { t } = useI18n()
const {
  sources,
  items,
  topics,
  total,
  currentPage,
  loading,
  loadingTopics,
  noMore,
  error,
  activeSource,
  activeCategory,
  activeTrend,
  viewMode,
  sourcesByCategory,
  loadSources,
  loadItems,
  loadTopics,
  selectSource,
  selectCategory,
  selectTrend,
  search,
  switchViewMode,
  restoreTabOrder,
  saveTabOrder,
  refresh,
  categoryLabel,
  trendLabel,
  trendColor,
} = useAiFeed()

const tabsRef = ref<HTMLElement | null>(null)
const searchInput = ref('')
const trendDialogVisible = ref(false)
const trendItemId = ref<number | null>(null)
const trendItemUrl = ref<string>('')
let sortableInstance: Sortable | null = null

const categoryKeys = ['hotspot', 'account', 'source', 'creation', 'analysis', 'retrieval', 'tool']
const trendKeys = ['rising', 'stable', 'cooling', 'new']

// 分页相关
const feedPageSize = 20
const totalItems = computed(() => total.value)
const feedTotalPages = computed(() => Math.max(1, Math.ceil(totalItems.value / feedPageSize)))
const feedPageList = computed<(number | string)[]>(() => {
  const tp = feedTotalPages.value
  const cur = currentPage.value
  if (tp <= 7) return Array.from({ length: tp }, (_, i) => i + 1)
  const pages: (number | string)[] = [1]
  const left = Math.max(2, cur - 1)
  const right = Math.min(tp - 1, cur + 1)
  if (left > 2) pages.push('…')
  for (let i = left; i <= right; i++) pages.push(i)
  if (right < tp - 1) pages.push('…')
  pages.push(tp)
  return pages
})

function goToFeedPage(p: number) {
  if (p < 1 || p > feedTotalPages.value || p === currentPage.value) return
  loadItems(p)
  // 滚动到列表顶部
  nextTick(() => {
    const el = document.querySelector('.ai-feed-panel')
    if (el) {
      const rect = el.getBoundingClientRect()
      const offset = rect.top + window.scrollY - 80
      window.scrollTo({ top: offset, behavior: 'smooth' })
    }
  })
}

function openTrend(item: AiFeedItem) {
  trendItemId.value = item.id
  trendItemUrl.value = item.url || ''
  trendDialogVisible.value = true
}

function handleImgError(e: Event) {
  const img = e.target as HTMLImageElement
  img.style.display = 'none'
}

async function handleRefresh() {
  await refresh()
  if (viewMode.value === 'topics') {
    await loadTopics()
  }
}

function initSortable() {
  if (!tabsRef.value) return
  sortableInstance = Sortable.create(tabsRef.value, {
    animation: 200,
    draggable: '.cat-tab',
    onEnd(evt) {
      if (!evt.to) return
      const order = Array.from(evt.to.querySelectorAll<HTMLElement>('.cat-tab'))
        .map(el => el.dataset.sourceCode || '')
        .filter(Boolean)
      saveTabOrder(order)
    },
  })
}

function destroySortable() {
  if (sortableInstance) {
    sortableInstance.destroy()
    sortableInstance = null
  }
}

// 当 sources 加载完成且 viewMode 为 list 时, 初始化 sortable
watch([sources, viewMode], async () => {
  if (sources.value.length > 0 && viewMode.value === 'list') {
    await nextTick()
    destroySortable()
    initSortable()
  }
}, { immediate: false })

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    const now = new Date()
    const diff = (now.getTime() - d.getTime()) / 1000
    if (diff < 60) return '刚刚'
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
    if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
    if (diff < 604800) return `${Math.floor(diff / 86400)}天前`
    return d.toLocaleDateString()
  } catch {
    return iso
  }
}

function formatHot(hot: number): string {
  if (hot >= 100000000) return `${(hot / 100000000).toFixed(1)}亿`
  if (hot >= 10000) return `${(hot / 10000).toFixed(1)}万`
  return String(hot)
}

onMounted(async () => {
  restoreTabOrder()
  await loadSources()
  await loadItems()
})

onBeforeUnmount(() => {
  destroySortable()
})

// ---------------------------------------------------------------------------
// 趋势爆发通知轮询 (每 60 秒检查一次, 替代 socket.io 的轻量方案)
// ---------------------------------------------------------------------------
const seenNotificationIds = new Set<number>()

async function pollNotifications() {
  try {
    const res = await getAiFeedNotifications({ hours: 24, min_growth: 15, limit: 10 })
    const data = res?.data
    const list: AiFeedItem[] = Array.isArray(data) ? data : (data?.items ?? [])
    for (const item of list) {
      if (!seenNotificationIds.has(item.id)) {
        seenNotificationIds.add(item.id)
        // 只显示在最近 5 分钟内更新的条目(避免页面加载时弹出大量历史通知)
        if (item.last_seen_at) {
          const age = (Date.now() - new Date(item.last_seen_at).getTime()) / 1000
          if (age > 300) continue // 超过 5 分钟的不推送
        }
        ElNotification({
          title: t('newsCenter.aggregator.trendAlert'),
          message: `${item.source_name}: ${item.title}`,
          type: 'warning',
          duration: 6000,
          position: 'bottom-right',
        })
      }
    }
  } catch {
    // 静默失败, 不影响主功能
  }
}

// 页面加载 30 秒后开始轮询, 之后每 60 秒一次
const { pause: pausePolling, resume: resumePolling } = useIntervalFn(pollNotifications, 60000, {
  immediate: false,
})

onMounted(() => {
  setTimeout(() => resumePolling(), 30000)
})

onBeforeUnmount(() => {
  pausePolling()
})
</script>

<style scoped lang="scss">
.ai-feed-panel {
  width: 100%;
}

// 顶部工具栏
.feed-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.view-toggle {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  background: var(--app-surface-2, #f0f0f0);
  border-radius: var(--global-border-radius, 8px);
}

.view-btn {
  padding: 5px 16px;
  background: transparent;
  border: none;
  border-radius: var(--global-border-radius, 8px);
  font-size: 13px;
  color: var(--app-text-secondary, #525252);
  cursor: pointer;
  transition: all 0.2s ease;

  &.active {
    background: var(--app-surface-2, #fff);
    color: var(--app-text-primary, #1a1a1a);
    font-weight: 500;
  }
}

.refresh-btn {
  padding: 5px 14px;
  background: var(--app-surface-2, #fff);
  border: var(--unified-border, 1px solid #e9e9e9);
  border-radius: var(--global-border-radius, 8px);
  font-size: 12px;
  color: var(--app-text-secondary, #525252);
  cursor: pointer;
  transition: border-color 0.2s ease;

  &:hover:not(:disabled) {
    border-color: var(--app-text-secondary, #525252);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

// 分类 Tab
.feed-category-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.cat-tab {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  background: var(--app-surface-2, #fff);
  border: var(--unified-border, 1px solid #e9e9e9);
  border-radius: var(--global-border-radius, 8px);
  font-size: 13px;
  color: var(--app-text-secondary, #525252);
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;

  &:hover {
    border-color: var(--app-text-primary, #1a1a1a);
  }

  &.active {
    background: var(--app-text-primary, #1a1a1a);
    color: #fff;
    border-color: var(--app-text-primary, #1a1a1a);
  }
}

.cat-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
}

// 筛选栏
.feed-filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 20px;
  align-items: center;
  padding: 12px 16px;
  background: var(--app-surface-2, #fff);
  border: var(--unified-border, 1px solid #e9e9e9);
  border-radius: var(--global-border-radius, 8px);
  margin-bottom: 16px;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-label {
  font-size: 12px;
  color: var(--app-text-muted, #8c8c8c);
  white-space: nowrap;
}

.filter-chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.chip {
  padding: 3px 10px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--global-border-radius, 8px);
  font-size: 12px;
  color: var(--app-text-secondary, #525252);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: var(--app-surface-1, #f7f7f8);
  }

  &.active {
    background: var(--app-surface-1, #f0f0f0);
    border-color: var(--app-text-primary, #1a1a1a);
    color: var(--app-text-primary, #1a1a1a);
    font-weight: 500;
  }
}

.trend-chip.active {
  border-color: currentColor;
}

.filter-search {
  margin-left: auto;
}

.search-input {
  width: 220px;
  padding: 6px 12px;
  background: var(--app-surface-1, #f7f7f8);
  border: var(--unified-border, 1px solid #e9e9e9);
  border-radius: var(--global-border-radius, 8px);
  font-size: 13px;
  color: var(--app-text-primary, #1a1a1a);
  outline: none;
  transition: border-color 0.2s ease;

  &:focus {
    border-color: var(--app-text-secondary, #525252);
  }

  &::placeholder {
    color: var(--app-text-muted, #8c8c8c);
  }
}

// 资讯列表 - 双列网格
.feed-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
}

.feed-card-skeleton {
  padding: 16px;
  background: var(--app-surface-2, #fff);
  border: var(--unified-border, 1px solid #e9e9e9);
  border-radius: var(--global-border-radius, 8px);
}

.feed-card {
  display: flex;
  gap: 14px;
  padding: 16px;
  background: var(--app-surface-2, #fff);
  border: var(--unified-border, 1px solid #e9e9e9);
  border-radius: var(--global-border-radius, 8px);
  cursor: pointer;
  transition: border-color 0.2s ease;

  &:hover {
    border-color: var(--app-text-secondary, #525252);
  }
}

.card-cover {
  flex-shrink: 0;
  width: 100px;
  height: 100px;
  border-radius: var(--global-border-radius, 8px);
  overflow: hidden;
  background: var(--app-surface-1, #f7f7f8);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.card-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.card-meta-top {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.source-tag,
.trend-tag,
.cat-tag,
.rank-tag {
  font-size: 11px;
  padding: 2px 8px;
  border: 1px solid;
  border-radius: var(--global-border-radius, 8px);
  white-space: nowrap;
}

.source-tag {
  color: var(--app-text-secondary, #525252);
  border-color: var(--app-divider, #e9e9e9);
}

.trend-tag {
  font-weight: 600;
}

.cat-tag {
  color: var(--app-text-muted, #8c8c8c);
  border-color: var(--app-divider, #e9e9e9);
  background: var(--app-surface-1, #f7f7f8);
}

.rank-tag {
  color: var(--app-text-muted, #8c8c8c);
  border-color: transparent;
  font-weight: 600;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--app-text-primary, #1a1a1a);
  line-height: 1.5;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-summary {
  font-size: 13px;
  color: var(--app-text-secondary, #525252);
  line-height: 1.5;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.ai-prefix {
  color: var(--app-text-muted, #8c8c8c);
  font-size: 11px;
  font-weight: 500;
}

.card-meta-bottom {
  display: flex;
  gap: 12px;
  margin-top: auto;
  font-size: 11px;
  color: var(--app-text-muted, #8c8c8c);
}

.meta-item {
  white-space: nowrap;
}

// 分页器 - 与新闻中心 .pagination-hub 完全统一 (纯 --el-* 变量, 避免双变量体系导致颜色不一致)
.feed-pagination {
  margin-top: 20px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;

  .page-square {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 36px;
    height: 36px;
    padding: 0 6px;
    font-family: var(--font-family-mono);
    font-size: 13px;
    font-weight: 700;
    color: var(--el-text-color-secondary);
    background: var(--el-fill-color-light);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    cursor: pointer;
    transition: all 0.2s ease;
    user-select: none;

    &:hover:not(:disabled):not(&--active) {
      color: var(--el-text-color-primary);
      background: var(--el-fill-color);
      border-color: var(--border-unified-color-hover);
    }

    &--active {
      color: var(--app-button-text-on-primary, #fff);
      background: var(--el-text-color-primary);
      border-color: var(--el-text-color-primary);
      cursor: default;
    }

    &--nav {
      .el-icon {
        font-size: 16px;
      }

      &:disabled {
        opacity: 0.35;
        cursor: not-allowed;
      }
    }
  }

  .page-ellipsis {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 36px;
    height: 36px;
    font-family: var(--font-family-mono);
    font-size: 13px;
    color: var(--el-text-color-placeholder);
    user-select: none;
  }
}

.feed-no-more,
.feed-empty {
  text-align: center;
  padding: 24px 0;
  color: var(--app-text-muted, #8c8c8c);
  font-size: 13px;
}

.feed-error {
  text-align: center;
  padding: 24px 0;
  color: var(--app-text-muted, #8c8c8c);
  font-size: 13px;

  .retry-btn {
    margin-top: 8px;
    padding: 4px 16px;
    background: var(--app-surface-2, #fff);
    border: var(--unified-border, 1px solid #e9e9e9);
    border-radius: var(--global-border-radius, 8px);
    color: var(--app-text-primary, #1a1a1a);
    cursor: pointer;
    font-size: 12px;

    &:hover { border-color: var(--app-text-secondary, #525252); }
  }
}

// ============ 话题聚合视图样式 ============
.topics-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.topic-card {
  padding: 16px;
  background: var(--app-surface-2, #fff);
  border: var(--unified-border, 1px solid #e9e9e9);
  border-radius: var(--global-border-radius, 8px);
  transition: border-color 0.2s ease;

  &:hover {
    border-color: var(--app-text-secondary, #525252);
  }
}

.topic-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.topic-rank {
  font-size: 16px;
  font-weight: 800;
  color: var(--app-text-muted, #8c8c8c);
  flex-shrink: 0;
}

.topic-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--app-text-primary, #1a1a1a);
  margin: 0;
  flex: 1;
  line-height: 1.5;
}

.topic-trend-badge {
  font-size: 11px;
  padding: 2px 8px;
  border: 1px solid;
  border-radius: var(--global-border-radius, 8px);
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
}

.topic-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--app-text-muted, #8c8c8c);
  margin-bottom: 8px;
}

.topic-source-count {
  font-weight: 500;
  color: var(--app-text-secondary, #525252);
}

.topic-sources {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}

.topic-source-badge {
  font-size: 11px;
  padding: 2px 8px;
  background: var(--app-surface-1, #f7f7f8);
  border-radius: var(--global-border-radius, 8px);
  color: var(--app-text-secondary, #525252);
}

.topic-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.topic-tag {
  font-size: 10px;
  padding: 1px 6px;
  background: var(--app-surface-1, #f0f0f0);
  border-radius: var(--global-border-radius, 8px);
  color: var(--app-text-muted, #8c8c8c);
}

.topic-items-expand {
  margin-top: 8px;

  summary {
    font-size: 12px;
    color: var(--app-text-secondary, #525252);
    cursor: pointer;
    padding: 4px 0;
    transition: color 0.2s ease;

    &:hover {
      color: var(--app-text-primary, #1a1a1a);
    }
  }
}

.topic-sub-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--app-divider, #f0f0f0);
}

.topic-sub-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--global-border-radius, 8px);
  cursor: pointer;
  transition: background 0.2s ease;

  &:hover {
    background: var(--app-surface-1, #f7f7f8);
  }
}

.sub-item-source {
  font-size: 11px;
  color: var(--app-text-muted, #8c8c8c);
  white-space: nowrap;
  flex-shrink: 0;
}

.sub-item-title {
  font-size: 13px;
  color: var(--app-text-primary, #1a1a1a);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sub-item-rank {
  font-size: 11px;
  color: var(--app-text-muted, #8c8c8c);
  flex-shrink: 0;
}

// 趋势弹窗
.trend-dialog-actions {
  text-align: center;
  margin-top: 12px;
}

.view-original-link {
  display: inline-block;
  padding: 6px 20px;
  background: var(--app-text-primary, #1a1a1a);
  color: #fff;
  border-radius: var(--global-border-radius, 8px);
  font-size: 13px;
  text-decoration: none;
  transition: opacity 0.2s ease;

  &:hover { opacity: 0.85; }
}

// 暗色模式
html.dark {
  .view-toggle {
    background: var(--app-surface-1, #1a1a1a);
  }

  .view-btn.active {
    background: var(--app-surface-2, #161617);
    color: #fff;
  }

  .refresh-btn,
  .cat-tab,
  .chip,
  .feed-card,
  .feed-card-skeleton,
  .feed-filter-bar,
  .topic-card {
    background: var(--app-surface-2, #161617);
  }

  .cat-tab.active {
    background: #fff;
    color: #1a1a1a;
    border-color: #fff;
  }

  .search-input {
    background: var(--app-surface-1, #1a1a1a);
  }

  .topic-source-badge,
  .topic-tag {
    background: var(--app-surface-1, #1a1a1a);
  }

  .topic-sub-item:hover {
    background: var(--app-surface-1, #1a1a1a);
  }

  .view-original-link {
    background: #fff;
    color: #1a1a1a;
  }
}

// 响应式
@media (max-width: 640px) {
  .card-cover {
    width: 72px;
    height: 72px;
  }

  .card-title {
    font-size: 14px;
  }

  .filter-search {
    margin-left: 0;
    width: 100%;

    .search-input {
      width: 100%;
    }
  }

  .feed-toolbar {
    flex-wrap: wrap;
    gap: 8px;
  }
}
</style>
