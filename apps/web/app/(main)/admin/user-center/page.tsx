'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Plus, Download, Search, Users } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { exportFromApi, type ExportColumn } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
import { DatePicker } from '@/components/form/DatePicker'
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

interface UserCenter {
  id: string
  uuid: string
  nickname?: string
  avatar?: string
  gender?: string | number
  birthday?: string
  inviteCode?: string
  parentId?: string
  createdAt?: string
  authInfo?: { phone?: string }
  userMargin?: { tokenQuantity?: number }
  vipLevelVO?: { title?: string }
  isVip?: number
}
interface AssignUser {
  userId: string
  userName?: string
  nickname?: string
  roles?: string
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}
const RESOURCE = '/api/admin/users'
const PERM = 'auth:users'
const EMPTY = {
  nickname: '',
  avatar: '',
  gender: '',
  birthday: '',
  inviteCode: '',
  parentId: '',
  createdAt: '',
}
const IDENTITY_OPTIONS = [
  { value: '0', label: '平民' },
  { value: '1', label: '贵族' },
  { value: '2', label: '王室' },
  { value: '3', label: '大臣' },
]
const th = 'px-4 py-2.5 font-medium'
const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const EXPORT_COLS: ExportColumn[] = [
  { key: 'id', title: 'ID' },
  { key: 'uuid', title: 'UUID' },
  { key: 'nickname', title: '昵称' },
  { key: 'parentId', title: '父级ID' },
  { key: 'inviteCode', title: '邀请码' },
  { key: 'createdAt', title: '创建时间' },
]

export default function UserCenterPage() {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState({ nickname: '', parentId: '' })
  const [page, setPage] = React.useState(1)
  const [pageSize] = React.useState(10)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<UserCenter | null>(null)
  const [form, setForm] = React.useState(EMPTY)
  const [delId, setDelId] = React.useState<string | null>(null)
  const [idOpen, setIdOpen] = React.useState(false)
  const [idForm, setIdForm] = React.useState({ uuid: '', type: '', tokenQuantity: '0' })
  const [assignOpen, setAssignOpen] = React.useState(false)
  const [assignList, setAssignList] = React.useState<AssignUser[]>([])
  const [assignLoading, setAssignLoading] = React.useState(false)
  const [selectedAssign, setSelectedAssign] = React.useState<AssignUser | null>(null)
  const [currentUuid, setCurrentUuid] = React.useState('')
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'users'] })

  const params = React.useMemo(() => {
    const p: Record<string, string> = { pageNum: String(page), pageSize: String(pageSize) }
    Object.entries(search).forEach(([k, v]) => {
      if (v.trim()) p[k] = v.trim()
    })
    return p
  }, [search, page, pageSize])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: () =>
      api<{ list: UserCenter[]; total: number }>(`${RESOURCE}?${new URLSearchParams(params)}`),
  })
  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const saveMut = useMutation({
    mutationFn: () =>
      editing
        ? api(`${RESOURCE}/${editing.uuid}`, { method: 'PUT', body: JSON.stringify(form) })
        : api(RESOURCE, { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => {
      invalidate()
      toast.success(editing ? '更新成功' : '创建成功')
      close()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const delMut = useMutation({
    mutationFn: (uuid: string) => api(`${RESOURCE}/${uuid}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate()
      toast.success('删除成功')
      setDelId(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const identityMut = useMutation({
    mutationFn: () =>
      api(`${RESOURCE}/identity`, {
        method: 'PUT',
        body: JSON.stringify({
          uuid: idForm.uuid,
          type: Number(idForm.type),
          tokenQuantity: Number(idForm.tokenQuantity),
        }),
      }),
    onSuccess: () => {
      invalidate()
      toast.success('身份修改成功')
      setIdOpen(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const assignMut = useMutation({
    mutationFn: () =>
      api(`${RESOURCE}/assign`, {
        method: 'POST',
        body: JSON.stringify({ userUuid: currentUuid, sysUserId: selectedAssign?.userId }),
      }),
    onSuccess: () => {
      toast.success('分配用户成功')
      setAssignOpen(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setOpen(true)
  }
  function openEdit(item: UserCenter) {
    setEditing(item)
    setForm({
      nickname: item.nickname ?? '',
      avatar: item.avatar ?? '',
      gender: String(item.gender ?? ''),
      birthday: item.birthday ?? '',
      inviteCode: item.inviteCode ?? '',
      parentId: item.parentId ?? '',
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
    saveMut.mutate()
  }
  function handleReset() {
    setSearch({ nickname: '', parentId: '' })
    setPage(1)
  }
  async function handleExport() {
    const ok = await exportFromApi(
      `${RESOURCE}?${new URLSearchParams(params)}`,
      '用户中心',
      EXPORT_COLS,
    )
    if (!ok) toast.error('导出失败')
  }
  function openIdentity(item: UserCenter) {
    setIdForm({ uuid: item.uuid, type: String(item.isVip ?? ''), tokenQuantity: '0' })
    setIdOpen(true)
  }
  async function openAssign(item: UserCenter) {
    setCurrentUuid(item.uuid)
    setSelectedAssign(null)
    setAssignOpen(true)
    setAssignLoading(true)
    try {
      const res = await api<{ list: AssignUser[] }>('/api/admin/users/course-users')
      setAssignList(res.list ?? [])
    } catch {
      setAssignList([])
    }
    setAssignLoading(false)
  }
  function submitIdentity(e: React.FormEvent) {
    e.preventDefault()
    if (!idForm.type) {
      toast.error('请选择身份类型')
      return
    }
    identityMut.mutate()
  }
  function submitAssign() {
    if (!selectedAssign) {
      toast.error('请选择用户')
      return
    }
    assignMut.mutate()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Users className="h-6 w-6 text-primary" />
          用户中心
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
          <Label className="text-xs">昵称</Label>
          <Input
            className="h-9 w-48"
            value={search.nickname}
            onChange={(e) => setSearch({ ...search, nickname: e.target.value })}
            placeholder="搜索昵称"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">父级ID</Label>
          <Input
            className="h-9 w-48"
            value={search.parentId}
            onChange={(e) => setSearch({ ...search, parentId: e.target.value })}
            placeholder="搜索父级ID"
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
              <th className={th}>UUID</th>
              <th className={th}>昵称</th>
              <th className={th}>父级ID</th>
              <th className={th}>手机号</th>
              <th className={th}>Token</th>
              <th className={th}>VIP等级</th>
              <th className={th}>操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中…
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无数据
                </td>
              </tr>
            ) : (
              list.map((item) => (
                <tr key={item.uuid} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-mono text-xs">{item.uuid}</td>
                  <td className="px-4 py-2.5 font-medium">{item.nickname ?? '-'}</td>
                  <td className="px-4 py-2.5">{item.parentId ?? '-'}</td>
                  <td className="px-4 py-2.5">{item.authInfo?.phone ?? '-'}</td>
                  <td className="px-4 py-2.5">{item.userMargin?.tokenQuantity ?? '-'}</td>
                  <td className="px-4 py-2.5">{item.vipLevelVO?.title ?? '-'}</td>
                  <td className="px-4 py-2.5 space-x-2 whitespace-nowrap">
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
                        onClick={() => setDelId(item.uuid)}
                      >
                        删除
                      </button>
                    </HasPermi>
                    <HasPermi code={`${PERM}:edit`}>
                      <button
                        className="text-primary hover:underline"
                        onClick={() => openIdentity(item)}
                      >
                        身份
                      </button>
                    </HasPermi>
                    <HasPermi code={`${PERM}:edit`}>
                      <button
                        className="text-primary hover:underline"
                        onClick={() => openAssign(item)}
                      >
                        分配
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
              <DialogTitle>{editing ? '编辑用户' : '新增用户'}</DialogTitle>
              <DialogDescription>{editing ? '修改用户信息' : '添加新用户'}</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>昵称</Label>
                <Input
                  value={form.nickname}
                  onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>头像URL</Label>
                <Input
                  value={form.avatar}
                  onChange={(e) => setForm({ ...form, avatar: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>性别</Label>
                <Input
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value })}
                  placeholder="0/1/2"
                />
              </div>
              <DatePicker
                label="生日"
                value={form.birthday}
                onChange={(v) => setForm({ ...form, birthday: v })}
              />
              <div className="space-y-1.5">
                <Label>邀请码</Label>
                <Input
                  value={form.inviteCode}
                  onChange={(e) => setForm({ ...form, inviteCode: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>父级ID</Label>
                <Input
                  value={form.parentId}
                  onChange={(e) => setForm({ ...form, parentId: e.target.value })}
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
        open={idOpen}
        onOpenChange={(o) => {
          if (!o) setIdOpen(false)
        }}
      >
        <DialogContent>
          <form onSubmit={submitIdentity} className="space-y-4">
            <DialogHeader>
              <DialogTitle>修改身份</DialogTitle>
              <DialogDescription>设置用户身份类型和Token数量</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>身份类型</Label>
                <Select
                  value={idForm.type}
                  onValueChange={(v) => setIdForm({ ...idForm, type: v })}
                >
                  <SelectTrigger className={selectClass}>
                    <SelectValue placeholder="请选择身份" />
                  </SelectTrigger>
                  <SelectContent>
                    {IDENTITY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Token数量</Label>
                <Input
                  type="number"
                  value={idForm.tokenQuantity}
                  onChange={(e) => setIdForm({ ...idForm, tokenQuantity: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIdOpen(false)}
                disabled={identityMut.isPending}
              >
                取消
              </Button>
              <Button type="submit" disabled={identityMut.isPending}>
                {identityMut.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}确认
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={assignOpen}
        onOpenChange={(o) => {
          if (!o) setAssignOpen(false)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>分配用户</DialogTitle>
            <DialogDescription>选择要关联的系统用户</DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto rounded-md border">
            {assignLoading ? (
              <div className="py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                加载中…
              </div>
            ) : assignList.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">暂无可分配用户</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className={th}>用户名</th>
                    <th className={th}>昵称</th>
                    <th className={th}>角色</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {assignList.map((u) => (
                    <tr
                      key={u.userId}
                      className={`cursor-pointer hover:bg-muted/30 ${selectedAssign?.userId === u.userId ? 'bg-primary/10' : ''}`}
                      onClick={() => setSelectedAssign(u)}
                    >
                      <td className="px-4 py-2.5 font-medium">{u.userName ?? '-'}</td>
                      <td className="px-4 py-2.5">{u.nickname ?? '-'}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{u.roles ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAssignOpen(false)}
              disabled={assignMut.isPending}
            >
              取消
            </Button>
            <Button
              type="button"
              disabled={!selectedAssign || assignMut.isPending}
              onClick={submitAssign}
            >
              {assignMut.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}确认分配
            </Button>
          </DialogFooter>
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
            <DialogDescription>确定要删除该用户记录吗？此操作不可撤销。</DialogDescription>
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
