<template>
  <div class="news-center-page">
    <div class="container">
      <!-- 头部 -->
      <header class="hub-header ihui-ai-fade-in-top-animation">
        <div class="header-badge">
          <span class="status-dot"></span>
          <span class="badge-text font-edix">NEWS</span>
        </div>
        <h1>{{ t('newsCenter.title') }}</h1>
        <p class="subtitle">{{ t('newsCenter.subtitle') }}</p>
      </header>

      <!-- 与首页一致的 Tab：平台新闻 / 行业资讯（样式同步、居中） -->
      <div class="news-center-tabs-wrap ihui-ai-fade-in-top-animation">
        <div class="news-tabs">
          <button
            class="news-tabs__item"
            :class="{ 'news-tabs__item--active': activeTab === 'platform' }"
            @click="switchTab('platform')"
          >
            {{ t('homePage3.tabs.platform') }}
          </button>
          <button
            class="news-tabs__item"
            :class="{ 'news-tabs__item--active': activeTab === 'external' }"
            @click="switchTab('external')"
          >
            {{ t('homePage3.tabs.external') }}
          </button>
        </div>
      </div>

      <!-- 平台新闻 / 行业资讯加载中（切换 AI 资讯时在请求完成前显示骨架屏，避免闪「暂无」） -->
      <div v-if="(activeTab === 'platform' && platformLoading) || (activeTab === 'external' && industryAsList.length === 0 && (industryNewsLoading || !industryNewsNoMore))" class="news-feed news-feed--loading">
        <div v-for="i in 5" :key="i" class="news-entry news-entry--skeleton">
          <div class="entry-date"><span class="day">--</span><span class="month">---</span></div>
          <div class="entry-content card-glass entry-content--skeleton">
            <div class="entry-image entry-image--skeleton"></div>
            <div class="entry-body">
              <div class="entry-header"><span class="entry-cat">...</span></div>
              <div class="entry-title entry-title--skeleton">...</div>
              <div class="entry-excerpt entry-excerpt--skeleton">...</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 新闻列表 - 现代流式布局（平台 + 行业共用同一展示结构） -->
      <div v-else class="news-feed ihui-ai-fade-in-top-animation">
        <template v-if="displayList.length > 0">
          <div v-for="(news, index) in displayList" :key="news.id" class="news-entry group"
            :style="{ animationDelay: `${Number(index) * 0.1}s` }" @click="handleNewsClick(news)">
            <div class="entry-date">
              <span class="day">{{ getDay(news.date) }}</span>
              <span class="month">{{ getMonth(news.date) }}</span>
            </div>

            <div class="entry-content card-glass">
              <div class="entry-image" :class="{ 'entry-image--placeholder': !news.image }">
                <img
                  v-if="news.image"
                  :src="news.image"
                  :alt="news.title"
                  loading="lazy"
                  decoding="async"
                  @error="handleImageError"
                />
                <img
                  v-else
                  :src="defaultLogoUrl"
                  :alt="news.title"
                  class="entry-image__default-logo"
                />
                <div class="img-overlay"></div>
              </div>

              <div class="entry-body">
                <div class="entry-header">
                  <span class="entry-cat">{{ getDisplayCategory(news) }}</span>
                  <div class="read-time">5 {{ t('newsCenter.minRead') }}</div>
                </div>
                <h3 class="entry-title">{{ news.title }}</h3>
                <p class="entry-excerpt">{{ news.excerpt }}</p>
                <div class="entry-footer">
                  <span class="more-link">{{ t('newsCenter.readMore') }}<el-icon>
                      <ArrowRight />
                    </el-icon></span>
                </div>
              </div>
            </div>
          </div>
        </template>
        <div v-else class="news-feed-empty">
          <el-empty :description="activeTab === 'platform' ? t('homePage3.empty.platform') : t('homePage3.empty.external')" />
        </div>
      </div>

      <!-- 分页 - 工业风（平台新闻 / 行业资讯均前端分页） -->
      <div class="pagination-hub" v-if="totalNews > pageSize">
        <el-pagination v-model:current-page="currentPage" :page-size="pageSize" :total="totalNews"
          layout="prev, slot, next" @current-change="handlePageChange">
          <span class="page-info">{{ t('newsCenter.pageInfo', { page: currentPage, total: totalPages }) }}</span>
        </el-pagination>
      </div>
      <!-- 行业资讯：加载更多（与小程序端触底加载一致） -->
      <div v-if="activeTab === 'external' && industryAsList.length > 0 && !industryNewsNoMore" class="load-more-wrap">
        <button type="button" class="load-more-btn" :disabled="industryNewsLoading" @click="loadMoreIndustry">
          {{ industryNewsLoading ? t('newsCenter.loadingMore') : t('newsCenter.loadMore') }}
        </button>
      </div>


    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowRight } from '@/lib/lucide-fallback'
import { ElMessage } from 'element-plus'
import { useNews } from '@/composables/useNews'
import { getProxiedImageUrl, switchImageProxy } from '@/utils/imageProxy'
import defaultLogoUrl from '@/assets/icons/common/promotion-logo.svg'

// 新闻中心列表项（与首页共用数据，仅做展示映射）
interface NewsItem {
  id: string | number
  title: string
  excerpt: string
  category: string
  date: string
  image?: string
  url?: string
}

const { t } = useI18n()
const router = useRouter()
const {
  platformNews,
  industryNewsFromApi,
  industryNewsLoading,
  industryNewsNoMore,
  lastIndustryInsertTime,
  loadPlatformNews,
  loadIndustryNewsFromApi,
  loading: platformLoading,
} = useNews()

const activeTab = ref<'platform' | 'external'>('platform')
const currentPage = ref(1)
const pageSize = ref(10)

// 平台新闻转为列表项（与首页同一份 platformNews）
const platformAsList = computed<NewsItem[]>(() =>
  platformNews.value.map((n) => ({
    id: n.news_id,
    title: n.title,
    excerpt: n.summary || n.title || '',
    category: 'industry',
    date: n.publish_time || new Date().toISOString(),
    image: n.cover_image,
    url: undefined,
  }))
)
// 行业资讯：仅使用 /information/list 接口数据（与小程序端一致），不再使用本地兜底
const industryAsList = computed<NewsItem[]>(() =>
  industryNewsFromApi.value.map((n) => ({
    id: n.id,
    title: n.title,
    excerpt: n.summary || n.title || '',
    category: 'industry',
    date: n.publishTime || n.time || new Date().toISOString(),
    image: n.cover,
    url: n.url,
  }))
)

const totalNews = computed(() =>
  activeTab.value === 'platform' ? platformAsList.value.length : industryAsList.value.length
)
const displayList = computed(() => {
  const list = activeTab.value === 'platform' ? platformAsList.value : industryAsList.value
  const start = (currentPage.value - 1) * pageSize.value
  return list.slice(start, start + pageSize.value)
})
const totalPages = computed(() => Math.max(1, Math.ceil(totalNews.value / pageSize.value)))

const _goHome = () => router.push('/')
const _goToRoute = (path: string) => router.push(path)

const switchTab = (tab: 'platform' | 'external') => {
  activeTab.value = tab
  currentPage.value = 1
  if (tab === 'external' && industryNewsFromApi.value.length === 0) {
    loadAllIndustryNews()
  }
}

/** 一次性加载全部行业资讯（无数据时先拉首屏，再持续追加直到没有更多），分页可切换完整列表 */
async function loadAllIndustryNews() {
  try {
    if (industryNewsFromApi.value.length === 0) await loadIndustryNewsFromApi()
    while (!industryNewsNoMore.value && lastIndustryInsertTime.value) {
      await loadIndustryNewsFromApi(lastIndustryInsertTime.value, true)
    }
  } catch (e) {
    console.error('[NewsCenter] 加载行业新闻失败', e)
  }
}

const loadMoreIndustry = () => {
  if (lastIndustryInsertTime.value) loadIndustryNewsFromApi(lastIndustryInsertTime.value, true)
}

/** 分页切换时滚动回顶部，让第一条内容可见（兼容窗口滚动与 main#main-content 内滚动） */
const handlePageChange = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
  document.documentElement.scrollTo({ top: 0, behavior: 'smooth' })
  document.body.scrollTo?.({ top: 0, behavior: 'smooth' })
  const main = document.querySelector('#main-content')
  if (main) main.scrollTo({ top: 0, behavior: 'smooth' })
}

const getDisplayCategory = (_news: NewsItem) =>
  activeTab.value === 'external' ? (t('home.hardcoded.news')) : (t('newsCenter.categories.industry'))
const getDay = (d: string) => {
  if (!d) return '--'
  const t = new Date(d).getTime()
  return Number.isNaN(t) ? '--' : new Date(d).getDate().toString().padStart(2, '0')
}
const getMonth = (d: string) => {
  if (!d) return '---'
  const t = new Date(d).getTime()
  return Number.isNaN(t) ? '---' : new Date(d).toLocaleString('en-US', { month: 'short' }).toUpperCase()
}

const handleNewsClick = (n: NewsItem) => {
  if (n.url) window.open(n.url, '_blank')
  else ElMessage.info(t('msg.news_center.详细内容正在生成'))
}

// 图片错误处理
const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement
  if (!img) return

  // 如果当前是代理图片，尝试切换到下一个代理
  if (img.src.includes('images.weserv.nl') || img.src.includes('wsrv.nl')) {
    switchImageProxy()
    const originalSrc = img.src.replace(/^https:\/\/(images\.weserv\.nl|wsrv\.nl)\/\?url=/, '').replace(/&.*$/, '')
    if (originalSrc) {
      img.src = getProxiedImageUrl(decodeURIComponent(originalSrc), true)
      return
    }
  }

  // 如果代理都失败，使用默认图片
  img.src = '/images/APP.jpg'
}

onMounted(async () => {
  if (platformNews.value.length === 0) await loadPlatformNews()
  // 默认一次性加载全部行业资讯，进入页面即拉完数据
  loadAllIndustryNews()
  try {
    const schedulerModule = await import('@/services/news-scheduler').catch(() => null)
    if (schedulerModule?.startScheduler) schedulerModule.startScheduler()
  } catch {
    // ignore
  }
})
</script>

<style scoped lang="scss">
@use '@/styles/_breakpoints.scss' as bp;

.news-center-page {
  min-height: 100vh;
  background: var(--el-bg-color-page);
  color: var(--el-text-color-primary);
  position: relative;
}

.container {
  position: relative;
  max-width: 1800px;
  margin: 0 auto;
  padding: 0 60px;

  @media (width <= 768px) {
    padding: 0 16px;
  }

  @media (width >= 769px) and (width <= 1200px) {
    padding: 0 40px;
  }
}

.hub-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 40px 0;
  font-family: var(--font-family-mono);

  .back-btn {
    color: var(--el-text-color-secondary);
    font-size: 12px;
    font-weight: 800;

    &:hover {
      color: var(--el-text-color-primary);
    }
  }

  .nav-status {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    font-weight: 800;

    .live-dot {
      width: 6px;
      height: 6px;
      border-radius: var(--global-border-radius);
      background: var(--el-color-primary);
      border: var(--unified-border);
    }
  }
}

.hub-header {
  padding: 24px 0 32px;

  .header-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    padding: 6px 12px;
    background: var(--el-fill-color-light);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--el-color-primary);
    }

    .badge-text {
      font-family: 'EDIX';
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.05em;
      color: var(--el-text-color-primary);
      text-transform: uppercase;
    }
  }

  h1 {
    font-size: clamp(32px, 5vw, 48px);
    font-weight: 900;
    margin: 0 0 8px;
    letter-spacing: -1px;
    color: var(--el-text-color-primary);
  }

  .subtitle {
    color: var(--el-text-color-regular);
    font-size: 16px;
    max-width: 600px;
    margin: 0;
  }
}

/* 与首页一致的 Tab 样式并居中 */
.news-center-tabs-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 24px;
}

.news-tabs {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  background: hsl(var(--muted));
  border-radius: var(--global-border-radius);

  html.dark & {
    background: var(--color-dark-bg-3);
  }

  &__item {
    padding: 10px 24px;
    font-size: 14px;
    font-weight: 500;
    color: var(--el-text-color-secondary);
    background: transparent;
    border: none;
    border-radius: var(--global-border-radius);
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;

    html.dark & {
      color: hsl(var(--muted-foreground));
    }

    &:hover:not(&--active) {
      color: var(--el-text-color-primary);
      background: hsl(var(--background));

      html.dark & {
        color: hsl(var(--foreground));
        background: var(--color-dark-bg-5);
      }
    }

    &--active {
      color: var(--el-text-color-primary);
      background: hsl(var(--background));
      border: var(--unified-border);

      html.dark & {
        color: hsl(var(--foreground));
        background: var(--color-dark-bg-5);
        border-color: var(--color-dark-bg-6);
      }
    }
  }
}

.news-feed-empty {
  padding: 60px 0;
}

.news-feed--loading .news-entry--skeleton {
  pointer-events: none;
  opacity: 0.8;

  .entry-content--skeleton .entry-image--skeleton {
    min-height: 160px;
    background: var(--el-fill-color);
    background-size: 200% 100%;
    animation: skeleton 1.5s ease-in-out infinite;
  }

  .entry-title--skeleton,
  .entry-excerpt--skeleton {
    height: 1em;
    border-radius: var(--global-border-radius);
    background: var(--el-fill-color);
  }
}

@keyframes skeleton {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.filter-bar {
  margin-bottom: 80px;

  .filter-pill-container {
    display: flex;
    gap: 8px;
    background: var(--el-fill-color-light);
    padding: 6px;
    border-radius: var(--global-border-radius);
    width: fit-content;
    border: var(--unified-border);
  }

  .filter-pill {
    background: none;
    border: none;
    padding: 10px 24px;
    border-radius: var(--global-border-radius);
    color: var(--el-text-color-regular);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.3s;

    &.active {
      background: var(--el-text-color-primary);
      color: var(--el-bg-color-page);
    }

    &:hover:not(.active) {
      color: var(--el-text-color-secondary);
    }
  }
}

.news-feed {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: 24px;

  // 小屏幕：2列
  @media (width >= 768px) {
    grid-template-columns: repeat(2, 1fr);
  }

  // 中等屏幕：3列
  @media (width >= 1200px) {
    grid-template-columns: repeat(3, 1fr);
  }

  // 大屏幕：4列
  @media (width >= 1600px) {
    grid-template-columns: repeat(4, 1fr);
  }
}

.news-entry {
  display: flex;
  flex-direction: column;
  gap: 16px;
  cursor: pointer;

  .entry-date {
    display: flex;
    flex-direction: row;
    align-items: baseline;
    gap: 8px;
    font-family: var(--font-family-mono);

    .day {
      font-size: 28px;
      font-weight: 800;
      line-height: 1;
      color: var(--el-text-color-primary);
    }

    .month {
      font-size: 12px;
      color: var(--el-text-color-secondary);
      font-weight: 700;
      letter-spacing: 1px;
    }
  }

  .entry-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--el-fill-color-light);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    overflow: hidden;
    transition: all 0.4s;

    &:hover {
      border-color: var(--el-border-color-light);
      background: var(--el-fill-color);
      transform: translateY(-4px);
      .entry-image img {
        transform: scale(1.05);
      }

      .more-link {
        color: var(--el-color-primary);
      }
    }
  }

  .entry-image {
    width: 100%;
    height: 200px;
    position: relative;
    overflow: hidden;
    background: var(--el-fill-color-darker);

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    }

    &.entry-image--placeholder {
      img.entry-image__default-logo {
        object-fit: contain;
        padding: 24px;
      }

      .img-overlay {
        background: transparent;
      }
    }

    .img-overlay {
      position: absolute;
      inset: 0;
      background: var(--color-white-15);
      pointer-events: none;
    }
  }

  .entry-body {
    flex: 1;
    padding: 4px 16px;
    display: flex;
    flex-direction: column;

    .entry-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 0;

      .entry-cat {
        font-family: var(--font-family-mono);
        font-size: 12px;
        color: var(--el-color-primary);
        font-weight: 800;
        text-transform: uppercase;
      }

      .read-time {
        font-family: var(--font-family-mono);
        font-size: 9px;
        font-weight: 800;
        color: var(--el-text-color-secondary);
      }
    }

    .entry-title {
      font-size: 15px;
      font-weight: 700;
      margin: 16px 0 0;
      line-height: 1.3;
      color: var(--el-text-color-primary);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .entry-excerpt {
      font-size: 13px;
      color: var(--el-text-color-regular);
      line-height: 1.4;
      margin-bottom: 6px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      flex: 1;
    }

    .more-link {
      font-family: var(--font-family-mono);
      font-size: 12px;
      font-weight: 800;
      color: var(--el-text-color-secondary);
      transition: all 0.3s;
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: auto;
    }
  }
}

.load-more-wrap {
  margin-top: 32px;
  display: flex;
  justify-content: center;
}

.load-more-btn {
  font-family: var(--font-family-mono);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 1px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  padding: 12px 32px;
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s, background 0.2s;

  &:hover:not(:disabled) {
    color: var(--el-color-primary);
    border-color: var(--el-color-primary-light-5);
    background: var(--el-fill-color);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }
}

.pagination-hub {
  margin-top: 100px;
  display: flex;
  justify-content: center;

  .page-info {
    font-family: var(--font-family-mono);
    font-size: 12px;
    color: var(--el-text-color-secondary);
    font-weight: 800;
    padding: 0 40px;
  }

  :deep(.el-pager) {
    display: none;
  }

  :deep(.el-pagination button.el-pagination__btn) {
    background: none;
    color: var(--el-text-color-regular);
    font-weight: 800;

    &:hover {
      color: var(--el-text-color-primary);
    }
  }
}


</style>
