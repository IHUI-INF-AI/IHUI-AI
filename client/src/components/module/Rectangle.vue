<template>
  <router-link class="rectangle-card" :to="{ path: link, query: { id: item.id } }">
    <div class="card-image">
      <img :src="item.image || item.cover || defaultCover" :alt="item.name" loading="lazy" />
      <span v-if="item.status === 'active'" class="live-badge">{{ t('moduleRectangle.liveNow') }}</span>
      <span v-if="phraseTag" class="phrase-tag">{{ phraseTag }}</span>
    </div>
    <div class="card-content">
      <h3 class="card-title">{{ item.name || item.title }}</h3>
      <p v-if="phraseDesc" class="card-phrase">{{ phraseDesc }}</p>
      <div class="card-footer">
        <span class="price">{{ formatPrice(item.price) }}</span>
        <span class="learn-count">{{ item.learnNum || item.signUpNum || 0 }} {{ t('moduleRectangle.signedUp') }}</span>
      </div>
    </div>
  </router-link>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'
import { formatMoney } from '@/utils/format'
import { useDarkModeStore } from '@/stores/darkMode'
// 内联 SVG 占位图,无网络/文件依赖
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
        `<text x="160" y="95" text-anchor="middle" fill="${textColor}" font-size="14" font-family="sans-serif">课程封面</text>` +
        '</svg>'
    )
  )
})

const props = withDefaults(
  defineProps<{
    item: any
    link?: string
  }>(),
  { link: '/learn/detail' }
)

function formatPrice(p: number | undefined): string {
  const v = p || 0
  return v === 0 ? t('module.free') : `¥${formatMoney(v)}`
}

const phraseTag = computed(() => {
  const phrase = props.item?.phrase
  if (!phrase) return ''
  const m = String(phrase).match(/^([^\s:：]+)[:：]/)
  return m ? m[1] : ''
})

const phraseDesc = computed(() => {
  const phrase = props.item?.phrase
  if (!phrase) return ''
  const m = String(phrase).match(/[:：](.+)$/)
  return m ? m[1].trim() : phrase
})
</script>

<style lang="scss" scoped>
:where(.rectangle-card) {
  display: block;
  text-decoration: none;
  color: inherit;
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  overflow: hidden;
  transition: transform 0.2s ease;

  &:hover {
    transform: translateY(-2px);
  }
}

:where(.card-image) {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

:where(.live-badge) {
  position: absolute;
  top: 8px;
  left: 8px;
  padding: 2px 8px;
  background: var(--el-color-danger);
  color: var(--el-color-white);
  font-size: 12px;
  border-radius: var(--global-border-radius);
}

:where(.phrase-tag) {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 2px 8px;
  background: var(--el-color-primary);
  color: var(--el-color-white);
  font-size: 12px;
  border-radius: var(--global-border-radius);
}

:where(.card-content) {
  padding: 12px;
}

:where(.card-title) {
  font-size: 14px;
  font-weight: 500;
  margin: 0 0 6px;
  color: var(--el-text-color-primary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

:where(.card-phrase) {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin: 0 0 8px;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

:where(.card-footer) {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

:where(.price) {
  color: var(--el-color-danger);
  font-weight: 600;
}

:where(.learn-count) {
  color: var(--el-text-color-secondary);
}
</style>
