<template>
  <div class="theme-shortcut-panel">
    <div class="panel-header">
      <h3>{{ t('themeShortcut.title') }}</h3>
      <el-button size="small" @click="resetToDefaults">
        {{ t('themeShortcut.resetDefaults') }}
      </el-button>
    </div>

    <div class="shortcut-list">
      <div class="shortcut-item" v-for="shortcut in shortcuts" :key="shortcut.id">
        <div class="shortcut-info">
          <span class="shortcut-name">{{ locale === 'zh-CN' ? shortcut.description : shortcut.descriptionEn }}</span>
          <el-tag size="small" :type="shortcut.enabled ? 'success' : 'info'">
            {{ shortcut.enabled ? t('themeShortcut.enabled') : t('themeShortcut.disabled') }}
          </el-tag>
        </div>
        <div class="shortcut-config">
          <div class="key-display">
            <kbd v-for="(key, index) in formatKeys(shortcut)" :key="index">{{ key }}</kbd>
          </div>
          <el-switch v-model="shortcut.enabled" @change="toggleShortcut(shortcut.id)" />
        </div>
      </div>
    </div>

    <div class="shortcut-tips">
      <p>{{ t('themeShortcut.tips') }}</p>
      <ul>
        <li>{{ t('themeShortcut.tip1') }}</li>
        <li>{{ t('themeShortcut.tip2') }}</li>
        <li>{{ t('themeShortcut.tip3') }}</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { themeShortcutManager, type ThemeShortcut } from '@/utils/themeShortcutManager'

const { t, locale } = useI18n()

const shortcuts = ref<ThemeShortcut[]>([])
let cleanup: (() => void) | null = null

onMounted(() => {
  loadShortcuts()
  cleanup = themeShortcutManager.init()
})

onUnmounted(() => {
  if (cleanup) {
    cleanup()
  }
})

function loadShortcuts(): void {
  shortcuts.value = themeShortcutManager.getShortcuts()
}

function toggleShortcut(id: string): void {
  themeShortcutManager.toggleShortcut(id)
  ElMessage.success(t('themeShortcut.shortcutUpdated'))
}

function resetToDefaults(): void {
  themeShortcutManager.resetShortcuts()
  loadShortcuts()
  ElMessage.success(t('themeShortcut.shortcutsReset'))
}

function formatKeys(shortcut: ThemeShortcut): string[] {
  const keys: string[] = []
  if (shortcut.modifiers.includes('ctrl')) keys.push('Ctrl')
  if (shortcut.modifiers.includes('alt')) keys.push('Alt')
  if (shortcut.modifiers.includes('shift')) keys.push('Shift')
  if (shortcut.modifiers.includes('meta')) keys.push('⌘')
  keys.push(shortcut.key.toUpperCase())
  return keys
}
</script>

<style lang="scss" scoped>
.theme-shortcut-panel {
  padding: var(--spacing-md);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);

  h3 {
    margin: 0;
    font-size: var(--font-size-lg);
    color: var(--el-text-color-primary);
  }
}

.shortcut-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}

.shortcut-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
}

.shortcut-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.shortcut-name {
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.shortcut-config {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.key-display {
  display: flex;
  gap: var(--spacing-xs);
}

.key-display kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 24px;
  padding: 0 var(--spacing-xs);
  background: var(--el-fill-color-light);
  border: var(--unified-border);
  border-radius: var(--global-border-radius-sm);
  font-family: inherit;
  font-size: var(--font-size-xs);
  color: var(--el-text-color-regular);
  box-shadow: var(--global-box-shadow);
}

.shortcut-tips {
  padding: var(--spacing-md);
  background: var(--el-fill-color-lighter);
  border-radius: var(--global-border-radius);
  font-size: var(--font-size-sm);
  color: var(--el-text-color-secondary);

  p {
    margin: 0 0 var(--spacing-sm);
    font-weight: 500;
  }

  ul {
    margin: 0;
    padding-left: var(--spacing-lg);
  }

  li {
    margin-bottom: var(--spacing-xs);
  }
}
</style>
