'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { UserPlus, UserMinus, Loader2, AlertCircle, MessageCircle } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@ihui/ui'
import { Avatar } from '@/components/data'

interface PublicUser {
  id: string
  nickname: string
  avatar: string
  email?: string
  bio?: string
  createdAt: string
}

interface UserStats {
  followingCount: number
  followersCount: number
  favoritesCount: number
}

interface UserResponse {
  user: PublicUser
  stats: UserStats
}

interface CreateConversationResult {
  conversation: { id: string }
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function PublicUserProfilePage() {
  const params = useParams<{ id: string }>()
  const id = params?.id
  const router = useRouter()
  const t = useTranslations('user.public')
  const qc = useQueryClient()
  const currentUser = useAuthStore((s) => s.user)

  const { data, isLoading, error } = useQuery({
    queryKey: ['user', 'public', id],
    queryFn: () => api<UserResponse>(`/api/users/${id}`),
    enabled: !!id,
  })

  const isSelf = !!currentUser && !!id && currentUser.id === id
  const canFollow = !!currentUser && !isSelf

  const { data: statusData } = useQuery({
    queryKey: ['follows', 'status', id],
    queryFn: () => api<{ following: boolean }>(`/api/follows/${id}/status`),
    enabled: canFollow,
  })

  const followMut = useMutation({
    mutationFn: () => api(`/api/follows/${id}`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['follows', 'status', id] }),
  })

  const unfollowMut = useMutation({
    mutationFn: () => api(`/api/follows/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['follows', 'status', id] }),
  })

  const startDmMut = useMutation({
    mutationFn: () =>
      api<CreateConversationResult>(`/api/messages/conversations`, {
        method: 'POST',
        body: JSON.stringify({ peerId: id }),
      }),
    onSuccess: (res) => {
      if (res.conversation?.id) {
        router.push(`/messages?conversationId=${res.conversation.id}`)
      }
    },
  })

  if (isLoading) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
        {t('loading')}
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
        <AlertCircle className="h-8 w-8 opacity-40" />
        <p className="text-sm">{t('notFound')}</p>
      </div>
    )
  }

  const { user, stats } = data
  const following = statusData?.following ?? false
  const statsItems: { label: string; value: number }[] = [
    { label: t('statsFollowing'), value: stats.followingCount },
    { label: t('statsFollowers'), value: stats.followersCount },
    { label: t('statsFavorites'), value: stats.favoritesCount },
  ]

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-start gap-4">
        <Avatar
          src={user.avatar ?? undefined}
          name={user.nickname}
          size="xl"
          className="h-20 w-20 text-2xl"
        />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="break-words text-2xl font-bold tracking-tight">
              {user.nickname || 'User'}
            </h1>
            {isSelf && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {t('isYou')}
              </span>
            )}
          </div>
          {user.bio ? <p className="text-sm text-muted-foreground">{user.bio}</p> : null}
        </div>
        {canFollow && (
          <div className="flex shrink-0 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => startDmMut.mutate()}
              disabled={startDmMut.isPending}
            >
              <MessageCircle className="mr-1.5 h-4 w-4" />
              {t('sendMessage', { default: '私信他' })}
            </Button>
            {following ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => unfollowMut.mutate()}
                disabled={unfollowMut.isPending}
              >
                <UserMinus className="mr-1.5 h-4 w-4" />
                {t('unfollow')}
              </Button>
            ) : (
              <Button size="sm" onClick={() => followMut.mutate()} disabled={followMut.isPending}>
                <UserPlus className="mr-1.5 h-4 w-4" />
                {t('follow')}
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {statsItems.map((item) => (
          <div
            key={item.label}
            className="flex flex-col items-center justify-center rounded-lg border bg-card px-3 py-3"
          >
            <span className="text-xl font-bold tabular-nums">{item.value}</span>
            <span className="mt-0.5 text-xs text-muted-foreground">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
