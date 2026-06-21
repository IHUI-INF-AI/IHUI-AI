<template>
  <!-- SearchTrigger 已移至 HeaderActions.vue 中作为独立组件 -->
  <Teleport to="body">
    <SearchModal v-if="isExpanded" :is-dark-mode="isDarkMode" @close="closeSearch" />
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import SearchModal from './SearchModal.vue'

interface Props {
  isDarkMode?: boolean
}

const _props = withDefaults(defineProps<Props>(), {
  isDarkMode: false,
})

const isExpanded = ref(false)

// 扩展Window接口以支持命令面板
declare global {
  interface Window {
    openCommandPalette?: () => void
    openSearchModal?: () => void
  }
}

const toggleExpanded = () => {
  if (window.openCommandPalette) {
    window.openCommandPalette()
  } else {
    isExpanded.value = !isExpanded.value
  }
}

const closeSearch = () => {
  isExpanded.value = false
}

// 暴露打开搜索的方法到 window，供 SearchTrigger 调用
onMounted(() => {
  window.openSearchModal = toggleExpanded
})

onUnmounted(() => {
  delete window.openSearchModal
})

watch(isExpanded, newValue => {
  if (newValue) {
    nextTick(() => {
      document
        .querySelector('.search-input')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }
})
</script>
