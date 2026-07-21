import { useEffect, useRef, useState } from 'react'
import {
  streamChat,
  fetchModels,
  formatSSEError,
  getModelContextCapacity,
  formatTokenCount,
  type StreamChatOptions,
  type LlmModel,
} from '@ihui/api-client'
import { useOutletContext } from 'react-router-dom'
import type { ChatMessage } from './types'

interface Ctx {
  onLogout: () => void
}

const FALLBACK_MODELS: LlmModel[] = [
  {
    id: 'stepfun/step-3.7-flash',
    name: 'Step 3.7 Flash',
    provider: 'stepfun',
    context_length: 8192,
    input_price: 0,
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o mini',
    provider: 'openai',
    context_length: 128000,
    input_price: 0,
  },
  {
    id: 'anthropic/claude-3.5-haiku',
    name: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    context_length: 200000,
    input_price: 0,
  },
]

export default function ChatPage() {
  const { onLogout } = useOutletContext<Ctx>()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')
  const [models, setModels] = useState<LlmModel[]>(FALLBACK_MODELS)
  const [model, setModel] = useState<string>(FALLBACK_MODELS[0]!.id)
  const [notice, setNotice] = useState('')
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchModels()
      .then((res) => {
        if (cancelled) return
        const list = res?.models?.length ? res.models : FALLBACK_MODELS
        setModels(list)
        const def =
          res.default && list.some((m) => m.id === res.default) ? res.default : list[0]!.id
        setModel(def)
      })
      .catch(() => {
        if (!cancelled) setModels(FALLBACK_MODELS)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  const onSend = async () => {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
    setError('')
    setNotice('')
    const next: ChatMessage[] = [
      ...messages,
      { id: `u-${Date.now()}`, role: 'user', content: text },
      { id: `a-${Date.now()}`, role: 'assistant', content: '' },
    ]
    setMessages(next)
    setStreaming(true)

    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), 15_000)

    const opts: StreamChatOptions = {
      model,
      messages: next
        .filter((m) => m.content || m.role === 'user')
        .map(({ role, content }) => ({ role, content: content || ' ' })),
      signal: controller.signal,
      // 跨端统一 88% 阈值自动压缩:从模型 ID 推断 contextLimit,后端压缩后通过 SSE 回调提示用户
      contextLimit: getModelContextCapacity(model),
      onCompaction: (info) => {
        setNotice(
          `上下文已自动压缩:${formatTokenCount(info.tokensBefore)} → ${formatTokenCount(info.tokensAfter)}(移除 ${info.removedCount} 条历史)`,
        )
      },
      onDelta: (delta) => {
        window.clearTimeout(timeoutId)
        setMessages((cur) => {
          const copy = [...cur]
          const last = copy[copy.length - 1]
          if (last?.role === 'assistant') {
            copy[copy.length - 1] = { ...last, content: last.content + delta }
          }
          return copy
        })
      },
      onError: (msg) => {
        window.clearTimeout(timeoutId)
        const formatted = formatSSEError(new Error(msg))
        setMessages((cur) => {
          const copy = [...cur]
          const last = copy[copy.length - 1]
          if (last?.role === 'assistant') {
            copy[copy.length - 1] = {
              ...last,
              content: last.content || `⚠ ${formatted.title}: ${formatted.message}`,
            }
          }
          return copy
        })
        setError(formatted.message)
        setStreaming(false)
      },
      onDone: () => {
        window.clearTimeout(timeoutId)
        setStreaming(false)
      },
    }
    try {
      await streamChat(opts)
    } catch (err) {
      window.clearTimeout(timeoutId)
      const formatted = formatSSEError(err)
      setError(formatted.message)
      setStreaming(false)
    }
  }

  return (
    <div className="sp-chat">
      <div className="sp-page-header">
        <h3>AI 对话</h3>
        <select
          className="sp-model-select"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={streaming}
          aria-label="选择模型"
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name || m.id}
            </option>
          ))}
        </select>
        <button type="button" onClick={onLogout} className="link-btn">
          退出
        </button>
      </div>
      <div className="sp-chat-list" ref={scrollRef} data-testid="chat-list">
        {messages.length === 0 ? (
          <div className="empty-state">输入消息开始对话</div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`sp-bubble ${m.role}`}>
              <div className="sp-bubble-content">
                {m.content || (m.role === 'assistant' ? '...' : '')}
              </div>
            </div>
          ))
        )}
      </div>
      {notice ? <div className="notice-banner">{notice}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}
      <form
        className="sp-chat-input"
        onSubmit={(e) => {
          e.preventDefault()
          void onSend()
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="说点什么..."
          disabled={streaming}
        />
        <button type="submit" disabled={!input.trim() || streaming}>
          发送
        </button>
      </form>
    </div>
  )
}
