'use client'

/**
 * 用户粉丝列表页(2026-07-26 重建)
 *
 * 触发:commit f4ebcab28 重构脚本误清空本文件,导致 6 个 user.fans.* i18n key
 *       失去引用变 audit 误报。本文件按 git 历史 1289fabdc 完整版恢复,
 *       适配 2026-07 当前 fetcher 与 API 契约。
 *
 * 数据流:
 *   - GET /api/follows/followers?page=1&pageSize=100 → 粉丝列表
 *   - GET /api/follows/following?pageSize=200        → 我已关注列表(用于判断"已关注"状态)
 *   - POST /api/follows/{userId}                     → 关注 / 取消关注
 *
 * 边界:
 *   - 未登录 / 401 → fetchApi 由统一拦截器跳登录
 *   - 404 → 当作"暂无粉丝"渲染空态
 *   - SSR:next-intl 在客户端 useTranslations 安全(use client 组件)
 */

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, Users, UserPlus, UserCheck } from 'lucide-react'
import { toast } from 'sonner'

import { fetchApi } from '@/lib/api'
import { Avatar } from '@/components/data'
import { Button } from '@ihui/ui-react'
import { pushError } from '@/stores/error-banner'
import { BackButton } from '@/components/common'

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

  // 2026-08-01 错误推送全局 banner(常驻 + 顶部滑下),替代 inline 英文错误显示
  React.useEffect(() => {
    if (error) pushError(error)
  }, [error])

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
      toast.success(t('followSuccess'))
      qc.invalidateQueries({ queryKey: ['follows', 'following'] })
    },
    onError: (e: Error) => pushError(e),
  })

  const dateFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }),
    [locale],
  )

  const items = data ?? []

  return (
    <div className="space-y-4">
      <BackButton />
      {isLoading ? (
        <div className="py-10 text-center text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          {t('loading')}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-muted-foreground">
          <Users className="h-8 w-8 opacity-40" />
          <p className="text-sm">{t('empty')}</p>
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
                    <p className="truncate text-sm font-medium">{fan.nickname ?? t('anonymous')}</p>
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
                        {t('followed')}
                      </>
                    ) : (
                      <>
                        <UserPlus className="mr-1 h-3.5 w-3.5" />
                        {t('follow')}
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
