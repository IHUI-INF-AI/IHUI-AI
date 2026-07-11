'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Sparkles, Plus, Edit, Trash2, Loader2 } from 'lucide-react'
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
import { ImageUpload } from '@/components/form/ImageUpload'

interface AiGcItem {
  id: string
  title: string
  subtitle: string
  context: string
  fileUrl: string
  fileType: string
  coverUrl: string
  type: string
  creator: string
  createdAt: string
}

interface AiGcList {
  list: AiGcItem[]
  total: number
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const EMPTY: AiGcItem = {
  id: '',
  title: '',
  subtitle: '',
  context: '',
  fileUrl: '',
  fileType: '',
  coverUrl: '',
  type: '',
  creator: '',
  createdAt: '',
}
const TEXT_FIELDS: { key: keyof AiGcItem; label: string; type?: 'textarea' }[] = [
  { key: 'title', label: '标题' },
  { key: 'subtitle', label: '副标题', type: 'textarea' },
  { key: 'context', label: '内容', type: 'textarea' },
  { key: 'fileUrl', label: '文件URL' },
  { key: 'fileType', label: '文件类型' },
  { key: 'type', label: '类型' },
  { key: 'creator', label: '创建者' },
]
const th = 'px-4 py-2.5 font-medium'
const textareaClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export default function AiGcPage() {
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<AiGcItem | null>(null)
  const [form, setForm] = React.useState<AiGcItem>(EMPTY)
  const [page, setPage] = React.useState(1)
  const pageSize = 10

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'ai-gc', page],
    queryFn: () => api<AiGcList>(`/api/admin/ai-gc?page=${page}&pageSize=${pageSize}`),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        title: form.title,
        subtitle: form.subtitle,
        context: form.context,
        fileUrl: form.fileUrl,
        fileType: form.fileType,
        coverUrl: form.coverUrl,
        type: form.type,
        creator: form.creator,
      }
      return editing?.id
        ? api(`/api/admin/ai-gc/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
        : api('/api/admin/ai-gc', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'ai-gc'] })
      close()
    },
  })
  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/ai-gc/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'ai-gc'] }),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setOpen(true)
  }
  function openEdit(item: AiGcItem) {
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
    if (!form.title.trim()) return
    saveMut.mutate()
  }

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const COLS: { key: keyof AiGcItem; label: string }[] = [
    { key: 'id', label: 'ID' },
    { key: 'title', label: '标题' },
    { key: 'subtitle', label: '副标题' },
    { key: 'context', label: '内容' },
    { key: 'fileUrl', label: '文件URL' },
    { key: 'fileType', label: '类型' },
    { key: 'type', label: '分类' },
    { key: 'creator', label: '创建者' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Sparkles className="h-6 w-6 text-primary" />
            AIGC管理
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">管理AI生成内容</p>
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
              <th className={th}>封面</th>
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
                  colSpan={COLS.length + 2}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中...
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td
                  colSpan={COLS.length + 2}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  暂无数据
                </td>
              </tr>
            ) : (
              list.map((item) => (
                <tr key={item.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    {}
                    {item.coverUrl ? (
                      <img src={item.coverUrl} alt="" className="h-10 w-10 rounded object-cover" />
                    ) : (
                      <span className="text-muted-foreground/50">-</span>
                    )}
                  </td>
                  {COLS.map((c) => (
                    <td key={c.key} className="px-4 py-2.5 text-muted-foreground">
                      {(item[c.key] || '-').slice(0, 25)}
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
        <DialogContent className="max-w-xl">
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? '编辑AIGC' : '新增AIGC'}</DialogTitle>
            </DialogHeader>
            {TEXT_FIELDS.map((f) => (
              <div key={f.key} className="space-y-2">
                <Label htmlFor={`f-${f.key}`}>{f.label}</Label>
                {f.type === 'textarea' ? (
                  <textarea
                    id={`f-${f.key}`}
                    value={form[f.key]}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    className={textareaClass}
                    rows={2}
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
            <div className="space-y-2">
              <Label>封面图</Label>
              <ImageUpload
                value={form.coverUrl}
                onChange={(v) =>
                  setForm({ ...form, coverUrl: typeof v === 'string' ? v : (v[0] ?? '') })
                }
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
