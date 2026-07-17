import { useEffect, useRef, useState } from 'react'
import { streamChat } from '@ihui/api-client'
import { initApi, getToken } from '../../lib/token'
import { useI18n } from '../../src/i18n'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const MODEL = 'stepfun/step-3.7-flash'

export default function App() {
  const { t } = useI18n()
  const [ready, setReady] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const idCounter = useRef(0)
  const nextId = () => `msg-${++idCounter.current}`

  useEffect(() => {
    initApi().then(() => setReady(true))
  }, [])

  const onSend = async () => {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
    setError('')

    const userMsg: ChatMessage = { id: nextId(), role: 'user', content: text }
    const aiMsg: ChatMessage = { id: nextId(), role: 'assistant', content: '' }
    const history = [...messages, userMsg]
    setMessages([...history, aiMsg])
    setStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      await streamChat({
        model: MODEL,
        messages: history.map((m) => ({ role: m.role, content: m.content })),
        signal: controller.signal,
        onDelta: (delta) => {
          setMessages((cur) => {
            const copy = [...cur]
            const last = copy[copy.length - 1]
            if (last?.role === 'assistant') {
              copy[copy.length - 1] = { ...last, content: last.content + delta }
            }
            return copy
          })
        },
        onError: (err) => {
          setError(err || t('chat.aiResponseFailed'))
        },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('chat.requestFailed'))
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  const onStop = () => {
    abortRef.current?.abort()
    setStreaming(false)
  }

  if (!ready) {
    return <div className="loading">{t('common.loading')}</div>
  }

  if (!getToken()) {
    return (
      <div className="not-logged-in">
        <p>{t('chat.loginRequired')}</p>
      </div>
    )
  }

  return (
    <div className="sidepanel-container">
      <header className="header">
        <h1>{t('chat.title')}</h1>
      </header>
      <div className="messages">
        {messages.length === 0 ? (
          <div className="empty">{t('chat.empty')}</div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`message ${m.role}`}>
              {m.content || (m.role === 'assistant' ? '...' : '')}
            </div>
          ))
        )}
        {error ? <div className="error">{error}</div> : null}
      </div>
      <div className="input-area">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('chat.inputPlaceholder')}
          className="input"
          disabled={streaming}
          rows={2}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onSend()
            }
          }}
        />
        {streaming ? (
          <button type="button" className="btn btn-stop" onClick={onStop}>
            {t('chat.stop')}
          </button>
        ) : (
          <button type="button" className="btn" onClick={onSend} disabled={!input.trim()}>
            {t('chat.send')}
          </button>
        )}
      </div>
    </div>
  )
}
