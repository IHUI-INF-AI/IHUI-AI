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
  Link2,
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
  Switch,
} from '@ihui/ui'

interface DeveloperLink {
  id: string
  developerId: string
  agentId: string
  status: number
  createdAt: string
}

interface ListData {
  list: DeveloperLink[]
  total: number
}

const PAGE_SIZE = 10

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const EMPTY = { developerId: '', agentId: '', status: true }

export default function DeveloperLinkPage() {
  const qc = useQueryClient()
  const [searchDeveloper, setSearchDeveloper] = React.useState('')
  const [searchAgent, setSearchAgent] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<DeveloperLink | null>(null)
  const [form, setForm] = React.useState(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'developer-link', searchDeveloper, searchAgent, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (searchDeveloper) qs.set('developerId', searchDeveloper)
      if (searchAgent) qs.set('agentId', searchAgent)
      return api<ListData>(`/api/admin/developer-link?${qs.toString()}`)
    },
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        developerId: form.developerId.trim(),
        agentId: form.agentId.trim(),
        status: form.status ? 1 : 0,
      }
      return editing
        ? api(`/api/admin/developer-link/${editing.id}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          })
        : api('/api/admin/developer-link', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? '更新成功' : '新增成功')
      qc.invalidateQueries({ queryKey: ['admin', 'developer-link'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/developer-link/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['admin', 'developer-link'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(item: DeveloperLink) {
    setEditing(item)
    setForm({ developerId: item.developerId, agentId: item.agentId, status: item.status === 1 })
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
    if (!form.developerId.trim()) {
      setErr('请输入开发者ID')
      return
    }
    saveMut.mutate()
  }
  function handleDelete(item: DeveloperLink) {
    if (!window.confirm('确认删除该记录?')) return
    deleteMut.mutate(item.id)
  }
  function handleExport() {
    exportToExcel(
      '开发者链接',
      [
        { key: 'id', title: 'ID' },
        { key: 'developerId', title: '开发者ID' },
        { key: 'agentId', title: 'AgentID' },
        { key: 'status', title: '状态', formatter: (v) => (v === 1 ? '启用' : '禁用') },
        { key: 'createdAt', title: '创建时间' },
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
        <h1 className="text-2xl font-bold tracking-tight">开发者链接管理</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            导出
          </Button>
          <HasPermi code="ai:developerLink:add">
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              新增
            </Button>
          </HasPermi>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchDeveloper}
            onChange={(e) => {
              setSearchDeveloper(e.target.value)
              setPage(1)
            }}
            placeholder="搜索开发者ID"
            className="h-9 pl-8"
          />
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchAgent}
            onChange={(e) => {
              setSearchAgent(e.target.value)
              setPage(1)
            }}
            placeholder="搜索 AgentID"
            className="h-9 pl-8"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">开发者ID</TableHead>
              <TableHead className="px-4 py-2.5">AgentID</TableHead>
              <TableHead className="px-4 py-2.5">状态</TableHead>
              <TableHead className="px-4 py-2.5">创建时间</TableHead>
              <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中…
                </TableCell>
              </TableRow>
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <Link2 className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              list.map((item) => (
                <TableRow key={item.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-mono text-xs">
                    {item.developerId?.slice(0, 8) ?? '-'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 font-mono text-xs">
                    {item.agentId?.slice(0, 8) ?? '-'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={
                        item.status === 1
                          ? 'inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600'
                          : 'inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground'
                      }
                    >
                      {item.status === 1 ? '启用' : '禁用'}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-muted-foreground">
                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <HasPermi code="ai:developerLink:edit">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(item)}
                          title="编辑"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </HasPermi>
                      <HasPermi code="ai:developerLink:remove">
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
        <DialogContent className="max-w-md">
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? '编辑开发者链接' : '新增开发者链接'}</DialogTitle>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="space-y-2">
              <Label>开发者 ID</Label>
              <Input
                value={form.developerId}
                onChange={(e) => setForm({ ...form, developerId: e.target.value })}
                placeholder="请输入开发者 ID"
              />
            </div>
            <div className="space-y-2">
              <Label>Agent ID</Label>
              <Input
                value={form.agentId}
                onChange={(e) => setForm({ ...form, agentId: e.target.value })}
                placeholder="请输入 Agent ID"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.status}
                onCheckedChange={(v) => setForm({ ...form, status: v })}
              />
              <Label>启用</Label>
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
