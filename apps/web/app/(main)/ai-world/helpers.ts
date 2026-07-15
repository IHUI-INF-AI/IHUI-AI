import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import type { AiWorldData } from './types'

export async function fetchAiWorld(): Promise<AiWorldData> {
  const res = await fetchApi<AiWorldData>('/api/ai-world')
  if (!res.success) throw new Error(res.error)
  return res.data
}

/**
 * SSE 流式对话事件回调。
 * onDelta 收到增量文本片段,onError 收到错误消息(连接/解析/上游错误)。
 * 返回 AbortController 用于外部中断流式请求。
 */
export interface StreamChatCallbacks {
  onDelta: (delta: string) => void
  onError: (message: string) => void
  onDone?: () => void
}

/**
 * 调用 /api/llm/complete/stream,逐 token 回调 onDelta。
 * 不做会话持久化(ai-world 页面是 demo 入口)。
 */
export function streamAiChat(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  callbacks: StreamChatCallbacks,
  options?: { model?: string },
): AbortController {
  const controller = new AbortController()
  const { token, user } = useAuthStore.getState()
  const userId = user?.id ?? ''

  void (async () => {
    try {
      const res = await fetch('/api/llm/complete/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages,
          stream: true,
          ...(options?.model ? { model: options.model } : {}),
          metadata: { userId, source: 'ai-world' },
        }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => '')
        callbacks.onError(errText || `请求失败(${res.status})`)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        let nl: number
        while ((nl = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, nl).replace(/\r$/, '')
          buffer = buffer.slice(nl + 1)
          // AI service SSE 格式:event: chunk \n data: {"content":"..."}
          // 仅处理 data: 行;event:/空行/注释自动跳过
          if (!line.startsWith('data:')) continue
          const payload = line.slice(5).replace(/^\s/, '')
          if (payload === '[DONE]') continue
          try {
            const json = JSON.parse(payload) as {
              type?: string
              message?: string
              content?: string
              error?: string
            }
            if (json.type === 'error' || json.error) {
              callbacks.onError(json.message ?? json.error ?? '上游错误')
              return
            }
            if (typeof json.content === 'string' && json.content) {
              callbacks.onDelta(json.content)
            }
          } catch {
            /* 忽略非 JSON 行 */
          }
        }
      }
      callbacks.onDone?.()
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      callbacks.onError(e instanceof Error ? e.message : '网络异常')
    }
  })()

  return controller
}
