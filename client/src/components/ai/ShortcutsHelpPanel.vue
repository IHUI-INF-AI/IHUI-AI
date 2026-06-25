<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="showHelpPanel"
        class="shortcuts-help-overlay"
        @click.self="closePanel"
      >
        <div class="shortcuts-help-panel">
          <!-- 标题栏 -->
          <div class="panel-header">
            <h3 class="panel-title">
              <el-icon><Key /></el-icon>
              <span>{{ t('shortcuts.title') }}</span>
            </h3>
            <el-button
              link
              circle
              size="small"
              @click="closePanel"
            >
              <el-icon><Close /></el-icon>
            </el-button>
          </div>

          <!-- 搜索框 - 使用全局统一样式 -->
          <div class="panel-search unified-search-bar">
            <el-input
              v-model="searchQuery"
              :placeholder="t('shortcuts.search')"
              clearable
            >
              <template #prefix>
                <SearchIcon />
              </template>
            </el-input>
          </div>

          <!-- 快捷键列表 -->
          <div class="panel-content">
            <template v-for="group in filteredGroups" :key="group.category">
              <div class="shortcut-group">
                <div class="group-title">
                  <el-icon>
                    <component :is="getCategoryIcon(group.category)" />
                  </el-icon>
                  <span>{{ group.label }}</span>
                </div>
                <div class="shortcut-list">
                  <div
                    v-for="shortcut in group.shortcuts"
                    :key="shortcut.id"
                    class="shortcut-item"
                    :class="{ 'is-disabled': !shortcut.enabled }"
                  >
                    <div class="shortcut-info">
                      <span class="shortcut-description">{{ shortcut.description }}</span>
                      <el-tag
                        v-if="shortcut.scope && shortcut.scope !== 'global'"
                        size="small"
                        type="info"
                      >
                        {{ getScopeLabel(shortcut.scope) }}
                      </el-tag>
                    </div>
                    <div class="shortcut-keys">
                      <kbd
                        v-for="(key, index) in formatShortcutKeys(shortcut.key, shortcut.modifiers)"
                        :key="index"
                        class="key-badge"
                      >
                        {{ key }}
                      </kbd>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <!-- 空状态 -->
            <div v-if="filteredGroups.length === 0" class="empty-state">
              <el-empty :description="t('shortcuts.noResults')" />
            </div>
          </div>

          <!-- 底部提示 -->
          <div class="panel-footer">
            <span class="footer-tip">
              <kbd class="key-badge small">Ctrl</kbd>
              <span>+</span>
              <kbd class="key-badge small">/</kbd>
              <span>{{ t('shortcuts.toggleTip') }}</span>
            </span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Key,
  Close,
  ChatDotRound,
  Picture,
  Film,
  Compass,
  Edit,
  Setting,
} from '@element-plus/icons-vue'
import SearchIcon from '@/components/common/SearchIcon.vue'
import { useGlobalShortcuts } from '@/composables/useGlobalShortcuts'
import type { Component } from 'vue'

// ============================================================================
// Setup
// ============================================================================

const { t } = useI18n()
const { showHelpPanel, getGroupedShortcuts } = useGlobalShortcuts()

// ============================================================================
// 状态
// ============================================================================

const searchQuery = ref('')

// ============================================================================
// 计算属性
// ============================================================================

/** 过滤后的快捷键组 */
const filteredGroups = computed(() => {
  const groups = getGroupedShortcuts.value
  
  if (!searchQuery.value.trim()) {
    return groups
  }
  
  const query = searchQuery.value.toLowerCase()
  
  return groups.map(group => ({
    ...group,
    shortcuts: group.shortcuts.filter(shortcut =>
      shortcut.description.toLowerCase().includes(query) ||
      shortcut.key.toLowerCase().includes(query)
    ),
  })).filter(group => group.shortcuts.length > 0)
})

// ============================================================================
// 方法
// ============================================================================

/** 关闭面板 */
const closePanel = () => {
  showHelpPanel.value = false
}

/** 获取分类图标 */
const getCategoryIcon = (category: string): Component => {
  const icons: Record<string, Component> = {
    general: Setting,
    chat: ChatDotRound,
    generation: Picture,
    drama: Film,
    navigation: Compass,
    editing: Edit,
  }
  return icons[category] || Setting
}

/** 获取范围标签 */
const getScopeLabel = (scope: string): string => {
  const labels: Record<string, string> = {
    chat: t('shortcuts.scopes.chat'),
    drama: t('shortcuts.scopes.drama'),
    editor: t('shortcuts.scopes.editor'),
    input: t('shortcuts.scopes.input'),
  }
  return labels[scope] || scope
}

/** 格式化快捷键按键 */
const formatShortcutKeys = (key: string, modifiers?: Record<string, boolean>): string[] => {
  const keys: string[] = []
  const isMac = navigator.platform.toLowerCase().includes('mac')
  
  if (modifiers?.ctrl) {
    keys.push(isMac ? '⌃' : 'Ctrl')
  }
  if (modifiers?.alt) {
    keys.push(isMac ? '⌥' : 'Alt')
  }
  if (modifiers?.shift) {
    keys.push(isMac ? '⇧' : 'Shift')
  }
  if (modifiers?.meta) {
    keys.push(isMac ? '⌘' : 'Win')
  }
  
  // 格式化按键名称
  let keyDisplay = key.toUpperCase()
  const specialKeys: Record<string, string> = {
    ENTER: '↵',
    ESCAPE: 'Esc',
    BACKSPACE: '⌫',
    DELETE: 'Del',
    ARROWUP: '↑',
    ARROWDOWN: '↓',
    ARROWLEFT: '←',
    ARROWRIGHT: '→',
    TAB: '⇥',
    SPACE: '␣',
  }
  if (specialKeys[keyDisplay]) {
    keyDisplay = specialKeys[keyDisplay]
  }
  
  keys.push(keyDisplay)
  
  return keys
}

// 监听ESC关闭
watch(showHelpPanel, (visible) => {
  if (visible) {
    searchQuery.value = ''
  }
})
</script>

<style scoped lang="scss">
.shortcuts-help-overlay {
  position: fixed;
  inset: 0;
  background: var(--color-black-50);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-notification);
}

.shortcuts-help-panel {
  width: 600px;
  max-width: 90vw;
  max-height: 80vh;
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: var(--unified-border-bottom);
  
  .panel-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    
    .el-icon {
      font-size: 20px;
      color: var(--el-color-primary);
    }
  }
}

.panel-search {
  padding: 12px 20px;
  border-bottom: var(--unified-border-bottom);
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.shortcut-group {
  margin-bottom: 20px;
  
  &:last-child {
    margin-bottom: 0;
  }
}

.group-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: var(--unified-border-bottom);
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  
  .el-icon {
    font-size: 16px;
    color: var(--el-color-primary);
  }
}

.shortcut-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shortcut-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: var(--global-border-radius);
  background: var(--el-fill-color-light);
  transition: background-color 0.2s;
  
  &:hover {
    background: var(--el-fill-color);
  }
  
  &.is-disabled {
    opacity: 0.5;
  }
}

.shortcut-info {
  display: flex;
  align-items: center;
  gap: 8px;
  
  .shortcut-description {
    font-size: 14px;
    color: var(--el-text-color-regular);
  }
}

.shortcut-keys {
  display: flex;
  align-items: center;
  gap: 4px;
}

.key-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  padding: 0 8px;
  border-radius: var(--global-border-radius);
  background: var(--el-bg-color);
  border: var(--unified-border);
  font-family: monospace;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  
  &.small {
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    font-size: 12px;
  }
}

.empty-state {
  padding: 40px 0;
}

.panel-footer {
  padding: 12px 20px;
  border-top: var(--unified-border);
  background: var(--el-fill-color-lighter);
  
  .footer-tip {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
}

// 过渡动画
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
