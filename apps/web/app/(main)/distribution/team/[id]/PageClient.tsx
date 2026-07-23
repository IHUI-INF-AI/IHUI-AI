'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { Loader2, ArrowLeft, Users, Crown, Calendar, ChevronRight } from 'lucide-react'
import Image from 'next/image'

import { fetchApi } from '@/lib/api'
import { Card, CardContent } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface TeamMember {
  id: string
  username: string | null
  nickname: string | null
  avatar: string | null
  createdAt: string
}

interface TreeNode extends TeamMember {
  level?: number
  children?: TreeNode[]
}

interface InvitedUsersData {
  list: TeamMember[]
  total: number
}

interface TreeData {
  tree: TreeNode[]
  totalLevels: number
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function findInTree(nodes: TreeNode[], id: string): TreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    if (node.children?.length) {
      const found = findInTree(node.children, id)
      if (found) return found
    }
  }
  return null
}

export default function DistributionTeamDetailPage() {
  const params = useParams<{ id: string }>()
  const locale = useLocale()
  const t = useTranslations('distributionTeamDetailPage')

  const {
    data: usersData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['distribution', 'invited-users'],
    queryFn: () => api<InvitedUsersData>('/api/distribution/invited-users'),
  })

  const { data: treeData } = useQuery({
    queryKey: ['distribution', 'tree'],
    queryFn: () => api<TreeData>('/api/distribution/tree'),
  })

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const fmt = (v: string) => {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
  }

  const member = usersData?.list.find((u) => u.id === params.id) ?? null
  const treeNode = treeData ? findInTree(treeData.tree, params.id) : null
  const subordinates = treeNode?.children ?? []
  const displayName = member?.nickname || member?.username || t('defaultName')
  const initials = (displayName || 'U')[0]?.toUpperCase()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )
  }

  if (error || !member) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Link
          href="/distribution/team"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('back')}
        </Link>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error)?.message ?? t('notExist')}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Link
        href="/distribution/team"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('back')}
      </Link>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center gap-4">
            {member.avatar ? (
              <Image
                src={member.avatar}
                alt={displayName}
                width={64}
                height={64}
                className="h-16 w-16 rounded-2xl object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-xl font-bold text-primary">
                {initials}
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-1">
              <h1 className="text-xl font-bold tracking-tight">{displayName}</h1>
              {member.username && (
                <p className="font-mono text-sm text-muted-foreground">@{member.username}</p>
              )}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {t('joinedAt', { time: fmt(member.createdAt) })}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t pt-4">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">{t('subordinateCount')}</div>
              <div className="flex items-center gap-1 text-lg font-bold">
                <Users className="h-4 w-4 text-primary" />
                {subordinates.length}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">{t('teamLevel')}</div>
              <div className="flex items-center gap-1 text-lg font-bold">
                <Crown className="h-4 w-4 text-amber-500" />L{(treeNode?.level ?? 1) + 1}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('directSubordinates')}</h2>
          <span className="text-sm text-muted-foreground">{t('totalCount', { count: subordinates.length })}</span>
        </div>

        {subordinates.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12">
            <Users className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">{t('noSubordinates')}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            {subordinates.map((sub, idx) => (
              <Link
                key={sub.id}
                href={`/distribution/team/${sub.id}`}
                className={cn(
                  'flex items-center gap-3 p-3 transition-colors hover:bg-accent/40',
                  idx > 0 && 'border-t',
                )}
              >
                {sub.avatar ? (
                  <Image
                    src={sub.avatar}
                    alt=""
                    width={32}
                    height={32}
                    className="h-8 w-8 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-xs font-medium">
                    {(sub.nickname ?? sub.username ?? 'U')[0]?.toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {sub.nickname || sub.username || '-'}
                  </div>
                  <div className="text-xs text-muted-foreground">{fmt(sub.createdAt)}</div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
