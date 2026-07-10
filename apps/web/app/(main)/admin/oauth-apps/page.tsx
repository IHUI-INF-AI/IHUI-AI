'use client'

import * as React from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, Plus, Trash2, KeyRound, ShieldCheck, Copy, AlertTriangle } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@ihui/ui'

interface OAuthApp {
  id: string
  name: string
  clientId: string
  redirectUris: string[]
  scopes: string[]
  isActive: number | boolean
  createdAt: string
  clientSecret?: string
}

interface ScopeMeta {
  scope: string
  name: string
  description: string
}

const textareaClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

const EMPTY = { name: '', redirectUris: '', scopes: '' }

export default function AdminOAuthAppsPage() {
  const t = useTranslations('oauth')
  const tc = useTranslations('common')
  const locale = useLocale()

  const [apps, setApps] = React.useState<OAuthApp[]>([])
  const [scopeMeta, setScopeMeta] = React.useState<ScopeMeta[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [createOpen, setCreateOpen] = React.useState(false)
  const [form, setForm] = React.useState(EMPTY)
  const [formErr, setFormErr] = React.useState<string | null>(null)
  const [creating, setCreating] = React.useState(false)
  const [createdSecret, setCreatedSecret] = React.useState<{ name: string; clientId: string; clientSecret: string } | null>(null)

  const [delTarget, setDelTarget] = React.useState<OAuthApp | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await fetchApi<{ items: OAuthApp[] }>('/api/auth/oauth/apps/list')
    if (!res.success) setError(res.error)
    else setApps(res.data.items ?? [])
    setLoading(false)
  }, [])

  const loadScopeMeta = React.useCallback(async () => {
    const res = await fetchApi<{ items: ScopeMeta[] }>('/api/auth/oauth/scope-meta')
    if (res.success) setScopeMeta(res.data.items ?? [])
  }, [])

  React.useEffect(() => {
    void load()
    void loadScopeMeta()
  }, [load, loadScopeMeta])

  const closeCreate = () => {
    if (creating) return
    setCreateOpen(false)
    setForm(EMPTY)
    setFormErr(null)
  }

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormErr(null)
    if (!form.name.trim()) {
      setFormErr(t('appNamePlaceholder'))
      return
    }
    const redirectUris = form.redirectUris
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (redirectUris.length === 0) {
      setFormErr(t('redirectUrisPlaceholder'))
      return
    }
    const scopes = form.scopes
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    setCreating(true)
    const res = await fetchApi<OAuthApp>('/api/auth/oauth/apps/create', {
      method: 'POST',
      body: JSON.stringify({ name: form.name.trim(), redirectUris, scopes }),
    })
    setCreating(false)
    if (!res.success) {
      setFormErr(res.error)
      return
    }
    setCreatedSecret({
      name: res.data.name,
      clientId: res.data.clientId,
      clientSecret: res.data.clientSecret ?? '',
    })
    closeCreate()
    void load()
  }

  const onDelete = async () => {
    if (!delTarget) return
    setDeleting(true)
    const res = await fetchApi(`/api/auth/oauth/apps/${delTarget.clientId}`, { method: 'DELETE' })
    setDeleting(false)
    if (!res.success) {
      setFormErr(res.error)
      return
    }
    setDelTarget(null)
    setApps((prev) => prev.filter((a) => a.clientId !== delTarget.clientId))
  }

  const copyText = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(text)
    }
  }

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <KeyRound className="h-6 w-6 text-primary" />
              {t('apps')}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{t('appsDesc')}</p>
          </div>
          <Button size="sm" onClick={() => { setForm(EMPTY); setFormErr(null); setCreateOpen(true) }}>
            <Plus className="h-4 w-4" />
            {t('createApp')}
          </Button>
        </div>

        {error && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs uppercase">{t('appName')}</TableHead>
                <TableHead className="text-xs uppercase">{t('clientId')}</TableHead>
                <TableHead className="text-xs uppercase">{t('redirectUris')}</TableHead>
                <TableHead className="text-xs uppercase">{t('status')}</TableHead>
                <TableHead className="text-xs uppercase">{t('createdAt')}</TableHead>
                <TableHead className="text-right text-xs uppercase">{tc('delete')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : apps.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    {t('noAuthorizations')}
                  </TableCell>
                </TableRow>
              ) : (
                apps.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs">{a.clientId}</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyText(a.clientId)}>
                              <Copy className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t('copyClientId')}</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      <div className="space-y-0.5 text-xs text-muted-foreground">
                        {(a.redirectUris ?? []).map((u) => (
                          <div key={u} className="truncate">{u}</div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {a.isActive ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-xs text-emerald-600 dark:text-emerald-500">
                          <ShieldCheck className="h-3 w-3" />
                          {t('active')}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">{t('inactive')}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {dateFmt.format(new Date(a.createdAt))}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setFormErr(null); setDelTarget(a) }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {t('deleteApp')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {scopeMeta.length > 0 && (
          <div className="rounded-lg border p-4">
            <h2 className="mb-2 text-sm font-medium">{t('scopeMeta')}</h2>
            <div className="flex flex-wrap gap-2">
              {scopeMeta.map((s) => (
                <span key={s.scope} className="inline-flex rounded bg-muted px-2 py-1 text-xs" title={s.description}>
                  {s.name}
                  <span className="ml-1 text-muted-foreground">({s.scope})</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 创建应用 */}
        <Dialog open={createOpen} onOpenChange={(o) => (o ? null : closeCreate())}>
          <DialogContent>
            <form onSubmit={onCreate} className="space-y-4">
              <DialogHeader>
                <DialogTitle>{t('createApp')}</DialogTitle>
                <DialogDescription>{t('appsDesc')}</DialogDescription>
              </DialogHeader>
              {formErr && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{formErr}</div>
              )}
              <div className="space-y-2">
                <Label htmlFor="oa-name">{t('appName')}</Label>
                <Input
                  id="oa-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={t('appNamePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="oa-redirect">{t('redirectUris')}</Label>
                <textarea
                  id="oa-redirect"
                  value={form.redirectUris}
                  onChange={(e) => setForm({ ...form, redirectUris: e.target.value })}
                  placeholder={t('redirectUrisPlaceholder')}
                  rows={2}
                  className={textareaClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="oa-scopes">{t('scopes')}</Label>
                <textarea
                  id="oa-scopes"
                  value={form.scopes}
                  onChange={(e) => setForm({ ...form, scopes: e.target.value })}
                  placeholder={t('scopeMeta')}
                  rows={2}
                  className={textareaClass}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeCreate} disabled={creating}>
                  {tc('cancel')}
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                  {tc('create')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* 创建成功展示 Secret */}
        <Dialog open={!!createdSecret} onOpenChange={(o) => (o ? null : setCreatedSecret(null))}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                {t('createSuccess')}
              </DialogTitle>
              <DialogDescription>{t('secretWarning')}</DialogDescription>
            </DialogHeader>
            {createdSecret && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>{t('appName')}</Label>
                  <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">{createdSecret.name}</div>
                </div>
                <div className="space-y-1">
                  <Label>{t('clientId')}</Label>
                  <div className="flex items-center gap-1">
                    <code className="flex-1 truncate rounded-md bg-muted/50 px-3 py-2 text-xs">
                      {createdSecret.clientId}
                    </code>
                    <Button size="icon" variant="outline" onClick={() => copyText(createdSecret.clientId)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>{t('clientSecret')}</Label>
                  <div className="flex items-center gap-1">
                    <code className="flex-1 truncate rounded-md bg-amber-500/10 px-3 py-2 text-xs">
                      {createdSecret.clientSecret}
                    </code>
                    <Button size="icon" variant="outline" onClick={() => copyText(createdSecret.clientSecret)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button type="button" onClick={() => setCreatedSecret(null)}>
                {tc('confirm')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 删除确认 */}
        <Dialog open={!!delTarget} onOpenChange={(o) => (o ? null : (setDelTarget(null), setFormErr(null)))}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('deleteApp')}</DialogTitle>
              <DialogDescription>{t('deleteAppConfirm')}</DialogDescription>
            </DialogHeader>
            {formErr && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{formErr}</div>}
            {delTarget && (
              <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                <span className="font-medium">{delTarget.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">{delTarget.clientId}</span>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDelTarget(null)} disabled={deleting}>
                {tc('cancel')}
              </Button>
              <Button type="button" variant="destructive" disabled={deleting} onClick={onDelete}>
                {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                {tc('delete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
