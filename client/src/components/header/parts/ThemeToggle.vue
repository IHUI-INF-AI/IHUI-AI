<!--
  主题切换(明暗模式)
  原 HeaderActions.vue 中的 theme-toggle-fallback 实现。
  提供视觉一致、明暗模式感知、回退友好的切换按钮。
-->
<template>
  <div class="theme-toggle-wrapper">
    <button
      type="button"
      class="theme-toggle-fallback"
      :aria-label="t('themeToggle.clickToChange')"
      :title="t('themeToggle.clickToChange')"
      :aria-pressed="isDark"
      @click="toggle"
    >
      <el-icon v-if="isDark" class="theme-fallback-icon" aria-hidden="true">
        <component :is="MoonIcon" />
      </el-icon>
      <el-icon v-else class="theme-fallback-icon" aria-hidden="true">
        <component :is="SunnyIcon" />
      </el-icon>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { Moon, Sunny } from '@element-plus/icons-vue'
import { useDarkModeStore } from '@/stores/darkMode'

const { t } = useI18n()
const store = useDarkModeStore()
const { isDarkMode } = storeToRefs(store)
const isDark = computed(() => isDarkMode.value ?? store.themeMode === 'dark')

const toggle = () => store.toggleDarkMode()

// 以变量方式导出避免模板内重复属性访问
const MoonIcon = Moon
const SunnyIcon = Sunny
</script>

<style scoped lang="scss">
.theme-toggle-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  height: var(--header-action-height);
  min-height: var(--header-action-height);
  width: var(--header-action-height);
  min-width: var(--header-action-height);
  max-width: var(--header-action-height);
  padding: 0;
  margin-right: var(--header-actions-gap);
  background-color: transparent;
  border-radius: var(--global-border-radius);
  flex-shrink: 0;
}

.theme-toggle-fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  min-width: 28px;
  min-height: 28px;
  padding: 0;
  margin: 0;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  background: var(--el-fill-color-light);
  color: var(--el-text-color-regular);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  flex-shrink: 0;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.theme-toggle-fallback:hover {
  background: var(--el-fill-color);
  border-color: var(--border-unified-color-hover);
  color: var(--el-text-color-primary);
}

.theme-toggle-fallback:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

.theme-fallback-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  width: 1em;
  height: 1em;
  line-height: 1;
  color: inherit;
}

.theme-fallback-icon svg {
  width: 1em;
  height: 1em;
}

:global(html.dark) .theme-toggle-fallback {
  background: var(--el-fill-color-dark);
  color: var(--el-text-color-secondary);
  border-color: var(--border-unified-color);
}

:global(html.dark) .theme-toggle-fallback:hover {
  background: var(--color-white-8);
  border-color: var(--border-unified-color-hover);
  color: var(--el-text-color-primary);
}

@media (width <= 767px) {
  .theme-toggle-wrapper {
    width: 28px;
    min-width: 28px;
    max-width: 28px;
  }
}
</style>
