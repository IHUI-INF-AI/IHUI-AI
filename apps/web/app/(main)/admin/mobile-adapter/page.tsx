'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Smartphone, Loader2, Check } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { cn } from '@/lib/utils'

interface DeviceConfig {
  id: string
  model: string
  resolution: string
  dpr: number
  status: 'adapted' | 'partial' | 'pending'
}

const PREVIEW_MODES = [
  { id: 'mobile', label: 'Mobile', width: 375 },
  { id: 'tablet', label: 'Tablet', width: 768 },
  { id: 'desktop', label: 'Desktop', width: 1280 },
] as const

const STATUS_STYLE: Record<DeviceConfig['status'], { bg: string; text: string; label: string }> = {
  adapted: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', label: 'Adapted' },
  partial: { bg: 'bg-amber-500/10', text: 'text-amber-600', label: 'Partial' },
  pending: { bg: 'bg-muted', text: 'text-muted-foreground', label: 'Pending' },
}

const th = 'px-4 py-2.5 font-medium'

export default function MobileAdapterPage() {
  const t = useTranslations('adminTools')
  const tc = useTranslations('common')
  const qc = useQueryClient()
  const [previewMode, setPreviewMode] = React.useState<'mobile' | 'tablet' | 'desktop'>('mobile')

  const { data: devices, isLoading } = useQuery({
    queryKey: ['admin', 'mobile-adapter'],
    queryFn: async () => {
      const r = await fetchApi<DeviceConfig[]>('/api/admin/mobile-adapter')
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })

  const devicesList = devices ?? []

  const setModeMut = useMutation({
    mutationFn: async (mode: string) => {
      const r = await fetchApi('/api/admin/mobile-adapter/mode', {
        method: 'PUT',
        body: JSON.stringify({ mode }),
      })
      if (!r.success) throw new Error(r.error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'mobile-adapter'] })
      toast.success(t('mobile.modeSaved'))
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Smartphone className="h-6 w-6 text-primary" />
          {t('mobile.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('mobile.subtitle')}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 设备适配配置 */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-lg font-semibold">{t('mobile.deviceConfig')}</h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {tc('search')}
            </div>
          ) : devicesList.length === 0 ? (
            <div className="rounded-lg border border-dashed py-16 text-center text-muted-foreground">
              {t('mobile.noData')}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className={th}>{t('mobile.colModel')}</th>
                    <th className={th}>{t('mobile.colResolution')}</th>
                    <th className={th}>DPR</th>
                    <th className={th}>{t('mobile.colStatus')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {devicesList.map((d) => {
                    const st = STATUS_STYLE[d.status]
                    return (
                      <tr key={d.id} className="transition-colors hover:bg-muted/30">
                        <td className="px-4 py-2.5 font-medium">{d.model}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                          {d.resolution}
                        </td>
                        <td className="px-4 py-2.5">{d.dpr}x</td>
                        <td className="px-4 py-2.5">
                          <span
                            className={cn(
                              'inline-flex rounded-md px-2 py-0.5 text-xs font-medium',
                              st.bg,
                              st.text,
                            )}
                          >
                            {st.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 预览模式 */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">{t('mobile.previewMode')}</h2>
          <Card>
            <CardContent className="pt-4 space-y-2">
              {PREVIEW_MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setPreviewMode(m.id)
                    setModeMut.mutate(m.id)
                  }}
                  className={cn(
                    'flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors',
                    previewMode === m.id
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'hover:bg-muted/30',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    <span className="font-medium">{m.label}</span>
                    <span className="text-xs text-muted-foreground">{m.width}px</span>
                  </div>
                  {previewMode === m.id && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t('mobile.preview')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center rounded-md border bg-muted/30 p-4">
                <div
                  className="rounded-md border-2 border-primary/30 bg-background shadow-sm transition-all"
                  style={{
                    width: Math.min(
                      previewMode === 'mobile' ? 280 : previewMode === 'tablet' ? 380 : 520,
                      520,
                    ),
                    height: 200,
                  }}
                >
                  <div className="border-b border-primary/20 px-2 py-1 text-xs text-muted-foreground">
                    {PREVIEW_MODES.find((m) => m.id === previewMode)?.label} ·{' '}
                    {PREVIEW_MODES.find((m) => m.id === previewMode)?.width}px
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
