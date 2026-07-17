import { useEffect, useRef, useState } from 'react'
import { streamChat, fetchModels, type LlmModel } from '@ihui/api-client'
import { initApi, getToken } from '../../lib/token'
import { useI18n } from '../../src/i18n'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const FALLBACK_MODELS: LlmModel[] = [
  { id: 'stepfun/step-3.7-flash', name: 'Step 3.7 Flash', provider: 'stepfun', context_length: 8192, input_price: 0 },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o mini', provider: 'openai', context_length: 128000, input_price: 0 },
  { id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku', provider: 'anthropic', context_length: 200000, input_price: 0 },
]

export default function App() {
  const { t } = useI18n()
  const [ready, setReady] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')
  const [models, setModels] = useState<LlmModel[]>(FALLBACK_MODELS)
  const [model, setModel] = useState<string>(FALLBACK_MODELS[0]!.id)
  const abortRef = useRef<AbortController | null>(null)
  const idCounter = useRef(0)
  const nextId = () => `msg-${++idCounter.current}`

  useEffect(() => {
    initApi().then(() => setReady(true))
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchModels()
      .then((res) => {
        if (cancelled) return
        const list = res?.models?.length ? res.models : FALLBACK_MODELS
        setModels(list)
        const def = res.default && list.some((m) => m.id === res.default) ? res.default : list[0]!.id
        setModel(def)
      })
      .catch(() => {
        if (!cancelled) setModels(FALLBACK_MODELS)
      })
    return () => {
      cancelled = true
    }
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
        model,
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
        <select
          className="model-select"
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
