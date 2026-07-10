'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Code2, KeyRound, Webhook, Download, Plus, Trash2, Loader2, Copy, Package } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Input, Label, Card, CardContent, CardHeader, CardTitle, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface ApiKey {
  id: string
  name: string
  key: string
  createdAt: string
  lastUsedAt?: string
}

interface WebhookConfig {
  id: string
  url: string
  events: string[]
  isEnabled: boolean
}

interface SdkItem {
  id: string
  name: string
  language: string
  version: string
  url: string
}

const MOCK_KEYS: ApiKey[] = [
  { id: '1', name: '生产环境', key: 'sk-prod-xxxxxxxxxxxxxxxxxxxx', createdAt: '2026-05-01', lastUsedAt: '2026-07-10 09:00' },
  { id: '2', name: '测试环境', key: 'sk-test-yyyyyyyyyyyyyyyyyyyy', createdAt: '2026-06-15', lastUsedAt: '2026-07-09 18:24' },
]
const MOCK_WEBHOOKS: WebhookConfig[] = [
  { id: '1', url: 'https://example.com/hooks/order', events: ['order.created', 'order.paid'], isEnabled: true },
  { id: '2', url: 'https://example.com/hooks/user', events: ['user.registered'], isEnabled: false },
]
const MOCK_SDKS: SdkItem[] = [
  { id: '1', name: 'IHUI SDK for Node.js', language: 'JavaScript', version: 'v2.4.1', url: '#download-node-sdk' },
  { id: '2', name: 'IHUI SDK for Python', language: 'Python', version: 'v1.8.0', url: '#download-python-sdk' },
  { id: '3', name: 'IHUI SDK for Java', language: 'Java', version: 'v3.0.2', url: '#download-java-sdk' },
  { id: '4', name: 'IHUI SDK for Go', language: 'Go', version: 'v1.2.0', url: '#download-go-sdk' },
]

const textareaClass = 'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export default function DeveloperPage() {
  const t = useTranslations('adminTools')
  const tc = useTranslations('common')
  const qc = useQueryClient()
  const [keyOpen, setKeyOpen] = React.useState(false)
  const [keyName, setKeyName] = React.useState('')
  const [whOpen, setWhOpen] = React.useState(false)
  const [whForm, setWhForm] = React.useState({ url: '', events: '' })

  const { data: keys = MOCK_KEYS, isLoading } = useQuery({
    queryKey: ['admin', 'developer', 'keys'],
    queryFn: async () => {
      const r = await fetchApi<ApiKey[]>('/api/admin/developer/keys')
      if (r.success && r.data) return r.data
      return MOCK_KEYS
    },
  })
  const { data: webhooks = MOCK_WEBHOOKS } = useQuery({
    queryKey: ['admin', 'developer', 'webhooks'],
    queryFn: async () => {
      const r = await fetchApi<WebhookConfig[]>('/api/admin/developer/webhooks')
      if (r.success && r.data) return r.data
      return MOCK_WEBHOOKS
    },
  })
  const { data: sdks = MOCK_SDKS } = useQuery({
    queryKey: ['admin', 'developer', 'sdks'],
    queryFn: async () => {
      const r = await fetchApi<SdkItem[]>('/api/admin/developer/sdks')
      if (r.success && r.data) return r.data
      return MOCK_SDKS
    },
  })

  const createKeyMut = useMutation({
    mutationFn: () => Promise.resolve(), // TODO: 后端 API 待实现
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'developer', 'keys'] })
      setKeyOpen(false); setKeyName('')
      toast.success(t('developer.keyCreateSuccess'))
    },
  })
  const delKeyMut = useMutation({
    mutationFn: (_id: string) => Promise.resolve(), // TODO: 后端 API 待实现
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'developer', 'keys'] })
      toast.success(t('developer.keyDeleteSuccess'))
    },
  })
  const createWhMut = useMutation({
    mutationFn: () => Promise.resolve(), // TODO: 后端 API 待实现
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'developer', 'webhooks'] })
      setWhOpen(false); setWhForm({ url: '', events: '' })
      toast.success(t('developer.whCreateSuccess'))
    },
  })

  function copyKey(k: string) {
    navigator.clipboard?.writeText(k).then(
      () => toast.success(t('developer.copied')),
      () => toast.error(t('developer.copyFailed')),
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Code2 className="h-6 w-6 text-primary" />
          {t('developer.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('developer.subtitle')}</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />{tc('search')}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* API Key 列表 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="h-4 w-4" />
                {t('developer.apiKeys')}
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => setKeyOpen(true)}>
                <Plus className="h-4 w-4" />{t('developer.createKey')}
              </Button>
            </CardHeader>
            <CardContent>
              {keys.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">{t('developer.noData')}</p>
              ) : (
                <div className="space-y-2">
                  {keys.map((k) => (
                    <div key={k.id} className="rounded-md border p-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium">{k.name}</div>
                          <code className="mt-1 block rounded bg-muted/50 px-2 py-1 font-mono text-xs text-muted-foreground">{k.key}</code>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {t('developer.createdAt')}: {k.createdAt}
                            {k.lastUsedAt && ` · ${t('developer.lastUsed')}: ${k.lastUsedAt}`}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button size="sm" variant="ghost" onClick={() => copyKey(k.key)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={delKeyMut.isPending} onClick={() => { if (confirm(t('developer.keyDeleteConfirm'))) delKeyMut.mutate(k.id) }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Webhook 配置 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Webhook className="h-4 w-4" />
                {t('developer.webhooks')}
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => setWhOpen(true)}>
                <Plus className="h-4 w-4" />{t('developer.createWebhook')}
              </Button>
            </CardHeader>
            <CardContent>
              {webhooks.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">{t('developer.noData')}</p>
              ) : (
                <div className="space-y-2">
                  {webhooks.map((w) => (
                    <div key={w.id} className="rounded-md border p-3">
                      <div className="flex items-center justify-between">
                        <code className="break-all font-mono text-xs">{w.url}</code>
                        <span className={cn('ml-2 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', w.isEnabled ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground')}>
                          <span className={cn('h-1.5 w-1.5 rounded-full', w.isEnabled ? 'bg-emerald-500' : 'bg-muted-foreground/50')} />
                          {w.isEnabled ? t('developer.enabled') : t('developer.disabled')}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {w.events.map((e) => (
                          <span key={e} className="inline-flex rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">{e}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* SDK 下载 */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Package className="h-5 w-5" />
          {t('developer.sdkDownloads')}
        </h2>
        {sdks.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
            {t('developer.noData')}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {sdks.map((s) => (
              <Card key={s.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">{s.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{s.language} · {s.version}</div>
                    </div>
                    <Download className="h-4 w-4 text-primary" />
                  </div>
                  <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => toast.success(t('developer.downloadStart'))}>
                    <Download className="h-4 w-4" />
                    {t('developer.download')}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* 创建 API Key Dialog */}
      <Dialog open={keyOpen} onOpenChange={(o) => (o ? setKeyOpen(true) : !createKeyMut.isPending && setKeyOpen(false))}>
        <DialogContent>
          <form onSubmit={(e) => { e.preventDefault(); if (!keyName.trim()) { toast.error(t('developer.nameRequired')); return } createKeyMut.mutate() }} className="space-y-4">
            <DialogHeader><DialogTitle>{t('developer.createKeyTitle')}</DialogTitle></DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="k-name">{t('developer.fieldName')}</Label>
              <Input id="k-name" value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder={t('developer.namePlaceholder')} autoFocus />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setKeyOpen(false)} disabled={createKeyMut.isPending}>{tc('cancel')}</Button>
              <Button type="submit" disabled={createKeyMut.isPending}>{createKeyMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{tc('save')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 创建 Webhook Dialog */}
      <Dialog open={whOpen} onOpenChange={(o) => (o ? setWhOpen(true) : !createWhMut.isPending && setWhOpen(false))}>
        <DialogContent>
          <form onSubmit={(e) => { e.preventDefault(); if (!whForm.url.trim()) { toast.error(t('developer.urlRequired')); return } createWhMut.mutate() }} className="space-y-4">
            <DialogHeader><DialogTitle>{t('developer.createWebhookTitle')}</DialogTitle></DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="w-url">URL</Label>
              <Input id="w-url" value={whForm.url} onChange={(e) => setWhForm({ ...whForm, url: e.target.value })} placeholder="https://example.com/hooks/..." autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="w-events">{t('developer.fieldEvents')}</Label>
              <textarea id="w-events" value={whForm.events} onChange={(e) => setWhForm({ ...whForm, events: e.target.value })} rows={3} className={textareaClass} placeholder="order.created,order.paid" />
              <p className="text-xs text-muted-foreground">{t('developer.eventsHint')}</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setWhOpen(false)} disabled={createWhMut.isPending}>{tc('cancel')}</Button>
              <Button type="submit" disabled={createWhMut.isPending}>{createWhMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{tc('save')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
