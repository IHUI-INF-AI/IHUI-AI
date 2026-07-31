'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Layers,
  Users,
  AlertTriangle,
  Gauge,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Zap,
  RotateCcw,
  Loader2,
  FlaskConical,
  Power,
} from 'lucide-react'
import { fetchApi } from '@/lib/api'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  Label,
  Switch,
  Badge,
  Checkbox,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui-react'
import { Skeleton } from '@/components/ui/skeleton'

type Strategy = 'weight' | 'round-robin' | 'least-latency'
type CircuitState = 'closed' | 'open' | 'half-open'

interface ChannelGroup {
  id: string
  name: string
  description: string | null
  loadBalanceStrategy: Strategy
  enabled: boolean
  priority: number
  memberCount: number
}
interface MemberRow {
  memberId: string
  keyPoolId: string
  weight: number
  keyPoolName: string | null
  keyPoolProviderCode: string | null
  circuitState: CircuitState
  avgLatencyMs: number | null
}
interface GroupStats {
  memberCount: number
  circuitSummary: { closed: number; open: number; halfOpen: number }
  members: MemberRow[]
}

// 2026-07-31 新增:连通性测试结果(对齐后端 :id/test 响应)
interface ChannelTestResult {
  success: boolean
  latencyMs: number
  response: string | null
  tokensUsed: number
  error: string | null
}
interface BatchToggleResp {
  updated: number
  failed: number
}

const STRATEGY_LABEL: Record<Strategy, string> = {
  weight: '权重',
  'round-robin': '轮询',
  'least-latency': '最少延迟',
}
const CIRCUIT_CLASS: Record<CircuitState, string> = {
  closed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  open: 'bg-red-500/10 text-red-600 dark:text-red-400',
  'half-open': 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
}
const CIRCUIT_LABEL: Record<CircuitState, string> = {
  closed: '正常',
  open: '熔断',
  'half-open': '半开',
}
const maskId = (id: string) => `${id.slice(0, 4)}…${id.slice(-4)}`
const EMPTY_FORM = { name: '', description: '', strategy: 'weight' as Strategy, priority: '0' }

export default function AdminRelayChannelsPage() {
  const qc = useQueryClient()
  const [expanded, setExpanded] = React.useState<string | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [form, setForm] = React.useState(EMPTY_FORM)
  const [addForm, setAddForm] = React.useState<{
    groupId: string
    keyPoolId: string
    weight: string
  } | null>(null)
  // 2026-07-31 新增:批量选择 + 连通性测试
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [testTarget, setTestTarget] = React.useState<{ keyPoolId: string; name: string } | null>(
    null,
  )
  const [testForm, setTestForm] = React.useState<{ model: string; prompt: string }>({
    model: '',
    prompt: 'hi',
  })
  const [testResult, setTestResult] = React.useState<ChannelTestResult | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'relay', 'channels'],
    queryFn: async () => {
      const r = await fetchApi<{ list: ChannelGroup[] }>('/api/admin/relay/channels/groups')
      if (!r.success) throw new Error(r.error)
      const groups = r.data.list
      const statsRes = await Promise.all(
        groups.map(async (g) => {
          const sr = await fetchApi<GroupStats>(`/api/admin/relay/channels/groups/${g.id}/stats`)
          return sr.success ? sr.data : null
        }),
      )
      return { groups, stats: statsRes }
    },
    refetchInterval: 30_000,
  })

  const groups = data?.groups ?? []
  const stats = data?.stats ?? []
  const totalMembers = stats.reduce((s, x) => s + (x?.memberCount ?? 0), 0)
  const openCircuits = stats.reduce(
    (s, x) => s + (x?.circuitSummary.open ?? 0) + (x?.circuitSummary.halfOpen ?? 0),
    0,
  )
  const latencies = stats
    .flatMap((x) => x?.members ?? [])
    .map((m) => m.avgLatencyMs)
    .filter((v): v is number => v !== undefined && v !== null)
  const avgLatency = latencies.length
    ? Math.round(latencies.reduce((s, v) => s + v, 0) / latencies.length)
    : null
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'relay', 'channels'] })

  const actMut = useMutation({
    mutationFn: async (vars: {
      url: string
      method: 'POST' | 'PATCH' | 'DELETE'
      body?: unknown
    }) => {
      const r = await fetchApi(vars.url, {
        method: vars.method,
        headers: vars.body ? { 'Content-Type': 'application/json' } : undefined,
        body: vars.body ? JSON.stringify(vars.body) : undefined,
      })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: (_d, vars) => {
      const isGroup = !vars.url.includes('/members')
      if (vars.method === 'PATCH') {
        invalidate()
        return
      }
      const msg =
        vars.method === 'POST'
          ? isGroup
            ? '已创建渠道组'
            : '已添加成员'
          : isGroup
            ? '已删除'
            : '已移除成员'
      toast.success(msg)
      if (vars.method === 'POST' && isGroup) {
        setCreateOpen(false)
        setForm(EMPTY_FORM)
      }
      if (vars.method === 'POST' && !isGroup) setAddForm(null)
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message || '操作失败'),
  })

  const probeMut = useMutation({
    mutationFn: async (vars: { keyPoolId: string; mode: 'test' | 'reset' }) => {
      const url =
        vars.mode === 'test'
          ? `/api/admin/relay/channels/test/${vars.keyPoolId}`
          : `/api/admin/relay/channels/test/${vars.keyPoolId}/reset-circuit`
      const r = await fetchApi<{ ok?: boolean; latencyMs?: number; errorMessage?: string | null }>(
        url,
        { method: 'POST' },
      )
      if (!r.success) throw new Error(r.error)
      return { mode: vars.mode, data: r.data }
    },
    onSuccess: (r) => {
      if (r.mode === 'test') {
        const d = r.data
        if (d?.ok) toast.success(`测速成功:${d.latencyMs}ms`)
        else toast.error(`测速失败:${d?.errorMessage ?? ''}`)
      } else {
        toast.success('已重置熔断')
      }
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message || '操作失败'),
  })

  // 2026-07-31 新增:批量启停(走 batch-toggle 端点)
  const batchToggleMut = useMutation({
    mutationFn: async (vars: { ids: string[]; enabled: boolean }) => {
      const r = await fetchApi<BatchToggleResp>('/api/admin/relay/channels/batch-toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vars),
      })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: (d, vars) => {
      const action = vars.enabled ? '启用' : '禁用'
      if (d.failed > 0) toast.warning(`已${action} ${d.updated} 个,${d.failed} 个失败`)
      else toast.success(`已${action} ${d.updated} 个渠道组`)
      setSelected(new Set())
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message || '批量操作失败'),
  })

  // 2026-07-31 新增:批量删除(循环调单删端点,无新增端点)
  const batchDeleteMut = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(
        ids.map((id) => fetchApi(`/api/admin/relay/channels/groups/${id}`, { method: 'DELETE' })),
      )
      const fulfilled = results.filter((r) => r.status === 'fulfilled').length
      const rejected = results.length - fulfilled
      return { fulfilled, rejected }
    },
    onSuccess: (d) => {
      if (d.rejected > 0) toast.warning(`已删除 ${d.fulfilled} 个,${d.rejected} 个失败`)
      else toast.success(`已删除 ${d.fulfilled} 个渠道组`)
      setSelected(new Set())
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message || '批量删除失败'),
  })

  // 2026-07-31 新增:连通性测试(走 :id/test 端点,不计费)
  const testChannelMut = useMutation({
    mutationFn: async (vars: { keyPoolId: string; model: string; prompt: string }) => {
      const r = await fetchApi<ChannelTestResult>(
        `/api/admin/relay/channels/${vars.keyPoolId}/test`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: vars.model, prompt: vars.prompt }),
        },
      )
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: (d) => {
      setTestResult(d)
      if (d.success) toast.success(`测试成功:${d.latencyMs}ms / ${d.tokensUsed} tokens`)
      else toast.error(`测试失败:${d.error ?? '未知错误'}`)
    },
    onError: (e: Error) => {
      setTestResult(null)
      toast.error(e.message || '测试失败')
    },
  })

  const submitCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('组名必填')
    actMut.mutate({
      url: '/api/admin/relay/channels/groups',
      method: 'POST',
      body: {
        name: form.name.trim(),
        description: form.description || null,
        loadBalanceStrategy: form.strategy,
        priority: Number(form.priority) || 0,
        enabled: true,
      },
    })
  }
  const submitAddMember = (e: React.FormEvent) => {
    e.preventDefault()
    if (!addForm) return
    if (!addForm.keyPoolId.trim()) return toast.error('keyPoolId 必填')
    actMut.mutate({
      url: `/api/admin/relay/channels/groups/${addForm.groupId}/members`,
      method: 'POST',
      body: { keyPoolId: addForm.keyPoolId.trim(), weight: Number(addForm.weight) || 1 },
    })
  }

  // 2026-07-31 新增:批量选择 + 测试 Dialog 控制
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const toggleSelectAll = (ids: string[]) => {
    setSelected((prev) => {
      if (ids.every((id) => prev.has(id))) return new Set()
      return new Set(ids)
    })
  }
  const openTestDialog = (keyPoolId: string, name: string) => {
    setTestTarget({ keyPoolId, name })
    setTestForm({ model: '', prompt: 'hi' })
    setTestResult(null)
  }
  const submitTest = (e: React.FormEvent) => {
    e.preventDefault()
    if (!testTarget) return
    if (!testForm.model.trim()) return toast.error('model 必填')
    testChannelMut.mutate({
      keyPoolId: testTarget.keyPoolId,
      model: testForm.model.trim(),
      prompt: testForm.prompt || 'hi',
    })
  }

  const KPI = [
    {
      label: '渠道组总数',
      value: groups.length as string | number,
      icon: Layers,
      color: 'text-primary',
    },
    {
      label: '成员总数',
      value: totalMembers as string | number,
      icon: Users,
      color: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: '熔断中',
      value: openCircuits as string | number,
      icon: AlertTriangle,
      color: 'text-red-600 dark:text-red-400',
    },
    {
      label: '平均延迟',
      value: avgLatency === null ? '—' : `${avgLatency}ms`,
      icon: Gauge,
      color: 'text-amber-600 dark:text-amber-400',
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Layers className="h-6 w-6 text-primary" /> 渠道统一管理
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">聚合渠道组、一键测速与熔断状态可视化</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> 新建渠道组
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {KPI.map((k) => (
          <Card key={k.label}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>{k.label}</span>
                <k.icon className={`h-4 w-4 ${k.color}`} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <div className={`text-2xl font-bold tabular-nums ${k.color}`}>{k.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <Card>
            <CardContent className="py-6">
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ) : groups.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              暂无渠道组,点击右上角&ldquo;新建渠道组&rdquo;开始
            </CardContent>
          </Card>
        ) : (
          <>
            {/* 2026-07-31 新增:批量操作工具栏(选中时显示) */}
            {selected.size > 0 && (
              <Card>
                <CardContent className="flex flex-wrap items-center gap-2 py-3">
                  <span className="text-sm font-medium">已选 {selected.size} 个</span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={batchToggleMut.isPending}
                    onClick={() => batchToggleMut.mutate({ ids: [...selected], enabled: true })}
                  >
                    <Power className="h-3 w-3" /> 批量启用
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={batchToggleMut.isPending}
                    onClick={() => batchToggleMut.mutate({ ids: [...selected], enabled: false })}
                  >
                    <Power className="h-3 w-3" /> 批量禁用
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    disabled={batchDeleteMut.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          `确认删除选中的 ${selected.size} 个渠道组?此操作会级联删除其下所有成员关系。`,
                        )
                      )
                        batchDeleteMut.mutate([...selected])
                    }}
                  >
                    <Trash2 className="h-3 w-3" /> 批量删除
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                    取消选择
                  </Button>
                </CardContent>
              </Card>
            )}
            {/* 全选行 */}
            <div className="flex items-center gap-2 px-1">
              <Checkbox
                checked={groups.length > 0 && selected.size === groups.length}
                onCheckedChange={() => toggleSelectAll(groups.map((g) => g.id))}
                aria-label="全选"
              />
              <span className="text-xs text-muted-foreground">
                {selected.size > 0
                  ? `已选 ${selected.size} / ${groups.length}`
                  : `共 ${groups.length} 个渠道组,勾选可批量操作`}
              </span>
            </div>
            {groups.map((g, i) => {
              const st = stats[i]
              const isOpen = expanded === g.id
              const members = st?.members ?? []
              return (
                <Card key={g.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Checkbox
                            checked={selected.has(g.id)}
                            onCheckedChange={() => toggleSelect(g.id)}
                            aria-label={`选择 ${g.name}`}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => setExpanded(isOpen ? null : g.id)}
                            aria-label={isOpen ? '收起' : '展开'}
                          >
                            {isOpen ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                          <CardTitle className="text-base">{g.name}</CardTitle>
                          <Badge variant="secondary" className="text-xs">
                            {STRATEGY_LABEL[g.loadBalanceStrategy]}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            优先级 {g.priority}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {g.memberCount} 成员
                          </Badge>
                        </div>
                        {g.description && (
                          <CardDescription className="pl-9">{g.description}</CardDescription>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={g.enabled}
                          onCheckedChange={(c) =>
                            actMut.mutate({
                              url: `/api/admin/relay/channels/groups/${g.id}`,
                              method: 'PATCH',
                              body: { enabled: c },
                            })
                          }
                          aria-label="启用/禁用"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => {
                            if (window.confirm(`确认删除渠道组 "${g.name}"?`))
                              actMut.mutate({
                                url: `/api/admin/relay/channels/groups/${g.id}`,
                                method: 'DELETE',
                              })
                          }}
                          aria-label="删除"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  {isOpen && (
                    <CardContent className="pt-0">
                      <div className="ml-9 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setAddForm({ groupId: g.id, keyPoolId: '', weight: '1' })
                            }
                          >
                            <Plus className="h-3 w-3" /> 添加成员
                          </Button>
                          {st && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <span>熔断:</span>
                              <Badge className={CIRCUIT_CLASS.closed}>
                                {st.circuitSummary.closed} 正常
                              </Badge>
                              <Badge className={CIRCUIT_CLASS.open}>
                                {st.circuitSummary.open} 熔断
                              </Badge>
                              <Badge className={CIRCUIT_CLASS['half-open']}>
                                {st.circuitSummary.halfOpen} 半开
                              </Badge>
                            </div>
                          )}
                        </div>
                        <div className="rounded-md border border-border">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                              <tr>
                                <th className="px-3 py-2 text-left">Key Pool</th>
                                <th className="px-3 py-2 text-left">Provider</th>
                                <th className="px-3 py-2 text-right">权重</th>
                                <th className="px-3 py-2 text-left">熔断</th>
                                <th className="px-3 py-2 text-right">延迟</th>
                                <th className="px-3 py-2 text-right">操作</th>
                              </tr>
                            </thead>
                            <tbody>
                              {members.length === 0 ? (
                                <tr>
                                  <td
                                    colSpan={6}
                                    className="px-3 py-4 text-center text-muted-foreground"
                                  >
                                    暂无成员
                                  </td>
                                </tr>
                              ) : (
                                members.map((m) => (
                                  <tr key={m.memberId} className="border-t border-border">
                                    <td className="px-3 py-2 font-mono text-xs" title={m.keyPoolId}>
                                      {m.keyPoolName ?? maskId(m.keyPoolId)}
                                    </td>
                                    <td className="px-3 py-2 text-xs">
                                      {m.keyPoolProviderCode ?? '—'}
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums">
                                      {m.weight}
                                    </td>
                                    <td className="px-3 py-2">
                                      <Badge className={CIRCUIT_CLASS[m.circuitState]}>
                                        {CIRCUIT_LABEL[m.circuitState]}
                                      </Badge>
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums">
                                      {m.avgLatencyMs === null
                                        ? '—'
                                        : `${Math.round(m.avgLatencyMs)}ms`}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                      <div className="flex items-center justify-end gap-1">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 w-7 p-0"
                                          disabled={probeMut.isPending}
                                          onClick={() =>
                                            probeMut.mutate({
                                              keyPoolId: m.keyPoolId,
                                              mode: 'test',
                                            })
                                          }
                                          aria-label="测速"
                                        >
                                          <Zap className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 w-7 p-0"
                                          disabled={testChannelMut.isPending}
                                          onClick={() =>
                                            openTestDialog(
                                              m.keyPoolId,
                                              m.keyPoolName ?? maskId(m.keyPoolId),
                                            )
                                          }
                                          aria-label="连通性测试"
                                        >
                                          <FlaskConical className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 w-7 p-0"
                                          disabled={probeMut.isPending}
                                          onClick={() =>
                                            probeMut.mutate({
                                              keyPoolId: m.keyPoolId,
                                              mode: 'reset',
                                            })
                                          }
                                          aria-label="重置熔断"
                                        >
                                          <RotateCcw className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                          onClick={() => {
                                            if (window.confirm('确认移除该成员?'))
                                              actMut.mutate({
                                                url: `/api/admin/relay/channels/groups/${g.id}/members/${m.memberId}`,
                                                method: 'DELETE',
                                              })
                                          }}
                                          aria-label="移除"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              )
            })}
          </>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建渠道组</DialogTitle>
            <DialogDescription>配置组名、负载均衡策略与优先级</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitCreate} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="grp-name">组名</Label>
              <Input
                id="grp-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="例如:OpenAI 主渠道"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="grp-desc">描述</Label>
              <Input
                id="grp-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="可选"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>负载策略</Label>
                <Select
                  value={form.strategy}
                  onValueChange={(v) => setForm({ ...form, strategy: v as Strategy })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weight">权重</SelectItem>
                    <SelectItem value="round-robin">轮询</SelectItem>
                    <SelectItem value="least-latency">最少延迟</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="grp-priority">优先级</Label>
                <Input
                  id="grp-priority"
                  type="number"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={actMut.isPending}>
                {actMut.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} 创建
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={addForm !== null} onOpenChange={(o) => !o && setAddForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加渠道成员</DialogTitle>
            <DialogDescription>输入 Key 池 UUID 与权重</DialogDescription>
          </DialogHeader>
          {addForm && (
            <form onSubmit={submitAddMember} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="m-key">Key Pool ID (UUID)</Label>
                <Input
                  id="m-key"
                  value={addForm.keyPoolId}
                  onChange={(e) => setAddForm({ ...addForm, keyPoolId: e.target.value })}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="m-weight">权重</Label>
                <Input
                  id="m-weight"
                  type="number"
                  min={1}
                  value={addForm.weight}
                  onChange={(e) => setAddForm({ ...addForm, weight: e.target.value })}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAddForm(null)}>
                  取消
                </Button>
                <Button type="submit" disabled={actMut.isPending}>
                  {actMut.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} 添加
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* 2026-07-31 新增:连通性测试 Dialog */}
      <Dialog open={testTarget !== null} onOpenChange={(o) => !o && setTestTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>连通性测试</DialogTitle>
            <DialogDescription>
              {testTarget ? `渠道:${testTarget.name}` : '发起一次真实 chat completions 调用,不计费'}
            </DialogDescription>
          </DialogHeader>
          {testTarget && (
            <form onSubmit={submitTest} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="t-model">模型</Label>
                <Input
                  id="t-model"
                  value={testForm.model}
                  onChange={(e) => setTestForm({ ...testForm, model: e.target.value })}
                  placeholder="如 gpt-4o-mini / step-1-flash"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="t-prompt">Prompt</Label>
                <Input
                  id="t-prompt"
                  value={testForm.prompt}
                  onChange={(e) => setTestForm({ ...testForm, prompt: e.target.value })}
                  placeholder="hi"
                />
              </div>
              {testResult && (
                <div className="rounded-md border border-border bg-muted/30 p-3 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">状态</span>
                    <Badge
                      className={
                        testResult.success
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-red-500/10 text-red-600 dark:text-red-400'
                      }
                    >
                      {testResult.success ? '成功' : '失败'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">延迟</span>
                    <span className="tabular-nums font-medium">{testResult.latencyMs}ms</span>
                  </div>
                  {testResult.success && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Tokens</span>
                      <span className="tabular-nums font-medium">{testResult.tokensUsed}</span>
                    </div>
                  )}
                  {testResult.response && (
                    <div className="space-y-1 pt-1">
                      <span className="text-muted-foreground">响应</span>
                      <div className="max-h-32 overflow-auto rounded bg-background p-2 font-mono text-xs leading-relaxed">
                        {testResult.response}
                      </div>
                    </div>
                  )}
                  {testResult.error && (
                    <div className="space-y-1 pt-1">
                      <span className="text-muted-foreground">错误</span>
                      <div className="rounded bg-red-500/5 p-2 font-mono text-xs text-red-600 dark:text-red-400">
                        {testResult.error}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setTestTarget(null)}>
                  关闭
                </Button>
                <Button type="submit" disabled={testChannelMut.isPending}>
                  {testChannelMut.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}{' '}
                  测试
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
