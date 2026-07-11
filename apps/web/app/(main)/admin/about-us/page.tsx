'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Info, Plus, Edit, Trash2, Loader2 } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@ihui/ui'

interface AboutUsItem {
  id: string
  network: string
  phone: string
  socialMedia: string
  experience: string
  description: string
}

interface AboutUsList {
  list: AboutUsItem[]
  total: number
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const EMPTY: AboutUsItem = {
  id: '',
  network: '',
  phone: '',
  socialMedia: '',
  experience: '',
  description: '',
}
const FIELDS: { key: keyof AboutUsItem; label: string; type?: 'textarea' }[] = [
  { key: 'network', label: '网络' },
  { key: 'phone', label: '电话' },
  { key: 'socialMedia', label: '社交媒体' },
  { key: 'experience', label: '经验' },
  { key: 'description', label: '描述', type: 'textarea' },
]
const th = 'px-4 py-2.5 font-medium'
const textareaClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export default function AboutUsPage() {
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<AboutUsItem | null>(null)
  const [form, setForm] = React.useState<AboutUsItem>(EMPTY)
  const [page, setPage] = React.useState(1)
  const pageSize = 10

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'about-us', page],
    queryFn: () => api<AboutUsList>(`/api/admin/about-us?page=${page}&pageSize=${pageSize}`),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        network: form.network,
        phone: form.phone,
        socialMedia: form.socialMedia,
        experience: form.experience,
        description: form.description,
      }
      return editing?.id
        ? api(`/api/admin/about-us/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
        : api('/api/admin/about-us', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'about-us'] })
      close()
    },
  })
  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/about-us/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'about-us'] }),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setOpen(true)
  }
  function openEdit(item: AboutUsItem) {
    setEditing(item)
    setForm(item)
    setOpen(true)
  }
  function close() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    saveMut.mutate()
  }

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const COLS: { key: keyof AboutUsItem; label: string }[] = [
    { key: 'id', label: 'ID' },
    { key: 'network', label: '网络' },
    { key: 'phone', label: '电话' },
    { key: 'socialMedia', label: '社交媒体' },
    { key: 'experience', label: '经验' },
    { key: 'description', label: '描述' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Info className="h-6 w-6 text-primary" />
            关于我们
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">管理关于我们内容</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          新增
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              {COLS.map((c) => (
                <th key={c.key} className={th}>
                  {c.label}
                </th>
              ))}
              <th className={`${th} text-right`}>操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td
                  colSpan={COLS.length + 1}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中...
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td
                  colSpan={COLS.length + 1}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  暂无数据
                </td>
              </tr>
            ) : (
              list.map((item) => (
                <tr key={item.id} className="transition-colors hover:bg-muted/30">
                  {COLS.map((c) => (
                    <td key={c.key} className="px-4 py-2.5 text-muted-foreground">
                      {(item[c.key] || '-').slice(0, 30)}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(item)}>
                        <Edit className="h-4 w-4" />
                        编辑
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={delMut.isPending}
                        onClick={() => {
                          if (confirm('确认删除?')) delMut.mutate(item.id)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        删除
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {total > pageSize && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">共 {total} 条</span>
          <div className="flex gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="rounded border px-2 py-1 disabled:opacity-50"
            >
              上一页
            </button>
            <button
              disabled={page * pageSize >= total}
              onClick={() => setPage(page + 1)}
              className="rounded border px-2 py-1 disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? '编辑关于我们' : '新增关于我们'}</DialogTitle>
            </DialogHeader>
            {FIELDS.map((f) => (
              <div key={f.key} className="space-y-2">
                <Label htmlFor={`f-${f.key}`}>{f.label}</Label>
                {f.type === 'textarea' ? (
                  <textarea
                    id={`f-${f.key}`}
                    value={form[f.key]}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    className={textareaClass}
                    rows={3}
                    placeholder={`请输入${f.label}`}
                  />
                ) : (
                  <Input
                    id={`f-${f.key}`}
                    value={form[f.key]}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={`请输入${f.label}`}
                  />
                )}
              </div>
            ))}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} disabled={saveMut.isPending}>
                取消
              </Button>
              <Button type="submit" disabled={saveMut.isPending}>
                {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}保存
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
