'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2, Star } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button } from '@ihui/ui'
import { ConversationList, type Conversation } from '@/components/chat/conversation-list'

async function fetchFavorites(): Promise<Conversation[]> {
  const res = await fetchApi<{ favorites: Conversation[] }>('/api/chat/favorites')
  if (!res.success) throw new Error(res.error)
  return res.data.favorites
}

export default function ChatFavoritesPage() {
  const t = useTranslations('chatHistory')
  const { data, isLoading, error } = useQuery({
    queryKey: ['chat', 'favorites'],
    queryFn: fetchFavorites,
  })

  const items = data ?? []

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Star className="h-6 w-6 text-primary" />
            {t('favoritesTitle')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('favoritesSubtitle')}</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/chat/history">{t('backToHistory')}</Link>
        </Button>
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
          <Star className="h-8 w-8 opacity-40" />
          <p className="text-sm">{t('favoritesEmpty')}</p>
        </div>
      ) : (
        <ConversationList items={items} />
      )}
    </div>
  )
}
