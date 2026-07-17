'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, ClipboardList } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { cn } from '@/lib/utils'

interface SignUpItem {
  id: string
  targetTitle: string
  targetType?: string
  status?: string
  createdAt?: string
}

interface SignUpListResponse {
  list?: SignUpItem[]
  total?: number
}

const STATUS_LABEL: Record<string, string> = {
  draft: '待审核',
  published: '已确认',
  rejected: '已拒绝',
  completed: '已完成',
}

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  published: 'bg-green-500/10 text-green-600',
  rejected: 'bg-destructive/10 text-destructive',
  completed: 'bg-blue-500/10 text-blue-600',
}

async function fetchSignUps(userId: string): Promise<SignUpItem[]> {
  const r = await fetchApi<SignUpListResponse>(`/api/sign-ups?userId=${userId}`)
  if (!r.success) return []
  return r.data?.list ?? []
}

export default function UserSignUpPage() {
  const t = useTranslations('user.sign-up')
  const locale = useLocale()
  const user = useAuthStore((s) => s.user)

  const { data, isLoading } = useQuery({
    queryKey: ['user', 'sign-ups', user?.id],
    enabled: !!user?.id,
    queryFn: () => fetchSignUps(user!.id),
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
        <h2 className="text-xl font-bold tracking-tight">{t('title')}</h2>
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          {t('loading', { default: '加载中…' })}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
          <ClipboardList className="h-8 w-8 opacity-40" />
          <p className="text-sm">{t('empty')}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((s) => (
            <li
              key={s.id}
              className="rounded-lg border bg-card p-4 transition-colors hover:bg-muted/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold">{s.targetTitle}</h3>
                    {s.status ? (
                      <span
                        className={cn(
                          'shrink-0 rounded-md px-2 py-0.5 text-xs',
                          STATUS_STYLE[s.status] ?? STATUS_STYLE.draft,
                        )}
                      >
                        {STATUS_LABEL[s.status] ?? s.status}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    {s.targetType ? (
                      <span className="rounded-md bg-muted px-2 py-0.5">{s.targetType}</span>
                    ) : null}
                    {s.createdAt ? <span>{dateFmt.format(new Date(s.createdAt))}</span> : null}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
