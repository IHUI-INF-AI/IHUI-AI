<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

interface Information {
  title?: string
  tag?: string
  view?: string | number
  date?: string
  img?: string
  content?: string
}

const { t } = useI18n()

const props = defineProps<{
  information?: Information
}>()

const happenTimeFun = (dateStr?: string): string => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 30) return `${days}天前`
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const info = computed(() => props.information || {})
</script>

<template>
  <div class="ai-news-page">
    <div class="main-btn">
      <span class="main-title">{{ info.title }}</span>
      <span class="tag-btn">{{ info.tag }}</span>
    </div>

    <div class="meta-row">
      <div />
      <div>
        <span class="meta-views">{{ info.view }}{{ t('aiTextBanner.views') }}</span>
        <span class="meta-date">{{ happenTimeFun(info.date) }}</span>
      </div>
    </div>

    <div class="content-box">
      <img v-if="info.img" class="content-img" :src="info.img" alt="content" loading="lazy" />
      <div class="content-text">{{ info.content }}</div>
    </div>
  </div>
</template>

<style scoped>
.ai-news-page {
  background: transparent;
  min-height: 100vh;
  padding-bottom: 32px;
}

.main-btn {
  position: relative;
  margin: 480px 1px 0;
  background: var(--color-gradient-white-blue);
  border-radius: var(--global-border-radius);
  padding: 20px 30px 20px 32px;
  display: flex;
  align-items: flex-end;
  min-height: 80px;
}

.main-title {
  color: var(--color-white);
  font-size: 14px;
  font-weight: 700;
  flex: 1;
  line-height: 1.5;
}

.tag-btn {
  position: absolute;
  right: 32px;
  bottom: 15px;
  background: var(--color--f7b500);
  color: var(--color-white);
  border-radius: var(--global-border-radius);
  font-size: 9px;
  padding: 2px 9px;
  font-weight: 700;
  }

.meta-row {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin: 18px 32px 0;
  font-size: 12px;
  color: var(--el-text-color-primary);
}

.meta-views {
  margin-right: 32px;
}

.meta-date {
  margin-right: 32px;
}

.content-box {
  background: var(--color--f0f3fb);
  border-radius: var(--global-border-radius);
  margin: 24px 24px 0;
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.content-img {
  width: 100%;
  border-radius: var(--global-border-radius);
  margin-bottom: 18px;
}

.content-text {
  color: var(--el-text-color-primary);
  font-size: 13px;
  line-height: 1.8;
  margin-bottom: 12px;
  word-break: break-all;
}
</style>
