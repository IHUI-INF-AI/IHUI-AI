'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
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
  Settings,
  FileText,
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
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'

interface AgentRule {
  id: string
  agentId: string
  ruleName: string
  ruleCode: string
  ruleType: string
  priority: number
  status: number
  description: string | null
}

interface ListData {
  list: AgentRule[]
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
  ruleName: '',
  ruleCode: '',
  ruleType: 'filter',
  priority: '0',
  status: true,
  description: '',
}
const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export default function AgentRulePage() {
  const router = useRouter()
  const qc = useQueryClient()
  const [searchAgentId, setSearchAgentId] = React.useState('')
  const [searchName, setSearchName] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<AgentRule | null>(null)
  const [form, setForm] = React.useState(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'agent-rule', searchAgentId, searchName, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (searchAgentId) qs.set('agentId', searchAgentId)
      if (searchName) qs.set('ruleName', searchName)
      return api<ListData>(`/api/admin/agent-rule?${qs.toString()}`)
    },
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        agentId: form.agentId.trim(),
        ruleName: form.ruleName.trim(),
        ruleCode: form.ruleCode.trim(),
        ruleType: form.ruleType,
        priority: Number(form.priority) || 0,
        status: form.status ? 1 : 0,
        description: form.description.trim() || undefined,
      }
      return editing
        ? api(`/api/admin/agent-rule/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
        : api('/api/admin/agent-rule', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? '更新成功' : '新增成功')
      qc.invalidateQueries({ queryKey: ['admin', 'agent-rule'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/agent-rule/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['admin', 'agent-rule'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(item: AgentRule) {
    setEditing(item)
    setForm({
      agentId: item.agentId,
      ruleName: item.ruleName,
      ruleCode: item.ruleCode,
      ruleType: item.ruleType || 'filter',
      priority: String(item.priority),
      status: item.status === 1,
      description: item.description ?? '',
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
    if (!form.ruleName.trim()) {
      setErr('请输入规则名称')
      return
    }
    saveMut.mutate()
  }
  function handleDelete(item: AgentRule) {
    if (!window.confirm(`确认删除 "${item.ruleName}" ?`)) return
    deleteMut.mutate(item.id)
  }
  function handleExport() {
    exportToExcel(
      'Agent规则',
      [
        { key: 'id', title: 'ID' },
        { key: 'agentId', title: 'AgentID' },
        { key: 'ruleName', title: '规则名称' },
        { key: 'ruleCode', title: '规则编码' },
        { key: 'ruleType', title: '规则类型' },
        { key: 'priority', title: '优先级' },
        { key: 'status', title: '状态', formatter: (v) => (v === 1 ? '启用' : '禁用') },
        { key: 'description', title: '描述' },
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
        <h1 className="text-2xl font-bold tracking-tight">Agent 规则管理</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            导出
          </Button>
          <HasPermi code="ai:agentrule:add">
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
            value={searchAgentId}
            onChange={(e) => {
              setSearchAgentId(e.target.value)
              setPage(1)
            }}
            placeholder="搜索 AgentID"
            className="h-9 pl-8"
          />
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchName}
            onChange={(e) => {
              setSearchName(e.target.value)
              setPage(1)
            }}
            placeholder="搜索规则名称"
            className="h-9 pl-8"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">AgentID</TableHead>
              <TableHead className="px-4 py-2.5">规则名称</TableHead>
              <TableHead className="px-4 py-2.5">规则编码</TableHead>
              <TableHead className="px-4 py-2.5">类型</TableHead>
              <TableHead className="px-4 py-2.5">优先级</TableHead>
              <TableHead className="px-4 py-2.5">状态</TableHead>
              <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中…
                </TableCell>
              </TableRow>
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  <FileText className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              list.map((item) => (
                <TableRow key={item.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-mono text-xs">
                    {item.agentId?.slice(0, 8) ?? '-'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 font-medium">{item.ruleName}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                      {item.ruleCode || '-'}
                    </code>
                  </TableCell>
                  <TableCell className="px-4 py-2.5">{item.ruleType || '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">{item.priority}</TableCell>
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
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/admin/agent-rule-param?ruleId=${item.id}`)}
                        title="规则参数"
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      <HasPermi code="ai:agentrule:edit">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(item)}
                          title="编辑"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </HasPermi>
                      <HasPermi code="ai:agentrule:remove">
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
              <DialogTitle>{editing ? '编辑规则' : '新增规则'}</DialogTitle>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="space-y-2">
              <Label>Agent ID</Label>
              <Input
                value={form.agentId}
                onChange={(e) => setForm({ ...form, agentId: e.target.value })}
                placeholder="请输入 Agent ID"
              />
            </div>
            <div className="space-y-2">
              <Label>规则名称</Label>
              <Input
                value={form.ruleName}
                onChange={(e) => setForm({ ...form, ruleName: e.target.value })}
                placeholder="请输入规则名称"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>规则编码</Label>
                <Input
                  value={form.ruleCode}
                  onChange={(e) => setForm({ ...form, ruleCode: e.target.value })}
                  placeholder="请输入规则编码"
                />
              </div>
              <div className="space-y-2">
                <Label>规则类型</Label>
                <Select
                  value={form.ruleType}
                  onValueChange={(v) => setForm({ ...form, ruleType: v })}
                >
                  <SelectTrigger className={selectClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="filter">过滤</SelectItem>
                    <SelectItem value="replace">替换</SelectItem>
                    <SelectItem value="limit">限制</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="space-y-2">
                <Label>优先级</Label>
                <Input
                  type="number"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2 pt-7">
                <Switch
                  checked={form.status}
                  onCheckedChange={(v) => setForm({ ...form, status: v })}
                />
                <Label>启用</Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label>描述</Label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="请输入描述"
                className="min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
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
