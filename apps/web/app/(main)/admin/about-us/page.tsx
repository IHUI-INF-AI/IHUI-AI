'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Info, Plus, Edit, Trash2, Loader2, Download, Search } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { exportFromApi } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
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

const RESOURCE = '/api/admin/about-us'
const PERM = 'system:us'
const EMPTY: AboutUsItem = {
  id: '',
  network: '',
  phone: '',
  socialMedia: '',
  experience: '',
  description: '',
}
const th = 'px-4 py-2.5 font-medium'
const textareaClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const SEARCH_KEYS = ['network', 'phone', 'socialMedia', 'experience'] as const
const FIELDS: { key: keyof AboutUsItem; label: string; type?: 'textarea' }[] = [
  { key: 'network', label: 'fieldNetwork' },
  { key: 'phone', label: 'fieldPhone' },
  { key: 'socialMedia', label: 'fieldSocialMedia' },
  { key: 'experience', label: 'fieldExperience' },
  { key: 'description', label: 'fieldDescription', type: 'textarea' },
]
const COLS: { key: keyof AboutUsItem; label: string }[] = [
  { key: 'id', label: 'colId' },
  ...FIELDS.map((f) => ({ key: f.key, label: f.label })),
]

export default function AboutUsPage() {
  const t = useTranslations('admin.aboutUs')
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<AboutUsItem | null>(null)
  const [form, setForm] = React.useState<AboutUsItem>(EMPTY)
  const [search, setSearch] = React.useState<Record<string, string>>({
    network: '',
    phone: '',
    socialMedia: '',
    experience: '',
  })
  const [page, setPage] = React.useState(1)
  const pageSize = 10

  const params = React.useMemo(() => {
    const p: Record<string, string> = { page: String(page), pageSize: String(pageSize) }
    SEARCH_KEYS.forEach((k) => {
      const v = search[k]?.trim()
      if (v) p[k] = v
    })
    return p
  }, [search, page])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'about-us', params],
    queryFn: () => api<AboutUsList>(`${RESOURCE}?${new URLSearchParams(params)}`),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = JSON.stringify(Object.fromEntries(FIELDS.map((f) => [f.key, form[f.key]])))
      return editing?.id
        ? api(`${RESOURCE}/${editing.id}`, { method: 'PUT', body })
        : api(RESOURCE, { method: 'POST', body })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'about-us'] })
      close()
    },
  })
  const delMut = useMutation({
    mutationFn: (id: string) => api(`${RESOURCE}/${id}`, { method: 'DELETE' }),
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
  function handleReset() {
    setSearch({ network: '', phone: '', socialMedia: '', experience: '' })
    setPage(1)
  }
  async function handleExport() {
    const ok = await exportFromApi(
      `${RESOURCE}?${new URLSearchParams(params)}`,
      '关于我们',
      COLS.map((c) => ({ key: c.key, title: t(c.label) })),
    )
    if (!ok) alert('导出失败')
  }

  const list = data?.list ?? []
  const total = data?.total ?? 0

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
        <div className="flex gap-2">
          <HasPermi code={`${PERM}:export`}>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4" />
              导出
            </Button>
          </HasPermi>
          <HasPermi code={`${PERM}:add`}>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              新增
            </Button>
          </HasPermi>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
        {SEARCH_KEYS.map((k) => {
          const label = t(FIELDS.find((f) => f.key === k)!.label)
          return (
            <div key={k} className="space-y-1">
              <Label className="text-xs">{label}</Label>
              <Input
                className="h-9 w-40"
                value={search[k]}
                onChange={(e) => setSearch({ ...search, [k]: e.target.value })}
                placeholder={`搜索${label}`}
              />
            </div>
          )
        })}
        <Button size="sm" onClick={() => setPage(1)}>
          <Search className="h-4 w-4" />
          搜索
        </Button>
        <Button variant="outline" size="sm" onClick={handleReset}>
          重置
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              {COLS.map((c) => (
                <th key={c.key} className={th}>
                  {t(c.label)}
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
                      <HasPermi code={`${PERM}:edit`}>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(item)}>
                          <Edit className="h-4 w-4" />
                          编辑
                        </Button>
                      </HasPermi>
                      <HasPermi code={`${PERM}:remove`}>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          disabled={delMut.isPending}
                          onClick={() => confirm('确认删除?') && delMut.mutate(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          删除
                        </Button>
                      </HasPermi>
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
                <Label htmlFor={`f-${f.key}`}>{t(f.label)}</Label>
                {f.type === 'textarea' ? (
                  <textarea
                    id={`f-${f.key}`}
                    value={form[f.key]}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    className={textareaClass}
                    rows={3}
                    placeholder={`请输入${t(f.label)}`}
                  />
                ) : (
                  <Input
                    id={`f-${f.key}`}
                    value={form[f.key]}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={`请输入${t(f.label)}`}
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
