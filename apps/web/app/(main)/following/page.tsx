'use client'

import * as React from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Users, UserPlus, UserMinus, Loader2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button } from '@ihui/ui'
import { cn } from '@/lib/utils'

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
  const qc = useQueryClient()
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') === 'followers' ? 'followers' : 'following'
  const [tab, setTab] = React.useState<'following' | 'followers'>(initialTab)

  // 当前展示的列表
  const { data, isLoading, error } = useQuery({
    queryKey: ['follows', tab],
    queryFn: () =>
      api<{ list: FollowUser[] }>(`/api/follows/${tab}?pageSize=100`).then((d) => d.list ?? []),
  })

  // 始终拉取我关注的列表,用于在"粉丝"tab 判断是否互关(可回关)
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
    mutationFn: (userId: string) =>
      api(`/api/follows/${userId}`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['follows'] }),
  })

  const unfollowMut = useMutation({
    mutationFn: (userId: string) =>
      api(`/api/follows/${userId}`, { method: 'DELETE' }),
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
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              tab === value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t(`tabs.${value}`)}
          </button>
        ))}
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
          {tab === 'following' ? (
            <UserPlus className="h-8 w-8 opacity-40" />
          ) : (
            <UserMinus className="h-8 w-8 opacity-40" />
          )}
          <p className="text-sm">{t(`empty.${tab}`)}</p>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {items.map((u) => {
            const isFollowing = followedIds.has(u.userId)
            const initial = (u.nickname?.[0] ?? 'U').toUpperCase()
            return (
              <li
                key={u.id}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30"
              >
                <Link
                  href={`/user/${u.userId}`}
                  className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-medium"
                >
                  {u.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u.avatar} alt={u.nickname ?? ''} className="h-9 w-9 rounded-full" />
                  ) : (
                    initial
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/user/${u.userId}`}
                    className="truncate text-sm font-medium hover:underline"
                  >
                    {u.nickname || 'User'}
                  </Link>
                </div>
                {isFollowing ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                    onClick={() => unfollowMut.mutate(u.userId)}
                    disabled={unfollowMut.isPending}
                  >
                    <UserMinus className="mr-1 h-3.5 w-3.5" />
                    {t('unfollow')}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => followMut.mutate(u.userId)}
                    disabled={followMut.isPending}
                  >
                    <UserPlus className="mr-1 h-3.5 w-3.5" />
                    {t('follow')}
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default function FollowingPage() {
  return (
    <React.Suspense fallback={<div className="py-10 text-center text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin" /></div>}>
      <FollowingContent />
    </React.Suspense>
  )
}
