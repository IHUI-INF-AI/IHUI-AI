'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Download,
  MessageSquare,
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

interface UserAgentContext {
  id: string
  agentId: string | null
  agentName: string | null
  userUuid: string | null
  userName: string | null
  problem: string | null
  answer: string | null
  userUrl: string | null
  agentUrl: string | null
  sendTime: string | null
}

interface ListData {
  list: UserAgentContext[]
  total: number
}

const PAGE_SIZE = 10

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const EMPTY = {
  agentId: '',
  userUuid: '',
  problem: '',
  answer: '',
  userUrl: '',
  agentUrl: '',
  sendTime: '',
}

export default function UserAgentContextPage() {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<UserAgentContext | null>(null)
  const [form, setForm] = React.useState(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'user-agent-context', debounced, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (debounced) qs.set('problem', debounced)
      return api<ListData>(`/api/admin/user-agent-context?${qs.toString()}`)
    },
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        agentId: form.agentId.trim(),
        userUuid: form.userUuid.trim(),
        problem: form.problem || undefined,
        answer: form.answer || undefined,
        userUrl: form.userUrl || undefined,
        agentUrl: form.agentUrl || undefined,
        sendTime: form.sendTime || undefined,
      }
      return editing
        ? api(`/api/admin/user-agent-context/${editing.id}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          })
        : api('/api/admin/user-agent-context', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? '更新成功' : '新增成功')
      qc.invalidateQueries({ queryKey: ['admin', 'user-agent-context'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/user-agent-context/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['admin', 'user-agent-context'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(item: UserAgentContext) {
    setEditing(item)
    setForm({
      agentId: item.agentId ?? '',
      userUuid: item.userUuid ?? '',
      problem: item.problem ?? '',
      answer: item.answer ?? '',
      userUrl: item.userUrl ?? '',
      agentUrl: item.agentUrl ?? '',
      sendTime: item.sendTime ?? '',
    })
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
    if (!form.agentId.trim()) {
      setErr('请输入AgentID')
      return
    }
    if (!form.userUuid.trim()) {
      setErr('请输入用户UUID')
      return
    }
    saveMut.mutate()
  }
  function handleDelete(item: UserAgentContext) {
    if (!window.confirm(`确认删除 ?`)) return
    deleteMut.mutate(item.id)
  }
  function handleExport() {
    exportToExcel(
      '用户Agent上下文',
      [
        { key: 'id', title: 'ID' },
        { key: 'agentId', title: 'AgentID' },
        { key: 'agentName', title: 'Agent名称' },
        { key: 'userUuid', title: '用户UUID' },
        { key: 'userName', title: '用户名' },
        { key: 'problem', title: '问题' },
        { key: 'answer', title: '回答' },
        { key: 'userUrl', title: '用户URL' },
        { key: 'agentUrl', title: 'AgentURL' },
        { key: 'sendTime', title: '发送时间' },
      ],
      (data?.list ?? []) as unknown as Record<string, unknown>[],
    )
  }

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">用户Agent上下文</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            导出
          </Button>
          <HasPermi code="ai:useragentcontext:add">
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              新增
            </Button>
          </HasPermi>
        </div>
      </div>

      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索问题"
          className="h-9 pl-8"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">AgentID</TableHead>
              <TableHead className="px-4 py-2.5">Agent名称</TableHead>
              <TableHead className="px-4 py-2.5">用户UUID</TableHead>
              <TableHead className="px-4 py-2.5">用户名</TableHead>
              <TableHead className="px-4 py-2.5">问题</TableHead>
              <TableHead className="px-4 py-2.5">回答</TableHead>
              <TableHead className="px-4 py-2.5">发送时间</TableHead>
              <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中…
                </TableCell>
              </TableRow>
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              list.map((item) => (
                <TableRow key={item.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-medium">{item.agentId || '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">{item.agentName || '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">{item.userUuid || '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">{item.userName || '-'}</TableCell>
                  <TableCell className="px-4 py-2.5 max-w-[200px] truncate">
                    {item.problem || '-'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 max-w-[200px] truncate text-muted-foreground">
                    {item.answer || '-'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-muted-foreground">
                    {item.sendTime || '-'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <HasPermi code="ai:useragentcontext:edit">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(item)}
                          title="编辑"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </HasPermi>
                      <HasPermi code="ai:useragentcontext:remove">
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
        <DialogContent className="max-w-lg">
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? '编辑用户Agent上下文' : '新增用户Agent上下文'}</DialogTitle>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>AgentID *</Label>
                <Input
                  value={form.agentId}
                  onChange={(e) => setForm({ ...form, agentId: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>用户UUID *</Label>
                <Input
                  value={form.userUuid}
                  onChange={(e) => setForm({ ...form, userUuid: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>问题</Label>
              <Input
                value={form.problem}
                onChange={(e) => setForm({ ...form, problem: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>回答</Label>
              <Input
                value={form.answer}
                onChange={(e) => setForm({ ...form, answer: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>用户URL</Label>
              <Input
                value={form.userUrl}
                onChange={(e) => setForm({ ...form, userUrl: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>AgentURL</Label>
              <Input
                value={form.agentUrl}
                onChange={(e) => setForm({ ...form, agentUrl: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>发送时间</Label>
              <Input
                value={form.sendTime}
                onChange={(e) => setForm({ ...form, sendTime: e.target.value })}
                placeholder="yyyy-MM-dd"
              />
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
