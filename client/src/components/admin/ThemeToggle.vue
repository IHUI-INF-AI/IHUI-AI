<template>
  <el-button
    class="admin-theme-toggle"
    :icon="isDark ? Sunny : Moon"
    circle
    @click="toggle"
  />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Sunny, Moon } from '@element-plus/icons-vue'

const isDark = ref(false)
const STORAGE_KEY = 'admin-theme-mode'

const apply = (dark: boolean) => {
  const root = document.documentElement
  if (dark) {
    root.classList.add('admin-dark')
    root.setAttribute('data-theme', 'dark')
  } else {
    root.classList.remove('admin-dark')
    root.setAttribute('data-theme', 'light')
  }
}

const toggle = () => {
  isDark.value = !isDark.value
  apply(isDark.value)
  try {
    localStorage.setItem(STORAGE_KEY, isDark.value ? 'dark' : 'light')
  } catch { /* noop */ }
}

onMounted(() => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    isDark.value = stored === 'dark'
  } catch { /* noop */ }
  apply(isDark.value)
})
</script>

<style scoped lang="scss">
:where(.admin-theme-toggle) {
  background: transparent;
  border: var(--unified-border);
  color: var(--el-text-color-primary);
  transition: all 0.2s;

  @media (hover: hover) {
    &:hover {
      background: var(--el-color-primary-light-9);
      color: var(--el-color-primary);
    }
  }

  &:active {
    background: var(--el-color-primary-light-9);
    color: var(--el-color-primary);
  }
}
</style>
