<template>
  <Teleport to="body">
    <Transition name="theme-loading-fade">
      <div v-if="isVisible" class="theme-loading-overlay" :class="themeClass">
        <div class="theme-loading-wave"></div>
        <div class="theme-loading-spinner">
          <div class="spinner-ring"></div>
          <span class="loading-text">{{ text }}</span>
          <div class="loading-progress"></div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDarkModeStore } from '@/stores/darkMode'

defineProps<{
  isVisible: boolean
  isDark?: boolean
}>()

const { t } = useI18n()
const darkModeStore = useDarkModeStore()

const text = computed(() => {
  const mode = darkModeStore.themeMode
  const texts: Record<string, string> = {
    'light': t('themeToggle.switchingToLight'),
    'dark': t('themeToggle.switchingToDark'),
    'auto': t('themeToggle.autoMode'),
    'high-contrast-light': t('themeToggle.switchingToHighContrastLight'),
    'high-contrast-dark': t('themeToggle.switchingToHighContrastDark')
  }
  return texts[mode] || t('themeToggle.switchingToLight')
})

const themeClass = computed(() => {
  const mode = darkModeStore.themeMode
  return {
    'theme-dark': mode === 'dark' || mode === 'high-contrast-dark',
    'theme-high-contrast': mode === 'high-contrast-light' || mode === 'high-contrast-dark'
  }
})
</script>

<style scoped>
.theme-loading-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-max);
  pointer-events: none;
}

.theme-loading-wave {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--el-color-primary-light-7) 50%,
    transparent 100%
  );
  animation: theme-wave 0.6s ease-out forwards;
}

@keyframes theme-wave {
  0% {
    transform: translateX(-100%);
  }

  100% {
    transform: translateX(100%);
  }
}

.theme-loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 20px 30px;
  background: var(--el-bg-color-overlay);
  border-radius: var(--global-border-radius);
  animation: theme-loader-pop 0.2s ease-out;
}

@keyframes theme-loader-pop {
  0% {
    opacity: 0;
    transform: scale(0.9);
  }

  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.theme-dark .theme-loading-spinner {
  background: var(--color-black-90);
  }

.theme-high-contrast .theme-loading-spinner {
  border: 2px solid currentcolor;
}

.theme-high-contrast.theme-dark .theme-loading-spinner {
  background: var(--el-text-color-primary);
  border-color: var(--el-bg-color);
}

.theme-high-contrast:not(.theme-dark) .theme-loading-spinner {
  background: var(--el-bg-color);
  border-color: var(--el-text-color-primary);
}

.spinner-ring {
  width: 32px;
  height: 32px;
  border: 3px solid var(--el-border-color-lighter);
  border-top-color: var(--el-color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.loading-progress {
  width: 80px;
  height: 3px;
  background: var(--el-fill-color-light);
  border-radius: var(--global-border-radius);
  overflow: hidden;
}

.loading-progress::after {
  content: '';
  display: block;
  width: 50%;
  height: 100%;
  background: var(--el-color-primary);
  border-radius: var(--global-border-radius);
  animation: progress-wave 1s ease-in-out infinite;
}

@keyframes progress-wave {
  0% {
    transform: translateX(-100%);
  }

  100% {
    transform: translateX(200%);
  }
}

.theme-loading-fade-enter-active,
.theme-loading-fade-leave-active {
  transition: opacity 0.2s ease;
}

.theme-loading-fade-enter-from,
.theme-loading-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .theme-loading-wave,
  .spinner-ring,
  .loading-progress::after {
    animation: none;
  }
  
  .theme-loading-spinner {
    animation: none;
  }
}
</style>
