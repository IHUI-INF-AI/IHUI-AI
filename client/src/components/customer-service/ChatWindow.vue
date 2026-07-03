<template>
  <div class="customer-service-chat">
    <!-- 聊天头部 -->
    <div class="chat-header">
      <div class="header-info">
        <el-icon class="service-icon"><Service /></el-icon>
        <div class="header-text">
          <h3>{{ t('customerService.chat.title') }}</h3>
          <div class="connection-status" :class="String(status)">
            <el-icon v-if="status === 'connected'"><CircleCheck /></el-icon>
            <el-icon v-else-if="status === 'connecting'"><Loading /></el-icon>
            <el-icon v-else><CircleClose /></el-icon>
            <span>{{ getStatusText() }}</span>
          </div>
        </div>
      </div>
      <div class="header-actions">
        <el-button text size="small" @click="showFAQs = !showFAQs">
          <el-icon><QuestionFilled /></el-icon>
          {{ t('customerService.chat.faqs') }}
        </el-button>
        <el-button text size="small" @click="$emit('close')">
          <el-icon><Close /></el-icon>
        </el-button>
      </div>
    </div>

    <!-- 常见问题侧边栏 -->
    <div v-if="showFAQs" class="faqs-sidebar">
      <div class="faqs-header">
        <h4>{{ t('customerService.faq.title') }}</h4>
        <el-button text size="small" @click="showFAQs = false">
          <el-icon><Close /></el-icon>
        </el-button>
      </div>
      <div class="faqs-list" v-loading="loadingFAQs">
        <div
          v-for="faq in faqs"
          :key="faq.id"
          class="faq-item"
          @click="insertFAQAnswer(faq)"
        >
          <div class="faq-question">{{ faq.question }}</div>
          <div class="faq-answer">{{ faq.answer }}</div>
        </div>
      </div>
    </div>

    <!-- 消息列表 -->
    <div class="chat-messages" ref="messagesContainer">
      <div v-if="messages.length === 0 && !loading" class="empty-state">
        <el-icon class="empty-icon"><ChatDotRound /></el-icon>
        <p>{{ t('customerService.chat.startChat') }}</p>
      </div>

      <div v-for="message in messages" :key="message.id" class="message-item" :class="getMessageClass(message)">
        <div class="message-avatar">
          <el-avatar :size="32" :src="message.senderAvatar">
            <el-icon><User v-if="message.senderId !== currentUserId" /><Service v-else /></el-icon>
          </el-avatar>
        </div>
        <div class="message-content">
          <div class="message-header">
            <span class="message-sender">{{ message.senderName }}</span>
            <span class="message-time">{{ formatTime(message.createTime) }}</span>
          </div>
          <div class="message-body">
            <!-- 文本消息 -->
            <div v-if="message.type === 'text'" class="message-text">{{ message.content }}</div>
            <!-- 图片消息 -->
            <div v-else-if="message.type === 'image'" class="message-image">
              <el-image
                v-for="file in message.files"
                :key="file.id"
                :src="file.url"
                :preview-src-list="[file.url]"
                fit="cover"
                class="image-item"
              />
            </div>
            <!-- 文件消息 -->
            <div v-else-if="message.type === 'file'" class="message-file">
              <div v-for="file in message.files" :key="file.id" class="file-item">
                <el-icon><Document /></el-icon>
                <a :href="file.url" target="_blank" class="file-link">{{ file.name }}</a>
                <span class="file-size">{{ formatFileSize(file.size) }}</span>
              </div>
            </div>
            <!-- 系统消息 -->
            <div v-else-if="message.type === 'system'" class="message-system">{{ message.content }}</div>
          </div>
          <div class="message-status">
            <el-icon v-if="message.status === 'sending'"><Loading /></el-icon>
            <el-icon v-else-if="message.status === 'sent'"><CircleCheck /></el-icon>
            <el-icon v-else-if="message.status === 'read'"><Select /></el-icon>
          </div>
        </div>
      </div>

      <!-- 输入状态提示 -->
      <div v-if="isTyping && typingUserId !== currentUserId" class="typing-indicator">
        <span class="typing-dots">
          <span></span>
          <span></span>
          <span></span>
        </span>
        <span>{{ t('customerService.chat.typing') }}</span>
      </div>
    </div>

    <!-- 输入区域 -->
    <div class="chat-input-area">
      <!-- 文件预览 -->
      <div v-if="uploadedFiles.length > 0" class="file-preview">
        <div v-for="(file, index) in uploadedFiles" :key="index" class="preview-item">
          <el-image
            v-if="file.type?.startsWith('image/')"
            :src="file.preview"
            fit="cover"
            class="preview-image"
          />
          <div v-else class="preview-file">
            <el-icon><Document /></el-icon>
            <span>{{ file.name }}</span>
          </div>
          <el-button link size="small" @click="removeFile(index)">
            <el-icon><Close /></el-icon>
          </el-button>
        </div>
      </div>

      <div class="input-wrapper">
        <el-button link size="small" @click="handleFileSelect">
          <el-icon><Paperclip /></el-icon>
        </el-button>
        <el-input
          v-model="inputText"
          type="textarea"
          :placeholder="t('customerService.chat.placeholder')"
          :rows="3"
          :maxlength="1000"
          show-word-limit
          @keydown.ctrl.enter="handleSend"
          @input="handleInputChange"
        />
        <el-button type="primary" @click="handleSend" :loading="sending" :disabled="!canSend">
          <el-icon><Promotion /></el-icon>
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { useI18n } from 'vue-i18n'
import {
  Service,
  Close,
  CircleCheck,
  CircleClose,
  Loading,
  QuestionFilled,
  ChatDotRound,
  User,
  Document,
  Paperclip,
  Promotion,
  Select,
} from '@element-plus/icons-vue'
import { useCustomerServiceWebSocket } from '@/composables/useCustomerServiceWebSocket'
import { getFAQs, type FAQ } from '@/api/customer-service'
import { useAuthStore } from '@/stores/auth'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { logger } from '@/utils/logger'
import { useApiError } from '@/composables/useApiError'
import { formatTimeDistance } from '@/utils/time-utils'
import { formatFileSize } from '@/utils/format'

interface Props {
  conversationId?: string
}

const props = defineProps<Props>()
const _emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const authStore = useAuthStore()
const { showError } = useOperationFeedback()
const cleanup = useCleanup()

const inputText = ref('')
const uploadedFiles = ref<File[]>([])
const sending = ref(false)
const showFAQs = ref(false)
const { loading: loadingFAQs, execute: executeApi } = useApiError({ showMessage: false })
const faqs = ref<FAQ[]>([])
const _DEFAULT_FAQS: FAQ[] = [
  { id: 'faq-1', category: 'general', question: '如何联系商务合作？', answer: '请在本页使用「联系商务」或提交工单，我们会尽快与您联系。', order: 1 },
  { id: 'faq-2', category: 'general', question: 'API 调用限制与计费？', answer: '详见开放平台文档的「定价与用量」说明，可按需选择套餐。', order: 2 },
  { id: 'faq-3', category: 'general', question: '遇到问题如何提交工单？', answer: '在客服中心切换到「工单」标签，填写问题类型与描述并提交即可。', order: 3 },
]
const messagesContainer = ref<HTMLElement | null>(null)
const typingTimeout = ref<ReturnType<typeof setTimeout> | null>(null)

const currentUserId = computed(() => {
  const user = authStore.user
  return (user && typeof user === 'object' && 'id' in user ? (user as { id: string }).id : '') || ''
})

// WebSocket连接
const {
  messages,
  isTyping,
  typingUserId,
  conversationId: _conversationId,
  status,
  connect,
  disconnect,
  sendMessage,
  sendTyping,
  markAsRead,
  loadHistoryMessages: _loadHistoryMessages,
} = useCustomerServiceWebSocket({
  conversationId: props.conversationId,
  onSendError: (msg: string) => {
    showError(msg)
  },
  onMessage: (message) => {
    // 收到新消息后滚动到底部
    nextTick(() => {
      scrollToBottom()
    })
    // 如果是对方的消息，标记为已读
    if (message.senderId !== currentUserId.value) {
      markAsRead([message.id])
    }
  },
  onTyping: () => {
    // 输入状态变化
  },
  onStatusChange: () => {
    // 连接状态变化
  },
})

// 计算属性
// 有内容且未在发送即可发（未连接时走 HTTP 或兜底模拟回复，保证可在线对话）
const canSend = computed(() => {
  return (
    (inputText.value.trim().length > 0 || uploadedFiles.value.length > 0) &&
    !sending.value
  )
})

// 获取消息样式类
interface ChatMessage {
  senderId?: string
  type?: string
}
const getMessageClass = (message: ChatMessage) => {
  return {
    'message-user': message.senderId === currentUserId.value,
    'message-staff': message.senderId !== currentUserId.value,
    'message-system': message.type === 'system',
  }
}

// 获取状态文本
const getStatusText = () => {
  const statusValue = status.value as string
  switch (statusValue) {
    case 'connected':
      return t('customerService.chat.connected')
    case 'connecting':
      return t('customerService.chat.connecting')
    case 'reconnecting':
      return t('customerService.chat.reconnecting')
    default:
      return t('customerService.chat.disconnected')
  }
}

// 格式化时间
const formatTime = (time: string) => {
  const result = formatTimeDistance(time)
  return result || time
}

// 处理输入变化
const handleInputChange = () => {
  // 发送输入状态
  if (inputText.value.trim().length > 0) {
    sendTyping(true)
    // 清除之前的定时器
    if (typingTimeout.value) {
      clearTimeout(typingTimeout.value)
    }
    // 3秒后停止输入状态
    typingTimeout.value = setTimeout(() => {
      sendTyping(false)
    }, 3000)
  } else {
    sendTyping(false)
  }
}

// 处理文件选择
const handleFileSelect = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.multiple = true
  input.accept = 'image/*,application/pdf,.doc,.docx,.txt'
  input.onchange = (e: Event) => {
    const target = e.target as HTMLInputElement
    if (target.files) {
      Array.from(target.files).forEach(file => {
        // 检查文件大小（最大10MB）
        if (file.size > 10 * 1024 * 1024) {
          showError(t('customerService.chat.fileSizeExceeded'))
          return
        }
        uploadedFiles.value.push(file)
        // 如果是图片，生成预览
        if (file.type.startsWith('image/')) {
          const reader = new FileReader()
          reader.onload = e => {
            const fileIndex = uploadedFiles.value.findIndex(f => f === file)
            if (fileIndex >= 0) {
              interface FileWithPreview extends File {
                preview?: string
              }
              ;(uploadedFiles.value[fileIndex] as FileWithPreview).preview = e.target?.result as string
            }
          }
          reader.readAsDataURL(file)
        }
      })
    }
  }
  input.click()
}

// 移除文件
const removeFile = (index: number) => {
  uploadedFiles.value.splice(index, 1)
}

// 插入常见问题答案
const insertFAQAnswer = (faq: FAQ) => {
  inputText.value = faq.answer
  showFAQs.value = false
}

// 发送消息
const handleSend = async () => {
  if (!canSend.value) return

  const content = inputText.value.trim()
  const files = uploadedFiles.value
  const messageType = files.length > 0 ? (files[0].type.startsWith('image/') ? 'image' : 'file') : 'text'

  sending.value = true
  try {
    const success = await sendMessage(content, messageType, files)
    if (success) {
      inputText.value = ''
      uploadedFiles.value = []
      sendTyping(false)
      nextTick(() => {
        scrollToBottom()
      })
    } else {
      showError(t('customerService.chat.sendFailed'))
    }
  } catch (error) {
    logger.error('Failed to send message:', error)
    showError(t('customerService.chat.sendFailed'))
  } finally {
    sending.value = false
  }
}

// 滚动到底部
const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

// 加载常见问题（接口失败时使用兜底列表，保证侧栏有内容）
const loadFAQs = async () => {
  const response = await executeApi(() => getFAQs())
  if (response && response.list && response.list.length > 0) {
    faqs.value = response.list
  } else {
    faqs.value = [
      { id: 'faq-1', category: 'general', question: '如何联系商务合作？', answer: '请在本页使用「联系商务」或提交工单，我们会尽快与您联系。', order: 1 },
      { id: 'faq-2', category: 'general', question: 'API 调用限制与计费？', answer: '详见开放平台文档的「定价与用量」说明，可按需选择套餐。', order: 2 },
      { id: 'faq-3', category: 'general', question: '遇到问题如何提交工单？', answer: '在客服中心切换到「工单」标签，填写问题类型与描述并提交即可。', order: 3 },
    ]
  }
}

// 监听消息变化，自动滚动
watch(messages, () => {
  nextTick(() => {
    scrollToBottom()
  })
}, { deep: true })

onMounted(() => {
  connect()
  loadFAQs()
})

cleanup.add(disconnect)
cleanup.add(() => {
  if (typingTimeout.value) {
    clearTimeout(typingTimeout.value)
  }
})
</script>

<style scoped lang="scss">
.customer-service-chat {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  overflow: hidden;
  position: relative;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: var(--unified-border-bottom);
  background: var(--el-bg-color-page);

  .header-info {
    display: flex;
    align-items: center;
    gap: 12px;

    .service-icon {
      font-size: 24px;
      color: var(--el-color-primary);
    }

    .header-text {
      h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: var(--el-text-color-primary);
      }

      .connection-status {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        margin-top: 4px;

        &.connected {
          color: var(--el-color-success);
        }

        &.connecting,
        &.reconnecting {
          color: var(--el-color-warning);
        }

        &.disconnected,
        &.error {
          color: var(--el-color-danger);
        }
      }
    }
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }
}

.faqs-sidebar {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 300px;
  background: var(--el-bg-color-page);
  border-left: var(--unified-border);
  z-index: calc(var(--z-base) + 9);
  display: flex;
  flex-direction: column;

  .faqs-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border-bottom: var(--unified-border-bottom);

    h4 {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
    }
  }

  .faqs-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;

    .faq-item {
      padding: 12px;
      margin-bottom: 8px;
      background: var(--el-bg-color);
      border-radius: var(--global-border-radius);
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        background: var(--el-fill-color-light);
      }

      .faq-question {
        font-size: 14px;
        font-weight: 600;
        color: var(--el-text-color-primary);
        margin-bottom: 4px;
      }

      .faq-answer {
        font-size: 12px;
        color: var(--el-text-color-secondary);
        line-height: 1.5;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
    }
  }
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--el-text-color-placeholder);

    .empty-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }
  }

  .message-item {
    display: flex;
    gap: 12px;

    &.message-user {
      flex-direction: row-reverse;

      .message-content {
        align-items: flex-end;

        .message-body {
          background: var(--el-color-primary);
          color: var(--app-button-text-on-primary);
        }
      }
    }

    &.message-staff {
      .message-content {
        align-items: flex-start;

        .message-body {
          background: var(--el-fill-color-light);
        }
      }
    }

    &.message-system {
      justify-content: center;

      .message-content {
        .message-body {
          background: transparent;
          color: var(--el-text-color-secondary);
          font-size: 12px;
        }
      }
    }

    .message-avatar {
      flex-shrink: 0;
    }

    .message-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      max-width: 70%;

      .message-header {
        display: flex;
        gap: 8px;
        margin-bottom: 4px;
        font-size: 12px;

        .message-sender {
          font-weight: 600;
          color: var(--el-text-color-primary);
        }

        .message-time {
          color: var(--el-text-color-placeholder);
        }
      }

      .message-body {
        padding: 10px 14px;
        border-radius: var(--global-border-radius);
        word-wrap: break-word;

        .message-text {
          line-height: 1.5;
        }

        .message-image {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;

          .image-item {
            width: 200px;
            height: 200px;
            border-radius: var(--global-border-radius);
            cursor: pointer;
          }
        }

        .message-file {
          display: flex;
          flex-direction: column;
          gap: 8px;

          .file-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px;
            background: var(--color-white-10);
            border-radius: var(--global-border-radius);

            .file-link {
              color: inherit;
              text-decoration: none;
              flex: 1;
            }

            .file-size {
              font-size: 12px;
              opacity: 0.8;
            }
          }
        }
      }

      .message-status {
        margin-top: 4px;
        font-size: 12px;
        color: var(--el-text-color-placeholder);
      }
    }
  }

  .typing-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    color: var(--el-text-color-secondary);
    font-size: 12px;

    .typing-dots {
      display: flex;
      gap: 4px;

      span {
        width: 6px;
        height: 6px;
        border-radius: var(--global-border-radius);
        background: var(--el-text-color-placeholder);
        animation: typing 1.4s infinite;

        &:nth-child(2) {
          animation-delay: 0.2s;
        }

        &:nth-child(3) {
          animation-delay: 0.4s;
        }
      }
    }
  }
}

@keyframes typing {
  0%,
  60%,
  100% {
    transform: translateY(0);
    opacity: 0.7;
  }

  30% {
    transform: translateY(-10px);
    opacity: 1;
  }
}

.chat-input-area {
  padding: 16px;
  border-top: var(--unified-border);
  background: var(--el-bg-color-page);

  .file-preview {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
    flex-wrap: wrap;

    .preview-item {
      position: relative;
      display: inline-block;

      .preview-image {
        width: 80px;
        height: 80px;
        border-radius: var(--global-border-radius);
      }

      .preview-file {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 8px;
        background: var(--el-fill-color-light);
        border-radius: var(--global-border-radius);
        font-size: 12px;
      }

      .el-button {
        position: absolute;
        top: -8px;
        right: -8px;
        background: var(--el-color-danger);
        color: var(--app-button-text-on-primary);
        border-radius: var(--global-border-radius);
        padding: 4px;
      }
    }
  }

  .input-wrapper {
    display: flex;
    gap: 8px;
    align-items: flex-end;
  }
}
</style>
