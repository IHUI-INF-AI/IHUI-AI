// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Copy, Loader2, Play, Square, Video } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent, Input, Label } from '@ihui/ui-react'
import { toast } from '@/components/common/Toaster'
import { BackButton } from '@/components/common'
import { useAuthStore } from '@/stores/auth'

interface StreamItem {
  id: string
  streamKey: string
  title: string
  pushUrl: string | null
  playUrl: string | null
  hlsUrl: string | null
  status: string
  userId: string | null
  createdAt: string
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function LiveHostPage() {
  const t = useTranslations('liveHost')
  const qc = useQueryClient()
  const currentUserId = useAuthStore((s) => s.user?.id)
  const [title, setTitle] = React.useState('')
  const [created, setCreated] = React.useState<StreamItem | null>(null)

  const myStreamsQ = useQuery({
    queryKey: ['srs', 'streams'],
    queryFn: () => api<{ list: StreamItem[] }>('/srs/streams?page=1&pageSize=50'),
    select: (d) =>
      d.list.filter((s) => (s.userId ? s.userId === currentUserId : false)),
  })

  const createQ = useMutation({
    mutationFn: () => api<StreamItem>('/srs/streams', { method: 'POST', body: JSON.stringify({ title: title.trim() }) }),
    onSuccess: (stream) => {
      setCreated(stream)
      setTitle('')
      toast.success(t('startSuccess'))
      void qc.invalidateQueries({ queryKey: ['srs', 'streams'] })
    },
    onError: (e: Error) => toast.error(e.message || t('startFailed')),
  })

  const endQ = useMutation({
    mutationFn: (id: string) =>
      api<StreamItem>(`/srs/streams/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'inactive' }) }),
    onSuccess: () => {
      toast.success(t('endSuccess'))
      void qc.invalidateQueries({ queryKey: ['srs', 'streams'] })
    },
    onError: (e: Error) => toast.error(e.message || t('endFailed')),
  })

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(t('copied'))
    } catch {
      toast.error(t('copyFailed'))
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <BackButton fallbackHref="/live" />
        <h1 className="text-lg font-medium">{t('title')}</h1>
        <div className="w-10" />
      </div>

      <Card className="mb-4">
        <CardContent className="space-y-3 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="live-title">{t('titleLabel')}</Label>
            <Input
              id="live-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder={t('titlePlaceholder')}
            />
          </div>
          <Button
            className="w-full"
            disabled={createQ.isPending || !title.trim()}
            onClick={() => createQ.mutate()}
          >
            {createQ.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Video className="mr-2 h-4 w-4" />
            )}
            {t('startBtn')}
          </Button>
        </CardContent>
      </Card>

      {created ? (
        <Card className="mb-4">
          <CardContent className="space-y-2 p-4">
            <h3 className="text-sm font-medium">{t('streamInfo')}</h3>
            {created.pushUrl ? (
              <div className="flex items-center justify-between gap-2 rounded-md bg-secondary/50 px-3 py-2 text-sm">
                <span className="truncate font-mono text-xs">{created.pushUrl}</span>
                <Button variant="ghost" size="sm" onClick={() => void copyText(created.pushUrl!)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-2 rounded-md bg-secondary/50 px-3 py-2 text-sm">
              <span className="truncate font-mono text-xs">{t('streamKey')}: {created.streamKey}</span>
              <Button variant="ghost" size="sm" onClick={() => void copyText(created.streamKey)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t('obsHint')}</p>
          </CardContent>
        </Card>
      ) : null}

      <h3 className="mb-3 text-sm font-medium">{t('myStreams')}</h3>

      {myStreamsQ.isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          <span>{t('loading')}</span>
        </div>
      ) : (myStreamsQ.data ?? []).length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            {t('empty')}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {(myStreamsQ.data ?? []).map((stream) => (
            <Card key={stream.id}>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <h4 className="truncate text-sm font-medium">{stream.title}</h4>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {stream.status === 'active' ? t('statusActive') : t('statusInactive')}
                  </p>
                </div>
                {stream.status === 'active' ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={endQ.isPending}
                    onClick={() => endQ.mutate(stream.id)}
                  >
                    {endQ.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Square className="mr-1.5 h-4 w-4" />}
                    {t('endBtn')}
                  </Button>
                ) : (
                  <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                    <Play className="h-4 w-4" />
                    {t('statusInactive')}
                  </span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
