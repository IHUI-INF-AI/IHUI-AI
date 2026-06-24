<template>
  <div class="chat-page">
    <div class="chat-container">
      <!-- 顶部状态栏 -->
      <div class="chat-status-bar">
        <div class="status-info">
          <span class="status-dot" :class="wsStatusClass"></span>
          <span class="status-text">{{ statusText }}</span>
          <span v-if="aiModel" class="model-tag">{{ t('chat.model') }}: {{ aiModel }}</span>
        </div>
        <div class="chat-options">
          <select v-model="aiModel" class="model-select">
            <option value="qwen-turbo">{{ t('chat.qwenTurbo') }}</option>
            <option value="qwen-plus">{{ t('chat.qwenPlus') }}</option>
            <option value="qwen-max">{{ t('chat.qwenMax') }}</option>
            <option value="deepseek-v3">DeepSeek V3</option>
            <option value="mock">{{ t('chat.mockData') }}</option>
          </select>
        </div>
      </div>

      <!-- 消息列表 -->
      <div class="chat-messages" ref="messagesRef">
        <div v-for="msg in messages" :key="msg.id" class="message-item" :class="msg.role">
          <div class="message-avatar">
            <span>{{ msg.role === 'user' ? t('chat.me') : t('chat.ai') }}</span>
          </div>
          <div class="message-body">
            <div class="message-content">{{ msg.text }}<span v-if="msg.streaming" class="cursor-blink">▍</span></div>
            <div class="message-time">{{ formatTime(msg.time) }}</div>
          </div>
        </div>
        <div v-if="messages.length === 0" class="empty-messages">
          <p>{{ t('chat.startConversation') }}</p>
          <p class="hint">{{ t('chat.inputHint') }}</p>
        </div>
      </div>

      <!-- 输入区域 -->
      <div class="chat-input-area">
        <textarea
          v-model="inputText"
          class="chat-textarea"
          :placeholder="t('chat.ctrlEnterPlaceholder')"
          @keydown.ctrl.enter="sendMessage"
          @keydown.enter.exact.prevent="sendMessage"
          rows="3"
          :disabled="streaming"
        ></textarea>
        <div class="chat-actions">
          <button class="send-btn" :disabled="!canSend" @click="sendMessage">
            {{ streaming ? t('chat.generating') : t('chat.send') }}
          </button>
          <button class="clear-btn" @click="clearMessages">{{ t('common.clear') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { websocketService, type WebSocketStatus } from '@/utils/websocket'
import { useUserStore } from '@/stores/user'
import { logger } from '@/utils/logger'
import { usePagePerf } from '@/composables/usePagePerf'
import { ElMessage } from 'element-plus'

const userStore = useUserStore()
const roomName = ref('default-room')
const inputText = ref('')
const aiModel = ref('mock')
const messages = ref<Array<{ id: number; role: 'user' | 'ai'; text: string; time: number; streaming?: boolean }>>([])
const wsStatus = ref<WebSocketStatus>('disconnected')
const streaming = ref(false)
const messagesRef = ref<HTMLElement | null>(null)
let currentEventSource: EventSource | null = null
let mockInterval: ReturnType<typeof setInterval> | null = null
// 流式状态关闭定时器
let streamingTimer: ReturnType<typeof setTimeout> | null = null
// 消息唯一 id 生成器
let msgIdSeq = 0
const nextMsgId = () => ++msgIdSeq

const wsStatusClass = computed(() => {
  return {
    connected: 'status-connected',
    connecting: 'status-connecting',
    disconnected: 'status-disconnected',
    error: 'status-error',
  }[wsStatus.value]
})

const statusText = computed(() => {
  return {
    connected: t('chat.connected'),
    connecting: t('chat.connecting'),
    disconnected: t('chat.disconnected'),
    error: t('chat.connectionError'),
  }[wsStatus.value]
})

const canSend = computed(() => {
  return !streaming.value && inputText.value.trim().length > 0
})

function formatTime(ts: number) {
  const d = new Date(ts)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`
}

function getWsUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host
  return `${protocol}//${host}/ws/chat/${roomName.value}`
}

function connectWs() {
  if (wsStatus.value === 'connected') return
  const url = getWsUrl()
  const token = userStore?.token || ''
  websocketService.connect(url, token).catch((err) => {
    logger.warn('[Chat] WebSocket connection failed, using SSE mode only:', err)
  })
}

// 调用后端 SSE 流式接口
async function streamFromSSE(text: string) {
  return new Promise<void>((resolve) => {
    // 关闭之前的流
    if (currentEventSource) {
      currentEventSource.close()
      currentEventSource = null
    }

    const aiMsgId = nextMsgId()
    messages.value.push({ id: aiMsgId, role: 'ai', text: '', time: Date.now(), streaming: true })

    const apiBase = (import.meta as any).env?.VITE_API_BASE || ''
    // 2026-06-24 修复: 后端 qwen SSE 端点注册在 prefix=/chat 下, 路由 /chat/stream, 完整路径 /api/v1/chat/chat/stream
    const url = `${apiBase}/api/v1/chat/chat/stream?message=${encodeURIComponent(text)}&model=${encodeURIComponent(aiModel.value)}`

    // 通过 id 定位消息，避免清空后索引错乱
    const getAiMsg = () => messages.value.find(m => m.id === aiMsgId)
    const updateAiMsg = (patch: (msg: { text: string; streaming?: boolean }) => void) => {
      const msg = getAiMsg()
      if (msg) patch(msg)
    }

    // EventSource 不支持 POST, 改用 fetch + ReadableStream
    streamAbortController = new AbortController()
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userStore?.token || ''}`,
      },
      body: JSON.stringify({ message: text, model: aiModel.value }),
      signal: streamAbortController.signal,
    }).then(async (resp) => {
      if (!resp.ok || !resp.body) {
        throw new Error(`HTTP ${resp.status}`)
      }
      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        // 解析 SSE 格式
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (line.startsWith('data:')) {
            const data = line.slice(5).trim()
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              const delta = extractText(parsed)
              if (delta) {
                updateAiMsg(m => { m.text += delta })
                scrollToBottom()
              }
            } catch (_e) {
              // 非 JSON 数据, 当作文本追加
              if (data) {
                updateAiMsg(m => { m.text += data })
                scrollToBottom()
              }
            }
          }
        }
      }
    }).catch((err) => {
      if (err instanceof Error && err.name === 'AbortError') return
      logger.error('[Chat] SSE streaming error:', err)
      // 失败时使用模拟数据（仅当消息仍存在时）
      if (getAiMsg()) {
        streamMockResponse(text, aiMsgId)
      }
    }).finally(() => {
      // 消息可能已被清空，需做存在性判断
      updateAiMsg(m => { m.streaming = false })
      streaming.value = false
      scrollToBottom()
      resolve()
    })
  })
}

function extractText(parsed: any): string {
  if (typeof parsed === 'string') return parsed
  if (parsed.output?.text) return parsed.output.text
  if (parsed.output?.choices?.[0]?.message?.content) {
    const c = parsed.output.choices[0].message.content
    if (Array.isArray(c)) return c.map((x: any) => x.text || '').join('')
    return c
  }
  if (parsed.choices?.[0]?.delta?.content) return parsed.choices[0].delta.content
  if (parsed.text) return parsed.text
  if (parsed.content) return parsed.content
  if (parsed.delta?.content) return parsed.delta.content
  return ''
}

// 模拟数据流式输出 (后端不可用时)
function streamMockResponse(userText: string, msgId: number) {
  const responses = [
    `收到你的消息: "${userText}"\n\n这是一个模拟回复, 因为后端 LLM 服务暂未配置。`,
    `你好! 我是 AI 助手。当前选择模型: ${aiModel.value}。\n\n你可以问我任何问题。`,
    `让我分析一下你的问题... (模拟输出)\n\n要点:\n1. 这是第一条\n2. 这是第二条\n3. 这是第三条`,
  ]
  const fullText = responses[Math.floor(Math.random() * responses.length)]
  let idx = 0
  if (mockInterval) clearInterval(mockInterval)
  mockInterval = setInterval(() => {
    // 通过 id 定位消息，避免清空后索引错乱
    const msg = messages.value.find(m => m.id === msgId)
    if (!msg) {
      // 消息已被清空，停止定时器
      if (mockInterval) {
        clearInterval(mockInterval)
        mockInterval = null
      }
      return
    }
    if (idx >= fullText.length) {
      if (mockInterval) {
        clearInterval(mockInterval)
        mockInterval = null
      }
      return
    }
    msg.text += fullText[idx]
    idx++
    scrollToBottom()
  }, 30)
}

async function sendMessage() {
  if (!canSend.value) return
  const text = inputText.value.trim()
  messages.value.push({ id: nextMsgId(), role: 'user', text, time: Date.now() })
  inputText.value = ''
  streaming.value = true
  scrollToBottom()

  if (aiModel.value === 'mock') {
    // 模拟流式输出
    const aiMsgId = nextMsgId()
    messages.value.push({ id: aiMsgId, role: 'ai', text: '', time: Date.now(), streaming: true })
    streamMockResponse(text, aiMsgId)
    if (streamingTimer !== null) clearTimeout(streamingTimer)
    streamingTimer = setTimeout(() => {
      const msg = messages.value.find(m => m.id === aiMsgId)
      if (msg) msg.streaming = false
      streaming.value = false
    }, 3000)
  } else {
    // 调用真实 SSE 流式接口
    try {
      await streamFromSSE(text)
    } catch (e) {
      logger.error('[Chat] 消息发送失败', e)
      ElMessage.error(t('common.errors.messageSendFailed'))
    }
  }
}

// 清空消息：同时中止进行中的流式请求与定时器，避免回调访问已清空的数组
function clearMessages() {
  // 中止 SSE 流式请求
  streamAbortController?.abort()
  streamAbortController = null
  // 关闭 EventSource
  if (currentEventSource) {
    currentEventSource.close()
    currentEventSource = null
  }
  // 清理模拟流式定时器
  if (mockInterval) {
    clearInterval(mockInterval)
    mockInterval = null
  }
  // 清理流式状态关闭定时器
  if (streamingTimer !== null) {
    clearTimeout(streamingTimer)
    streamingTimer = null
  }
  messages.value = []
  streaming.value = false
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesRef.value) {
      messagesRef.value.scrollTop = messagesRef.value.scrollHeight
    }
  })
}

let unsubStatus: (() => void) | null = null

usePagePerf('Chat')

onMounted(() => {
  unsubStatus = websocketService.onStatusChange((status) => {
    wsStatus.value = status
  })
  connectWs()
})

// 流式请求的 AbortController
let streamAbortController: AbortController | null = null

// 统一清理：组件卸载时自动执行所有注册的清理函数
const cleanup = useCleanup()
cleanup.add(() => { streamAbortController?.abort(); streamAbortController = null })
cleanup.add(() => { if (unsubStatus) unsubStatus() })
cleanup.add(() => websocketService.disconnect())
cleanup.add(() => {
  if (currentEventSource) {
    currentEventSource.close()
    currentEventSource = null
  }
})
cleanup.add(() => { if (mockInterval) { clearInterval(mockInterval); mockInterval = null } })
cleanup.add(() => { if (streamingTimer !== null) { clearTimeout(streamingTimer); streamingTimer = null } })
</script>

<style scoped>
.chat-page {
  min-height: 100vh;
  background: var(--el-bg-color-page);
  padding: 24px;
  color: var(--el-text-color-primary);
}

.chat-container {
  max-width: 900px;
  margin: 0 auto;
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  display: flex;
  flex-direction: column;
  height: calc(100vh - 48px);
  overflow: hidden;
}

.chat-status-bar {
  padding: 12px 16px;
  background: var(--el-bg-color-overlay);
  border-bottom: var(--unified-border-bottom);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.status-info { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

.status-dot {
  width: 10px; height: 10px; border-radius: 50%;
  display: inline-block;
}
.status-connected { background: var(--el-color-success); box-shadow: none; }
.status-connecting { background: var(--el-color-warning); box-shadow: none; }
.status-disconnected { background: var(--el-text-color-secondary); }
.status-error { background: var(--el-color-danger); box-shadow: none; }
.status-text { font-size: 14px; color: var(--el-text-color-secondary); }

.model-tag {
  font-size: 11px;
  color: var(--el-color-primary-light-5);
  background: var(--el-color-primary-light-9);
  padding: 2px 8px;
  border-radius: var(--global-border-radius);
}
.chat-options { display: flex; align-items: center; gap: 8px; }

.model-select {
  background: var(--el-bg-color-overlay);
  border: var(--unified-border);
  color: var(--el-text-color-primary);
  padding: 4px 8px;
  border-radius: var(--global-border-radius);
  font-size: 13px;
  cursor: pointer;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message-item {
  display: flex;
  gap: 12px;
  max-width: 75%;
}
.message-item.user { align-self: flex-end; flex-direction: row-reverse; }

.message-avatar {
  width: 36px; height: 36px;
  border-radius: 50%;
  background: var(--el-color-primary);
  color: var(--el-color-white);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  flex-shrink: 0;
}

html.dark .message-avatar {
  color: var(--color-dark-bg-1);
}
.message-item.ai .message-avatar { background: var(--el-color-success); }
.message-body { display: flex; flex-direction: column; gap: 4px; }

.message-content {
  padding: 10px 14px;
  background: var(--el-border-color);
  border-radius: var(--global-border-radius);
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
.message-item.user .message-content { background: var(--el-color-primary); }

.cursor-blink {
  display: inline-block;
  animation: blink 1s infinite;
  color: var(--el-text-color-secondary);
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
.message-time { font-size: 11px; color: var(--el-text-color-secondary); padding: 0 4px; }

.empty-messages {
  margin: auto;
  color: var(--el-text-color-secondary);
  text-align: center;
  font-size: 14px;
}
.empty-messages .hint { font-size: 12px; color: var(--el-text-color-placeholder); margin-top: 8px; }

.chat-input-area {
  border-top: var(--unified-border);
  padding: 12px;
  background: var(--el-bg-color-overlay);
}

.chat-textarea {
  width: 100%;
  background: var(--el-bg-color-overlay);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  color: var(--el-text-color-primary);
  padding: 8px 10px;
  font-size: 14px;
  resize: vertical;
  font-family: inherit;
  box-sizing: border-box;
}
.chat-textarea:focus { outline: none; border-color: var(--el-color-primary); }
.chat-textarea:disabled { opacity: 0.5; }

.chat-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

.send-btn, .clear-btn {
  padding: 6px 18px;
  border: none;
  border-radius: var(--global-border-radius);
  cursor: pointer;
  font-size: 13px;
}
.send-btn { background: var(--el-color-primary); color: var(--el-color-white); }
html.dark .send-btn { color: var(--color-dark-bg-1); }
.send-btn:disabled { background: var(--el-fill-color-dark); cursor: not-allowed; }
.send-btn:hover:not(:disabled) { background: var(--el-color-primary); }
.clear-btn { background: var(--el-fill-color-dark); color: var(--el-text-color-primary); }
.clear-btn:hover { background: var(--el-fill-color-darker); }
</style>
