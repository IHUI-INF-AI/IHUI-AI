import { ref, onUnmounted } from 'vue'
import { isUniApp } from '../utils/index'
import { useUser } from './useUser'

export type MessageType = 'text' | 'image' | 'audio' | 'system' | 'vip'

export interface ChatMessage {
  id: string
  type: MessageType
  content: string
  senderId: string
  senderName: string
  senderAvatar: string
  timestamp: number
  isSelf: boolean
  status?: 'sending' | 'sent' | 'failed'
}

const messages = ref<ChatMessage[]>([])
const isConnected = ref(false)
const isLoadingHistory = ref(false)
const hasMoreHistory = ref(true)

let ws: WebSocket | { onMessage: (cb: (res: { data: unknown }) => void) => void; onClose: (cb: () => void) => void; onError: (cb: () => void) => void; send: (options: { data: string }) => void; close: (options?: Record<string, unknown>) => void } | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let reconnectCount = 0
const MAX_RECONNECT = 5

export function useChat() {
  const { token } = useUser()

  function createMessageId(): string {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  }

  function isDuplicateMessage(newMsg: ChatMessage): boolean {
    return messages.value.some((m) => m.id === newMsg.id)
  }

  function sortMessages(msgs: ChatMessage[]): ChatMessage[] {
    return [...msgs].sort((a, b) => a.timestamp - b.timestamp)
  }

  function connect(wsUrl: string) {
    if (isUniApp()) {
      ws = uni.connectSocket({
        url: `${wsUrl}?token=${token.value}`,
        success: () => {},
        fail: () => handleDisconnect(),
      })
      ws.onMessage((res: { data: unknown }) => handleRawMessage(res.data as string | ArrayBuffer))
      ws.onClose(() => handleDisconnect())
      ws.onError(() => handleDisconnect())
      isConnected.value = true
    } else {
      ws = new WebSocket(`${wsUrl}?token=${token.value}`)
      ws.onopen = () => {
        isConnected.value = true
        reconnectCount = 0
      }
      ws.onmessage = (event: MessageEvent) => handleRawMessage(event.data)
      ws.onclose = () => handleDisconnect()
      ws.onerror = () => handleDisconnect()
    }
  }

  function handleRawMessage(raw: string | ArrayBuffer) {
    try {
      const data = typeof raw === 'string' ? JSON.parse(raw) : JSON.parse(raw.toString())
      const msg: ChatMessage = {
        id: data.id || createMessageId(),
        type: data.type || 'text',
        content: data.content,
        senderId: data.senderId,
        senderName: data.senderName,
        senderAvatar: data.senderAvatar,
        timestamp: data.timestamp || Date.now(),
        isSelf: data.senderId === 'self',
        status: 'sent',
      }
      if (!isDuplicateMessage(msg)) {
        messages.value.push(msg)
        messages.value = sortMessages(messages.value)
      }
    } catch {
      // ignore malformed messages
    }
  }

  function handleDisconnect() {
    isConnected.value = false
    if (reconnectCount < MAX_RECONNECT) {
      const delay = Math.min(1000 * Math.pow(2, reconnectCount), 30000)
      reconnectTimer = setTimeout(() => {
        reconnectCount++
      }, delay)
    }
  }

  function send(data: { type: MessageType; content: string }) {
    const msg: ChatMessage = {
      id: createMessageId(),
      type: data.type,
      content: data.content,
      senderId: 'self',
      senderName: '',
      senderAvatar: '',
      timestamp: Date.now(),
      isSelf: true,
      status: 'sending',
    }
    messages.value.push(msg)

    const payload = JSON.stringify({ type: data.type, content: data.content })
    if (ws) {
      if (isUniApp()) {
        (ws as { send: (options: { data: string }) => void }).send({ data: payload })
      } else {
        (ws as WebSocket).send(payload)
      }
    }

    const idx = messages.value.findIndex((m) => m.id === msg.id)
    if (idx !== -1) {
      messages.value[idx].status = 'sent'
    }
    return msg
  }

  async function loadHistory(page = 1, pageSize = 20) {
    if (isLoadingHistory.value) return
    isLoadingHistory.value = true
    try {
      const { request: req } = await import('../api/index')
      const res = await req({ url: `/api/chat/history?page=${page}&pageSize=${pageSize}`, method: 'GET' })
      const history: ChatMessage[] = (res.data || []).map((item: any) => ({
        id: item.id,
        type: item.type || 'text',
        content: item.content,
        senderId: item.senderId,
        senderName: item.senderName,
        senderAvatar: item.senderAvatar,
        timestamp: item.timestamp,
        isSelf: false,
      }))
      const merged = [...history, ...messages.value]
      messages.value = sortMessages(merged)
      hasMoreHistory.value = history.length === pageSize
    } finally {
      isLoadingHistory.value = false
    }
  }

  function disconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (ws) {
      if (isUniApp()) {
        (ws as { close: (options?: Record<string, unknown>) => void }).close({})
      } else {
        (ws as WebSocket).close()
      }
      ws = null
    }
    isConnected.value = false
  }

  function clearMessages() {
    messages.value = []
  }

  onUnmounted(() => {
    disconnect()
  })

  return {
    messages,
    isConnected,
    isLoadingHistory,
    hasMoreHistory,
    connect,
    disconnect,
    send,
    loadHistory,
    clearMessages,
  }
}
