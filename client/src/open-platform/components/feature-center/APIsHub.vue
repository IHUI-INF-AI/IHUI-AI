<template>
  <div class="apis-hub">
    <!-- 英雄区域 -->
    <section class="hero-section">
      <div class="hero-content">
        <div class="hero-badge">
          <el-icon><Connection /></el-icon>
          <span>{{ t('openPlatform.apis.badge') }}</span>
        </div>
        <h1 class="hero-title">{{ t('openPlatform.apis.title') }}</h1>
        <p class="hero-description">{{ t('openPlatform.apis.subtitle') }}</p>
        <div class="hero-actions">
          <el-button type="primary" size="large" @click="goToApiDocumentation" class="action-btn primary-btn">
            <el-icon><Document /></el-icon>
            {{ t('openPlatform.apis.viewFullDocs') }}
          </el-button>
          <el-button size="large" @click="goToApiTokens" class="action-btn secondary-btn">
            <el-icon><Key /></el-icon>
            {{ t('openPlatform.apis.getApiKey') }}
          </el-button>
        </div>
      </div>
      <div class="hero-decoration">
        <div class="decoration-orb orb-1"></div>
        <div class="decoration-orb orb-2"></div>
        <div class="code-preview">
          <div class="code-header">
            <span class="code-dot red"></span>
            <span class="code-dot yellow"></span>
            <span class="code-dot green"></span>
          </div>
          <pre class="code-content"><code><span class="code-keyword">curl</span> -X POST \
  {{ apiBaseUrl }}/v1/chat/completions \
  -H <span class="code-string">"Authorization: Bearer YOUR_API_KEY"</span> \
  -d <span class="code-string">'{"model": "gpt-4", "messages": [...]}'</span></code></pre>
        </div>
      </div>
    </section>

    <!-- API 分类 -->
    <section class="categories-section">
      <div class="section-header">
        <h2 class="section-title">{{ t('openPlatform.apis.categoriesTitle') }}</h2>
        <p class="section-subtitle">{{ t('openPlatform.apis.categoriesSubtitle') }}</p>
      </div>
      <div class="categories-grid">
        <div
          v-for="category in apiCategories"
          :key="category.id"
          class="category-card"
          @click="handleCategoryClick(category)"
        >
          <div class="card-icon" :style="{ '--icon-color': category.color }">
            <el-icon :size="28">
              <component :is="category.icon" />
            </el-icon>
          </div>
          <div class="card-content">
            <h3 class="card-title">{{ category.name }}</h3>
            <p class="card-description">{{ category.description }}</p>
          </div>
          <div class="card-footer">
            <span class="view-docs-link">
              {{ t('openPlatform.apis.viewDocs') }}
              <el-icon><ArrowRight /></el-icon>
            </span>
          </div>
          <div class="card-hover-indicator"></div>
        </div>
      </div>
    </section>

    <!-- 快速链接 -->
    <section class="quick-links-section">
      <div class="section-header">
        <h2 class="section-title">{{ t('openPlatform.apis.quickLinks.title') }}</h2>
        <p class="section-subtitle">{{ t('openPlatform.apis.quickLinksSubtitle') }}</p>
      </div>
      <div class="links-grid">
        <div
          v-for="link in quickLinks"
          :key="link.id"
          class="link-card"
          @click="handleQuickLink(link)"
        >
          <div class="link-icon" :style="{ '--link-color': link.color }">
            <el-icon :size="22">
              <component :is="link.icon" />
            </el-icon>
          </div>
          <div class="link-content">
            <h4 class="link-title">{{ link.title }}</h4>
            <p class="link-description">{{ link.description }}</p>
          </div>
          <el-icon class="link-arrow"><ArrowRight /></el-icon>
        </div>
      </div>
    </section>

    <!-- API 使用统计预览 -->
    <section class="stats-preview-section">
      <div class="stats-card">
        <div class="stats-header">
          <h3 class="stats-title">{{ t('openPlatform.apis.statsTitle') }}</h3>
          <p class="stats-subtitle">{{ t('openPlatform.apis.statsSubtitle') }}</p>
        </div>
        <div class="steps-grid">
          <div class="step-item">
            <div class="step-number">1</div>
            <div class="step-content">
              <h4>{{ t('openPlatform.apis.step1Title') }}</h4>
              <p>{{ t('openPlatform.apis.step1Desc') }}</p>
            </div>
          </div>
          <div class="step-connector">
            <div class="connector-line"></div>
          </div>
          <div class="step-item">
            <div class="step-number">2</div>
            <div class="step-content">
              <h4>{{ t('openPlatform.apis.step2Title') }}</h4>
              <p>{{ t('openPlatform.apis.step2Desc') }}</p>
            </div>
          </div>
          <div class="step-connector">
            <div class="connector-line"></div>
          </div>
          <div class="step-item">
            <div class="step-number">3</div>
            <div class="step-content">
              <h4>{{ t('openPlatform.apis.step3Title') }}</h4>
              <p>{{ t('openPlatform.apis.step3Desc') }}</p>
            </div>
          </div>
        </div>
        <div class="stats-actions">
          <el-button type="primary" @click="goToApiTokens">
            {{ t('openPlatform.apis.getStarted') }}
            <el-icon><ArrowRight /></el-icon>
          </el-button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, markRaw, type Component } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  Connection,
  ChatDotRound,
  Picture,
  Cpu,
  Document,
  Key,
  InfoFilled,
  Lock,
  Warning,
  Wallet,
  Box,
  ArrowRight,
} from '@element-plus/icons-vue'

const { t } = useI18n()
const router = useRouter()

// 使用 markRaw 标记图标组件，避免被包装为响应式对象
const icons = {
  InfoFilled: markRaw(InfoFilled),
  Lock: markRaw(Lock),
  Cpu: markRaw(Cpu),
  ChatDotRound: markRaw(ChatDotRound),
  Picture: markRaw(Picture),
  Connection: markRaw(Connection),
  Warning: markRaw(Warning),
  Wallet: markRaw(Wallet),
  Box: markRaw(Box),
}

// API 基础地址
const apiBaseUrl = computed(() => {
  return import.meta.env.VITE_API_BASE_URL || 'https://api.example.com'
})

// API 分类 - 带有个性化颜色（使用 computed 支持响应式翻译）
const apiCategories = computed(() => [
  {
    id: 'overview',
    name: t('apiDocs.nav.overview'),
    description: t('openPlatform.apis.categories.overview'),
    icon: icons.InfoFilled,
    section: 'overview',
    color: 'var(--color-indigo-600)', // Indigo
  },
  {
    id: 'authentication',
    name: t('apiDocs.nav.authentication'),
    description: t('openPlatform.apis.categories.authentication'),
    icon: icons.Lock,
    section: 'authentication',
    color: 'var(--el-text-color-primary)', // Violet
  },
  {
    id: 'models',
    name: t('apiDocs.nav.models'),
    description: t('openPlatform.apis.categories.models'),
    icon: icons.Cpu,
    section: 'models',
    color: 'var(--color-cyan-06b6d4)', // Cyan
  },
  {
    id: 'chat',
    name: t('apiDocs.nav.chatCompletions'),
    description: t('openPlatform.apis.categories.chat'),
    icon: icons.ChatDotRound,
    section: 'chat',
    color: 'var(--color-emerald-500)', // Emerald
  },
  {
    id: 'images',
    name: t('apiDocs.nav.imageGeneration'),
    description: t('openPlatform.apis.categories.images'),
    icon: icons.Picture,
    section: 'images',
    color: 'var(--color-amber-500)', // Amber
  },
  {
    id: 'endpoints',
    name: t('apiDocs.nav.endpoints'),
    description: t('openPlatform.apis.categories.endpoints'),
    icon: icons.Connection,
    section: 'endpoints',
    color: 'var(--color-red-ef4444)', // Red
  },
])

// 快速链接 - 带有颜色（使用 computed 支持响应式翻译）
const quickLinks = computed(() => [
  {
    id: 'error-handling',
    title: t('apiDocs.nav.errorHandling'),
    description: t('openPlatform.apis.quickLinks.errorHandling'),
    icon: icons.Warning,
    section: 'errors',
    color: 'var(--color-amber-500)',
  },
  {
    id: 'pricing',
    title: t('apiDocs.nav.pricing'),
    description: t('openPlatform.apis.quickLinks.pricing'),
    icon: icons.Wallet,
    section: 'pricing',
    color: 'var(--color-emerald-500)',
  },
  {
    id: 'sdks',
    title: t('apiDocs.nav.sdks'),
    description: t('openPlatform.apis.quickLinks.sdks'),
    icon: icons.Box,
    section: 'sdks',
    color: 'var(--color-indigo-600)',
  },
])

interface Category {
  id: string
  name: string
  description: string
  icon: Component
  section: string
  color: string
}

interface QuickLink {
  id: string
  title: string
  description: string
  icon: Component
  section: string
  color: string
}

// 操作
const handleCategoryClick = (category: Category) => {
  router.push(`/open/documents?section=${category.section}`)
}

const handleQuickLink = (link: QuickLink) => {
  router.push(`/open/documents?section=${link.section}`)
}

const goToApiDocumentation = () => {
  router.push('/open/documents')
}

const goToApiTokens = () => {
  router.push('/key-management')
}
</script>

<style scoped lang="scss">
.apis-hub {
  padding: clamp(1rem, 2vw, 2rem);
  max-width: 1400px;
  margin: 0 auto;
}

// ==================== 英雄区域 ====================
.hero-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: clamp(2rem, 4vw, 4rem);
  align-items: center;
  margin-bottom: clamp(3rem, 5vw, 5rem);
  padding: clamp(2rem, 4vw, 3rem);
  background: var(--el-fill-color-light);
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
  position: relative;
  overflow: hidden;

  @media (width <= 900px) {
    grid-template-columns: 1fr;
    text-align: center;
  }
}

.hero-content {
  position: relative;
  z-index: var(--z-base);
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.875rem;
  background: var(--el-color-primary-light-9);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--el-color-primary);
  margin-bottom: 1rem;

  @media (width <= 900px) {
    margin: 0 auto 1rem;
  }
}

.hero-title {
  margin: 0 0 1rem;
  font-size: clamp(1.75rem, 3vw, 2.5rem);
  font-weight: 700;
  color: var(--el-text-color-primary);
  line-height: 1.2;
}

.hero-description {
  margin: 0 0 1.5rem;
  font-size: clamp(0.9375rem, 1.5vw, 1.125rem);
  color: var(--el-text-color-secondary);
  line-height: 1.6;
  max-width: 480px;

  @media (width <= 900px) {
    margin-left: auto;
    margin-right: auto;
  }
}

.hero-actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;

  @media (width <= 900px) {
    justify-content: center;
  }
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  font-weight: 500;
  border-radius: var(--global-border-radius);
  transition: all 0.2s ease;

  &.primary-btn {
    &:hover {
      transform: translateY(-2px);
    }
  }

  &.secondary-btn {
    background: var(--el-bg-color);
    border-color: var(--el-border-color);
    color: var(--el-text-color-primary);

    &:hover {
      background: var(--el-fill-color-light);
      border-color: var(--el-border-color-darker);
    }
  }
}

// 装饰元素
.hero-decoration {
  position: relative;
  z-index: var(--z-base);

  @media (width <= 900px) {
    display: none;
  }
}

.decoration-orb {
  position: absolute;
  border-radius: var(--global-border-radius);
  filter: blur(60px);
  opacity: 0.4;

  &.orb-1 {
    width: 200px;
    height: 200px;
    background: var(--el-color-primary-light-5);
    top: -50px;
    right: -50px;
  }

  &.orb-2 {
    width: 150px;
    height: 150px;
    background: var(--el-color-success-light-5);
    bottom: -30px;
    left: 20px;
  }
}

.code-preview {
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
  overflow: hidden;
  position: relative;
}

.code-header {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--el-fill-color-light);
  border-bottom: var(--unified-border-bottom);
}

.code-dot {
  width: 12px;
  height: 12px;
  border-radius: var(--global-border-radius);

  &.red { background: var(--color-red-ff5f57); }
  &.yellow { background: var(--color-yellow-febc2e); }
  &.green { background: var(--color-green-28c840); }
}

.code-content {
  padding: 1rem 1.25rem;
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.7;
  overflow-x: auto;

  code {
    font-family: var(--font-family-mono);
    color: var(--el-text-color-regular);
  }
}

.code-keyword {
  color: var(--el-color-primary);
  font-weight: 600;
}

.code-string {
  color: var(--el-color-success);
}

// ==================== 通用区块样式 ====================
.section-header {
  text-align: center;
  margin-bottom: clamp(1.5rem, 3vw, 2.5rem);
}

.section-title {
  margin: 0 0 0.5rem;
  font-size: clamp(1.375rem, 2.5vw, 1.75rem);
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.section-subtitle {
  margin: 0;
  font-size: clamp(0.875rem, 1.2vw, 1rem);
  color: var(--el-text-color-secondary);
}

// ==================== API 分类卡片 ====================
.categories-section {
  margin-bottom: clamp(3rem, 5vw, 5rem);
}

.categories-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: clamp(1rem, 2vw, 1.5rem);
}

.category-card {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  cursor: pointer;
  transition: all 0.25s ease;
  overflow: hidden;

  &:hover {
    border-color: var(--el-border-color);
    transform: translateY(-4px);

    .card-hover-indicator {
      opacity: 1;
    }

    .view-docs-link {
      color: var(--el-color-primary);
    }
  }
}

.card-icon {
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--global-border-radius);
  margin-bottom: 1rem;
  background: color-mix(in srgb, var(--icon-color) 12%, transparent);
  color: var(--icon-color);
  transition: all 0.25s ease;
}

.card-content {
  flex: 1;
  margin-bottom: 1rem;
}

.card-title {
  margin: 0 0 0.5rem;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.card-description {
  margin: 0;
  font-size: 0.875rem;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.card-footer {
  padding-top: 1rem;
  border-top: var(--unified-border);
}

.view-docs-link {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--el-text-color-secondary);
  transition: color 0.2s ease;

  .el-icon {
    font-size: 0.875rem;
    transition: transform 0.2s ease;
  }

  &:hover .el-icon {
    transform: translateX(4px);
  }
}

.card-hover-indicator {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 3px;
  background: var(--icon-color);
  opacity: 0;
  transition: opacity 0.25s ease;
}

// ==================== 快速链接 ====================
.quick-links-section {
  margin-bottom: clamp(3rem, 5vw, 5rem);
}

.links-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: clamp(0.75rem, 1.5vw, 1rem);
}

.link-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--el-border-color);
    background: var(--el-fill-color-blank);

    .link-arrow {
      transform: translateX(4px);
      color: var(--el-color-primary);
    }
  }
}

.link-icon {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--global-border-radius);
  background: color-mix(in srgb, var(--link-color) 12%, transparent);
  color: var(--link-color);
}

.link-content {
  flex: 1;
  min-width: 0;
}

.link-title {
  margin: 0 0 0.25rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.link-description {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
}

.link-arrow {
  flex-shrink: 0;
  color: var(--el-text-color-placeholder);
  transition: all 0.2s ease;
}

// ==================== 快速开始区域 ====================
.stats-preview-section {
  margin-bottom: 2rem;
}

.stats-card {
  padding: clamp(2rem, 3vw, 3rem);
  background: var(--el-fill-color-light);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
}

.stats-header {
  text-align: center;
  margin-bottom: clamp(2rem, 3vw, 2.5rem);
}

.stats-title {
  margin: 0 0 0.5rem;
  font-size: clamp(1.25rem, 2vw, 1.5rem);
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.stats-subtitle {
  margin: 0;
  font-size: 0.9375rem;
  color: var(--el-text-color-secondary);
}

.steps-grid {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 0;
  margin-bottom: 2rem;

  @media (width <= 768px) {
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
  }
}

.step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  flex: 1;
  max-width: 240px;
  padding: 0 1rem;
}

.step-number {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-color-primary);
  color: var(--el-bg-color);
  font-size: 1.25rem;
  font-weight: 700;
  border-radius: var(--global-border-radius);
  margin-bottom: 1rem;
}

.step-content {
  h4 {
    margin: 0 0 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  p {
    margin: 0;
    font-size: 0.875rem;
    color: var(--el-text-color-secondary);
    line-height: 1.5;
  }
}

.step-connector {
  flex-shrink: 0;
  width: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 24px;

  @media (width <= 768px) {
    width: auto;
    height: 30px;
    padding-top: 0;

    .connector-line {
      width: 2px;
      height: 100%;
    }
  }
}

.connector-line {
  width: 100%;
  height: 2px;
  background: var(--el-color-primary-light-6);
  border-radius: var(--global-border-radius);

  @media (width <= 768px) {
    background: var(--el-color-primary-light-6);
  }
}

.stats-actions {
  display: flex;
  justify-content: center;

  .el-button {
    padding: 0.75rem 2rem;
    font-weight: 500;
    border-radius: var(--global-border-radius);

    .el-icon {
      margin-left: 0.375rem;
    }
  }
}

// ==================== 暗色模式适配 ====================
:global(html.dark) {
  .hero-section {
    background: hsl(var(--el-color-primary-h) 20% 10%);
  }

  .code-preview {
    background: var(--el-fill-color-darker);
  }

  .code-header {
    background: var(--el-fill-color-dark);
  }

  .category-card,
  .link-card {
    background: var(--el-fill-color-darker);
    border-color: var(--el-border-color-darker);

    &:hover {
      background: var(--el-fill-color-dark);
      border-color: var(--el-border-color);
    }
  }

  .stats-card {
    background: var(--el-fill-color-darker);
    border-color: var(--el-border-color-darker);
  }

  .decoration-orb {
    opacity: 0.2;
  }
}

// ==================== 响应式优化 ====================
@media (width <= 640px) {
  .apis-hub {
    padding: 1rem;
  }

  .hero-section {
    padding: 1.5rem;
  }

  .categories-grid {
    grid-template-columns: 1fr;
  }

  .links-grid {
    grid-template-columns: 1fr;
  }

  .stats-card {
    padding: 1.5rem;
  }
}
</style>
