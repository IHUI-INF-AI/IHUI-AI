// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 上游错误透传规则管理页(2026-09-17 立,PROJECT_PLAN 4-3 条目 53 缺失的管理端补齐)。
 *
 * 背景:53 交付时后端 5 端点 + v1-public 两处接入已落地,但前端零消费,运营无法自助配置
 * 上游状态码 → 下游状态码/文案的映射规则(此前只能改库或改代码)。
 *
 * 数据源 /api/admin/relay/error-rules*(列表/新建/更新/删除 + coverage 覆盖度)。
 * 规则命中口径:上游返回 upstreamStatus(可叠加 keyword 子串)时,改写为 downstreamStatus +
 * messageTemplate;priority 高者先命中;exposeUpstreamMessage 决定是否把上游原文透给调用方。
 */
import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertTriangle, Loader2, Plus, ShieldAlert, Trash2 } from 'lucide-react'

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Switch,
} from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import { BackButton, TruncatedText } from '@/components/common'
import { useConfirm } from '@/hooks/use-confirm'

interface ErrorRule {
  id: string
  upstreamStatus: number
  keyword: string | null
  downstreamStatus: number
  messageTemplate: string
  exposeUpstreamMessage: boolean
  priority: number
  enabled: boolean
  remark: string | null
}

interface CoverageGroup {
  upstreamStatus: number
  count: number
}

const emptyForm = {
  upstreamStatus: '429',
  keyword: '',
  downstreamStatus: '429',
  messageTemplate: '上游限流,请稍后重试',
  exposeUpstreamMessage: false,
  priority: 0,
  enabled: true,
  remark: '',
}

export default function ErrorRulesPage() {
  const { confirm, ConfirmDialogRenderer } = useConfirm()
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ErrorRule | null>(null)
  const [form, setForm] = React.useState(emptyForm)

  const rulesQ = useQuery({
    queryKey: ['admin', 'relay', 'error-rules'],
    queryFn: async () => {
      const r = await fetchApi<{ list: ErrorRule[]; total: number }>('/api/admin/relay/error-rules')
      if (!r.success) throw new Error(r.error)
      return r.data.list
    },
  })
  const coverageQ = useQuery({
    queryKey: ['admin', 'relay', 'error-rules', 'coverage'],
    queryFn: async () => {
      const r = await fetchApi<{ groups: CoverageGroup[] }>('/api/admin/relay/error-rules/coverage')
      if (!r.success) throw new Error(r.error)
      return r.data.groups
    },
  })

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'relay', 'error-rules'] })
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      const upstream = Number(form.upstreamStatus)
      const downstream = Number(form.downstreamStatus)
      if (!Number.isInteger(upstream) || upstream < 100 || upstream > 599) {
        throw new Error('上游状态码需为 100-599 的整数')
      }
      if (!Number.isInteger(downstream) || downstream < 100 || downstream > 599) {
        throw new Error('下游状态码需为 100-599 的整数')
      }
      if (!form.messageTemplate.trim()) throw new Error('下游文案不能为空')
      const body = {
        upstreamStatus: upstream,
        keyword: form.keyword.trim() || null,
        downstreamStatus: downstream,
        messageTemplate: form.messageTemplate.trim(),
        exposeUpstreamMessage: form.exposeUpstreamMessage,
        priority: Number(form.priority) || 0,
        enabled: form.enabled,
        remark: form.remark.trim() || null,
      }
      const r = editing
        ? await fetchApi(`/api/admin/relay/error-rules/${editing.id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
          })
        : await fetchApi('/api/admin/relay/error-rules', {
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
      const r = await fetchApi(`/api/admin/relay/error-rules/${id}`, { method: 'DELETE' })
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
      const r = await fetchApi(`/api/admin/relay/error-rules/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: p.enabled }),
      })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  })

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }
  const openEdit = (rule: ErrorRule) => {
    setEditing(rule)
    setForm({
      upstreamStatus: String(rule.upstreamStatus),
      keyword: rule.keyword ?? '',
      downstreamStatus: String(rule.downstreamStatus),
      messageTemplate: rule.messageTemplate,
      exposeUpstreamMessage: rule.exposeUpstreamMessage,
      priority: rule.priority,
      enabled: rule.enabled,
      remark: rule.remark ?? '',
    })
    setDialogOpen(true)
  }

  const busy = saveMut.isPending || deleteMut.isPending || toggleMut.isPending
  const coverage = coverageQ.data ?? []

  return (
    <div className="space-y-4 px-4 py-4">
      <BackButton />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <ShieldAlert className="h-5 w-5" aria-hidden />
            上游错误透传规则
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            把上游错误改写为对客状态码与文案,避免泄漏上游身份与原始报错;未命中规则时按默认透传口径处理。
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" aria-hidden />
          <span>新建规则</span>
        </Button>
      </div>

      {coverage.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
          <span className="text-xs text-muted-foreground">覆盖度(按上游状态码):</span>
          {coverage.map((g) => (
            <Badge key={g.upstreamStatus} variant="outline">
              {g.upstreamStatus} · {g.count} 条
            </Badge>
          ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs" style={{ tableLayout: 'fixed' }}>
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">上游状态</th>
              <th className="px-3 py-2 font-medium">附加关键字</th>
              <th className="px-3 py-2 font-medium">下游状态</th>
              <th className="px-3 py-2 font-medium">下游文案</th>
              <th className="px-3 py-2 font-medium">透传原文</th>
              <th className="px-3 py-2 font-medium">优先级</th>
              <th className="px-3 py-2 font-medium">启用</th>
              <th className="px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {(rulesQ.data ?? []).length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  {rulesQ.isLoading ? '加载中...' : '暂无规则,未命中时按默认口径透传上游错误'}
                </td>
              </tr>
            ) : (
              (rulesQ.data ?? []).map((rule) => (
                <tr key={rule.id} className="border-t border-border">
                  <td className="px-3 py-2 tabular-nums">
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-amber-600" aria-hidden />
                      {rule.upstreamStatus}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {rule.keyword ? <TruncatedText value={rule.keyword} /> : '—'}
                  </td>
                  <td className="px-3 py-2 tabular-nums font-medium">{rule.downstreamStatus}</td>
                  <td className="px-3 py-2">
                    <TruncatedText value={rule.messageTemplate} />
                  </td>
                  <td className="px-3 py-2">{rule.exposeUpstreamMessage ? '是' : '否'}</td>
                  <td className="px-3 py-2 tabular-nums">{rule.priority}</td>
                  <td className="px-3 py-2">
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={(v) => toggleMut.mutate({ id: rule.id, enabled: v })}
                      disabled={busy}
                      aria-label={`启用规则 ${rule.upstreamStatus}`}
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
                            description: `确认删除上游 ${rule.upstreamStatus} 的透传规则?`,
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? '编辑透传规则' : '新建透传规则'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="err-upstream">上游状态码</Label>
                <Input
                  id="err-upstream"
                  inputMode="numeric"
                  value={form.upstreamStatus}
                  onChange={(e) => setForm((f) => ({ ...f, upstreamStatus: e.target.value }))}
                  placeholder="429"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="err-downstream">下游状态码</Label>
                <Input
                  id="err-downstream"
                  inputMode="numeric"
                  value={form.downstreamStatus}
                  onChange={(e) => setForm((f) => ({ ...f, downstreamStatus: e.target.value }))}
                  placeholder="429"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="err-keyword">附加关键字(可选,子串匹配)</Label>
              <Input
                id="err-keyword"
                value={form.keyword}
                onChange={(e) => setForm((f) => ({ ...f, keyword: e.target.value }))}
                placeholder="留空 = 该状态码全部命中"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="err-message">下游文案</Label>
              <Input
                id="err-message"
                value={form.messageTemplate}
                onChange={(e) => setForm((f) => ({ ...f, messageTemplate: e.target.value }))}
                placeholder="上游限流,请稍后重试"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="err-priority">优先级(大者先命中)</Label>
                <Input
                  id="err-priority"
                  inputMode="numeric"
                  value={String(form.priority)}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, priority: Number(e.target.value) || 0 }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="err-remark">备注(可选)</Label>
                <Input
                  id="err-remark"
                  value={form.remark}
                  onChange={(e) => setForm((f) => ({ ...f, remark: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="err-expose">透传上游原文</Label>
                <p className="text-xs text-muted-foreground">
                  开启后调用方能看到上游原始报错(可能含上游身份信息)
                </p>
              </div>
              <Switch
                id="err-expose"
                checked={form.exposeUpstreamMessage}
                onCheckedChange={(v) => setForm((f) => ({ ...f, exposeUpstreamMessage: v }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="err-enabled">启用</Label>
              <Switch
                id="err-enabled"
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
