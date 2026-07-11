'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Plus, Download, Search, LogIn } from 'lucide-react'

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

interface LoginLog {
  id: string
  userUuid: string
  loginType?: string
  platform?: string
  ip?: string
  location?: string
  userAgent?: string
  loginTime?: string
  message?: string
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const RESOURCE = '/api/admin/login-logs'
const PERM = 'auth:login_logs'
const EMPTY = {
  userUuid: '',
  loginType: '',
  platform: '',
  ip: '',
  location: '',
  userAgent: '',
  loginTime: '',
  message: '',
}
const th = 'px-4 py-2.5 font-medium'
const EXPORT_COLS: ExportColumn[] = [
  { key: 'id', title: 'ID' },
  { key: 'userUuid', title: '用户UUID' },
  { key: 'loginType', title: '登录类型' },
  { key: 'platform', title: '平台' },
  { key: 'ip', title: 'IP' },
  { key: 'location', title: '位置' },
  { key: 'userAgent', title: 'UserAgent' },
  { key: 'loginTime', title: '登录时间' },
  { key: 'message', title: '消息' },
]

export default function LoginLogsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState({
    userUuid: '',
    platform: '',
    location: '',
    loginTime: '',
  })
  const [page, setPage] = React.useState(1)
  const [pageSize] = React.useState(10)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<LoginLog | null>(null)
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
    queryKey: ['admin', 'login-logs', params],
    queryFn: () =>
      api<{ list: LoginLog[]; total: number }>(`${RESOURCE}?${new URLSearchParams(params)}`),
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
      qc.invalidateQueries({ queryKey: ['admin', 'login-logs'] })
      toast.success(editing ? '更新成功' : '创建成功')
      close()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const delMut = useMutation({
    mutationFn: (id: string) => api(`${RESOURCE}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'login-logs'] })
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
  function openEdit(item: LoginLog) {
    setEditing(item)
    setForm({
      userUuid: item.userUuid ?? '',
      loginType: item.loginType ?? '',
      platform: item.platform ?? '',
      ip: item.ip ?? '',
      location: item.location ?? '',
      userAgent: item.userAgent ?? '',
      loginTime: item.loginTime ?? '',
      message: item.message ?? '',
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
    if (!form.userUuid.trim() || !form.loginType.trim()) {
      toast.error('用户UUID 和 登录类型 为必填项')
      return
    }
    saveMut.mutate()
  }
  function handleReset() {
    setSearch({ userUuid: '', platform: '', location: '', loginTime: '' })
    setPage(1)
  }
  async function handleExport() {
    const ok = await exportFromApi(
      `${RESOURCE}?${new URLSearchParams(params)}`,
      '登录日志',
      EXPORT_COLS,
    )
    if (!ok) toast.error('导出失败')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <LogIn className="h-6 w-6 text-primary" />
          登录日志
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
          <Label className="text-xs">用户UUID</Label>
          <Input
            className="h-9 w-40"
            value={search.userUuid}
            onChange={(e) => setSearch({ ...search, userUuid: e.target.value })}
            placeholder="搜索 UUID"
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
        <div className="space-y-1">
          <Label className="text-xs">位置</Label>
          <Input
            className="h-9 w-40"
            value={search.location}
            onChange={(e) => setSearch({ ...search, location: e.target.value })}
            placeholder="搜索位置"
          />
        </div>
        <div className="space-y-1">
          <DatePicker
            label="登录时间"
            value={search.loginTime}
            onChange={(v) => setSearch({ ...search, loginTime: v })}
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
              <th className={th}>用户UUID</th>
              <th className={th}>登录类型</th>
              <th className={th}>平台</th>
              <th className={th}>IP</th>
              <th className={th}>位置</th>
              <th className={th}>UA</th>
              <th className={th}>登录时间</th>
              <th className={th}>消息</th>
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
                  <LogIn className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无数据
                </td>
              </tr>
            ) : (
              list.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5">{item.id}</td>
                  <td className="px-4 py-2.5 font-medium">{item.userUuid}</td>
                  <td className="px-4 py-2.5">{item.loginType ?? '-'}</td>
                  <td className="px-4 py-2.5">{item.platform ?? '-'}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{item.ip ?? '-'}</td>
                  <td className="px-4 py-2.5">{item.location ?? '-'}</td>
                  <td
                    className="px-4 py-2.5 max-w-32 truncate text-xs text-muted-foreground"
                    title={item.userAgent}
                  >
                    {item.userAgent ?? '-'}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{item.loginTime ?? '-'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{item.message ?? '-'}</td>
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
              <DialogTitle>{editing ? '编辑登录日志' : '新增登录日志'}</DialogTitle>
              <DialogDescription>
                {editing ? '修改登录日志信息' : '添加新的登录日志'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>用户UUID *</Label>
                <Input
                  value={form.userUuid}
                  onChange={(e) => setForm({ ...form, userUuid: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>登录类型 *</Label>
                <Input
                  value={form.loginType}
                  onChange={(e) => setForm({ ...form, loginType: e.target.value })}
                  placeholder="sms/password"
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
                <Label>位置</Label>
                <Input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </div>
              <DatePicker
                label="登录时间"
                value={form.loginTime}
                onChange={(v) => setForm({ ...form, loginTime: v })}
              />
              <div className="col-span-2 space-y-1.5">
                <Label>UserAgent</Label>
                <Input
                  value={form.userAgent}
                  onChange={(e) => setForm({ ...form, userAgent: e.target.value })}
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>消息</Label>
                <Input
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                />
              </div>
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
            <DialogDescription>确定要删除该登录日志记录吗？此操作不可撤销。</DialogDescription>
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
