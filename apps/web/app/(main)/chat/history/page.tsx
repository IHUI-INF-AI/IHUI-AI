'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Clock, Loader2, Plus, Search, Star } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Input } from '@ihui/ui'
import { ConversationList, type Conversation } from '@/components/chat/conversation-list'

async function fetchConversations(): Promise<Conversation[]> {
  const res = await fetchApi<{ conversations: Conversation[] }>('/api/chat/conversations')
  if (!res.success) throw new Error(res.error)
  return res.data.conversations
}

export default function ChatHistoryPage() {
  const t = useTranslations('chatHistory')
  const router = useRouter()
  const [q, setQ] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['chat', 'conversations'],
    queryFn: fetchConversations,
  })

  const keyword = q.trim().toLowerCase()
  const items = (data ?? []).filter((c) => !keyword || c.title.toLowerCase().includes(keyword))

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Clock className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9" asChild title={t('viewFavorites')}>
            <Link href="/chat/favorites">
              <Star className="h-4 w-4" />
            </Link>
          </Button>
          <Button size="sm" onClick={() => router.push('/chat')}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t('newChat')}
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <div className="py-10 text-center text-destructive">{(error as Error).message}</div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
          <Clock className="h-8 w-8 opacity-40" />
          <p className="text-sm">{keyword ? t('noResults') : t('empty')}</p>
        </div>
      ) : (
        <ConversationList items={items} />
      )}
    </div>
  )
}
