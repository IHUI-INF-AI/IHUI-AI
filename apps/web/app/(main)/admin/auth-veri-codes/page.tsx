'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Plus, Download, Search, KeyRound } from 'lucide-react'

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

interface AuthVeriCode {
  id: string
  userId: string
  phone: string
  code: string
  type?: string
  platform?: string
  ip?: string
  expiresAt?: string
  used?: string | number
  usedAt?: string
  createdAt?: string
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const RESOURCE = '/api/admin/auth-veri-codes'
const PERM = 'auth:auth_veri_codes'
const EMPTY = {
  userId: '',
  phone: '',
  code: '',
  type: '',
  platform: '',
  ip: '',
  expiresAt: '',
  used: '',
  usedAt: '',
  createdAt: '',
}
const th = 'px-4 py-2.5 font-medium'
const EXPORT_COLS: ExportColumn[] = [
  { key: 'id', title: 'ID' },
  { key: 'userId', title: '用户ID' },
  { key: 'phone', title: '手机号' },
  { key: 'code', title: '验证码' },
  { key: 'type', title: '类型' },
  { key: 'platform', title: '平台' },
  { key: 'ip', title: 'IP' },
  { key: 'expiresAt', title: '过期时间' },
  { key: 'used', title: '是否已用' },
  { key: 'usedAt', title: '使用时间' },
]

export default function AuthVeriCodesPage() {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState({ userId: '', phone: '', platform: '' })
  const [page, setPage] = React.useState(1)
  const [pageSize] = React.useState(10)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<AuthVeriCode | null>(null)
  const [form, setForm] = React.useState(EMPTY)
  const [delId, setDelId] = React.useState<string | null>(null)

  const params = React.useMemo(() => {
    const p: Record<string, string> = { pageNum: String(page), pageSize: String(pageSize) }
    Object.entries(search).forEach(([k, v]) => {
      if (v.trim()) p[k] = v.trim()
    })
    return p
  }, [search, page, pageSize])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'auth-veri-codes', params],
    queryFn: () =>
      api<{ list: AuthVeriCode[]; total: number }>(`${RESOURCE}?${new URLSearchParams(params)}`),
  })
  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const saveMut = useMutation({
    mutationFn: () =>
      editing
        ? api(`${RESOURCE}/${editing.id}`, { method: 'PUT', body: JSON.stringify(form) })
        : api(RESOURCE, { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'auth-veri-codes'] })
      toast.success(editing ? '更新成功' : '创建成功')
      close()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const delMut = useMutation({
    mutationFn: (id: string) => api(`${RESOURCE}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'auth-veri-codes'] })
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
  function openEdit(item: AuthVeriCode) {
    setEditing(item)
    setForm({
      userId: item.userId ?? '',
      phone: item.phone ?? '',
      code: item.code ?? '',
      type: item.type ?? '',
      platform: item.platform ?? '',
      ip: item.ip ?? '',
      expiresAt: item.expiresAt ?? '',
      used: String(item.used ?? ''),
      usedAt: item.usedAt ?? '',
      createdAt: item.createdAt ?? '',
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
    if (!form.userId.trim() || !form.phone.trim() || !form.code.trim() || !form.type.trim()) {
      toast.error('用户ID、手机号、验证码、类型为必填项')
      return
    }
    saveMut.mutate()
  }
  function handleReset() {
    setSearch({ userId: '', phone: '', platform: '' })
    setPage(1)
  }
  async function handleExport() {
    const ok = await exportFromApi(
      `${RESOURCE}?${new URLSearchParams(params)}`,
      '验证码记录',
      EXPORT_COLS,
    )
    if (!ok) toast.error('导出失败')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <KeyRound className="h-6 w-6 text-primary" />
          验证码记录
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
        <div className="space-y-1">
          <Label className="text-xs">用户ID</Label>
          <Input
            className="h-9 w-40"
            value={search.userId}
            onChange={(e) => setSearch({ ...search, userId: e.target.value })}
            placeholder="搜索用户ID"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">手机号</Label>
          <Input
            className="h-9 w-40"
            value={search.phone}
            onChange={(e) => setSearch({ ...search, phone: e.target.value })}
            placeholder="搜索手机号"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">平台</Label>
          <Input
            className="h-9 w-40"
            value={search.platform}
            onChange={(e) => setSearch({ ...search, platform: e.target.value })}
            placeholder="搜索平台"
          />
        </div>
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
              <th className={th}>用户ID</th>
              <th className={th}>手机号</th>
              <th className={th}>验证码</th>
              <th className={th}>类型</th>
              <th className={th}>平台</th>
              <th className={th}>IP</th>
              <th className={th}>过期时间</th>
              <th className={th}>已用</th>
              <th className={th}>操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中…
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                  <KeyRound className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无数据
                </td>
              </tr>
            ) : (
              list.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5">{item.id}</td>
                  <td className="px-4 py-2.5 font-medium">{item.userId}</td>
                  <td className="px-4 py-2.5">{item.phone}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{item.code}</td>
                  <td className="px-4 py-2.5">{item.type ?? '-'}</td>
                  <td className="px-4 py-2.5">{item.platform ?? '-'}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{item.ip ?? '-'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{item.expiresAt ?? '-'}</td>
                  <td className="px-4 py-2.5">
                    {String(item.used ?? '0') === '1' ? (
                      <span className="text-emerald-600">是</span>
                    ) : (
                      <span className="text-muted-foreground">否</span>
                    )}
                  </td>
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
                        onClick={() => setDelId(item.id)}
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
              <DialogTitle>{editing ? '编辑验证码记录' : '新增验证码记录'}</DialogTitle>
              <DialogDescription>
                {editing ? '修改验证码记录信息' : '添加新的验证码记录'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>用户ID *</Label>
                <Input
                  value={form.userId}
                  onChange={(e) => setForm({ ...form, userId: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>手机号 *</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>验证码 *</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>类型 *</Label>
                <Input
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  placeholder="register/login"
                />
              </div>
              <div className="space-y-1.5">
                <Label>平台</Label>
                <Input
                  value={form.platform}
                  onChange={(e) => setForm({ ...form, platform: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>IP</Label>
                <Input value={form.ip} onChange={(e) => setForm({ ...form, ip: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>是否已用</Label>
                <Input
                  value={form.used}
                  onChange={(e) => setForm({ ...form, used: e.target.value })}
                  placeholder="0/1"
                />
              </div>
              <DatePicker
                label="过期时间"
                value={form.expiresAt}
                onChange={(v) => setForm({ ...form, expiresAt: v })}
              />
              <DatePicker
                label="使用时间"
                value={form.usedAt}
                onChange={(v) => setForm({ ...form, usedAt: v })}
              />
              <DatePicker
                label="创建时间"
                value={form.createdAt}
                onChange={(v) => setForm({ ...form, createdAt: v })}
              />
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
            <DialogDescription>确定要删除该验证码记录吗？此操作不可撤销。</DialogDescription>
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
