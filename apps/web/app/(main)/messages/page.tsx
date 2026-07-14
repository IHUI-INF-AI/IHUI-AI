'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

import { useImWebSocket } from '@/hooks/use-im-websocket'
import { MessagesHeader } from './MessagesHeader'
import { MessagesList } from './MessagesList'
import { MessagesChat } from './MessagesChat'
import { api } from './helpers'
import type { ListData, SendResult, ReadResult, ChatMessage, Conversation } from './types'

export default function MessagesPage() {
  const t = useTranslations('privateMessages')
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState('')
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const [extraMessages, setExtraMessages] = React.useState<Record<string, ChatMessage[]>>({})
  const [readCleared, setReadCleared] = React.useState<Set<string>>(new Set())

  const { data, isLoading, error } = useQuery({
    queryKey: ['messages', 'list'],
    queryFn: () => api<ListData>(`/api/messages/list?page=1&pageSize=20`),
  })

  const conversations = React.useMemo(() => {
    const base = data?.list ?? []
    if (Object.keys(extraMessages).length === 0) return base
    return base.map((c) => {
      const extra = extraMessages[c.id]
      if (!extra || extra.length === 0) return c
      const existingIds = new Set(c.messages.map((m) => m.id))
      const merged = [...c.messages, ...extra.filter((m) => !existingIds.has(m.id))]
      return { ...c, messages: merged }
    })
  }, [data, extraMessages])

  React.useEffect(() => {
    if (!selectedId && conversations.length > 0) {
      setSelectedId(conversations[0]?.id ?? null)
    }
  }, [selectedId, conversations])

  React.useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [selectedId, conversations])

  const selected = conversations.find((c) => c.id === selectedId) ?? null

  const { lastMessage } = useImWebSocket()

  React.useEffect(() => {
    if (!lastMessage || !lastMessage.conversationId) return
    if (lastMessage.type === 'system') return
    const msg: ChatMessage = {
      id: lastMessage.id ?? Date.now().toString(),
      conversationId: lastMessage.conversationId,
      senderId: lastMessage.senderId ?? '',
      content: lastMessage.content,
      createdAt: lastMessage.createdAt ?? new Date().toISOString(),
      isMine: lastMessage.isMine ?? false,
    }
    setExtraMessages((prev) => {
      const arr = prev[msg.conversationId] ?? []
      if (arr.some((m) => m.id === msg.id)) return prev
      return { ...prev, [msg.conversationId]: [...arr, msg] }
    })
    qc.invalidateQueries({ queryKey: ['messages', 'list'] })
  }, [lastMessage, qc])

  const readMut = useMutation({
    mutationFn: (conversationId: string) =>
      api<ReadResult>(`/api/messages/${conversationId}/read`, { method: 'POST' }),
    onSuccess: (_res, conversationId) => {
      setReadCleared((prev) => new Set(prev).add(conversationId))
      qc.setQueryData<ListData>(['messages', 'list'], (old) => {
        if (!old) return old
        return {
          ...old,
          list: old.list.map((c) => (c.id === conversationId ? { ...c, unread: 0 } : c)),
        }
      })
    },
  })

  const handleSelect = React.useCallback(
    (id: string) => {
      setSelectedId(id)
      const conv = conversations.find((c) => c.id === id)
      if (conv && conv.unread > 0 && !readCleared.has(id)) {
        readMut.mutate(id)
      }
    },
    [conversations, readCleared, readMut],
  )

  const sendMut = useMutation({
    mutationFn: (input: { conversationId: string; content: string }) =>
      api<SendResult>(`/api/messages/send`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['messages', 'list'] })
      setDraft('')
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

  const loadMore = React.useCallback(async (conversationId: string, cursor: string) => {
    const res = await api<{ list: ChatMessage[]; hasMore: boolean; nextCursor: string | null }>(
      `/api/messages/${conversationId}/history?cursor=${encodeURIComponent(cursor)}&limit=20`,
    )
    setExtraMessages((prev) => {
      const arr = prev[conversationId] ?? []
      return { ...prev, [conversationId]: [...res.list, ...arr] }
    })
    return res
  }, [])

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <MessagesHeader />
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
          <MessagesList
            conversations={conversations as Conversation[]}
            selectedId={selectedId}
            onSelect={handleSelect}
          />
          <MessagesChat
            selected={selected}
            draft={draft}
            setDraft={setDraft}
            onSend={handleSend}
            onKeyDown={handleKeyDown}
            sendPending={sendMut.isPending}
            scrollRef={scrollRef}
            onLoadMore={loadMore}
          />
        </div>
      )}
    </div>
  )
}
