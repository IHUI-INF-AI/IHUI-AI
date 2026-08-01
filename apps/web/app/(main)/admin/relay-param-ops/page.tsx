'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Trash2, Save, Loader2, AlertCircle, RefreshCw, Play, Pencil } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  Label,
  Badge,
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
} from '@ihui/ui-react'
import { Skeleton } from '@/components/ui/skeleton'

/** 后端 ParamOpRule 契约(简化版,ops 用 unknown[] 避免 any)。 */
interface ParamOpRule {
  id: string
  name: string
  enabled: boolean
  priority: number
  matchConditions: { model?: string; channelId?: string; global?: boolean }
  ops: unknown[]
  createdAt?: string
  updatedAt?: string
}

/** dry-run 响应契约。 */
interface DryRunResult {
  originalBody: Record<string, unknown>
  modifiedBody: Record<string, unknown>
  appliedRules: Array<{ id: string; name: string; priority: number }>
  modified: boolean
}

const fmtTime = (iso?: string): string => {
  if (!iso) return '-'
  try {
    return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
  } catch {
    return iso
  }
}

export default function AdminRelayParamOpsPage() {
  const t = useTranslations('admin.relayParamOps')
  const qc = useQueryClient()
  const queryKey = ['admin', 'relay-param-ops']
  const [editOpen, setEditOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ParamOpRule | null>(null)
  const [form, setForm] = React.useState({
    name: '',
    priority: 0,
    enabled: true,
    model: '',
    channelId: '',
    global: false,
    opsText: '[]',
  })
  const [dryRunOpen, setDryRunOpen] = React.useState(false)
  const [dryRunRule, setDryRunRule] = React.useState<ParamOpRule | null>(null)
  const [sampleBody, setSampleBody] = React.useState('{\n  "model": "gpt-4",\n  "messages": []\n}')
  const [dryRunResult, setDryRunResult] = React.useState<DryRunResult | null>(null)

  const { data: rules, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const r = await fetchApi<ParamOpRule[]>('/api/admin/relay-param-ops')
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })

  const invalidate = () => qc.invalidateQueries({ queryKey })

  const saveMut = useMutation({
    mutationFn: async () => {
      let ops: unknown
      try {
        ops = JSON.parse(form.opsText)
      } catch (e) {
        throw new Error(t('opsParseFailed', { msg: e instanceof Error ? e.message : String(e) }))
      }
      const payload = {
        name: form.name,
        enabled: form.enabled,
        priority: Number(form.priority) || 0,
        matchConditions: {
          ...(form.model ? { model: form.model } : {}),
          ...(form.channelId ? { channelId: form.channelId } : {}),
          ...(form.global ? { global: true } : {}),
        },
        ops,
      }
      const url = editing
        ? `/api/admin/relay-param-ops/${encodeURIComponent(editing.id)}`
        : '/api/admin/relay-param-ops'
      const r = await fetchApi<ParamOpRule>(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: () => {
      toast.success(editing ? t('updated') : t('created'))
      setEditOpen(false)
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetchApi<{ id: string }>(`/api/admin/relay-param-ops/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: () => {
      toast.success(t('deleted'))
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const dryRunMut = useMutation({
    mutationFn: async () => {
      if (!dryRunRule) throw new Error(t('noRuleSelected'))
      let body: Record<string, unknown>
      try {
        body = JSON.parse(sampleBody)
      } catch (e) {
        throw new Error(t('bodyParseFailed', { msg: e instanceof Error ? e.message : String(e) }))
      }
      const r = await fetchApi<DryRunResult>(
        `/api/admin/relay-param-ops/${encodeURIComponent(dryRunRule.id)}/dry-run`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sampleBody: body }),
        },
      )
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: setDryRunResult,
    onError: (e: Error) => toast.error(e.message),
  })

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', priority: 0, enabled: true, model: '', channelId: '', global: false, opsText: '[]' })
    setEditOpen(true)
  }

  const openEdit = (rule: ParamOpRule) => {
    setEditing(rule)
    setForm({
      name: rule.name,
      priority: rule.priority,
      enabled: rule.enabled,
      model: rule.matchConditions.model ?? '',
      channelId: rule.matchConditions.channelId ?? '',
      global: rule.matchConditions.global ?? false,
      opsText: JSON.stringify(rule.ops, null, 2),
    })
    setEditOpen(true)
  }

  const openDryRun = (rule: ParamOpRule) => {
    setDryRunRule(rule)
    setDryRunResult(null)
    setSampleBody('{\n  "model": "gpt-4",\n  "messages": []\n}')
    setDryRunOpen(true)
  }

  const matchLabel = (mc: ParamOpRule['matchConditions']): string => {
    if (mc.global) return t('matchGlobal')
    const parts: string[] = []
    if (mc.model) parts.push(`model=${mc.model}`)
    if (mc.channelId) parts.push(`channel=${mc.channelId}`)
    return parts.length > 0 ? parts.join(' / ') : t('matchUnset')
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">{t('title')}</h1>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-3 w-3" /> {t('retry')}
          </Button>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <div className="text-sm text-muted-foreground">{(error as Error).message || t('loadFailed')}</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-3 w-3" /> {t('refresh')}
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-3 w-3" /> {t('new')}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('list')}</CardTitle>
          <CardDescription>{t('listDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('name')}</TableHead>
                  <TableHead>{t('priority')}</TableHead>
                  <TableHead>{t('matchConditions')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead>{t('updatedAt')}</TableHead>
                  <TableHead className="text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rules ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      {t('empty')}
                    </TableCell>
                  </TableRow>
                ) : (
                  (rules ?? []).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="tabular-nums">{r.priority}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{matchLabel(r.matchConditions)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.enabled ? 'secondary' : 'destructive'}>
                          {r.enabled ? t('enabled') : t('disabled')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtTime(r.updatedAt ?? r.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-9 px-3" onClick={() => openEdit(r)}>
                            <Pencil className="h-3 w-3" /> {t('edit')}
                          </Button>
                          <Button variant="ghost" size="sm" className="h-9 px-3" onClick={() => openDryRun(r)}>
                            <Play className="h-3 w-3" /> {t('dryRun')}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm(t('deleteConfirm', { name: r.name }))) deleteMut.mutate(r.id)
                            }}
                            aria-label={t('delete')}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 编辑/新建 Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? t('editTitle') : t('createTitle')}</DialogTitle>
            <DialogDescription>{t('editDesc')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{t('nameLabel')}</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="GPT-4 temperature=0.2"
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('priorityLabel')}</Label>
                <Input
                  type="number"
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) || 0 }))}
                  className="h-8"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">{t('modelLabel')}</Label>
                <Input
                  value={form.model}
                  onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                  placeholder="gpt-4"
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('channelIdLabel')}</Label>
                <Input
                  value={form.channelId}
                  onChange={(e) => setForm((f) => ({ ...f, channelId: e.target.value }))}
                  placeholder="channel id"
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('globalLabel')}</Label>
                <label className="flex h-8 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.global}
                    onChange={(e) => setForm((f) => ({ ...f, global: e.target.checked }))}
                    className="h-4 w-4"
                  />
                  <span className="text-xs text-muted-foreground">{t('globalHint')}</span>
                </label>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('enabledLabel')}</Label>
              <label className="flex h-8 items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                  className="h-4 w-4"
                />
                <span className="text-xs text-muted-foreground">{t('enabledHint')}</span>
              </label>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('opsLabel')}</Label>
              <textarea
                value={form.opsText}
                onChange={(e) => setForm((f) => ({ ...f, opsText: e.target.value }))}
                rows={10}
                className="w-full rounded-md border border-border bg-background p-2 font-mono text-xs"
                placeholder='[{"op":"set","path":"temperature","value":0.2}]'
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !form.name.trim()}>
              {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* dry-run 预览 Dialog */}
      <Dialog open={dryRunOpen} onOpenChange={setDryRunOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('dryRunTitle', { name: dryRunRule?.name ?? '' })}</DialogTitle>
            <DialogDescription>{t('dryRunDesc')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">{t('dryRunInput')}</Label>
              <textarea
                value={sampleBody}
                onChange={(e) => setSampleBody(e.target.value)}
                rows={8}
                className="w-full rounded-md border border-border bg-background p-2 font-mono text-xs"
              />
            </div>
            <Button size="sm" onClick={() => dryRunMut.mutate()} disabled={dryRunMut.isPending}>
              {dryRunMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
              {t('dryRunRun')}
            </Button>
            {dryRunResult && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">{t('dryRunOriginal')}</Label>
                  <pre className="max-h-64 overflow-auto rounded-md border border-border bg-muted/30 p-2 text-xs">
                    {JSON.stringify(dryRunResult.originalBody, null, 2)}
                  </pre>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">
                    {dryRunResult.modified ? t('dryRunModified') : t('dryRunNoChange')}
                  </Label>
                  <pre className="max-h-64 overflow-auto rounded-md border border-border bg-muted/30 p-2 text-xs">
                    {JSON.stringify(dryRunResult.modifiedBody, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDryRunOpen(false)}>
              {t('close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
