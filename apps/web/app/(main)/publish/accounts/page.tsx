'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Pencil, Trash2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@ihui/ui'

interface Account {
  id: string
  platform: string
  nickname: string
  status: 'active' | 'disabled' | 'expired'
  last_verified_at?: string | null
  credentials?: Record<string, unknown>
}

const PLATFORMS = [
  'wordpress',
  'medium',
  'youtube',
  'bilibili',
  'wechat',
  'toutiao',
  'douyin',
  'kuaishou',
  'weibo',
  'zhihu',
  'csdn',
  'juejin',
  'xiaohongshu',
  'shipinhao',
] as const

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  disabled: 'bg-muted text-muted-foreground',
  expired: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
}

const TIME_FMT = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Shanghai',
})

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function AccountsPage() {
  const t = useTranslations('publish')
  const tc = useTranslations('common')
  const toast = useToast()
  const [accounts, setAccounts] = React.useState<Account[]>([])
  const [loading, setLoading] = React.useState(true)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Account | null>(null)
  const [form, setForm] = React.useState({
    platform: 'wordpress',
    nickname: '',
    credentialsJson: '{}',
  })
  const [saving, setSaving] = React.useState(false)
  const [verifyingId, setVerifyingId] = React.useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<Account | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const data = await api<{ items?: Account[]; list?: Account[] } | Account[]>(
        '/api/publish/accounts/me',
      )
      const list = Array.isArray(data) ? data : (data.items ?? data.list ?? [])
      setAccounts(list)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [toast])

  React.useEffect(() => {
    void load()
  }, [load])

  function openAdd() {
    setEditing(null)
    setForm({ platform: 'wordpress', nickname: '', credentialsJson: '{}' })
    setDialogOpen(true)
  }
  function openEdit(a: Account) {
    setEditing(a)
    setForm({
      platform: a.platform,
      nickname: a.nickname,
      credentialsJson: a.credentials ? JSON.stringify(a.credentials, null, 2) : '{}',
    })
    setDialogOpen(true)
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const body = JSON.stringify({
        platform: form.platform,
        nickname: form.nickname,
        credentials: JSON.parse(form.credentialsJson || '{}'),
        userId: 'me',
      })
      if (editing) {
        await api(`/api/publish/accounts/${editing.id}`, {
          method: 'PUT',
          body,
          headers: { 'Content-Type': 'application/json' },
        })
      } else {
        await api('/api/publish/accounts', {
          method: 'POST',
          body,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      setDialogOpen(false)
      toast.success(editing ? t('accounts.edit') : t('accounts.add'))
      void load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }
  async function verify(a: Account) {
    setVerifyingId(a.id)
    try {
      await api(`/api/publish/accounts/${a.id}/verify`, { method: 'POST' })
      toast.success(t('accounts.verifySuccess'))
      void load()
    } catch (e) {
      toast.error(t('accounts.verifyFailed'), (e as Error).message)
    } finally {
      setVerifyingId(null)
    }
  }
  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await api(`/api/publish/accounts/${deleteTarget.id}`, { method: 'DELETE' })
      toast.success(t('accounts.delete'))
      setDeleteOpen(false)
      setDeleteTarget(null)
      void load()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">{t('accounts.title')}</h2>
          <p className="text-xs text-muted-foreground">{t('accounts.subtitle')}</p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4" />
          {t('accounts.add')}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12">
          <AlertCircle className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('accounts.noAccounts')}</p>
          <Button size="sm" variant="outline" onClick={openAdd}>
            <Plus className="h-4 w-4" />
            {t('accounts.add')}
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((a) => (
            <Card key={a.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{a.nickname}</div>
                    <div className="text-xs text-muted-foreground">
                      {t(`platforms.${a.platform}`)}
                    </div>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-md px-2 py-0.5 text-xs font-medium',
                      STATUS_STYLE[a.status] ?? STATUS_STYLE.disabled,
                    )}
                  >
                    {t(
                      `accounts.status${a.status.charAt(0).toUpperCase()}${a.status.slice(1)}` as `accounts.status${Capitalize<Account['status']>}`,
                    )}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {t('accounts.lastVerified')}:{' '}
                  {a.last_verified_at ? TIME_FMT.format(new Date(a.last_verified_at)) : '-'}
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => verify(a)}
                    disabled={verifyingId === a.id}
                    className="h-7 text-xs"
                  >
                    {verifyingId === a.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3" />
                    )}
                    {t('accounts.verify')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEdit(a)}
                    className="h-7 text-xs"
                  >
                    <Pencil className="h-3 w-3" />
                    {t('accounts.edit')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-destructive hover:text-destructive"
                    onClick={() => {
                      setDeleteTarget(a)
                      setDeleteOpen(true)
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                    {t('accounts.delete')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => !saving && setDialogOpen(o)}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? t('accounts.edit') : t('accounts.add')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label>{t('accounts.platform')}</Label>
              <Select
                value={form.platform}
                onValueChange={(v) => setForm({ ...form, platform: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {t(`platforms.${p}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('accounts.nickname')}</Label>
              <Input
                value={form.nickname}
                onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{t('accounts.credentials')}</Label>
              <textarea
                value={form.credentialsJson}
                onChange={(e) => setForm({ ...form, credentialsJson: e.target.value })}
                rows={5}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs font-mono shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder={t('accounts.credentialsHint')}
              />
              <p className="text-xs text-muted-foreground">{t('accounts.credentialsHint')}</p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                {tc('cancel')}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? tc('save') : tc('create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('accounts.delete')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t('accounts.deleteConfirm')}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              {tc('confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
