'use client'

import * as React from 'react'
import { MessageCircle, Minus, X, Send, Loader2 } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { MessageBubble, type CsMessage } from './MessageBubble'
import { QuickReplies } from './QuickReplies'

type ConnStatus = 'online' | 'offline' | 'connecting'

interface Props {
  roomId?: string
  onClose?: () => void
}

const QUICK_REPLIES = ['你好，有什么可以帮您？', '请稍等，正在查询', '问题已收到', '感谢您的耐心']

export function ChatWindow({ roomId, onClose }: Props) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [isMinimized, setIsMinimized] = React.useState(false)
  const [messages, setMessages] = React.useState<CsMessage[]>([])
  const [input, setInput] = React.useState('')
  const [unread, setUnread] = React.useState(0)
  const [status, setStatus] = React.useState<ConnStatus>('connecting')
  const [sending, setSending] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const prevCount = React.useRef(0)

  const loadMessages = React.useCallback(async () => {
    const r = await fetchApi<CsMessage[]>(
      `/api/customer-service/messages${roomId ? `?roomId=${roomId}` : ''}`,
    )
    if (r.success && r.data) {
      setMessages(r.data)
      setStatus('online')
    } else {
      setStatus('offline')
    }
  }, [roomId])

  React.useEffect(() => {
    void loadMessages()
    const timer = setInterval(loadMessages, 5000)
    return () => clearInterval(timer)
  }, [loadMessages])

  React.useEffect(() => {
    if (messages.length > prevCount.current && (!isOpen || isMinimized)) {
      const newOnes = messages.slice(prevCount.current)
      if (newOnes.some((m) => m.sender === 'agent')) setUnread((u) => u + 1)
    }
    prevCount.current = messages.length
    if (isOpen && !isMinimized) {
      const el = scrollRef.current
      if (el) el.scrollTop = el.scrollHeight
    }
  }, [messages, isOpen, isMinimized])

  const handleOpen = () => {
    setIsOpen(true)
    setIsMinimized(false)
    setUnread(0)
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending) return
    setSending(true)
    const r = await fetchApi<CsMessage>('/api/customer-service/send', {
      method: 'POST',
      body: JSON.stringify({ roomId, content: text, type: 'text' }),
    })
    setSending(false)
    if (r.success && r.data) {
      setMessages((prev) => [...prev, r.data])
    }
    setInput('')
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void handleSend()
    }
  }

  const statusDot = cn(
    'h-2 w-2 rounded-full',
    status === 'online'
      ? 'bg-emerald-500'
      : status === 'connecting'
        ? 'bg-amber-500'
        : 'bg-red-500',
  )

  if (!isOpen || isMinimized) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
        aria-label="打开客服"
      >
        <MessageCircle className="h-6 w-6" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs text-white">
            {unread}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex h-[480px] w-[360px] flex-col overflow-hidden rounded-lg border bg-card shadow-xl">
      <div className="flex items-center justify-between border-b bg-primary px-4 py-3 text-primary-foreground">
        <div className="flex items-center gap-2">
          <span className={statusDot} />
          <span className="text-sm font-medium">在线客服</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(true)}
            className="rounded p-1 transition-colors hover:bg-white/10"
            aria-label="最小化"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              setIsOpen(false)
              onClose?.()
            }}
            className="rounded p-1 transition-colors hover:bg-white/10"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {status === 'connecting' ? <Loader2 className="h-5 w-5 animate-spin" /> : '暂无消息'}
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} isSelf={msg.sender === 'user'} />
          ))
        )}
      </div>

      <div className="border-t p-2">
        <div className="mb-2">
          <QuickReplies replies={QUICK_REPLIES} onSelect={setInput} />
        </div>
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter 发送，Shift+Enter 换行"
            rows={1}
            className="max-h-24 flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
              sending || !input.trim()
                ? 'cursor-not-allowed bg-muted text-muted-foreground/50'
                : 'bg-primary text-primary-foreground hover:bg-primary/90',
            )}
            aria-label="发送"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ChatWindow
