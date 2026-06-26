<template>
  <div class="theme-preview-container">
    <div class="preview-header">
      <h4>{{ t('themePreview.title') }}</h4>
      <el-button text size="small" @click="closePreview">
        <el-icon><Close /></el-icon>
      </el-button>
    </div>

    <div class="preview-modes">
      <div
        v-for="mode in previewModes"
        :key="mode.value"
        class="preview-mode-card"
        :class="{ active: currentPreview === mode.value }"
        @click="previewMode(mode.value)"
        @mouseenter="previewMode(mode.value)"
      >
        <div class="preview-frame" :class="mode.value">
          <div class="preview-navbar">
            <div class="preview-logo"></div>
            <div class="preview-nav-items">
              <span class="preview-nav-item"></span>
              <span class="preview-nav-item"></span>
              <span class="preview-nav-item"></span>
            </div>
          </div>
          <div class="preview-content">
            <div class="preview-sidebar">
              <span class="preview-sidebar-item"></span>
              <span class="preview-sidebar-item"></span>
              <span class="preview-sidebar-item"></span>
            </div>
            <div class="preview-main">
              <div class="preview-card"></div>
              <div class="preview-card"></div>
              <div class="preview-text"></div>
            </div>
          </div>
        </div>
        <span class="preview-mode-name">{{ mode.label }}</span>
      </div>
    </div>

    <div class="preview-actions">
      <el-button @click="applyPreview" type="primary" :disabled="!currentPreview">
        {{ t('themePreview.apply') }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Close } from '@element-plus/icons-vue'
import { useDarkModeStore, type ThemeMode } from '@/stores/darkMode'

const emit = defineEmits<{
  close: []
  apply: [mode: ThemeMode]
}>()

const { t } = useI18n()
const darkModeStore = useDarkModeStore()

const currentPreview = ref<ThemeMode | null>(null)
const _originalMode = ref<ThemeMode>(darkModeStore.themeMode)

const previewModes = computed(() => [
  { value: 'light' as ThemeMode, label: t('themeToggle.lightMode') },
  { value: 'dark' as ThemeMode, label: t('themeToggle.darkMode') },
  { value: 'auto' as ThemeMode, label: t('themeToggle.autoMode') },
  { value: 'high-contrast-light' as ThemeMode, label: t('themeToggle.highContrastLight') },
  { value: 'high-contrast-dark' as ThemeMode, label: t('themeToggle.highContrastDark') }
])

const previewMode = (mode: ThemeMode) => {
  currentPreview.value = mode
}

const applyPreview = () => {
  if (currentPreview.value) {
    darkModeStore.setThemeMode(currentPreview.value, 'user', true)
    emit('apply', currentPreview.value)
  }
}

const closePreview = () => {
  emit('close')
}

onMounted(() => {
  currentPreview.value = darkModeStore.themeMode
})

onUnmounted(() => {
})
</script>

<style scoped>
.theme-preview-container {
  padding: 16px;
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  }

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.preview-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.preview-modes {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.preview-mode-card {
  cursor: pointer;
  border: 2px solid transparent;
  border-radius: var(--global-border-radius);
  padding: 8px;
  transition: border-color 0.2s ease, border-width 0.2s ease;
}

.preview-mode-card:hover {
  border-color: var(--el-color-primary-light-5);
}

.preview-mode-card.active {
  border: var(--el-border-width-primary) solid var(--el-color-primary);
}

.preview-frame {
  width: 100%;
  aspect-ratio: 4/3;
  border-radius: var(--global-border-radius);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.preview-frame.light {
  background: var(--el-bg-color);
}

.preview-frame.dark {
  background: var(--color-dark-bg-2);
}

.preview-frame.auto {
  background: var(--el-bg-color);
}

.preview-frame.high-contrast-light {
  background: var(--el-bg-color);
  border: var(--unified-border);
}

.preview-frame.high-contrast-dark {
  background: var(--el-text-color-primary);
  border: var(--unified-border);
}

.preview-navbar {
  height: 20%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  border-bottom: var(--unified-border-bottom);
}

.preview-logo {
  width: 20%;
  height: 60%;
  background: var(--el-color-primary);
  border-radius: var(--global-border-radius);
}

.preview-nav-items {
  display: flex;
  gap: 4px;
}

.preview-nav-item {
  width: 15%;
  height: 40%;
  background: color-mix(in srgb, var(--el-border-color) 30%, transparent);
  border-radius: var(--global-border-radius);
}

.preview-content {
  flex: 1;
  display: flex;
}

.preview-sidebar {
  width: 25%;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border-right: var(--unified-border);
}

.preview-sidebar-item {
  height: 15%;
  background: color-mix(in srgb, var(--el-border-color) 20%, transparent);
  border-radius: var(--global-border-radius);
}

.preview-main {
  flex: 1;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preview-card {
  height: 25%;
  background: color-mix(in srgb, var(--el-border-color) 15%, transparent);
  border-radius: var(--global-border-radius);
}

.preview-text {
  flex: 1;
  background: color-mix(in srgb, var(--el-border-color) 10%, transparent);
  border-radius: var(--global-border-radius);
}

.preview-mode-name {
  display: block;
  text-align: center;
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.preview-actions {
  display: flex;
  justify-content: flex-end;
}

@media (width <= 768px) {
  .preview-modes {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (width <= 480px) {
  .preview-modes {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
