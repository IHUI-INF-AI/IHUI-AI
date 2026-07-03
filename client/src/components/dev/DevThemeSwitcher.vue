<!--
  DevThemeSwitcher.vue
  P1-1: dev 期主题切换 chip
  用途: 在 dev 环境下提供 auto/light/dark 三段式主题切换器，浮在右下角
  生产环境（import.meta.env.DEV === false）完全不渲染，零生产开销
  与 Project memory 一致：
    - dev 专用，import.meta.env.DEV 守卫
    - i18n 全量翻译
    - 切换即写 localStorage 触发 darkMode store
-->
<template>
  <div
    v-if="isDev"
    class="dev-theme-switcher"
    :class="{ 'is-auto': isAutoMode, 'is-dark': isDarkResolved, 'is-collapsed': !expanded }"
    role="group"
    :aria-label="t('themeToggle.menuLabel')"
  >
    <button
      class="dev-theme-switcher-toggle"
      type="button"
      :aria-expanded="expanded"
      :aria-label="t('themeToggle.currentMode') + ': ' + currentModeLabel"
      :title="toggleHint"
      @click="toggleExpanded"
    >
      <el-icon class="dts-icon" aria-hidden="true">
        <component :is="currentModeIcon" />
      </el-icon>
      <span class="dts-label">{{ currentModeLabel }}</span>
      <span class="dts-chevron" aria-hidden="true">▾</span>
    </button>

    <transition name="dts-fade">
      <div v-show="expanded" class="dev-theme-switcher-panel" role="listbox">
        <button
          v-for="m in modes"
          :key="m.value"
          class="dts-option"
          :class="{ active: store.themeMode === m.value }"
          type="button"
          role="option"
          :aria-selected="store.themeMode === m.value"
          :title="m.hint"
          @click="selectMode(m.value)"
        >
          <el-icon class="dts-option-icon" aria-hidden="true">
            <component :is="m.icon" />
          </el-icon>
          <span class="dts-option-label">{{ m.label }}</span>
        </button>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Sunny, Moon, Monitor } from '@element-plus/icons-vue'
import { useDarkModeStore } from '@/stores/darkMode'

type ThemeMode = 'auto' | 'light' | 'dark'

const { t } = useI18n()
const store = useDarkModeStore()

// 生产环境零渲染
const isDev = import.meta.env.DEV

const expanded = ref(false)

const modes: ReadonlyArray<{ value: ThemeMode; icon: unknown; label: string; hint: string }> = [
  { value: 'auto', icon: Monitor, label: t('themeToggle.autoMode'), hint: '跟随系统偏好自动切换' },
  { value: 'light', icon: Sunny, label: t('themeToggle.lightMode'), hint: '强制使用浅色模式' },
  { value: 'dark', icon: Moon, label: t('themeToggle.darkMode'), hint: '强制使用深色模式' },
]

const isAutoMode = computed(() => store.themeMode === 'auto')
const isDarkResolved = computed(() => store.isDarkMode ?? store.themeMode === 'dark')

const currentModeLabel = computed(() => {
  return modes.find((m) => m.value === store.themeMode)?.label ?? t('themeToggle.autoMode')
})

const currentModeIcon = computed(() => {
  return modes.find((m) => m.value === store.themeMode)?.icon ?? Monitor
})

const toggleHint = computed(() => (expanded.value ? t('common.collapse') : t('common.expand')))

const toggleExpanded = () => {
  expanded.value = !expanded.value
}

const selectMode = (mode: ThemeMode) => {
  store.setThemeMode(mode, 'user', true)
  expanded.value = false
}
</script>

<style lang="scss" scoped>
.dev-theme-switcher {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  font-family: var(--el-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
  user-select: none;
}

.dev-theme-switcher-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  height: 32px;
  border-radius: 8px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-color-primary);
  color: var(--el-text-color-primary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.08), 0 0 0 1px rgb(37 99 235 / 0.18);
  transition: transform 0.15s ease, box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgb(0 0 0 / 0.12), 0 0 0 1px rgb(37 99 235 / 0.4);
  }

  &:active {
    transform: translateY(0);
  }

  .dts-icon {
    font-size: 14px;
    color: var(--el-color-primary);
  }

  .dts-chevron {
    font-size: 10px;
    color: var(--el-text-color-secondary);
    transition: transform 0.2s ease;
  }
}

.dev-theme-switcher.is-collapsed .dev-theme-switcher-toggle .dts-chevron {
  transform: rotate(180deg);
}

.dev-theme-switcher.is-auto .dev-theme-switcher-toggle {
  background: linear-gradient(135deg, rgb(251 191 36 / 0.12) 0%, rgb(59 130 246 / 0.12) 100%);
}

.dev-theme-switcher-panel {
  display: flex;
  flex-direction: column;
  min-width: 160px;
  padding: 4px;
  background: var(--el-bg-color);
  /* stylelint-disable color-no-hex -- dev 工具边框 fallback，对应 var(--el-border-color-light) */
  border: 1px solid var(--el-border-color-light, #ebeef5);
  /* stylelint-enable color-no-hex */
  border-radius: 8px;
  box-shadow: 0 6px 20px rgb(0 0 0 / 0.12);
}

.dts-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--el-text-color-primary);
  font-size: 12px;
  cursor: pointer;
  text-align: left;
  transition: background-color 0.15s ease, border-color 0.15s ease;

  &:hover {
    /* stylelint-disable color-no-hex -- dev 工具 hover 背景 fallback */
    background: var(--el-fill-color-light, #f5f7fa);
    /* stylelint-enable color-no-hex */
  }

  &.active {
    background: var(--el-color-primary-light-9, rgb(37 99 235 / 0.08));
    border-color: var(--border-unified-color-hover);
    color: var(--el-color-primary);
    font-weight: 600;
  }

  .dts-option-icon {
    font-size: 14px;
    flex-shrink: 0;
  }

  .dts-option-label {
    flex: 1;
  }
}

/* 暗色模式：按钮在 darkSurface 上保持对比度 */
:global(html.dark) .dev-theme-switcher-toggle {
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.3), 0 0 0 1px rgb(37 99 235 / 0.5);
}

:global(html.dark) .dev-theme-switcher-panel {
  background: var(--el-bg-color);
  /* stylelint-disable color-no-hex -- dev 工具暗色边框 fallback */
  border-color: var(--el-border-color, #4c4d4f);
  /* stylelint-enable color-no-hex */
  box-shadow: 0 6px 20px rgb(0 0 0 / 0.4);
}

:global(html.dark) .dts-option:hover {
  /* stylelint-disable color-no-hex -- dev 工具暗色 hover 背景 fallback */
  background: var(--el-fill-color-dark, #2b2b2b);
  /* stylelint-enable color-no-hex */
}

:global(html.dark) .dts-option.active {
  background: rgb(37 99 235 / 0.18);
}

/* 展开/收起过渡 */
.dts-fade-enter-active,
.dts-fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.dts-fade-enter-from,
.dts-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
