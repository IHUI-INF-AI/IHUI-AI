'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Settings, Plus, Edit, Trash2, Search } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Button,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
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
} from '@ihui/ui'
import { cn } from '@/lib/utils'

type Category = 'general' | 'mail' | 'storage' | 'security' | 'payment' | 'ai' | 'system'
type CfgType = 'string' | 'number' | 'boolean' | 'json'

interface SystemConfig {
  id: string
  key: string
  value: string
  type: CfgType
  category: Category
  isPublic: boolean
  description: string | null
  updatedAt: string | null
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const CATEGORIES: Category[] = ['general', 'mail', 'storage', 'security', 'payment', 'ai', 'system']
const TYPES: CfgType[] = ['string', 'number', 'boolean', 'json']
const CATEGORY_LABEL: Record<Category, string> = {
  general: '通用',
  mail: '邮件',
  storage: '存储',
  security: '安全',
  payment: '支付',
  ai: 'AI',
  system: '系统',
}
const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const textareaClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const EMPTY = {
  key: '',
  value: '',
  type: 'string' as CfgType,
  category: 'system' as Category,
  isPublic: false,
  description: '',
}

export default function AdminSystemConfigPage() {
  const qc = useQueryClient()
  const [category, setCategory] = React.useState<'all' | Category>('all')
  const [search, setSearch] = React.useState('')
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<SystemConfig | null>(null)
  const [form, setForm] = React.useState(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['admin', 'system', 'config', category],
    queryFn: () => {
      const qs = new URLSearchParams()
      if (category !== 'all') qs.set('category', category)
      return api<{ list: SystemConfig[] }>(`/api/admin/system/config?${qs.toString()}`).then(
        (d) => d.list ?? [],
      )
    },
  })

  const filtered = React.useMemo(() => {
    const kw = search.trim().toLowerCase()
    if (!kw) return list
    return list.filter((c) => `${c.key} ${c.description ?? ''}`.toLowerCase().includes(kw))
  }, [list, search])

  const saveMut = useMutation({
    mutationFn: () => {
      const body = { ...form }
      return editing
        ? api(`/api/admin/system/config/${editing.id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
          })
        : api('/api/admin/system/config', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'system', 'config'] })
      setOpen(false)
    },
    onError: (e: Error) => setErr(e.message),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/system/config/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'system', 'config'] }),
  })

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  const openEdit = (c: SystemConfig) => {
    setEditing(c)
    setForm({
      key: c.key,
      value: c.value,
      type: c.type,
      category: c.category,
      isPublic: c.isPublic,
      description: c.description ?? '',
    })
    setErr(null)
    setOpen(true)
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (!form.key.trim()) {
      setErr('请输入配置键')
      return
    }
    saveMut.mutate()
  }

  const tabCls = (active: boolean) =>
    cn(
      'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
      active
        ? 'bg-background text-foreground shadow-sm'
        : 'text-muted-foreground hover:text-foreground',
    )

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Settings className="h-6 w-6 text-primary" />
            系统配置
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">系统参数与配置项管理</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          新建
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-1">
          <button onClick={() => setCategory('all')} className={tabCls(category === 'all')}>
            全部
          </button>
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCategory(c)} className={tabCls(category === c)}>
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索配置键"
            className="h-9 pl-8"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs uppercase">键</TableHead>
              <TableHead className="text-xs uppercase">值</TableHead>
              <TableHead className="text-xs uppercase">类型</TableHead>
              <TableHead className="text-xs uppercase">分类</TableHead>
              <TableHead className="text-xs uppercase">公开</TableHead>
              <TableHead className="text-xs uppercase">更新时间</TableHead>
              <TableHead className="text-right text-xs uppercase">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  暂无配置
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="font-medium">{c.key}</div>
                    {c.description && (
                      <div className="text-xs text-muted-foreground">{c.description}</div>
                    )}
                  </TableCell>
                  <TableCell
                    className="max-w-[200px] break-words font-mono text-xs text-muted-foreground"
                    title={c.value}
                  >
                    {c.value || '-'}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs">
                      {c.type}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {CATEGORY_LABEL[c.category]}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs',
                        c.isPublic
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          c.isPublic ? 'bg-emerald-500' : 'bg-muted-foreground/50',
                        )}
                      />
                      {c.isPublic ? '公开' : '私有'}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.updatedAt ? new Date(c.updatedAt).toLocaleString() : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm('确认删除？')) delMut.mutate(c.id)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={(o) => (o ? null : (setOpen(false), setErr(null)))}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? '编辑配置' : '新建配置'}</DialogTitle>
              <DialogDescription>系统配置项</DialogDescription>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="sc-key">键</Label>
              <Input
                id="sc-key"
                value={form.key}
                onChange={(e) => setForm({ ...form, key: e.target.value })}
                disabled={!!editing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sc-value">值</Label>
              <textarea
                id="sc-value"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                rows={3}
                className={cn(textareaClass, 'font-mono')}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>类型</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm({ ...form, type: v as CfgType })}
                >
                  <SelectTrigger className={selectClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>分类</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v as Category })}
                >
                  <SelectTrigger className={selectClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CATEGORY_LABEL[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sc-desc">描述</Label>
              <Input
                id="sc-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isPublic}
                onChange={(e) => setForm({ ...form, isPublic: e.target.checked })}
                className="h-4 w-4 accent-primary"
              />
              公开（前端可见）
            </label>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={saveMut.isPending}
              >
                取消
              </Button>
              <Button type="submit" disabled={saveMut.isPending}>
                {saveMut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}保存
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
