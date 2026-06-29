<template>
  <!-- 左侧滑出的会话列表面板 -->
  <Transition name="session-list-slide">
    <div v-show="showSessionList" class="session-list-panel" @click.stop>
      <div class="session-list-header">
        <span class="session-list-title">{{ t('floatingChat.history') }}</span>
        <el-button link size="small" class="session-list-close" @click="emit('close')"
          :title="t('common.close')">
          <el-icon>
            <X />
          </el-icon>
        </el-button>
      </div>
      <div class="session-list-content history-content">
        <div v-if="conversations.length === 0 && !loading" class="empty-history">
          <el-empty :description="t('floatingChat.noHistory')" />
        </div>
        <div v-else-if="loading" class="history-loading">
          <el-icon class="is-loading">
            <Loader2 />
          </el-icon>
          <span>{{ t('floatingChat.loadingHistory') }}</span>
        </div>
        <div v-else class="history-list">
          <div v-for="conversation in conversations" :key="conversation.id"
            class="history-item" :class="{ 'is-active': currentConversationId === conversation.id }"
            @click="emit('select-session', conversation.id)">
            <div class="history-title">{{ conversation.title }}</div>
            <div class="history-meta">
              <span class="history-time">{{ formatTime(conversation.createTime) }}</span>
            </div>
            <div class="history-actions" @click.stop>
              <el-button link size="small" @click.stop.prevent="emit('delete-session', conversation.id)"
                :title="t('common.delete')">
                <el-icon>
                  <Trash2 />
                </el-icon>
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

/** 会话历史项类型（与 AIChat.vue 的 conversationHistory 项保持一致） */
interface ConversationItem {
  id: string
  title: string
  createTime: string
}

interface Props {
  /** 是否显示会话列表面板 */
  showSessionList: boolean
  /** 会话历史列表 */
  conversations: ConversationItem[]
  /** 是否正在加载历史 */
  loading: boolean
  /** 当前会话 ID（用于高亮） */
  currentConversationId: string | null
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'select-session', id: string): void
  (e: 'delete-session', id: string): void
}>()

const { t } = useI18n()

/** 格式化时间：相对时间（刚刚/分钟前/小时前/天前）或绝对时间（超过 7 天） */
const formatTime = (time: string) => {
  const date = new Date(time)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return t('floatingChat.justNow')
  if (minutes < 60) return t('floatingChat.minutesAgo', { minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('floatingChat.hoursAgo', { hours })
  const days = Math.floor(hours / 24)
  if (days < 7) return t('floatingChat.daysAgo', { days })
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>
