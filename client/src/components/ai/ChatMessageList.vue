<template>
  <div ref="listRef" class="message-list">
    <div v-if="messages.length === 0" class="empty-messages">
      <div class="empty-icon">
        <AIStarIcon :size="48" />
      </div>
      <div class="empty-text">{{ t('floatingChat.emptyMessages') }}</div>
      <div class="empty-hint">{{ t('floatingChat.emptyHint') }}</div>
    </div>

    <div v-else class="messages-container">
      <div
        v-for="message in messages"
        :key="message.id"
        class="message-item"
        :class="[`message-${message.role}`, { 'is-streaming': message.isStreaming }]"
      >
        <div class="message-avatar">
          <template v-if="message.role === 'user'">
            <el-avatar :size="32" :src="userAvatar">
              <el-icon><User /></el-icon>
            </el-avatar>
          </template>
          <template v-else>
            <div class="ai-avatar">
              <AIStarIcon :size="20" />
            </div>
          </template>
        </div>

        <div class="message-content">
          <div class="message-header">
            <span class="message-role">
              {{ message.role === 'user' ? t('common.user') : 'AI' }}
            </span>
            <span v-if="message.createTime" class="message-time">
              {{ formatTime(message.createTime) }}
            </span>
          </div>

          <div class="message-body">
            <template v-if="message.role === 'assistant'">
              <div v-if="message.metadata?.thinking" class="thinking-section">
                <div class="thinking-header" @click="toggleThinking(message.id)">
                  <el-icon><Brain /></el-icon>
                  <span>{{ t('floatingChat.thinking') }}</span>
                  <el-icon class="thinking-arrow" :class="{ 'is-expanded': isThinkingExpanded(message.id) }">
                    <ChevronDown />
                  </el-icon>
                </div>
                <div v-show="isThinkingExpanded(message.id)" class="thinking-content">
                  {{ message.metadata.thinking }}
                </div>
              </div>

              <div v-if="message.metadata?.images?.length" class="message-images">
                <el-image
                  v-for="(img, idx) in message.metadata.images"
                  :key="idx"
                  :src="img"
                  :preview-src-list="message.metadata.images"
                  fit="cover"
                  class="message-image"
                />
              </div>

              <div v-if="message.metadata?.videoUrl" class="message-video">
                <video :src="message.metadata.videoUrl" controls preload="none" class="video-player" />
              </div>
            </template>

            <!-- eslint-disable-next-line vue/no-v-html -->
            <div
              class="message-text"
              :class="{ 'is-markdown': message.role === 'assistant' }"
              v-html="formatContent(message)"
            ></div>

            <div v-if="message.isStreaming" class="streaming-indicator">
              <span class="streaming-dot"></span>
              <span class="streaming-dot"></span>
              <span class="streaming-dot"></span>
            </div>
          </div>

          <div v-if="message.role === 'assistant' && !message.isStreaming" class="message-actions">
            <el-button link size="small" :title="t('common.copy')" @click="copyMessage(message)">
              <el-icon><Copy /></el-icon>
            </el-button>
            <el-button link size="small" :title="t('floatingChat.reply')" @click="$emit('reply', message)">
              <el-icon><Reply /></el-icon>
            </el-button>
            <el-button
              v-if="message.metadata?.usage"
              link
              size="small"
              :title="t('floatingChat.tokenUsage')"
            >
              <el-icon><Info /></el-icon>
              <span class="token-count">
                {{ message.metadata.usage.totalTokens || 0 }} tokens
              </span>
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { User, Brain, ChevronDown, Copy, Reply, Info } from '@/lib/lucide-fallback'
import { AIStarIcon } from '@/components/icons'
import { ClipboardManager } from '@/utils/clipboard'
import { logger } from '@/utils/logger'
import type { ChatMessage } from '@/types/ai-platform.types'

const _props = defineProps<{
  messages: ChatMessage[]
  userAvatar?: string
  autoScroll?: boolean
}>()

const _emit = defineEmits<{
  (e: 'reply', message: ChatMessage): void
  (e: 'scrollToBottom'): void
}>()

const { t } = useI18n()
const listRef = ref<HTMLDivElement | null>(null)
const expandedThinking = ref<Set<string>>(new Set())

function formatContent(message: ChatMessage): string {
  if (message.role === 'user') {
    return DOMPurify.sanitize(message.content)
  }
  try {
    const html = marked.parse(message.content) as string
    return DOMPurify.sanitize(html)
  } catch {
    return DOMPurify.sanitize(message.content)
  }
}

function formatTime(time: string): string {
  if (!time) return ''
  try {
    const date = new Date(time)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function toggleThinking(messageId: string): void {
  if (expandedThinking.value.has(messageId)) {
    expandedThinking.value.delete(messageId)
  } else {
    expandedThinking.value.add(messageId)
  }
}

function isThinkingExpanded(messageId: string): boolean {
  return expandedThinking.value.has(messageId)
}

async function copyMessage(message: ChatMessage): Promise<void> {
  try {
    await ClipboardManager.copy(message.content)
    logger.info('[ChatMessageList] Message copied')
  } catch (error) {
    logger.error('[ChatMessageList] Failed to copy message:', error)
  }
}

function scrollToBottom(): void {
  nextTick(() => {
    if (listRef.value) {
      listRef.value.scrollTop = listRef.value.scrollHeight
    }
  })
}

watch(
  () => _props.messages,
  () => {
    if (_props.autoScroll !== false) {
      scrollToBottom()
    }
  },
  { deep: true }
)

defineExpose({ scrollToBottom, listRef })
</script>

<style scoped>
.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.empty-messages {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  color: var(--el-text-color-secondary);
}

.empty-icon {
  opacity: 0.5;
}

.empty-text {
  font-size: 16px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.empty-hint {
  font-size: 13px;
}

.messages-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.message-item {
  display: flex;
  gap: 12px;
}

.message-user {
  flex-direction: row-reverse;
}

.message-avatar {
  flex-shrink: 0;
}

.ai-avatar {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-color-primary);
  border-radius: var(--global-border-radius);
  color: var(--el-bg-color);
}

.message-content {
  flex: 1;
  min-width: 0;
  max-width: 80%;
}

.message-user .message-content {
  align-items: flex-end;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.message-user .message-header {
  flex-direction: row-reverse;
}

.message-role {
  font-size: 12px;
  font-weight: 500;
  color: var(--el-text-color-secondary);
}

.message-time {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}

.message-body {
  padding: 10px 14px;
  border-radius: var(--global-border-radius);
  background: var(--el-fill-color-light);
}

.message-user .message-body {
  background: var(--el-color-primary-light-9);
}

.message-text {
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
}

.message-text.is-markdown {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.message-text.is-markdown :deep(pre) {
  background: var(--el-fill-color-darker);
  padding: 12px;
  border-radius: var(--global-border-radius);
  overflow-x: auto;
}

.message-text.is-markdown :deep(code) {
  font-family: var(--font-family-mono);
  font-size: 13px;
}

.message-text.is-markdown :deep(p) {
  margin: 0 0 8px;
}

.message-text.is-markdown :deep(p:last-child) {
  margin-bottom: 0;
}

.thinking-section {
  margin-bottom: 8px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  overflow: hidden;
}

.thinking-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: var(--el-fill-color-light);
  cursor: pointer;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.thinking-header:hover {
  background: var(--el-fill-color);
}

.thinking-arrow {
  margin-left: auto;
  transition: transform 0.2s;
}

.thinking-arrow.is-expanded {
  transform: rotate(180deg);
}

.thinking-content {
  padding: 12px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-blank);
  border-top: var(--unified-border);
}

.message-images {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.message-image {
  width: 200px;
  height: 150px;
  border-radius: var(--global-border-radius);
  cursor: pointer;
}

.message-video {
  margin-bottom: 8px;
}

.video-player {
  width: 100%;
  max-width: 400px;
  border-radius: var(--global-border-radius);
}

.streaming-indicator {
  display: flex;
  gap: 4px;
  margin-top: 8px;
}

.streaming-dot {
  width: 6px;
  height: 6px;
  background: var(--el-color-primary);
  border-radius: 50%;
  animation: streaming 1.4s infinite ease-in-out both;
}

.streaming-dot:nth-child(1) { animation-delay: -0.32s; }
.streaming-dot:nth-child(2) { animation-delay: -0.16s; }

@keyframes streaming {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}

.message-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  opacity: 0;
  transition: opacity 0.2s;
}

.message-item:hover .message-actions {
  opacity: 1;
}

.token-count {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  margin-left: 2px;
}
</style>
