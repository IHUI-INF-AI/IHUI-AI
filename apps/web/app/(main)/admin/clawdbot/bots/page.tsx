'use client'

import * as React from 'react'
import { useLocale } from 'next-intl'
import { Bot, Plus, Loader2, Trash2, Pencil, Play, Square } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button, Input, Label } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'

interface BotItem {
  id: string
  name: string
  description?: string
  model: string
  enabled: boolean
  createdAt: number
}

type BotsData = { list: BotItem[] } | BotItem[]

const EMPTY_FORM = { name: '', description: '', model: 'gpt-4' }

export default function ClawdbotBotsPage() {
  const locale = useLocale()
  const [bots, setBots] = React.useState<BotItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [showForm, setShowForm] = React.useState(false)
  const [editing, setEditing] = React.useState<BotItem | null>(null)
  const [form, setForm] = React.useState(EMPTY_FORM)
  const [saving, setSaving] = React.useState(false)
  const timeFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const load = React.useCallback(async () => {
    const res = await fetchApi<BotsData>('/api/admin/clawdbot/bots')
    if (res.success && res.data) {
      const d = res.data
      setBots(Array.isArray(d) ? d : (d.list ?? []))
    } else if (!res.success) {
      setError(res.error)
    }
    setLoading(false)
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  const openEdit = (b: BotItem) => {
    setEditing(b)
    setForm({ name: b.name, description: b.description ?? '', model: b.model })
    setShowForm(true)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    const body = JSON.stringify(form)
    const res = editing
      ? await fetchApi(`/api/admin/clawdbot/bots/${editing.id}`, { method: 'PUT', body })
      : await fetchApi('/api/admin/clawdbot/bots', { method: 'POST', body })
    setSaving(false)
    if (res.success) {
      setShowForm(false)
      void load()
    } else {
      setError(res.error)
    }
  }

  const toggle = async (b: BotItem) => {
    const res = await fetchApi(`/api/admin/clawdbot/bots/${b.id}/${b.enabled ? 'stop' : 'start'}`, {
      method: 'POST',
    })
    if (res.success) void load()
  }

  const remove = async (b: BotItem) => {
    if (!confirm(`确定删除 Bot "${b.name}"?`)) return
    const res = await fetchApi(`/api/admin/clawdbot/bots/${b.id}`, { method: 'DELETE' })
    if (res.success) void load()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 加载中...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Bot className="h-6 w-6 text-primary" /> Bot 管理
        </h1>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" /> 创建 Bot
        </Button>
      </div>

      {error && <Alert variant="danger" title="操作失败" description={error} />}

      {showForm && (
        <form onSubmit={submit} className="space-y-3 rounded-lg border bg-card p-4">
          <div className="space-y-1">
            <Label>名称</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Bot 名称"
            />
          </div>
          <div className="space-y-1">
            <Label>描述</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="可选描述"
            />
          </div>
          <div className="space-y-1">
            <Label>模型</Label>
            <Input
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              placeholder="如 gpt-4"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : '保存'}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              取消
            </Button>
          </div>
        </form>
      )}

      <div className="rounded-lg border bg-card">
        <div className="divide-y">
          {bots.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              暂无 Bot
            </div>
          ) : (
            bots.map((b) => (
              <div key={b.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{b.name}</p>
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-xs',
                        b.enabled
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {b.enabled ? '运行中' : '已停止'}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {b.model} · {timeFmt.format(new Date(b.createdAt))}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => toggle(b)}>
                    {b.enabled ? (
                      <Square className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4 text-emerald-600" />
                    )}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(b)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(b)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
