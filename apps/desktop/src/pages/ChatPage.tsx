import { useEffect, useState } from 'react'
import { streamChat, type StreamChatOptions } from '@ihui/api-client'
import type { ChatMessage } from '../lib/types'

const MODEL = 'stepfun/step-3.7-flash'

interface Props {
  onLogout: () => void
}

export default function ChatPage({ onLogout }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = 'IHUI AI 桌面端 - 对话'
  }, [])

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

  const onStop = () => setStreaming(false)

  const onClear = () => {
    if (streaming) return
    setMessages([])
    setError('')
  }

  return (
    <div className="chat-page">
      <header className="page-header">
        <h2>AI 对话</h2>
        <div className="header-actions">
          <span className="model-badge">{MODEL}</span>
          <button type="button" onClick={onClear} disabled={streaming || messages.length === 0}>
            清空
          </button>
          <button type="button" onClick={onLogout}>
            退出登录
          </button>
        </div>
      </header>

      <div className="chat-list" data-testid="chat-list">
        {messages.length === 0 ? (
          <div className="empty-state">输入消息开始对话</div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`chat-bubble ${m.role}`}>
              <span className="role">{m.role === 'user' ? '你' : 'AI'}</span>
              <div className="content">{m.content || (m.role === 'assistant' ? '...' : '')}</div>
            </div>
          ))
        )}
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <form
        className="chat-input"
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
          autoFocus
        />
        {streaming ? (
          <button type="button" onClick={onStop}>
            停止
          </button>
        ) : (
          <button type="submit" disabled={!input.trim()}>
            发送
          </button>
        )}
      </form>
    </div>
  )
}
