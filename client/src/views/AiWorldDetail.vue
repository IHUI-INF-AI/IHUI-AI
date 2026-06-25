<template>
  <div class="ai-world-page">
    <div class="ai-world-page__bg" />

    <div class="ai-world-page__wrap">
      <div class="ai-world-page__container">
        <!-- 加载中 -->
        <div v-if="loading" class="ai-world-page__loading">
          <span>{{ t('aiWorld.loading') }}</span>
        </div>

        <!-- 站点不存在 -->
        <div v-else-if="!site" class="ai-world-page__empty">
          <p>{{ t('aiWorld.empty') }}</p>
        </div>

        <!-- 详情内容 -->
        <template v-else>
          <header class="ai-world-page__detail-header">
            <button type="button" class="ai-world-page__back-btn" @click="handleBack">
              {{ t('aiWorld.back') }}
            </button>
            <h2 class="ai-world-page__detail-title">{{ site.name }}</h2>
          </header>

          <!-- 站点头部：图标 + 名称 + 描述 + 官方链接 -->
          <section class="ai-world-detail__head">
            <div class="ai-world-detail__icon-wrap">
              <img
                :src="site.iconUrl || `${baseUrl}images/common/empty.svg`"
                :alt="site.name"
                class="ai-world-detail__icon"
                loading="lazy"
                @error="handleImageError"
              />
            </div>
            <div class="ai-world-detail__info">
              <h1 class="ai-world-detail__name">{{ site.name }}</h1>
              <p v-if="site.shortDesc" class="ai-world-detail__desc">{{ site.shortDesc }}</p>
              <div class="ai-world-detail__meta">
                <span v-if="site.section" class="ai-world-detail__tag">{{ site.section }}</span>
                <a
                  v-if="site.officialUrl"
                  :href="site.officialUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="ai-world-detail__link"
                >
                  {{ t('aiWorld.goToOfficial') }}
                </a>
              </div>
            </div>
          </section>

          <!-- 富文本内容区 -->
          <section v-if="site.panelHtml" class="ai-world-detail__panel">
            <div class="ai-world-detail__panel-inner" v-html="sanitizeHtml(site.panelHtml)" />
          </section>
          <section v-else class="ai-world-detail__panel">
            <p class="ai-world-detail__panel-empty">{{ t('aiWorld.detailEmpty') }}</p>
          </section>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { logger } from '@/utils/logger'
import { getAiWorldSiteById } from '@/api/ai/ai/ai-world'
import type { AiBotSite } from '@/api/ai/ai/ai-world'
import { updateMetaTags, setStructuredData, generatePageStructuredData, truncateDescription } from '@/utils/seo'
import { sanitizeHtml } from '@/utils/htmlSanitizer'

defineOptions({
  name: 'AiWorldDetail',
})

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const baseUrl = import.meta.env.BASE_URL || '/'

const site = ref<AiBotSite | null>(null)
const loading = ref(true)
const defaultTitle = document.title

function applySEO(s: AiBotSite | null) {
  if (!s) {
    document.title = defaultTitle
    return
  }
  const desc = truncateDescription(s.shortDesc || s.name || '', 160)
  const url = window.location.href
  const image = s.iconUrl || ''
  updateMetaTags({
    title: `${s.name} - ${t('aiWorld.title')}`,
    description: desc,
    keywords: `${s.name},${s.section || 'AI'},AI世界`,
    ogTitle: s.name,
    ogDescription: desc,
    ogImage: image,
    ogUrl: url,
    canonical: url,
  })
  setStructuredData(generatePageStructuredData({
    title: s.name,
    description: desc,
    url,
    image,
    type: 'Article',
  }))
}

async function loadSite() {
  const id = String(route.params.id || '')
  if (!id) {
    site.value = null
    loading.value = false
    return
  }
  loading.value = true
  try {
    site.value = await getAiWorldSiteById(id)
    applySEO(site.value)
  } catch (e) {
    logger.error('[AiWorldDetail] 加载站点详情失败:', e)
    site.value = null
  } finally {
    loading.value = false
  }
}

function handleBack() {
  router.push({ name: 'aiWorld' })
}

function handleImageError(e: Event) {
  const el = e.target as HTMLImageElement
  if (el) el.src = `${baseUrl}images/common/empty.svg`
}

onMounted(loadSite)
watch(() => route.params.id, loadSite)
onUnmounted(() => {
  document.title = defaultTitle
})
</script>

<style lang="scss" scoped>
@use '@/styles/_breakpoints.scss' as bp;

/* 颜色变量：与 AiWorld.vue 保持一致 */
$aw-gray-page: var(--color-neutral-100);
$aw-panel-bg: var(--el-bg-color);
$aw-gray-card: var(--color-gray-fafafa);
$aw-gray-elevated: var(--color-gray-e8e8e8);
$aw-gray-border: var(--color-text-muted);

.ai-world-page {
  --ai-world-page-bg: #{$aw-gray-page};
  --ai-world-panel-bg: #{$aw-panel-bg};

  min-height: 100vh;
  background-color: var(--ai-world-page-bg);
  color: var(--el-text-color-primary);
  position: relative;
  overflow-x: hidden;
}

.ai-world-page__bg {
  position: absolute;
  inset: 0;
  z-index: var(--z-0);
  pointer-events: none;
  background-color: var(--ai-world-page-bg);
}

.ai-world-page__wrap {
  position: relative;
  z-index: var(--z-base);
  width: 100%;
  min-height: 100vh;
}

.ai-world-page__container {
  position: relative;
  width: 100%;
  /* 顶部留白避开固定 glass-header（60px）+ 10px 间距 */
  padding: calc(var(--global-header-height) + 10px) 24px 48px;
  box-sizing: border-box;
  background-color: var(--ai-world-panel-bg);
  margin-top: 10px;
  margin-right: 10px;
  margin-bottom: 10px;
  border-radius: var(--global-border-radius);
  border: var(--unified-border);

  @include bp.tablet-down {
    padding: 16px 16px 32px;
    margin-right: 0;
    margin-bottom: 0;
  }
}

.ai-world-page__detail-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.ai-world-page__back-btn {
  flex-shrink: 0;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-regular);
  background: $aw-gray-elevated;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  cursor: pointer;
  font-family: inherit;
  transition: color 0.2s ease, background 0.2s ease, border-color 0.2s ease;

  &:hover {
    color: var(--el-text-color-primary);
    background: var(--color-text-muted);
    border-color: $aw-gray-border;
  }
}

.ai-world-page__detail-title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--el-text-color-primary);
  margin: 0;
  min-width: 0;
}

.ai-world-page__loading,
.ai-world-page__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 64px 24px;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

/* 站点头部：图标 + 信息 */
.ai-world-detail__head {
  display: flex;
  align-items: flex-start;
  gap: 20px;
  padding: 24px;
  background: $aw-gray-card;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  margin-bottom: 24px;

  @include bp.tablet-down {
    flex-direction: column;
    gap: 16px;
    padding: 16px;
  }
}

.ai-world-detail__icon-wrap {
  width: 80px;
  height: 80px;
  flex-shrink: 0;
  border-radius: var(--global-border-radius);
  overflow: hidden;
  background: $aw-gray-elevated;

  @include bp.tablet-down {
    width: 64px;
    height: 64px;
  }
}

.ai-world-detail__icon {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.ai-world-detail__info {
  flex: 1;
  min-width: 0;
}

.ai-world-detail__name {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--el-text-color-primary);
  margin: 0 0 8px;
  line-height: 1.3;
}

.ai-world-detail__desc {
  font-size: 14px;
  font-weight: 400;
  color: var(--el-text-color-regular);
  margin: 0 0 12px;
  line-height: 1.6;
}

.ai-world-detail__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.ai-world-detail__tag {
  display: inline-block;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--el-text-color-regular);
  background: $aw-gray-elevated;
  border-radius: var(--global-border-radius);
}

.ai-world-detail__link {
  display: inline-block;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--el-bg-color-page);
  background: var(--el-color-primary);
  border-radius: var(--global-border-radius);
  text-decoration: none;
  transition: background 0.2s ease;

  &:hover {
    background: var(--el-color-primary-dark-2);
  }
}

/* 富文本内容区 */
.ai-world-detail__panel {
  padding: 24px;
  background: $aw-gray-card;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);

  @include bp.tablet-down {
    padding: 16px;
  }
}

.ai-world-detail__panel-inner {
  font-size: 14px;
  line-height: 1.8;
  color: var(--el-text-color-primary);
  word-break: break-word;

  :deep(h1),
  :deep(h2),
  :deep(h3) {
    color: var(--el-text-color-primary);
    margin: 16px 0 8px;
    font-weight: 600;
  }

  :deep(p) {
    margin: 8px 0;
  }

  :deep(a) {
    color: var(--el-color-primary);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  :deep(img) {
    max-width: 100%;
    height: auto;
    border-radius: var(--global-border-radius);
  }

  :deep(ul),
  :deep(ol) {
    padding-left: 20px;
    margin: 8px 0;
  }

  :deep(code) {
    padding: 2px 6px;
    font-size: 13px;
    background: $aw-gray-elevated;
    border-radius: var(--global-border-radius);
  }
}

.ai-world-detail__panel-empty {
  margin: 0;
  padding: 32px 0;
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}
</style>

<!-- 全局：暗色模式覆盖（使用 :where(html.dark) 降低特异性） -->
<style lang="scss">
:where(html.dark) .ai-world-detail__head {
  background: var(--color-white-8);
  border-color: var(--el-border-color);
}

:where(html.dark) .ai-world-detail__icon-wrap {
  background: var(--el-fill-color-dark);
}

:where(html.dark) .ai-world-detail__tag {
  color: var(--el-text-color-regular);
  background: var(--color-white-6);
}

:where(html.dark) .ai-world-detail__panel {
  background: var(--color-white-8);
  border-color: var(--el-border-color);
}

:where(html.dark) .ai-world-detail__panel-inner code {
  background: var(--el-fill-color-dark);
}
</style>
