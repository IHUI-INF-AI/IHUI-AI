// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Coins, Loader2, Pencil, Plus, Search } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Button,
  Card,
  CardContent,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ihui/ui-react'

type BillingMode = 'token' | 'per_call' | 'per_image' | 'per_video'

interface TieredCallPrices {
  le256k: number
  mid: number
  gt512k: number
}

interface PricingRow {
  id: string
  modelId: string
  inputTokenPrice: number
  outputTokenPrice: number
  billingMode: BillingMode | null
  perUnitPrice: number | null
  tieredCallPrices: TieredCallPrices | null
  videoUnit: 'call' | 'second' | null
  currency: string
  effectiveAt: string | null
}

interface PricingListResponse {
  items: PricingRow[]
  total: number
  page?: number
  pageSize?: number
}

const PAGE_SIZE = 20

const MODE_LABEL: Record<BillingMode, string> = {
  token: '按 token',
  per_call: '按次(分档)',
  per_image: '按张',
  per_video: '按视频',
}

/** 价格摘要(与公开定价页同口径:token=元/百万 token,其余=元/次|张|秒) */
function priceSummary(row: PricingRow): string {
  const mode = row.billingMode ?? 'token'
  const yuan = (cents: number) => (cents / 100).toLocaleString('zh-CN', { maximumFractionDigits: 4 })
  if (mode === 'token') {
    return `入 ${(row.inputTokenPrice * 10).toLocaleString('zh-CN', { maximumFractionDigits: 4 })} / 出 ${(row.outputTokenPrice * 10).toLocaleString('zh-CN', { maximumFractionDigits: 4 })} 元/百万token`
  }
  if (mode === 'per_call') {
    const t = row.tieredCallPrices
    if (!t) return '—'
    return `≤256K ${yuan(t.le256k)} / 256K–512K ${yuan(t.mid)} / >512K ${yuan(t.gt512k)} 元/次`
  }
  if (mode === 'per_image') return row.perUnitPrice !== null && row.perUnitPrice !== undefined ? `${yuan(row.perUnitPrice)} 元/张` : '—'
  return row.perUnitPrice !== null && row.perUnitPrice !== undefined ? `${yuan(row.perUnitPrice)} 元/${row.videoUnit === 'second' ? '秒' : '次'}` : '—'
}

interface FormState {
  modelId: string
  billingMode: BillingMode
  inputTokenPrice: string
  outputTokenPrice: string
  le256k: string
  mid: string
  gt512k: string
  perUnitPrice: string
  videoUnit: 'call' | 'second'
  currency: string
}

const EMPTY_FORM: FormState = {
  modelId: '',
  billingMode: 'token',
  inputTokenPrice: '0',
  outputTokenPrice: '0',
  le256k: '',
  mid: '',
  gt512k: '',
  perUnitPrice: '',
  videoUnit: 'call',
  currency: 'CNY',
}

function toForm(row: PricingRow): FormState {
  return {
    modelId: row.modelId,
    billingMode: row.billingMode ?? 'token',
    inputTokenPrice: String(row.inputTokenPrice ?? 0),
    outputTokenPrice: String(row.outputTokenPrice ?? 0),
    le256k: row.tieredCallPrices ? String(row.tieredCallPrices.le256k) : '',
    mid: row.tieredCallPrices ? String(row.tieredCallPrices.mid) : '',
    gt512k: row.tieredCallPrices ? String(row.tieredCallPrices.gt512k) : '',
    perUnitPrice: row.perUnitPrice !== null && row.perUnitPrice !== undefined ? String(row.perUnitPrice) : '',
    videoUnit: row.videoUnit ?? 'call',
    currency: row.currency ?? 'CNY',
  }
}

function num(form: FormState, key: keyof FormState): number | undefined {
  const raw = String(form[key] ?? '').trim()
  if (raw === '') return undefined
  const v = Number(raw)
  return Number.isFinite(v) ? v : undefined
}

export default function AdminAiPricingPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [isNew, setIsNew] = React.useState(false)
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = React.useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-ai-pricing', search, page],
    queryFn: async () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (search.trim()) qs.set('search', search.trim())
      const res = await fetchApi<PricingListResponse>(`/api/ai-pricing?${qs.toString()}`)
      if (!res.success || !res.data) throw new Error(res.error ?? '加载定价失败')
      return res.data
    },
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        modelId: form.modelId.trim(),
        billingMode: form.billingMode,
        currency: form.currency,
      }
      if (form.billingMode === 'token') {
        body.inputTokenPrice = num(form, 'inputTokenPrice') ?? 0
        body.outputTokenPrice = num(form, 'outputTokenPrice') ?? 0
      } else if (form.billingMode === 'per_call') {
        const le256k = num(form, 'le256k')
        const mid = num(form, 'mid')
        const gt512k = num(form, 'gt512k')
        if (le256k === undefined || mid === undefined || gt512k === undefined || le256k <= 0 || mid <= 0 || gt512k <= 0) {
          throw new Error('按次模式必须填写完整三档价且均大于 0')
        }
        body.tieredCallPrices = { le256k, mid, gt512k }
      } else {
        const per = num(form, 'perUnitPrice')
        if (per === undefined || per <= 0) throw new Error('单价必须大于 0')
        body.perUnitPrice = per
        if (form.billingMode === 'per_video') body.videoUnit = form.videoUnit
      }
      const res = await fetchApi<{ id: string }>('/api/admin/ai-pricing/upsert', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (!res.success) throw new Error(res.error ?? '保存失败')
      return res.data
    },
    onSuccess: () => {
      setDialogOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['admin-ai-pricing'] })
    },
    onError: (e) => setFormError((e as Error).message),
  })

  const openEdit = (row: PricingRow | null) => {
    setIsNew(!row)
    setForm(row ? toForm(row) : EMPTY_FORM)
    setFormError('')
    setDialogOpen(true)
  }

  const setField = (key: keyof FormState, value: string) =>
    setForm((f) => ({ ...f, [key]: value }))

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE))

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> 返回管理后台
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Coins className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">模型定价管理</h1>
        <span className="text-xs text-muted-foreground">
          token=分/千token · 按次/按张/按视频=分(入库单位),展示按 元/百万token · 元/次|张|秒
        </span>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="搜索模型 ID"
              className="w-56 pl-8"
            />
          </div>
          <Button onClick={() => openEdit(null)}>
            <Plus className="mr-1 h-4 w-4" /> 新增定价
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>模型 ID</TableHead>
                <TableHead>计费方式</TableHead>
                <TableHead>价格摘要</TableHead>
                <TableHead>货币</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> 加载中...
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-destructive">
                    {(error as Error).message}
                  </TableCell>
                </TableRow>
              ) : (data?.items ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    暂无定价数据
                  </TableCell>
                </TableRow>
              ) : (
                (data?.items ?? []).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="max-w-[220px] truncate font-mono text-xs" title={row.modelId}>
                      {row.modelId}
                    </TableCell>
                    <TableCell>
                      <span className="inline-block rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        {MODE_LABEL[row.billingMode ?? 'token']}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">{priceSummary(row)}</TableCell>
                    <TableCell className="text-muted-foreground">{row.currency}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
                        <Pencil className="mr-1 h-3.5 w-3.5" /> 编辑
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            上一页
          </Button>
          <span className="text-muted-foreground">
            第 {page} / {totalPages} 页 · 共 {data.total} 条
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </Button>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isNew ? '新增模型定价' : `编辑定价 — ${form.modelId}`}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>模型 ID</Label>
              <Input
                value={form.modelId}
                disabled={!isNew}
                onChange={(e) => setField('modelId', e.target.value)}
                placeholder="如 gpt-image-2"
              />
              {!isNew && (
                <p className="text-xs text-muted-foreground">模型 ID 为定价主键,编辑时不可修改</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>计费方式</Label>
              <Select value={form.billingMode} onValueChange={(v) => setField('billingMode', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MODE_LABEL).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.billingMode === 'token' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>输入单价(分/千token)</Label>
                  <Input
                    value={form.inputTokenPrice}
                    onChange={(e) => setField('inputTokenPrice', e.target.value)}
                    inputMode="decimal"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>输出单价(分/千token)</Label>
                  <Input
                    value={form.outputTokenPrice}
                    onChange={(e) => setField('outputTokenPrice', e.target.value)}
                    inputMode="decimal"
                  />
                </div>
              </div>
            )}

            {form.billingMode === 'per_call' && (
              <div className="space-y-1.5">
                <Label>按次三档价(分/次,按上下文长度分档,均须大于 0)</Label>
                <div className="grid grid-cols-3 gap-3">
                  <Input
                    value={form.le256k}
                    onChange={(e) => setField('le256k', e.target.value)}
                    placeholder="≤256K"
                    inputMode="decimal"
                  />
                  <Input
                    value={form.mid}
                    onChange={(e) => setField('mid', e.target.value)}
                    placeholder="256K–512K"
                    inputMode="decimal"
                  />
                  <Input
                    value={form.gt512k}
                    onChange={(e) => setField('gt512k', e.target.value)}
                    placeholder="&gt;512K"
                    inputMode="decimal"
                  />
                </div>
              </div>
            )}

            {(form.billingMode === 'per_image' || form.billingMode === 'per_video') && (
              <div className="space-y-1.5">
                <Label>单价(分/{form.billingMode === 'per_image' ? '张' : '次或秒'})</Label>
                <Input
                  value={form.perUnitPrice}
                  onChange={(e) => setField('perUnitPrice', e.target.value)}
                  inputMode="decimal"
                />
              </div>
            )}

            {form.billingMode === 'per_video' && (
              <div className="space-y-1.5">
                <Label>计费单位</Label>
                <Select value={form.videoUnit} onValueChange={(v) => setField('videoUnit', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="call">按次</SelectItem>
                    <SelectItem value="second">按秒</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>货币</Label>
              <Select value={form.currency} onValueChange={(v) => setField('currency', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CNY">CNY(人民币)</SelectItem>
                  <SelectItem value="USD">USD(美元)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(formError || saveMutation.isError) && (
              <p className="text-sm text-destructive">{formError || (saveMutation.error as Error)?.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.modelId.trim()}>
              {saveMutation.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
