<template>
  <!-- 主内容：搜索栏、消息区、输入区 -->
  <!-- 搜索栏：无多余容器，直接为 el-input + 搜索结果 -->
  <Transition name="slide-down">
    <el-input v-if="showSearchBar" :model-value="modelValue" :placeholder="t('floatingChat.searchPlaceholder')"
      class="floating-chat-search-input" clearable @update:model-value="onInput" @input="onSearch">
      <template #prefix>
        <SearchIcon />
      </template>
    </el-input>
  </Transition>
  <div v-if="showSearchBar && searchResults.length > 0" class="search-results">
    <div v-for="result in searchResults" :key="result.id" class="search-result-item"
      @click="emit('scroll-to-message', result.id)">
      <div class="result-preview">{{ result.preview }}</div>
      <div class="result-time">{{ formatTime(result.createTime) }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import SearchIcon from '@/components/common/SearchIcon.vue'

/** 搜索结果项类型（与 AIChat.vue 的 searchResults 项保持一致） */
interface SearchResultItem {
  id: string
  preview: string
  createTime: string
}

interface Props {
  /** 是否显示搜索栏 */
  showSearchBar: boolean
  /** 搜索关键词（v-model） */
  modelValue: string
  /** 搜索结果列表 */
  searchResults: SearchResultItem[]
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'search'): void
  (e: 'scroll-to-message', id: string): void
}>()

const { t } = useI18n()

/** 输入框值更新：转发 v-model */
const onInput = (value: string) => {
  emit('update:modelValue', value)
}

/** 触发搜索 */
const onSearch = () => {
  emit('search')
}

/** 格式化时间：相对时间（刚刚/分钟前/小时前/天前）或绝对时间（超过 7 天） */
const formatTime = (time: string) => {
  const date = new Date(time)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return t('floatingChat.justNow')
  if (minutes < 60) return t('floatingChat.minutesAgo', { minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('floatingChat.hoursAgo', { hours })
  const days = Math.floor(hours / 24)
  if (days < 7) return t('floatingChat.daysAgo', { days })
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>
