/**
 * useChat — 跨端聊天消息管理业务 Hook
 *
 * 设计原则(参照 useAuth + useAgents):
 * 1. 纯逻辑层:只管 messages 列表 + streaming 状态 + error,hook 内部不调 streamChat
 * 2. 依赖注入:streamRunner 由各端注入(各端调 @ihui/api-client 的 streamChat 并桥接到本 hook)
 * 3. 零新依赖:纯 useState + useRef + useCallback
 * 4. 非破坏性:与各端现有 chat hook 平行存在
 *
 * 跨端差异处理:
 * - SSE 流:统一用 @ihui/api-client 的 streamChat(api-client 已封装跨端 SSE 解析)
 * - 错误格式化:各端注入 formatError(可选,默认 String(err))
 * - 消息持久化:各端在 onDone/onError 回调中自行调持久化 API
 *
 * 各端接入示例:
 * ```ts
 * import { useChat } from '@ihui/shared/hooks'
 * import { streamChat, formatSSEError } from '@ihui/api-client'
 *
 * const {
 *   messages, isStreaming, error,
 *   sendMessage, stopStreaming, clearMessages, setMessages,
 * } = useChat({
 *   streamRunner: async (opts) => {
 *     await streamChat({
 *       model: opts.model,
 *       messages: opts.apiMessages,
 *       signal: opts.signal,
 *       onDelta: opts.onDelta,
 *       onError: opts.onError,
 *       onDone: opts.onDone,
 *     })
 *   },
 *   formatError: (err) => formatSSEError(err).message,
 * })
 *
 * await sendMessage({ model, text: '你好' })
 * ```
 */
import * as React from 'react'

/**
 * 消息角色
 */
export type ChatRole = 'user' | 'assistant' | 'system'

/**
 * 聊天消息基础类型(各端可扩展)
 */
export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  /** 创建时间戳(ms),用于排序 + 分享 */
  createdAt?: number
  /** 附加元数据(各端自定义,如 model / agentId / tokens 等) */
  meta?: Record<string, unknown>
}

/**
 * sendMessage 参数
 */
export interface SendMessageParams {
  /** 模型 ID */
  model: string
  /** 用户输入文本 */
  text: string
  /** 可选 systemPrompt(智能体场景) */
  systemPrompt?: string
  /** 可选上下文 limit(各端调 getModelContextCapacity 注入) */
  contextLimit?: number
  /** 可选附加 meta(写入 user 消息的 meta 字段) */
  meta?: Record<string, unknown>
}

/**
 * streamRunner 的 API 消息格式(传给后端)
 */
export interface ApiChatMessage {
  role: ChatRole
  content: string
}

/**
 * streamRunner 回调集合
 */
export interface StreamRunnerCallbacks {
  /** 收到 delta 时追加到 assistant 消息 */
  onDelta: (delta: string) => void
  /** 流错误 */
  onError: (err: unknown) => void
  /** 流完成 */
  onDone: () => void
  /** 上下文压缩通知(各端按需实现,如 miniapp-taro 用 Taro.showToast) */
  onCompaction?: (info: { tokensBefore: number; tokensAfter: number; removedCount: number }) => void
}

/**
 * streamRunner 参数
 */
export interface StreamRunnerParams {
  model: string
  /** API 消息(含历史 + 当前用户消息,不含 assistant 占位) */
  apiMessages: ApiChatMessage[]
  /** AbortSignal(用于 stopStreaming) */
  signal: AbortSignal
  /** 上下文 limit(可选) */
  contextLimit?: number
  /** 回调集合 */
  callbacks: StreamRunnerCallbacks
}

/**
 * useChat 配置项
 */
export interface UseChatOptions {
  /** 流式发送函数(各端注入 streamChat 桥接) */
  streamRunner: (params: StreamRunnerParams) => Promise<void>
  /** 错误格式化(可选,默认 String(err)) */
  formatError?: (err: unknown) => string
  /** 是否在 onError 时自动清空 assistant 占位消息(默认 false,保留占位 + 填充错误信息) */
  clearAssistantOnError?: boolean
}

/**
 * useChat 返回值
 */
export interface UseChatReturn<TMessage extends ChatMessage = ChatMessage> {
  /** 消息列表 */
  messages: TMessage[]
  /** 是否正在流式响应 */
  isStreaming: boolean
  /** 错误信息(流错误时设置) */
  error: string | null
  /** 发送消息(自动添加 user + assistant 占位,启动流) */
  sendMessage: (params: SendMessageParams) => Promise<void>
  /** 停止流式(abort) */
  stopStreaming: () => void
  /** 清空所有消息 */
  clearMessages: () => void
  /** 手动设置 messages(各端持久化恢复 / 历史加载用) */
  setMessages: React.Dispatch<React.SetStateAction<TMessage[]>>
  /** 手动设置 error */
  setError: (err: string | null) => void
}

/**
 * useChat — 跨端聊天消息管理业务 Hook
 */
export function useChat<TMessage extends ChatMessage = ChatMessage>(
  options: UseChatOptions,
): UseChatReturn<TMessage> {
  const { streamRunner, formatError = (err) => String(err), clearAssistantOnError = false } = options

  const [messages, setMessages] = React.useState<TMessage[]>([])
  const [isStreaming, setIsStreaming] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // abort controller ref(stopStreaming 用)
  const abortRef = React.useRef<AbortController | null>(null)
  // 消息 id 自增 ref(避免使用 Date.now() 在快速连续发送时 id 冲突)
  const idCounterRef = React.useRef(0)
  const nextId = React.useCallback((prefix: 'u' | 'a' | 's') => {
    idCounterRef.current += 1
    return `${prefix}-${idCounterRef.current}`
  }, [])

  const sendMessage = React.useCallback(
    async (params: SendMessageParams) => {
      const { model, text, systemPrompt, contextLimit, meta } = params
      const trimmed = text.trim()
      if (!trimmed || isStreaming) return

      setError(null)

      // 构造 user 消息
      const userMsg = {
        id: nextId('u'),
        role: 'user' as const,
        content: trimmed,
        createdAt: Date.now(),
        meta,
      }
      // 构造 assistant 占位消息
      const assistantId = nextId('a')
      const assistantMsg = {
        id: assistantId,
        role: 'assistant' as const,
        content: '',
        createdAt: Date.now(),
      }

      // 更新消息列表(追加 user + assistant 占位)
      const baseMessages: TMessage[] = [...messages, userMsg, assistantMsg] as TMessage[]
      setMessages(baseMessages)
      setIsStreaming(true)

      // 构造 API 消息(含历史 + 当前 user 消息,不含 assistant 占位)
      const apiMessages: ApiChatMessage[] = baseMessages
        .filter((m) => m.id !== assistantId)
        .filter((m) => m.content || m.role === 'user')
        .map((m) => ({ role: m.role, content: m.content || ' ' }))

      // 可选 systemPrompt 注入到开头
      if (systemPrompt) {
        apiMessages.unshift({ role: 'system', content: systemPrompt })
      }

      // 创建 abort controller
      const controller = new AbortController()
      abortRef.current = controller

      // delta 累积到 assistant 消息
      const onDelta = (delta: string) => {
        setMessages((prev) => {
          const copy = [...prev]
          const last = copy[copy.length - 1]
          if (last && last.role === 'assistant') {
            copy[copy.length - 1] = {
              ...last,
              content: last.content + delta,
            } as TMessage
          }
          return copy
        })
      }

      const onError = (err: unknown) => {
        const msg = formatError(err)
        setError(msg)
        setIsStreaming(false)
        abortRef.current = null
        if (clearAssistantOnError) {
          // 清空 assistant 占位
          setMessages((prev) => prev.slice(0, -1))
        } else {
          // 保留占位,填充错误信息
          setMessages((prev) => {
            const copy = [...prev]
            const last = copy[copy.length - 1]
            if (last && last.role === 'assistant' && !last.content) {
              copy[copy.length - 1] = {
                ...last,
                content: `⚠ ${msg}`,
              } as TMessage
            }
            return copy
          })
        }
      }

      const onDone = () => {
        setIsStreaming(false)
        abortRef.current = null
      }

      try {
        await streamRunner({
          model,
          apiMessages,
          signal: controller.signal,
          contextLimit,
          callbacks: { onDelta, onError, onDone },
        })
      } catch (err) {
        // streamRunner 抛异常(非 SSE 内部错误,如网络断开)
        onError(err)
      }
    },
    [messages, isStreaming, streamRunner, formatError, clearAssistantOnError, nextId],
  )

  const stopStreaming = React.useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setIsStreaming(false)
  }, [])

  const clearMessages = React.useCallback(() => {
    setMessages([])
    setError(null)
    setIsStreaming(false)
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    stopStreaming,
    clearMessages,
    setMessages,
    setError,
  }
}
