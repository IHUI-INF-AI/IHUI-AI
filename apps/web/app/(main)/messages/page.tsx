'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Send, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

import { fetchApi } from '@/lib/api'
import { Button, Input } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface ChatMessage {
  id: string
  conversationId: string
  senderId: string
  content: string
  createdAt: string
  isMine: boolean
}

interface Conversation {
  id: string
  peerId: string
  peerName: string
  peerAvatar: string | null
  lastMessage: string
  lastTime: string
  unread: number
  messages: ChatMessage[]
}

interface ListData {
  list: Conversation[]
  total: number
  page: number
  pageSize: number
}

interface SendResult {
  message: ChatMessage
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function relativeTime(iso: string, t: ReturnType<typeof useTranslations>): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 0) return t('justNow')
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return t('justNow')
  const min = Math.floor(sec / 60)
  if (min < 60) return t('minutesAgo', { min })
  const hr = Math.floor(min / 60)
  if (hr < 24) return t('hoursAgo', { hr })
  const day = Math.floor(hr / 24)
  if (day < 30) return t('daysAgo', { day })
  return new Date(iso).toLocaleDateString('zh-CN')
}

export default function MessagesPage() {
  const t = useTranslations('privateMessages')
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState('')
  const scrollRef = React.useRef<HTMLDivElement>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['messages', 'list'],
    queryFn: () => api<ListData>(`/api/messages/list?page=1&pageSize=20`),
  })

  const conversations = data?.list ?? []

  // 选中会话发生变化时，确保存在选中项
  React.useEffect(() => {
    if (!selectedId && conversations.length > 0) {
      setSelectedId(conversations[0]?.id ?? null)
    }
  }, [selectedId, conversations])

  // 选中会话切换或新消息到达时，滚动到底部
  React.useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [selectedId, conversations])

  const selected = conversations.find((c) => c.id === selectedId) ?? null

  const sendMut = useMutation({
    mutationFn: (input: { conversationId: string; content: string }) =>
      api<SendResult>(`/api/messages/send`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['messages', 'list'] })
      setDraft('')
      // 乐观滚动
      requestAnimationFrame(() => {
        const el = scrollRef.current
        if (el) el.scrollTop = el.scrollHeight
      })
      void res
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const handleSend = () => {
    const content = draft.trim()
    if (!content || !selected) return
    sendMut.mutate({ conversationId: selected.id, content })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <MessageSquare className="h-6 w-6 text-primary" />
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t('noConversations')}</p>
        </div>
      ) : (
        <div className="flex h-[calc(100vh-200px)] overflow-hidden rounded-lg border bg-card">
          {/* 左侧会话列表 */}
          <div className="flex w-80 shrink-0 flex-col border-r">
            <div className="border-b px-4 py-3">
              <p className="text-sm font-medium">{t('conversations')}</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {conversations.map((conv) => {
                const isActive = conv.id === selectedId
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => setSelectedId(conv.id)}
                    className={cn(
                      'flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors',
                      isActive ? 'bg-accent' : 'hover:bg-muted/50',
                    )}
                  >
                    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                      {conv.peerAvatar ? (
                        <img
                          src={conv.peerAvatar}
                          alt={conv.peerName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-medium text-muted-foreground">
                          {conv.peerName?.slice(0, 1) ?? '?'}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium">{conv.peerName}</p>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {conv.lastTime ? relativeTime(conv.lastTime, t) : ''}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs text-muted-foreground">
                          {conv.lastMessage || t('noMessages')}
                        </p>
                        {conv.unread > 0 && (
                          <span className="shrink-0 rounded-full bg-red-500 px-1.5 text-xs text-white">
                            {conv.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 右侧聊天区域 */}
          <div className="flex flex-1 flex-col">
            {selected ? (
              <>
                <div className="flex items-center gap-2 border-b px-4 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                    {selected.peerAvatar ? (
                      <img
                        src={selected.peerAvatar}
                        alt={selected.peerName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-medium text-muted-foreground">
                        {selected.peerName?.slice(0, 1) ?? '?'}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-sm font-medium">{selected.peerName}</p>
                </div>

                {/* 消息气泡列表 */}
                <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
                  {(selected.messages ?? []).length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      {t('noMessagesHint')}
                    </div>
                  ) : (
                    selected.messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={cn('flex', msg.isMine ? 'justify-end' : 'justify-start')}
                      >
                        <div
                          className={cn(
                            'max-w-[70%] rounded-2xl px-3 py-2 text-sm',
                            msg.isMine ? 'bg-primary text-primary-foreground' : 'bg-muted',
                          )}
                        >
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          <p
                            className={cn(
                              'mt-1 text-right text-xs',
                              msg.isMine ? 'text-primary-foreground/70' : 'text-muted-foreground',
                            )}
                          >
                            {msg.createdAt ? relativeTime(msg.createdAt, t) : ''}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* 输入区域 */}
                <div className="flex items-center gap-2 border-t p-3">
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t('input.placeholder')}
                    disabled={sendMut.isPending}
                    maxLength={1000}
                  />
                  <Button
                    type="button"
                    size="icon"
                    onClick={handleSend}
                    disabled={sendMut.isPending || !draft.trim()}
                  >
                    {sendMut.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                {t('selectHint')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
