<template>
  <main ref="pageSlideRef" id="third-page" class="page-section page-slide">
    <div class="page-content third-page-content">
      <!-- 紧凑型头部：标题 + Tab 同行 -->
      <div class="news-section">
        <header class="news-section__header">
          <div class="news-section__left">
            <h2 class="news-section__title">{{ t('home.page3.title') }}</h2>
            <!-- 英文副标题（在中文标题下方） -->
            <h3 class="news-section__title-en font-edix">{{ t('home.page3.titleEn') }}</h3>
            <p class="news-section__subtitle">{{ t('home.page3.subtitle') }}</p>
          </div>
          <div class="news-tabs">
            <button
              class="news-tabs__item"
              :class="{ 'news-tabs__item--active': activeTab === 'platform' }"
              @click="activeTab = 'platform'"
            >
              {{ t('home.page3.tabs.platform') }}
            </button>
            <button
              class="news-tabs__item"
              :class="{ 'news-tabs__item--active': activeTab === 'external' }"
              @click="activeTab = 'external'"
            >
              {{ t('home.page3.tabs.external') }}
            </button>
          </div>
        </header>

        <!-- 内容区域 -->
        <transition name="news-fade" mode="out-in">
          <!-- 平台新闻 -->
          <div v-if="activeTab === 'platform'" key="platform" class="news-section__content">
            <div v-if="loading" class="news-section__loading">
              <div class="news-skeleton">
                <div v-for="i in 4" :key="i" class="news-skeleton__item"></div>
              </div>
            </div>
            <div v-else-if="platformNews.length === 0" class="news-section__empty">
              <el-empty :description="t('home.page3.empty.platform')" />
            </div>
            <div v-else class="news-magazine">
              <!-- 主内容区域：大卡片 + 侧边栏 -->
              <div class="news-magazine__main">
                <!-- 主要新闻 - 大卡片（文字叠加在图片上） -->
                <article 
                  v-if="platformNews[0]"
                  class="news-hero"
                  @click="handleNewsClick(platformNews[0], 'platform')"
                >
                  <div class="news-hero__image">
                    <img
                      :src="platformNews[0].cover_image || '/images/logo.svg'"
                      :alt="platformNews[0].title"
                      @error="handleImageError($event, platformNews[0])"
                      loading="lazy"
                      decoding="async"
                    />
                    <div class="news-hero__gradient"></div>
                  </div>
                  <div class="news-hero__content">
                    <span class="news-hero__tag">{{ t('home.hardcoded.hot') }}</span>
                    <h3 class="news-hero__title">{{ platformNews[0].title }}</h3>
                    <p class="news-hero__summary">{{ platformNews[0].summary || platformNews[0].title }}</p>
                    <time class="news-hero__time">{{ formatDate(platformNews[0].publish_time) }}</time>
                  </div>
                </article>

                <!-- 侧边栏：两个中等卡片垂直排列 -->
                <div class="news-magazine__sidebar">
                  <article 
                    v-for="(news, index) in platformNews.slice(1, 3)"
                    :key="news.news_id || index"
                    class="news-side"
                    @click="handleNewsClick(news, 'platform')"
                  >
                    <div class="news-side__image">
                      <img
                        :src="news.cover_image || '/images/logo.svg'"
                        :alt="news.title"
                        @error="handleImageError($event, news)"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                    <div class="news-side__content">
                      <span class="news-side__tag">{{ t('home.hardcoded.news') }}</span>
                      <h3 class="news-side__title">{{ news.title }}</h3>
                      <p class="news-side__summary">{{ news.summary || news.title }}</p>
                      <time class="news-side__time">{{ formatDate(news.publish_time) }}</time>
                    </div>
                  </article>
                </div>
              </div>

              <!-- 底部列表：横向 4 列 -->
              <div class="news-magazine__list">
                <article 
                  v-for="(news, index) in platformNews.slice(3, 7)"
                  :key="news.news_id || index"
                  class="news-list-item"
                  @click="handleNewsClick(news, 'platform')"
                >
                  <div class="news-list-item__indicator"></div>
                  <div class="news-list-item__content">
                    <h4 class="news-list-item__title">{{ news.title }}</h4>
                    <time class="news-list-item__time">{{ formatDate(news.publish_time) }}</time>
                  </div>
                  <div class="news-list-item__arrow">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                </article>
              </div>
            </div>
          </div>

          <!-- 外部AI新闻（来自 /information/list 接口） -->
          <div v-else key="external" class="news-section__content">
            <div v-if="industryNewsError && industryNewsForDisplay.length === 0" class="news-section__empty">
              <el-empty :description="t('common.errors.loadFailed')" />
              <el-button type="primary" plain @click="retryLoadIndustryNews">{{ t('common.refresh') }}</el-button>
            </div>
            <div v-else-if="industryNewsForDisplay.length === 0" class="news-section__empty">
              <el-empty :description="t('home.page3.empty.external')" />
            </div>
            <div v-else class="news-magazine">
              <!-- 主内容区域：大卡片 + 侧边栏 -->
              <div class="news-magazine__main">
                <!-- 主要新闻 - 大卡片（文字叠加在图片上） -->
                <article 
                  v-if="industryNewsForDisplay[0]"
                  class="news-hero"
                  @click="handleNewsClick(industryNewsForDisplay[0], 'external')"
                >
                  <div class="news-hero__image">
                    <img 
                      :src="industryNewsForDisplay[0].cover || '/images/logo.svg'" 
                      :alt="industryNewsForDisplay[0].title"
                      @error="handleImageError($event, industryNewsForDisplay[0])"
                      loading="lazy"
                    />
                    <div class="news-hero__gradient"></div>
                  </div>
                  <div class="news-hero__content">
                    <span class="news-hero__tag">{{ t('home.hardcoded.aiNews') }}</span>
                    <h3 class="news-hero__title">{{ industryNewsForDisplay[0].title }}</h3>
                    <p class="news-hero__summary">{{ industryNewsForDisplay[0].summary || industryNewsForDisplay[0].title }}</p>
                    <time class="news-hero__time">{{ industryNewsForDisplay[0].time || industryNewsForDisplay[0].publishTime }}</time>
                  </div>
                </article>

                <!-- 侧边栏：两个中等卡片垂直排列 -->
                <div class="news-magazine__sidebar">
                  <article 
                    v-for="(news, index) in industryNewsForDisplay.slice(1, 3)"
                    :key="news.id || index"
                    class="news-side"
                    @click="handleNewsClick(news, 'external')"
                  >
                    <div class="news-side__image">
                      <img 
                        :src="news.cover || '/images/logo.svg'" 
                        :alt="news.title"
                        @error="handleImageError($event, news)"
                        loading="lazy"
                      />
                    </div>
                    <div class="news-side__content">
                      <span class="news-side__tag">{{ t('home.hardcoded.news') }}</span>
                      <h3 class="news-side__title">{{ news.title }}</h3>
                      <p class="news-side__summary">{{ news.summary || news.title }}</p>
                      <time class="news-side__time">{{ news.time || news.publishTime }}</time>
                    </div>
                  </article>
                </div>
              </div>

              <!-- 底部列表：横向 4 列 -->
              <div class="news-magazine__list">
                <article 
                  v-for="(news, index) in industryNewsForDisplay.slice(3, 7)"
                  :key="news.id || index"
                  class="news-list-item"
                  @click="handleNewsClick(news, 'external')"
                >
                  <div class="news-list-item__indicator"></div>
                  <div class="news-list-item__content">
                    <h4 class="news-list-item__title">{{ news.title }}</h4>
                    <time class="news-list-item__time">{{ news.time || news.publishTime }}</time>
                  </div>
                  <div class="news-list-item__arrow">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                </article>
              </div>
            </div>
          </div>
        </transition>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { getProxiedImageUrl, switchImageProxy } from '@/utils/imageProxy'
import { logger } from '@/utils/logger'
import { useNews } from '@/composables/useNews'
import { loadModule, getCurrentLocale } from '@/locales'
import type { PlatformNewsItem, ExternalNewsItem } from '@/composables/useNews'

const { t } = useI18n()

defineOptions({
  name: 'HomePage3',
  inheritAttrs: false,
})

const {
  platformNews,
  externalNews,
  industryNewsFromApi,
  industryNewsError,
  loadPlatformNews,
  loadExternalNews,
  loadIndustryNewsFromApi,
  formatDate,
  loading,
} = useNews()

// AI资讯：优先使用 /information/list 接口数据，无数据时回退到 externalNews
const industryNewsForDisplay = computed(() =>
  industryNewsFromApi.value.length > 0 ? industryNewsFromApi.value : externalNews.value
)

const pageSlideRef = ref<HTMLElement | null>(null)
const activeTab = ref<'platform' | 'external'>('external')

// 处理图片加载错误
const handleImageError = (event: Event, _news: PlatformNewsItem | ExternalNewsItem) => {
  const img = event.target as HTMLImageElement
  const logoImage = '/images/logo.svg'
  const fallbackImage = '/images/APP.jpg'
  
  // 如果当前是代理图片，尝试切换到下一个代理
  if (img.src.includes('images.weserv.nl') || 
      img.src.includes('corsproxy.io') || 
      img.src.includes('allorigins.win')) {
    // 切换代理并重新加载
    switchImageProxy()
    const originalUrl = img.dataset.originalUrl
    if (originalUrl) {
      img.src = getProxiedImageUrl(originalUrl)
      return
    }
  }
  
  // 如果当前不是logo，尝试使用logo
  if (!img.src.includes('logo.svg') && !img.src.includes('APP.jpg')) {
    img.src = logoImage
  } 
  // 如果logo也加载失败，尝试使用APP.jpg
  else if (img.src.includes('logo.svg') && !img.dataset.fallbackApplied) {
    img.dataset.fallbackApplied = '1'
    img.src = fallbackImage
  }
  // 如果都失败了，保持显示logo（不隐藏容器）
  // 容器始终显示，确保布局稳定
}

// 处理新闻点击
const handleNewsClick = (news: PlatformNewsItem | ExternalNewsItem, type: 'platform' | 'external') => {
  if (type === 'external' && 'url' in news && news.url) {
    window.open(news.url, '_blank')
  } else if (type === 'platform' && 'news_id' in news) {
    ElMessage.info(t('home3.viewNews', { title: news.title }))
  }
}

// 重试加载行业资讯
const retryLoadIndustryNews = () => {
  loadIndustryNewsFromApi()
}

onMounted(async () => {
  // 加载 home 模块的语言包
  try {
    await loadModule(getCurrentLocale(), 'home')
  } catch (e) {
    logger.warn('[HomePage3] Failed to load home module:', e)
  }

  try {
    // 初始化定时任务调度器
    try {
      const schedulerModule = await import('@/services/news-scheduler').catch(() => null)
      if (schedulerModule && schedulerModule.startScheduler) {
        schedulerModule.startScheduler()
      }
    } catch (schedulerError) {
      logger.warn(t('common.errors.operationFailed'), schedulerError)
    }

    // 加载新闻数据
    try {
      await loadPlatformNews()
    } catch (err) {
      logger.error('Failed to load platform news:', err)
    }
    try {
      await loadIndustryNewsFromApi()
    } catch (err) {
      logger.error(t('common.errors.fetchFailed'), err)
    }
    try {
      await loadExternalNews()
    } catch (err) {
      logger.warn('Failed to load local industry news', err)
    }
  } catch (error) {
    logger.error('Component initialization failed:', error)
  }
})

defineExpose({
  $el: pageSlideRef,
})
</script>

<style scoped lang="scss">
/* ============================================
   新闻模块 - 现代化 Bento Grid 设计
   遵循项目设计语言规范，使用 BEM 命名
   ============================================ */

.third-page-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  min-height: auto;
  padding: 0 clamp(16px, 4vw, 40px);
  position: relative;
  box-sizing: border-box;
}

/* ============================================
   新闻区块 - 紧凑型布局
   ============================================ */
.news-section {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;

  /* 头部：标题居中 + Tab 居中（两行） */
  &__header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    text-align: center;
  }

  /* 左侧：标题 + 描述（居中） */
  &__left {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  /* 英文副标题（在中文标题下方） */
  &__title-en {
    font-size: clamp(12px, 1.5vw, 14px);
    font-weight: 500;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: var(--el-text-color-secondary);
    margin: 4px 0 0;
    text-align: center;
    opacity: 0.7;

    html.dark & {
      color: var(--color-white-50);
    }
  }

  &__title {
    font-size: clamp(28px, 4vw, 40px);
    font-weight: 700;
    margin: 0;
    color: var(--el-text-color-primary);
    letter-spacing: -0.02em;
    line-height: 1.2;

    html.dark & {
      color: hsl(var(--foreground, 0 0% 98%));
    }
  }

  /* 分隔线（隐藏） */
  &__divider {
    display: none;
  }

  &__subtitle {
    font-size: 15px;
    color: var(--el-text-color-secondary);
    margin: 0;
    line-height: 1.5;
    opacity: 0.8;

    html.dark & {
      color: hsl(var(--muted-foreground, 0 0% 64%));
    }
  }

  &__content {
    width: 100%;
  }

  &__loading,
  &__empty {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 300px;
  }
}

/* ============================================
   标签切换
   ============================================ */
.news-tabs {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  background: hsl(var(--muted, 0 0% 96%));
  border-radius: var(--global-border-radius);

  html.dark & {
    background: hsl(0deg 0% 12%);
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
      color: hsl(var(--muted-foreground, 0 0% 64%));
    }

    &:hover:not(&--active) {
      color: var(--el-text-color-primary);
      background: hsl(var(--background, 0 0% 100%));

      html.dark & {
        color: hsl(var(--foreground, 0 0% 98%));
        background: hsl(0deg 0% 18%);
      }
    }

    &--active {
      color: var(--el-text-color-primary);
      background: hsl(var(--background, 0 0% 100%));
      border: var(--unified-border);

      html.dark & {
        color: hsl(var(--foreground, 0 0% 98%));
        background: hsl(0deg 0% 18%);
        border-color: hsl(0deg 0% 25%);
      }
    }
  }
}

/* ============================================
   骨架屏加载 - Magazine 布局
   ============================================ */
.news-skeleton {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;

  &__item {
    background: linear-gradient(
      90deg,
      hsl(var(--muted, 0 0% 96%)) 0%,
      hsl(var(--background, 0 0% 100%)) 50%,
      hsl(var(--muted, 0 0% 96%)) 100%
    );
    background-size: 200% 100%;
    animation: skeleton-pulse 1.5s ease-in-out infinite;
    border-radius: var(--global-border-radius);
    will-change: background-position;

    html.dark & {
      background: linear-gradient(
        90deg,
        hsl(0deg 0% 12%) 0%,
        hsl(0deg 0% 16%) 50%,
        hsl(0deg 0% 12%) 100%
      );
      background-size: 200% 100%;
    }

    /* 第一个 - 大卡片 */
    &:nth-child(1) {
      height: 420px;
      border-radius: var(--global-border-radius);
    }

    /* 第二、三个 - 侧边卡片 */
    &:nth-child(2),
    &:nth-child(3) {
      height: 200px;
    }

    /* 底部列表 */
    &:nth-child(4) {
      height: 80px;
    }
  }
}

@keyframes skeleton-pulse {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ============================================
   过渡动画
   ============================================ */
.news-fade-enter-active,
.news-fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.news-fade-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.news-fade-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}

/* ============================================
   Magazine 杂志风格布局 - 紧凑版
   ============================================ */
.news-magazine {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;

  /* 主内容区域：大卡片 + 侧边栏 */
  &__main {
    display: grid;
    grid-template-columns: 1.6fr 1fr;
    gap: 16px;

    @media (width <= 1024px) {
      grid-template-columns: 1fr;
    }
  }

  /* 侧边栏：两个中等卡片垂直排列 */
  &__sidebar {
    display: flex;
    flex-direction: column;
    gap: 16px;

    @media (width <= 1024px) {
      flex-direction: row;
    }

    @media (width <= 640px) {
      flex-direction: column;
    }
  }

  /* 底部列表：横向 4 列 */
  &__list {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;

    @media (width <= 1024px) {
      grid-template-columns: repeat(2, 1fr);
    }

    @media (width <= 640px) {
      grid-template-columns: 1fr;
    }
  }
}

/* ============================================
   Hero 大卡片 - 文字叠加在图片上（紧凑版）
   ============================================ */
.news-hero {
  position: relative;
  border-radius: var(--global-border-radius);
  overflow: hidden;
  cursor: pointer;
  min-height: 340px;
  background: hsl(var(--card, 0 0% 100%));
  border: var(--unified-border);
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.4s ease;

  html.dark & {
    background: hsl(0deg 0% 9%);
    border-color: hsl(0deg 0% 15%);
  }

  @media (width <= 1024px) {
    min-height: 300px;
  }

  @media (width <= 640px) {
    min-height: 240px;
  }

  &:hover {
    transform: translateY(-6px);
    border-color: hsl(var(--border, 0 0% 75%));

    html.dark & {
      border-color: hsl(0deg 0% 30%);
    }

    .news-hero__image img {
      transform: scale(1.08);
    }

    .news-hero__gradient {
      opacity: 0.95;
    }
  }

  /* 图片 - 全覆盖 */
  &__image {
    position: absolute;
    inset: 0;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    }
  }

  /* 渐变遮罩 - 从底部向上 */
  &__gradient {
    position: absolute;
    inset: 0;
    background: var(--color-black-50);
    transition: opacity 0.4s ease;
  }

  /* 内容 - 底部叠加（紧凑版） */
  &__content {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: var(--z-base);

    @media (width <= 640px) {
      padding: 16px;
      gap: 6px;
    }
  }

  &__tag {
    display: inline-flex;
    align-items: center;
    padding: 4px 10px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: hsl(var(--foreground));
    background: hsl(var(--card));
    border-radius: var(--global-border-radius);
    width: fit-content;
    text-transform: uppercase;
  }

  &__title {
    font-size: clamp(18px, 2.5vw, 24px);
    font-weight: 700;
    color: var(--el-text-color-primary);
    margin: 0;
    line-height: 1.3;
    letter-spacing: -0.02em;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;

    html.dark & {
      color: var(--el-text-color-primary);
    }
  }

  &__summary {
    font-size: 14px;
    color: var(--color-white-85);
    margin: 0;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;

    @media (width <= 640px) {
      font-size: 13px;
      -webkit-line-clamp: 1;
    }
  }

  &__time {
    font-size: 12px;
    color: var(--color-white-70);
  }
}

/* ============================================
   Side 侧边卡片 - 超紧凑设计
   ============================================ */
.news-side {
  position: relative;
  display: flex;
  flex-direction: column;
  background: hsl(var(--card, 0 0% 100%));
  border-radius: var(--global-border-radius);
  overflow: hidden;
  cursor: pointer;
  border: var(--unified-border);
  transition: transform 0.3s ease, border-color 0.3s ease;
  flex: 1;

  html.dark & {
    background: hsl(0deg 0% 9%);
    border-color: hsl(0deg 0% 15%);
  }

  @media (width <= 1024px) {
    flex: 1;
  }

  &:hover {
    transform: translateY(-3px);
    border-color: hsl(var(--border, 0 0% 80%));

    html.dark & {
      border-color: hsl(0deg 0% 28%);
    }

    .news-side__image img {
      transform: scale(1.05);
    }
  }

  /* 图片区域 - 更紧凑 */
  &__image {
    position: relative;
    width: 100%;
    height: 100px;
    overflow: hidden;
    background: hsl(var(--muted, 0 0% 96%));

    html.dark & {
      background: hsl(0deg 0% 12%);
    }

    @media (width <= 1024px) {
      height: 120px;
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.4s ease;
    }
  }

  /* 内容区域 - 更紧凑 */
  &__content {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px;
    flex: 1;

    @media (width <= 640px) {
      padding: 10px;
    }
  }

  &__tag {
    display: inline-flex;
    align-items: center;
    padding: 3px 8px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: hsl(var(--foreground));
    background: hsl(var(--muted));
    border-radius: var(--global-border-radius);
    width: fit-content;
    text-transform: uppercase;
  }

  &__title {
    font-size: 14px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    margin: 0;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;

    html.dark & {
      color: hsl(var(--foreground, 0 0% 98%));
    }
  }

  &__summary {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    margin: 0;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;

    html.dark & {
      color: hsl(var(--muted-foreground, 0 0% 64%));
    }
  }

  &__time {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    opacity: 0.7;
    margin-top: auto;

    html.dark & {
      color: hsl(var(--muted-foreground, 0 0% 64%));
    }
  }
}

/* ============================================
   List Item 列表卡片 - 紧凑横向排列
   ============================================ */
.news-list-item {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  background: hsl(var(--card));
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
  cursor: pointer;
  transition: all 0.25s ease;

  &:hover {
    background: hsl(var(--muted));
    border-color: hsl(var(--border));
    transform: translateY(-2px);

    .news-list-item__arrow {
      transform: translateX(3px);
      color: var(--el-text-color-primary);
    }

    .news-list-item__indicator {
      background: var(--el-color-primary);
    }
  }

  /* 左侧指示器 */
  &__indicator {
    flex-shrink: 0;
    width: 3px;
    height: 100%;
    min-height: 32px;
    background: hsl(var(--border));
    border-radius: var(--global-border-radius);
    transition: background 0.25s ease;
  }

  /* 内容区域 */
  &__content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__title {
    font-size: 13px;
    font-weight: 500;
    color: var(--el-text-color-primary);
    margin: 0;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;

    html.dark & {
      color: hsl(var(--foreground, 0 0% 98%));
    }
  }

  &__time {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    opacity: 0.7;

    html.dark & {
      color: hsl(var(--muted-foreground, 0 0% 64%));
    }
  }

  /* 右侧箭头 */
  &__arrow {
    flex-shrink: 0;
    color: var(--el-text-color-secondary);
    opacity: 0.5;
    transition: transform 0.25s ease, color 0.25s ease, opacity 0.25s ease;
    align-self: center;

    svg {
      width: 14px;
      height: 14px;
    }

    html.dark & {
      color: hsl(var(--muted-foreground, 0 0% 64%));
    }
  }
}

/* ============================================
   响应式适配
   ============================================ */
@media (width <= 768px) {
  .third-page-content {
    padding: 60px 12px 30px;
  }

  .news-section__header {
    margin-bottom: 16px;
  }

  .news-section__title {
    font-size: clamp(24px, 5vw, 32px);
  }

  .news-tabs__item {
    padding: 8px 16px;
    min-height: 40px;
    font-size: 13px;
  }

  .news-magazine__main {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .news-magazine__sidebar {
    flex-direction: column;
    gap: 12px;
  }

  .news-hero {
    min-height: 200px;
  }

  .news-side__image {
    height: 80px;
  }

  .news-magazine__list {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .news-skeleton {
    &__item {
      &:nth-child(1) {
        height: 280px;
      }

      &:nth-child(2),
      &:nth-child(3) {
        height: 160px;
      }
    }
  }

  .news-list-item {
    padding: 14px;
  }
}
</style>
