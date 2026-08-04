import { useEffect, useRef, useState } from 'react'
import {
  streamChat,
  fetchModels,
  formatSSEError,
  getModelContextCapacity,
  type StreamChatOptions,
  type LlmModel,
} from '@ihui/api-client'
import { formatTokenCount } from '@ihui/shared/utils'
import { FALLBACK_MODELS as SHARED_FALLBACK_MODELS } from '@ihui/shared'
import { Button, Input } from '@ihui/ui-react'
import { useOutletContext } from 'react-router-dom'
import { useI18n } from '../../../src/i18n'
import { VoiceInput } from '../components/VoiceInput'
import type { ChatMessage } from './types'

interface Ctx {
  onLogout: () => void
}

// 共享层兜底模型(FallbackModel:value/label/vendor)→ LlmModel 形态
// 2026-08-04 Phase E 收敛:13 个硬编码模型收敛到共享层 3 个(AGENTS.md §3)
const FALLBACK_MODELS: LlmModel[] = SHARED_FALLBACK_MODELS.map((m) => ({
  id: m.value,
  name: m.label,
  provider: m.vendor,
  context_length: 8192,
  input_price: 0,
}))

export default function ChatPage() {
  const { onLogout } = useOutletContext<Ctx>()
  const { t } = useI18n()
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
          t('chat.compactionNotice', {
            before: formatTokenCount(info.tokensBefore),
            after: formatTokenCount(info.tokensAfter),
            removed: info.removedCount,
          }),
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
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <h3 className="m-0 text-sm font-semibold">{t('chat.title')}</h3>
        <select
          className="text-xs text-foreground px-2 py-1 border border-border rounded-md bg-card cursor-pointer transition-colors hover:border-muted-foreground focus:outline-none focus:border-muted-foreground"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={streaming}
          aria-label={t('chat.selectModel')}
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name || m.id}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onLogout}
          className="bg-transparent border-none text-primary cursor-pointer text-xs px-1.5 py-0.5"
        >
          {t('chat.exit')}
        </Button>
      </div>
      <div
        className="flex-1 overflow-auto p-3 md:p-4 flex flex-col gap-2"
        ref={scrollRef}
        data-testid="chat-list"
      >
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8 px-4 text-sm">
            {t('chat.emptyHint')}
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col max-w-[85%] md:max-w-[75%] lg:max-w-[70%] ${m.role === 'user' ? 'self-end' : ''}`}
            >
              <div
                className={`px-2.5 py-2 rounded-lg text-sm whitespace-pre-wrap break-words leading-relaxed ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}
              >
                {m.content || (m.role === 'assistant' ? '...' : '')}
              </div>
            </div>
          ))
        )}
      </div>
      {notice ? (
        <div className="bg-primary/10 text-primary px-2.5 py-2 rounded-md border border-primary my-2 text-xs">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="bg-destructive/10 text-destructive px-2.5 py-2 rounded-md border border-destructive my-2 text-xs">
          {error}
        </div>
      ) : null}
      <form
        className="flex gap-1.5 px-2.5 py-2 border-t border-border bg-card"
        onSubmit={(e) => {
          e.preventDefault()
          void onSend()
        }}
      >
        <Input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('chat.inputPlaceholder')}
          disabled={streaming}
        />
        <VoiceInput
          onTranscript={(text) => {
            setInput((prev) => (prev && !prev.endsWith(' ') ? `${prev} ${text}` : `${prev}${text}`))
          }}
          disabled={streaming}
        />
        <Button type="submit" variant="send" size="sm" disabled={!input.trim() || streaming}>
          {t('chat.send')}
        </Button>
      </form>
    </div>
  )
}
