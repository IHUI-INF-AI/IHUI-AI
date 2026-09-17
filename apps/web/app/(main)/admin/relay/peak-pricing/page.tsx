// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 分时高峰倍率管理页(2026-09-17 立,PROJECT_PLAN 4-1 条目 7 缺失的管理端补齐)。
 *
 * 背景:4-1 交付时声明「管理端新增分时倍率 CRUD + 命中预览(/api/admin/relay/peak-pricing)」,
 * 但后端 5 端点落地后前端零消费(全仓无任何页面/api-client 引用),运营无法自助配置。
 * 本页补齐:规则列表(启停/编辑/删除)+ 新建/编辑 Dialog + 命中预览(排障:某模型某时刻实际生效倍率)。
 *
 * 数据源 /api/admin/relay/peak-pricing/rules(CRUD)+ /preview(只读解析)。
 * 时段一律按 UTC+8 判定(后端口径);前端仅做 HH:MM ↔ 分钟互转,不重复判定时区。
 */
import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Clock, Loader2, Plus, Search, Trash2 } from 'lucide-react'

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
  Switch,
} from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import { BackButton, TruncatedText } from '@/components/common'
import { useConfirm } from '@/hooks/use-confirm'

interface PeakRule {
  id: string
  name: string
  modelId: string | null
  providerCode: string | null
  daysOfWeek: number[]
  startMinute: number
  endMinute: number
  multiplier: number
  priority: number
  enabled: boolean
  remark: string | null
}

interface PreviewResult {
  modelId: string
  at: string
  multiplier: number
  ruleId: string | null
  ruleName: string | null
}

/** 星期选项:后端/JS 口径 0=周日,1=周一 … 6=周六 */
const DAY_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 0, label: '周日' },
]

/** 分钟 → HH:MM(跨日 endMinute=1440 显示为 24:00) */
function formatHHMM(minutes: number): string {
  const m = Math.max(0, Math.min(1440, Math.round(minutes)))
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

/** HH:MM → 分钟;非法返回 null(调用方按非法处理,避免静默落 0 点) */
function parseHHMM(value: string): number | null {
  const matched = /^(\d{1,2}):(\d{1,2})$/.exec(value.trim())
  if (!matched) return null
  const h = Number(matched[1])
  const m = Number(matched[2])
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  if (h < 0 || h > 24 || m < 0 || m > 59) return null
  const total = h * 60 + m
  if (total > 1440) return null
  return total
}

/** 星期集合展示:空数组 = 每天 */
function formatDays(days: number[]): string {
  if (!Array.isArray(days) || days.length === 0 || days.length === 7) return '每天'
  const labels = DAY_OPTIONS.filter((d) => days.includes(d.value)).map((d) => d.label)
  return labels.length > 0 ? labels.join('/') : '每天'
}

const emptyForm = {
  name: '',
  modelId: '',
  providerCode: '',
  days: [] as number[],
  startText: '09:00',
  endText: '18:00',
  multiplier: '1.5',
  priority: 0,
  enabled: true,
  remark: '',
}

export default function PeakPricingPage() {
  const { confirm, ConfirmDialogRenderer } = useConfirm()
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<PeakRule | null>(null)
  const [form, setForm] = React.useState(emptyForm)
  const [previewModel, setPreviewModel] = React.useState('')
  const [previewAt, setPreviewAt] = React.useState('')
  const [previewResult, setPreviewResult] = React.useState<PreviewResult | null>(null)

  const rulesQ = useQuery({
    queryKey: ['admin', 'relay', 'peak-pricing'],
    queryFn: async () => {
      const r = await fetchApi<{ list: PeakRule[]; total: number }>(
        '/api/admin/relay/peak-pricing/rules',
      )
      if (!r.success) throw new Error(r.error)
      return r.data.list
    },
  })

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'relay', 'peak-pricing'] })
  }

  const buildBody = () => {
    const start = parseHHMM(form.startText)
    const end = parseHHMM(form.endText)
    if (start === null) throw new Error('开始时间格式应为 HH:MM(例 09:00)')
    if (end === null) throw new Error('结束时间格式应为 HH:MM(例 18:00,跨日可填 24:00)')
    if (end <= start) throw new Error('结束时间必须晚于开始时间')
    const multiplier = Number(form.multiplier)
    if (!Number.isFinite(multiplier) || multiplier < 0 || multiplier > 100) {
      throw new Error('倍率需为 0-100 之间的数字')
    }
    return {
      name: form.name.trim(),
      modelId: form.modelId.trim() || null,
      providerCode: form.providerCode.trim() || null,
      daysOfWeek: form.days,
      startMinute: start,
      endMinute: end,
      multiplier,
      priority: Number(form.priority) || 0,
      enabled: form.enabled,
      remark: form.remark.trim() || null,
    }
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      const body = buildBody()
      const r = editing
        ? await fetchApi(`/api/admin/relay/peak-pricing/rules/${editing.id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
          })
        : await fetchApi('/api/admin/relay/peak-pricing/rules', {
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
      const r = await fetchApi(`/api/admin/relay/peak-pricing/rules/${id}`, { method: 'DELETE' })
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
      const r = await fetchApi(`/api/admin/relay/peak-pricing/rules/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: p.enabled }),
      })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  })

  const previewMut = useMutation({
    mutationFn: async () => {
      const modelId = previewModel.trim()
      if (!modelId) throw new Error('请先填写要预览的模型')
      const qs = new URLSearchParams({ modelId })
      if (previewAt) {
        const at = new Date(previewAt)
        if (Number.isNaN(at.getTime())) throw new Error('时间格式不合法')
        qs.set('at', at.toISOString())
      }
      const r = await fetchApi<PreviewResult>(
        `/api/admin/relay/peak-pricing/preview?${qs.toString()}`,
      )
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: (d) => setPreviewResult(d),
    onError: (e: Error) => toast.error(e.message),
  })

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }
  const openEdit = (rule: PeakRule) => {
    setEditing(rule)
    setForm({
      name: rule.name,
      modelId: rule.modelId ?? '',
      providerCode: rule.providerCode ?? '',
      days: Array.isArray(rule.daysOfWeek) ? rule.daysOfWeek : [],
      startText: formatHHMM(rule.startMinute),
      endText: formatHHMM(rule.endMinute),
      multiplier: String(rule.multiplier),
      priority: rule.priority,
      enabled: rule.enabled,
      remark: rule.remark ?? '',
    })
    setDialogOpen(true)
  }

  const busy = saveMut.isPending || deleteMut.isPending || toggleMut.isPending

  return (
    <div className="space-y-4 px-4 py-4">
      <BackButton />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Clock className="h-5 w-5" aria-hidden />
            分时高峰倍率
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            按 UTC+8 时段对模型倍率上浮(高峰加价 /
            低谷折扣)。倍率链末环,命中即用不叠加;优先级高者先命中。
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" aria-hidden />
          <span>新建规则</span>
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs" style={{ tableLayout: 'fixed' }}>
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">规则名</th>
              <th className="px-3 py-2 font-medium">适用范围</th>
              <th className="px-3 py-2 font-medium">生效日</th>
              <th className="px-3 py-2 font-medium">时段</th>
              <th className="px-3 py-2 font-medium">倍率</th>
              <th className="px-3 py-2 font-medium">优先级</th>
              <th className="px-3 py-2 font-medium">启用</th>
              <th className="px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {(rulesQ.data ?? []).length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  {rulesQ.isLoading
                    ? '加载中...'
                    : '暂无分时规则,未配置时全部时段按基准价 1.0 计费(存量账单不变)'}
                </td>
              </tr>
            ) : (
              (rulesQ.data ?? []).map((rule) => (
                <tr key={rule.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <TruncatedText value={rule.name} />
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {rule.modelId ? (
                      <TruncatedText value={rule.modelId} />
                    ) : rule.providerCode ? (
                      `渠道 ${rule.providerCode}`
                    ) : (
                      '全局'
                    )}
                  </td>
                  <td className="px-3 py-2">{formatDays(rule.daysOfWeek)}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {formatHHMM(rule.startMinute)} - {formatHHMM(rule.endMinute)}
                  </td>
                  <td className="px-3 py-2 tabular-nums font-medium">×{rule.multiplier}</td>
                  <td className="px-3 py-2 tabular-nums">{rule.priority}</td>
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
                            description: `确认删除「${rule.name}」?删除后该时段立即恢复基准价。`,
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

      <div className="rounded-lg border p-3">
        <h2 className="text-sm font-medium">命中预览</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          排障用:确认某模型在指定时刻实际生效的倍率与命中规则(留空时间 = 当前时刻)。
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1 space-y-1.5">
            <Label htmlFor="peak-preview-model">模型 id</Label>
            <Input
              id="peak-preview-model"
              value={previewModel}
              onChange={(e) => setPreviewModel(e.target.value)}
              placeholder="如 step-3.7-flash"
            />
          </div>
          <div className="min-w-[200px] flex-1 space-y-1.5">
            <Label htmlFor="peak-preview-at">指定时刻(可选)</Label>
            <Input
              id="peak-preview-at"
              type="datetime-local"
              value={previewAt}
              onChange={(e) => setPreviewAt(e.target.value)}
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => previewMut.mutate()}
            disabled={previewMut.isPending}
          >
            {previewMut.isPending ? (
              <LoaderIcon className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Search className="h-4 w-4" aria-hidden />
            )}
            <span>预览</span>
          </Button>
        </div>
        {previewResult && (
          <p className="mt-3 text-xs">
            模型 <span className="font-medium">{previewResult.modelId}</span> 在{' '}
            {new Date(previewResult.at).toLocaleString('zh-CN')} 生效倍率{' '}
            <span className="font-medium tabular-nums">×{previewResult.multiplier}</span>
            {previewResult.ruleName
              ? `(命中规则「${previewResult.ruleName}」)`
              : '(未命中任何规则,按基准价 1.0)'}
          </p>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? '编辑分时规则' : '新建分时规则'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="peak-name">规则名</Label>
              <Input
                id="peak-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="如:工作日白天高峰"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="peak-model">模型 id(留空 = 全部模型)</Label>
                <Input
                  id="peak-model"
                  value={form.modelId}
                  onChange={(e) => setForm((f) => ({ ...f, modelId: e.target.value }))}
                  placeholder="留空不限"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="peak-provider">渠道(留空 = 不限)</Label>
                <Input
                  id="peak-provider"
                  value={form.providerCode}
                  onChange={(e) => setForm((f) => ({ ...f, providerCode: e.target.value }))}
                  placeholder="如 swiftapi"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>生效日(全不选 = 每天)</Label>
              <div className="flex flex-wrap gap-1.5">
                {DAY_OPTIONS.map((d) => {
                  const active = form.days.includes(d.value)
                  return (
                    <Button
                      key={d.value}
                      size="xs"
                      variant={active ? 'default' : 'outline'}
                      aria-pressed={active}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          days: active ? f.days.filter((x) => x !== d.value) : [...f.days, d.value],
                        }))
                      }
                    >
                      <span>{d.label}</span>
                    </Button>
                  )
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="peak-start">开始(HH:MM)</Label>
                <Input
                  id="peak-start"
                  value={form.startText}
                  onChange={(e) => setForm((f) => ({ ...f, startText: e.target.value }))}
                  placeholder="09:00"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="peak-end">结束(HH:MM)</Label>
                <Input
                  id="peak-end"
                  value={form.endText}
                  onChange={(e) => setForm((f) => ({ ...f, endText: e.target.value }))}
                  placeholder="18:00"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="peak-multiplier">倍率(1 = 不加价)</Label>
                <Input
                  id="peak-multiplier"
                  inputMode="decimal"
                  value={form.multiplier}
                  onChange={(e) => setForm((f) => ({ ...f, multiplier: e.target.value }))}
                  placeholder="1.5"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="peak-priority">优先级(大者先命中)</Label>
                <Input
                  id="peak-priority"
                  inputMode="numeric"
                  value={String(form.priority)}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, priority: Number(e.target.value) || 0 }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="peak-remark">备注(可选)</Label>
              <Input
                id="peak-remark"
                value={form.remark}
                onChange={(e) => setForm((f) => ({ ...f, remark: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="peak-enabled">启用</Label>
              <Switch
                id="peak-enabled"
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
