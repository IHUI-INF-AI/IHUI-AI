'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, UserMinus, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { Avatar } from '@/components/data'
import { Button } from '@ihui/ui'

interface FollowUser {
  id: string
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

export default function FollowPage() {
  const t = useTranslations('user.follow')
  const locale = useLocale()
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)

  const { data, isLoading, error } = useQuery({
    queryKey: ['user', 'follow', user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<FollowUser[]> => {
      const r = await fetchApi<{ list?: FollowUser[] } | FollowUser[]>(
        `/api/users/${user!.id}/follows`,
      )
      if (!r.success) {
        if (r.status === 404) return []
        throw new Error(r.error)
      }
      const d = r.data
      return Array.isArray(d) ? d : (d.list ?? [])
    },
  })

  const unfollowMut = useMutation({
    mutationFn: (userId: string) => api(`/api/follows/${userId}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('unfollowSuccess', { default: '已取消关注' }))
      qc.invalidateQueries({ queryKey: ['user', 'follow', user?.id] })
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
          <UserPlus className="h-5 w-5 text-primary" />
          {t('title', { default: '我的关注' })}
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
          <UserPlus className="h-8 w-8 opacity-40" />
          <p className="text-sm">{t('empty', { default: '目前还没有数据' })}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((follow) => (
            <li
              key={follow.id}
              className="rounded-lg border bg-card p-4 transition-colors hover:bg-muted/30"
            >
              <div className="flex items-center gap-3">
                <Avatar src={follow.avatar ?? undefined} name={follow.nickname ?? '?'} size="md" />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="truncate text-sm font-medium">{follow.nickname ?? '匿名用户'}</p>
                  {follow.bio ? (
                    <p className="truncate text-xs text-muted-foreground">{follow.bio}</p>
                  ) : null}
                  {follow.createdAt ? (
                    <p className="text-xs text-muted-foreground">
                      {dateFmt.format(new Date(follow.createdAt))}
                    </p>
                  ) : null}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={unfollowMut.isPending}
                  onClick={() => unfollowMut.mutate(follow.id)}
                >
                  <UserMinus className="mr-1 h-3.5 w-3.5" />
                  {t('unfollow', { default: '取消关注' })}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
