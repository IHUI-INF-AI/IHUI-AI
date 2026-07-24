'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Users, UserPlus, UserMinus, Loader2 } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { UserCard } from '@/components/business'

interface FollowUser {
  id: string
  userId: string
  nickname: string | null
  avatar: string | null
  createdAt: string
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function FollowingContent() {
  const t = useTranslations('follows')
  const router = useRouter()
  const qc = useQueryClient()
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') === 'followers' ? 'followers' : 'following'
  const [tab, setTab] = React.useState<'following' | 'followers'>(initialTab)

  const { data, isLoading, error } = useQuery({
    queryKey: ['follows', tab],
    queryFn: () =>
      api<{ list: FollowUser[] }>(`/api/follows/${tab}?pageSize=100`).then((d) => d.list ?? []),
  })

  const { data: myFollowing } = useQuery({
    queryKey: ['follows', 'following'],
    queryFn: () =>
      api<{ list: FollowUser[] }>(`/api/follows/following?pageSize=100`).then((d) => d.list ?? []),
  })

  const followedIds = React.useMemo(
    () => new Set((myFollowing ?? []).map((u) => u.userId)),
    [myFollowing],
  )

  const followMut = useMutation({
    mutationFn: (userId: string) => api(`/api/follows/${userId}`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['follows'] }),
  })

  const unfollowMut = useMutation({
    mutationFn: (userId: string) => api(`/api/follows/${userId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['follows'] }),
  })

  const items = data ?? []

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Users className="h-6 w-6 text-primary" />
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-1">
        {(['following', 'followers'] as const).map((value) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t(`tabs.${value}`)}
          </button>
        ))}
      </div>

      <div key={tab} className="animate-in fade-in-0 duration-200">
        {isLoading ? (
          <div className="py-10 text-center text-muted-foreground">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
            {t('loading')}
          </div>
        ) : error ? (
          <div className="py-10 text-center text-destructive">{(error as Error).message}</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
            {tab === 'following' ? (
              <UserPlus className="h-8 w-8 opacity-40" />
            ) : (
              <UserMinus className="h-8 w-8 opacity-40" />
            )}
            <p className="text-sm">{t(`empty.${tab}`)}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((u) => {
              const isFollowing = followedIds.has(u.userId)
              return (
                <UserCard
                  key={u.id}
                  avatar={u.avatar ?? undefined}
                  name={u.nickname || 'User'}
                  followed={isFollowing}
                  onFollow={() => (isFollowing ? unfollowMut : followMut).mutate(u.userId)}
                  onClick={() => router.push(`/user/${u.userId}`)}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default function FollowingPage() {
  return (
    <React.Suspense
      fallback={
        <div className="py-10 text-center text-muted-foreground">
          <Loader2 className="inline h-4 w-4 animate-spin" />
        </div>
      }
    >
      <FollowingContent />
    </React.Suspense>
  )
}
