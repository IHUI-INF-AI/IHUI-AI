'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, Users, UserPlus, UserCheck } from 'lucide-react'
import { toast } from 'sonner'
import { fetchApi } from '@/lib/api'
import { Avatar } from '@/components/data'
import { Button } from '@ihui/ui-react'

interface FanUser {
  id: string
  userId: string
  nickname?: string | null
  avatar?: string | null
  bio?: string | null
  createdAt?: string | null
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function FansPage() {
  const t = useTranslations('user.fans')
  const locale = useLocale()
  const qc = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['user', 'fans'],
    queryFn: async (): Promise<FanUser[]> => {
      const r = await fetchApi<{ list?: FanUser[] }>(`/api/follows/followers?page=1&pageSize=100`)
      if (!r.success) {
        if (r.status === 404) return []
        throw new Error(r.error)
      }
      return r.data.list ?? []
    },
  })

  const { data: myFollowing } = useQuery({
    queryKey: ['follows', 'following'],
    queryFn: () =>
      api<{ list: { userId: string }[] }>(`/api/follows/following?pageSize=200`).then(
        (d) => d.list ?? [],
      ),
  })

  const followedIds = React.useMemo(
    () => new Set((myFollowing ?? []).map((u) => u.userId)),
    [myFollowing],
  )

  const followMut = useMutation({
    mutationFn: (userId: string) => api(`/api/follows/${userId}`, { method: 'POST' }),
    onSuccess: () => {
      toast.success(t('followSuccess', { default: '已关注' }))
      qc.invalidateQueries({ queryKey: ['follows', 'following'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const items = data ?? []

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Users className="h-5 w-5 text-primary" />
          {t('title', { default: '我的粉丝' })}
        </h1>
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          {t('loading', { default: '加载中...' })}
        </div>
      ) : error ? (
        <div className="py-10 text-center text-destructive">{(error as Error).message}</div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
          <Users className="h-8 w-8 opacity-40" />
          <p className="text-sm">{t('empty', { default: '目前还没有数据' })}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((fan) => {
            const isFollowed = followedIds.has(fan.userId)
            return (
              <li
                key={fan.id}
                className="rounded-lg border bg-card p-4 transition-colors hover:bg-muted/30"
              >
                <div className="flex items-center gap-3">
                  <Avatar src={fan.avatar ?? undefined} name={fan.nickname ?? '?'} size="md" />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="truncate text-sm font-medium">{fan.nickname ?? '匿名用户'}</p>
                    {fan.bio ? (
                      <p className="truncate text-xs text-muted-foreground">{fan.bio}</p>
                    ) : null}
                    {fan.createdAt ? (
                      <p className="text-xs text-muted-foreground">
                        {dateFmt.format(new Date(fan.createdAt))}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    size="sm"
                    variant={isFollowed ? 'outline' : 'default'}
                    disabled={followMut.isPending}
                    onClick={() => followMut.mutate(fan.userId)}
                  >
                    {isFollowed ? (
                      <>
                        <UserCheck className="mr-1 h-3.5 w-3.5" />
                        {t('followed', { default: '已关注' })}
                      </>
                    ) : (
                      <>
                        <UserPlus className="mr-1 h-3.5 w-3.5" />
                        {t('follow', { default: '关注' })}
                      </>
                    )}
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
