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
import { computed, defineAsyncComponent } from 'vue'
import { useDarkModeStore } from '@/stores/darkMode'

const darkStore = useDarkModeStore()
const isDark = computed(() => darkStore.isDarkMode ?? darkStore.themeMode === 'dark')

const useFallback = false
const SearchTrigger = defineAsyncComponent(() => import('@/components/login/SearchTrigger.vue'))
const Search = defineAsyncComponent(() => import('@/components/login/Search.vue'))

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
