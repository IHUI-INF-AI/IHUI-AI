<template>
  <router-link class="big-rectangle-card" :to="{ path: link, query: { id: item.id } }">
    <div class="card-image">
      <img :src="item.image || item.cover || defaultCover" :alt="item.name" loading="lazy" />
    </div>
    <div class="card-content">
      <h3 class="card-title">{{ item.name || item.title }}</h3>
      <p v-if="item.description" class="card-desc">{{ item.description }}</p>
      <div class="card-meta">
        <span class="lecturer">{{ item.teacherName || item.lecturer }}</span>
        <span class="dot">·</span>
        <span class="learn-count">{{ item.learnNum || 0 }} {{ t('bigRectangle.learnCount') }}</span>
      </div>
      <div class="card-footer">
        <span class="price">{{ formatPrice(item.price) }}</span>
      </div>
    </div>
  </router-link>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'
import { formatMoney } from '@/utils/format'
import { useDarkModeStore } from '@/stores/darkMode'

const { t } = useI18n()
const darkModeStore = useDarkModeStore()

// 读取 CSS 变量值,data URL 中的 SVG 无法直接使用 CSS 变量,需通过 JS 注入
const getCssVar = (name: string): string => {
  if (typeof document === 'undefined') return ''
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

// 占位图根据暗色模式动态生成,适配暗色模式
const defaultCover = computed(() => {
  const isDark = darkModeStore.isDarkMode
  const bgColor = getCssVar('--el-bg-color') || (isDark ? '#1a1a1a' : '#f0f2f5')
  const textColor = getCssVar('--el-text-color-secondary') || (isDark ? '#e5eaf3' : '#909399')
  return (
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" fill="none">' +
        `<rect width="320" height="180" fill="${bgColor}"/>` +
        `<text x="160" y="95" text-anchor="middle" fill="${textColor}" font-size="14" font-family="sans-serif">${t('module.courseCover')}</text>` +
        '</svg>'
    )
  )
})

withDefaults(
  defineProps<{ item: any; link?: string }>(),
  { link: '/learn/detail' }
)

function formatPrice(p: number | undefined): string {
  const v = p || 0
  return v === 0 ? t('module.free') : `¥${formatMoney(v)}`
}
</script>

<style lang="scss" scoped>
:where(.big-rectangle-card) {
  display: flex;
  flex-direction: column;
  text-decoration: none;
  color: inherit;
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  overflow: hidden;
  height: 100%;
}

:where(.card-image) {
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

:where(.card-content) {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px;
}

:where(.card-title) {
  font-size: 16px;
  font-weight: 500;
  margin: 0 0 8px;
  color: var(--el-text-color-primary);
}

:where(.card-desc) {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin: 0 0 12px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

:where(.card-meta) {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 12px;

  .dot {
    margin: 0 6px;
  }
}

:where(.card-footer) {
  margin-top: auto;
}

:where(.price) {
  color: var(--el-color-danger);
  font-size: 16px;
  font-weight: 600;
}
</style>
