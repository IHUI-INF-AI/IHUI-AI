<template>
  <div
    ref="headerRef"
    class="dialog-header"
    @mousedown="draggable && mode === 'floating' ? $emit('startDrag', $event) : undefined"
    @dblclick="showMinimize ? $emit('toggleMinimize') : undefined"
  >
    <div class="header-left">
      <el-button
        v-if="!isMinimized"
        link
        size="small"
        class="header-btn session-list-btn"
        :title="t('floatingChat.history')"
        @click="$emit('toggleSessionList')"
        @mousedown.stop
      >
        <el-icon><List /></el-icon>
      </el-button>

      <template v-if="isMinimized">
        <div class="minimized-model-info">
          <img
            v-if="selectedModel?.icon"
            :src="selectedModel.icon"
            alt="Model Icon"
            class="minimized-model-icon"
          />
          <AIStarIcon v-else class="minimized-model-icon-fallback" :size="14" />
          <span class="minimized-model-name">
            {{ selectedModel ? getModelDisplayName(selectedModel) : t('floatingChat.selectModel') }}
          </span>
        </div>
      </template>

      <template v-else>
        <span v-if="isTyping" class="typing-indicator">
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
        </span>
      </template>
    </div>

    <div v-if="!isMinimized" class="header-center">
      <el-tag
        size="small"
        class="mode-tag"
        :type="currentAIMode === 'model' && selectedModel ? getModelTagType(selectedModel) : getModeTagType(currentAIMode)"
      >
        <template v-if="currentAIMode === 'model' && selectedModel">
          <img v-if="selectedModel.icon" :src="selectedModel.icon" :alt="getModelDisplayName(selectedModel)" class="mode-tag-icon" />
          <AIStarIcon v-else class="mode-tag-icon" :size="14" />
          <span>{{ getModelDisplayName(selectedModel) }}</span>
        </template>

        <template v-else-if="currentAIMode === 'model' && !selectedModel">
          <AIStarIcon class="mode-tag-icon" :size="14" />
          <span>{{ t('floatingChat.selectModel') }}</span>
        </template>

        <template v-else-if="currentAIMode === 'agent'">
          <el-icon class="mode-tag-icon"><MagicStick /></el-icon>
          <span>{{ selectedAgent ? selectedAgent.name : getModeLabel(currentAIMode) }}</span>
        </template>

        <template v-else-if="currentAIMode === 'agentic'">
          <el-icon class="mode-tag-icon"><Network /></el-icon>
          <span>{{ getModeLabel(currentAIMode) }}</span>
        </template>

        <template v-else-if="currentAIMode === 'mcp'">
          <el-icon class="mode-tag-icon"><Wrench /></el-icon>
          <span>{{ getModeLabel(currentAIMode) }}</span>
        </template>

        <template v-else-if="currentAIMode === 'hybrid'">
          <el-icon class="mode-tag-icon"><Zap /></el-icon>
          <span>{{ getModeLabel(currentAIMode) }}</span>
        </template>
      </el-tag>
    </div>

    <div class="header-right">
      <div v-if="isCustomServiceTheme && !isMinimized" class="cs-status-wrap">
        <span class="cs-status-indicator" :class="csConnectionStatus">
          <span class="cs-status-ring"></span>
          <span class="cs-status-dot"></span>
        </span>
        <span class="cs-status-text">{{ csConnectionStatusText }}</span>
      </div>

      <el-button
        v-if="enableSearch && !isMinimized"
        link
        size="small"
        class="header-btn search-btn"
        :title="t('floatingChat.search')"
        @click="$emit('toggleSearch')"
        @mousedown.stop
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="header-svg-icon">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="22" y1="22" x2="16.65" y2="16.65"></line>
        </svg>
      </el-button>

      <el-dropdown
        v-if="!isMinimized"
        trigger="click"
        class="header-menu"
        popper-class="ai-chat-popper"
        @command="$emit('menuCommand', $event)"
      >
        <el-button link size="small" class="header-btn" @mousedown.stop :title="t('common.moreActions')">
          <el-icon><MoreHorizontal /></el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="export">
              <el-icon><Download /></el-icon>
              <span>{{ t('floatingChat.exportChat') }}</span>
            </el-dropdown-item>
            <el-dropdown-item command="export-markdown">
              <el-icon><Download /></el-icon>
              <span>{{ t('floatingChat.exportMarkdown') }}</span>
            </el-dropdown-item>
            <el-dropdown-item command="export-json">
              <el-icon><Download /></el-icon>
              <span>{{ t('floatingChat.exportJSON') }}</span>
            </el-dropdown-item>
            <el-dropdown-item command="history">
              <el-icon><FileText /></el-icon>
              <span>{{ t('floatingChat.history') }}</span>
            </el-dropdown-item>
            <el-dropdown-item command="stats">
              <el-icon><BarChart3 /></el-icon>
              <span>{{ t('floatingChat.stats') }}</span>
            </el-dropdown-item>
            <el-dropdown-item v-if="showTicketsEntry" command="tickets">
              <el-icon><Ticket /></el-icon>
              <span>MY TICKETS</span>
            </el-dropdown-item>
            <el-dropdown-item command="customer-service">
              <el-icon><Headset /></el-icon>
              <span>{{ t('navigation.customerService') || '客户服务' }}</span>
            </el-dropdown-item>
            <el-dropdown-item command="clear" divided>
              <el-icon><Trash2 /></el-icon>
              <span>{{ t('floatingChat.clearChat') }}</span>
            </el-dropdown-item>
            <el-dropdown-item command="settings">
              <el-icon><Settings /></el-icon>
              <span>{{ t('floatingChat.settings') }}</span>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <el-button
        v-if="showMinimize"
        link
        size="small"
        class="header-btn minimize-btn"
        :title="isMinimized ? t('floatingChat.maximize') : t('floatingChat.minimize')"
        @click="$emit('toggleMinimize')"
        @mousedown.stop
      >
        <svg
          v-if="isMinimized"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          class="header-svg-icon"
        >
          <polyline points="15 3 21 3 21 9"></polyline>
          <polyline points="9 21 3 21 3 15"></polyline>
          <line x1="21" y1="3" x2="14" y2="10"></line>
          <line x1="3" y1="21" x2="10" y2="14"></line>
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="header-svg-icon">
          <polyline points="4 14 10 14 10 20"></polyline>
          <polyline points="20 10 14 10 14 4"></polyline>
          <line x1="14" y1="10" x2="21" y2="3"></line>
          <line x1="3" y1="21" x2="10" y2="14"></line>
        </svg>
      </el-button>

      <el-button
        v-if="showClose"
        link
        size="small"
        class="header-btn close-btn"
        :title="t('common.close')"
        @click="$emit('close')"
        @mousedown.stop
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="header-svg-icon">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import {
  List,
  Download,
  FileText,
  BarChart3,
  Ticket,
  Headset,
  Trash2,
  Settings,
  MoreHorizontal,
  MagicStick,
  Network,
  Wrench,
  Zap,
} from '@/lib/lucide-fallback'
import { AIStarIcon } from '@/components/icons'
import type { Model } from '@/types/api'
import type { Agent } from '@/api/agent/agents'

type AIMode = 'model' | 'agent' | 'agentic' | 'mcp' | 'hybrid' | 'generation'

const _props = defineProps<{
  mode?: 'floating' | 'embedded'
  isMinimized?: boolean
  isTyping?: boolean
  draggable?: boolean
  showMinimize?: boolean
  showClose?: boolean
  enableSearch?: boolean
  isCustomServiceTheme?: boolean
  csConnectionStatus?: 'connected' | 'connecting' | 'danger'
  csConnectionStatusText?: string
  showTicketsEntry?: boolean
  currentAIMode?: AIMode
  selectedModel?: Model | null
  selectedAgent?: Agent | null
}>()

const _emit = defineEmits<{
  (e: 'startDrag', event: MouseEvent): void
  (e: 'toggleMinimize'): void
  (e: 'toggleSessionList'): void
  (e: 'toggleSearch'): void
  (e: 'menuCommand', command: string): void
  (e: 'close'): void
}>()

const { t } = useI18n()

function getModelDisplayName(model: Model): string {
  return model.displayName || model.name || model.modelId || 'Unknown Model'
}

function getModelTagType(model: Model): '' | 'success' | 'warning' | 'danger' | 'info' {
  const provider = model.provider?.toLowerCase() || ''
  if (provider.includes('openai')) return 'success'
  if (provider.includes('anthropic')) return 'warning'
  if (provider.includes('google')) return 'info'
  return ''
}

function getModeTagType(mode: AIMode): '' | 'success' | 'warning' | 'danger' | 'info' {
  const typeMap: Record<string, '' | 'success' | 'warning' | 'danger' | 'info'> = {
    agent: 'success',
    agentic: 'warning',
    mcp: 'info',
    hybrid: '',
  }
  return typeMap[mode] || ''
}

function getModeLabel(mode: AIMode): string {
  const labels: Record<string, string> = {
    model: t('floatingChat.modeModel'),
    agent: t('floatingChat.modeAgent'),
    agentic: t('floatingChat.modeAgentic'),
    mcp: t('floatingChat.modeMCP'),
    hybrid: t('floatingChat.modeHybrid'),
  }
  return labels[mode] || mode
}
</script>

<style scoped>
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--el-bg-color);
  border-bottom: var(--unified-border-bottom);
  cursor: move;
  user-select: none;
}

.header-left,
.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-center {
  flex: 1;
  display: flex;
  justify-content: center;
}

.header-btn {
  padding: 4px;
  color: var(--el-text-color-regular);
}

.header-btn:hover {
  color: var(--el-color-primary);
}

.header-svg-icon {
  width: 16px;
  height: 16px;
}

.mode-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.mode-tag-icon {
  width: 14px;
  height: 14px;
}

.minimized-model-info {
  display: flex;
  align-items: center;
  gap: 6px;
}

.minimized-model-icon {
  width: 18px;
  height: 18px;
  border-radius: var(--global-border-radius);
}

.minimized-model-icon-fallback {
  color: var(--el-color-primary);
}

.minimized-model-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.typing-indicator {
  display: flex;
  gap: 3px;
}

.typing-dot {
  width: 6px;
  height: 6px;
  background: var(--el-color-primary);
  border-radius: 50%;
  animation: typing 1.4s infinite ease-in-out both;
}

.typing-dot:nth-child(1) { animation-delay: -0.32s; }
.typing-dot:nth-child(2) { animation-delay: -0.16s; }

@keyframes typing {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}

.cs-status-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-right: 8px;
}

.cs-status-indicator {
  position: relative;
  width: 8px;
  height: 8px;
}

.cs-status-ring {
  position: absolute;
  inset: -2px;
  border-radius: 50%;
  border: var(--unified-border);
  opacity: 0.3;
}

.cs-status-dot {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: currentcolor;
}

.cs-status-indicator.connected { color: var(--color-success); }
.cs-status-indicator.connecting { color: var(--color-warning-variant); }
.cs-status-indicator.danger { color: var(--color-danger-variant); }

.cs-status-text {
  font-size: 11px;
  font-family: monospace;
  color: var(--el-text-color-secondary);
}
</style>
