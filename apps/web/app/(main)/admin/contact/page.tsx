'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Phone, Plus, Edit, Trash2, Loader2 } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import {
  Button,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@ihui/ui'
import { RichTextEditor } from '@/components/editor/RichTextEditor'

interface ContactItem {
  id: string
  introduction: string
  corporateCulture: string
}

interface ContactList {
  list: ContactItem[]
  total: number
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const EMPTY: ContactItem = { id: '', introduction: '', corporateCulture: '' }
const th = 'px-4 py-2.5 font-medium'

export default function ContactPage() {
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ContactItem | null>(null)
  const [form, setForm] = React.useState<ContactItem>(EMPTY)
  const [page, setPage] = React.useState(1)
  const pageSize = 10

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'contact', page],
    queryFn: () => api<ContactList>(`/api/admin/contact?page=${page}&pageSize=${pageSize}`),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = { introduction: form.introduction, corporateCulture: form.corporateCulture }
      return editing?.id
        ? api(`/api/admin/contact/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
        : api('/api/admin/contact', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'contact'] })
      close()
    },
  })
  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/contact/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'contact'] }),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setOpen(true)
  }
  function openEdit(item: ContactItem) {
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

  const stripHtml = (s: string) => s.replace(/<[^>]+>/g, '').slice(0, 50) || '-'

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Phone className="h-6 w-6 text-primary" />
            联系我们
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">管理联系我们与企业文化内容</p>
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
              <th className={th}>ID</th>
              <th className={th}>简介</th>
              <th className={th}>企业文化</th>
              <th className={`${th} text-right`}>操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中...
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  暂无数据
                </td>
              </tr>
            ) : (
              list.map((item) => (
                <tr key={item.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">{item.id}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {stripHtml(item.introduction)}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {stripHtml(item.corporateCulture)}
                  </td>
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
        <DialogContent className="max-w-2xl">
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? '编辑联系我们' : '新增联系我们'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label>公司简介</Label>
              <RichTextEditor
                value={form.introduction}
                onChange={(html) => setForm({ ...form, introduction: html })}
                placeholder="请输入公司简介..."
              />
            </div>
            <div className="space-y-2">
              <Label>企业文化</Label>
              <RichTextEditor
                value={form.corporateCulture}
                onChange={(html) => setForm({ ...form, corporateCulture: html })}
                placeholder="请输入企业文化..."
              />
            </div>
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
