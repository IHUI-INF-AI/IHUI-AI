// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 告警规则引擎管理页(2026-09-16 立,PROJECT_PLAN 4-2 条目 47)。
 *
 * 三区块:规则列表(启停/删除/编辑)+ 新建/编辑 Dialog + 最近告警事件流。
 * 数据源 /api/admin/relay/alert-rules*(后端 6 端点已就绪,commit 6cc5a811c4d)。
 * 交互:立即评估返回 evaluated/triggered/skipped 并 toast;启用 Switch 即时 PATCH。
 */
import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { BellRing, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react'

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Loader2 as LoaderIcon,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import { TruncatedText } from '@/components/common'
import { BackButton } from '@/components/common'
import { useConfirm } from '@/hooks/use-confirm'

interface AlertRule {
  id: string
  name: string
  metric: string
  comparison: string
  threshold: string
  cooldownMinutes: number
  enabled: boolean
  remark: string | null
}

interface AlertEvent {
  id: string
  ruleName: string
  metric: string
  observedValue: string
  threshold: string
  message: string
  pushStatus: string
  createdAt: string
}

const METRIC_LABEL: Record<string, string> = {
  error_rate_1h: '近 1 小时失败率',
  avg_latency_1h: '近 1 小时平均延迟(ms)',
  failed_calls_24h: '近 24 小时失败调用数',
  low_balance_keys: '低余额活跃 Key 数',
}

const METRIC_OPTIONS = Object.entries(METRIC_LABEL).map(([value, label]) => ({ value, label }))

const emptyForm = {
  name: '',
  metric: 'error_rate_1h',
  comparison: 'gt',
  threshold: '1',
  cooldownMinutes: 30,
  enabled: true,
}

export default function AlertRulesPage() {
  const { confirm, ConfirmDialogRenderer } = useConfirm()
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<AlertRule | null>(null)
  const [form, setForm] = React.useState(emptyForm)

  const rulesQ = useQuery({
    queryKey: ['admin', 'relay', 'alert-rules'],
    queryFn: async () => {
      const r = await fetchApi<{ list: AlertRule[]; total: number }>('/api/admin/relay/alert-rules')
      if (!r.success) throw new Error(r.error)
      return r.data.list
    },
  })
  const eventsQ = useQuery({
    queryKey: ['admin', 'relay', 'alert-events'],
    queryFn: async () => {
      const r = await fetchApi<{ events: AlertEvent[] }>('/api/admin/relay/alert-rules/events')
      if (!r.success) throw new Error(r.error)
      return r.data.events
    },
  })

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'relay', 'alert-rules'] })
    void qc.invalidateQueries({ queryKey: ['admin', 'relay', 'alert-events'] })
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name,
        metric: form.metric,
        comparison: form.comparison,
        threshold: Number(form.threshold),
        cooldownMinutes: form.cooldownMinutes,
        enabled: form.enabled,
      }
      const r = editing
        ? await fetchApi(`/api/admin/relay/alert-rules/${editing.id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
          })
        : await fetchApi('/api/admin/relay/alert-rules', {
            method: 'POST',
            body: JSON.stringify(body),
          })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: () => {
      invalidate()
      setDialogOpen(false)
      toast.success(editing ? '规则已更新' : '规则已创建')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetchApi(`/api/admin/relay/alert-rules/${id}`, { method: 'DELETE' })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: () => {
      invalidate()
      toast.success('规则已删除')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const toggleMut = useMutation({
    mutationFn: async (p: { id: string; enabled: boolean }) => {
      const r = await fetchApi(`/api/admin/relay/alert-rules/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: p.enabled }),
      })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  })

  const evaluateMut = useMutation({
    mutationFn: async () => {
      const r = await fetchApi<{ evaluated: number; triggered: number; skippedCooldown: number }>(
        '/api/admin/relay/alert-rules/evaluate',
        { method: 'POST' },
      )
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: (d) => {
      invalidate()
      toast.success(
        `评估 ${d.evaluated} 条,触发 ${d.triggered} 条,冷却跳过 ${d.skippedCooldown} 条`,
      )
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }
  const openEdit = (rule: AlertRule) => {
    setEditing(rule)
    setForm({
      name: rule.name,
      metric: rule.metric,
      comparison: rule.comparison,
      threshold: String(Number(rule.threshold)),
      cooldownMinutes: rule.cooldownMinutes,
      enabled: rule.enabled,
    })
    setDialogOpen(true)
  }

  const busy = saveMut.isPending || deleteMut.isPending || toggleMut.isPending

  return (
    <div className="px-4 py-4 space-y-4">
      <BackButton />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <BellRing className="h-5 w-5" aria-hidden />
            告警规则引擎
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            自定义指标阈值,每 5 分钟自动评估,触发即推送并记录事件流。
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => evaluateMut.mutate()}
            disabled={evaluateMut.isPending}
          >
            {evaluateMut.isPending ? (
              <LoaderIcon className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden />
            )}
            <span>立即评估</span>
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden />
            <span>新建规则</span>
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs" style={{ tableLayout: 'fixed' }}>
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">规则名</th>
              <th className="px-3 py-2 font-medium">指标</th>
              <th className="px-3 py-2 font-medium">条件</th>
              <th className="px-3 py-2 font-medium">冷却</th>
              <th className="px-3 py-2 font-medium">启用</th>
              <th className="px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {(rulesQ.data ?? []).length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  {rulesQ.isLoading ? '加载中...' : '暂无规则,点击「新建规则」创建第一条告警'}
                </td>
              </tr>
            ) : (
              (rulesQ.data ?? []).map((rule) => (
                <tr key={rule.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <TruncatedText value={rule.name} />
                  </td>
                  <td className="px-3 py-2">{METRIC_LABEL[rule.metric] ?? rule.metric}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {rule.comparison === 'gt' ? '>' : '<'} {Number(rule.threshold)}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{rule.cooldownMinutes} 分钟</td>
                  <td className="px-3 py-2">
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={(v) => toggleMut.mutate({ id: rule.id, enabled: v })}
                      disabled={busy}
                      aria-label={`启用 ${rule.name}`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <Button size="xs" variant="outline" onClick={() => openEdit(rule)}>
                        <span>编辑</span>
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          void confirm({
                            title: '确认删除规则',
                            description: `确认删除「${rule.name}」?`,
                            variant: 'destructive',
                          }).then((ok) => {
                            if (ok) deleteMut.mutate(rule.id)
                          })
                        }}
                      >
                        <Trash2 className="h-3 w-3" aria-hidden />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h2 className="pt-2 text-base font-medium">最近告警事件</h2>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs" style={{ tableLayout: 'fixed' }}>
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">规则</th>
              <th className="px-3 py-2 font-medium">消息</th>
              <th className="px-3 py-2 font-medium">观测/阈值</th>
              <th className="px-3 py-2 font-medium">推送</th>
              <th className="px-3 py-2 font-medium">时间</th>
            </tr>
          </thead>
          <tbody>
            {(eventsQ.data ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  暂无告警事件
                </td>
              </tr>
            ) : (
              (eventsQ.data ?? []).map((ev) => (
                <tr key={ev.id} className="border-t border-border">
                  <td className="truncate px-3 py-2 font-medium">{ev.ruleName}</td>
                  <td className="px-3 py-2">
                    <TruncatedText value={ev.message} />
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {Number(ev.observedValue)} / {Number(ev.threshold)}
                  </td>
                  <td className="px-3 py-2">{ev.pushStatus}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {new Date(ev.createdAt).toLocaleString('zh-CN')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? '编辑告警规则' : '新建告警规则'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="alert-name">规则名</Label>
              <Input
                id="alert-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="如:近 1 小时失败率超 5%"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>指标</Label>
                <Select
                  value={form.metric}
                  onValueChange={(v) => setForm((f) => ({ ...f, metric: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METRIC_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>条件</Label>
                <Select
                  value={form.comparison}
                  onValueChange={(v) => setForm((f) => ({ ...f, comparison: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gt">超过阈值</SelectItem>
                    <SelectItem value="lt">低于阈值</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="alert-threshold">阈值</Label>
                <Input
                  id="alert-threshold"
                  inputMode="decimal"
                  value={form.threshold}
                  onChange={(e) => setForm((f) => ({ ...f, threshold: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="alert-cooldown">冷却(分钟)</Label>
                <Input
                  id="alert-cooldown"
                  inputMode="numeric"
                  value={String(form.cooldownMinutes)}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, cooldownMinutes: Number(e.target.value) || 0 }))
                  }
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="alert-enabled">启用</Label>
              <Switch
                id="alert-enabled"
                checked={form.enabled}
                onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saveMut.isPending}
            >
              <span>取消</span>
            </Button>
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              <span>保存</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialogRenderer />
      {rulesQ.isLoading && !dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
