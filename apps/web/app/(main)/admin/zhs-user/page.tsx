'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Plus,
  Edit,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Download,
  Users,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { exportToExcel } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
} from '@ihui/ui'

interface ZhsUser {
  id: string
  token: string | null
  openId: string | null
  nickname: string | null
  userName: string | null
  avatar: string | null
  card: string | null
  phone: string | null
  inviteCode: string | null
  parentId: string | null
  balance: string | null
  totalEarnings: string | null
  isVip: string | null
  identityTypy: string | null
  commissionRatio: string | null
  tokenQuantity: string | null
  createdAt: string | null
}

interface ListData {
  list: ZhsUser[]
  total: number
}

const PAGE_SIZE = 10

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const FIELDS: { key: keyof ZhsUser; label: string; required?: boolean }[] = [
  { key: 'token', label: 'Token' },
  { key: 'openId', label: 'OpenID', required: true },
  { key: 'nickname', label: '昵称', required: true },
  { key: 'userName', label: '用户名' },
  { key: 'avatar', label: '头像' },
  { key: 'card', label: '身份证' },
  { key: 'phone', label: '手机' },
  { key: 'inviteCode', label: '邀请码', required: true },
  { key: 'parentId', label: '父ID' },
  { key: 'balance', label: '余额' },
  { key: 'totalEarnings', label: '总收益', required: true },
  { key: 'isVip', label: 'VIP' },
  { key: 'identityTypy', label: '身份类型' },
  { key: 'commissionRatio', label: '佣金比例' },
  { key: 'tokenQuantity', label: 'Token数量' },
]

const EMPTY: Record<string, string> = Object.fromEntries(FIELDS.map((f) => [f.key, '']))

export default function ZhsUserPage() {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState<Record<string, string>>({})
  const [debounced, setDebounced] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ZhsUser | null>(null)
  const [form, setForm] = React.useState<Record<string, string>>({ ...EMPTY })
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(JSON.stringify(search))
      setPage(1)
    }, 400)
    return () => clearTimeout(tm)
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'zhs-user', debounced, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      Object.entries(search).forEach(([k, v]) => {
        if (v) qs.set(k, v)
      })
      return api<ListData>(`/api/admin/zhs-user?${qs.toString()}`)
    },
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {}
      FIELDS.forEach((f) => {
        body[f.key] = form[f.key]?.trim() || undefined
      })
      return editing
        ? api(`/api/admin/zhs-user/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
        : api('/api/admin/zhs-user', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? '更新成功' : '新增成功')
      qc.invalidateQueries({ queryKey: ['admin', 'zhs-user'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/zhs-user/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['admin', 'zhs-user'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm({ ...EMPTY })
    setErr(null)
    setOpen(true)
  }
  function openEdit(item: ZhsUser) {
    setEditing(item)
    const f: Record<string, string> = {}
    FIELDS.forEach((fld) => {
      f[fld.key] = String(item[fld.key] ?? '')
    })
    setForm(f)
    setErr(null)
    setOpen(true)
  }
  function closeDialog() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
    setErr(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    const missing = FIELDS.find((f) => f.required && !form[f.key]?.trim())
    if (missing) {
      setErr(`请输入${missing.label}`)
      return
    }
    saveMut.mutate()
  }
  function handleDelete(item: ZhsUser) {
    if (!window.confirm(`确认删除 "${item.nickname}" ?`)) return
    deleteMut.mutate(item.id)
  }
  function handleExport() {
    exportToExcel(
      'ZHS用户',
      [
        { key: 'id', title: 'ID' },
        { key: 'nickname', title: '昵称' },
        { key: 'userName', title: '用户名' },
        { key: 'phone', title: '手机' },
        { key: 'inviteCode', title: '邀请码' },
        { key: 'balance', title: '余额' },
        { key: 'totalEarnings', title: '总收益' },
        { key: 'isVip', title: 'VIP' },
        { key: 'identityTypy', title: '身份类型' },
        { key: 'commissionRatio', title: '佣金比例' },
        { key: 'tokenQuantity', title: 'Token数量' },
        { key: 'createdAt', title: '创建时间' },
      ],
      (data?.list ?? []) as unknown as Record<string, unknown>[],
    )
  }

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const onSearch = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSearch({ ...search, [k]: e.target.value })
  const onForm = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">ZHS用户管理</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            导出
          </Button>
          <HasPermi code="ai:zhs_user:add">
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              新增
            </Button>
          </HasPermi>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FIELDS.map((f) => (
          <Input
            key={f.key}
            value={search[f.key] ?? ''}
            onChange={onSearch(f.key)}
            placeholder={f.label}
            className="h-9 w-32"
          />
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">昵称</TableHead>
              <TableHead className="px-4 py-2.5">用户名</TableHead>
              <TableHead className="px-4 py-2.5">手机</TableHead>
              <TableHead className="px-4 py-2.5">邀请码</TableHead>
              <TableHead className="px-4 py-2.5">余额</TableHead>
              <TableHead className="px-4 py-2.5">总收益</TableHead>
              <TableHead className="px-4 py-2.5">VIP</TableHead>
              <TableHead className="px-4 py-2.5">身份类型</TableHead>
              <TableHead className="px-4 py-2.5">创建时间</TableHead>
              <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中…
                </TableCell>
              </TableRow>
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                  <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              list.map((item) => (
                <TableRow key={item.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-medium">{item.nickname || '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">{item.userName || '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">{item.phone || '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">{item.inviteCode || '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">{item.balance || '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">{item.totalEarnings || '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">{item.isVip || '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">{item.identityTypy || '-'}</TableCell>
                  <TableCell className="px-4 py-2.5 text-muted-foreground">
                    {item.createdAt || '-'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <HasPermi code="ai:zhs_user:edit">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(item)}
                          title="编辑"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </HasPermi>
                      <HasPermi code="ai:zhs_user:remove">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(item)}
                          title="删除"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </HasPermi>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">共 {total} 条</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeDialog())}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? '编辑ZHS用户' : '新增ZHS用户'}</DialogTitle>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {FIELDS.map((f) => (
                <div key={f.key} className="space-y-2">
                  <Label>
                    {f.label}
                    {f.required && ' *'}
                  </Label>
                  <Input value={form[f.key]} onChange={onForm(f.key)} />
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                disabled={saveMut.isPending}
              >
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
