// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 定价管控台(2026-11-13 立)。运营内部页面,只给管理员用,因此文案走中文常量(不占多语言包)。
// 后端:/api/admin/ai-pricing/*(model-pricing-admin.ts + model-price-resolver.ts)
// 设计目标:让"还有多少模型没价 / 哪些价是猜的 / 谁改过价"一屏可见、一键可改、全程可追溯。

'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  CheckCircle2,
  Coins,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'

const BASE = '/api/admin/ai-pricing'

interface Overview {
  totalModels: number
  enabledModels: number
  zeroPriced: number
  fallbackPriced: number
  untraced: number
  byTier: Record<string, number>
  byProvider: Array<{ providerCode: string; total: number; zero: number; fallback: number }>
}

interface Item {
  id: number
  configId: number
  modelId: string
  displayName: string | null
  providerCode: string
  enabled: boolean
  isRelayPublic: boolean
  inputPricePer1k: number
  outputPricePer1k: number
  inputPerMillion: number
  outputPerMillion: number
  tier: string | null
  source: string | null
  refModel: string | null
  isZeroPriced: boolean
  isFallback: boolean
  hasPriceSource: boolean
}

interface AuditRow {
  id: number
  model_id: string
  old_input_per_1k: string | null
  old_output_per_1k: string | null
  new_input_per_1k: string
  new_output_per_1k: string
  change_source: string
  change_tier: string | null
  ref_model: string | null
  operator_id: string | null
  note: string | null
  created_at: string
}

const fmt = (v: number) => (v >= 100 ? v.toFixed(0) : v >= 1 ? v.toFixed(2) : v.toFixed(4))
const tierLabel: Record<string, string> = {
  exact: '精确命中',
  alias: '别名归一',
  family: '家族插值',
  'provider-fallback': '渠道中位',
  'global-fallback': '全局中位',
  manual: '人工设定',
}

function StatCard(props: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  hint?: string
  tone?: 'ok' | 'warn' | 'bad'
}) {
  const tone =
    props.tone === 'bad'
      ? 'text-red-600 dark:text-red-400'
      : props.tone === 'warn'
        ? 'text-amber-600 dark:text-amber-500'
        : 'text-emerald-600 dark:text-emerald-400'
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`${tone} shrink-0`}>{props.icon}</div>
        <div className="min-w-0">
          <div className={`text-xl font-semibold ${tone}`}>{props.value}</div>
          <div className="truncate text-xs text-muted-foreground">{props.label}</div>
          {props.hint ? (
            <div className="truncate text-[10px] text-muted-foreground/70">{props.hint}</div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

export default function PricingConsolePage() {
  const qc = useQueryClient()
  const [q, setQ] = React.useState('')
  const [provider, setProvider] = React.useState('')
  const [onlyProblems, setOnlyProblems] = React.useState(true)
  const [notice, setNotice] = React.useState<string | null>(null)
  const [editingId, setEditingId] = React.useState<number | null>(null)
  const [editIn, setEditIn] = React.useState('')
  const [editOut, setEditOut] = React.useState('')
  const [auditModel, setAuditModel] = React.useState<string | null>(null)

  const overview = useQuery({
    queryKey: ['pricing-overview'],
    queryFn: async () => {
      const r = await fetchApi<Overview>(`${BASE}/overview`)
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    refetchInterval: 60_000,
  })

  const list = useQuery({
    queryKey: ['pricing-models', q, provider, onlyProblems],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (provider) params.set('providerCode', provider)
      if (onlyProblems) params.set('onlyProblems', 'true')
      params.set('limit', '200')
      const r = await fetchApi<{ items: Item[]; total: number }>(
        `${BASE}/models?${params.toString()}`,
      )
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })

  const audits = useQuery({
    queryKey: ['pricing-audits', auditModel],
    enabled: !!auditModel,
    queryFn: async () => {
      const r = await fetchApi<{ items: AuditRow[]; total: number }>(
        `${BASE}/audits?modelId=${encodeURIComponent(auditModel!)}&limit=30`,
      )
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })

  const sweep = useMutation({
    mutationFn: async () => {
      const r = await fetchApi<{ scanned: number; resolved: number; unresolved: string[] }>(
        `${BASE}/sweep`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dryRun: false }),
        },
      )
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: (d) => {
      setNotice(
        `巡检完成:扫描 ${d.scanned} 个,补价 ${d.resolved} 个,无法定价 ${d.unresolved.length} 个`,
      )
      void qc.invalidateQueries({ queryKey: ['pricing-models'] })
      void qc.invalidateQueries({ queryKey: ['pricing-overview'] })
    },
    onError: (e: Error) => setNotice(`巡检失败:${e.message}`),
  })

  const syncCatalog = useMutation({
    mutationFn: async () => {
      const r = await fetchApi<{ scanned: number; inserted: number; existing: number }>(
        `${BASE}/sync-catalog`,
        { method: 'POST' },
      )
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: (d) =>
      setNotice(`公示表同步:源 ${d.scanned} 条,新增 ${d.inserted} 条,已存在 ${d.existing} 条`),
    onError: (e: Error) => setNotice(`公示表同步失败:${e.message}`),
  })

  const save = useMutation({
    mutationFn: async (item: Item) => {
      const r = await fetchApi<{ ok: boolean }>(`${BASE}/models/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          configId: item.configId,
          modelId: item.modelId,
          inputPer1k: Number(editIn),
          outputPer1k: Number(editOut),
          note: '管控台内联改价',
        }),
      })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: () => {
      setNotice('改价成功(已写计费表 + 配置表 + 审计)')
      setEditingId(null)
      void qc.invalidateQueries({ queryKey: ['pricing-models'] })
      void qc.invalidateQueries({ queryKey: ['pricing-overview'] })
    },
    onError: (e: Error) => setNotice(`改价失败:${e.message}`),
  })

  const ov = overview.data
  const items = list.data?.items ?? []

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">定价管控台</h1>
          <p className="text-xs text-muted-foreground">
            价格单位:分/千 token(括号内为 元/百万 token)。零价 = 白送,兜底 = 猜价待复核。
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => sweep.mutate()}
            disabled={sweep.isPending}
            className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
          >
            {sweep.isPending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <RefreshCw className="size-3" />
            )}
            巡检零价
          </button>
          <button
            type="button"
            onClick={() => syncCatalog.mutate()}
            disabled={syncCatalog.isPending}
            className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
          >
            {syncCatalog.isPending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <CheckCircle2 className="size-3" />
            )}
            同步公示表
          </button>
        </div>
      </div>

      {notice ? (
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs">{notice}</div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard
          icon={<Coins className="size-5" />}
          label="上架模型"
          value={ov?.enabledModels ?? '—'}
          hint={`全量 ${ov?.totalModels ?? '—'}`}
          tone="ok"
        />
        <StatCard
          icon={
            ov && ov.zeroPriced > 0 ? (
              <XCircle className="size-5" />
            ) : (
              <ShieldCheck className="size-5" />
            )
          }
          label="零价白送"
          value={ov?.zeroPriced ?? '—'}
          hint="必须为 0"
          tone={ov && ov.zeroPriced > 0 ? 'bad' : 'ok'}
        />
        <StatCard
          icon={<AlertTriangle className="size-5" />}
          label="兜底猜价"
          value={ov?.fallbackPriced ?? '—'}
          hint="渠道/全局中位,建议复核"
          tone={ov && ov.fallbackPriced > 0 ? 'warn' : 'ok'}
        />
        <StatCard
          icon={<AlertTriangle className="size-5" />}
          label="无来源留痕"
          value={ov?.untraced ?? '—'}
          hint="历史数据,改价后自动补"
          tone={ov && ov.untraced > 0 ? 'warn' : 'ok'}
        />
        <StatCard
          icon={<CheckCircle2 className="size-5" />}
          label="已可追溯"
          value={Object.entries(ov?.byTier ?? {})
            .filter(([k]) => k !== 'untraced')
            .reduce((a, [, v]) => a + v, 0)}
          hint={Object.entries(ov?.byTier ?? {})
            .map(([k, v]) => `${tierLabel[k] ?? k}:${v}`)
            .join(' · ')}
          tone="ok"
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">模型价目</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="搜模型名"
                className="h-8 w-56 rounded-md border bg-transparent pl-7 pr-2 text-xs"
              />
            </div>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="h-8 rounded-md border bg-transparent px-2 text-xs"
            >
              <option value="">全部渠道</option>
              {(ov?.byProvider ?? []).map((p) => (
                <option key={p.providerCode} value={p.providerCode}>
                  {p.providerCode}({p.zero}零/{p.total})
                </option>
              ))}
            </select>
            <label className="inline-flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={onlyProblems}
                onChange={(e) => setOnlyProblems(e.target.checked)}
              />
              只看问题行
            </label>
            <span className="text-xs text-muted-foreground">
              共 {list.data?.total ?? 0} 行{onlyProblems ? '(仅问题)' : ''}
            </span>
          </div>

          {list.isLoading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> 加载中…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 pr-2">模型</th>
                    <th className="py-2 pr-2">渠道</th>
                    <th className="py-2 pr-2 text-right">输入</th>
                    <th className="py-2 pr-2 text-right">输出</th>
                    <th className="py-2 pr-2">档位</th>
                    <th className="py-2 pr-2">状态</th>
                    <th className="py-2 pr-2 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((m) => {
                    const editing = editingId === m.id
                    return (
                      <tr
                        key={`${m.configId}:${m.id}`}
                        className="border-b border-border/50 align-top"
                      >
                        <td className="max-w-[240px] py-2 pr-2">
                          <div className="truncate font-medium" title={m.modelId}>
                            {m.displayName || m.modelId}
                          </div>
                          <div className="truncate text-[10px] text-muted-foreground/70">
                            {m.modelId}
                          </div>
                        </td>
                        <td className="py-2 pr-2">{m.providerCode}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">
                          {editing ? (
                            <input
                              value={editIn}
                              onChange={(e) => setEditIn(e.target.value)}
                              className="h-7 w-24 rounded border bg-transparent px-1 text-right"
                            />
                          ) : (
                            <>
                              {fmt(m.inputPricePer1k)}
                              <span className="block text-[10px] text-muted-foreground/70">
                                ¥{fmt(m.inputPerMillion)}/M
                              </span>
                            </>
                          )}
                        </td>
                        <td className="py-2 pr-2 text-right tabular-nums">
                          {editing ? (
                            <input
                              value={editOut}
                              onChange={(e) => setEditOut(e.target.value)}
                              className="h-7 w-24 rounded border bg-transparent px-1 text-right"
                            />
                          ) : (
                            <>
                              {fmt(m.outputPricePer1k)}
                              <span className="block text-[10px] text-muted-foreground/70">
                                ¥{fmt(m.outputPerMillion)}/M
                              </span>
                            </>
                          )}
                        </td>
                        <td className="py-2 pr-2">
                          <span
                            className={
                              m.tier === 'global-fallback' || m.tier === 'provider-fallback'
                                ? 'text-amber-600 dark:text-amber-500'
                                : 'text-muted-foreground'
                            }
                          >
                            {m.tier ? (tierLabel[m.tier] ?? m.tier) : '未标注'}
                          </span>
                        </td>
                        <td className="py-2 pr-2">
                          {m.isZeroPriced ? (
                            <span className="text-red-600 dark:text-red-400">零价</span>
                          ) : m.enabled ? (
                            <span className="text-emerald-600 dark:text-emerald-400">已上架</span>
                          ) : (
                            <span className="text-muted-foreground">已下架</span>
                          )}
                        </td>
                        <td className="py-2 pr-2 text-right">
                          {editing ? (
                            <span className="flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => save.mutate(m)}
                                disabled={save.isPending}
                                className="rounded border px-2 py-0.5 hover:bg-muted"
                              >
                                保存
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="rounded border px-2 py-0.5 hover:bg-muted"
                              >
                                取消
                              </button>
                            </span>
                          ) : (
                            <span className="flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(m.id)
                                  setEditIn(String(m.inputPricePer1k))
                                  setEditOut(String(m.outputPricePer1k))
                                }}
                                className="rounded border px-2 py-0.5 hover:bg-muted"
                              >
                                改价
                              </button>
                              <button
                                type="button"
                                onClick={() => setAuditModel(m.modelId)}
                                className="rounded border px-2 py-0.5 hover:bg-muted"
                              >
                                历史
                              </button>
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-muted-foreground">
                        {onlyProblems ? '没有问题行,全部模型都已定价且有来源' : '没有匹配的模型'}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {auditModel ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">调价历史 · {auditModel}</CardTitle>
            <button
              type="button"
              onClick={() => setAuditModel(null)}
              className="rounded border px-2 py-0.5 text-xs hover:bg-muted"
            >
              关闭
            </button>
          </CardHeader>
          <CardContent>
            {audits.isLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" /> 加载中…
              </div>
            ) : (audits.data?.items.length ?? 0) === 0 ? (
              <div className="text-xs text-muted-foreground">暂无调价记录(首次改价后开始记录)</div>
            ) : (
              <ul className="space-y-1 text-xs">
                {audits.data!.items.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center gap-2 border-b border-border/40 py-1"
                  >
                    <span className="text-muted-foreground">
                      {new Date(a.created_at).toLocaleString('zh-CN')}
                    </span>
                    <span className="tabular-nums">
                      {a.old_input_per_1k ?? '—'}/{a.old_output_per_1k ?? '—'} →{' '}
                      {a.new_input_per_1k}/{a.new_output_per_1k}
                    </span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
                      {a.change_source}
                    </span>
                    {a.change_tier ? (
                      <span className="text-[10px] text-muted-foreground">
                        {tierLabel[a.change_tier] ?? a.change_tier}
                      </span>
                    ) : null}
                    {a.note ? (
                      <span className="text-[10px] text-muted-foreground">{a.note}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
