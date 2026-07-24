'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, Link2, Unlink } from 'lucide-react'

import { Card, CardHeader, CardTitle, CardContent, Button } from '@ihui/ui-react'
import { Container } from '@/components/layout'
import { ConfirmDialog } from '@/components/feedback'
import { fetchApi } from '@/lib/api'

interface Binding {
  id: string
  platform: string
  platformUserId?: string
  boundAt: string
}

const PLATFORMS = [
  { key: 'wechat', label: '微信' },
  { key: 'github', label: 'GitHub' },
  { key: 'google', label: 'Google' },
] as const

export default function ConnectedAccountsPage() {
  const t = useTranslations('settings')
  const locale = useLocale()
  const qc = useQueryClient()
  const [confirmId, setConfirmId] = React.useState<string | null>(null)

  const dateFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [locale],
  )

  const { data, isLoading, error } = useQuery({
    queryKey: ['settings', 'connected-accounts'],
    queryFn: async () => {
      const res = await fetchApi<Binding[]>('/auth/bindings')
      if (!res.success) throw new Error(res.error)
      return res.data
    },
  })

  const unbindMut = useMutation({
    mutationFn: (id: string) =>
      fetchApi(`/auth/bindings/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(t('connectedAccountsUnbindSuccess'))
        qc.invalidateQueries({ queryKey: ['settings', 'connected-accounts'] })
      } else {
        toast.error(res.error || t('connectedAccountsUnbindFail'))
      }
    },
    onError: (e: Error) => toast.error(e.message || t('connectedAccountsUnbindFail')),
  })

  const bindings = data ?? []
  const pendingBinding = bindings.find((b) => b.id === confirmId)

  const onBind = (platform: string) => {
    window.location.href = `/api/auth/${platform}?redirect=${encodeURIComponent(window.location.pathname)}`
  }

  const onConfirmUnbind = () => {
    if (!confirmId) return
    unbindMut.mutate(confirmId)
    setConfirmId(null)
  }

  const renderRow = (platform: (typeof PLATFORMS)[number]) => {
    const binding = bindings.find((b) => b.platform === platform.key)
    const isBound = !!binding
    return (
      <div
        key={platform.key}
        className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/30"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-muted p-2">
            <Link2 className="h-4 w-4" />
          </div>
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{platform.label}</p>
            {isBound ? (
              <p className="text-xs text-muted-foreground">
                {t('connectedAccountsBoundAt')}: {dateFmt.format(new Date(binding!.boundAt))}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">{t('connectedAccountsUnbound')}</p>
            )}
          </div>
        </div>
        {isBound ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmId(binding!.id)}
            disabled={unbindMut.isPending}
          >
            <Unlink className="h-4 w-4" />
            {t('connectedAccountsUnbind')}
          </Button>
        ) : (
          <Button size="sm" onClick={() => onBind(platform.key)}>
            <Link2 className="h-4 w-4" />
            {t('connectedAccountsBind')}
          </Button>
        )}
      </div>
    )
  }

  return (
    <Container maxWidth="md" padding={false} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('connectedAccountsTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('connectedAccountsDesc')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-4 w-4" />
            {t('connectedAccountsPlatform')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              {t('connectedAccountsLoading')}
            </div>
          ) : error ? (
            <div className="py-10 text-center text-sm text-destructive">
              {(error as Error).message}
            </div>
          ) : (
            PLATFORMS.map(renderRow)
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!confirmId}
        title={t('connectedAccountsUnbind')}
        content={
          pendingBinding
            ? t('connectedAccountsUnbindConfirm', {
                platform:
                  PLATFORMS.find((p) => p.key === pendingBinding.platform)?.label ??
                  pendingBinding.platform,
              })
            : t('connectedAccountsUnbindConfirm', { platform: '' })
        }
        confirmText={t('connectedAccountsUnbind')}
        cancelText={t('connectedAccountsCancel')}
        variant="danger"
        loading={unbindMut.isPending}
        onConfirm={onConfirmUnbind}
        onCancel={() => setConfirmId(null)}
      />
    </Container>
  )
}
