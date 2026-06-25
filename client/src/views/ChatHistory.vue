<template>
  <div class="chat-history-container page-container">
    <el-container>
      <el-aside width="300px" class="chat-sidebar">
        <div class="sidebar-header">
          <h3>{{ t('chatHistory.title') }}</h3>
          <el-button size="small" circle @click="handleCreateSession">
            <el-icon><Plus /></el-icon>
          </el-button>
        </div>

        <div class="sidebar-search">
          <el-input
            v-model="searchKeyword"
            :placeholder="t('chatHistory.searchPlaceholder')"
            clearable
            @input="handleSearch"
          >
            <template #prefix>
              <SearchIcon />
            </template>
          </el-input>
        </div>

        <div class="session-list" v-loading="loadingSessions">
          <el-empty
            v-if="!loadingSessions && filteredSessions.length === 0"
            :description="t('chatHistory.noSessions')"
          />
          <div
            v-for="session in filteredSessions"
            :key="session.id"
            class="session-item"
            :class="{ active: currentSessionId === session.id }"
            @click="selectSession(session)"
          >
            <div class="session-header">
              <el-icon class="session-icon"><ChatLineRound /></el-icon>
              <div class="session-info">
                <div class="session-title">{{ session.title }}</div>
                <div class="session-meta">
                  <span v-if="session.model">{{ session.model }}</span>
                  <span class="message-count">
                    {{ session.messageCount }} {{ t('chatHistory.messages') }}
                  </span>
                </div>
              </div>
            </div>
            <div class="session-actions">
              <el-button link size="small" @click.stop="handleDeleteSession(session)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
            <div class="session-time">
              {{ formatTime(session.updatedAt || session.createdAt) }}
            </div>
          </div>
        </div>
      </el-aside>

      <el-main class="chat-main">
        <div v-if="!currentSessionId" class="empty-state">
          <el-empty :description="t('chatHistory.selectSession')" />
        </div>

        <div v-else class="chat-messages-container">
          <div class="messages-header">
            <div class="session-title-bar">
              <h4>{{ currentSession?.title }}</h4>
              <div class="header-actions">
                <el-button link @click="handleRenameSession">
                  <el-icon><Edit /></el-icon>
                  {{ t('chatHistory.rename') }}
                </el-button>
                <el-button link @click="handleExportSession">
                  <el-icon><Download /></el-icon>
                  {{ t('chatHistory.export.title') }}
                </el-button>
                <el-button link @click="handleDeleteCurrentSession">
                  <el-icon><Delete /></el-icon>
                  {{ t('chatHistory.delete') }}
                </el-button>
              </div>
            </div>
          </div>

          <div class="messages-list" ref="messagesListRef" v-loading="loadingMessages">
            <el-empty
              v-if="!loadingMessages && messages.length === 0"
              :description="t('chatHistory.noMessages')"
            />
            <div v-for="message in messages" :key="message.id" class="message-item">
              <div v-if="message.role === 'user'" class="message-user">
                <el-avatar :size="32">
                  <el-icon><User /></el-icon>
                </el-avatar>
                <div class="message-content user-message">
                  {{ message.content }}
                </div>
              </div>
              <div v-else-if="message.role === 'assistant'" class="message-ai">
                <el-avatar :size="32">
                  <el-icon><Service /></el-icon>
                </el-avatar>
                <div class="message-content ai-message">
                  <!-- eslint-disable-next-line vue/no-v-html -->
                  <div
                    v-if="message.isMarkdown"
                    class="markdown-content"
                    v-html="formatMarkdown(message.content)"
                  ></div>
                  <div v-else class="text-content">{{ message.content }}</div>
                  <div v-if="message.usage" class="message-usage">
                    {{
                      t('chatHistory.tokensUsed', {
                        total: message.usage.totalTokens,
                        prompt: message.usage.promptTokens,
                        completion: message.usage.completionTokens,
                      })
                    }}
                  </div>
                </div>
              </div>
              <div v-else-if="message.role === 'system'" class="message-system">
                <div class="message-content system-message">
                  {{ message.content }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </el-main>
    </el-container>

    <el-dialog v-model="showCreateDialog" :title="t('chatHistory.createSession')" width="400px">
      <el-form :model="newSessionForm" label-width="80px">
        <el-form-item :label="t('chatHistory.sessionTitle')">
          <el-input
            v-model="newSessionForm.title"
            :placeholder="t('chatHistory.sessionTitlePlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('chatHistory.selectModel')">
          <el-select
            v-model="newSessionForm.modelId"
            :placeholder="t('chatHistory.selectModelPlaceholder')"
            style="width: 100%"
          >
            <el-option
              v-for="model in availableModels"
              :key="model.id"
              :label="model.displayName || model.name"
              :value="model.id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">{{ t('common.cancel') }}</el-button>
        <el-button @click="confirmCreateSession">{{ t('common.confirm') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showRenameDialog" :title="t('chatHistory.renameSession')" width="400px">
      <el-form :model="renameForm" label-width="80px">
        <el-form-item :label="t('chatHistory.sessionTitle')">
          <el-input
            v-model="renameForm.title"
            :placeholder="t('chatHistory.sessionTitlePlaceholder')"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRenameDialog = false">{{ t('common.cancel') }}</el-button>
        <el-button @click="confirmRenameSession">{{ t('common.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
 
import { ref, computed, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Plus,
  ChatLineRound,
  Delete,
  Edit,
  Download,
  User,
  Service,
} from '@/lib/lucide-fallback'
import SearchIcon from '@/components/common/SearchIcon.vue'
import {
  getConversations,
  getConversationMessages,
  createConversation,
  deleteConversation,
  updateConversationTitle,
  type Conversation,
  type ChatMessage,
} from '@/api/chat/chat-history'
import { getAvailableModels, type AIModelInfo } from '@/api/models/models'
import { formatTime } from '@/utils/format'
import DOMPurify from 'dompurify'
import { logger } from '@/utils/logger'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { useDebounceSearch } from '@/composables/useDebounceSearch'
import { useApiError } from '@/composables/useApiError'

const { t } = useI18n()
const { handleResult, showSuccess, showError: showErrorMsg, showWarning } = useOperationFeedback()
const { confirmDelete } = useConfirmDialog()

const { loading: loadingSessions, execute: executeSessionsApi } = useApiError({ showMessage: false })
const { loading: loadingMessages, execute: executeMessagesApi } = useApiError({ showMessage: false })
const sessions = ref<Conversation[]>([])
const currentSessionId = ref<string | null>(null)
const currentSession = ref<Conversation | null>(null)
const messages = ref<(ChatMessage & { userContent?: string; isMarkdown?: boolean })[]>([])
const availableModels = ref<AIModelInfo[]>([])
const messagesListRef = ref<HTMLElement | null>(null)

const { searchKeyword } = useDebounceSearch(
  (_keyword: string) => {},
  { delay: 300 }
)

const showCreateDialog = ref(false)
const showRenameDialog = ref(false)
const newSessionForm = ref({
  title: '',
  modelId: '',
})
const renameForm = ref({
  title: '',
})

const filteredSessions = computed(() => {
  if (!searchKeyword.value) return sessions.value
  const keyword = searchKeyword.value.toLowerCase()
  return sessions.value.filter(
    session =>
      session.title.toLowerCase().includes(keyword) ||
      session.model?.toLowerCase().includes(keyword)
  )
})

const loadSessions = async () => {
  const data = await executeSessionsApi(() => getConversations({
    page: 1,
    pageSize: 100,
  }))
  
  if (data !== null) {
    sessions.value = data.conversations || []
    sessions.value.sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt).getTime() -
        new Date(a.updatedAt || a.createdAt).getTime()
    )
  }
}

const loadMessages = async (sessionId: string) => {
  const data = await executeMessagesApi(() => getConversationMessages(sessionId, {
    limit: 100,
  }))
  
  if (data !== null) {
    const sortedMessages = (data.messages || []).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
    messages.value = sortedMessages.map(msg => ({
      ...msg,
      isMarkdown: isMarkdownContent(msg.content),
    }))
    await nextTick()
    scrollToBottom()
  }
}

const selectSession = async (session: Conversation) => {
  currentSessionId.value = session.id
  currentSession.value = session
  await loadMessages(session.id)
  if (
    typeof window !== 'undefined' &&
    (window as typeof window & { openGlobalChat?: (options: { sessionId: string }) => void })
      .openGlobalChat
  ) {
    ;(
      window as typeof window & { openGlobalChat: (options: { sessionId: string }) => void }
    ).openGlobalChat({ sessionId: session.id })
  }
}

const handleCreateSession = () => {
  newSessionForm.value = {
    title: '',
    modelId: availableModels.value.length > 0 ? availableModels.value[0].id : '',
  }
  showCreateDialog.value = true
}

const confirmCreateSession = async () => {
  if (!newSessionForm.value.title.trim()) {
    showWarning(t('chatHistory.sessionTitleRequired'))
    return
  }
  try {
    await handleResult(
      createConversation({
        title: newSessionForm.value.title,
        model: newSessionForm.value.modelId || undefined,
      }),
      {
        successMessage: t('chatHistory.createSuccess'),
        errorMessage: t('chatHistory.createFailed'),
        onSuccess: async data => {
          showCreateDialog.value = false
          await loadSessions()
          if (data && typeof data === 'object' && 'id' in data && 'title' in data) {
            await selectSession(data as Conversation)
          }
        },
      }
    )
  } catch (error: any) {
    logger.error('Failed to create conversation:', error)
    const message = error instanceof Error ? error.message : String(error)
    showErrorMsg(message || t('chatHistory.createFailed'))
  }
}

const handleDeleteSession = async (session: Conversation) => {
  const confirmed = await confirmDelete(session.title)
  if (!confirmed) return

  await handleResult(deleteConversation(session.id), {
    successMessage: t('chatHistory.deleteSuccess'),
    errorMessage: t('chatHistory.deleteFailed'),
    onSuccess: () => {
      if (currentSessionId.value === session.id) {
        currentSessionId.value = null
        currentSession.value = null
        messages.value = []
      }
      loadSessions()
    },
  })
}

const handleDeleteCurrentSession = () => {
  if (currentSession.value) {
    handleDeleteSession(currentSession.value)
  }
}

const handleRenameSession = () => {
  if (!currentSession.value) return
  renameForm.value.title = currentSession.value.title
  showRenameDialog.value = true
}

const confirmRenameSession = async () => {
  if (!currentSession.value || !renameForm.value.title.trim()) {
    showWarning(t('chatHistory.sessionTitleRequired'))
    return
  }

  try {
    await handleResult(updateConversationTitle(currentSession.value.id, renameForm.value.title), {
      successMessage: t('chatHistory.renameSuccess'),
      errorMessage: t('chatHistory.renameFailed'),
      onSuccess: async () => {
        showRenameDialog.value = false
        if (currentSession.value) {
          currentSession.value.title = renameForm.value.title
        }
        await loadSessions()
      },
    })
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error)
    showErrorMsg(message || t('chatHistory.renameFailed'))
  }
}

const handleExportSession = async () => {
  if (!currentSession.value || messages.value.length === 0) {
    showWarning(t('chatHistory.noMessagesToExport'))
    return
  }
  try {
    let content = `# ${currentSession.value.title}\n\n`
    const modelLabel = t('chatHistory.export.model')
    const createdLabel = t('chatHistory.export.createdAt')
    const messageLabel = t('chatHistory.export.message')
    const userLabel = t('chatHistory.export.user')
    const aiLabel = t('chatHistory.export.ai')
    const tokensHeader = t('chatHistory.export.tokensHeader')
    content += `**${modelLabel}**: ${currentSession.value.model || t('chatHistory.export.unknown')}\n`
    content += `**${createdLabel}**: ${formatTime(currentSession.value.createdAt)}\n\n`
    content += '---\n\n'
    messages.value.forEach((msg, index) => {
      content += `## ${messageLabel} ${index + 1}\n\n`
      if (msg.userContent) {
        content += `**${userLabel}**: ${msg.userContent}\n\n`
      }
      content += `**${aiLabel}**: ${msg.content}\n\n`
      const msgWithUsage = msg as ChatMessage & {
        usage?: { totalTokens?: number; promptTokens?: number; completionTokens?: number }
      }
      if (msgWithUsage.usage) {
        content += `**${tokensHeader}**: ${t('chatHistory.tokensUsed', { total: msgWithUsage.usage.totalTokens || 0, prompt: msgWithUsage.usage.promptTokens || 0, completion: msgWithUsage.usage.completionTokens || 0 })}\n\n`
      }
      content += '---\n\n'
    })
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentSession.value.title}_${new Date().toISOString().split('T')[0]}.md`
    a.click()
    URL.revokeObjectURL(url)
    showSuccess(t('chatHistory.exportSuccess'))
  } catch (_error: any) {
    showErrorMsg(t('chatHistory.exportFailed'))
  }
}

const handleSearch = () => {}

const isMarkdownContent = (content: string): boolean => {
  return (
    content.includes('```') ||
    content.includes('# ') ||
    content.includes('**') ||
    content.includes('* ') ||
    content.includes('> ')
  )
}

const formatMarkdown = (content: string): string => {
  let formatted = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  formatted = formatted.replace(
    /```(\w+)?\n([\s\S]*?)```/g,
    '<pre><code class="language-$1">$2</code></pre>'
  )
  formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>')
  formatted = formatted.replace(/^### (.*$)/gim, '<h3>$1</h3>')
  formatted = formatted.replace(/^## (.*$)/gim, '<h2>$1</h2>')
  formatted = formatted.replace(/^# (.*$)/gim, '<h1>$1</h1>')
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>')
  formatted = formatted.replace(/^\* (.*$)/gim, '<li>$1</li>')
  formatted = formatted.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
  formatted = formatted.replace(/\n/g, '<br>')
  return DOMPurify.sanitize(formatted, {
    ALLOWED_TAGS: [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'p',
      'br',
      'strong',
      'em',
      'ul',
      'ol',
      'li',
      'code',
      'pre',
      'blockquote',
    ],
    ALLOWED_ATTR: ['class'],
  })
}

const scrollToBottom = () => {
  if (messagesListRef.value) {
    messagesListRef.value.scrollTop = messagesListRef.value.scrollHeight
  }
}

const loadAvailableModels = async () => {
  try {
    const response = await getAvailableModels()
    if (response.code === 200 && response.success && Array.isArray(response.data)) {
      availableModels.value = response.data.filter(
        model => model.category === 'talk' && model.isAvailable
      )
    }
  } catch (error: any) {
    const _errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('Failed to load available models:', error)
    showErrorMsg(t('chatHistory.loadModelsFailed'))
  }
}

onMounted(async () => {
  try { await loadAvailableModels(); await loadSessions() } catch (e) { console.error(e) }
})
</script>

<style scoped lang="scss">
.chat-history-container {
  display: flex;
  flex-direction: column;
}

.chat-sidebar {
  border-right: none;
  background: var(--el-bg-color);
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: none;

  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }
}

.sidebar-search {
  padding: 12px 16px;
  border-bottom: none;
}

.session-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.session-item {
  padding: 12px;
  margin-bottom: 8px;
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  cursor: pointer;
  transition: all 0.2s;
  position: relative;

  &:hover {
    background: var(--el-bg-color-page);
    box-shadow: none;
  }

  &.active {
    background: var(--el-bg-color-page);
    border: none;
  }
}

.session-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.session-icon {
  font-size: 20px;
  color: var(--el-text-color-primary);
}

.session-info {
  flex: 1;
  min-width: 0;
}

.session-title {
  font-weight: 500;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 4px;
}

.session-meta {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  display: flex;
  gap: 8px;
}

.message-count {
  color: var(--el-color-success);
}

.session-actions {
  position: absolute;
  top: 8px;
  right: 8px;
}

.session-time {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  margin-top: 4px;
}

.chat-main {
  display: flex;
  flex-direction: column;
  padding: 0;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.chat-messages-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.messages-header {
  padding: 16px;
  border-bottom: none;
  background: var(--el-bg-color);
}

.session-title-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;

  h4 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }
}

.header-actions {
  display: flex;
  gap: 8px;
}

.messages-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: var(--el-bg-color-page);
}

.message-item {
  margin-bottom: 24px;
}

.message-user,
.message-ai {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.message-ai {
  flex-direction: row-reverse;
}

.message-content {
  max-width: 100%;
  padding: 12px 16px;
  border-radius: var(--global-border-radius);
  line-height: 1.6;
  word-wrap: break-word;
}

.user-message {
  background: var(--el-bg-color-page);
  color: var(--el-text-color-primary);
}

.ai-message {
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  }

.message-usage {
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.markdown-content {
  :deep(h1),
  :deep(h2),
  :deep(h3) {
    margin: 16px 0 8px;
    font-weight: 600;
  }

  :deep(code) {
    background: var(--el-bg-color);
    padding: 2px 6px;
    border-radius: var(--global-border-radius);
    font-family: var(--font-family-mono);
  }

  :deep(pre) {
    background: var(--el-bg-color);
    padding: 12px;
    border-radius: var(--global-border-radius);
    overflow-x: auto;
  }
}

.text-content {
  white-space: pre-wrap;
}
</style>
