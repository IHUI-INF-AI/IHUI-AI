'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Plus, Download, Search, Key } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { exportFromApi, type ExportColumn } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
import { DatePicker } from '@/components/form/DatePicker'
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
} from '@ihui/ui'

interface Item {
  id: string
  [k: string]: unknown
}
async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const RESOURCE = '/api/admin/auth-tokens'
const PERM = 'auth:auth_tokens'
const PAGE_SIZE = 10
type FormState = Record<string, string>
const FIELDS: { key: string; label: string; required?: boolean }[] = [
  { key: 'userUuid', label: '用户UUID', required: true },
  { key: 'token', label: 'Token', required: true },
  { key: 'refreshToken', label: '刷新Token', required: true },
  { key: 'tokenType', label: 'Token类型' },
]
const SEARCH_FIELDS: { key: string; label: string }[] = [{ key: 'userUuid', label: '用户UUID' }]
const DATE_FIELDS: { key: string; label: string; required?: boolean }[] = [
  { key: 'expiresAt', label: '过期时间', required: true },
  { key: 'refreshExpiresAt', label: '刷新过期时间', required: true },
  { key: 'createdAt', label: '创建时间' },
]
const ALL_KEYS = [...FIELDS.map((f) => f.key), ...DATE_FIELDS.map((d) => d.key)]
const LABELS: Record<string, string> = Object.fromEntries(
  [...FIELDS, ...DATE_FIELDS].map((f) => [f.key, f.label]),
)
const EMPTY: FormState = Object.fromEntries(ALL_KEYS.map((k) => [k, '']))
const EXPORT_COLS: ExportColumn[] = [
  { key: 'id', title: 'ID' },
  ...ALL_KEYS.map((k) => ({ key: k, title: LABELS[k] ?? '' })),
]
const th = 'px-4 py-2.5 font-medium'
const colCount = 1 + ALL_KEYS.length + 1

export default function AuthTokensPage() {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState<FormState>(
    Object.fromEntries(SEARCH_FIELDS.map((f) => [f.key, ''])),
  )
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Item | null>(null)
  const [form, setForm] = React.useState<FormState>(EMPTY)
  const [delId, setDelId] = React.useState<string | null>(null)

  const params = React.useMemo(() => {
    const p: Record<string, string> = { pageNum: String(page), pageSize: String(PAGE_SIZE) }
    for (const f of SEARCH_FIELDS) {
      const v = search[f.key]?.trim()
      if (v) p[f.key] = v
    }
    return p
  }, [search, page])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', PERM, params],
    queryFn: () =>
      api<{ list: Item[]; total: number }>(`${RESOURCE}?${new URLSearchParams(params)}`),
  })
  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const saveMut = useMutation({
    mutationFn: () =>
      editing
        ? api(`${RESOURCE}/${editing.id}`, { method: 'PUT', body: JSON.stringify(form) })
        : api(RESOURCE, { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', PERM] })
      toast.success(editing ? '更新成功' : '创建成功')
      close()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const delMut = useMutation({
    mutationFn: (id: string) => api(`${RESOURCE}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', PERM] })
      toast.success('删除成功')
      setDelId(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setOpen(true)
  }
  function openEdit(item: Item) {
    setEditing(item)
    const next: FormState = { ...EMPTY }
    for (const k of ALL_KEYS) next[k] = String(item[k] ?? '')
    setForm(next)
    setOpen(true)
  }
  function close() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    for (const f of FIELDS)
      if (f.required && !form[f.key]?.trim()) {
        toast.error(`${f.label}为必填项`)
        return
      }
    for (const d of DATE_FIELDS)
      if (d.required && !form[d.key]?.trim()) {
        toast.error(`${d.label}为必填项`)
        return
      }
    saveMut.mutate()
  }
  function handleReset() {
    setSearch(Object.fromEntries(SEARCH_FIELDS.map((f) => [f.key, ''])))
    setPage(1)
  }
  async function handleExport() {
    const ok = await exportFromApi(
      `${RESOURCE}?${new URLSearchParams(params)}`,
      '用户令牌',
      EXPORT_COLS,
    )
    if (!ok) toast.error('导出失败')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Key className="h-6 w-6 text-primary" />
          用户令牌
        </h1>
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
        {SEARCH_FIELDS.map((f) => (
          <div key={f.key} className="space-y-1">
            <Label className="text-xs">{f.label}</Label>
            <Input
              className="h-9 w-48"
              value={search[f.key] ?? ''}
              onChange={(e) => setSearch({ ...search, [f.key]: e.target.value })}
              placeholder={`搜索${f.label}`}
            />
          </div>
        ))}
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
              <th className={th}>ID</th>
              {ALL_KEYS.map((k) => (
                <th key={k} className={th}>
                  {LABELS[k]}
                </th>
              ))}
              <th className={th}>操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中…
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-10 text-center text-muted-foreground">
                  <Key className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无数据
                </td>
              </tr>
            ) : (
              list.map((item) => (
                <tr key={String(item.id)} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5">{String(item.id)}</td>
                  {ALL_KEYS.map((k) => (
                    <td key={k} className="px-4 py-2.5">
                      {String(item[k] ?? '-')}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 space-x-2">
                    <HasPermi code={`${PERM}:edit`}>
                      <button
                        className="text-primary hover:underline"
                        onClick={() => openEdit(item)}
                      >
                        编辑
                      </button>
                    </HasPermi>
                    <HasPermi code={`${PERM}:remove`}>
                      <button
                        className="text-destructive hover:underline"
                        onClick={() => setDelId(String(item.id))}
                      >
                        删除
                      </button>
                    </HasPermi>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            共 {total} 条 · {page}/{totalPages}
          </span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              上一页
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              下一页
            </Button>
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? '编辑用户令牌' : '新增用户令牌'}</DialogTitle>
              <DialogDescription>{editing ? '修改用户令牌' : '添加新的用户令牌'}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {FIELDS.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label>
                    {f.label}
                    {f.required ? ' *' : ''}
                  </Label>
                  <Input
                    value={form[f.key]}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  />
                </div>
              ))}
              {DATE_FIELDS.map((d) => (
                <DatePicker
                  key={d.key}
                  label={`${d.label}${d.required ? ' *' : ''}`}
                  value={form[d.key]}
                  onChange={(v) => setForm({ ...form, [d.key]: v })}
                />
              ))}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} disabled={saveMut.isPending}>
                取消
              </Button>
              <Button type="submit" disabled={saveMut.isPending}>
                {saveMut.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}保存
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={delId !== null}
        onOpenChange={(o) => {
          if (!o) setDelId(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>确定要删除该记录吗？此操作不可撤销。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDelId(null)}
              disabled={delMut.isPending}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={delMut.isPending}
              onClick={() => delId && delMut.mutate(delId)}
            >
              {delMut.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
