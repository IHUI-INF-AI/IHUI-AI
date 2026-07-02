<template>
  <div class="dev-hub">
    <header class="dev-hub__header">
      <div class="dev-hub__title-row">
        <span class="dev-hub__badge">DEV</span>
        <h1 class="dev-hub__title">{{ t('devHub.title') }}</h1>
      </div>
      <p class="dev-hub__subtitle">{{ t('devHub.subtitle') }}</p>
      <p class="dev-hub__warning">
        <el-icon><Warning /></el-icon>
        <span>{{ t('devHub.warning') }}</span>
      </p>
    </header>

    <section class="dev-hub__section">
      <h2 class="dev-hub__section-title">{{ t('devHub.section.components') }}</h2>
      <div class="dev-hub__grid">
        <router-link
          v-for="card in componentCards"
          :key="card.path"
          :to="card.path"
          class="dev-hub__card"
        >
          <div class="dev-hub__card-icon" :style="{ background: card.color }">
            <el-icon :size="22"><component :is="card.icon" /></el-icon>
          </div>
          <div class="dev-hub__card-body">
            <h3 class="dev-hub__card-title">{{ card.title }}</h3>
            <p class="dev-hub__card-desc">{{ card.desc }}</p>
          </div>
          <el-icon class="dev-hub__card-arrow"><ArrowRight /></el-icon>
        </router-link>
      </div>
    </section>

    <section class="dev-hub__section">
      <h2 class="dev-hub__section-title">{{ t('devHub.section.docs') }}</h2>
      <div class="dev-hub__grid">
        <router-link
          v-for="card in docCards"
          :key="card.path"
          :to="card.path"
          class="dev-hub__card"
        >
          <div class="dev-hub__card-icon" :style="{ background: card.color }">
            <el-icon :size="22"><component :is="card.icon" /></el-icon>
          </div>
          <div class="dev-hub__card-body">
            <h3 class="dev-hub__card-title">{{ card.title }}</h3>
            <p class="dev-hub__card-desc">{{ card.desc }}</p>
          </div>
          <el-icon class="dev-hub__card-arrow"><ArrowRight /></el-icon>
        </router-link>
      </div>
    </section>

    <footer class="dev-hub__footer">
      <el-button @click="goHome">
        <el-icon><HomeFilled /></el-icon>
        <span>{{ t('devHub.backHome') }}</span>
      </el-button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Warning, ArrowRight, HomeFilled, Grid, Box, Files, Promotion, Connection } from '@element-plus/icons-vue'

const { t } = useI18n()
const router = useRouter()

const componentCards = [
  {
    path: '/dev/design-system',
    title: t('devHub.card.designSystem.title'),
    desc: t('devHub.card.designSystem.desc'),
    color: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    icon: Grid,
  },
  {
    path: '/dev/storybook',
    title: t('devHub.card.storybook.title'),
    desc: t('devHub.card.storybook.desc'),
    color: 'linear-gradient(135deg, #10b981, #14b8a6)',
    icon: Box,
  },
  {
    path: '/dev/aizhs-demo',
    title: t('devHub.card.aizhs.title'),
    desc: t('devHub.card.aizhs.desc'),
    color: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    icon: Promotion,
  },
  {
    path: '/dev/project-selector',
    title: t('devHub.card.projectSelector.title'),
    desc: t('devHub.card.projectSelector.desc'),
    // 2026-07-02 修复: 改用 var(--xxx) 注入, 避免硬编码 #2563eb
    color: 'linear-gradient(135deg, #0ea5e9, var(--color-cta-blue))',
    icon: Connection,
  },
]

const docCards = [
  {
    path: '/dev/business-docs',
    title: t('devHub.card.businessDocs.title'),
    desc: t('devHub.card.businessDocs.desc'),
    color: 'linear-gradient(135deg, #475569, #1e293b)',
    icon: Files,
  },
]

const goHome = () => {
  router.push('/')
}
</script>

<style scoped lang="scss">
.dev-hub {
  max-width: 1080px;
  margin: 0 auto;
  padding: 32px 24px 64px;
  color: var(--el-text-color-primary);
}

.dev-hub__header {
  margin-bottom: 32px;
}

.dev-hub__title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.dev-hub__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 22px;
  padding: 0 8px;
  background: var(--el-color-warning);
  color: #fff;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.dev-hub__title {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
}

.dev-hub__subtitle {
  margin: 4px 0 12px;
  color: var(--el-text-color-regular);
  font-size: 14px;
  line-height: 1.6;
}

.dev-hub__warning {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 8px 12px;
  background: var(--el-color-warning-light-9);
  border: 1px solid var(--el-color-warning-light-7);
  border-radius: var(--global-border-radius);
  color: var(--el-color-warning-dark-2);
  font-size: 13px;
}

.dev-hub__section {
  margin-bottom: 32px;
}

.dev-hub__section-title {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.dev-hub__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.dev-hub__card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  text-decoration: none;
  color: var(--el-text-color-primary);
  transition: all 0.2s ease;
  cursor: pointer;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
    border-color: var(--el-color-primary-light-5);
  }

  &.router-link-active {
    border-color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
  }
}

.dev-hub__card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  color: #fff;
  flex-shrink: 0;
}

.dev-hub__card-body {
  flex: 1;
  min-width: 0;
}

.dev-hub__card-title {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.dev-hub__card-desc {
  margin: 0;
  font-size: 12px;
  color: var(--el-text-color-regular);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.dev-hub__card-arrow {
  color: var(--el-text-color-placeholder);
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.dev-hub__card:hover .dev-hub__card-arrow {
  transform: translateX(2px);
  color: var(--el-color-primary);
}

.dev-hub__footer {
  margin-top: 16px;
  display: flex;
  justify-content: center;
}
</style>
