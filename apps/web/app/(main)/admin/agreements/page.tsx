'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, FileText, Plus } from 'lucide-react'
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
} from '@ihui/ui'

interface Agreement {
  id: string
  type: string
  title: string
  content: string
  version: string
  effectiveDate: string
  status: number
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const AGREEMENT_TYPES = ['user-agreement', 'privacy-policy', 'terms-of-service'] as const
const th = 'px-4 py-2.5 font-medium'
const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

const EMPTY = {
  type: 'user-agreement' as string,
  title: '',
  content: '',
  version: '',
  effectiveDate: '',
  status: 1,
}

function toDatetimeLocalValue(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function AgreementsPage() {
  const t = useTranslations('admin.agreements')
  const tc = useTranslations('common')
  const qc = useQueryClient()
  const [currentPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Agreement | null>(null)
  const [form, setForm] = React.useState(EMPTY)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'agreements', currentPage],
    queryFn: () => api<{ list: Agreement[] }>('/api/admin/agreements'),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const effectiveDateISO = form.effectiveDate
        ? new Date(form.effectiveDate).toISOString()
        : new Date().toISOString()
      const body = {
        type: form.type,
        title: form.title,
        content: form.content,
        version: form.version,
        effectiveDate: effectiveDateISO,
        status: form.status,
      }
      return editing
        ? api<Agreement>(`/api/admin/agreements/${editing.id}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          })
        : api<Agreement>('/api/admin/agreements', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'agreements'] })
      toast.success(editing ? '更新成功' : '创建成功')
      close()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api<void>(`/api/admin/agreements/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'agreements'] })
      toast.success('删除成功')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setOpen(true)
  }
  function openEdit(item: Agreement) {
    setEditing(item)
    setForm({
      type: item.type,
      title: item.title,
      content: item.content,
      version: item.version,
      effectiveDate: toDatetimeLocalValue(item.effectiveDate),
      status: item.status,
    })
    setOpen(true)
  }
  function close() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) {
      toast.error('请输入标题')
      return
    }
    if (!form.content.trim()) {
      toast.error('请输入内容')
      return
    }
    if (!form.version.trim()) {
      toast.error('请输入版本号')
      return
    }
    saveMut.mutate()
  }

  const list = data?.list ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {tc('create')}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className={th}>{t('colType')}</th>
              <th className={th}>{t('colTitle')}</th>
              <th className={th}>{t('colVersion')}</th>
              <th className={th}>{t('colStatus')}</th>
              <th className={th}>{t('colActions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {t('loading')}
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <FileText className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('noData')}
                </td>
              </tr>
            ) : (
              list.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">{item.type}</td>
                  <td className="px-4 py-2.5">{item.title}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{item.version}</td>
                  <td className="px-4 py-2.5">
                    {item.status === 1 ? t('enabled') : t('disabled')}
                  </td>
                  <td className="px-4 py-2.5 space-x-2">
                    <button className="text-primary hover:underline" onClick={() => openEdit(item)}>
                      {t('edit')}
                    </button>
                    <button
                      className="text-destructive hover:underline"
                      onClick={() => {
                        if (confirm('确认删除该协议？')) deleteMut.mutate(item.id)
                      }}
                      disabled={deleteMut.isPending}
                    >
                      {tc('delete')}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? '编辑协议' : '新增协议'}</DialogTitle>
              <DialogDescription>{editing ? '修改协议信息' : '添加新的协议'}</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ag-type">{t('colType')}</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger className={selectClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGREEMENT_TYPES.map((tp) => (
                      <SelectItem key={tp} value={tp}>
                        {tp}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ag-version">{t('colVersion')}</Label>
                <Input
                  id="ag-version"
                  value={form.version}
                  onChange={(e) => setForm({ ...form, version: e.target.value })}
                  placeholder="如 v1.0.0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ag-title">{t('colTitle')}</Label>
              <Input
                id="ag-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="请输入协议标题"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ag-content">协议内容</Label>
              <textarea
                id="ag-content"
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="请输入协议内容"
                rows={6}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ag-date">生效日期</Label>
                <Input
                  id="ag-date"
                  type="datetime-local"
                  value={form.effectiveDate}
                  onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ag-status">{t('colStatus')}</Label>
                <Select
                  value={String(form.status)}
                  onValueChange={(v) => setForm({ ...form, status: Number(v) })}
                >
                  <SelectTrigger className={selectClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">{t('enabled')}</SelectItem>
                    <SelectItem value="0">{t('disabled')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} disabled={saveMut.isPending}>
                {tc('cancel')}
              </Button>
              <Button type="submit" disabled={saveMut.isPending}>
                {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {tc('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
