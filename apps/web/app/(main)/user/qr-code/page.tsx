'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2, RotateCw, Share2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent } from '@ihui/ui-react'
import { BackButton } from '@/components/common'
import { toast } from '@/components/common/Toaster'

interface QrCodeItem {
  content: string
  url: string
  inviteCode: string
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

/** 极简二维码占位(生产可换 qrcode 库渲染 content) */
function QrPlaceholder({ content }: { content: string }) {
  const dots = React.useMemo(() => {
    const seed = content.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    return Array.from({ length: 169 }, (_, i) => {
      const v = (seed * (i + 7) * 31) % 100
      return v < 55
    })
  }, [content])
  return (
    <div className="mx-auto grid w-56 grid-cols-[13] gap-0.5 rounded-md border border-border bg-white p-3">
      {dots.map((on, i) => (
        <div
          key={i}
          className={on ? 'bg-neutral-900' : 'bg-transparent'}
          style={{ aspectRatio: '1' }}
        />
      ))}
    </div>
  )
}

export default function QrCodePage() {
  const t = useTranslations('qrCode')
  const q = useQuery({
    queryKey: ['user', 'qr-code'],
    queryFn: () => api<QrCodeItem>('/user/qr-code'),
  })

  const onShare = async () => {
    const url = q.data?.url
    if (!url) return
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${url}`)
      toast.success(t('copied'))
    } catch {
      toast.error(t('copyFailed'))
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <BackButton fallbackHref="/settings" />
        <h1 className="text-lg font-medium">{t('title')}</h1>
        <div className="w-10" />
      </div>

      {q.isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 shrink-0 animate-spin" />
          <span>{t('loading')}</span>
        </div>
      ) : q.isError ? (
        <div className="rounded-md border border-border bg-card p-6 text-center">
          <p className="mb-3 text-sm text-muted-foreground">{t('loadFailed')}</p>
          <Button variant="outline" size="sm" onClick={() => void q.refetch()}>
            <RotateCw className="mr-2 h-4 w-4" />
            {t('retry')}
          </Button>
        </div>
      ) : q.data ? (
        <Card>
          <CardContent className="flex flex-col items-center p-4 text-center">
            <QrPlaceholder content={q.data.content} />
            <p className="mt-4 text-sm text-muted-foreground">{t('scanHint')}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('inviteCode')}: {q.data.inviteCode}
            </p>
            <Button className="mt-4" onClick={() => void onShare()}>
              <Share2 className="mr-2 h-4 w-4" />
              {t('share')}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
