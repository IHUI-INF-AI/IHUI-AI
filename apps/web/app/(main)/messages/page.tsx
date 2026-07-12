'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

import { MessagesHeader } from './MessagesHeader'
import { MessagesList } from './MessagesList'
import { MessagesChat } from './MessagesChat'
import { api } from './helpers'
import type { ListData, SendResult } from './types'

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

  const conversations = React.useMemo(() => data?.list ?? [], [data])

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
            conversations={conversations}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          <MessagesChat
            selected={selected}
            draft={draft}
            setDraft={setDraft}
            onSend={handleSend}
            onKeyDown={handleKeyDown}
            sendPending={sendMut.isPending}
            scrollRef={scrollRef}
          />
        </div>
      )}
    </div>
  )
}
