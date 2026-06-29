<template>
  <div class="ai-assistant-page">
    <div class="page-header">
      <el-button class="back-btn" @click="handleBack">
        <el-icon>
          <ArrowLeft />
        </el-icon>
      </el-button>
      <h1 class="page-title">{{ pageTitle }}</h1>
    </div>

    <div class="tishi-block" @click="tishiHandle">
      <el-icon>
        <InfoFilled v-if="!tishiShow" />
        <Close v-else />
      </el-icon>
      <span class="tishi-text">{{
        tishiShow ? t('aiAssistant.close') : t('aiAssistant.viewGuide')
        }}</span>
    </div>

    <div v-show="tishiShow" class="intelligent-assistant">
      <div class="guide-content">
        <h3>{{ t('aiAssistant.guideTitle') }}</h3>
        <ul>
          <li v-for="(item, index) in guideItems" :key="index">{{ item }}</li>
        </ul>
      </div>
    </div>

    <div v-if="tishiShow && tishiContent" class="tishi-box">
      <div class="tishi-box-content">
        <div class="tishi-title">
          <el-icon>
            <Warning />
          </el-icon>
          <span>{{ t('aiAssistant.inputTips') }}</span>
        </div>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="tishi-content" v-html="sanitizeHtml(tishiContent)"></div>
      </div>
    </div>

    <div class="chat-container" ref="chatContainer">
      <div v-if="questionList.length === 0" class="welcome-message">
        <div class="welcome-avatar">
          <img :src="botAvatar" alt="Bot" loading="lazy" />
        </div>
        <div class="welcome-text">{{ t('aiAssistant.welcome') }}</div>
      </div>

      <div v-for="(item, index) in questionList" :key="index" class="message-group">
        <div v-if="item.imgsList && item.imgsList.length > 0" class="question-images">
          <img v-for="(img, imgIndex) in item.imgsList" :key="imgIndex" :src="img.imgUrl" alt="Question Image"
            class="question-image" loading="lazy" />
        </div>

        <div class="question-container">
          <div class="question-actions">
            <el-button size="small" @click="copyToInput(item.question)">
              <el-icon>
                <CopyDocument />
              </el-icon>
              {{ t('aiAssistant.copy') }}
            </el-button>
          </div>
          <div class="question-text">{{ item.question }}</div>
        </div>

        <div v-if="agentContentList[index]" class="answer-container">
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div class="answer-content" v-html="formatContent(agentContentList[index].content)"></div>

          <div v-if="
            agentContentList[index].imgUrlList && agentContentList[index].imgUrlList.length > 0
          " class="answer-images">
            <el-image v-for="(img, imgIndex) in agentContentList[index].imgUrlList" :key="imgIndex" :src="img"
              :preview-src-list="agentContentList[index].imgUrlList" fit="cover" class="answer-image" />
          </div>

          <div v-if="
            agentContentList[index].videoUrlList &&
            agentContentList[index].videoUrlList.length > 0
          " class="answer-videos">
            <video v-for="(video, videoIndex) in agentContentList[index].videoUrlList" :key="'video-' + videoIndex"
              :src="video" controls preload="none" class="answer-video" />
          </div>

          <div class="answer-meta">
            <span class="token-consumption">
              {{ t('aiAssistant.generated') }}
              <span v-if="agentContentList[index].total_tokens !== undefined">
                {{
                  t('aiAssistant.tokensConsumed', {
                    count: formatTokens(agentContentList[index].total_tokens),
                  })
                }}
              </span>
            </span>
          </div>

          <div class="answer-actions">
            <el-button size="small" @click="toggleAnswerVisibility(index)">
              <el-icon>
                <View v-if="!answerVisibilityStates[index]" />
                <Hide v-else />
              </el-icon>
            </el-button>
            <el-button size="small" @click="copyContent(agentContentList[index].copyContent)">
              <el-icon>
                <CopyDocument />
              </el-icon>
            </el-button>
            <el-button size="small" @click="downloadImages(index)">
              <el-icon>
                <Download />
              </el-icon>
            </el-button>
            <el-button size="small" @click="shareMessage(index)">
              <el-icon>
                <Share />
              </el-icon>
            </el-button>
          </div>
        </div>
      </div>

      <div v-if="loading" class="loading-message">
        <el-icon class="is-loading">
          <Loading />
        </el-icon>
        <span>{{ t('aiAssistant.generating') }}</span>
      </div>
    </div>

    <div class="quick-actions" v-if="suggestedQuestionsList.length > 0 && questionList.length === 0">
      <div class="quick-actions-scroll">
        <div v-for="(question, index) in suggestedQuestionsList" :key="index" class="quick-action-btn"
          @click="handleQuickActionClick(question)">
          {{ question }}
        </div>
      </div>
    </div>

    <div class="chat-messages" v-if="chatRoomMode">
      <div
        v-for="item in chatList"
        :key="item.id"
        class="message-item"
        :class="item.type"
      >
        <!-- AI/Seller 消息（左侧） -->
        <template v-if="item.type === 'seller'">
          <div class="avatar seller-avatar">
            <img :src="item.avatar || botAvatar" alt="Bot" loading="lazy" />
          </div>
          <div class="message-bubble seller-bubble" :class="{
            'media-message': item.mediaType
          }">
            <img v-if="item.mediaType === 'image'" :src="item.mediaUrl || item.content" alt="消息图片" class="message-image" @click="previewImage(item.mediaUrl || item.content)" loading="lazy" />
            <video v-else-if="item.mediaType === 'video'" :src="item.mediaUrl || item.content" class="message-video" controls preload="none" />
            <div v-else-if="item.mediaType === 'audio'" class="message-audio">
              <span class="audio-text">🎵 Audio</span>
              <a class="audio-url" :href="item.mediaUrl || item.content" target="_blank">Play</a>
            </div>
            <div v-else-if="item.mediaType === 'file'" class="message-file">
              <span class="file-text">📄 File</span>
              <a class="file-url" :href="item.mediaUrl || item.content" target="_blank">View</a>
            </div>
            <!-- eslint-disable-next-line vue/no-v-html -->
            <div v-else class="bubble-text" v-html="formatContent(item.content)"></div>
          </div>
        </template>

        <!-- User 消息（右侧） -->
        <template v-else-if="item.type === 'user'">
          <div class="message-bubble user-bubble" :class="{
            'media-message': item.mediaType
          }">
            <img v-if="item.mediaType === 'image'" :src="item.mediaUrl || item.content" alt="消息图片" class="message-image" @click="previewImage(item.mediaUrl || item.content)" loading="lazy" />
            <video v-else-if="item.mediaType === 'video'" :src="item.mediaUrl || item.content" class="message-video" controls preload="none" />
            <div v-else-if="item.mediaType === 'audio'" class="message-audio">
              <span class="audio-text">🎵 Audio</span>
              <a class="audio-url" :href="item.mediaUrl || item.content" target="_blank">Play</a>
            </div>
            <div v-else-if="item.mediaType === 'file'" class="message-file">
              <span class="file-text">📄 File</span>
              <a class="file-url" :href="item.mediaUrl || item.content" target="_blank">View</a>
            </div>
            <div v-else class="bubble-text">{{ item.content }}</div>
            <div class="read-status" v-if="item.read">✓✓ Read</div>
          </div>
          <div class="avatar user-avatar">
            <img :src="item.avatar || userAvatar" alt="User" loading="lazy" />
          </div>
        </template>

        <!-- System 消息（居中） -->
        <template v-else-if="item.type === 'system'">
          <div class="system-message">
            <span>{{ item.content }}</span>
          </div>
        </template>
      </div>
    </div>

    <div class="input-section" :class="{ 'chat-room-input': chatRoomMode }">
      <!-- 底部操作栏 (Feature 11) -->
      <div class="bottom-action-bar" v-if="chatRoomMode">
        <div class="action-bar-items">
          <el-tooltip content="Voice Input" placement="top">
            <el-button size="small" circle @click="toggleVoiceInput">
              <el-icon><Microphone /></el-icon>
            </el-button>
          </el-tooltip>
          <el-tooltip content="Upload Image" placement="top">
            <el-button size="small" circle @click="handleImageUpload">
              <el-icon><Picture /></el-icon>
            </el-button>
          </el-tooltip>
          <el-tooltip content="Upload Video" placement="top">
            <el-button size="small" circle @click="handleVideoUpload">
              <el-icon><VideoCamera /></el-icon>
            </el-button>
          </el-tooltip>
          <el-tooltip content="Upload File" placement="top">
            <el-button size="small" circle @click="handleFileUpload">
              <el-icon><Document /></el-icon>
            </el-button>
          </el-tooltip>

          <!-- 超级智能体开关 (Feature 12) -->
          <el-tooltip content="Super Agent" placement="top">
            <el-button size="small" circle :type="superAgentEnabled ? 'success' : 'default'" @click="toggleSuperAgent">
              <el-icon><MagicStick /></el-icon>
            </el-button>
          </el-tooltip>

          <!-- MCP 开关 (Feature 13) -->
          <el-tooltip content="MCP Tools" placement="top">
            <el-button size="small" circle :type="mcpEnabled ? 'success' : 'default'" @click="toggleMCP">
              <el-icon><Connection /></el-icon>
            </el-button>
          </el-tooltip>

          <!-- 知识库开关 (Feature 14) -->
          <el-tooltip content="Knowledge Base" placement="top">
            <el-button size="small" circle :type="knowledgeBaseEnabled ? 'success' : 'default'" @click="toggleKnowledgeBase">
              <el-icon><Collection /></el-icon>
            </el-button>
          </el-tooltip>

          <!-- 永久记忆开关 (Feature 15) -->
          <el-tooltip content="Permanent Memory" placement="top">
            <el-button size="small" circle :type="permanentMemoryEnabled ? 'success' : 'default'" @click="togglePermanentMemory">
              <el-icon><Cpu /></el-icon>
            </el-button>
          </el-tooltip>
        </div>
      </div>

      <div class="model-selector" v-if="!chatRoomMode">
        <el-select v-model="selectedModel" placeholder="Select Model" size="small">
          <el-option v-for="model in modelList" :key="model.name" :label="model.name" :value="model.name">
            <div class="model-option-content">
              <span>{{ model.name }}</span>
              <el-tooltip content="API Access" placement="top">
                <button type="button" class="model-api-btn" @click.stop="handleModelApiClick(model.name)">
                  <span class="model-api-btn__icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M5 6l6 6-6 6M13 5l2 14M19 6l-6 6 6 6" />
                    </svg>
                  </span>
                  <span class="model-api-btn__text">API</span>
                </button>
              </el-tooltip>
            </div>
          </el-option>
        </el-select>
        <el-tooltip v-if="selectedModel" content="View Model API" placement="top">
          <button type="button" class="current-model-api-btn" aria-label="API" @click="handleCurrentModelApiClick">
            <span class="model-api-btn__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 6l6 6-6 6M13 5l2 14M19 6l-6 6 6 6" />
              </svg>
            </span>
            <span class="model-api-btn__text">API</span>
          </button>
        </el-tooltip>
      </div>

      <div class="agent-selector" v-if="!chatRoomMode">
        <el-select v-model="selectedAgent" placeholder="Select Agent" size="small">
          <el-option v-for="agent in agentList" :key="agent.botId" :label="agent.agentName ?? agent.name" :value="agent.botId" />
        </el-select>
      </div>

      <div class="input-wrapper">
        <el-input v-model="prompt" type="textarea" :rows="inputFocused ? 4 : 1"
          :placeholder="chatRoomMode ? 'Type a message...' : t('aiAssistant.placeholder')" @focus="inputFocused = true" @blur="inputFocused = false"
          @keydown.enter.ctrl="handleSendMessage" class="message-input" />

        <div class="input-actions">
          <el-button size="small" @click="handleImageUpload">
            <el-icon>
              <Picture />
            </el-icon>
          </el-button>
          <VoiceInput @transcript="handleVoiceTranscript" @error="handleVoiceError" :language="locale" />
          <el-button type="primary" size="small" @click="handleSendMessage" :loading="loading"
            :disabled="!prompt.trim()">
            <el-icon>
              <Promotion />
            </el-icon>
            {{ t('aiAssistant.send') }}
          </el-button>
        </div>
      </div>
    </div>

    <el-dialog v-model="showImageUpload" :title="t('aiAssistant.uploadImage')" width="600px">
      <FileUpload @upload-success="handleFileUploadSuccess" @upload-error="handleFileUploadError" />
      <template #footer>
        <el-button @click="showImageUpload = false">{{ t('common.cancel') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, computed } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import DOMPurify from 'dompurify'
import {
  ArrowLeft,
  InfoFilled,
  Close,
  Warning,
  CopyDocument,
  View,
  Hide,
  Download,
  Share,
  Loading,
  Picture,
  Promotion,
  Microphone,
  VideoCamera,
  Document,
  MagicStick,
  Connection,
  Collection,
  Cpu,
} from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { useChat } from '@aizhs/shared-logic'
import FileUpload from '@/components/ai/FileUpload.vue'
import VoiceInput from '@/components/ai/VoiceInput.vue'
import type { FileInfo } from '@/api/services/file.service'
import { logger } from '@/utils/logger'
import { StorageManager, STORAGE_KEYS } from '@/utils/storage'
import { sendMessage as sendCozeMessage } from '@/api/chat'
import { getAgentsList, type Agent } from '@/api/agents'
import { useApiError } from '@/composables/useApiError'
import { getRoomHistory, markRoomAsRead, type ChatRoomMessage, type ChatRoomHistoryData } from '@/api/chatRoom'
import type { ApiResponse } from '@/types'
import { websocketService, type WebSocketStatus } from '@/utils/websocket'

// =============================================
// 类型定义
// =============================================
interface Question {
  question: string
  imgsList: { imgUrl: string }[]
}

interface AgentContent {
  content: string
  imgUrlList: string[]
  videoUrlList: string[]
  total_tokens: number
  copyContent: string
}

interface ChatMessage {
  id: string | number
  type: 'user' | 'seller' | 'system'
  content: string
  sendTime: string
  source: string
  userUuid: string
  receiverUuid: string
  messageType: number
  read: boolean
  avatar: string
  senderName: string
  senderAvatar: string
  isTemp?: boolean
  mediaType?: 'image' | 'audio' | 'video' | 'file' | null
  mediaUrl?: string | null
}

// =============================================
// 路由 & 国际化 & Store
// =============================================
const router = useRouter()
const route = useRoute()
const { t, locale } = useI18n()
const _authStore = useAuthStore()

// shared-logic useChat: cross-platform WebSocket chat primitives
const sharedChat = useChat()

// 统一清理：组件卸载时自动执行所有注册的清理函数
const cleanup = useCleanup()
// 滚动到底部的延时定时器
let scrollBottomTimer: ReturnType<typeof setTimeout> | null = null

// =============================================
// 基础状态
// =============================================
const pageTitle = ref(t('aiAssistant.title'))
const tishiShow = ref(true)
const tishiContent = ref('')
const prompt = ref('')
const { loading, execute: executeApi } = useApiError({ showMessage: true })
const inputFocused = ref(false)
const showImageUpload = ref(false)
const uploadedFiles = ref<FileInfo[]>([])

// =============================================
// 模型 & Agent
// =============================================
const modelList = ref([{ name: 'GLM-4.5' }, { name: 'DOUBAO-SEED-1.6' }])
const agentList = ref<Agent[]>([])
const selectedModel = ref('GLM-4.5')
const selectedAgent = ref('')

// =============================================
// 聊天模式: Coze AI 模式 vs 聊天房间模式
// =============================================
const chatRoomMode = computed(() => !!route.query.roomId)
const roomId = computed(() => (route.query.roomId as string) || '')
const chatTitle = computed(() => (route.query.room_name as string) || 'AI Assistant')
const receiverUuid = computed(() => (route.query.receiver_uuid as string) || '')

// =============================================
// 聊天房间状态 (Feature 1-5: WebSocket, 房间, 已读, 去重, 历史)
// =============================================
const chatList = ref<ChatMessage[]>([])
const wsConnected = ref(false)
const userUuid = ref('')
const userAvatar = ref('')
const botAvatar = '/images/bot-avatar.png'

// 消息去重相关 (Feature 4)
const lastHistoryMessageId = ref<string | number | null>(null)
const lastHistoryMessageContent = ref<string | null>(null)
const lastHistoryMessageTime = ref<string | null>(null)
const lastHistoryMessageUserUuid = ref<string | null>(null)

// =============================================
// 输入区域开关状态 (Feature 12-15)
// =============================================
const superAgentEnabled = ref(false)
const mcpEnabled = ref(false)
const knowledgeBaseEnabled = ref(false)
const permanentMemoryEnabled = ref(false)

// =============================================
// Coze AI 模式状态
// =============================================
const questionList = ref<Question[]>([])
const agentContentList = ref<AgentContent[]>([])
const answerVisibilityStates = ref<Record<number, boolean>>({})

const chatContainer = ref<HTMLElement | null>(null)

// =============================================
// API 入口方法
// =============================================
const handleModelApiClick = (modelName: string) => {
  router.push('/api-docs?model=' + encodeURIComponent(modelName))
}

const handleCurrentModelApiClick = () => {
  if (selectedModel.value) {
    router.push('/api-docs?model=' + encodeURIComponent(selectedModel.value))
  }
}

// =============================================
// 计算属性
// =============================================
const guideItems = computed(() => [
  t('aiAssistant.guide1'),
  t('aiAssistant.guide2'),
  t('aiAssistant.guide3'),
  t('aiAssistant.guide4'),
])

const suggestedQuestionsList = computed(() => {
  if (agentList.value.length > 0) {
    const agent = agentList.value.find(a => (a.botId || a.id) === selectedAgent.value)
    if (agent && agent.suggestedQuestions && Array.isArray(agent.suggestedQuestions)) {
      return agent.suggestedQuestions
    }
  }
  return []
})

// =============================================
// HTML 处理
// =============================================
const sanitizeHtml = (html: string) => {
  if (!html) return ''
  return DOMPurify.sanitize(html)
}

const tishiHandle = () => {
  tishiShow.value = !tishiShow.value
}

const formatContent = (content: string) => {
  if (!content) return ''

  let formatted = content

  formatted = formatted.replace(/###\s*(.*)/g, '<h3>$1</h3>')
  formatted = formatted.replace(/##\s*(.*)/g, '<h2>$1</h2>')
  formatted = formatted.replace(/#\s*(.*)/g, '<h1>$1</h1>')
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>')
  formatted = formatted.replace(/`(.*?)`/g, '<code>$1</code>')
  formatted = formatted.replace(/\n/g, '<br>')

  const urlRegex = /(https?:\/\/[^\s]+)/g
  formatted = formatted.replace(
    urlRegex,
    '<a href="$1" target="_blank" class="content-link">$1</a>'
  )

  return DOMPurify.sanitize(formatted, { ADD_ATTR: ['target'] })
}

const formatTokens = (tokens: number) => {
  if (tokens >= 1000) {
    return (tokens / 1000).toFixed(1) + 'K'
  }
  return tokens
}

// =============================================
// 复制 & 分享
// =============================================
const copyToInput = (text: string) => {
  prompt.value = text
}

const copyContent = (content: string) => {
  navigator.clipboard
    .writeText(content)
    .then(() => {
      ElMessage.success(t('aiAssistant.copySuccess'))
    })
    .catch(() => {
      ElMessage.error(t('aiAssistant.copyFailed'))
    })
}

const toggleAnswerVisibility = (index: number) => {
  answerVisibilityStates.value[index] = !answerVisibilityStates.value[index]
}

const downloadImages = (index: number) => {
  const content = agentContentList.value[index]
  if (content && content.imgUrlList && content.imgUrlList.length > 0) {
    content.imgUrlList.forEach((url: string, imgIndex: number) => {
      const link = document.createElement('a')
      link.href = url
      link.download = `image_${index}_${imgIndex}.png`
      link.click()
    })
    ElMessage.success(t('aiAssistant.downloadSuccess'))
  }
}

const shareMessage = (index: number) => {
  const question = questionList.value[index]?.question
  const content = agentContentList.value[index]?.content

  if (navigator.share) {
    navigator
      .share({
        title: question,
        text: content,
      })
      .catch((error) => {
        logger.warn('Share failed:', error)
      })
  } else {
    copyContent(`${question}\n\n${content}`)
  }
}

// =============================================
// 快捷操作
// =============================================
const handleQuickActionClick = (question: string) => {
  prompt.value = question
  handleSendMessage()
}

// =============================================
// 图片/视频/文件上传 (Feature 7, 8)
// =============================================
const handleImageUpload = () => {
  showImageUpload.value = true
}

const handleVideoUpload = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'video/*'
  input.onchange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file && chatRoomMode.value) {
      sendVideoMessage(file)
    }
  }
  input.click()
}

const handleFileUpload = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.onchange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file && chatRoomMode.value) {
      sendFileMessage(file)
    }
  }
  input.click()
}

const handleFileUploadSuccess = (files: FileInfo[]) => {
  uploadedFiles.value = files
  showImageUpload.value = false
  ElMessage.success(t('aiAssistant.imagesUploaded'))
}

const handleFileUploadError = (error: Error) => {
  ElMessage.error(error.message || t('common.errors.uploadFailed'))
}

// =============================================
// 语音输入
// =============================================
const handleVoiceError = (error: Error) => {
  ElMessage.error(error.message || t('aiAssistant.voiceInputFailed'))
}

const handleVoiceTranscript = (text: string, isFinal: boolean) => {
  if (isFinal) {
    prompt.value = text
  }
}

const toggleVoiceInput = () => {
  // VoiceInput component handles its own logic
}

// =============================================
// 图片预览 (Feature 6, 7)
// =============================================
const previewImage = (imageUrl: string) => {
  const _imageUrls = chatList.value
    .filter(msg => msg.mediaType === 'image' && msg.mediaUrl)
    .map(msg => msg.mediaUrl!)
  const link = document.createElement('a')
  link.href = imageUrl
  link.target = '_blank'
  link.click()
}

// =============================================
// Feature 1: WebSocket 实时通信
// =============================================
let unsubStatus: (() => void) | null = null
let unsubRoomMessage: (() => void) | null = null
let unsubMessage: (() => void) | null = null

function connectWebSocket() {
  if (!userUuid.value) {
    logger.warn('[ChatRoom] No user UUID, cannot connect WebSocket')
    return
  }

  const wsBaseUrl = window.location.protocol === 'https:' ? 'wss://' : 'ws://'
  const wsHost = window.location.host
  const wsUrl = `${wsBaseUrl}${wsHost}/cozeZhsApi/chat-room/ws`

  logger.info('[ChatRoom] Connecting WebSocket:', wsUrl)

  unsubStatus = websocketService.onStatusChange((status: WebSocketStatus) => {
    if (status === 'connected') {
      wsConnected.value = true
      joinRoom()
    } else if (status === 'disconnected' || status === 'error') {
      wsConnected.value = false
    }
  })

  unsubRoomMessage = websocketService.on('room_message', (data: unknown) => {
    handleWebSocketMessage(data as Record<string, unknown>)
  })

  unsubMessage = websocketService.on('message', (data: unknown) => {
    handleWebSocketMessage(data as Record<string, unknown>)
  })

  // JWT 鉴权: 使用 authStore.token 而非 userUuid
  const _jwtToken = _authStore.token || ''
  websocketService.connect(wsUrl, _jwtToken).catch((err) => {
    logger.error('[ChatRoom] WebSocket connect failed:', err)
  })
}

function disconnectWebSocket() {
  unsubStatus?.()
  unsubRoomMessage?.()
  unsubMessage?.()
  unsubStatus = null
  unsubRoomMessage = null
  unsubMessage = null
  websocketService.disconnect()
  wsConnected.value = false
}

// =============================================
// Feature 2: 房间加入/离开
// =============================================
function joinRoom() {
  if (!userUuid.value) return

  const message: Record<string, unknown> = {
    event: 'join_room',
    user_uuid: userUuid.value,
    room_name: chatTitle.value,
  }
  if (roomId.value) {
    message.room_id = roomId.value
  }
  if (receiverUuid.value) {
    message.receiver_uuid = receiverUuid.value
  }

  logger.info('[ChatRoom] Joining room:', message)
  websocketService.send('join_room', message)
}

function leaveRoom() {
  if (!userUuid.value) return

  const message: Record<string, unknown> = {
    event: 'leave_room',
    user_uuid: userUuid.value,
  }
  if (roomId.value) {
    message.room_id = roomId.value
  }

  websocketService.send('leave_room', message)
}

// =============================================
// Feature 3: 标记已读
// =============================================
async function markAsRead() {
  if (!userUuid.value || !roomId.value) return

  try {
    await markRoomAsRead(userUuid.value, roomId.value)
    logger.info('[ChatRoom] Marked as read')
  } catch (error) {
    logger.error('[ChatRoom] Mark as read failed:', error)
  }
}

// =============================================
// Feature 5: 历史消息加载
// =============================================
async function loadChatHistory() {
  if (!roomId.value || !userUuid.value) return

  try {
    const res = await getRoomHistory(userUuid.value, roomId.value)
    let messages: ChatRoomMessage[] = []

    if (res) {
      if (Array.isArray(res)) {
        messages = res
      } else {
        const historyRes = res as ApiResponse<ChatRoomHistoryData> & { messages?: ChatRoomMessage[] }
        if (historyRes.code === 200) {
          const data = historyRes.data as ChatRoomHistoryData | ChatRoomMessage[] | undefined
          if (Array.isArray(data)) {
            messages = data
          } else {
            messages = data?.messages || []
          }
        } else if (historyRes.messages) {
          messages = historyRes.messages
        } else if (historyRes.data && Array.isArray(historyRes.data)) {
          messages = historyRes.data as ChatRoomMessage[]
        }
      }
    }

    if (messages && messages.length > 0) {
      processMessages(messages)
    } else {
      chatList.value = []
    }
  } catch (error) {
    logger.error('[ChatRoom] Load chat history failed:', error)
  }
}

function processMessages(messages: ChatRoomMessage[]) {
  if (!messages || messages.length === 0) {
    chatList.value = []
    return
  }

  const currentUserUuid = userUuid.value
  let processedMessages = messages
    .filter((msg) => msg.is_del === 0)
    .map((msg) => {
      const isUserMessage = msg.user_uuid === currentUserUuid
      let mediaType: ChatMessage['mediaType'] = null
      let messageType = msg.type || 1
      let mediaUrl: string | null = null
      const content = msg.content || ''

      if (msg.type === 2) { mediaType = 'image'; messageType = 2; mediaUrl = content }
      else if (msg.type === 3) { mediaType = 'audio'; messageType = 3; mediaUrl = content }
      else if (msg.type === 4) { mediaType = 'file'; messageType = 4; mediaUrl = content }
      else if (content && (content.startsWith('http://') || content.startsWith('https://'))) {
        const urlLower = content.toLowerCase()
        if (/\.(jpg|jpeg|png|gif|webp|bmp|svg|ico)$/.test(urlLower)) { mediaType = 'image'; messageType = 2; mediaUrl = content }
        else if (/\.(mp4|avi|mov|wmv|flv|mkv|webm|m4v)$/.test(urlLower)) { mediaType = 'video'; messageType = 5; mediaUrl = content }
        else if (/\.(mp3|wav|aac|m4a|ogg|flac|wma|amr)$/.test(urlLower)) { mediaType = 'audio'; messageType = 3; mediaUrl = content }
        else { mediaType = 'file'; messageType = 4; mediaUrl = content }
      }

      return {
        id: msg.id,
        type: (isUserMessage ? 'user' : 'seller') as 'user' | 'seller' | 'system',
        content,
        sendTime: msg.send_time,
        source: msg.source,
        userUuid: msg.user_uuid,
        receiverUuid: msg.receiver_uuid,
        messageType,
        read: false,
        avatar: isUserMessage ? userAvatar.value : (msg.sender_avatar || botAvatar),
        senderName: msg.sender_name || '',
        senderAvatar: msg.sender_avatar || '',
        mediaType,
        mediaUrl,
      } as ChatMessage
    })

  processedMessages = processedMessages.reverse()

  // Feature 4: 消息去重逻辑
  const messageMap = new Map<string | number, ChatMessage>()
  const seenKeys = new Set<string>()

  processedMessages.forEach((msg: ChatMessage) => {
    let shouldAdd = false
    let uniqueKey = ''

    if (msg.id) {
      uniqueKey = `id_${msg.id}`
      if (!seenKeys.has(uniqueKey)) {
        seenKeys.add(uniqueKey)
        shouldAdd = true
      }
    } else {
      uniqueKey = `content_${msg.content}_${msg.userUuid}_${msg.sendTime}`
      if (!seenKeys.has(uniqueKey)) {
        seenKeys.add(uniqueKey)
        shouldAdd = true
      }
    }

    if (shouldAdd) {
      messageMap.set(uniqueKey, msg)
    }
  })

  chatList.value = Array.from(messageMap.values())

  if (chatList.value.length > 0) {
    const lastMessage = chatList.value[chatList.value.length - 1]
    lastHistoryMessageId.value = lastMessage.id
    lastHistoryMessageContent.value = lastMessage.content
    lastHistoryMessageTime.value = lastMessage.sendTime
    lastHistoryMessageUserUuid.value = lastMessage.userUuid
  }

  scrollToBottom()
  // 500ms 后再次滚动到底部，保存返回值以便组件卸载时清理
  scrollBottomTimer = setTimeout(() => scrollToBottom(), 500)
}

// =============================================
// Feature 4: 消息去重逻辑
// =============================================
function isDuplicateMessage(messageData: Record<string, unknown>): boolean {
  const _currentUserUuid = userUuid.value
  const messageUserUuid = messageData.user_uuid || messageData.sender_uuid

  // 基于ID去重
  if (messageData.id) {
    const existingById = chatList.value.find(msg => msg.id === messageData.id)
    if (existingById) return true

    if (lastHistoryMessageId.value && messageData.id === lastHistoryMessageId.value) {
      return true
    }
  }

  // 基于内容+时间+用户去重
  if (lastHistoryMessageContent.value && lastHistoryMessageTime.value && lastHistoryMessageUserUuid.value) {
    const sendTime = (messageData.send_time || messageData.timestamp || new Date().toISOString()) as string
    const contentMatch = messageData.content === lastHistoryMessageContent.value
    const userMatch = messageUserUuid === lastHistoryMessageUserUuid.value
    let timeMatch = false

    if (sendTime === lastHistoryMessageTime.value) {
      timeMatch = true
    } else if (sendTime && lastHistoryMessageTime.value) {
      try {
        const msgTime = new Date(lastHistoryMessageTime.value).getTime()
        const newTime = new Date(sendTime).getTime()
        if (!isNaN(msgTime) && !isNaN(newTime)) {
          timeMatch = Math.abs(msgTime - newTime) < 2000
        }
      } catch { timeMatch = false }
    }

    if (contentMatch && userMatch && timeMatch) return true
  }

  // 通用内容+用户+时间去重
  const sendTime2 = (messageData.send_time || messageData.timestamp || new Date().toISOString()) as string
  const existingByContent = chatList.value.find(msg => {
    if (messageData.id && msg.id === messageData.id) return true
    const contentMatch = msg.content === messageData.content
    const userMatch = msg.userUuid === messageUserUuid
    let timeMatch = false
    if (msg.sendTime === sendTime2) {
      timeMatch = true
    } else if (msg.sendTime && sendTime2) {
      try {
        const msgTime = new Date(msg.sendTime).getTime()
        const newTime = new Date(sendTime2).getTime()
        if (!isNaN(msgTime) && !isNaN(newTime)) {
          timeMatch = Math.abs(msgTime - newTime) < 2000
        }
      } catch { timeMatch = false }
    }
    return contentMatch && userMatch && (timeMatch || !msg.sendTime || !sendTime2)
  })

  if (existingByContent) return true

  return false
}

// =============================================
// WebSocket 消息处理
// =============================================
function handleWebSocketMessage(message: Record<string, unknown>) {
  try {
    if (message.event === 'room_message' || message.event === 'message') {
      addMessageToList(message)
    } else if (message.event === 'error') {
      ElMessage.error((message.message || message.msg || 'Send failed') as string)
    } else {
      if (message.content && (message.user_uuid || message.sender_uuid)) {
        addMessageToList(message)
      }
    }
  } catch (error) {
    logger.error('[ChatRoom] Handle WebSocket message failed:', error)
  }
}

function addMessageToList(messageData: Record<string, unknown>) {
  const currentUserUuid = userUuid.value
  if (!currentUserUuid) return

  const messageUserUuid = (messageData.user_uuid || messageData.sender_uuid) as string
  if (!messageUserUuid) return

  if (isDuplicateMessage(messageData)) return

  // 临时消息匹配
  const isUserMessage = messageUserUuid === currentUserUuid
  const tempMessageIndex = chatList.value.findIndex(msg =>
    msg.isTemp &&
    msg.content === messageData.content &&
    msg.userUuid === currentUserUuid
  )

  if (isUserMessage || tempMessageIndex !== -1) {
    if (tempMessageIndex !== -1) {
      const tempMessage = chatList.value[tempMessageIndex]
      tempMessage.id = (messageData.id || tempMessage.id) as string | number
      tempMessage.sendTime = (messageData.send_time || messageData.timestamp || tempMessage.sendTime) as string
      tempMessage.source = (messageData.source || messageUserUuid) as string
      tempMessage.receiverUuid = (messageData.receiver_uuid || '') as string
      tempMessage.messageType = (messageData.type || tempMessage.messageType) as number
      tempMessage.isTemp = false
      tempMessage.senderName = (messageData.sender_name || '') as string
      tempMessage.senderAvatar = (messageData.sender_avatar || '') as string
      tempMessage.type = 'user'
      scrollToBottom()
      return
    }
  }

  // 确定媒体类型
  let mediaType: ChatMessage['mediaType'] = null
  if (messageData.type === 2) mediaType = 'image'
  else if (messageData.type === 3) mediaType = 'audio'
  else if (messageData.type === 4) mediaType = 'file'
  else if (messageData.content && typeof messageData.content === 'string') {
    const urlLower = messageData.content.toLowerCase()
    if (/\.(jpg|jpeg|png|gif|webp|bmp)$/.test(urlLower)) mediaType = 'image'
    else if (/\.(mp3|wav|aac|m4a|ogg)$/.test(urlLower)) mediaType = 'audio'
  }

  const newMessage: ChatMessage = {
    id: (messageData.id || Date.now()) as string | number,
    type: (isUserMessage ? 'user' : 'seller') as 'user' | 'seller' | 'system',
    content: (messageData.content || '') as string,
    sendTime: (messageData.send_time || messageData.timestamp || new Date().toISOString()) as string,
    source: (messageData.source || messageUserUuid) as string,
    userUuid: messageUserUuid,
    receiverUuid: (messageData.receiver_uuid || '') as string,
    messageType: (messageData.type || 1) as number,
    read: false,
    avatar: isUserMessage ? userAvatar.value : (messageData.sender_avatar as string || botAvatar),
    senderName: (messageData.sender_name || '') as string,
    senderAvatar: (messageData.sender_avatar || '') as string,
    isTemp: false,
    mediaType,
    mediaUrl: mediaType ? (messageData.content as string) : null,
  }

  chatList.value.push(newMessage)
  scrollToBottom()
}

// =============================================
// Feature 12-15: 开关处理
// =============================================
function toggleSuperAgent() {
  superAgentEnabled.value = !superAgentEnabled.value
  ElMessage.info(`Super Agent ${superAgentEnabled.value ? 'enabled' : 'disabled'}`)
}

function toggleMCP() {
  mcpEnabled.value = !mcpEnabled.value
  ElMessage.info(`MCP Tools ${mcpEnabled.value ? 'enabled' : 'disabled'}`)
}

function toggleKnowledgeBase() {
  knowledgeBaseEnabled.value = !knowledgeBaseEnabled.value
  ElMessage.info(`Knowledge Base ${knowledgeBaseEnabled.value ? 'enabled' : 'disabled'}`)
}

function togglePermanentMemory() {
  permanentMemoryEnabled.value = !permanentMemoryEnabled.value
  ElMessage.info(`Permanent Memory ${permanentMemoryEnabled.value ? 'enabled' : 'disabled'}`)
}

// =============================================
// 发送消息 (Coze AI 模式 + 聊天房间模式)
// =============================================
const handleSendMessage = async () => {
  if (!prompt.value.trim()) return

  if (chatRoomMode.value) {
    // 聊天房间模式: 通过 WebSocket 发送
    sendChatRoomMessage(prompt.value.trim())
  } else {
    // Coze AI 模式: 通过 API 发送
    const question = prompt.value.trim()
    questionList.value.push({
      question,
      // 关键修复: FileInfo.url 类型为 string | undefined, 而 imgsList 期望 string.
      // 过滤掉无 url 的项避免 TS 错误, 避免空 url 进入消息载荷.
      imgsList: uploadedFiles.value
        .filter((f): f is { url: string } & typeof f => Boolean(f.url))
        .map(f => ({ imgUrl: f.url })),
    })

    prompt.value = ''
    uploadedFiles.value = []

    const data = await executeApi(() => sendCozeMessage({
      botId: selectedAgent.value,
      query: question,
    }))

    if (data !== null && typeof data === 'object') {
      const messageDataObj = data as { content?: string }
      agentContentList.value.push({
        content: messageDataObj.content || '',
        imgUrlList: [],
        videoUrlList: [],
        total_tokens: 0,
        copyContent: messageDataObj.content || '',
      })
    } else {
      questionList.value.pop()
    }
  }

  scrollToBottom()
}

function sendChatRoomMessage(content: string) {
  if (!wsConnected.value) {
    ElMessage.warning('WebSocket not connected, please retry later')
    return
  }
  if (!userUuid.value) {
    ElMessage.warning('User info incomplete')
    return
  }

  const tempMessageId = `temp_${Date.now()}`
  const userMessage: ChatMessage = {
    id: tempMessageId,
    type: 'user',
    content,
    sendTime: new Date().toISOString(),
    source: userUuid.value,
    userUuid: userUuid.value,
    receiverUuid: '',
    messageType: 1,
    read: false,
    avatar: userAvatar.value,
    senderName: '',
    senderAvatar: '',
    isTemp: true,
  }

  chatList.value.push(userMessage)
  prompt.value = ''
  scrollToBottom()

  const messageData: Record<string, unknown> = {
    event: 'send_message',
    user_uuid: userUuid.value,
    content,
  }
  if (roomId.value) messageData.room_id = roomId.value
  if (receiverUuid.value) messageData.receiver_uuid = receiverUuid.value

  try {
    websocketService.send('send_message', messageData)
  } catch {
    chatList.value = chatList.value.filter(msg => msg.id !== tempMessageId)
    ElMessage.error('Send failed, check connection')
    return
  }

  scrollToBottom()
}

// =============================================
// 视频消息发送 (Feature 7)
// =============================================
async function sendVideoMessage(file: File) {
  if (!wsConnected.value || !userUuid.value) return

  const tempMessageId = `temp_${Date.now()}`
  const videoUrl = URL.createObjectURL(file)

  const userMessage: ChatMessage = {
    id: tempMessageId,
    type: 'user',
    content: videoUrl,
    sendTime: new Date().toISOString(),
    source: userUuid.value,
    userUuid: userUuid.value,
    receiverUuid: '',
    messageType: 5,
    read: false,
    avatar: userAvatar.value,
    senderName: '',
    senderAvatar: '',
    isTemp: true,
    mediaType: 'video',
    mediaUrl: videoUrl,
  }

  chatList.value.push(userMessage)
  scrollToBottom()

  const messageData: Record<string, unknown> = {
    event: 'send_message',
    user_uuid: userUuid.value,
    content: videoUrl,
    type: 5,
  }
  if (roomId.value) messageData.room_id = roomId.value
  if (receiverUuid.value) messageData.receiver_uuid = receiverUuid.value

  websocketService.send('send_message', messageData)
}

// =============================================
// 文件消息发送 (Feature 8)
// =============================================
async function sendFileMessage(file: File) {
  if (!wsConnected.value || !userUuid.value) return

  const tempMessageId = `temp_${Date.now()}`
  const fileUrl = URL.createObjectURL(file)

  const userMessage: ChatMessage = {
    id: tempMessageId,
    type: 'user',
    content: fileUrl,
    sendTime: new Date().toISOString(),
    source: userUuid.value,
    userUuid: userUuid.value,
    receiverUuid: '',
    messageType: 4,
    read: false,
    avatar: userAvatar.value,
    senderName: '',
    senderAvatar: '',
    isTemp: true,
    mediaType: 'file',
    mediaUrl: fileUrl,
  }

  chatList.value.push(userMessage)
  scrollToBottom()

  const messageData: Record<string, unknown> = {
    event: 'send_message',
    user_uuid: userUuid.value,
    content: fileUrl,
    type: 4,
  }
  if (roomId.value) messageData.room_id = roomId.value
  if (receiverUuid.value) messageData.receiver_uuid = receiverUuid.value

  websocketService.send('send_message', messageData)
}

// =============================================
// 滚动
// =============================================
const scrollToBottom = () => {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
  })
}

// =============================================
// 导航
// =============================================
const handleBack = () => {
  if (chatRoomMode.value) {
    leaveRoom()
  }
  router.replace('/')
}

// =============================================
// 生命周期
// =============================================
onMounted(async () => {
  // 加载用户信息
  const userData = StorageManager.getItem<Record<string, unknown>>(STORAGE_KEYS.DATA)
  if (userData) {
    if (userData.uuid) userUuid.value = String(userData.uuid)
    if (userData.avatar) userAvatar.value = String(userData.avatar)
    else if (userData.headimgurl) userAvatar.value = String(userData.headimgurl)
  }

  // 聊天房间模式初始化
  if (chatRoomMode.value) {
    pageTitle.value = chatTitle.value

    if (roomId.value && userUuid.value) {
      loadChatHistory()
      markAsRead()
    }

    if (userUuid.value) {
      connectWebSocket()
    }
  } else {
    // Coze AI 模式初始化
    const agentId = route.query.agentId as string
    if (agentId) {
      selectedAgent.value = agentId
    }

    try {
      const agents = await getAgentsList({
        page: 1,
        pageSize: 100,
      })
      if (agents && agents.data && agents.data.list) {
        agentList.value = agents.data.list
        if (agentList.value.length > 0 && !selectedAgent.value) {
          const firstAgent = agentList.value[0]
          selectedAgent.value = String(firstAgent.botId ?? firstAgent.id ?? '')
        }
      }
    } catch (error) {
      logger.error('Failed to fetch agent list:', error)
    }
  }
})

cleanup.add(() => {
  if (chatRoomMode.value) {
    disconnectWebSocket()
  }
  // shared-logic: clean up cross-platform chat connection
  sharedChat.disconnect()
  // 清理滚动定时器
  if (scrollBottomTimer !== null) {
    clearTimeout(scrollBottomTimer)
    scrollBottomTimer = null
  }
})
</script>

<style scoped lang="scss">
// ============================================
// CSS 变量定义 - 支持明暗主题
// ============================================
.ai-assistant-page {
  // 亮色模式变量（默认）
  --bg-page: var(--color-neutral-100);
  --bg-card: var(--el-bg-color);
  --bg-input: var(--el-bg-color);
  --bg-code: var(--color-neutral-100);
  --bg-tip: var(--el-text-color-primary);
  --bg-avatar: var(--color-gray-light);
  --bg-quick-action: var(--el-text-color-primary);
  --text-primary: var(--color-gray-333);
  --text-secondary: var(--color-gray-666);
  --text-muted: var(--color-gray-999);
  --border-color: var(--border-unified-color);
  --accent-color: var(--color-primary);
  --accent-hover: var(--color-primary);
  --warning-color: var(--color-warning-variant);
  --question-bg: var(--color-primary);
  --question-color: var(--el-bg-color);

  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-page);
}

// 暗色模式变量
html.dark .ai-assistant-page {
  --bg-page: var(--color-dark-bg-1);
  --bg-card: var(--color-dark-bg-2);
  --bg-input: var(--el-text-color-primary);
  --bg-code: var(--color-dark-bg-3);
  --bg-tip: var(--color-primary-10);
  --bg-avatar: var(--color-dark-bg-3);
  --bg-quick-action: var(--color-primary-10);
  --text-primary: var(--color-gray-light);
  --text-secondary: var(--el-text-color-primary);
  --text-muted: var(--color-gray-666);
  --border-color: var(--border-unified-color);
  --accent-color: var(--color-primary);
  --accent-hover: var(--el-text-color-primary);
  --warning-color: var(--color-warning-variant);
  --question-bg: var(--color-primary);
  --question-color: var(--el-bg-color);
}

.page-header {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  background: var(--bg-card);
  border-bottom: var(--unified-border-bottom);
  position: sticky;
  top: 0;
  z-index: var(--z-header);
}

.back-btn {
  margin-right: 12px;
  padding: 8px;
}

.page-title {
  flex: 1;
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.tishi-block {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  background: var(--bg-card);
  cursor: pointer;
  border-bottom: var(--unified-border-bottom);
}

.tishi-block .el-icon {
  margin-right: 8px;
  color: var(--accent-color);
}

.tishi-text {
  font-size: 14px;
  color: var(--text-secondary);
}

.intelligent-assistant {
  padding: 16px 20px;
  background: var(--bg-card);
  border-bottom: var(--unified-border-bottom);
}

.guide-content h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  color: var(--text-primary);
}

.guide-content ul {
  margin: 0;
  padding-left: 20px;
  list-style: none;
}

.guide-content li {
  margin-bottom: 8px;
  font-size: 14px;
  color: var(--text-secondary);
  position: relative;
}

.guide-content li::before {
  content: "\2022";
  position: absolute;
  left: -16px;
  color: var(--accent-color);
}

.tishi-box {
  padding: 16px 20px;
  background: var(--bg-card);
  border-bottom: var(--unified-border-bottom);
}

.tishi-box-content {
  padding: 12px;
  background: var(--bg-tip);
  border-radius: var(--global-border-radius);
  border-left: 4px solid var(--accent-color);
}

.tishi-title {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  font-weight: 600;
  color: var(--text-primary);
}

.tishi-title .el-icon {
  margin-right: 8px;
  color: var(--warning-color);
}

.tishi-content {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.chat-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  scroll-behavior: smooth;
}

.welcome-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.welcome-avatar {
  width: 80px;
  height: 80px;
  margin-bottom: 20px;
  border-radius: var(--global-border-radius);
  overflow: hidden;
  background: var(--bg-avatar);
}

.welcome-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.welcome-text {
  font-size: 18px;
  color: var(--text-secondary);
}

.message-group {
  margin-bottom: 24px;
}

.question-images {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.question-image {
  width: 100px;
  height: 100px;
  object-fit: cover;
  border-radius: var(--global-border-radius);
}

.question-container {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
}

.question-actions {
  margin-right: 8px;
  align-self: flex-end;
}

.question-text {
  max-width: 100%;
  padding: 12px 16px;
  background: var(--question-bg);
  color: var(--question-color);
  border-radius: var(--global-border-radius);
  word-wrap: break-word;
}

.answer-container {
  margin-bottom: 16px;
}

.answer-content {
  padding: 12px 16px;
  background: var(--bg-card);
  border-radius: var(--global-border-radius);
  word-wrap: break-word;
  line-height: 1.6;
  color: var(--text-primary);
}

.answer-content :deep(h1),
.answer-content :deep(h2),
.answer-content :deep(h3) {
  margin: 12px 0 8px 0;
  color: var(--text-primary);
}

.answer-content :deep(code) {
  padding: 2px 6px;
  background: var(--bg-code);
  border-radius: var(--global-border-radius);
  font-family: monospace;
}

.answer-content :deep(.content-link) {
  color: var(--accent-color);
  text-decoration: none;
}

.answer-content :deep(.content-link:hover) {
  text-decoration: underline;
}

.answer-images {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  flex-wrap: wrap;
}

.answer-image {
  width: 200px;
  height: 200px;
  border-radius: var(--global-border-radius);
}

.answer-videos {
  margin-top: 12px;
}

.answer-video {
  width: 100%;
  border-radius: var(--global-border-radius);
}

.answer-meta {
  display: flex;
  align-items: center;
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-muted);
}

.token-consumption {
  display: flex;
  align-items: center;
}

.answer-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.loading-message {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  color: var(--text-secondary);
}

.loading-message .el-icon {
  margin-right: 8px;
}

.quick-actions {
  padding: 12px 20px;
  background: var(--bg-card);
  border-top: var(--unified-border);
}

.quick-actions-scroll {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.quick-action-btn {
  padding: 8px 16px;
  background: var(--bg-quick-action);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  font-size: 14px;
  color: var(--accent-color);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.3s;
}

.quick-action-btn:hover {
  background: var(--accent-hover);
  color: var(--el-bg-color);
}

.input-section {
  padding: 16px 20px;
  background: var(--bg-card);
  border-top: var(--unified-border);
}

.model-selector,
.agent-selector {
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;

  .el-select {
    flex: 1;
  }

  .model-option-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }

  // API 按钮：与能力面板 / AIDialog 统一，</> + API
  .model-api-btn,
  .current-model-api-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    height: 26px;
    padding: 0 8px;
    border: var(--unified-border);
    background: transparent;
    border-radius: var(--global-border-radius-sm, 4px);
    color: var(--el-text-color-secondary);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
    cursor: pointer;
    flex-shrink: 0;
    transition: background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), color 0.15s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .model-api-btn:hover,
  .current-model-api-btn:hover {
    background: var(--el-fill-color-light);
    color: var(--el-text-color-primary);
    border-color: var(--el-border-color);
  }

  .model-api-btn__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }

  .model-api-btn__icon svg {
    width: 100%;
    height: 100%;
    display: block;
  }

  .model-api-btn__text {
    flex-shrink: 0;
  }
}

.input-wrapper {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.message-input {
  flex: 1;
}

.input-actions {
  display: flex;
  gap: 8px;
}

/* ============================================
   聊天房间样式 (Feature 6-10: 消息类型 & 已读状态)
   ============================================ */
.chat-messages {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.message-item {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  max-width: 80%;

  &.user {
    align-self: flex-end;
    flex-direction: row-reverse;
  }

  &.seller {
    align-self: flex-start;
  }

  &.system {
    align-self: center;
    max-width: 100%;
  }
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--bg-avatar);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.message-bubble {
  padding: 10px 14px;
  border-radius: var(--global-border-radius);
  max-width: 100%;
  word-wrap: break-word;

  &.media-message {
    padding: 4px;
  }
}

.user-bubble {
  background: var(--question-bg);
  color: var(--question-color);
  border-top-right-radius: 4px;

  &.media-message {
    background: transparent;
    padding: 0;
  }
}

.seller-bubble {
  background: var(--bg-card);
  border: var(--unified-border);
  border-top-left-radius: 4px;

  .bubble-text {
    color: var(--text-primary);
  }

  &.media-message {
    background: transparent;
    border: none;
    padding: 0;
  }
}

.bubble-text {
  font-size: 14px;
  line-height: 1.5;

  :deep(h1), :deep(h2), :deep(h3) {
    margin: 8px 0 4px 0;
  }

  :deep(code) {
    padding: 2px 6px;
    background: var(--bg-code);
    border-radius: var(--global-border-radius);
    font-family: monospace;
  }

  :deep(.content-link) {
    color: var(--accent-color);
    text-decoration: none;
  }

  :deep(.content-link:hover) {
    text-decoration: underline;
  }
}

.read-status {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 4px;
  text-align: right;
  opacity: 0.7;
}

.message-image {
  max-width: 300px;
  max-height: 300px;
  border-radius: var(--global-border-radius);
  cursor: pointer;
}

.message-video {
  max-width: 400px;
  max-height: 300px;
  border-radius: var(--global-border-radius);
}

.message-audio, .message-file {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px;

  .audio-text, .file-text {
    font-size: 13px;
    color: var(--text-secondary);
  }

  .audio-url, .file-url {
    font-size: 12px;
    color: var(--accent-color);
    text-decoration: underline;
  }
}

.system-message {
  padding: 8px 0;
  text-align: center;

  span {
    font-size: 12px;
    color: var(--text-muted);
  }
}

/* 底部操作栏 (Feature 11) */
.bottom-action-bar {
  padding: 8px 0;
  border-bottom: var(--unified-border-bottom);
}

.action-bar-items {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: center;
}

.chat-room-input {
  border-top: var(--unified-border);
}

.chat-container {
  &.chat-room-mode {
    padding-bottom: 0;
  }
}

@media (max-width: 768px) {
  .page-header {
    padding: 12px 16px;
  }

  .page-title {
    font-size: 16px;
  }

  .question-text {
    max-width: 100%;
  }

  .answer-image {
    width: 150px;
    height: 150px;
  }

  .input-wrapper {
    flex-direction: column;
  }

  .input-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .message-item {
    max-width: 90%;
  }

  .action-bar-items {
    gap: 4px;
  }
}
</style>
