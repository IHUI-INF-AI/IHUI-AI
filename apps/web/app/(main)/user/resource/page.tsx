'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, FileText, Download } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

interface ResourceItem {
  id: string
  title: string
  type?: string
  downloadCount?: number
  createdAt?: string
}

interface ResourceListResponse {
  list?: ResourceItem[]
  total?: number
}

async function fetchResources(userId: string): Promise<ResourceItem[]> {
  const r = await fetchApi<ResourceListResponse>(`/api/resources?authorId=${userId}`)
  if (!r.success) return []
  return r.data?.list ?? []
}

export default function UserResourcePage() {
  const t = useTranslations('user.resource')
  const locale = useLocale()
  const user = useAuthStore((s) => s.user)

  const { data, isLoading } = useQuery({
    queryKey: ['user', 'resources', user?.id],
    enabled: !!user?.id,
    queryFn: () => fetchResources(user!.id),
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
          <FileText className="h-8 w-8 opacity-40" />
          <p className="text-sm">{t('empty')}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((r) => (
            <li
              key={r.id}
              className="rounded-lg border bg-card p-4 transition-colors hover:bg-muted/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold">{r.title}</h3>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    {r.type ? (
                      <span className="rounded-md bg-muted px-2 py-0.5">{r.type}</span>
                    ) : null}
                    <span className="inline-flex items-center gap-1">
                      <Download className="h-3 w-3" />
                      {r.downloadCount ?? 0}
                    </span>
                    {r.createdAt ? <span>{dateFmt.format(new Date(r.createdAt))}</span> : null}
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
