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
import { formatMoney } from '@/utils/format'

const { t } = useI18n()

const defaultCover =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" fill="none">' +
      '<rect width="320" height="180" fill="#f0f2f5"/>' +
      '<text x="160" y="95" text-anchor="middle" fill="#909399" font-size="14" font-family="sans-serif">课程封面</text>' +
      '</svg>'
  )

withDefaults(
  defineProps<{ item: any; link?: string }>(),
  { link: '/learn/detail' }
)

function formatPrice(p: number | undefined): string {
  const v = p || 0
  return v === 0 ? '免费' : `¥${formatMoney(v)}`
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

  &:hover {
    box-shadow: var(--global-box-shadow);
  }
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
