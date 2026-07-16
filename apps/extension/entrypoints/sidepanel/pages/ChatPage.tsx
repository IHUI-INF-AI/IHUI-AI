import { useEffect, useRef, useState } from 'react'
import { streamChat, type StreamChatOptions } from '@ihui/api-client'
import { useOutletContext } from 'react-router-dom'
import type { ChatMessage } from './types'

interface Ctx {
  onLogout: () => void
}

const MODEL = 'stepfun/step-3.7-flash'

export default function ChatPage() {
  const { onLogout } = useOutletContext<Ctx>()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  const onSend = async () => {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
    setError('')
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
      model: MODEL,
      messages: next
        .filter((m) => m.content || m.role === 'user')
        .map(({ role, content }) => ({ role, content: content || ' ' })),
      signal: controller.signal,
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
        setMessages((cur) => {
          const copy = [...cur]
          const last = copy[copy.length - 1]
          if (last?.role === 'assistant') {
            copy[copy.length - 1] = { ...last, content: last.content || `⚠ ${msg}` }
          }
          return copy
        })
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
      setError(err instanceof Error ? err.message : '请求失败')
      setStreaming(false)
    }
  }

  return (
    <div className="sp-chat">
      <div className="sp-page-header">
        <h3>AI 对话</h3>
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
