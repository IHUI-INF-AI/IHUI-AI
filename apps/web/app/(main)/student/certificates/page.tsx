'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Award, Loader2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@ihui/ui-react'

interface Certificate {
  id: string
  certificateNo: string
  userId: string
  templateId: string
  nickname: string
  templateName: string
  issuedAt: string
  status: number
}

interface CertsData {
  list: Certificate[]
  total: number
}

const PAGE_SIZE = 20

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const STATUS_STYLE: Record<number, string> = {
  1: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  2: 'bg-destructive/10 text-destructive',
}

export default function MyCertificatesPage() {
  const t = useTranslations('student')

  const { data, isLoading, error } = useQuery({
    queryKey: ['student', 'my-certificates'],
    queryFn: () => api<CertsData>(`/api/edu/my-certificates?page=1&pageSize=${PAGE_SIZE}`),
  })

  const list = data?.list ?? []

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <Award className="h-7 w-7 text-primary" />
          {t('myCertsTitle')}
        </h1>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16">
          <Award className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((cert) => {
            const statusKey = cert.status === 2 ? 'statusRevoked' : 'statusValid'
            return (
              <Card key={cert.id} className="transition-colors hover:bg-accent">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                      <Award className="h-5 w-5 text-primary" />
                    </div>
                    <span
                      className={cn(
                        'inline-flex rounded-md px-2 py-0.5 text-xs font-medium',
                        STATUS_STYLE[cert.status] ?? STATUS_STYLE[1],
                      )}
                    >
                      {t(statusKey)}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t('certNo')}</span>
                      <span className="font-medium">{cert.certificateNo}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t('template')}</span>
                      <span className="font-medium">{cert.templateName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t('issuedAt')}</span>
                      <span className="font-medium">
                        {cert.issuedAt ? new Date(cert.issuedAt).toLocaleDateString('zh-CN') : '-'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
