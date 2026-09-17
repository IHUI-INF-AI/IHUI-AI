// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 提示词审计页(2026-09-17 立,PROJECT_PLAN 4-3 条目 54 缺失的管理端补齐)。
 *
 * 背景:54 标注「待排期」,后端 6 端点(规则 CRUD + 命中记录 + 按规则统计)已落地并注册
 * (routes/index.ts:1148),但前端零消费,运营既看不到命中情况也无法自助加规则。
 * 本页补齐后 54 具备完整可用闭环。
 *
 * 数据源 /api/admin/relay/prompt-audit/(rules | hits | stats)。
 * 匹配口径:关键字**子串**匹配(大小写不敏感,刻意不支持正则以规避 ReDoS);
 * action:log 仅记录 / warn 告警不阻断 / block 直接拒绝本次调用。
 */
import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Plus, ScanSearch, Trash2 } from 'lucide-react'

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import { BackButton, TruncatedText } from '@/components/common'
import { useConfirm } from '@/hooks/use-confirm'

interface AuditRule {
  id: string
  name: string
  keyword: string
  action: string
  severity: number
  enabled: boolean
  remark: string | null
}

interface AuditHit {
  id: string
  ruleName: string | null
  userId: string | null
  apiKeyId: string | null
  model: string | null
  keyword: string | null
  actionTaken: string
  snippet: string | null
  createdAt: string
}

interface HitGroup {
  ruleId: string | null
  ruleName: string | null
  count: number
}

const ACTION_LABEL: Record<string, string> = {
  log: '仅记录',
  warn: '告警',
  block: '拦截',
}

const emptyForm = {
  name: '',
  keyword: '',
  action: 'log',
  severity: '3',
  enabled: true,
  remark: '',
}

export default function PromptAuditPage() {
  const { confirm, ConfirmDialogRenderer } = useConfirm()
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<AuditRule | null>(null)
  const [form, setForm] = React.useState(emptyForm)

  const rulesQ = useQuery({
    queryKey: ['admin', 'relay', 'prompt-audit', 'rules'],
    queryFn: async () => {
      const r = await fetchApi<{ list: AuditRule[]; total: number }>(
        '/api/admin/relay/prompt-audit/rules',
      )
      if (!r.success) throw new Error(r.error)
      return r.data.list
    },
  })
  const hitsQ = useQuery({
    queryKey: ['admin', 'relay', 'prompt-audit', 'hits'],
    queryFn: async () => {
      const r = await fetchApi<{ hits: AuditHit[]; total: number }>(
        '/api/admin/relay/prompt-audit/hits?limit=50',
      )
      if (!r.success) throw new Error(r.error)
      return r.data.hits
    },
  })
  const statsQ = useQuery({
    queryKey: ['admin', 'relay', 'prompt-audit', 'stats'],
    queryFn: async () => {
      const r = await fetchApi<{ groups: HitGroup[] }>('/api/admin/relay/prompt-audit/stats')
      if (!r.success) throw new Error(r.error)
      return r.data.groups
    },
  })

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'relay', 'prompt-audit'] })
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      const severity = Number(form.severity)
      if (!Number.isInteger(severity) || severity < 1 || severity > 5) {
        throw new Error('严重度需为 1-5 的整数')
      }
      const body = {
        name: form.name.trim(),
        keyword: form.keyword.trim(),
        action: form.action,
        severity,
        enabled: form.enabled,
        remark: form.remark.trim() || null,
      }
      if (!body.name) throw new Error('规则名不能为空')
      if (!body.keyword) throw new Error('关键字不能为空')
      const r = editing
        ? await fetchApi(`/api/admin/relay/prompt-audit/rules/${editing.id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
          })
        : await fetchApi('/api/admin/relay/prompt-audit/rules', {
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
      const r = await fetchApi(`/api/admin/relay/prompt-audit/rules/${id}`, { method: 'DELETE' })
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
      const r = await fetchApi(`/api/admin/relay/prompt-audit/rules/${p.id}`, {
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
  const openEdit = (rule: AuditRule) => {
    setEditing(rule)
    setForm({
      name: rule.name,
      keyword: rule.keyword,
      action: rule.action,
      severity: String(rule.severity),
      enabled: rule.enabled,
      remark: rule.remark ?? '',
    })
    setDialogOpen(true)
  }

  const busy = saveMut.isPending || deleteMut.isPending || toggleMut.isPending
  const groups = statsQ.data ?? []
  const totalHits = groups.reduce((sum, g) => sum + g.count, 0)

  return (
    <div className="space-y-4 px-4 py-4">
      <BackButton />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <ScanSearch className="h-5 w-5" aria-hidden />
            提示词审计
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            对入站提示词做关键字风险检测(涉敏内容、注入特征),命中后按动作记录 / 告警 / 拦截。
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" aria-hidden />
          <span>新建规则</span>
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span>
          规则{' '}
          <span className="font-medium tabular-nums text-foreground">
            {rulesQ.data?.length ?? 0}
          </span>{' '}
          条
        </span>
        <span>
          累计命中 <span className="font-medium tabular-nums text-foreground">{totalHits}</span> 次
        </span>
      </div>

      {groups.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
          <span className="text-xs text-muted-foreground">命中排行:</span>
          {groups
            .slice()
            .sort((a, b) => b.count - a.count)
            .slice(0, 10)
            .map((g, i) => (
              <Badge key={`${g.ruleId ?? 'deleted'}-${i}`} variant="outline">
                {g.ruleName ?? '已删除规则'} · {g.count}
              </Badge>
            ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs" style={{ tableLayout: 'fixed' }}>
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">规则名</th>
              <th className="px-3 py-2 font-medium">关键字</th>
              <th className="px-3 py-2 font-medium">动作</th>
              <th className="px-3 py-2 font-medium">严重度</th>
              <th className="px-3 py-2 font-medium">启用</th>
              <th className="px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {(rulesQ.data ?? []).length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  {rulesQ.isLoading ? '加载中...' : '暂无审计规则,未配置时不产生任何拦截'}
                </td>
              </tr>
            ) : (
              (rulesQ.data ?? []).map((rule) => (
                <tr key={rule.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <TruncatedText value={rule.name} />
                  </td>
                  <td className="px-3 py-2 font-mono">
                    <TruncatedText value={rule.keyword} />
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={rule.action === 'block' ? 'destructive' : 'outline'}>
                      {ACTION_LABEL[rule.action] ?? rule.action}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{rule.severity}</td>
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
                            description: `确认删除「${rule.name}」?历史命中记录会级联删除。`,
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

      <h2 className="pt-2 text-base font-medium">最近命中记录(最近 50 条)</h2>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs" style={{ tableLayout: 'fixed' }}>
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">规则</th>
              <th className="px-3 py-2 font-medium">关键字</th>
              <th className="px-3 py-2 font-medium">动作</th>
              <th className="px-3 py-2 font-medium">用户/SDK Key</th>
              <th className="px-3 py-2 font-medium">模型</th>
              <th className="px-3 py-2 font-medium">片段</th>
              <th className="px-3 py-2 font-medium">时间</th>
            </tr>
          </thead>
          <tbody>
            {(hitsQ.data ?? []).length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  {hitsQ.isLoading ? '加载中...' : '暂无命中记录'}
                </td>
              </tr>
            ) : (
              (hitsQ.data ?? []).map((hit) => (
                <tr key={hit.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{hit.ruleName ?? '已删除规则'}</td>
                  <td className="px-3 py-2 font-mono">{hit.keyword ?? '—'}</td>
                  <td className="px-3 py-2">
                    <Badge variant={hit.actionTaken === 'block' ? 'destructive' : 'outline'}>
                      {ACTION_LABEL[hit.actionTaken] ?? hit.actionTaken}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">
                    {hit.userId ?? hit.apiKeyId ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{hit.model ?? '—'}</td>
                  <td className="px-3 py-2">
                    {hit.snippet ? <TruncatedText value={hit.snippet} /> : '—'}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {new Date(hit.createdAt).toLocaleString('zh-CN')}
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
            <DialogTitle>{editing ? '编辑审计规则' : '新建审计规则'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="audit-name">规则名</Label>
              <Input
                id="audit-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="如:疑似提示词注入"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="audit-keyword">关键字(子串匹配,大小写不敏感)</Label>
              <Input
                id="audit-keyword"
                value={form.keyword}
                onChange={(e) => setForm((f) => ({ ...f, keyword: e.target.value }))}
                placeholder="如 ignore previous instructions"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>命中动作</Label>
                <Select
                  value={form.action}
                  onValueChange={(v) => setForm((f) => ({ ...f, action: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="log">仅记录</SelectItem>
                    <SelectItem value="warn">告警(不阻断)</SelectItem>
                    <SelectItem value="block">拦截本次调用</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="audit-severity">严重度(1-5)</Label>
                <Input
                  id="audit-severity"
                  inputMode="numeric"
                  value={form.severity}
                  onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="audit-remark">备注(可选)</Label>
              <Input
                id="audit-remark"
                value={form.remark}
                onChange={(e) => setForm((f) => ({ ...f, remark: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="audit-enabled">启用</Label>
              <Switch
                id="audit-enabled"
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
