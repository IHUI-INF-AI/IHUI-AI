<template>
  <Transition name="session-list-slide">
    <div v-show="visible" class="session-list-panel" @click.stop>
      <div class="session-list-header">
        <span class="session-list-title">{{ t('floatingChat.history') }}</span>
        <el-button link size="small" class="session-list-close" :title="t('common.close')" @click="$emit('close')">
          <el-icon><X /></el-icon>
        </el-button>
      </div>
      <div class="session-list-content history-content">
        <div v-if="conversations.length === 0 && !loading" class="empty-history">
          <el-empty :description="t('floatingChat.noHistory')" />
        </div>
        <div v-else-if="loading" class="history-loading">
          <el-icon class="is-loading"><Loader2 /></el-icon>
          <span>{{ t('floatingChat.loadingHistory') }}</span>
        </div>
        <div v-else class="history-list">
          <div
            v-for="conversation in conversations"
            :key="conversation.id"
            class="history-item"
            :class="{ 'is-active': currentId === conversation.id }"
            @click="$emit('select', conversation.id)"
          >
            <div class="history-title">{{ conversation.title }}</div>
            <div class="history-meta">
              <span class="history-time">{{ formatTime(conversation.createTime) }}</span>
            </div>
            <div class="history-actions" @click.stop>
              <el-button
                link
                size="small"
                :title="t('common.delete')"
                @click.stop.prevent="$emit('delete', conversation.id)"
              >
                <el-icon><Trash2 /></el-icon>
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { X, Loader2, Trash2 } from '@/lib/lucide-fallback'

export interface ConversationItem {
  id: string
  title: string
  createTime: string
}

const _props = defineProps<{
  visible?: boolean
  conversations?: ConversationItem[]
  currentId?: string | null
  loading?: boolean
}>()

const _emit = defineEmits<{
  (e: 'close'): void
  (e: 'select', id: string): void
  (e: 'delete', id: string): void
}>()

const { t } = useI18n()

function formatTime(time: string): string {
  if (!time) return ''
  try {
    const date = new Date(time)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60))
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60))
        return minutes <= 1 ? t('common.justNow') : `${minutes}${t('common.minutesAgo')}`
      }
      return `${hours}${t('common.hoursAgo')}`
    }
    if (days === 1) return t('common.yesterday')
    if (days < 7) return `${days}${t('common.daysAgo')}`
    return date.toLocaleDateString()
  } catch {
    return time
  }
}
</script>

<style scoped>
.session-list-panel {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 280px;
  background: var(--el-bg-color);
  border-right: var(--unified-border);
  z-index: calc(var(--z-base) + 9);
  display: flex;
  flex-direction: column;
}

.session-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: var(--unified-border-bottom);
}

.session-list-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.session-list-close {
  /* 尺寸与正方形由全局 _buttons-unified 的 .session-list-close 统一 */
}

.session-list-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.empty-history {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}

.history-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  gap: 8px;
  color: var(--el-text-color-secondary);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.history-item {
  display: flex;
  flex-direction: column;
  padding: 10px 12px;
  border-radius: var(--global-border-radius);
  cursor: pointer;
  transition: background-color 0.2s;
}

.history-item:hover {
  background: var(--el-fill-color-light);
}

.history-item.is-active {
  background: var(--el-color-primary-light-9);
}

.history-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
}

.history-time {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.history-actions {
  opacity: 0;
  transition: opacity 0.2s;
}

.history-item:hover .history-actions {
  opacity: 1;
}

.session-list-slide-enter-active,
.session-list-slide-leave-active {
  transition: transform 0.3s ease;
}

.session-list-slide-enter-from,
.session-list-slide-leave-to {
  transform: translateX(-100%);
}
</style>
