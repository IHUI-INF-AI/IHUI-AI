'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Trash2, Save, Calculator, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Badge,
} from '@ihui/ui-react'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * 前端 UI 层 tier(带 id 用于 React key),保存时剥离 id 字段以对齐后端 TopupTier schema。
 * 后端契约(topup-discount-service.ts):{ minAmount, multiplier, bonus }
 *   - minAmount:命中该档的最低充值额(含)
 *   - multiplier:倍率(1.2 = 充 100 到账 120)
 *   - bonus:额外赠送额度
 */
interface TierRule {
  id: string
  minAmount: number
  multiplier: number
  bonus: number
}

/** 后端 TopupConfig 契约:{ tiers, customAmounts, minTopupByMethod } */
interface TopupConfig {
  tiers: { minAmount: number; multiplier: number; bonus: number }[]
  customAmounts: number[]
  minTopupByMethod: Record<string, number>
}

/** 后端 TopupBonusResult 契约:{ multiplier, bonus, actualCredit } */
interface PreviewResult {
  multiplier: number
  bonus: number
  actualCredit: number
}

const uid = (): string => crypto.randomUUID()

/** 将字符串解析为有限非负数;非法返回 null。 */
const parseNum = (value: string): number | null => {
  if (value === '') return null
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : null
}

export default function AdminTopupConfigPage() {
  const qc = useQueryClient()
  const [tiers, setTiers] = React.useState<TierRule[]>([])
  const [options, setOptions] = React.useState<number[]>([])
  const [minTopupByMethod, setMinTopupByMethod] = React.useState<Record<string, number>>({})
  const [newOption, setNewOption] = React.useState('')
  const [newMethodKey, setNewMethodKey] = React.useState('')
  const [newMethodValue, setNewMethodValue] = React.useState('')
  const [previewAmount, setPreviewAmount] = React.useState('')
  const [previewMethod, setPreviewMethod] = React.useState('alipay')
  const [previewResult, setPreviewResult] = React.useState<PreviewResult | null>(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'topup', 'config'],
    queryFn: async () => {
      const r = await fetchApi<TopupConfig>('/api/admin/topup/config')
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })

  React.useEffect(() => {
    if (data) {
      // 后端 tier 无 id 字段,前端补充 id 用于 React key
      setTiers((data.tiers ?? []).map((t) => ({ ...t, id: uid() })))
      setOptions(data.customAmounts ?? [])
      setMinTopupByMethod(data.minTopupByMethod ?? {})
    }
  }, [data])

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'topup', 'config'] })

  const saveMut = useMutation({
    mutationFn: async () => {
      // 保存时剥离前端 id 字段,只发送后端契约字段
      const payload = {
        tiers: tiers.map(({ minAmount, multiplier, bonus }) => ({ minAmount, multiplier, bonus })),
        customAmounts: options,
        minTopupByMethod,
      }
      const r = await fetchApi<TopupConfig>('/api/admin/topup/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: () => {
      toast.success('配置已保存')
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const previewMut = useMutation({
    mutationFn: async (params: { amount: number; method: string }) => {
      const r = await fetchApi<PreviewResult>('/api/admin/topup/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: setPreviewResult,
    onError: (e: Error) => toast.error(e.message),
  })

  const addTier = () =>
    setTiers((t) => [...t, { id: uid(), minAmount: 0, multiplier: 1, bonus: 0 }])
  const updateTier = (id: string, patch: Partial<TierRule>) =>
    setTiers((t) => t.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  const removeTier = (id: string) => setTiers((t) => t.filter((x) => x.id !== id))

  const addOption = () => {
    const n = parseNum(newOption)
    if (n === null || n <= 0 || options.includes(n)) return
    setOptions((o) => [...o, n].sort((a, b) => a - b))
    setNewOption('')
  }
  const removeOption = (n: number) => setOptions((o) => o.filter((x) => x !== n))

  const addMethod = () => {
    const key = newMethodKey.trim()
    const val = parseNum(newMethodValue)
    if (!key || val === null || val < 0 || key in minTopupByMethod) return
    setMinTopupByMethod((m) => ({ ...m, [key]: val }))
    setNewMethodKey('')
    setNewMethodValue('')
  }
  const updateMethodValue = (key: string, value: string) => {
    const val = parseNum(value)
    if (val === null) return
    setMinTopupByMethod((m) => ({ ...m, [key]: val }))
  }
  const removeMethod = (key: string) =>
    setMinTopupByMethod((m) => {
      const next = { ...m }
      delete next[key]
      return next
    })

  const runPreview = () => {
    const n = parseNum(previewAmount)
    if (n === null || n <= 0) return
    previewMut.mutate({ amount: n, method: previewMethod })
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">充值阶梯折扣配置</h1>
            <p className="text-sm text-muted-foreground">管理阶梯折扣规则与自定义充值选项</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-3 w-3" /> 重试
          </Button>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <div className="text-sm text-muted-foreground">
              {(error as Error).message || '加载充值配置失败'}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">充值阶梯折扣配置</h1>
          <p className="text-sm text-muted-foreground">管理阶梯折扣规则与自定义充值选项</p>
        </div>
        <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
          {saveMut.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          保存配置
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">阶梯折扣规则</CardTitle>
              <CardDescription>充值满额自动赠送,按 minAmount 降序匹配命中第一档</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={addTier}>
              <Plus className="h-3 w-3" /> 添加规则
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>满额(元)</TableHead>
                  <TableHead>倍率</TableHead>
                  <TableHead>额外赠送</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tiers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      暂无规则,点击「添加规则」创建
                    </TableCell>
                  </TableRow>
                ) : (
                  tiers
                    .slice()
                    .sort((a, b) => a.minAmount - b.minAmount)
                    .map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            value={t.minAmount}
                            onChange={(e) =>
                              updateTier(t.id, { minAmount: parseNum(e.target.value) ?? 0 })
                            }
                            className="h-8 w-32"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            step={0.1}
                            value={t.multiplier}
                            onChange={(e) =>
                              updateTier(t.id, { multiplier: parseNum(e.target.value) ?? 1 })
                            }
                            className="h-8 w-32"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            value={t.bonus}
                            onChange={(e) =>
                              updateTier(t.id, { bonus: parseNum(e.target.value) ?? 0 })
                            }
                            className="h-8 w-32"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => removeTier(t.id)}
                            aria-label="删除规则"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">自定义充值选项</CardTitle>
          <CardDescription>用户充值页面展示的快捷金额选项</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {options.length === 0 ? (
              <span className="text-sm text-muted-foreground">暂无选项</span>
            ) : (
              options.map((n) => (
                <Badge key={n} variant="secondary" className="gap-1">
                  <span className="tabular-nums">¥{n}</span>
                  <button
                    onClick={() => removeOption(n)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={'移除 ' + n + ' 元选项'}
                  >
                    ×
                  </button>
                </Badge>
              ))
            )}
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addOption()}
              placeholder="输入金额,如 200"
              className="h-8 w-40"
            />
            <Button size="sm" variant="outline" onClick={addOption}>
              <Plus className="h-3 w-3" /> 添加
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">各支付方式最低充值额</CardTitle>
          <CardDescription>未配置的支付方式会被拒绝(防止绕过最低额限制)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            {Object.keys(minTopupByMethod).length === 0 ? (
              <span className="text-sm text-muted-foreground">暂无支付方式配置</span>
            ) : (
              Object.entries(minTopupByMethod).map(([key, val]) => (
                <div key={key} className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono">{key}</Badge>
                  <Input
                    type="number"
                    min={0}
                    value={val}
                    onChange={(e) => updateMethodValue(key, e.target.value)}
                    className="h-8 w-32"
                  />
                  <span className="text-xs text-muted-foreground">元</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => removeMethod(key)}
                    aria-label={'移除 ' + key}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))
            )}
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="text"
              value={newMethodKey}
              onChange={(e) => setNewMethodKey(e.target.value)}
              placeholder="支付方式 key,如 alipay"
              className="h-8 w-40"
            />
            <Input
              type="number"
              min={0}
              value={newMethodValue}
              onChange={(e) => setNewMethodValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addMethod()}
              placeholder="最低金额"
              className="h-8 w-32"
            />
            <Button size="sm" variant="outline" onClick={addMethod}>
              <Plus className="h-3 w-3" /> 添加
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">到账预览</CardTitle>
          <CardDescription>输入金额与支付方式,实时预览折扣后实际到账</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="number"
              min={0}
              value={previewAmount}
              onChange={(e) => setPreviewAmount(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runPreview()}
              placeholder="输入充值金额"
              className="h-8 w-40"
            />
            <select
              value={previewMethod}
              onChange={(e) => setPreviewMethod(e.target.value)}
              className="h-8 rounded-md border border-border bg-background px-2 text-sm"
            >
              {Object.keys(minTopupByMethod).length === 0 ? (
                <option value="alipay">alipay</option>
              ) : (
                Object.keys(minTopupByMethod).map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))
              )}
            </select>
            <Button size="sm" onClick={runPreview} disabled={previewMut.isPending}>
              {previewMut.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Calculator className="h-3 w-3" />
              )}
              预览
            </Button>
          </div>
          {previewResult && (
            <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-3">
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <div className="text-xs text-muted-foreground">命中倍率</div>
                <div className="text-lg font-semibold tabular-nums">
                  ×{previewResult.multiplier}
                </div>
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <div className="text-xs text-muted-foreground">额外赠送</div>
                <div className="text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                  +{previewResult.bonus}
                </div>
              </div>
              <div className="rounded-md border border-border bg-primary/5 p-3">
                <div className="text-xs text-muted-foreground">实际到账</div>
                <div className="text-lg font-semibold tabular-nums text-primary">
                  {previewResult.actualCredit}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
