<template>
  <div :class="['ai-chat', modeClass, $attrs.class]">
    <!-- 所有页面右下角呼起按钮：当对话框关闭或最小化时显?-->
    <button
      v-if="showToggle && isCollapsed"
      class="chat-toggle-btn"
      type="button"
      @click="expandChat"
      :title="t('aiChatInput.openChat')"
      :aria-label="t('aiChatInput.openChat')"
    >
      <el-icon><MessageCircle /></el-icon>
    </button>

    <!-- 历史对话抽屉 -->
    <Teleport to="body">
      <Transition name="drawer-fade">
        <div v-if="showHistoryDrawer" class="history-drawer-overlay" @click.self="showHistoryDrawer = false">
          <div class="history-drawer" :class="{ 'is-visible': showHistoryDrawer }">
            <div class="history-drawer-header">
              <h3>{{ t('aiChat.history') }}</h3>
              <el-button icon="Close" size="small" @click="showHistoryDrawer = false" />
            </div>
            <div class="history-filter">
              <el-select
                v-model="historyFilter"
                :placeholder="t('aiChat.filterByModel')"
                clearable
                size="small"
              >
                <el-option :label="t('aiChat.allModels')" :value="null" />
                <el-option
                  v-for="model in modelList"
                  :key="model.modelCode"
                  :label="model.modelName"
                  :value="model.modelCode"
                />
              </el-select>
            </div>
            <div class="history-list">
              <template v-if="Object.keys(groupedConversations).length > 0">
                <div v-for="(group, groupKey) in groupedConversations" :key="groupKey" class="history-group">
                  <div class="history-group-title">{{ groupKey }}</div>
                  <div
                    v-for="conversation in group"
                    :key="conversation.id"
                    :class="['history-item', { active: currentConversationId === conversation.id }]"
                    @click="loadConversation(conversation.id)"
                  >
                    <div class="history-item-content">
                      <div class="history-title">{{ conversation.title || t('aiChat.newConversation') }}</div>
                      <div class="history-meta">
                        <span class="history-time">{{ formatTime(conversation.updatedAt || conversation.createdAt || conversation.createTime) }}</span>
                        <span v-if="conversation.messageCount" class="history-count">
                          {{ conversation.messageCount }} {{ t('aiChat.messages') }}
                        </span>
                      </div>
                    </div>
                    <el-button
                      :icon="Delete"
                      size="small"
                      circle
                      type="danger"
                      text
                      @click.stop="handleDeleteConversation(conversation.id)"
                      :title="t('common.delete')"
                    />
                  </div>
                </div>
              </template>
              <el-empty
                v-else
                :description="t('aiChat.noHistory')"
                :image-size="60"
              />
            </div>
            <div class="new-chat-btn">
              <el-button type="primary" :icon="Plus" @click="startNewChat" block>
                {{ t('aiChat.newConversation') }}
              </el-button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 统一对话框容器：所有模式都在对话框内显?-->
    <Teleport to="body">
      <Transition name="dialog-fade">
        <!-- 对话框始终显?-->
        <div v-if="dialogVisible" class="ai-chat-dialog-overlay" :class="{ 'is-home': isHomePage }" @click.self="handleOverlayClick">
          <div class="ai-chat-dialog" :class="{ 'is-minimized': isMinimized, 'is-home': isHomePage, 'has-no-messages': !hasMessages }" @click.stop>
            <!-- 统一的消息对话页容器：包含消息区域和输入区域 -->
            <div class="chat-dialog-content" :class="{ 'is-home': isHomePage }">
              <!-- 对话消息区域 -->
              <div 
                v-if="hasMessages && !isMinimized"
                class="chat-messages-container" 
                ref="messagesContainerRef"
              >
              <!-- Agent模式的消息显?-->
              <template v-if="currentMode === 'agent'">
                <!-- Agent消息列表 -->
                <div v-if="messages.length > 0" class="agent-messages-list">
                  <div v-for="(msg, index) in messages" :key="index" :class="['agent-message-item', msg.role, msg.stage]">
                    <div class="agent-message-header">
                      <span class="agent-message-role">{{ getRoleLabel(msg.role) }}</span>
                      <span v-if="msg.stage" class="agent-message-stage">
                        {{ getStageLabel(msg.stage) }}
                      </span>
                      <span class="agent-message-time">{{ msg.time }}</span>
                    </div>
                    <div class="agent-message-content">
                      <div v-if="msg.type === 'text'" class="agent-text-content">{{ msg.content }}</div>
                      <div v-else-if="msg.type === 'action'" class="agent-action-content">
                        <el-card>
                          <div>{{ t('aiChat.executeAction') }}: {{ msg.action }}</div>
                          <div>
                            {{ t('aiChat.status') }}:
                            <el-tag :type="getStatusType(msg.status)">
                              {{ msg.status }}
                            </el-tag>
                          </div>
                        </el-card>
                      </div>
                      <div v-else-if="msg.type === 'mcp-tool'" class="agent-mcp-content">
                        <el-card>
                          <div>{{ t('aiChat.tool') }}: {{ msg.mcpToolName }}</div>
                          <div>{{ t('aiChat.result') }}: {{ JSON.stringify(msg.mcpResult) }}</div>
                        </el-card>
                      </div>
                    </div>
                  </div>
                </div>
                <template v-else></template>
              </template>
              <!-- Dialog模式的消息显?-->
              <template v-else-if="currentMode === 'dialog'">
                <!-- 消息列表 -->
                <div v-if="displayMessages.length > 0" class="messages-container">
                  <TransitionGroup name="message-fade" tag="div" class="messages-list">
                  <div
                    v-for="(message, index) in displayMessages"
                    :key="message.id"
                    class="message-item"
                    :ref="(el: HTMLElement | null) => setMessageRef(el, message.id)"
                    :class="{
                      'is-user': message.role === 'user',
                      'is-assistant': message.role === 'assistant',
                      'is-streaming': message.isStreaming,
                      'is-local': message.isLocal,
                      'is-failed': message.status === 'failed',
                      'is-sending': message.status === 'sending',
                    }"
                  >
                    <!-- 日期分隔?-->
                    <div
                      v-if="shouldShowDateSeparator(index)"
                      :key="`date-${message.id}`"
                      class="date-separator"
                    >
                      <span class="date-label">
                        {{ getDateLabelForMessage(new Date(message.createTime)) }}
                      </span>
                    </div>

                    <!-- 用户消息 -->
                    <div v-if="message.role === 'user'" class="user-message">
                      <div class="message-avatar user-avatar">
                        <el-icon><User /></el-icon>
                      </div>
                      <div class="message-content-wrapper">
                        <!-- 消息状态指?-->
                        <div class="message-status-indicator">
                          <el-icon v-if="message.status === 'sending'" class="status-icon sending">
                            <Loader2 />
                          </el-icon>
                          <el-icon
                            v-else-if="message.status === 'failed'"
                            class="status-icon failed"
                            @click="handleRetryMessage(message)"
                          >
                            <AlertTriangle />
                          </el-icon>
                          <el-icon v-else-if="message.status === 'sent'" class="status-icon sent">
                            <CheckCircle />
                          </el-icon>
                          <el-icon v-else class="status-icon pending">
                            <Clock />
                          </el-icon>
                        </div>

                        <div class="message-content">
                          <!-- 引用消息显示 -->
                          <div v-if="message.quotedMessage" class="quoted-message">
                            <div class="quoted-message-header">
                              <el-icon><MessageCircle /></el-icon>
                              <span class="quoted-message-role">
                                {{ message.quotedMessage.role === 'user' ? t('common.user') : 'AI' }}
                              </span>
                            </div>
                            <div class="quoted-message-content">
                              {{ message.quotedMessage.content }}
                            </div>
                          </div>

                          <!-- 编辑模式 -->
                          <div v-if="editingMessageId === message.id" class="message-edit-mode">
                            <el-input
                              v-model="editContent"
                              type="textarea"
                              :rows="3"
                              autofocus
                              @keydown.ctrl.enter="saveEdit"
                              @keydown.esc="cancelEdit"
                            />
                            <div class="edit-actions">
                              <el-button size="small" @click="cancelEdit">{{ t('common.cancel') }}</el-button>
                              <el-button size="small" type="primary" @click="saveEdit">
                                {{ t('common.save') }}
                              </el-button>
                            </div>
                          </div>

                          <!-- 显示模式 -->
                          <div v-else class="message-text">{{ message.content }}</div>

                          <!-- 文件附件 -->
                          <div v-if="message.files && message.files.length > 0" class="message-files">
                            <div v-for="(file, fileIndex) in message.files" :key="fileIndex" class="file-item">
                              <!-- 音频文件播放?-->
                              <div v-if="file.type && file.type.startsWith('audio/')" class="audio-player">
                                <audio
                                  v-if="file.preview && (!file.preview.startsWith('blob:') || file.preview.startsWith('data:'))"
                                  :ref="(el: HTMLElement | null) => setAudioRef(el, fileIndex)"
                                  :src="file.preview"
                                  controls
                                  class="audio-element"
                                  @loadedmetadata="updateAudioDuration(fileIndex)"
                                  @error="(e) => { 
                                    logger.warn('[AIChat] Audio load error:', e); 
                                    // 如果?blob URL 错误，尝试清?
                                    if (file.preview && file.preview.startsWith('blob:')) {
                                      try {
                                        URL.revokeObjectURL(file.preview)
                                      } catch (error) {
                                        // blob URL可能已失效，静默处理
                                        if (IS_DEV) {
                                          logger.debug('[AIChat] Blob URL revoke failed (already revoked):', file.preview)
                                        }
                                      }
                                    }
                                  }"
                                ></audio>
                                <div v-else class="audio-error">
                                  <el-icon><AlertTriangle /></el-icon>
                                  <span>{{ file.name || t('aiChat.audioLoadFailed') }}</span>
                                </div>
                                <span class="audio-duration" v-if="audioDurations[fileIndex]">
                                  {{ formatDuration(audioDurations[fileIndex]) }}
                                </span>
                              </div>
                              <!-- 图片文件 -->
                              <template v-else-if="file.type && file.type.startsWith('image/')">
                                <el-icon><Image /></el-icon>
                                <span>{{ file.name }}</span>
                                <el-button
                                  link
                                  size="small"
                                  class="file-download-btn"
                                  @click="handleDownloadFile(file)"
                                  :title="t('common.download')"
                                >
                                  <el-icon><Download /></el-icon>
                                </el-button>
                              </template>
                              <!-- 其他文件 -->
                              <template v-else>
                                <el-icon><Image /></el-icon>
                                <span>{{ file.name }}</span>
                                <el-button
                                  link
                                  size="small"
                                  class="file-download-btn"
                                  @click="handleDownloadFile(file)"
                                  :title="t('common.download')"
                                >
                                  <el-icon><Download /></el-icon>
                                </el-button>
                              </template>
                            </div>
                          </div>

                          <div class="message-time">
                            {{ formatMessageTime(message.createTime) }}
                            <span v-if="message.edited" class="edited-badge">{{ t('llmChatCenter.status.edited') }}</span>
                          </div>

                          <!-- 消息操作 -->
                          <div class="message-actions" v-if="editingMessageId !== message.id">
                            <el-button link size="small" @click="copyMessage(message.content)" class="action-btn" :title="t('llmChatCenter.actions.copy')">
                              <el-icon><Copy /></el-icon>
                            </el-button>
                            <el-button link size="small" @click="editMessage(message)" class="action-btn" :title="t('llmChatCenter.actions.edit')">
                              <el-icon><Edit /></el-icon>
                            </el-button>
                            <el-button link size="small" @click="deleteMessage(message)" class="action-btn delete-btn" :title="t('llmChatCenter.actions.delete')">
                              <el-icon><Trash2 /></el-icon>
                            </el-button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- AI 回复 -->
                    <div v-else class="assistant-message">
                      <div class="message-avatar assistant-avatar">
                        <el-icon><Cpu /></el-icon>
                      </div>
                      <div class="message-content-wrapper">
                        <div class="message-content assistant-content">
                          <div class="message-text">
                            <MarkdownStream
                              v-if="isMarkdownContent(message.content)"
                              :content="message.content"
                              :enable-mermaid="true"
                              :enable-katex="true"
                              :loading="message.isStreaming"
                            />
                            <!-- eslint-disable-next-line vue/no-v-html -->
                            <div v-else v-html="formatMessageContent(message.content)"></div>
                          </div>
                          <div v-if="message.isStreaming" class="streaming-indicator">
                            <span class="typing-dots">
                              <span></span>
                              <span></span>
                              <span></span>
                            </span>
                          </div>
                          <div class="message-time">
                            {{ formatMessageTime(message.createTime) }}
                          </div>
                          <div class="message-actions">
                            <el-button link size="small" @click="copyMessage(message.content)" class="action-btn" :title="t('llmChatCenter.actions.copy')">
                              <el-icon><Copy /></el-icon>
                            </el-button>
                            <el-button link size="small" @click="regenerateMessage(message)" class="action-btn" :title="t('llmChatCenter.actions.regenerate')">
                              <el-icon><RefreshCw /></el-icon>
                            </el-button>
                            <el-button link size="small" @click="toggleLikeMessage(message)" class="action-btn" :class="{ 'is-liked': message.liked }" :title="t('llmChatCenter.actions.like')">
                              <el-icon><Star v-if="message.liked" /><Star v-else /></el-icon>
                            </el-button>
                            <el-button link size="small" @click="deleteMessage(message)" class="action-btn delete-btn" :title="t('llmChatCenter.actions.delete')">
                              <el-icon><Trash2 /></el-icon>
                            </el-button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  </TransitionGroup>
                </div>
                <template v-else></template>
              </template>
              </div>
              
              <!-- 输入区域（AIDialog组件?-->
              <AIDialog
                ref="inputWrapperRef"
                :title="getModeDisplayTitle()"
                :current-mode="currentMode"
                :selected-model="selectedModel"
                :show-model-selector="showModelSelector"
                :enable-search="enableSearch"
                :show-menu="showMenu"
                :is-minimized="isMinimized"
                :input-text="inputText"
                :is-sending="isSending"
                :is-recording="isRecording"
                :show-reasoning="showReasoning"
                :enable-voice="enableVoice"
                :enable-file-upload="enableFileUpload"
                :actual-input-placeholder="actualInputPlaceholder"
                :image-list-data="imageListData"
                :is-auto-model="isAutoModel"
                :is-dark-mode="isDarkMode"
                :active-tab="activeTab"
                :loading-models="loadingModels"
                :model-list="modelList"
                :is-scrolled-to-bottom="isScrolledToBottom"
                :show-history-drawer="showHistoryDrawer"
                @update:input-text="inputText = $event"
                @update:selected-model="selectedModel = $event"
                @update:is-minimized="isMinimized = $event"
                @update:is-auto-model="isAutoModel = $event"
                @update:active-tab="activeTab = $event"
                @update:show-reasoning="showReasoning = $event"
                @mode-change="handleModeChange"
                @toggle-search="toggleSearch"
                @header-menu-command="handleHeaderMenuCommand"
                @handle-close="handleClose"
                @send-message="handleSendMessage"
                @agent-send-message="handleAgentSendMessage"
                @voice-toggle="handleVoiceToggle"
                @voice-stop="handleVoiceStop"
                @file-upload="triggerFileUpload"
                @remove-image="handleRemoveImage"
                @input="handleInput"
                @shift-enter="handleShiftEnter"
                @model-select="handleModelSelect"
                @toggle-history-drawer="toggleHistoryDrawer"
              />
            </div>

            <!-- 搜索?- 使用全局统一样式 -->
            <Transition name="slide-down">
              <div v-if="showSearch && !isMinimized" class="search-bar unified-search-bar">
                <el-input
                  v-model="searchQuery"
                  :placeholder="t('chat.searchMessage')"
                  clearable
                  @input="handleSearch"
                >
                  <template #prefix>
                    <SearchIcon />
                  </template>
                </el-input>
                <div v-if="searchResults.length > 0" class="search-results-info">
                  {{ t('chat.foundMessages', { count: searchResults.length }) }}
                </div>
              </div>
            </Transition>

            <!-- Agent思考过程展?-->
            <div v-if="currentMode === 'agent' && showReasoning && reasoningChain.length > 0" class="reasoning-panel">
              <el-card>
                <template #header>
                  <span>{{ t('llmChatCenter.agentThinkingProcess') }}</span>
                  <el-button link size="small" @click="toggleReasoning">
                    <el-icon><X /></el-icon>
                  </el-button>
                </template>
                <div class="reasoning-chain">
                  <div
                    v-for="step in reasoningChain"
                    :key="step.step"
                    class="reasoning-step"
                    :data-step="step.step"
                  >
                    <el-tag type="primary" size="small">{{ `${t('aiChat.step')} ${step.step}` }}</el-tag>
                    <div class="reasoning-content">{{ step.reasoning }}</div>
                    <el-progress
                      v-if="step.confidence"
                      :percentage="step.confidence * 100"
                      :format="() => `${(step.confidence * 100).toFixed(0)}%`"
                      :stroke-width="8"
                    />
                  </div>
                </div>
              </el-card>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>



    <!-- 隐藏的文件输入框 -->
    <input
      ref="fileInputRef"
      type="file"
      style="display: none"
      :accept="currentAcceptTypes"
      @change="handleFileChange"
    />
  </div>
</template>

<script setup lang="ts">
defineOptions({
  inheritAttrs: false,
})

 
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { useLocalStorage } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useDarkModeStore } from '@/stores/darkMode'
import { useChatModeStore } from '@/stores/chatMode'
import { logger } from '@/utils/logger'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import MarkdownStream from './MarkdownStream.vue'
import AIDialog from './AIDialog.vue'
import { isMarkdown } from '@/utils/markdown'
import { getDateLabel } from '@/utils/messageGrouping'
import {
  startSpeechRecognition,
  stopSpeechRecognition,
  getAccumulatedText,
} from '@/utils/speechRecognition'
import {
  streamGenerateContent,
} from '@/api/ai/ai'
import {
  getAvailableModels,
} from '@/api/models/models'
import { exportMessagesToFile } from '@/utils/messageExport'
import { getConversations, type Conversation } from '@/api/chat/chat-history'
import { getChatHistoryMessages, deleteChatRecord } from '@/api/services'
import type { AIModelInfo } from '@/api/models/models'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Loader2,
  MessageCircle,
  X,
  User,
  Cpu,
  Copy,
  RefreshCw,
  Download,
  Trash2,
  Edit,
  Star,
  CheckCircle,
  Clock,
  AlertTriangle,
  Image,
  Plus,
  Delete,
} from '@/lib/lucide-fallback'
import SearchIcon from '@/components/common/SearchIcon.vue'

// 使用全局作用域，因为组件?Teleport 中会失去父级作用?
const { t } = useI18n()
const { showSuccess, showError, showWarning, showInfo } = useOperationFeedback()
const { confirm } = useConfirmDialog()
const darkModeStore = useDarkModeStore()
const chatModeStore = useChatModeStore()
const isDarkMode = computed(() => darkModeStore.isDarkMode ?? darkModeStore.themeMode === 'dark')

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  files?: Array<{ name: string; type: string; preview: string }>
  response?: Record<string, unknown>
  createTime: string
  isLocal?: boolean
  status?: 'sending' | 'sent' | 'failed' | 'pending'
  replyTo?: string
  quotedMessage?: {
    id: string
    content: string
    role: 'user' | 'assistant'
  }
  isStreaming?: boolean
  error?: string
  liked?: boolean
  edited?: boolean
  model?: string
}

interface AgentMessage {
  role: 'user' | 'assistant'
  type: 'text' | 'action' | 'mcp-tool'
  content?: string
  action?: string
  status?: string
  stage?: 'reasoning' | 'acting' | 'result'
  time: string
  mcpResult?: Record<string, unknown>
  mcpToolName?: string
}

interface ReasoningStep {
  step: number
  reasoning: string
  action?: string
  confidence?: number
}

const props = withDefaults(
  defineProps<{
    mode?: 'global' | 'dialog' | 'agent'
    visible?: boolean
    model?: string
    showToggle?: boolean
    showModelSelector?: boolean
    enableVoice?: boolean
    enableFileUpload?: boolean
    enableSearch?: boolean
    showMenu?: boolean
    inputPlaceholder?: string
    dialogTitle?: string
    agentId?: string
    defaultCollapsed?: boolean
  }>(),
  {
    mode: 'dialog',
    visible: true,
    showToggle: true,
    showModelSelector: true,
    enableVoice: true,
    enableFileUpload: true,
    enableSearch: true,
    showMenu: true,
    inputPlaceholder: '', // 默认值，将在组件内部使用 computed 处理翻译
    dialogTitle: '',
    defaultCollapsed: false,
  }
)

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'close'): void
  (e: 'message-sent', data: { content: string; model: string; response?: Record<string, unknown> }): void
  (e: 'message-received', message: ChatMessage): void
}>()

const IS_DEV = import.meta.env.DEV

const modeClass = computed(() => `mode-${currentMode.value}`)

// 判断是否在首?
const route = useRoute()
const isHomePage = computed(() => {
  const path = route.path
  const isHome = path === '/' || path === '/home'
  // 调试：检查首页判?
  if (process.env.NODE_ENV === 'development') {
    const routeName = 'name' in route ? (route.name as string | undefined) : undefined
    logger.debug('[AIChat Debug] isHomePage:', { isHome, path, routeName })
  }
  return isHome
})

// 处理 inputPlaceholder 的翻?
const actualInputPlaceholder = computed(() => {
  return props.inputPlaceholder || t('aiChatInput.inputPlaceholder')
})

const isCollapsed = ref(false)
const isMinimized = ref(false)
const currentMode = ref(props.mode)
// 内部visible状态，用于管理对话框显示（当父组件没有使用v-model时）
// 初始化时：如果props.visible有值，使用props.visible；否则，如果是dialog/agent模式，默认为true
const initialVisible = props.visible !== undefined ? props.visible : 
                      (props.mode === 'dialog' || props.mode === 'agent' ? true : false)
const internalVisible = ref(initialVisible)

// 调试：初始化时的状?
if (import.meta.env.DEV) {
  logger.info('[AIChat] Initializing state', {
    propsVisible: props.visible,
    propsMode: props.mode,
    initialVisible,
    internalVisible: internalVisible.value
  })
}
// 标记是否是内部模式切换，用于避免watch冲突
let isInternalModeChange = false

// 计算visible值：对话框显示逻辑
// 1. 所有模式（global、dialog、agent）都显示对话?
// 2. 如果props.visible有值，使用props.visible（父组件控制?
// 3. 在首页时，无论什么模式都显示对话框（作为底部固定的小对话框）
// 4. 但在首页时，如果与footer重合（isScrolledToBottom为true），则隐藏对话框
// 5. 否则使用内部状?
const dialogVisible = computed(() => {
  const mode = currentMode.value
  
  // 检查用户是否主动关闭（通过关闭按钮?
  // 如果用户主动关闭，且父组件没有强制显示（props.visible !== true），则隐?
  const userClosed = internalVisible.value === false
  const parentForcesShow = props.visible === true
  
  // 如果用户主动关闭且父组件没有强制显示，隐藏对话框
  if (userClosed && !parentForcesShow) {
    return false
  }
  
  // dialog和agent模式：始终显示（除非用户主动关闭且父组件没有强制显示?
  if (mode === 'dialog' || mode === 'agent') {
    // 但在首页时，如果与footer重合（isScrolledToBottom已经由checkOverlapWithFooter正确维护），则隐藏对话框
    // 关键修复：只有当isScrolledToBottom确实为true且对话框确实与footer重合时，才隐?
    if (isHomePage.value && isScrolledToBottom.value) {
      // 双重检查：确保isScrolledToBottom状态是准确?
      // 如果对话框元素存在，再次验证是否真的重合
      const chatDialog = document.querySelector('.ai-chat-dialog.is-home') as HTMLElement
      if (chatDialog) {
        const footer = (document.querySelector('footer.footer-container') || document.querySelector('.footer-container')) as HTMLElement | null
        if (footer) {
          const dialogRect = chatDialog.getBoundingClientRect()
          const footerRect = footer.getBoundingClientRect()
          const distanceToFooter = dialogRect.bottom - footerRect.top
          const overlapThreshold = 20
          const isOverlapping = distanceToFooter >= -overlapThreshold
          const isDialogInViewport = dialogRect.bottom > 0 && dialogRect.top < window.innerHeight
          
          // 只有当确实重合时才隐?
          if (isDialogInViewport && isOverlapping) {
            return false
          } else {
            // 如果不重合，重置isScrolledToBottom状?
            if (isScrolledToBottom.value) {
              isScrolledToBottom.value = false
              if (import.meta.env.DEV) {
                logger.debug('[DialogVisible] Detected state inconsistency, resetting isScrolledToBottom to false')
              }
            }
          }
        }
      }
      return false
    }
    return true
  }
  
  // 在首页时：无论什么模式都显示对话框（作为底部固定的小对话框）
  // 但如果与footer重合，则隐藏对话?
  if (isHomePage.value) {
    // 直接使用isScrolledToBottom的值，它已经由checkOverlapWithFooter函数正确维护
    // 关键修复：双重检查，确保状态准?
    if (isScrolledToBottom.value) {
      // 再次验证是否真的重合
      const chatDialog = document.querySelector('.ai-chat-dialog.is-home') as HTMLElement
      if (chatDialog) {
        const footer = (document.querySelector('footer.footer-container') || document.querySelector('.footer-container')) as HTMLElement | null
        if (footer) {
          const dialogRect = chatDialog.getBoundingClientRect()
          const footerRect = footer.getBoundingClientRect()
          const distanceToFooter = dialogRect.bottom - footerRect.top
          const overlapThreshold = 20
          const isOverlapping = distanceToFooter >= -overlapThreshold
          const isDialogInViewport = dialogRect.bottom > 0 && dialogRect.top < window.innerHeight
          
          // 只有当确实重合时才隐?
          if (isDialogInViewport && isOverlapping) {
            return false
          } else {
            // 如果不重合，重置isScrolledToBottom状?
            if (isScrolledToBottom.value) {
              isScrolledToBottom.value = false
              if (import.meta.env.DEV) {
                logger.debug('[DialogVisible] Detected state inconsistency, resetting isScrolledToBottom to false')
              }
            }
          }
        }
      }
      return false
    }
    return true
  }
  
  // 其他情况（global模式，非首页）：根据内部状态和props决定
  // 如果用户主动展开，显?
  if (internalVisible.value === true) {
    return true
  }
  
  // 如果props.visible有值，使用props.visible
  if (props.visible !== undefined) {
    return props.visible
  }
  
  // 默认：根据内部状?
  return internalVisible.value
})
const inputText = ref('')
const selectedModel = ref(props.model || '')
const isSending = ref(false)
const isRecording = ref(false)
const showSearch = ref(false)
const searchQuery = ref('')
const searchResults = ref<ChatMessage[]>([])
const editingMessageId = ref<string | null>(null)
const editContent = ref('')
const messageRefs = ref<Map<string, HTMLElement>>(new Map())
const showReasoning = ref(false)
const reasoningChain = ref<ReasoningStep[]>([])
const messages = ref<AgentMessage[]>([])
const messagesContainerRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLTextAreaElement | null>(null)
const isScrolledToBottom = ref(false) // 是否滚动到底部（初始为false，显示输入框?
const inputWrapperRef = ref<HTMLElement | null>(null) // input-wrapper 的引?
const fileInputRef = ref<HTMLInputElement | null>(null)
let overlapCheckAnimationFrame: number | null = null // 用于持续检测的 animation frame
let overlapCheckInterval: number | null = null // 用于定期检测的 interval
let scrollDebounceTimer: number | null = null // 滚动防抖定时?
let resizeDebounceTimer: number | null = null // resize防抖定时?
let scrollRafId: number | null = null // 滚动rAF节流
let windowScrollRafId: number | null = null // window滚动rAF节流
const uploadedFiles = ref<Array<{ file: File; preview: string; type: string; name: string }>>([])
const currentAcceptTypes = ref('')
const audioDurations = ref<Record<number, number>>({})
const audioElements = ref<Map<number, HTMLAudioElement>>(new Map())
const MAX_FILES = 10

const isAutoModel = ref(true)
const activeTab = ref<string>('image')
const modelList = ref<Array<{ modelCode: string; modelName: string; modelDesc: string }>>([])
const loadingModels = ref(false)

const chatMessages = useLocalStorage<ChatMessage[]>('ai-chat-messages', [])

const showHistoryDrawer = ref(false)
const conversations = ref<Conversation[]>([])
const currentConversationId = ref<string>('')
const historyFilter = ref<string | null>(null)
const loadingHistory = ref(false)

const imageListData = computed(() => {
  return uploadedFiles.value.map(file => ({
    imgUrl: file.preview,
    fileType: file.type.startsWith('image/') ? 'image' : 'document',
    filename: file.name
  }))
})

const displayMessages = computed(() => {
  if (showSearch.value && searchQuery.value.trim()) {
    return searchResults.value
  }
  return chatMessages.value
})

const hasMessages = computed(() => {
  let result = false
  if (currentMode.value === 'agent') {
    result = messages.value.length > 0
  } else {
    result = displayMessages.value.length > 0
  }
  if (import.meta.env.DEV) {
    logger.debug('[AIChat Debug] hasMessages:', result, 'currentMode:', currentMode.value, 'displayMessages.length:', displayMessages.value.length, 'messages.length:', messages.value.length)
  }
  return result
})

const groupedConversations = computed(() => {
  let filtered = conversations.value

  if (historyFilter.value) {
    filtered = filtered.filter(c => c.botId === historyFilter.value)
  }

  const groups: Record<string, Conversation[]> = {}

  filtered.forEach(conversation => {
    // 使用updatedAt, createdAt的优先级顺序
    const dateStr = conversation.updatedAt || conversation.createdAt
    if (!dateStr) return // 跳过没有时间的对?
    
    const date = new Date(dateStr)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    const thisWeek = new Date(today)
    thisWeek.setDate(thisWeek.getDate() - 7)
    
    const dateOnly = new Date(date)
    dateOnly.setHours(0, 0, 0, 0)

    let groupKey = ''
    if (dateOnly.getTime() === today.getTime()) {
      groupKey = t('aiChat.today')
    } else if (dateOnly.getTime() === yesterday.getTime()) {
      groupKey = t('aiChat.yesterday')
    } else if (date >= thisWeek) {
      groupKey = t('aiChat.thisWeek')
    } else {
      groupKey = t('aiChat.thisMonth')
    }

    if (!groups[groupKey]) {
      groups[groupKey] = []
    }
    groups[groupKey].push(conversation)
  })

  // 对每个分组内的对话进行排序（最新的在前?
  Object.keys(groups).forEach(key => {
    groups[key].sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime()
      const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime()
      return timeB - timeA
    })
  })

  return groups
})

// 格式化时间显?
const formatTime = (timestamp: string | number) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) {
    return t('aiChat.timeLabels.justNow')
  } else if (minutes < 60) {
    return t('aiChat.timeLabels.minutesAgo', { minutes })
  } else if (hours < 24) {
    return t('aiChat.timeLabels.hoursAgo', { hours })
  } else if (days < 7) {
    return t('aiChat.timeLabels.daysAgo', { days })
  } else {
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }
}

// 加载对话列表
const loadConversations = async () => {
  try {
    loadingHistory.value = true
    const response = await getConversations({ 
      page: 1, 
      pageSize: 100,
      botId: historyFilter.value || undefined,
      model: historyFilter.value || undefined,
    })
    
    if (response.success && response.data) {
      // 处理不同的响应格?
      if (response.data.conversations && Array.isArray(response.data.conversations)) {
        conversations.value = response.data.conversations
      } else if (Array.isArray(response.data)) {
        conversations.value = response.data
      } else {
        conversations.value = []
      }
      
      // 按更新时间排序（最新的在前?
      conversations.value.sort((a, b) => {
        const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime()
        const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime()
        return timeB - timeA
      })
    } else {
      conversations.value = []
    }
    
    logger.info(t('common.messages.loadSuccess'), { count: conversations.value.length })
  } catch (error: any) {
    // 静默处理 404 错误（后端可能未实现该功能）
    // 检查多种可能的错误格式?
    // 1. Axios 错误：error.response?.status === 404
    // 2. 业务错误：error.code === 404 ?error.code === 500 且消息包?"404"/"NOT_FOUND"
    const axiosError = error as { response?: { status?: number }; code?: number; msg?: string; message?: string }
    const is404Error = 
      axiosError.response?.status === 404 ||
      axiosError.code === 404 ||
      (axiosError.code === 500 && (
        axiosError.msg?.includes('404') ||
        axiosError.msg?.includes('NOT_FOUND') ||
        axiosError.message?.includes('404') ||
        axiosError.message?.includes('NOT_FOUND')
      ))
    
    if (is404Error) {
      // 404 错误静默处理，不显示错误提示
      conversations.value = []
      if (import.meta.env.DEV) {
        logger.debug('Chat history backend unavailable, using empty list', { error })
      }
    } else {
      logger.error(t('common.errors.fetchFailed'), error)
      ElMessage.error(t('aiChat.loadHistoryFailed'))
      conversations.value = []
    }
  } finally {
    loadingHistory.value = false
  }
}

// 加载对话消息 - 完整实现
const loadConversation = async (conversationId: string) => {
  try {
    loadingHistory.value = true
    currentConversationId.value = conversationId
    
    // 查找对话信息
    const conversation = conversations.value.find(c => c.id === conversationId)
    if (conversation) {
      // 设置模型
      if (conversation.model) {
        selectedModel.value = conversation.model
      } else if (conversation.botId) {
        selectedModel.value = conversation.botId
      }
      
      // 加载对话消息
      const user_uuid = localStorage.getItem('user_uuid') || ''
      const messagesResponse = await getChatHistoryMessages({
        user_uuid,
        model_name: conversation.model || conversation.botId || '',
        chat_id: conversationId,
        limit: 1000
      })
      
      if (messagesResponse.success && messagesResponse.data?.messages) {
        const messages = messagesResponse.data.messages
        // 转换消息格式为ChatMessage格式
        interface MessageData {
          id?: string
          message_id?: string
          role?: string
          content?: string
          text?: string
          created_at?: string
          createdAt?: string
          create_time?: string
          [key: string]: any
        }
        const loadedMessages: ChatMessage[] = (messages as MessageData[]).map((msg: MessageData, index: number): ChatMessage => ({
          id: msg.id || msg.message_id || `msg-${Date.now()}-${index}-${Math.random()}`,
          role: (msg.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
          content: msg.content || msg.text || '',
          createTime: msg.created_at || msg.createdAt || msg.create_time || new Date(Date.now() - (messages.length - index) * 1000).toISOString(),
          status: 'sent' as const,
          isStreaming: false,
          model: conversation.model || conversation.botId,
        }))
        
        // 按时间排序（旧的在前?
        loadedMessages.sort((a, b) => {
          const timeA = new Date(a.createTime).getTime()
          const timeB = new Date(b.createTime).getTime()
          return timeA - timeB
        })
        
        chatMessages.value = loadedMessages
        showHistoryDrawer.value = false
        
        // 滚动到底?
        await nextTick()
        scrollToBottom()
        
        logger.info(t('common.messages.loadSuccess'), { 
          conversationId, 
          messageCount: loadedMessages.length 
        })
        ElMessage.success(t('aiChat.conversationLoaded'))
      } else {
        chatMessages.value = []
        showHistoryDrawer.value = false
        ElMessage.warning(t('aiChat.noMessagesInConversation'))
      }
    } else {
      ElMessage.error(t('aiChat.conversationNotFound'))
    }
  } catch (error) {
    logger.error(t('common.errors.fetchFailed'), error)
    ElMessage.error(t('aiChat.loadConversationFailed'))
  } finally {
    loadingHistory.value = false
  }
}

// 删除对话 - 完整实现
// 删除对话处理函数（重命名避免与API函数冲突?
const handleDeleteConversation = async (conversationId: string) => {
  try {
    await ElMessageBox.confirm(
      t('aiChat.confirmDeleteConversation'),
      t('aiChat.deleteConversation'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
      }
    )
    
    const response = await deleteChatRecord(Number(conversationId))
    if (response.success) {
      ElMessage.success(t('aiChat.deleteSuccess'))
      
      // 从列表中移除
      conversations.value = conversations.value.filter(c => c.id !== conversationId)
      
      // 如果删除的是当前对话，清空消?
      if (currentConversationId.value === conversationId) {
        chatMessages.value = []
        currentConversationId.value = ''
      }
      
      logger.info(t('common.messages.deleteSuccess'), { conversationId })
    } else {
      ElMessage.error(response.message || t('aiChat.deleteFailed'))
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      logger.error(t('common.errors.deleteFailed'), error)
      ElMessage.error(t('aiChat.deleteFailed'))
    }
  }
}
  
// 开始新对话
const startNewChat = () => {
  chatMessages.value = []
  currentConversationId.value = ''
  showHistoryDrawer.value = false
  
  // 刷新对话列表
  loadConversations()
  
  logger.info('Starting new conversation')
  ElMessage.success(t('aiChat.newChatStarted'))
}

// 打开历史抽屉
const openHistoryDrawer = async () => {
  showHistoryDrawer.value = true
  await loadConversations()
}

const expandChat = () => {
  // 展开对话框时，确保对话框可见
  logger.debug('[AIChat] expandChat called - BEFORE', {
    currentMode: currentMode.value,
    internalVisible: internalVisible.value,
    propsVisible: props.visible,
    isMinimized: isMinimized.value,
    isHomePage: isHomePage.value,
    dialogVisible: dialogVisible.value,
    storeMode: chatModeStore.mode,
    isScrolledToBottom: isScrolledToBottom.value
  })
  
  // 先设置内部状态标志，防止 watch 覆盖
  isInternalModeChange = true
  
  // 关键修复：首先重置isScrolledToBottom，确保对话框可以显示
  isScrolledToBottom.value = false
  
  // 强制设置所有状态，确保对话框显?
  // 1. 设置内部可见状?
  internalVisible.value = true
  // 2. 取消最小化
  isMinimized.value = false
  
  // 3. 如果不在首页且是 global 模式，切换到 dialog 模式以便显示对话?
  if (currentMode.value === 'global' && !isHomePage.value) {
    currentMode.value = 'dialog'
    chatModeStore.setMode('dialog')
  } else if (currentMode.value !== 'dialog' && currentMode.value !== 'agent') {
    // 如果不是 dialog ?agent 模式，切换到 dialog
    currentMode.value = 'dialog'
    chatModeStore.setMode('dialog')
  }
  
  // 4. 通知父组件（如果使用 v-model?
  if (props.visible !== undefined) {
    emit('update:visible', true)
  }
  
  // 5. 重置标志，让后续?watch 可以正常工作
  nextTick(() => {
    isInternalModeChange = false
    
    logger.debug('[AIChat] expandChat after nextTick - AFTER', {
      currentMode: currentMode.value,
      internalVisible: internalVisible.value,
      propsVisible: props.visible,
      dialogVisible: dialogVisible.value,
      isMinimized: isMinimized.value,
      storeMode: chatModeStore.mode,
      isCollapsed: isCollapsed.value,
      isScrolledToBottom: isScrolledToBottom.value
    })
    
    // 如果对话框仍然不可见，强制显?
    if (!dialogVisible.value) {
      logger.warn('[AIChat] Dialog still not visible after expandChat, forcing show')
      // 再次重置所有可能阻止显示的状?
      isScrolledToBottom.value = false
      internalVisible.value = true
      isMinimized.value = false
      if (currentMode.value === 'global') {
        currentMode.value = 'dialog'
        chatModeStore.setMode('dialog')
      }
      
      // 延迟再次检查，确保状态已更新
      setTimeout(() => {
        if (!dialogVisible.value) {
          logger.error('[AIChat] Dialog still not visible, executing final recovery')
          isScrolledToBottom.value = false
          internalVisible.value = true
          isMinimized.value = false
          if (props.visible !== undefined) {
            emit('update:visible', true)
          }
        }
      }, 100)
    }
  })
  
  // watch 会自动处?isCollapsed 状?
}

const handleClose = () => {
  logger.debug('[AIChat] handleClose called - BEFORE', {
    internalVisible: internalVisible.value,
    propsVisible: props.visible,
    dialogVisible: dialogVisible.value,
    isMinimized: isMinimized.value,
    isCollapsed: isCollapsed.value
  })
  
  // 设置内部状态为 false，隐藏对话框
  internalVisible.value = false
  // 确保取消最小化状态（如果之前是最小化状态）
  isMinimized.value = false
  
  // 通知父组件（如果使用 v-model?
  if (props.visible !== undefined) {
    emit('update:visible', false)
  }
  
  emit('close')
  
  // 等待下一?tick，确保状态更?
  nextTick(() => {
    if (import.meta.env.DEV) {
      logger.debug('[AIChat] handleClose after nextTick - AFTER', {
        internalVisible: internalVisible.value,
        propsVisible: props.visible,
        dialogVisible: dialogVisible.value,
        isMinimized: isMinimized.value,
        isCollapsed: isCollapsed.value
      })
    }
    
    // 确保 isCollapsed 状态正确（显示呼出按钮?
    // watch 会自动处理，但这里作为保?
    if (dialogVisible.value === false) {
      isCollapsed.value = true
    }
  })
}

const handleOverlayClick = () => {
  isMinimized.value = true
  // watch 会自动处?isCollapsed 状?
}

const toggleSearch = () => {
  showSearch.value = !showSearch.value
}

const toggleReasoning = () => {
  showReasoning.value = !showReasoning.value
}

const handleSearch = () => {
  if (!searchQuery.value.trim()) {
    searchResults.value = []
    return
  }
  const query = searchQuery.value.toLowerCase()
  searchResults.value = chatMessages.value.filter((msg: { content: string }) =>
    msg.content.toLowerCase().includes(query)
  )
}

const handleModeChange = (newMode: 'global' | 'dialog' | 'agent') => {
  try {
    if (import.meta.env.DEV) {
      logger.debug('[AIChat] handleModeChange - Switching to:', newMode)
    }
    isInternalModeChange = true
    
    // 更新模式
    currentMode.value = newMode
    chatModeStore.setMode(newMode)
    
    // global、dialog ?agent 模式都显示对话框
    internalVisible.value = true
    isMinimized.value = false
    if (props.visible !== undefined) {
      emit('update:visible', true)
    }
    
    // 简化切换提?
    if (newMode === 'agent') {
      showSuccess(t('chatMode.enterAgentMode'))
    } else {
      showSuccess(t('chatMode.exitAgentMode'))
    }
    
    nextTick(() => {
      // 再次确认状?
      if (isMinimized.value) {
        isMinimized.value = false
      }
      if (!internalVisible.value) {
        internalVisible.value = true
      }
      isInternalModeChange = false
    })
  } catch (error) {
    isInternalModeChange = false
    showError(t('agentChat.errors.switchModeFailed') + ': ' + (error as Error).message)
  }
}

// 获取模式显示标题（用于对话框标题?
const getModeDisplayTitle = (): string => {
  // 简化标题：只显示基础标题，不显示模式名称
  // Agent 模式会在 AIDialog 中通过标签显示
  return props.dialogTitle || t('aiChat.aiDialog')
}

// 滚动到底部函?
const scrollToBottom = (smooth = true) => {
  nextTick(() => {
    if (messagesContainerRef.value) {
      messagesContainerRef.value.scrollTo({
        top: messagesContainerRef.value.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      })
      isScrolledToBottom.value = true
    }
  })
}

const handleHeaderMenuCommand = async (command: string) => {
  switch (command) {
    case 'history':
      // 打开对话历史
      await openHistoryDrawer()
      break
    case 'export':
      // 导出为TXT格式
      try {
        if (chatMessages.value.length === 0) {
          showWarning(t('floatingChat.noMessagesToExport'))
          return
        }
        exportMessagesToFile(chatMessages.value, { format: 'txt' })
        showSuccess(t('floatingChat.exported'))
      } catch (error) {
        logger.error(t('common.errors.exportFailed'), error)
        showError(t('floatingChat.exportFailed'))
      }
      break
    case 'export-markdown':
      // 导出为Markdown格式
      try {
        if (chatMessages.value.length === 0) {
          showWarning(t('floatingChat.noMessagesToExport'))
          return
        }
        exportMessagesToFile(chatMessages.value, { format: 'md' })
        showSuccess(t('floatingChat.exported'))
      } catch (error) {
        logger.error(t('common.errors.exportFailed'), error)
        showError(t('floatingChat.exportFailed'))
      }
      break
    case 'export-json':
      // 导出为JSON格式
      try {
        if (chatMessages.value.length === 0) {
          showWarning(t('floatingChat.noMessagesToExport'))
          return
        }
        exportMessagesToFile(chatMessages.value, { format: 'json' })
        showSuccess(t('floatingChat.exported'))
      } catch (error) {
        logger.error(t('common.errors.exportFailed'), error)
        showError(t('floatingChat.exportFailed'))
      }
      break
    case 'export-csv':
      // 导出为CSV格式
      try {
        if (chatMessages.value.length === 0) {
          showWarning(t('floatingChat.noMessagesToExport'))
          return
        }
        exportMessagesToFile(chatMessages.value, { format: 'csv' })
        showSuccess(t('floatingChat.exported'))
      } catch (error) {
        logger.error(t('common.errors.exportFailed'), error)
        showError(t('floatingChat.exportFailed'))
      }
      break
    case 'clear':
      try {
        await confirm(t('llmChatCenter.actions.clearChatConfirm'))
        chatMessages.value = []
        showSuccess(t('llmChatCenter.actions.clearChatSuccess'))
      } catch {
        // 用户取消
      }
      break
    case 'stats':
      showSuccess(t('aiChatInput.messageStatsTotal', { count: chatMessages.value.length }))
      break
  }
}

const handleSendMessage = async () => {
  if (!inputText.value.trim() && uploadedFiles.value.length === 0) {
    showWarning(t('aiChatInput.pleaseEnterContentOrUploadFile'))
    return
  }

  const userMessage: ChatMessage = {
    id: Date.now().toString(),
    role: 'user',
    content: inputText.value,
    createTime: new Date().toISOString(),
    status: 'sending',
    files: uploadedFiles.value.length > 0 ? uploadedFiles.value.map(f => ({
      name: f.name,
      type: f.type,
      preview: f.preview
    })) : undefined
  }

  chatMessages.value.push(userMessage)
  emit('message-sent', {
    content: inputText.value,
    model: selectedModel.value,
    response: userMessage
  })

  const messageContent = inputText.value
  inputText.value = ''
  uploadedFiles.value = []
  isSending.value = true

  try {
    const assistantMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      createTime: new Date().toISOString(),
      status: 'sending',
      isStreaming: true
    }

    chatMessages.value.push(assistantMessage)

    await streamGenerateContent(
      {
        prompt: messageContent,
        modelId: selectedModel.value?.modelCode || 'gpt-4',
        type: 'text',
        parameters: {
          temperature: 0.7,
          maxTokens: 2000,
          topP: 0.9
        }
      },
      (chunk: string) => {
        assistantMessage.content += chunk
        scrollToBottom()
      },
      (_response) => {
        assistantMessage.status = 'sent'
        assistantMessage.isStreaming = false
        emit('message-received', assistantMessage)
        userMessage.status = 'sent'
      },
      (error) => {
        throw error
      }
    )
  } catch (error) {
      logger.error(t('common.errors.operationFailed'), error)
    userMessage.status = 'failed'
    const failedMessage = chatMessages.value.find((m: ChatMessage) => m.id === (Date.now() + 1).toString())
    if (failedMessage) {
      failedMessage.status = 'failed'
      failedMessage.isStreaming = false
    }
    showError(t('agentChat.errors.sendMessageFailed'))
  } finally {
    isSending.value = false
    scrollToBottom()
  }
}

// Agent模式的消息发送处?
const handleAgentSendMessage = async () => {
  if (!inputText.value.trim()) {
    showWarning(t('agentChat.pleaseEnterContent'))
    return
  }

  const userMessage: AgentMessage = {
    role: 'user',
    type: 'text',
    content: inputText.value,
    time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }

  messages.value.push(userMessage)
  const messageContent = inputText.value
  inputText.value = ''
  isSending.value = true

  try {
    // 模拟agent思考过?
    if (showReasoning.value) {
      reasoningChain.value = [
        { step: 1, reasoning: t('agentChat.reasoningChain.step1'), confidence: 0.3 },
        { step: 2, reasoning: t('agentChat.reasoningChain.step2'), confidence: 0.6 },
        { step: 3, reasoning: t('agentChat.reasoningChain.step3'), confidence: 0.9 }
      ]
      await new Promise(resolve => setTimeout(resolve, 1500))
    }

    // 模拟agent回复
    await new Promise(resolve => setTimeout(resolve, 1000))

    const assistantMessage: AgentMessage = {
      role: 'assistant',
      type: 'text',
      content: t('agentChat.agentReply', { message: messageContent }),
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      stage: 'result'
    }

    messages.value.push(assistantMessage)
    showSuccess(t('agentChat.messageSent'))
  } catch (error) {
    logger.error(t('common.errors.operationFailed'), error)
    showError(t('agentChat.errors.sendMessageFailed'))
  } finally {
    isSending.value = false
    scrollToBottom()
  }
}

const handleVoiceToggle = async () => {
  if (isRecording.value) {
    handleVoiceStop()
    return
  }

  try {
    isRecording.value = true

    const success = startSpeechRecognition(
      {
        lang: 'zh-CN',
        continuous: true,
        interimResults: true
      },
      {
        onStart: () => {
          showInfo(t('aiChatInput.voiceStarted'))
        },
        onResult: (text, isFinal) => {
          if (isFinal) {
            inputText.value = (inputText.value + ' ' + text).trim()
          }
        },
        onError: (error) => {
          // 处理国际化错误消?
          let errorMessage = error
          if (error === 'VOICE_RECOGNITION_ALREADY_STARTED') {
            errorMessage = t('voiceInput.alreadyStarted')
          } else if (error.includes('recognition has already started') || 
                     error.includes('already started') ||
                     error.includes('Failed to execute \'start\' on \'SpeechRecognition\'')) {
            errorMessage = t('voiceInput.alreadyStarted')
          }
          showError(errorMessage)
          isRecording.value = false
        },
        onEnd: (finalText) => {
          // 录音结束时，获取最终的累积文本并添加到输入?
          if (finalText) {
            inputText.value = (inputText.value + ' ' + finalText).trim()
            logger.info('[AIChat] Recording ended, text added to input:', finalText)
          }
          isRecording.value = false
        }
      }
    )

    if (!success) {
      isRecording.value = false
      showError(t('agentChat.errors.startVoiceRecognitionFailed'))
    }
  } catch (error) {
    logger.error(t('common.errors.operationFailed'), error)
    isRecording.value = false
    showError(t('agentChat.errors.startVoiceRecognitionFailed'))
  }
}

const handleVoiceStop = async (audioData?: { audioUrl: string; duration: number }) => {
  if (!isRecording.value) {
    return
  }

  try {
    // 停止语音识别
    // onEnd 回调会在停止后自动触发，并在那里处理文本添加
    stopSpeechRecognition()

    // voiceRecorder 不存在，直接使用传入的 audioData
    const finalAudioData = audioData
    
    // 如果有录音数据，添加到消息中显示为卡?
    if (finalAudioData && finalAudioData.audioUrl) {
      // 确保当前模式是 dialog 模式，录音卡片才会显示在对话框内
      if (currentMode.value !== 'dialog') {
        logger.warn('[AIChat] Not in dialog mode, switching to dialog mode to show recording card')
        currentMode.value = 'dialog'
        chatModeStore.setMode('dialog')
      }
      
      // ?blob URL 转换?data URL，以便持久化存储（blob URL 在页面刷新后会失效）
      let audioPreviewUrl = finalAudioData.audioUrl
      if (finalAudioData.audioUrl.startsWith('blob:')) {
        try {
          audioFetchController = new AbortController()
          const response = await fetch(finalAudioData.audioUrl, { signal: audioFetchController.signal })
          const blob = await response.blob()
          const reader = new FileReader()
          audioPreviewUrl = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(blob)
          })
          // 清理原来?blob URL
          URL.revokeObjectURL(finalAudioData.audioUrl)
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') return
          logger.warn('[AIChat] Failed to convert blob URL to data URL, using original:', error)
          // 如果转换失败，继续使用原?URL（但可能无法持久化）
        }
      }
      
      const audioMessage: ChatMessage = {
        id: `audio-${Date.now()}`,
        role: 'user',
        content: t('agentChat.audioRecording', { duration: finalAudioData.duration }),
        files: [{
          name: t('agentChat.audioRecording', { duration: finalAudioData.duration }),
          type: 'audio/webm',
          preview: audioPreviewUrl
        }],
        createTime: new Date().toISOString(),
        isLocal: true,
        status: 'sent'
      }
      
      // 添加到消息列表（使用 chatMessages，因?displayMessages 显示的是 chatMessages?
      chatMessages.value.push(audioMessage)
      logger.info('[AIChat] Recording card added to message list:', audioMessage)
      
      // 确保对话框可见且未最小化
      if (isMinimized.value) {
        isMinimized.value = false
      }
      // dialogVisible ?computed，通过设置 internalVisible 来控?
      if (!internalVisible.value) {
        internalVisible.value = true
      }
      
      // 滚动到底?
      nextTick(() => {
        scrollToBottom()
        // 再次确保消息容器可见
        if (messagesContainerRef.value) {
          messagesContainerRef.value.scrollTop = messagesContainerRef.value.scrollHeight
        }
      })
    }
    
    // 备用方案：如?onEnd 回调没有触发或没有文本，尝试直接获取
    // 使用 setTimeout 确保在识别完全停止后获取文本
    setTimeout(() => {
      const accumulatedText = getAccumulatedText()
      if (accumulatedText && !inputText.value.includes(accumulatedText)) {
        // 如果输入框中还没有这个文本，则添?
        inputText.value = (inputText.value + ' ' + accumulatedText).trim()
        logger.info('[AIChat] Fallback: Recording text added to input:', accumulatedText)
      }
    }, 500) // 等待500ms确保识别结果已处?
    
    // 注意：isRecording 会在 onEnd 回调中设置为 false
    // 但为了安全起见，如果 onEnd 没有触发，我们也在这里设?
    setTimeout(() => {
      if (isRecording.value) {
        isRecording.value = false
      }
    }, 1000)
    
    showInfo(t('agentChat.voiceRecognition.stopped'))
  } catch (error) {
    logger.error(t('common.errors.operationFailed'), error)
    isRecording.value = false
  }
}

const triggerFileUpload = (type: string) => {
  if (!fileInputRef.value) return

  if (uploadedFiles.value.length >= MAX_FILES) {
    showWarning(t('agentChat.warnings.maxFileUpload'))
    return
  }

  // 定义支持的文件格式（HTML accept 属性格式：MIME类型和扩展名用逗号分隔?
  const acceptTypes: Record<string, string> = {
    image: 'image/*,.jpg,.jpeg,.png,.gif,.bmp,.webp,.svg,.ico,.tiff,.tif,.heic,.heif,.avif,.jfif',
    video: 'video/*,.mp4,.avi,.mov,.wmv,.flv,.mkv,.webm,.m4v,.3gp,.3g2,.mpg,.mpeg,.m2v,.ogv,.rm,.rmvb,.asf,.f4v,.ts,.mts,.vob,.divx,.xvid',
    audio: 'audio/*,.mp3,.wav,.flac,.aac,.ogg,.wma,.m4a,.opus,.amr,.aiff,.au,.ra,.ape,.ac3,.dts,.mp2,.mpa,.wv,.tak,.tta,.cda,.dsd,.dsf'
  }

  // 设置 accept 类型
  const acceptValue = acceptTypes[type] || '*/*'
  currentAcceptTypes.value = acceptValue
  
  // 直接设置 input 元素?accept 属性，确保立即生效
  if (fileInputRef.value) {
    fileInputRef.value.accept = acceptValue
    // 使用 nextTick 确保属性更新后再触发点?
    nextTick(() => {
      fileInputRef.value?.click()
    })
  }
}

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (!files || files.length === 0) return

  // 获取当前期望的文件类型（?accept 属性判断）
  const acceptValue = currentAcceptTypes.value.toLowerCase()
  const expectedType = acceptValue.includes('image') ? 'image' : 
                       acceptValue.includes('video') ? 'video' : 
                       acceptValue.includes('audio') ? 'audio' : 'any'

  Array.from(files).forEach((file) => {
    // 验证文件类型
    if (expectedType !== 'any') {
      const fileType = file.type.toLowerCase()
      const fileName = file.name.toLowerCase()
      
      let isValidType = false
      
      if (expectedType === 'image') {
        isValidType = fileType.startsWith('image/') || 
                     ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico', '.tiff', '.tif', '.heic', '.heif', '.avif', '.jfif']
                       .some(ext => fileName.endsWith(ext))
      } else if (expectedType === 'video') {
        isValidType = fileType.startsWith('video/') || 
                     ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm', '.m4v', '.3gp', '.3g2', '.mpg', '.mpeg', '.m2v', '.ogv', '.rm', '.rmvb', '.asf', '.f4v', '.ts', '.mts', '.vob', '.divx', '.xvid']
                       .some(ext => fileName.endsWith(ext))
      } else if (expectedType === 'audio') {
        isValidType = fileType.startsWith('audio/') || 
                     ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a', '.opus', '.amr', '.aiff', '.au', '.ra', '.ape', '.ac3', '.dts', '.mp2', '.mpa', '.wv', '.tak', '.tta', '.cda', '.dsd', '.dsf']
                       .some(ext => fileName.endsWith(ext))
      }
      
      if (!isValidType) {
        const typeNames = { 
          image: t('common.image'), 
          video: t('common.video'), 
          audio: t('common.audio') 
        }
        showWarning(t('floatingChat.invalidFileType', { name: file.name, type: typeNames[expectedType] }))
        return
      }
    }

    // 设置文件大小限制
    let maxSize = 10 * 1024 * 1024 // 默认 10MB
    if (file.type.startsWith('video/') || expectedType === 'video') {
      maxSize = 100 * 1024 * 1024 // 视频 100MB
    } else if (file.type.startsWith('audio/') || expectedType === 'audio') {
      maxSize = 50 * 1024 * 1024 // 音频 50MB
    } else if (file.type.startsWith('image/') || expectedType === 'image') {
      maxSize = 20 * 1024 * 1024 // 图片 20MB
    }

    if (file.size > maxSize) {
      const sizeMB = (maxSize / 1024 / 1024).toFixed(0)
      showWarning(t('floatingChat.fileTooLarge', { name: file.name, max: `${sizeMB}MB` }))
      return
    }

    if (uploadedFiles.value.length >= MAX_FILES) {
      showWarning(t('floatingChat.maxFilesReached', { max: MAX_FILES }))
      return
    }

    // 读取文件
    const reader = new FileReader()
    reader.onerror = () => {
      showError(t('floatingChat.fileReadFailed', { name: file.name }))
    }
    reader.onload = (e) => {
      if (e.target?.result) {
        uploadedFiles.value.push({
          file,
          preview: e.target.result as string,
          type: file.type || getFileTypeFromName(file.name),
          name: file.name
        })
        showSuccess(t('floatingChat.fileUploadSuccess', { name: file.name }))
      }
    }
    
    // 根据文件类型选择读取方式
    if (file.type.startsWith('image/') || expectedType === 'image') {
      reader.readAsDataURL(file)
    } else if (file.type.startsWith('video/') || expectedType === 'video') {
      reader.readAsDataURL(file)
    } else if (file.type.startsWith('audio/') || expectedType === 'audio') {
      reader.readAsDataURL(file)
    } else {
      reader.readAsDataURL(file)
    }
  })

  // 清空 input 值，允许再次选择同一文件
  target.value = ''
}

// 根据文件名获?MIME 类型
const getFileTypeFromName = (fileName: string): string => {
  const lastDotIndex = fileName.lastIndexOf('.')
  if (lastDotIndex === -1 || lastDotIndex === fileName.length - 1) {
    return 'application/octet-stream'
  }
  const ext = fileName.substring(lastDotIndex).toLowerCase()
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff',
    '.heic': 'image/heic',
    '.heif': 'image/heif',
    '.avif': 'image/avif',
    '.mp4': 'video/mp4',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.wmv': 'video/x-ms-wmv',
    '.flv': 'video/x-flv',
    '.mkv': 'video/x-matroska',
    '.webm': 'video/webm',
    '.m4v': 'video/x-m4v',
    '.3gp': 'video/3gpp',
    '.vob': 'video/dvd',
    '.divx': 'video/divx',
    '.xvid': 'video/xvid',
    '.jfif': 'image/jpeg',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.flac': 'audio/flac',
    '.aac': 'audio/aac',
    '.ogg': 'audio/ogg',
    '.wma': 'audio/x-ms-wma',
    '.m4a': 'audio/mp4',
    '.opus': 'audio/opus',
    '.cda': 'audio/x-cda',
    '.dsd': 'audio/dsd',
    '.dsf': 'audio/dsf'
  }
  return mimeTypes[ext] || 'application/octet-stream'
}

const handleRemoveImage = (index: number) => {
  uploadedFiles.value.splice(index, 1)
}

const handleInput = () => {
  const textarea = inputRef.value
  if (textarea) {
    textarea.style.height = 'auto'
    textarea.style.height = textarea.scrollHeight + 'px'
  }
}

const handleShiftEnter = () => {
  const textarea = inputRef.value
  if (textarea) {
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const value = textarea.value
    textarea.value = value.substring(0, start) + '\n' + value.substring(end)
    textarea.selectionStart = textarea.selectionEnd = start + 1
    handleInput()
  }
}

const handleModelSelect = (command: string) => {
  selectedModel.value = command
}

const copyMessage = (content: string) => {
  navigator.clipboard.writeText(content)
  showSuccess(t('agentChat.success.copyToClipboard'))
}

const editMessage = (message: ChatMessage) => {
  editingMessageId.value = message.id
  editContent.value = message.content
}

const saveEdit = () => {
  if (editingMessageId.value) {
    const message = chatMessages.value.find((m: ChatMessage) => m.id === editingMessageId.value)
    if (message) {
      message.content = editContent.value
      message.edited = true
    }
    editingMessageId.value = null
    editContent.value = ''
    showSuccess(t('agentChat.success.messageUpdated'))
  }
}

const cancelEdit = () => {
  editingMessageId.value = null
  editContent.value = ''
}

const deleteMessage = async (message: ChatMessage) => {
  try {
    await confirm(t('agentChat.warnings.confirmDelete'))
    const index = chatMessages.value.findIndex((m: ChatMessage) => m.id === message.id)
    if (index !== -1) {
      chatMessages.value.splice(index, 1)
      showSuccess(t('agentChat.success.messageDeleted'))
    }
  } catch {
    // 用户取消
  }
}

// 重新生成消息 - 完整实现
const regenerateMessage = async (message: ChatMessage) => {
  if (message.role !== 'assistant') {
    showWarning(t('floatingChat.canOnlyRegenerateAI'))
    return
  }

  // 找到该消息对应的用户消息
  const messageIndex = chatMessages.value.findIndex((m: ChatMessage) => m.id === message.id)
  if (messageIndex === -1 || messageIndex === 0) {
    showError(t('floatingChat.messageNotFound'))
    return
  }

  const userMessage = chatMessages.value[messageIndex - 1]
  if (userMessage.role !== 'user') {
    showError(t('floatingChat.messageNotFound'))
    return
  }

  // 删除旧的AI消息
  chatMessages.value.splice(messageIndex, 1)

  // 重新生成
  isSending.value = true

  try {
    const newAssistantMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      content: '',
      createTime: new Date().toISOString(),
      status: 'sending',
      isStreaming: true,
      model: selectedModel.value,
    }

    chatMessages.value.push(newAssistantMessage)

    await streamGenerateContent(
      {
        prompt: userMessage.content,
        modelId: selectedModel.value?.modelCode || 'gpt-4',
        type: 'text',
        parameters: {
          temperature: 0.7,
          maxTokens: 2000,
          topP: 0.9,
        },
      },
      (chunk: string) => {
        newAssistantMessage.content += chunk
        scrollToBottom()
      },
      (_response) => {
        newAssistantMessage.status = 'sent'
        newAssistantMessage.isStreaming = false
        emit('message-received', newAssistantMessage)
        showSuccess(t('floatingChat.regenerateSuccess'))
      },
      (error) => {
        throw error
      }
    )
  } catch (error) {
    logger.error('Failed to regenerate message:', error)
    const failedMessage = chatMessages.value.find((m: ChatMessage) => m.id === message.id)
    if (failedMessage) {
      failedMessage.status = 'failed'
      failedMessage.isStreaming = false
      failedMessage.error = error instanceof Error ? error.message : String(error)
    }
    showError(t('floatingChat.regenerateFailed'))
  } finally {
    isSending.value = false
    scrollToBottom()
  }
}

const toggleLikeMessage = (message: ChatMessage) => {
  message.liked = !message.liked
}

// 重试消息 - 完整实现
const handleRetryMessage = async (message: ChatMessage) => {
  if (message.status !== 'failed') {
    showWarning(t('floatingChat.canOnlyRetryFailed'))
    return
  }

  const messageIndex = chatMessages.value.findIndex((m: ChatMessage) => m.id === message.id)
  if (messageIndex === -1) {
    showError(t('floatingChat.messageNotFound'))
    return
  }

  isSending.value = true

  try {
    // 如果是用户消息失败，重新发?
    if (message.role === 'user') {
      message.status = 'sending'
      
      // 找到对应的AI消息（如果有）并删除
      if (chatMessages.value[messageIndex + 1]?.role === 'assistant') {
        chatMessages.value.splice(messageIndex + 1, 1)
      }

      // 重新发?
      await handleSendMessage()
    } else if (message.role === 'assistant') {
      // 如果是AI消息失败，重新生?
      await regenerateMessage(message)
    }
  } catch (error) {
    logger.error('Failed to retry message:', error)
    message.status = 'failed'
    message.error = error instanceof Error ? error.message : String(error)
    showError(t('floatingChat.retryFailed'))
  } finally {
    isSending.value = false
  }
}

const handleDownloadFile = (file: { name: string; preview: string }) => {
  const link = document.createElement('a')
  link.href = file.preview
  link.download = file.name
  link.click()
}

const setMessageRef = (el: HTMLElement | null, id: string) => {
  if (el) {
    messageRefs.value.set(id, el)
  } else {
    messageRefs.value.delete(id)
  }
}

const setAudioRef = (el: HTMLElement | null, index: number) => {
  if (el) {
    audioElements.value.set(index, el as HTMLAudioElement)
  } else {
    audioElements.value.delete(index)
  }
}

const updateAudioDuration = (index: number) => {
  const audioElement = audioElements.value.get(index)
  if (audioElement && audioElement.duration) {
    audioDurations.value[index] = audioElement.duration
  }
}

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const formatMessageTime = (timestamp: string): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)

  if (minutes < 1) {
    return t('agentChat.timeLabels.justNow')
  } else if (minutes < 60) {
    return t('agentChat.timeLabels.minutesAgo', { minutes })
  } else {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
}

const shouldShowDateSeparator = (index: number): boolean => {
  if (index === 0) return false
  const currentMessage = displayMessages.value[index]
  const previousMessage = displayMessages.value[index - 1]
  if (!currentMessage || !previousMessage) return false

  const currentDate = new Date(currentMessage.createTime).toDateString()
  const previousDate = new Date(previousMessage.createTime).toDateString()
  return currentDate !== previousDate
}

const getDateLabelForMessage = (date: Date): string => {
  return getDateLabel(date.getTime())
}

const isMarkdownContent = (content: string): boolean => {
  return isMarkdown(content)
}

const formatMessageContent = (content: string): string => {
  try {
    const html = marked.parse(content) as string
    return DOMPurify.sanitize(html)
  } catch (error) {
    logger.error('Markdown render failed:', error)
    return DOMPurify.sanitize(content.replace(/\n/g, '<br>'))
  }
}

// 监听消息变化，如果之前已经滚动到底部，自动滚动到底部
watch([displayMessages, () => messages.value.length], () => {
  if (isScrolledToBottom.value) {
    scrollToBottom()
  }
}, { deep: true })

// 监听对话框状态，控制右下角呼起按钮显?
watch([dialogVisible, isMinimized], ([visible, minimized]) => {
  // 当对话框显示且未最小化时，隐藏呼起按钮
  // 当对话框最小化或关闭时，显示呼起按?
  if (visible && !minimized) {
    isCollapsed.value = false // 隐藏按钮
  } else {
    isCollapsed.value = true // 显示按钮
  }
}, { immediate: true })

// 关键修复：监听dialogVisible，如果它意外变为false但应该显示，自动恢复
watch(dialogVisible, (newVisible, oldVisible) => {
  // 如果对话框从可见变为不可见，检查是否应该显?
  if (!newVisible && oldVisible) {
    const shouldShow = currentMode.value === 'dialog' || currentMode.value === 'agent' || isHomePage.value
    const userClosed = internalVisible.value === false
    const parentForcesHide = props.visible === false
    
    // 如果应该显示但被意外隐藏，且不是用户主动关闭，也不是父组件强制隐藏，则恢复显?
    if (shouldShow && !userClosed && !parentForcesHide) {
      // 检查是否是isScrolledToBottom导致的隐?
      if (isScrolledToBottom.value) {
        // 重新检查是否真的重?
        nextTick(() => {
          if (isHomePage.value) {
            checkOverlapWithFooter()
            // 如果检查后仍然不可见，可能是误判，强制显示
            setTimeout(() => {
              if (!dialogVisible.value && shouldShow) {
                logger.warn('[AIChat] Dialog accidentally hidden, forcing restore')
                isScrolledToBottom.value = false
                internalVisible.value = true
                isMinimized.value = false
                if (props.visible !== undefined) {
                  emit('update:visible', true)
                }
              }
            }, 200)
          }
        })
      } else {
        // 如果不是isScrolledToBottom导致的，可能是其他原因，强制恢复
        logger.warn('[AIChat] Dialog accidentally hidden (non-isScrolledToBottom), forcing restore')
        internalVisible.value = true
        isMinimized.value = false
        if (props.visible !== undefined) {
          emit('update:visible', true)
        }
      }
    }
  }
})

// 监听首页模式变化，更新滚动监?
watch(isHomePage, (newValue, oldValue) => {
  if (newValue === oldValue) return
  
  if (import.meta.env.DEV) {
    logger.debug('[AIChat] Home mode changed:', oldValue, '->', newValue)
  }
  
  // 移除所有旧的监听器
  window.removeEventListener('scroll', handleWindowScroll)
  window.removeEventListener('resize', handleResize)
  const container = messagesContainerRef.value
  if (container) {
    container.removeEventListener('scroll', handleScroll)
  }
  
  // 添加新的监听?
  nextTick(() => {
    if (newValue || !messagesContainerRef.value) {
      // 首页模式或没有消息容器：监听 window 滚动
      logger.debug('[AIChat] Adding window scroll listener')
      window.addEventListener('scroll', handleWindowScroll, { passive: true })
      window.addEventListener('resize', handleResize, { passive: true })
    } else {
      // 非首页模式：监听消息容器滚动
      const container = messagesContainerRef.value
      if (container) {
        logger.debug('[AIChat] Adding message container scroll listener')
        container.addEventListener('scroll', handleScroll, { passive: true })
      }
    }
    // 重新检查滚动位?
    setTimeout(() => {
      checkScrollPosition()
    }, 100)
  })
})

// 监听窗口大小变化，重新检查滚动位置（添加防抖?
const handleResize = () => {
  // 清除之前的定时器
  if (resizeDebounceTimer !== null) {
    clearTimeout(resizeDebounceTimer)
    resizeDebounceTimer = null
  }
  // 添加防抖?00ms后才执行检?
  resizeDebounceTimer = window.setTimeout(() => {
    resizeDebounceTimer = null
    if (isHomePage.value) {
      // 只在对话框可见时才检?
      if (dialogVisible.value) {
        checkOverlapWithFooter()
      }
    } else {
      checkScrollPosition()
    }
  }, 300)
}

// 检查聊天对话框?footer 是否重合
const checkOverlapWithFooter = () => {
  if (!isHomePage.value) {
    // 不在首页时，重置状态，确保对话框显?
    if (isScrolledToBottom.value) {
      isScrolledToBottom.value = false
      if (import.meta.env.DEV) {
        if (import.meta.env.DEV) {
          logger.debug('[Overlap Check] Not home page mode, resetting isScrolledToBottom to false')
        }
      }
    }
    return
  }
  
  // 关键修复：如果对话框当前不可见（dialogVisible为false），不应该隐藏它
  // 这可以防止在对话框应该显示时被错误地隐藏
  if (!dialogVisible.value) {
    // 如果对话框不可见，说明它已经被其他逻辑隐藏了，不应该再设置isScrolledToBottom
    // 但如果是初始化阶段，应该确保isScrolledToBottom为false，以便对话框可以显示
    if (isScrolledToBottom.value) {
      isScrolledToBottom.value = false
      if (import.meta.env.DEV) {
        logger.debug('[Overlap Check] Dialog not visible, resetting isScrolledToBottom to false to allow display')
      }
    }
    return
  }
  
  // 获取聊天对话框元素（而不?input-wrapper?
  const chatDialog = document.querySelector('.ai-chat-dialog.is-home') as HTMLElement
  
  // 如果对话框元素不存在，可能是因为dialogVisible为false导致元素被移?
  // 在这种情况下，我们应该确保isScrolledToBottom为false，以便对话框可以显示
  if (!chatDialog) {
    // 关键修复：当对话框元素不存在时，默认应该显示对话框（isScrolledToBottom = false?
    // 只有在确认footer确实与对话框位置重合时，才应该隐?
    const footer = (document.querySelector('footer.footer-container') || document.querySelector('.footer-container')) as HTMLElement | null
    if (footer) {
      const footerRect = footer.getBoundingClientRect()
      const isFooterInViewport = footerRect.bottom > 0 && footerRect.top < window.innerHeight
      
      // 只有当footer确实在视口中可见，且位于视口底部附近时，才考虑隐藏对话?
      // 否则，默认显示对话框
      if (isFooterInViewport) {
        // footer在视口中，检查是否在底部附近（距离底部小?00px?
        const distanceToBottom = window.innerHeight - footerRect.top
        if (distanceToBottom > 100) {
          // footer不在底部附近，应该显示对话框
          if (isScrolledToBottom.value) {
            isScrolledToBottom.value = false
            if (import.meta.env.DEV) {
              if (import.meta.env.DEV) {
                logger.debug('[Overlap Check] Element does not exist, footer not near bottom, resetting to show')
              }
            }
          }
        }
      } else {
        // footer不在视口中，应该显示对话?
        if (isScrolledToBottom.value) {
          isScrolledToBottom.value = false
          if (import.meta.env.DEV) {
            if (import.meta.env.DEV) {
              logger.debug('[Overlap Check] Element does not exist, footer not in viewport, resetting to show')
            }
          }
        }
      }
    } else {
      // footer不存在，应该显示对话?
      if (isScrolledToBottom.value) {
        isScrolledToBottom.value = false
        if (import.meta.env.DEV) {
          if (import.meta.env.DEV) {
            logger.debug('[Overlap Check] Element does not exist and footer does not exist, resetting to show')
          }
        }
      }
    }
    // 如果元素不存在，延迟重试（但不要无限重试?
    if (overlapCheckAnimationFrame === null) {
      overlapCheckAnimationFrame = requestAnimationFrame(() => {
        overlapCheckAnimationFrame = null
        setTimeout(() => {
          // 只在对话框可见时才重?
          if (dialogVisible.value) {
            checkOverlapWithFooter()
          }
        }, 100)
      })
    }
    return
  }
  
  // 使用更具体的选择器查找footer元素
  const footer = (document.querySelector('footer.footer-container') || document.querySelector('.footer-container')) as HTMLElement | null
  if (!footer) {
    // 如果 footer 不存在，应该显示对话?
    if (isScrolledToBottom.value) {
      isScrolledToBottom.value = false
      if (import.meta.env.DEV) {
        if (import.meta.env.DEV) {
          logger.debug('[Overlap Check] Footer does not exist, resetting to show')
        }
      }
    }
    // 延迟重试（但不要无限重试?
    if (overlapCheckAnimationFrame === null) {
      overlapCheckAnimationFrame = requestAnimationFrame(() => {
        overlapCheckAnimationFrame = null
        setTimeout(() => {
          if (dialogVisible.value) {
            checkOverlapWithFooter()
          }
        }, 100)
      })
    }
    return
  }
  
  const dialogRect = chatDialog.getBoundingClientRect()
  const footerRect = footer.getBoundingClientRect()
  
  // 清除延迟重试的动画帧
  if (overlapCheckAnimationFrame !== null) {
    cancelAnimationFrame(overlapCheckAnimationFrame)
    overlapCheckAnimationFrame = null
  }
  
  // 检查元素是否在视口中可见（至少部分可见?
  const isDialogInViewport = dialogRect.bottom > 0 && dialogRect.top < window.innerHeight
  const isFooterInViewport = footerRect.bottom > 0 && footerRect.top < window.innerHeight
  
  // 如果footer不在视口中，检查是否需要隐?
  if (!isFooterInViewport) {
    // footer在视口上方（已滚动过），应该隐藏
    if (footerRect.bottom <= 0) {
      if (!isScrolledToBottom.value) {
        isScrolledToBottom.value = true
        if (import.meta.env.DEV) {
          if (import.meta.env.DEV) {
            logger.debug('[Overlap Check] Footer above viewport, setting isScrolledToBottom to true')
          }
        }
      }
      return
    }
    // footer在视口下方（还没滚动到），不应该隐藏
    if (footerRect.top >= window.innerHeight) {
      if (isScrolledToBottom.value) {
        isScrolledToBottom.value = false
        if (import.meta.env.DEV) {
          if (import.meta.env.DEV) {
            logger.debug('[Overlap Check] Footer below viewport, resetting to show')
          }
        }
      }
      return
    }
  }
  
  // 检查是否重合（修复后的逻辑?
  // 计算对话框底部到footer顶部的距?
  const distanceToFooter = dialogRect.bottom - footerRect.top
  
  // 使用较小的阈值（20px），更敏感地检测重?
  const overlapThreshold = 20
  
  // 如果对话框底部在footer顶部下方（有重叠），或者距离footer顶部很近（小于阈值），则隐藏
  const isOverlapping = distanceToFooter >= -overlapThreshold
  
  // 关键修复：只有当对话框在视口中可见且确实与footer重合时，才隐?
  // 并且只有当对话框确实可见时，才进行隐藏判?
  const shouldHide = isDialogInViewport && isOverlapping && dialogVisible.value
  
  // 关键修复：只有当状态真正需要改变时才更新，避免频繁的状态切?
  const wasAtBottom = isScrolledToBottom.value
  if (wasAtBottom !== shouldHide) {
    isScrolledToBottom.value = shouldHide
    
    if (import.meta.env.DEV) {
      logger.debug('[Overlap Check] State changed', {
        wasAtBottom,
        shouldHide,
        isOverlapping,
        isDialogInViewport,
        isFooterInViewport,
        dialogRect: { top: dialogRect.top, bottom: dialogRect.bottom, height: dialogRect.height },
        footerRect: { top: footerRect.top, bottom: footerRect.bottom, height: footerRect.height },
        distanceToFooter,
        threshold: overlapThreshold,
        isScrolledToBottom: isScrolledToBottom.value,
        dialogVisible: dialogVisible.value
      })
    }
  } else if (import.meta.env.DEV && shouldHide) {
    // 即使在状态不变的情况下，也记录日志，帮助调试
    logger.debug('[Overlap Check] Overlap detected but state unchanged:', {
      isOverlapping,
      isDialogInViewport,
      isFooterInViewport,
      distanceToFooter,
      dialogRect: { top: dialogRect.top, bottom: dialogRect.bottom },
      footerRect: { top: footerRect.top, bottom: footerRect.bottom },
      wasAtBottom,
      shouldHide
    })
  }
}

// 检查是否滚动到底部
const checkScrollPosition = () => {
  // 如果是首页模式，使用元素位置检?
  if (isHomePage.value) {
    checkOverlapWithFooter()
    return
  }
  
  // 如果没有消息容器，检测页面滚?
  if (!messagesContainerRef.value) {
    // 使用多种方法获取准确的页面高度和滚动位置
    const windowHeight = window.innerHeight || document.documentElement.clientHeight
    const documentHeight = Math.max(
      document.body.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.clientHeight,
      document.documentElement.scrollHeight,
      document.documentElement.offsetHeight
    )
    const scrollTop = Math.max(
      window.pageYOffset || 0,
      document.documentElement.scrollTop || 0,
      document.body.scrollTop || 0
    )
    
    // 如果内容不足以产生滚动条，显示输入框（不在底部状态）
    if (documentHeight <= windowHeight) {
      isScrolledToBottom.value = false
      if (import.meta.env.DEV) {
        logger.debug('[Scroll Check] Content not scrollable, showing input')
      }
      return
    }
    
    // 计算距离底部的距?
    const distanceToBottom = documentHeight - (scrollTop + windowHeight)
    
    // 允许 100px 的误差范围（因为有些页面可能有固定定位的元素?
    const threshold = 100
    
    // 当距离底部小于等于阈值时，认为已经滚动到底部
    const wasAtBottom = isScrolledToBottom.value
    isScrolledToBottom.value = distanceToBottom <= threshold
    
    // 调试信息
    if (import.meta.env.DEV) {
      logger.debug('[Scroll Check]', {
        isHomePage: isHomePage.value,
        hasMessagesContainer: !!messagesContainerRef.value,
        documentHeight,
        windowHeight,
        scrollTop,
        distanceToBottom,
        threshold,
        isScrolledToBottom: isScrolledToBottom.value,
        wasAtBottom,
        changed: wasAtBottom !== isScrolledToBottom.value
      })
    }
    
    return
  }
  
  // 非首页模式，检测消息容器滚?
  const container = messagesContainerRef.value
  if (!container) {
    // 容器不存在时，默认显示输入框（不在底部状态）
    isScrolledToBottom.value = false
    return
  }
  
  const { scrollTop, scrollHeight, clientHeight } = container
  
  // 如果内容不足以产生滚动条，显示输入框（不在底部状态）
  if (scrollHeight <= clientHeight) {
    isScrolledToBottom.value = false
    return
  }
  
  // 允许 5px 的误差范?
  const threshold = 5
  isScrolledToBottom.value = scrollHeight - scrollTop - clientHeight <= threshold
}

// 滚动监听处理函数
const handleScroll = () => {
  if (scrollRafId !== null) return
  scrollRafId = requestAnimationFrame(() => {
    scrollRafId = null
    checkScrollPosition()
  })
}

// 页面滚动监听处理函数（用于首页模式，添加防抖?
const handleWindowScroll = () => {
  if (windowScrollRafId !== null) return
  windowScrollRafId = requestAnimationFrame(() => {
    windowScrollRafId = null
    // 清除之前的定时器
    if (scrollDebounceTimer !== null) {
      clearTimeout(scrollDebounceTimer)
      scrollDebounceTimer = null
    }
    // 添加防抖?00ms后才执行检测（滚动事件比较频繁，使用较短的延迟?
    scrollDebounceTimer = window.setTimeout(() => {
      scrollDebounceTimer = null
      if (isHomePage.value) {
        // 关键修复：即使对话框不可见，也应该检测，因为状态可能会改变
        // checkOverlapWithFooter函数内部已经处理了元素不存在的情?
        checkOverlapWithFooter()
      } else {
        checkScrollPosition()
      }
    }, 100)
  })
}

const getRoleLabel = (role: string): string => {
  return role === 'user' ? t('agentChat.roles.user') : t('agentChat.roles.assistant')
}

const getStageLabel = (stage: string): string => {
  const labels: Record<string, string> = {
    reasoning: t('agentChat.stages.reasoning'),
    acting: t('agentChat.stages.acting'),
    result: t('agentChat.stages.result'),
  }
  return labels[stage] || ''
}

const getStatusType = (status?: string): string => {
  const types: Record<string, string> = {
    success: 'success',
    processing: 'warning',
    failed: 'danger',
  }
  return types[status || 'processing'] || 'info'
}

const getModelListByTab = async (tabType: string) => {
  loadingModels.value = true
  modelList.value = []
  selectedModel.value = ''
  
  // ExtendedModel 接口定义（扩?AIModelInfo 类型以支持额外属性）
  interface ExtendedModel extends AIModelInfo {
    isUniversal?: boolean
    isDigitalHuman?: boolean
    is_new?: number
    is_top?: number
  }
  
  // 类型转换函数用于安全的类型转?
  const asExtendedModel = (model: AIModelInfo): ExtendedModel => model as unknown as ExtendedModel
  
  if (import.meta.env.DEV) {
    logger.debug('[AIChat] Fetching model list, tab:', tabType)
  }
  
  try {
    const response = await getAvailableModels()
    
    if (import.meta.env.DEV) {
      logger.debug('[AIChat] API response:', response)
    }
    
    if (response.success && response.data) {
      const allModels = response.data
      
      if (import.meta.env.DEV) {
        logger.debug('[AIChat] Total models:', allModels)
        logger.debug('[AIChat] Model data details:', allModels.map((m) => {
          const ext = asExtendedModel(m)
          return {
            name: ext.displayName || m.name,
            category: m.category,
            isUniversal: ext.isUniversal,
            supportsImages: m.supportsImages,
            supportsVideo: m.supportsVideo,
            supportsAudio: m.supportsAudio,
            supportsStreaming: m.supportsStreaming,
            is_new: ext.is_new,
            is_top: ext.is_top
          }
        }))
      }
      
      const filteredModels = allModels
        .filter(model => {
          // 如果 tabType 未定义或为空，返回所有模?
          if (!tabType || tabType === 'undefined') return true
          
          // 判断是否为全能模型（type=0，多模态）或数字人模型（type=5?
          // ?model 对象中获?isUniversal ?isDigitalHuman，可能在 model 对象本身或其扩展属性中
          const modelExtended = asExtendedModel(model)
          const isUniversal = modelExtended.isUniversal === true
          const isDigitalHuman = modelExtended.isDigitalHuman === true
          // ?model 对象中获?category，确保存?
          const category = model.category || 'talk'
          
          if (import.meta.env.DEV) {
            logger.debug(`[AIChat] Filtering model: ${model.displayName || model.name}, category: ${category}, isUniversal: ${isUniversal}, isDigitalHuman: ${isDigitalHuman}, tabType: ${tabType}`)
          }
          
          // 根据标签页类型严格过滤模型（严格按照后端返回?type 字段分类?
          let shouldShow = false
          switch (tabType) {
            case 'image':
              // 图像标签页：只显?type=2 的图像模型（category === 'image' 且不是全能模型）
              shouldShow = category === 'image' && !isUniversal
              break
            case 'video':
              // 视频标签页：只显?type=3 的视频模型（category === 'video' 且不是全能模型）
              shouldShow = category === 'video' && !isUniversal
              break
            case 'text':
              // 文本标签页：只显?type=1 的文本模型（category === 'talk' 且不是全能模型，也不是数字人?
              shouldShow = category === 'talk' && !isUniversal && !isDigitalHuman
              break
            case 'voice':
              // 语音标签页：只显?type=4 的音频模型（category === 'audio' 且不是全能模型）
              shouldShow = category === 'audio' && !isUniversal
              break
            case 'universal':
              // 全能标签页：只显?type=0 的全能模型（多模态）
              shouldShow = isUniversal === true
              break
            case '3d':
              // 3D标签页：暂时显示空列表（如果后端?D类型，可以在这里添加判断?
              // 可以根据模型?tags 或其他字段判断是否为3D模型
              shouldShow = false
              break
            case 'digitalHuman':
              // 数字人标签页：只显示 type=5 的数字人模型
              // 通过 isDigitalHuman 标记判断（使用之前定义的 isDigitalHuman 变量?
              shouldShow = isDigitalHuman === true
              if (import.meta.env.DEV) {
                logger.debug(`[AIChat] Digital human model check: ${model.displayName || model.name}, isDigitalHuman: ${isDigitalHuman}`)
              }
              break
            default:
              // 默认返回所有模?
              shouldShow = true
          }
          
          if (import.meta.env.DEV) {
            logger.debug(`[AIChat] Model ${model.displayName || model.name} (category: ${category}, isUniversal: ${isUniversal}, isDigitalHuman: ${isDigitalHuman}) in tab ${tabType} should ${shouldShow ? 'show' : 'hide'}`)
          }
          
          return shouldShow
        })
        .map(model => {
          const modelExtended = asExtendedModel(model)
          return {
            modelCode: model.name,
            modelName: modelExtended.displayName || model.name,
            modelDesc: model.description || '',
            provider: model.provider,
            id: model.id,
            icon: modelExtended.icon || undefined, // 传递图标URL
            // 保留 category、isUniversal ?isDigitalHuman，用于过滤逻辑
            category: model.category,
            isUniversal: modelExtended.isUniversal === true,
            isDigitalHuman: modelExtended.isDigitalHuman === true,
            supportsStreaming: model.supportsStreaming,
            supportsImages: model.supportsImages,
            supportsAudio: model.supportsAudio,
            supportsVideo: model.supportsVideo,
            tags: model.tags,
            // 传?is_new ?is_top 字段（用于显示模型标识）
            is_new: modelExtended.is_new,
            is_top: modelExtended.is_top
          }
        })
      
      if (import.meta.env.DEV) {
        logger.debug('[AIChat] Filtered model list:', filteredModels)
        logger.debug('[AIChat] Model identity check:', filteredModels.map((m) => ({
          name: m.modelName,
          is_new: m.is_new,
          is_top: m.is_top,
          is_new_type: typeof m.is_new,
          is_top_type: typeof m.is_top
        })))
      }
      
      modelList.value = filteredModels
      
      if (filteredModels.length > 0) {
        selectedModel.value = filteredModels[0].modelCode
        if (import.meta.env.DEV) {
          logger.debug('[AIChat] Default model selected:', selectedModel.value)
        }
      } else {
        logger.warn('[AIChat] No matching model found, tab:', tabType)
      }
    } else {
      logger.warn('[AIChat] API response failed:', response)
      modelList.value = []
    }
  } catch (error) {
    logger.error(t('common.errors.fetchFailed'), error)
    if (import.meta.env.DEV) {
      showError(t('agentChat.errors.loadModelsFailed'))
    }
  } finally {
    loadingModels.value = false
  }
}

watch(() => activeTab.value, (newTab: string) => {
  getModelListByTab(newTab || 'image')
}, { immediate: true })

// 同步props.mode到currentMode和store（仅在props.mode变化时，且不是由内部切换触发的）
watch(() => props.mode, (newMode: 'global' | 'dialog' | 'agent' | undefined) => {
  // 如果是内部切换触发的，跳?
  if (isInternalModeChange) {
    if (import.meta.env.DEV) {
      logger.debug('[AIChat] Watch props.mode - Skipping (internal change)')
    }
    // 注意：不要在这里重置isInternalModeChange，让handleModeChange在nextTick后重?
    return
  }
  if (newMode && newMode !== currentMode.value) {
    if (import.meta.env.DEV) {
      logger.debug('[AIChat] Watch props.mode - Syncing from', currentMode.value, 'to', newMode)
    }
    currentMode.value = newMode
    chatModeStore.setMode(newMode)
    // 所有模式（global、dialog、agent）都显示对话?
    internalVisible.value = true
    isMinimized.value = false
    if (props.visible !== undefined) {
      emit('update:visible', true)
    }
    if (import.meta.env.DEV) {
      logger.debug('[AIChat] Watch props.mode - Dialog visible set')
    }
  }
}, { immediate: true })

// 同步 chatModeStore 的变化到 currentMode（仅在非受控模式下，且不是由内部切换触发的）
watch(() => chatModeStore.mode, (newMode) => {
  // 如果是内部切换触发的，跳过（让handleModeChange自己处理?
  if (isInternalModeChange) {
    if (import.meta.env.DEV) {
      logger.debug('[AIChat] Watch chatModeStore.mode - Skipping (internal change)')
    }
    return
  }
  
  // 只在非受控模式下同步，且避免重复更新
  // 如果currentMode已经是newMode，说明已经更新过了，跳过
  if (!props.mode && currentMode.value !== newMode) {
    if (import.meta.env.DEV) {
      logger.debug('[AIChat] Watch chatModeStore.mode - Syncing to:', newMode)
    }
    currentMode.value = newMode
    // 所有模式（global、dialog、agent）都显示对话?
    internalVisible.value = true
    isMinimized.value = false
    if (props.visible !== undefined) {
      emit('update:visible', true)
    }
    if (import.meta.env.DEV) {
      logger.debug('[AIChat] Watch chatModeStore.mode - Dialog visible set')
    }
  }
})

watch(() => props.defaultCollapsed, (newCollapsed) => {
  isCollapsed.value = newCollapsed
}, { immediate: true })

// 同步props.visible到内部状态（仅在props.visible变化时，且不是由内部触发的）
// 注意：所有模式（global、dialog、agent）都需要显示对话框，所以只有当props.visible明确为false时才隐藏
watch(() => props.visible, (newVisible, oldVisible) => {
  // 如果是内部切换触发的，跳?
  if (isInternalModeChange) {
    // logger.debug('[AIChat] Watch props.visible - Skipping (internal change)')
    return
  }
  
  // 如果props.visible有值且发生变化，同步到内部状?
  // 但所有模式默认都应该显示对话?
  if (newVisible !== undefined && newVisible !== oldVisible) {
    // logger.debug('[AIChat] Watch props.visible - Syncing to:', newVisible)
    internalVisible.value = newVisible
  }
}, { immediate: true })

// 监听currentMode变化，确保切换到任何模式时，对话框展开（作为最后保障）
watch(() => currentMode.value, (newMode, oldMode) => {
  // 如果是内部切换触发的，跳过（让handleModeChange自己处理?
  if (isInternalModeChange) {
    if (import.meta.env.DEV) {
      logger.debug('[AIChat] Watch currentMode - Skipping (internal change)')
    }
    return
  }
  
  if (newMode !== oldMode) {
    if (import.meta.env.DEV) {
      logger.debug('[AIChat] Watch currentMode - Mode changed from', oldMode, 'to', newMode)
      logger.debug('[AIChat] Watch currentMode - Setting dialog visible')
    }
    // 所有模式（global、dialog、agent）都显示对话?
    internalVisible.value = true
    isMinimized.value = false
    if (props.visible !== undefined) {
      emit('update:visible', true)
    }
  }
})

onMounted(() => {
  // 清理 localStorage 中过期的 blob URL（页面刷新后 blob URL 会失效）
  if (chatMessages.value && chatMessages.value.length > 0) {
    chatMessages.value.forEach((message: ChatMessage) => {
      if (message.files && message.files.length > 0) {
        message.files = message.files.map((file: { name: string; type: string; preview: string }) => {
          // 如果 preview ?blob URL，则移除它（因为已经失效?
          if (file.preview && file.preview.startsWith('blob:')) {
            logger.debug('[AIChat] Cleaning expired blob URL:', file.preview)
            // 设置为空，或者保留文件名但移除预?
            return {
              ...file,
              preview: '' // 移除过期?blob URL
            }
          }
          return file
        })
      }
    })
  }
  
  // 初始化时根据当前 activeTab 加载模型列表
  getModelListByTab(activeTab.value || 'image')
  // 确保对话框始终显示（所有模式都在对话框内）
  // 初始化时，确保isScrolledToBottom为false，这样对话框会显?
  isScrolledToBottom.value = false
  internalVisible.value = true
  isMinimized.value = false
  if (props.visible !== undefined) {
    emit('update:visible', true)
  }
  
  // 确保对话框在初始化后能显示（延迟检查，确保DOM已渲染）
  nextTick(() => {
    // 再次确保状态正确，防止初始化时的状态错?
    if (!dialogVisible.value && (currentMode.value === 'dialog' || currentMode.value === 'agent' || isHomePage.value)) {
      logger.warn('[AIChat] Dialog should be visible but is not, forcing reset')
      isScrolledToBottom.value = false
      internalVisible.value = true
      isMinimized.value = false
      if (props.visible !== undefined) {
        emit('update:visible', true)
      }
    }
    
    // 关键修复：延迟再次检查，确保DOM完全渲染后状态正?
    setTimeout(() => {
      // 如果对话框应该显示但没有显示，强制重置所有相关状?
      const shouldShow = currentMode.value === 'dialog' || currentMode.value === 'agent' || isHomePage.value
      if (shouldShow && !dialogVisible.value) {
        logger.warn('[AIChat] Delayed check: Dialog should be visible but is not, forcing reset')
        isScrolledToBottom.value = false
        internalVisible.value = true
        isMinimized.value = false
        if (props.visible !== undefined) {
          emit('update:visible', true)
        }
      }
    }, 500)
  })
  
  // 添加滚动监听
  nextTick(() => {
    if (import.meta.env.DEV) {
      logger.debug('[AIChat] Setting scroll listener, isHomePage:', isHomePage.value, 'hasMessagesContainer:', !!messagesContainerRef.value)
    }
    
    // 首页模式：监?window 滚动?resize，检测元素重?
    if (isHomePage.value) {
      if (import.meta.env.DEV) {
        logger.debug('[AIChat] Binding window scroll and resize listeners (home mode)')
      }
      window.addEventListener('scroll', handleWindowScroll, { passive: true })
      window.addEventListener('resize', handleResize, { passive: true })
      // 延迟检查，确保页面完全加载（增加延迟时间，确保DOM完全渲染?
      setTimeout(() => {
        if (import.meta.env.DEV) {
          logger.debug('[AIChat] Delayed check for element overlap')
        }
        // 在检查前，先确保isScrolledToBottom为false（默认显示对话框?
        isScrolledToBottom.value = false
        // 只在对话框可见时才检?
        if (dialogVisible.value) {
          checkOverlapWithFooter()
        }
      }, 1000) // ?00ms增加?000ms，确保页面完全加?
      // 立即检查一次（但先重置状态）
      isScrolledToBottom.value = false
      // 只在对话框可见时才检?
      nextTick(() => {
        if (dialogVisible.value) {
          checkOverlapWithFooter()
        }
      })
      // 移除持续检测的 interval，避免频繁调用导致闪?
      // 已经有滚动和resize事件监听，不需要持续检?
    } else if (!messagesContainerRef.value) {
      // 没有消息容器：监?window 滚动
      if (import.meta.env.DEV) {
        logger.debug('[AIChat] Binding window scroll listener')
      }
      window.addEventListener('scroll', handleWindowScroll, { passive: true })
      window.addEventListener('resize', handleResize, { passive: true })
      setTimeout(() => {
        checkScrollPosition()
      }, 500)
      checkScrollPosition()
    } else {
      // 非首页模式：监听消息容器滚动
      const container = messagesContainerRef.value
      if (container) {
        if (import.meta.env.DEV) {
          logger.debug('[AIChat] Binding message container scroll listener')
        }
        container.addEventListener('scroll', handleScroll, { passive: true })
        // 初始检?
        checkScrollPosition()
      }
    }
  })
  
  // 调试：检查对话框状?
  if (import.meta.env.DEV) {
    logger.debug('[AIChat Debug] onMounted:', {
      dialogVisible: dialogVisible.value,
      currentMode: currentMode.value,
      isHomePage: isHomePage.value,
      isMinimized: isMinimized.value,
      isScrolledToBottom: isScrolledToBottom.value,
      internalVisible: internalVisible.value,
      propsVisible: props.visible,
      propsMode: props.mode,
      routePath: route.path,
      routeName: 'name' in route ? (route.name as string | undefined) : undefined
    })
  }
  
  // 如果对话框应该显示但没有显示，输出警?
  if (!dialogVisible.value && (currentMode.value === 'dialog' || currentMode.value === 'agent' || isHomePage.value)) {
    logger.warn('[AIChat Warning] Dialog should be visible but is not currently, possible reasons:', {
      isScrolledToBottom: isScrolledToBottom.value,
      isHomePage: isHomePage.value,
      propsVisible: props.visible,
      internalVisible: internalVisible.value
    })
  }
})

// 音频 blob URL 转换的 AbortController
let audioFetchController: AbortController | null = null

// 统一清理：组件卸载时自动执行所有注册的清理函数
const cleanup = useCleanup()
cleanup.add(() => { audioFetchController?.abort(); audioFetchController = null })
cleanup.add(() => {
  if (import.meta.env.DEV) {
    logger.debug('[AIChat] Removing scroll listener')
  }
  window.removeEventListener('scroll', handleWindowScroll)
  window.removeEventListener('resize', handleResize)
  const container = messagesContainerRef.value
  if (container) {
    container.removeEventListener('scroll', handleScroll)
  }
})
cleanup.add(() => { if (overlapCheckAnimationFrame !== null) { cancelAnimationFrame(overlapCheckAnimationFrame); overlapCheckAnimationFrame = null } })
cleanup.add(() => { if (overlapCheckInterval !== null) { clearInterval(overlapCheckInterval); overlapCheckInterval = null } })
cleanup.add(() => { if (scrollDebounceTimer !== null) { clearTimeout(scrollDebounceTimer); scrollDebounceTimer = null } })
cleanup.add(() => { if (resizeDebounceTimer !== null) { clearTimeout(resizeDebounceTimer); resizeDebounceTimer = null } })
cleanup.add(() => { if (scrollRafId !== null) { cancelAnimationFrame(scrollRafId); scrollRafId = null } })
cleanup.add(() => { if (windowScrollRafId !== null) { cancelAnimationFrame(windowScrollRafId); windowScrollRafId = null } })
</script>

<style lang="scss" scoped>
// ============================================================================
// AI Chat 组件?CSS 变量 (--aic- 前缀)
// ============================================================================
// 说明：这些变量用于替?，通过 CSS 变量实现样式覆盖
// 使用方法：在子选择器中通过 var(--aic-xxx) 引用，无需 
// ============================================================================

.ai-chat {
  // 扁平化设计变?
  --aic-flat-filter: none;
  
  // 首页模式布局变量
  --aic-home-bottom: 60px;
  --aic-home-padding-top: 100px;
  --aic-home-max-width: 640px;
  --aic-home-height: 60vh;
  --aic-home-max-height: 600px;
  --aic-home-min-height: 400px;
  --aic-home-border-radius: var(--global-border-radius);
  --aic-home-z-index-overlay: 2000;
  --aic-home-z-index-dialog: 2001;
  
  // 头部按钮尺寸变量
  --aic-header-btn-size: 44px;
  --aic-header-btn-icon-size: 18px;
  
  // 搜索栏颜色变量
  --aic-search-bg-light: var(--el-fill-color-light);
  --aic-search-bg-light-hover: var(--el-fill-color);
  --aic-search-bg-light-focus: var(--el-bg-color);
  --aic-search-bg-dark: var(--el-fill-color-darker);
  --aic-search-bg-dark-hover: var(--el-fill-color-dark);
  --aic-search-bg-dark-focus: var(--el-fill-color);
  
  // 按钮内容对齐变量
  --aic-btn-gap: 10px;
  
  // 消息容器首页模式变量
  --aic-messages-home-bottom: 180px;
  
  // 发送按钮颜色 - 明暗模式自动适配
  // 亮色 primary=#000 → 文字=#fff；暗色 primary=#fff → 文字=#000
  --aic-send-btn-color: var(--color-on-primary);

  position: relative;

  // 所有模式下的右下角呼起按钮样式
  .chat-toggle-btn {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 44px;
    height: 44px;
    border-radius: var(--global-border-radius);
    background: transparent;
    color: var(--el-text-color-primary);
    border: var(--unified-border);
    cursor: pointer;
    z-index: var(--z-dropdown);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;

    .el-icon {
      font-size: 22px;
    }

    &:hover {
      background: transparent;
      border: var(--el-border-width-primary) solid var(--el-color-primary);
      color: var(--el-color-primary);
    }
  }

  &.mode-global {
    // 样式已在上面定义，这里可以添?mode-global 特定的样?

  // 暗色模式下的适配
  :where(html.dark) & {
    .chat-toggle-btn {
      background: transparent;
      border-color: var(--el-border-color);
      color: var(--el-text-color-primary);

      &:hover {
        background: transparent;
        border: var(--el-border-width-primary) solid var(--el-color-primary);
        color: var(--el-color-primary);
      }
    }
  }

    .ai-chat-dialog-overlay {
      position: fixed;
      inset: 0;
      background: var(--color-black-50);
      display: flex;
      align-items: stretch;
      justify-content: flex-start;
      padding: 0;
      z-index: var(--aic-home-z-index-overlay);
      filter: var(--aic-flat-filter); // 扁平化设计：移除可能?filter 效果

      // 首页时：底部固定小对话框，不显示全屏遮罩
      // 使用 CSS 变量替代 
      &.is-home {
        position: fixed;
        inset: auto 0 var(--aic-home-bottom) 0;
        height: auto;
        width: 100%;
        background: transparent;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        padding: 0;
        padding-top: var(--aic-home-padding-top); // 增加顶部内边距，为对话框上移和描边预留足够空?
        overflow: visible; // 允许对话框上移时超出容器而不被裁?
        z-index: var(--aic-home-z-index-overlay);
        pointer-events: none;
        visibility: visible;
        opacity: 1;
        filter: var(--aic-flat-filter); // 扁平化设计：移除可能?filter 效果
      }
    }

    // 暗色模式下的遮罩层适配
    :where(html.dark) & {
      .ai-chat-dialog-overlay {
        background: var(--color-black-80);

        &.is-home {
          background: transparent;
        }
      }
    }

    .ai-chat-dialog {
      width: 100%;
      height: 100%;
      max-width: 100%;
      max-height: 100%;
      background: var(--el-bg-color);
      border-radius: var(--global-border-radius);
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      min-height: 0;
      overflow: hidden;
      border: 0;
      text-rendering: optimizelegibility;

      &.is-minimized {
        height: 60px;
        max-height: 60px;
      }

      // 首页时：底部固定小对话框
      // 使用 CSS 变量替代 
      &.is-home {
        width: 100%;
        max-width: var(--aic-home-max-width);
        height: var(--aic-home-height);
        max-height: var(--aic-home-max-height);
        min-height: var(--aic-home-min-height);
        border-radius: var(--aic-home-border-radius);
        border: 0;
        margin: 0 auto;
        position: relative;
        flex: 0 0 auto;
        pointer-events: auto;
        visibility: visible;
        opacity: 1;
        display: flex;
        flex-direction: column;
        z-index: var(--aic-home-z-index-dialog);
        overflow: visible; // 允许内容超出，防止描边被裁切
      }
    }

    // 移动端动态视口高度，避免地址栏导?100vh 误差
    @supports (height: 100dvh) {
      .ai-chat-dialog {
        height: 100dvh;
        max-height: 100dvh;

        &.is-home {
          height: var(--aic-home-height);
          max-height: var(--aic-home-max-height);
        }
      }
    }

    // 暗色模式下的阴影适配
  }

  &.mode-dialog {
    .ai-chat-dialog-overlay {
      position: fixed;
      inset: 0;
      background: var(--color-black-50);
      display: flex;
      align-items: stretch;
      justify-content: flex-start;
      padding: 0;
      z-index: var(--aic-home-z-index-overlay);
      filter: var(--aic-flat-filter); // 扁平化设计：移除可能?filter 效果

      // 首页时：底部固定小对话框，不显示全屏遮罩
      // 使用 CSS 变量替代 
      &.is-home {
        position: fixed;
        inset: auto 0 var(--aic-home-bottom) 0;
        height: auto;
        width: 100%;
        background: transparent;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        padding: 0;
        padding-top: var(--aic-home-padding-top); // 增加顶部内边距，为对话框上移和描边预留足够空?
        overflow: visible; // 允许对话框上移时超出容器而不被裁?
        z-index: var(--aic-home-z-index-overlay);
        pointer-events: none;
        visibility: visible;
        opacity: 1;
        filter: var(--aic-flat-filter); // 扁平化设计：移除可能?filter 效果
      }
    }

    // 暗色模式下的遮罩层适配
    :where(html.dark) & {
      .ai-chat-dialog-overlay {
        background: var(--color-black-80);

        &.is-home {
          background: transparent;
        }
      }
    }

    .ai-chat-dialog {
      width: 100%;
      height: 100%;
      max-width: 100%;
      max-height: 100%;
      background: var(--el-bg-color);
      border-radius: var(--global-border-radius);
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      min-height: 0;
      overflow: hidden;
      border: 0;
      text-rendering: optimizelegibility;

      &.is-minimized {
        height: 60px;
        max-height: 60px;
      }

      // 首页时：底部固定小对话框
      // 使用 CSS 变量替代 
      &.is-home {
        width: 100%;
        max-width: var(--aic-home-max-width);
        height: var(--aic-home-height);
        max-height: var(--aic-home-max-height);
        min-height: var(--aic-home-min-height);
        border-radius: var(--aic-home-border-radius);
        border: 0;
        margin: 0 auto;
        position: relative;
        flex: 0 0 auto;
        pointer-events: auto;
        visibility: visible;
        opacity: 1;
        display: flex;
        flex-direction: column;
        z-index: var(--aic-home-z-index-dialog);
        overflow: visible; // 允许内容超出，防止描边被裁切
      }
    }

    // 移动端动态视口高度，避免地址栏导?100vh 误差
    @supports (height: 100dvh) {
      .ai-chat-dialog {
        height: 100dvh;
        max-height: 100dvh;

        &.is-home {
          height: var(--aic-home-height);
          max-height: var(--aic-home-max-height);
        }
      }
    }
  }

  &.mode-agent {
    .agent-chat {
      display: flex;
      flex-direction: column;
      height: 600px;
    }
  }
}

// 对话框内部元素的样式（通过Teleport传送到body，不?ai-chat作用域内?
.dialog-header {
  display: flex;
  flex-direction: column;
  padding: 18px 24px;
  border-bottom: var(--unified-border-bottom);
  background: var(--el-bg-color);
  position: relative;
  flex-shrink: 0;
  width: 100%;

  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: var(--el-border-color);
  }

  .header-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    margin-bottom: 16px;
  }

  .header-left {
    flex: 1;
    min-width: 0;

    .dialog-title {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 18px;
      font-weight: 600;
      color: var(--el-text-color-primary);

      .title-icon {
        font-size: 22px;
        color: var(--el-color-primary);
        flex-shrink: 0;
        transition: transform 0.3s ease;

        &:hover {
          transform: scale(1.1);
        }
      }

      span {
        flex: 1;
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .model-tag {
        flex-shrink: 0;
        margin-left: 8px;
        font-weight: 500;
        border-radius: var(--global-border-radius);
        padding: 4px 10px;
      }
    }
  }

  .header-right {
    display: flex;
    gap: 4px;

    // 头部按钮样式 - 使用 CSS 变量和高特异性替?
    .header-btn {
      // 使用 CSS 变量定义尺寸
      --aic-btn-size: var(--aic-header-btn-size);
      --aic-icon-size: var(--aic-header-btn-icon-size);
      
      padding: 0;
      transition: all 0.3s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: var(--aic-btn-size);
      min-height: var(--aic-btn-size);
      width: var(--aic-btn-size);
      height: var(--aic-btn-size);
      margin: 0;

      // Element Plus 内部元素覆盖 - 使用 :deep() 穿?
      :deep(.el-button__inner) {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        padding: 0;
        margin: 0;
      }

      :deep(.el-icon) {
        font-size: var(--aic-icon-size);
        width: var(--aic-icon-size);
        height: var(--aic-icon-size);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin: 0;
        padding: 0;
        flex-shrink: 0;
      }

      :deep(svg) {
        width: var(--aic-icon-size);
        height: var(--aic-icon-size);
        display: block;
        margin: 0 auto;
      }

      &:hover {
        background: var(--el-color-primary-light-9);
        color: var(--el-color-primary);
      }
    }

    .mode-switcher {
      .header-btn {
        color: var(--el-color-primary);
        
        &:hover {
          background: var(--el-color-primary-light-9);
          transform: rotate(15deg);
        }
      }
    }
  }
}

// 搜索栏样式 - 使用 CSS 变量替代 
.search-bar {
  // 定义搜索栏 CSS 变量
  --aic-search-bg: var(--aic-search-bg-light);
  --aic-search-bg-hover: var(--aic-search-bg-light-hover);
  --aic-search-bg-focus: var(--aic-search-bg-light-focus);
  
  padding: 12px 20px;
  border: none; // 移除所有边?
  border-top: none;
  border-right: none;
  border-bottom: none;
  border-left: none;
  flex-shrink: 0;
  width: 100%;

  .search-input {
    width: 100%;

    // Element Plus 输入框覆?- 使用 CSS 变量
    :deep(.el-input__wrapper) {
      background-color: var(--aic-search-bg);
      background: var(--aic-search-bg);
      
      &:hover {
        background-color: var(--aic-search-bg-hover);
        background: var(--aic-search-bg-hover);
      }
      
      &.is-focus {
        background-color: var(--aic-search-bg-focus);
        background: var(--aic-search-bg-focus);
      }
    }

    :deep(.el-input__inner) {
      background-color: transparent;
    }
  }

  .search-results-info {
    margin-top: 8px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
}

// 暗色模式适配 - 通过 CSS 变量覆盖
:where(html.dark) {
  .search-bar {
    --aic-search-bg: var(--aic-search-bg-dark);
    --aic-search-bg-hover: var(--aic-search-bg-dark-hover);
    --aic-search-bg-focus: var(--aic-search-bg-dark-focus);
  }
}

.reasoning-panel {
  padding: 20px;
  border-bottom: var(--unified-border-bottom);
  max-height: 300px;
  overflow-y: auto;
  background: var(--el-fill-color-lighter);
  position: relative;
  flex-shrink: 0;
  width: 100%;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--el-color-primary);
    opacity: 0.3;
  }

  :deep(.el-card) {
    background: var(--el-bg-color);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);

    .el-card__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: var(--unified-border-bottom);
      background: var(--el-fill-color-lighter);
      border-radius: var(--global-border-radius);
      font-weight: 600;
      font-size: 15px;
      color: var(--el-text-color-primary);

      .el-button {
        padding: 4px;
      }
    }

    .el-card__body {
      padding: 16px 20px;
    }
  }

  .reasoning-chain {
    display: flex;
    flex-direction: column;
    gap: 12px;

    .reasoning-step {
      margin-bottom: 0;
      padding: 16px;
      background: var(--el-bg-color-page);
      border-radius: var(--global-border-radius);
      border: var(--unified-border);
      transition: all 0.3s ease;
      position: relative;
      padding-left: 48px;

      &::before {
        content: attr(data-step);
        position: absolute;
        left: 16px;
        top: 16px;
        width: 24px;
        height: 24px;
        border-radius: var(--global-border-radius);
        background: var(--el-color-primary);
        color: var(--el-bg-color-page);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 600;
      }

      &:hover {
        transform: translateX(0); // 扁平化设计：移除位移
        border-color: var(--el-color-primary-light-5);
      }

      :deep(.el-tag) {
        margin-bottom: 8px;
        border-radius: var(--global-border-radius);
        font-weight: 500;
      }

      .reasoning-content {
        margin-top: 12px;
        font-size: 14px;
        line-height: 1.7;
        color: var(--el-text-color-regular);
        padding: 12px;
        background: var(--el-fill-color-lighter);
        border-radius: var(--global-border-radius);
        border-left: var(--el-border-width-primary) solid var(--el-color-primary);

        :deep(.el-progress) {
          margin-top: 12px;

          .el-progress-bar__outer {
            border-radius: var(--global-border-radius);
            background: var(--el-fill-color-light);
          }

          .el-progress-bar__inner {
            border-radius: var(--global-border-radius);
            background: var(--el-color-primary);
          }
        }
      }
    }
  }
}

// 消息容器样式 - 使用 CSS 变量替代 
.chat-messages-container {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: relative; // 确保消息容器使用相对定位，不会脱离对话框
  width: 100%; // 确保消息容器宽度正确
  box-sizing: border-box; // 确保 padding 包含在宽度内
  
  // 首页模式下，使用绝对定位显示?ai-dialog 内部
  // 通过高特异性选择器替?
  .ai-chat-dialog.is-home > .chat-dialog-content > & {
    // 定义首页模式?CSS 变量
    --aic-msg-bottom: var(--aic-messages-home-bottom);
    
    position: absolute;
    inset: 0 0 var(--aic-msg-bottom) 0; // 为输入区域预留空?
    width: 100%;
    height: auto;
    max-height: calc(100% - var(--aic-msg-bottom));
    min-height: 0;
    flex: 0 0 auto; // 不参?flex 布局
    z-index: var(--z-base); // ?ai-dialog (z-index: 0) 上方
    margin: 0;
    padding: 20px;
    box-sizing: border-box;
    transform: none;
    translate: none;
    isolation: isolate;
    visibility: visible;
    opacity: 1;
    pointer-events: auto;
    background: transparent; // 透明背景
    border-radius: var(--global-border-radius);
  }

  // 当没有消息时，不占据空间
  // 使用高特异性而非 
  &.is-empty {
    position: absolute;
    top: -9999px;
    left: -9999px;
    width: 0;
    height: 0;
    padding: 0;
    margin: 0;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
  }

  // 确保内容区域内的元素正确对齐和布局
  > * {
    width: 100%;
    flex-shrink: 0;
  }

  // 消息列表容器
  .messages-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    position: relative; /* 确保消息容器使用相对定位 */
    flex-shrink: 0; /* 防止消息容器被压? */

    .messages-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: 100%;
      position: relative; /* 确保消息列表使用相对定位 */

      .message-item {
        display: flex;
        flex-wrap: wrap; // 允许换行，让日期分隔符可以占据整?
        gap: 12px;
        width: 100%;
        position: relative; /* 确保消息项使用相对定位，不会脱离文档? */
        flex-shrink: 0; /* 防止消息项被压缩 */

        .message-avatar {
        width: 36px;
        height: 36px;
        border-radius: var(--global-border-radius);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        font-size: 18px;

        &.user-avatar {
          background: var(--el-color-primary);
          color: var(--el-bg-color-page);
        }

        &.assistant-avatar {
          background: var(--el-color-success);
          color: var(--el-bg-color-page);
        }
      }

      .message-content-wrapper {
          flex: 1;
          min-width: 0;
          position: relative; /* 确保内容包装器使用相对定? */

          .message-content {
            background: var(--el-bg-color-page);
            padding: 12px 16px;
            border-radius: var(--global-border-radius);
            position: relative;
            width: 100%; /* 确保内容宽度正确 */
            box-sizing: border-box; /* 确保 padding 包含在宽度内 */

            &.user-content {
              background: var(--el-color-primary-light-9);
            }

            &.assistant-content {
              background: var(--el-bg-color-page);
            }

            .message-text {
              font-size: 14px;
              line-height: 1.6;
              word-wrap: break-word;
            }

            .message-time {
              font-size: 12px;
              color: var(--el-text-color-secondary);
              margin-top: 8px;
            }

            .edited-badge {
              margin-left: 8px;
              font-size: 12px;
              color: var(--el-text-color-secondary);
            }

            // 消息操作按钮 - 使用 CSS 变量替代 
            .message-actions {
              display: flex;
              gap: 4px;
              margin-top: 8px;
              opacity: 0;
              transition: opacity 0.2s;

              --action-btn-color: var(--el-text-color-primary);
              --action-btn-hover-bg: var(--color-black-5);

              :where(html.dark) & {
                --action-btn-color: var(--el-text-color-regular);
                --action-btn-hover-bg: var(--color-white-10);
              }

              .action-btn {
                padding: 4px;
                font-size: 12px;
                color: var(--action-btn-color);
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;

                .el-icon {
                  color: inherit;
                }

                &:hover {
                  background-color: var(--action-btn-hover-bg);

                  --action-btn-color: var(--el-text-color-primary);
                }

                :where(html.dark) &:hover {
                  // 暗色 hover：白底（color-white-10）上需深字，用 on-primary 自适应
                  --action-btn-color: var(--color-on-primary);
                }

                &.delete-btn:hover {
                  color: var(--el-color-danger);
                }
              }
            }

            &:hover .message-actions {
              opacity: 1;
            }
          }
        }
      }
    }
  }
}

.date-separator {
  display: flex;
  justify-content: center;
  align-items: center; // 垂直居中
  margin: 12px 0;
  width: 100%;
  flex-basis: 100%; // 占据整行
  order: -1; // 优先显示在最前面
  flex-shrink: 0; // 不允许收?
  height: auto; // 高度自适应内容
  min-height: auto; // 最小高度自适应

  .date-label {
    padding: 4px 12px;
    background: var(--el-fill-color-light);
    border-radius: var(--global-border-radius);
    font-size: 12px;
    color: var(--el-text-color-secondary);
    white-space: nowrap; // 防止文字换行
    line-height: 1.5; // 设置行高，避免额外空?
  }
}

// chat-input-area 已被移除，样式合并到 ai-dialog ?
// 发送按钮样?- 使用 CSS 变量替代 
.ai-dialog {
  // 定义发送按?CSS 变量
  --aic-send-icon-size: 16px;
  
  .input-wrapper {
    display: flex;
    gap: 8px;
    align-items: flex-end;

    .chat-input {
      flex: 1;
      min-height: 40px;
      max-height: 120px;
      padding: 10px 12px;
      border: var(--unified-border);
      border-radius: var(--global-border-radius);
      resize: none;
      outline: none;
      font-size: 14px;
      line-height: 1.5;
      transition: border-color 0.2s;

      &:focus {
        border: var(--el-border-width-primary) solid var(--el-color-primary);
      }
    }

    .input-actions {
      display: flex;
      gap: 4px;
      align-items: center;

      .input-action-btn {
        padding: 8px;
      }

      // 发送按钮样?- 使用 CSS 变量
      .send-btn {
        padding: 8px 16px;
        position: relative;
        z-index: var(--z-base);
        pointer-events: auto;
        transition: all 0.3s ease;
        display: inline-flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        gap: var(--aic-btn-gap);
        vertical-align: middle;

        :deep(.el-button__inner) {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: center;
          gap: var(--aic-btn-gap);
          pointer-events: none;
          width: 100%;
          height: 100%;
        }

        :deep(.el-icon) {
          font-size: var(--aic-send-icon-size);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin: 0;
          padding: 0;
          vertical-align: middle;
        }

        span {
          font-size: 14px;
          display: inline-block;
          line-height: 1.5;
          margin: 0;
          padding: 0;
          vertical-align: middle;
        }

        &:hover:not(:disabled) {
          transform: translateY(0); // 扁平化设计：移除位移
        }

        &:active:not(:disabled) {
          transform: translateY(0);
        }

        &:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      }
    }
  }
}

// 暗色模式发送按钮 - 使用 CSS 变量替代
:where(html.dark) .ai-dialog {
  // 暗色模式下覆盖发送按钮颜色 - 与默认一致（已通过 --color-on-primary 自动适配）
  --aic-send-btn-color: var(--color-on-primary);
  
  .input-actions {
    .send-btn {
      color: var(--aic-send-btn-color);
      display: inline-flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;
      gap: var(--aic-btn-gap);
      vertical-align: middle;

      :deep(.el-button__inner) {
        color: var(--aic-send-btn-color);
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        gap: var(--aic-btn-gap);
        width: 100%;
        height: 100%;
      }

      :deep(.el-icon) {
        color: var(--aic-send-btn-color);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        margin: 0;
        padding: 0;
        vertical-align: middle;
      }

      span {
        color: var(--aic-send-btn-color);
        display: inline-block;
        margin: 0;
        padding: 0;
        vertical-align: middle;
        line-height: 1.5;
      }

      &:hover:not(:disabled) {
        background-color: var(--el-color-primary-dark-2);
        border-color: var(--el-color-primary-dark-2);
        color: var(--aic-send-btn-color);

        :deep(.el-icon) {
          color: var(--aic-send-btn-color);
        }

        span {
          color: var(--aic-send-btn-color);
        }
      }

      &:active:not(:disabled) {
        background-color: var(--el-color-primary-dark-1);
        border-color: var(--el-color-primary-dark-1);
        color: var(--aic-send-btn-color);
      }
    }
  }
}


.message-status-indicator {
  display: flex;
  align-items: center;
  gap: 4px;

  .status-icon {
    font-size: 14px;

    &.sending {
      animation: spin 1s linear infinite;
      color: var(--el-color-primary);
    }

    &.failed {
      color: var(--el-color-danger);
      cursor: pointer;
    }

    &.sent {
      color: var(--el-color-success);
    }

    &.pending {
      color: var(--el-text-color-secondary);
    }
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.quoted-message {
  padding: 8px;
  background: var(--el-fill-color-light);
  border-radius: var(--global-border-radius);
  margin-bottom: 8px;

  .quoted-message-header {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    margin-bottom: 4px;
  }

  .quoted-message-content {
    font-size: 13px;
    color: var(--el-text-color-regular);
  }
}

.message-files {
  margin-top: 8px;
  position: relative; /* 确保文件容器使用相对定位 */
  width: 100%; /* 确保文件容器宽度正确 */

  .file-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    background: var(--el-fill-color-light);
    border-radius: var(--global-border-radius);
    margin-bottom: 4px;
    position: relative; /* 确保文件项使用相对定? */
    width: 100%; /* 确保文件项宽度正? */

    .audio-player {
      display: flex;
      align-items: center;
      gap: 8px;
      position: relative; /* 确保音频播放器使用相对定? */
      width: 100%; /* 确保音频播放器宽度正? */

      .audio-element {
        width: 200px;
        max-width: 100%; /* 确保音频元素不会超出容器 */
      }

      .audio-duration {
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }
    }
  }
}

.streaming-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;

  .typing-dots {
    display: flex;
    gap: 4px;

    span {
      width: 6px;
      height: 6px;
      border-radius: var(--global-border-radius);
      background: var(--el-color-primary);
      animation: typing 1.4s infinite ease-in-out;

      &:nth-child(1) {
        animation-delay: 0s;
      }

      &:nth-child(2) {
        animation-delay: 0.2s;
      }

      &:nth-child(3) {
        animation-delay: 0.4s;
      }
    }
  }
}

@keyframes typing {
  0%, 60%, 100% {
    transform: translateY(0);
  }

  30% {
    transform: translateY(-4px);
  }
}

.model-auto-switch {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 500;
}

.model-tabs {
  margin-bottom: 12px;
}

.model-radio-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tab-empty {
  text-align: center;
  padding: 20px 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.model-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px 0;
  color: var(--el-color-primary);
  font-size: 13px;
  gap: 6px;
}

.agent-chat {
  display: flex;
  flex-direction: column;
  height: 100%;

  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    background: var(--el-bg-color);
    border-radius: var(--global-border-radius);
    margin-bottom: 16px;

    .message {
      margin-bottom: 16px;

      .message-header {
        display: flex;
        gap: 8px;
        margin-bottom: 8px;

        .message-role {
          font-weight: 600;
        }

        .message-stage {
          color: var(--el-text-color-secondary);
        }

        .message-time {
          margin-left: auto;
          font-size: 12px;
          color: var(--el-text-color-secondary);
        }
      }

      .message-content {
        padding: 12px;
        background: var(--el-bg-color-page);
        border-radius: var(--global-border-radius);
      }
    }
  }

  .chat-input {
    .input-actions {
      display: flex;
      gap: 8px;
      margin-top: 8px;
    }
  }
}

// Agent模式在dialog中的样式
.agent-messages-list {
  padding: 0;
  max-height: 100%;
  overflow-y: visible;
  scroll-behavior: smooth;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;

  .agent-message-item {
    margin-bottom: 0;
    padding: 16px;
    border-radius: var(--global-border-radius);
    background: var(--el-bg-color-page);
    border: var(--unified-border);
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;

    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 3px;
      background: var(--el-color-primary);
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    &:hover {
      transform: translateY(0); // 扁平化设计：移除位移
      border-color: var(--el-border-color);

      &::before {
        opacity: 1;
      }
    }

    &.user {
      background: var(--el-color-primary-light-8);
      border-color: var(--el-color-primary-light-7);
      margin-left: 40px;

      &::before {
        background: var(--el-color-primary);
        opacity: 1;
      }

      .agent-message-role {
        color: var(--el-color-primary);
      }
    }

    &.assistant {
      background: var(--el-bg-color-page);
      margin-right: 40px;
      border-left: 3px solid var(--el-color-success);

      &::before {
        background: var(--el-color-success);
        opacity: 1;
      }

      .agent-message-role {
        color: var(--el-color-success);
      }
    }

    &.reasoning {
      border-left-color: var(--el-color-warning);
      
      &::before {
        background: var(--el-color-warning);
      }
    }

    &.acting {
      border-left-color: var(--el-color-info);
      
      &::before {
        background: var(--el-color-info);
      }
    }

    &.result {
      border-left-color: var(--el-color-success);
      
      &::before {
        background: var(--el-color-success);
      }
    }

    .agent-message-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
      font-size: 13px;
      padding-bottom: 8px;
      border-bottom: var(--unified-border-bottom);

      .agent-message-role {
        font-weight: 600;
        font-size: 14px;
        display: inline-flex;
        align-items: center;
        gap: 6px;

        &::before {
          content: '';
          width: 8px;
          height: 8px;
          border-radius: var(--global-border-radius);
          background: currentcolor;
          display: inline-block;
        }
      }

      .agent-message-stage {
        padding: 4px 10px;
        background: var(--el-fill-color-light);
        border-radius: var(--global-border-radius);
        font-size: 12px;
        font-weight: 500;
        color: var(--el-text-color-regular);
        border: var(--unified-border);
      }

      .agent-message-time {
        margin-left: auto;
        font-size: 12px;
        color: var(--el-text-color-placeholder);
      }
    }

    .agent-message-content {
      .agent-text-content {
        font-size: 15px;
        line-height: 1.8;
        color: var(--el-text-color-primary);
        word-wrap: break-word;
        white-space: pre-wrap;
      }

      .agent-action-content,
      .agent-mcp-content {
        margin-top: 12px;
        padding: 12px;
        background: var(--el-fill-color-lighter);
        border-radius: var(--global-border-radius);
        border: var(--unified-border);

        :deep(.el-card) {
          background: transparent;
          border: none;
          box-shadow: none;
        }
      }
    }
  }
}

.agent-input-wrapper {
  padding: 20px;
  border-top: var(--unified-border);
  background: var(--el-bg-color);
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: var(--el-border-color);
  }

  .agent-textarea {
    margin-bottom: 16px;

    :deep(.el-textarea__inner) {
      border-radius: var(--global-border-radius);
      border: var(--unified-border);
      padding: 12px 16px;
      font-size: 14px;
      line-height: 1.6;
      transition: all 0.3s ease;
      resize: none;

      &:focus {
        border: var(--el-border-width-primary) solid var(--el-color-primary);
        }

      &::placeholder {
        color: var(--el-link-color-placeholder);
      }
    }
  }

  .agent-input-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    align-items: center;

    :deep(.el-button) {
      border-radius: var(--global-border-radius);
      padding: 10px 20px;
      font-weight: 500;
      transition: all 0.3s ease;

      &:hover {
        transform: translateY(0); // 扁平化设计：移除位移
      }

      &.el-button--primary {
        background: var(--el-color-primary);
        border: none;

        &:hover {
          background: var(--el-color-primary-dark-2);
        }
      }
    }
  }
}


.dialog-fade-enter-active {
  transition: opacity 0.2s ease-out;
  
  .ai-chat-dialog {
    transition: opacity 0.2s ease-out, transform 0.2s ease-out;
  }
}

.dialog-fade-leave-active {
  transition: opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  
  .ai-chat-dialog {
    transition: opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1), 
                transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  }
}

.dialog-fade-enter-from {
  opacity: 0;
  
  .ai-chat-dialog {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
}

.dialog-fade-enter-to {
  .ai-chat-dialog {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.dialog-fade-leave-from {
  opacity: 1;
  
  .ai-chat-dialog {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.dialog-fade-leave-to {
  opacity: 0;
  
  .ai-chat-dialog {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  
  // 首页模式下，对话框向下消?
  .ai-chat-dialog.is-home {
    transform: translateY(30px) scale(0.96);
  }
}

// 首页模式的特殊动画处?
.ai-chat-dialog-overlay.is-home {
  &.dialog-fade-leave-active {
    .ai-chat-dialog {
      transition: opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1), 
                  transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    }
  }
  
  &.dialog-fade-leave-to .ai-chat-dialog {
    transform: translateY(30px) scale(0.96);
  }
}

.message-fade-enter-active,
.message-fade-leave-active {
  transition: all 0.3s ease;
}

.message-fade-enter-from,
.message-fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>

<!-- 全局样式：用?Teleport ?body 的对话框 -->
<style lang="scss">
// ============================================================================
// 全局 Teleport 样式?CSS 变量定义
// ============================================================================
// 说明：Teleport 内容脱离组件 DOM 树，需要全局样式
// 为减? 使用，通过 :root 定义变量和高特异性选择?
// ============================================================================
:root {
  // 首页模式全局变量
  --aic-global-home-bottom: 60px;
  --aic-global-home-padding-top: 100px;
  --aic-global-home-max-width: 640px;
  --aic-global-home-height: 70vh;
  --aic-global-home-max-height: 700px;
  --aic-global-home-min-height: 500px;
  --aic-global-home-border-radius: var(--global-border-radius);
  --aic-global-home-z-index-overlay: 2000;
  --aic-global-home-z-index-dialog: 2001;
  --aic-global-flat-shadow: none;
  --aic-global-flat-filter: none;
  --aic-global-messages-bottom: 180px;
  --aic-global-input-min-height: 106px;
}

// 首页样式：全局应用，确保通过 Teleport 传送的内容也能应用样式
// 使用高特异性选择?body .class 替代部分 
body .ai-chat-dialog-overlay.is-home,
.ai-chat-dialog-overlay.is-home {
  position: fixed;
  inset: auto 0 var(--aic-global-home-bottom) 0;
  height: auto;
  width: 100%;
  background: transparent;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0;
  padding-top: var(--aic-global-home-padding-top); // 增加顶部内边距，为对话框上移和描边预留足够空?
  overflow: visible; // 允许对话框上移时超出容器而不被裁?
  z-index: var(--aic-global-home-z-index-overlay);
  pointer-events: none;
  visibility: visible;
  opacity: 1;
  box-shadow: var(--aic-global-flat-shadow);
  filter: var(--aic-global-flat-filter);
  
  // 首页模式下的关闭动画
  &.dialog-fade-leave-active {
    .ai-chat-dialog {
      transition: opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1), 
                  transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    }
  }
  
  &.dialog-fade-leave-to .ai-chat-dialog {
    transform: translateY(30px) scale(0.96);
    opacity: 0;
  }
}

// 暗色模式 - 使用高特异?
:where(html.dark) :where(body) .ai-chat-dialog-overlay.is-home,
:where(html.dark) .ai-chat-dialog-overlay.is-home {
  background: transparent;
  overflow: visible; // 确保暗色模式下也不被裁切
  box-shadow: var(--aic-global-flat-shadow); // 扁平化设计：确保无投?
  filter: var(--aic-global-flat-filter); // 扁平化设计：移除可能?filter 效果
}

// 首页对话框样?- 使用 CSS 变量和高特异性选择?
body .ai-chat-dialog.is-home,
.ai-chat-dialog.is-home {
  width: 100%;
  max-width: var(--aic-global-home-max-width);
  height: var(--aic-global-home-height); // 增加高度?60vh ?70vh
  max-height: var(--aic-global-home-max-height); // 增加最大高度从 600px ?700px
  min-height: var(--aic-global-home-min-height); // 增加最小高度从 400px ?500px
  border-radius: var(--aic-global-home-border-radius);
  box-shadow: var(--aic-global-flat-shadow); // 扁平化设计：移除所有投?
  border: 0;
  margin: 0 auto;
  position: relative;
  flex: 0 0 auto;
  pointer-events: auto;
  visibility: visible;
  opacity: 1;
  display: flex;
  flex-direction: column;
  z-index: var(--aic-global-home-z-index-dialog);
  overflow: hidden; // 改为 hidden，确保内容不会溢?

  // chat-dialog-content 容器已包含所有内容和样式

  // 当没有消息时，减小最小高?
  &.has-no-messages {
    min-height: auto;
    height: auto;
    max-height: none;
    flex: 0 0 auto;
  }

  // chat-input-area 已被移除，样式合并到 ai-dialog ?

  // 统一的消息对话页容器：使?flexbox 布局，让消息容器显示?ai-dialog 内部
  > .chat-dialog-content {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    position: relative; // 作为绝对定位的参考点
    
    // AIDialog 组件：作为主容器，占据全部空?
    > .ai-dialog {
      flex: 1 1 auto; // 占据所有可用空?
      min-height: 0;
      width: 100%;
      height: 100%; // 占据父容器的全部高度
      max-height: 100%;
      position: relative; // 作为内部绝对定位的参考点
      overflow: hidden; // 隐藏溢出
      display: flex;
      flex-direction: column;
      background: var(--el-bg-color); // 设置背景?
      border-radius: var(--aic-global-home-border-radius); // 圆角
      z-index: var(--z-0); // 作为背景?
      
      // 消息容器通过下方的通用规则处理（因为它在模板中?ai-dialog 的兄弟元素，但顺序在 ai-dialog 之前?
      
      // input-wrapper 固定在底?
      > .input-wrapper {
        flex: 0 0 auto; // 不占据额外空间，根据内容决定高度
        height: auto; // 根据内容自动调整高度
        min-height: var(--aic-global-input-min-height); // 保持最小高?
        max-height: none; // 不限制最大高度，允许完整显示所有内?
        flex-shrink: 0; // 不允许收?
        display: flex;
        flex-direction: column;
        position: relative;
        z-index: calc(var(--z-base) + 1); // 在消息容器上?
        margin-top: auto; // 推到底部
        background: var(--el-bg-color); // 设置背景
        border-radius: var(--global-border-radius); // 底部圆角
      }
    }
    
    // 消息容器：当它是 ai-dialog 的兄弟元素时（默认情况）
    > .chat-messages-container {
      position: absolute; // 绝对定位，相对于 chat-dialog-content
      inset: 0 0 var(--aic-global-messages-bottom) 0; // 为输入区域预留空间（input-wrapper 高度?159px + padding?
      width: 100%;
      height: auto;
      max-height: calc(100% - var(--aic-global-messages-bottom)); // 为输入区域预留空?
      min-height: 0;
      overflow: hidden auto; // 允许垂直滚动
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin: 0;
      padding: 20px;
      box-sizing: border-box;
      z-index: var(--z-base); // ?ai-dialog (z-index: 0) 上方
      background: transparent; // 透明背景，让它看起来?ai-dialog 的一部分
      border-radius: var(--global-border-radius);
      pointer-events: auto;
      
      &.is-empty {
        display: none;
      }
    }
  }

  > .search-bar {
    position: relative;
    width: 100%;
    flex-shrink: 0;
    order: 1.5;
  }

  > .reasoning-panel {
    position: relative;
    width: 100%;
    flex-shrink: 0;
    order: 1.7;
  }

  // chat-dialog-content 容器内的样式在下面单独定?
  
  // ai-dialog 现在?chat-dialog-content 内部，样式在 chat-dialog-content 中定?
}

// 对话历史抽屉样式
.history-drawer-overlay {
  position: fixed;
  inset: 0;
  background: var(--color-black-50);
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  animation: drawer-fade-in 0.3s ease;
}

.history-drawer {
  width: 400px;
  max-width: 90vw;
  height: 100%;
  background: var(--el-bg-color);
  display: flex;
  flex-direction: column;
  transform: translateX(100%);
  transition: transform 0.3s ease;
  
  &.is-visible {
    transform: translateX(0);
  }
}

.history-drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: var(--unified-border-bottom);
  
  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 500;
    color: var(--el-text-color-primary);
  }
}

.history-filter {
  padding: 16px 20px;
  border-bottom: var(--unified-border-bottom);
}

.history-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px 0;
}

.history-group {
  margin-bottom: 24px;
  
  &:last-child {
    margin-bottom: 0;
  }
}

.history-group-title {
  padding: 8px 20px;
  font-size: 12px;
  font-weight: 500;
  color: var(--el-text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  cursor: pointer;
  transition: background-color 0.2s;
  position: relative;
  
  &:hover {
    background: var(--el-fill-color-light);
  }
  
  &.active {
    background: var(--el-color-primary-light-9);
    border-left: var(--el-border-width-primary) solid var(--el-color-primary);
  }
}

.history-item-content {
  flex: 1;
  min-width: 0;
  margin-right: 8px;
}

.history-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.history-time {
  color: var(--el-text-color-placeholder);
}

.history-count {
  color: var(--el-text-color-secondary);
}

.new-chat-btn {
  padding: 16px 20px;
  border-top: var(--unified-border);
}

@keyframes drawer-fade-in {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

.drawer-fade-enter-active,
.drawer-fade-leave-active {
  transition: opacity 0.3s ease;
  
  .history-drawer {
    transition: transform 0.3s ease;
  }
}

.drawer-fade-enter-from,
.drawer-fade-leave-to {
  opacity: 0;
  
  .history-drawer {
    transform: translateX(100%);
  }
}

/* 全局扁平化设计规则：确保所有对话框容器完全无投? */

/* 使用 CSS 变量和高特异性选择? */
.ai-chat-dialog-overlay,
.ai-chat-dialog-overlay.is-home,
.ai-chat-dialog,
.ai-chat-dialog.is-home,
.ai-chat-dialog-overlay .ai-chat-dialog,
.ai-chat-dialog-overlay.is-home .ai-chat-dialog.is-home {
  box-shadow: var(--aic-global-flat-shadow, none);
  filter: var(--aic-global-flat-filter, none);
}

/* 全局规则：确保首页模式下 input-wrapper 正确定位 */

/* 使用 :where() 与单类，使用 CSS 变量控制 */
body .ai-chat-dialog.is-home .input-wrapper,
body .ai-chat-dialog.is-home .ai-dialog .input-wrapper,
.ai-chat-dialog.is-home .input-wrapper,
.ai-chat-dialog.is-home .ai-dialog .input-wrapper {
  position: relative;
  inset: auto;
  transform: translateY(0);
  margin: 0;
}

/* 首页模式下的特殊处理：确?chat-dialog-content 正确显示，消息容器在 ai-dialog 内部 */

/* 使用 :where() 与单类，使用 CSS 变量控制 */
body .ai-chat-dialog.is-home,
:where(html) :where(body) :where(.ai-chat-dialog.is-home) {
  position: relative;
  overflow: hidden;
  
  > :where(.chat-dialog-content) {
    height: 100%;
    max-height: 100%;
    min-height: 0;
    position: relative; // 作为绝对定位的参考点
    
    // ai-dialog 作为主容器，占据全部空间
    > .ai-dialog {
      flex: 1 1 auto;
      height: 100%;
      min-height: 0;
      max-height: 100%;
      position: relative;
      overflow: hidden;
      
      // input-wrapper 固定在底部，根据内容自动调整高度
      > .input-wrapper {
        flex: 0 0 auto;
        height: auto;
        min-height: var(--aic-global-input-min-height);
        max-height: none;
        flex-shrink: 0;
        margin-top: auto; // 推到底部
        position: relative;
        z-index: calc(var(--z-base) + 1);
      }
    }
    
    // 消息容器绝对定位?ai-dialog 内部上方
    > .chat-messages-container {
      position: absolute;
      inset: 0 0 var(--aic-global-messages-bottom) 0; // 为输入区域预留空间（input-wrapper 高度?159px + padding?
      width: 100%;
      height: auto;
      max-height: calc(100% - var(--aic-global-messages-bottom));
      min-height: 0;
      overflow: hidden auto;
      z-index: var(--z-base); // ?ai-dialog (z-index: 0) 上方
      background: transparent;
      border-radius: var(--global-border-radius);
      pointer-events: auto;
    }
  }
}

/* 确保首页模式?input-wrapper 显示?ai-dialog 内部底部（chat-input-area 已被移除? */

/* 使用高特异性选择? */
body .ai-chat-dialog.is-home > .ai-dialog > .input-wrapper,
.ai-chat-dialog.is-home > .ai-dialog > .input-wrapper {
  position: absolute;
  inset: auto 0 0;
  width: 100%;
  z-index: calc(var(--z-base) + 1);
  background: var(--el-bg-color);
  padding: 0 20px 20px;
  box-sizing: border-box;
  border-radius: var(--global-border-radius);
}

/* 伪元素扁平化设计规则 */
.ai-chat-dialog-overlay::before,
.ai-chat-dialog-overlay::after,
.ai-chat-dialog::before,
.ai-chat-dialog::after,
.ai-chat-dialog.is-home::before,
.ai-chat-dialog.is-home::after {
  box-shadow: var(--aic-global-flat-shadow, none);
  filter: var(--aic-global-flat-filter, none);
}
</style>
