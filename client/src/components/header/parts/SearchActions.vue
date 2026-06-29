<!--
  搜索触发 + 搜索面板
  原 HeaderActions.vue 中的 search-trigger-wrapper + Search 组件
-->
<template>
  <div class="search-trigger-wrapper">
    <SearchTrigger :isDarkMode="isDark" @toggle="toggle" />
  </div>

  <Search v-if="!useFallback" :is-dark-mode="isDark" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useDarkModeStore } from '@/stores/darkMode'
import SearchTrigger from '@/components/login/SearchTrigger.vue'
import Search from '@/components/login/Search.vue'

// 同步导入避免搜索按钮区域出现「白条」——SearchTrigger 是 header 中固定可见的图标，
// 异步加载会在容器已显示但内容未就绪时产生空白/抖动。

const darkStore = useDarkModeStore()
const isDark = computed(() => darkStore.isDarkMode ?? darkStore.themeMode === 'dark')

const useFallback = false

const toggle = () => {
  if (typeof window === 'undefined') return
  const w = window as Window & { openSearchModal?: () => void; openCommandPalette?: () => void }
  if (w.openSearchModal) w.openSearchModal()
  else if (w.openCommandPalette) w.openCommandPalette()
}
</script>

<style scoped lang="scss">
.search-trigger-wrapper {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  min-width: 0;
}
</style>
