'use client'

import * as React from 'react'
import { Loader2, KeyRound, Webhook, Plus, Copy, Trash2, Package, Download, RefreshCw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'

import { cn } from '@/lib/utils'
import { fetchApi } from '@/lib/api'
import { HasPermi } from '@/components/auth/HasPermi'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@ihui/ui'
import type { RotateApiKeyResponse } from '@ihui/types'
import type { ApiKey, WebhookConfig, SdkItem } from './types'

interface DeveloperCardsProps {
  isLoading: boolean
  keysList: ApiKey[]
  webhooksList: WebhookConfig[]
  sdksList: SdkItem[]
  delKeyPending: boolean
  onCopyKey: (k: string) => void
  onDeleteKey: (id: string) => void
  onCreateKey: () => void
  onCreateWebhook: () => void
}

export function DeveloperCards({
  isLoading,
  keysList,
  webhooksList,
  sdksList,
  delKeyPending,
  onCopyKey,
  onDeleteKey,
  onCreateKey,
  onCreateWebhook,
}: DeveloperCardsProps) {
  const t = useTranslations('adminTools')
  const tc = useTranslations('common')
  const qc = useQueryClient()
  const [resetTarget, setResetTarget] = React.useState<{ id: string; name: string } | null>(null)
  const [resetPending, setResetPending] = React.useState(false)
  const [resetSecret, setResetSecret] = React.useState<string | null>(null)

  async function handleResetConfirm() {
    if (!resetTarget) return
    setResetPending(true)
    try {
      const r = await fetchApi<RotateApiKeyResponse>(
        `/api/developer/keys/${resetTarget.id}/reset`,
        { method: 'POST' },
      )
      if (!r.success || !r.data) {
        throw new Error(r.error || '重置失败')
      }
      setResetSecret(r.data.secret)
      qc.invalidateQueries({ queryKey: ['admin', 'developer', 'keys'] })
      toast.success('密钥已重置')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '重置失败')
    } finally {
      setResetPending(false)
      setResetTarget(null)
    }
  }

  function copySecret(s: string) {
    navigator.clipboard?.writeText(s).then(
      () => toast.success(t('developer.copied')),
      () => toast.error(t('developer.copyFailed')),
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {tc('search')}
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4" />
              {t('developer.apiKeys')}
            </CardTitle>
            <HasPermi code="ai:developer:add">
              <Button size="sm" variant="outline" onClick={onCreateKey}>
                <Plus className="h-4 w-4" />
                {t('developer.createKey')}
              </Button>
            </HasPermi>
          </CardHeader>
          <CardContent>
            {keysList.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t('developer.noData')}
              </p>
            ) : (
              <div className="space-y-2">
                {keysList.map((k) => (
                  <div key={k.id} className="rounded-md border p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium">{k.name}</div>
                        <code className="mt-1 block rounded bg-muted/50 px-2 py-1 font-mono text-xs text-muted-foreground">
                          {k.key}
                        </code>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {t('developer.createdAt')}: {k.createdAt}
                          {k.lastUsedAt && ` · ${t('developer.lastUsed')}: ${k.lastUsedAt}`}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button size="sm" variant="ghost" onClick={() => onCopyKey(k.key)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <HasPermi code="ai:developer:add">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setResetTarget({ id: k.id, name: k.name })}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </HasPermi>
                        <HasPermi code="ai:developer:remove">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            disabled={delKeyPending}
                            onClick={() => {
                              if (confirm(t('developer.keyDeleteConfirm'))) onDeleteKey(k.id)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </HasPermi>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Webhook className="h-4 w-4" />
              {t('developer.webhooks')}
            </CardTitle>
            <HasPermi code="ai:developer:add">
              <Button size="sm" variant="outline" onClick={onCreateWebhook}>
                <Plus className="h-4 w-4" />
                {t('developer.createWebhook')}
              </Button>
            </HasPermi>
          </CardHeader>
          <CardContent>
            {webhooksList.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t('developer.noData')}
              </p>
            ) : (
              <div className="space-y-2">
                {webhooksList.map((w) => (
                  <div key={w.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <code className="break-all font-mono text-xs">{w.url}</code>
                      <span
                        className={cn(
                          'ml-2 inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                          w.isEnabled
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            w.isEnabled ? 'bg-emerald-500' : 'bg-muted-foreground/50',
                          )}
                        />
                        {w.isEnabled ? t('developer.enabled') : t('developer.disabled')}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {w.events.map((e) => (
                        <span
                          key={e}
                          className="inline-flex rounded bg-primary/10 px-2 py-0.5 text-xs text-primary"
                        >
                          {e}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Package className="h-5 w-5" />
          {t('developer.sdkDownloads')}
        </h2>
        {sdksList.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
            {t('developer.noData')}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {sdksList.map((s) => (
              <Card key={s.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">{s.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {s.language} · {s.version}
                      </div>
                    </div>
                    <Download className="h-4 w-4 text-primary" />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 w-full"
                    onClick={() => toast.success(t('developer.downloadStart'))}
                  >
                    <Download className="h-4 w-4" />
                    {t('developer.download')}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Dialog open={!!resetTarget} onOpenChange={(o) => !o && !resetPending && setResetTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重置密钥</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            确定要重置「{resetTarget?.name}」的密钥吗？重置后旧密钥立即失效，需更新所有接入方，确认？
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTarget(null)} disabled={resetPending}>
              {tc('cancel')}
            </Button>
            <Button onClick={handleResetConfirm} disabled={resetPending}>
              {resetPending && <Loader2 className="h-4 w-4 animate-spin" />}
              确认重置
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetSecret} onOpenChange={(o) => !o && setResetSecret(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新密钥已生成</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-amber-600 dark:text-amber-400">
              ⚠ 此密钥仅显示一次，请立即保存，关闭后无法找回。旧密钥已失效。
            </p>
            <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-3">
              <code className="flex-1 break-all font-mono text-sm">{resetSecret}</code>
              <Button
                size="sm"
                variant="ghost"
                className="shrink-0"
                onClick={() => resetSecret && copySecret(resetSecret)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setResetSecret(null)}>我已保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
