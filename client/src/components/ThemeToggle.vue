<template>
  <div class="theme-toggle-container">
    <el-dropdown trigger="click" @command="handleThemeChange" @visible-change="handleDropdownVisible">
      <div class="theme-toggle-trigger-wrap" :aria-label="ariaLabel">
      <label
        class="theme-toggle"
        role="switch"
        :aria-label="ariaLabel"
        :aria-checked="isDarkMode"
        :aria-describedby="describedBy"
        tabindex="0"
        @keydown="handleKeydown"
      >
        <input
          type="checkbox"
          :checked="isDarkMode"
          :aria-hidden="true"
          @change="handleToggle"
        />
        <span class="track" :class="{ 'high-contrast': isHighContrast }">
          <span class="knob">
            <svg class="theme-icon sun-icon" viewBox="0 0 20 20" aria-hidden="true">
              <circle cx="10" cy="10" r="4" fill="currentColor" />
              <circle cx="10" cy="2" r="1.5" fill="currentColor" />
              <circle cx="10" cy="18" r="1.5" fill="currentColor" />
              <circle cx="2" cy="10" r="1.5" fill="currentColor" />
              <circle cx="18" cy="10" r="1.5" fill="currentColor" />
              <circle cx="4.34" cy="4.34" r="1.5" fill="currentColor" />
              <circle cx="15.66" cy="15.66" r="1.5" fill="currentColor" />
              <circle cx="4.34" cy="15.66" r="1.5" fill="currentColor" />
              <circle cx="15.66" cy="4.34" r="1.5" fill="currentColor" />
            </svg>
            <svg class="theme-icon moon-icon" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" fill="currentColor" />
            </svg>
          </span>
        </span>
      </label>
      </div>
      <template #dropdown>
        <el-dropdown-menu role="menu" :aria-label="t('themeToggle.menuLabel')">
          <el-dropdown-item
            command="light"
            :class="{ 'is-active': currentThemeMode === 'light' }"
            role="menuitemradio"
            :aria-checked="currentThemeMode === 'light'"
          >
            <el-icon aria-hidden="true"><Sunny /></el-icon>
            <span>{{ t('themeToggle.lightMode') }}</span>
          </el-dropdown-item>
          <el-dropdown-item
            command="dark"
            :class="{ 'is-active': currentThemeMode === 'dark' }"
            role="menuitemradio"
            :aria-checked="currentThemeMode === 'dark'"
          >
            <el-icon aria-hidden="true"><Moon /></el-icon>
            <span>{{ t('themeToggle.darkMode') }}</span>
          </el-dropdown-item>
          <el-dropdown-item
            command="auto"
            :class="{ 'is-active': currentThemeMode === 'auto' }"
            role="menuitemradio"
            :aria-checked="currentThemeMode === 'auto'"
          >
            <el-icon aria-hidden="true"><Monitor /></el-icon>
            <span>{{ t('themeToggle.autoMode') }}</span>
          </el-dropdown-item>
          <el-dropdown-item
            divided
            command="high-contrast-light"
            :class="{ 'is-active': currentThemeMode === 'high-contrast-light' }"
            role="menuitemradio"
            :aria-checked="currentThemeMode === 'high-contrast-light'"
          >
            <el-icon aria-hidden="true"><Sunny /></el-icon>
            <span>{{ t('themeToggle.highContrastLight') }}</span>
          </el-dropdown-item>
          <el-dropdown-item
            command="high-contrast-dark"
            :class="{ 'is-active': currentThemeMode === 'high-contrast-dark' }"
            role="menuitemradio"
            :aria-checked="currentThemeMode === 'high-contrast-dark'"
          >
            <el-icon aria-hidden="true"><Moon /></el-icon>
            <span>{{ t('themeToggle.highContrastDark') }}</span>
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
    <span id="theme-toggle-hint" class="sr-only">{{ t('themeToggle.clickToChange') }}</span>
    <div
      class="theme-change-announcer"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {{ announcerText }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDarkModeStore, type ThemeMode } from '@/stores/darkMode'
import { Sunny, Moon, Monitor } from '@element-plus/icons-vue'
import { themeTransitionManager } from '@/utils/themeTransition'
import { themeBackupManager } from '@/utils/themeBackup'

const { t } = useI18n()

const darkModeStore = useDarkModeStore()

const isDarkMode = computed(() => {
  return darkModeStore.isDarkMode?.value ?? darkModeStore.isDarkMode ?? false
})

const isHighContrast = computed(() => {
  return darkModeStore.isHighContrast?.value ?? darkModeStore.isHighContrast ?? false
})

const currentThemeMode = computed(() => darkModeStore.themeMode)

const announcerText = ref('')
const isTransitioning = ref(false)

const ariaLabel = computed(() => {
  const modeText = currentThemeMode.value === 'auto'
    ? t('themeToggle.autoMode')
    : currentThemeMode.value === 'high-contrast-light'
      ? t('themeToggle.highContrastLight')
      : currentThemeMode.value === 'high-contrast-dark'
        ? t('themeToggle.highContrastDark')
        : isDarkMode.value
          ? t('themeToggle.darkMode')
          : t('themeToggle.lightMode')
  return `${t('themeToggle.currentMode')}: ${modeText}. ${t('themeToggle.clickToChange')}`
})

const describedBy = computed(() => 'theme-toggle-hint')

watch(currentThemeMode, (newMode) => {
  const modeNames: Record<string, string> = {
    'light': t('themeToggle.lightMode'),
    'dark': t('themeToggle.darkMode'),
    'auto': t('themeToggle.autoMode'),
    'high-contrast-light': t('themeToggle.highContrastLight'),
    'high-contrast-dark': t('themeToggle.highContrastDark')
  }
  const mode = newMode as unknown as string
  announcerText.value = modeNames[mode] || ''
})

onMounted(() => {
  themeTransitionManager.resetTransitionOnRoot()
})

onUnmounted(() => {
  themeTransitionManager.resetTransitionOnRoot()
})

const executeThemeChange = (changeFn: () => void) => {
  if (isTransitioning.value) return
  isTransitioning.value = true
  changeFn()
  isTransitioning.value = false
  // 备份延后执行，不阻塞即时切换体感
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(() => themeBackupManager.createBackup(undefined, true), { timeout: 500 })
  } else {
    setTimeout(() => themeBackupManager.createBackup(undefined, true), 0)
  }
}

const handleToggle = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.checked !== isDarkMode.value) {
    executeThemeChange(() => darkModeStore.toggleDarkMode())
  }
}

const handleThemeChange = (mode: ThemeMode) => {
  executeThemeChange(() => darkModeStore.setThemeMode(mode, 'user', true))
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    executeThemeChange(() => darkModeStore.toggleDarkMode())
  }
}

const handleDropdownVisible = (_visible: boolean) => {
}
</script>

<style scoped>
.theme-toggle-container {
  position: relative;
  width: 52px;
  min-width: 52px;
  max-width: 52px;
  height: 28px;
  box-sizing: border-box;
  padding: 0;
  margin: 0;
  overflow: hidden;
}

/* 将 dropdown 整体钉在容器左上角 (0,0)，消除任何内部包裹造成的偏移 */
.theme-toggle-container :deep(.el-dropdown) {
  position: absolute;
  left: 0;
  top: 0;
  width: 52px;
  height: 28px;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.theme-toggle-container :deep(.el-dropdown > *),
.theme-toggle-container :deep(.el-dropdown .el-tooltip__trigger) {
  position: absolute;
  left: 0;
  top: 0;
  width: 52px;
  min-width: 52px;
  max-width: 52px;
  height: 28px;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

/* 触发器包裹层与容器完全重合 */
.theme-toggle-trigger-wrap {
  position: absolute;
  left: 0;
  top: 0;
  width: 52px;
  height: 28px;
  padding: 0;
  margin: 0;
  box-sizing: border-box;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.theme-change-announcer {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.theme-toggle {
  --tt-bg: transparent;
  --tt-icon-size: 16px;
  --tt-icon-position: 3px;
  --tt-sun-color: var(--el-color-warning);
  --tt-moon-color: var(--el-color-white);

  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 28px;
  min-width: 52px;
  max-width: 52px;
  cursor: pointer;
  background: var(--tt-bg);
  padding: 0;
  margin: 0;
  flex-shrink: 0;
}

.theme-toggle:focus {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

.theme-toggle:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

.theme-toggle input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.track {
  position: relative;
  display: flex;
  align-items: center;
  width: 52px;
  height: 28px;
  background: var(--el-fill-color-light);
  border-radius: var(--global-border-radius);
  transition: background-color 0.3s ease;
  box-shadow: var(--global-box-shadow);
}

.track.high-contrast {
  border: var(--el-border-width-primary) solid var(--el-color-primary);
}

.knob {
  position: absolute;
  left: 3px;
  top: 3px;
  width: 22px;
  height: 22px;
  border-radius: var(--global-border-radius);
  background: var(--el-bg-color-page);
  box-shadow: var(--global-box-shadow);
  transition: transform 0.3s ease, background-color 0.3s ease;
  display: grid;
  place-items: center;
}

.knob > .theme-icon {
  grid-area: 1 / 1;
  width: 16px;
  height: 16px;
  transition: opacity 0.3s ease;
}

.sun-icon {
  color: var(--tt-sun-color);
  opacity: 1;
}

.moon-icon {
  color: var(--tt-moon-color);
  opacity: 0;
}

input:checked + .track {
  background: var(--el-fill-color-darker);
}

input:checked + .track .knob {
  transform: translateX(24px);
  background: var(--el-bg-color);
  box-shadow: var(--global-box-shadow);
}

input:checked + .track .sun-icon {
  opacity: 0;
}

input:checked + .track .moon-icon {
  opacity: 1;
}

@media (width <= 767px) {
  .theme-toggle-container {
    width: 48px;
    min-width: 48px;
    max-width: 48px;
    height: 32px;
  }

  .theme-toggle-container :deep(.el-dropdown) {
    width: 48px;
    height: 32px;
  }

  .theme-toggle-container :deep(.el-dropdown > *),
  .theme-toggle-container :deep(.el-dropdown .el-tooltip__trigger) {
    width: 48px;
    min-width: 48px;
    max-width: 48px;
    height: 32px;
  }

  .theme-toggle-trigger-wrap {
    width: 48px;
    height: 32px;
  }

  .theme-toggle {
    width: 48px;
    height: 32px;
    min-width: 48px;
    min-height: 32px;
    padding: 4px;
  }

  .track {
    width: 48px;
    height: 32px;
  }

  .knob {
    width: 20px;
    height: 20px;
  }

  .knob > .theme-icon {
    width: 14px;
    height: 14px;
  }

  input:checked + .track .knob {
    transform: translateX(16px);
  }
}

@media (width <= 480px) {
  .theme-toggle-container {
    width: 52px;
    min-width: 52px;
    max-width: 52px;
    height: 36px;
  }

  .theme-toggle-container :deep(.el-dropdown) {
    width: 52px;
    height: 36px;
  }

  .theme-toggle-container :deep(.el-dropdown > *),
  .theme-toggle-container :deep(.el-dropdown .el-tooltip__trigger) {
    width: 52px;
    min-width: 52px;
    max-width: 52px;
    height: 36px;
  }

  .theme-toggle-trigger-wrap {
    width: 52px;
    height: 36px;
  }

  .theme-toggle {
    width: 52px;
    height: 36px;
    min-width: 52px;
    min-height: 36px;
    padding: 6px;
  }

  .track {
    width: 52px;
    height: 36px;
  }

  .knob {
    width: 22px;
    height: 22px;
  }

  .knob > .theme-icon {
    width: 16px;
    height: 16px;
  }

  input:checked + .track .knob {
    transform: translateX(18px);
  }
}

@media (hover: none) and (pointer: coarse) {
  .theme-toggle {
    min-width: 44px;
    min-height: 44px;
    padding: 8px;
  }

  .theme-toggle:focus {
    outline-width: 3px;
  }
}
</style>

<style>
/* 强制主题切换容器与内部 track 完全重合，覆盖 Element Plus 默认包裹造成的偏移 */
.theme-toggle-container .el-dropdown {
  position: absolute;
  left: 0;
  top: 0;
  width: 52px;
  height: 28px;
  margin: 0;
  padding: 0;
}

.theme-toggle-container .el-dropdown > * {
  position: absolute;
  left: 0;
  top: 0;
  width: 52px;
  min-width: 52px;
  max-width: 52px;
  height: 28px;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.theme-toggle-container .theme-toggle-trigger-wrap {
  position: absolute;
  left: 0;
  top: 0;
  width: 52px;
  height: 28px;
  margin: 0;
  padding: 0;
}

/* 主题切换图标 - :where() 包裹祖先层级，特异性恒为 0 */
:where(label.theme-toggle .track .knob) .icon.sun-icon,
:where(label.theme-toggle .track .knob) .icon.moon-icon,
:where(label.theme-toggle .track .knob) svg.icon {
  position: absolute;
  width: var(--tt-icon-size);
  height: var(--tt-icon-size);
  top: var(--tt-icon-position);
  left: var(--tt-icon-position);
  margin: 0;
  padding: 0;
  inset: auto;
}

:where(label.theme-toggle .track .knob) .sun-icon {
  color: var(--tt-sun-color);
  opacity: 1;
}

:where(label.theme-toggle .track .knob) .moon-icon {
  color: var(--tt-moon-color);
  opacity: 0;
}

:where(label.theme-toggle) input:checked + .track .knob .sun-icon {
  opacity: 0;
}

:where(label.theme-toggle) input:checked + .track .knob .moon-icon {
  opacity: 1;
}

:where(html.dark) :where(label.theme-toggle) .track {
  background: var(--el-fill-color-darker);
}

:where(html.dark) :where(label.theme-toggle) .knob {
  background: var(--el-bg-color);
  box-shadow: var(--global-box-shadow);
}

:where(html.dark) :where(label.theme-toggle) .sun-icon {
  color: var(--el-color-warning-light-3);
}

:where(html.dark) :where(label.theme-toggle) .moon-icon {
  color: var(--el-color-white);
}

:where(html.dark) :where(label.theme-toggle) input:checked + .track .knob {
  background: var(--el-bg-color);
  box-shadow: var(--global-box-shadow);
}

.el-dropdown-menu__item.is-active {
  color: var(--el-color-primary);
  background-color: var(--el-fill-color-light);
}

.el-dropdown-menu__item .el-icon {
  margin-right: 8px;
}

.el-dropdown-menu[role="menu"] {
  min-width: 180px;
}
</style>
