'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { useChatStore } from '@/stores/chat'
import { useAuthStore } from '@/stores/auth'
import { createConversation, sendMessage as persistMessage } from '@/lib/chat-api'

/**
 * 解析单行 SSE / data-stream 文本，返回增量文本。
 * 兼容：
 *  - OpenAI 风格 SSE：`data: {"choices":[{"delta":{"content":"x"}}]}` / `data: [DONE]`
 *  - Vercel AI SDK data-stream：`0:"x"`（type 0 = 文本 token）
 *  - 裸文本流（非 JSON）
 */
export function parseLine(line: string): string | null {
  if (!line) return null
  if (line.startsWith(':')) return null // SSE comment / heartbeat

  let data = line
  if (line.startsWith('data:')) {
    data = line.slice(5).replace(/^\s/, '')
  } else if (
    line.startsWith('event:') ||
    line.startsWith('id:') ||
    line.startsWith('retry:')
  ) {
    return null
  }

  if (data === '[DONE]') return null

  // Vercel AI SDK data-stream protocol: `TYPE:JSON`
  const proto = data.match(/^(\d+):(.*)$/s)
  const protoType = proto?.[1]
  const protoPayload = proto?.[2]
  if (proto && protoType && protoPayload) {
    try {
      const parsed = JSON.parse(protoPayload)
      if (protoType === '0' && typeof parsed === 'string') return parsed
      return null
    } catch {
      return null
    }
  }

  // JSON 负载
  try {
    const json = JSON.parse(data)
    // 检测 SSE error 事件(如 {"type":"error","message":"..."} 或 {"error":true,...})
    if (json?.type === 'error' && typeof json?.message === 'string') {
      throw new SSEError(json.message)
    }
    if (json?.error === true && typeof json?.error_message === 'string') {
      throw new SSEError(json.error_message)
    }
    const choice = json?.choices?.[0]
    if (choice) {
      const delta = choice.delta?.content ?? choice.message?.content ?? choice.text
      if (typeof delta === 'string') return delta
    }
    if (typeof json?.content === 'string') return json.content
    if (typeof json?.delta === 'string') return json.delta
    if (typeof json?.text === 'string') return json.text
    return null
  } catch (e) {
    // SSEError 向上抛出,由调用方捕获
    if (e instanceof SSEError) throw e
    // 非 JSON:当作裸文本(剥掉 data: 前缀后的内容)
    return data
  }
}

/** SSE 错误事件标记,由 parseLine 抛出,sendMessage 捕获 */
class SSEError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SSEError'
  }
}

export interface UseChatReturn {
  messages: ReturnType<typeof useChatStore.getState>['messages']
  currentModel: string
  isStreaming: boolean
  error: string | null
  sendMessage: (content: string) => Promise<void>
  stop: () => void
  clearMessages: () => void
  setModel: (model: string) => void
}

/** 后台持久化消息，失败仅打日志，不阻塞流式体验 */
async function persistMessageSafe(
  conversationId: string,
  content: string,
  role: 'user' | 'assistant',
) {
  const res = await persistMessage(conversationId, content, role)
  if (!res.success) {
    console.error(`[chat] persist ${role} message failed:`, res.error)
    // 用户可见提示(非阻塞 toast),让用户知道消息未保存到服务端
    toast.error('消息保存失败', {
      description: res.error || '网络异常,本次对话未被服务端记录',
    })
  }
}

export function useChat(): UseChatReturn {
  const messages = useChatStore((s) => s.messages)
  const currentModel = useChatStore((s) => s.currentModel)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const error = useChatStore((s) => s.error)

  const router = useRouter()
  const abortRef = React.useRef<AbortController | null>(null)

  const sendMessage = React.useCallback(async (content: string) => {
    const text = content.trim()
    if (!text) return

    const store = useChatStore.getState()
    if (store.isStreaming) return

    const model = store.currentModel

    // 1. 若无 conversationId，先创建会话并同步 URL
    let conversationId = store.conversationId
    if (!conversationId) {
      const createRes = await createConversation({ model })
      if (!createRes.success) {
        store.setError(createRes.error)
        return
      }
      conversationId = createRes.data.conversation.id
      store.setConversationId(conversationId)
      const sp = new URLSearchParams(window.location.search)
      sp.set('conversationId', conversationId)
      router.replace(`/chat?${sp.toString()}`, { scroll: false })
    }

    // 2. 持久化用户消息(后台 fire-and-forget,不阻塞流式响应)
    void persistMessageSafe(conversationId, text, 'user')

    const history = store.messages
      .filter((m) => !m.error && (m.role === 'user' || m.role === 'assistant') && m.content)
      .map((m) => ({ role: m.role, content: m.content }))

    store.addMessage({ role: 'user', content: text, model })
    const assistantId = store.addMessage({ role: 'assistant', content: '', model })

    store.setStreaming(true)
    store.setError(null)

    const controller = new AbortController()
    abortRef.current = controller

    // 首 token 超时:15s 内未收到任何内容则中止
    let firstTokenReceived = false
    const timeoutId = setTimeout(() => {
      if (!firstTokenReceived) {
        controller.abort()
      }
    }, 15000)

    const token = useAuthStore.getState().token
    // 从 auth store 获取 userId(用于回调链路关联)
    const userId = useAuthStore.getState().user?.id ?? ''

    try {
      const res = await fetch('/api/llm/complete/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          model,
          messages: [...history, { role: 'user', content: text }],
          stream: true,
          // 架构方案 A:传 metadata 启用回调链路
          // ai-service 推理完成后用 settings.api_service_url + /api/ai/callback 回调
          // → /api/ai/callback 入队 aiCallbackQueue → worker 持久化 assistant 消息
          // 前端不再 fire-and-forget 持久化 assistant,消除双写
          metadata: {
            conversationId,
            userId,
            messageId: assistantId, // 前端占位消息 ID,worker 会尝试 updateMessage
          },
        }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => '')
        throw new Error(errText || `请求失败（${res.status}）`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        firstTokenReceived = true
        buffer += decoder.decode(value, { stream: true })

        let nl: number
        while ((nl = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, nl).replace(/\r$/, '')
          buffer = buffer.slice(nl + 1)
          const delta = parseLine(line)
          if (delta) {
            useChatStore.getState().appendToMessage(assistantId, delta)
          }
        }
      }

      if (buffer.trim()) {
        const delta = parseLine(buffer)
        if (delta) {
          useChatStore.getState().appendToMessage(assistantId, delta)
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // 用户中断或首 token 超时,保留已生成内容
        if (!firstTokenReceived) {
          const msg = 'AI 响应超时(15 秒内未收到任何内容),请稍后重试'
          useChatStore.getState().setMessageError(assistantId, msg)
          useChatStore.getState().setError(msg)
        }
      } else if (err instanceof SSEError) {
        // AI service 返回的 SSE error 事件
        useChatStore.getState().setMessageError(assistantId, err.message)
        useChatStore.getState().setError(err.message)
      } else {
        const message = err instanceof Error ? err.message : '网络异常'
        useChatStore.getState().setMessageError(assistantId, message)
        useChatStore.getState().setError(message)
      }
    } finally {
      clearTimeout(timeoutId)
      abortRef.current = null
      useChatStore.getState().setStreaming(false)
      // 方案 A:assistant 消息由后端 callback worker 持久化(经 ai-callback → BullMQ → DB)
      // 前端不再 fire-and-forget 持久化 assistant,消除双写风险
      // 错误消息(error)也不持久化,仅停留在前端 UI
    }
  }, [router])

  const stop = React.useCallback(() => {
    abortRef.current?.abort()
  }, [])

  // 组件卸载时中止进行中的流式请求,避免后台僵尸请求
  React.useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const clearMessages = useChatStore((s) => s.clearMessages)
  const setModel = useChatStore((s) => s.setModel)

  return {
    messages,
    currentModel,
    isStreaming,
    error,
    sendMessage,
    stop,
    clearMessages,
    setModel,
  }
}
