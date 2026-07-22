'use client'

/**
 * CompareModelsDialog — 跨 Provider 横向对比多个 Model(2026-07-22 立,深度功能)
 *
 * 用法:
 *  - 在任意 ProviderCardV2 model 行点击「对比」按钮 → 打开 dialog
 *  - dialog 顶部可继续勾选/取消要对比的 model(跨 provider)
 *  - 下方表格按维度横向展示,高亮"最优"项(最便宜、最大上下文、健康等)
 *
 * 对比维度:
 *  - Provider / Model / Context / Input Price / Output Price
 *  - Health / 30d Tokens / 30d Cost / Enabled / Default Params (摘要)
 */
import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  ArrowLeftRight,
  Check,
  CheckCircle2,
  Circle,
  Crown,
  Sparkles,
  X,
} from 'lucide-react'

import { Badge, Button, Dialog, DialogContent, DialogHeader, DialogTitle } from '@ihui/ui'

import type { UserLlmModel, UserLlmProvider } from './types-v2'

interface Props {
  open: boolean
  /** 全部 provider(用于跨 provider 选择) */
  providers: UserLlmProvider[]
  /** 初始选中的 model id 列表(从卡片进入时携带) */
  initialSelectedIds?: number[]
  onClose: () => void
}

interface ComparedModel {
  model: UserLlmModel
  provider: UserLlmProvider
}

const MAX_COMPARE = 4

export function CompareModelsDialog({ open, providers, initialSelectedIds, onClose }: Props) {
  const t = useTranslations('llmSettings.v2.compareDialog')
  const [selected, setSelected] = React.useState<Set<number>>(new Set())

  // 初始化:从卡片传入的 model ids
  React.useEffect(() => {
    if (open) {
      setSelected(new Set(initialSelectedIds ?? []))
    }
  }, [open, initialSelectedIds])

  // 把所有 model 扁平化为可选项
  const allOptions: ComparedModel[] = React.useMemo(() => {
    const out: ComparedModel[] = []
    for (const p of providers) {
      for (const m of p.models ?? []) {
        out.push({ model: m, provider: p })
      }
    }
    return out
  }, [providers])

  // 当前选中的对比项
  const compared: ComparedModel[] = React.useMemo(
    () => allOptions.filter((o) => selected.has(o.model.id)),
    [allOptions, selected],
  )

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        if (next.size >= MAX_COMPARE) {
          // 已达上限:替换最早选中的
          const first = next.values().next().value
          if (typeof first === 'number') next.delete(first)
        }
        next.add(id)
      }
      return next
    })
  }

  // 计算"最优"维度(用于高亮)
  const best = React.useMemo(() => {
    if (compared.length < 2) return null
    const byContext = [...compared].sort((a, b) => b.model.contextLength - a.model.contextLength)
    const byInputPrice = [...compared].sort(
      (a, b) => Number(a.model.inputPricePer1k) - Number(b.model.inputPricePer1k),
    )
    const byOutputPrice = [...compared].sort(
      (a, b) => Number(a.model.outputPricePer1k) - Number(b.model.outputPricePer1k),
    )
    return {
      context: byContext[0]?.model.id,
      inputCheap: byInputPrice[0]?.model.id,
      outputCheap: byOutputPrice[0]?.model.id,
    }
  }, [compared])

  function isBest(id: number, key: 'context' | 'inputCheap' | 'outputCheap') {
    return best?.[key] === id && compared.length >= 2
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-primary" />
            {t('title')}
            {compared.length > 0 ? (
              <Badge variant="secondary" className="text-xs">
                {t('selectedCount', { count: compared.length, max: MAX_COMPARE })}
              </Badge>
            ) : null}
          </DialogTitle>
        </DialogHeader>

        {/* 选区 */}
        <div className="space-y-2 rounded-md border bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground">
            {t('pickHint', { max: MAX_COMPARE })}
          </p>
          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
            {allOptions.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('noModels')}</p>
            ) : (
              allOptions.map(({ model, provider }) => {
                const checked = selected.has(model.id)
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => toggle(model.id)}
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors ${
                      checked
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-input bg-background hover:bg-accent'
                    }`}
                  >
                    {checked ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Circle className="h-3 w-3 text-muted-foreground" />
                    )}
                    <span className="truncate font-mono">{model.displayName || model.modelId}</span>
                    <span className="text-muted-foreground">· {provider.name}</span>
                    {model.isDefault ? (
                      <Crown className="h-3 w-3 fill-amber-500 text-amber-500" />
                    ) : null}
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* 对比表 */}
        {compared.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
            <Sparkles className="h-6 w-6" />
            {t('empty')}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/30 text-left">
                  <th className="w-32 px-3 py-2 font-medium text-muted-foreground">
                    {t('colDimension')}
                  </th>
                  {compared.map(({ model, provider }) => (
                    <th key={model.id} className="min-w-32 px-3 py-2 font-medium">
                      <div className="space-y-0.5">
                        <p className="truncate font-mono text-sm">
                          {model.displayName || model.modelId}
                        </p>
                        <p className="truncate text-[10px] font-normal text-muted-foreground">
                          {provider.name}
                        </p>
                        <button
                          type="button"
                          onClick={() => toggle(model.id)}
                          className="text-[10px] text-muted-foreground hover:text-destructive"
                        >
                          <X className="inline h-2.5 w-2.5" /> {t('remove')}
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <Row label={t('rowProvider')}>
                  {compared.map((c) => (
                    <Cell key={c.model.id}>{c.provider.providerCode}</Cell>
                  ))}
                </Row>
                <Row label={t('rowFormat')}>
                  {compared.map((c) => (
                    <Cell key={c.model.id}>
                      <code className="rounded bg-muted px-1 text-[10px]">
                        {c.provider.apiFormat}
                      </code>
                    </Cell>
                  ))}
                </Row>
                <Row label={t('rowContext')}>
                  {compared.map((c) => (
                    <Cell key={c.model.id} highlight={isBest(c.model.id, 'context')}>
                      {(c.model.contextLength / 1000).toFixed(0)}K
                    </Cell>
                  ))}
                </Row>
                <Row label={t('rowInputPrice')}>
                  {compared.map((c) => (
                    <Cell key={c.model.id} highlight={isBest(c.model.id, 'inputCheap')}>
                      ${Number(c.model.inputPricePer1k).toFixed(4)}/1K
                    </Cell>
                  ))}
                </Row>
                <Row label={t('rowOutputPrice')}>
                  {compared.map((c) => (
                    <Cell key={c.model.id} highlight={isBest(c.model.id, 'outputCheap')}>
                      ${Number(c.model.outputPricePer1k).toFixed(4)}/1K
                    </Cell>
                  ))}
                </Row>
                <Row label={t('rowHealth')}>
                  {compared.map((c) => (
                    <Cell key={c.model.id}>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          c.provider.healthStatus === 'healthy'
                            ? 'text-emerald-600'
                            : c.provider.healthStatus === 'down'
                              ? 'text-red-600'
                              : 'text-muted-foreground'
                        }`}
                      >
                        {c.provider.healthStatus}
                      </Badge>
                    </Cell>
                  ))}
                </Row>
                <Row label={t('rowUsage30d')}>
                  {compared.map((c) => (
                    <Cell key={c.model.id}>
                      {(c.model.usage30dTokens ?? 0) > 0
                        ? `${((c.model.usage30dTokens ?? 0) / 1000).toFixed(1)}K tok`
                        : '—'}
                    </Cell>
                  ))}
                </Row>
                <Row label={t('rowCost30d')}>
                  {compared.map((c) => (
                    <Cell key={c.model.id}>
                      {(c.model.usage30dCostCents ?? 0) > 0
                        ? `$${((c.model.usage30dCostCents ?? 0) / 100).toFixed(2)}`
                        : '—'}
                    </Cell>
                  ))}
                </Row>
                <Row label={t('rowEnabled')}>
                  {compared.map((c) => (
                    <Cell key={c.model.id}>
                      {c.model.enabled ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </Cell>
                  ))}
                </Row>
                <Row label={t('rowDefault')}>
                  {compared.map((c) => (
                    <Cell key={c.model.id}>
                      {c.model.isDefault ? (
                        <Crown className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </Cell>
                  ))}
                </Row>
                <Row label={t('rowParams')}>
                  {compared.map((c) => (
                    <Cell key={c.model.id}>
                      <ParamsSummary
                        params={c.model.defaultParams ?? {}}
                        t={t}
                      />
                    </Cell>
                  ))}
                </Row>
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onClose}>
            {t('close')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr className="border-b last:border-b-0">
      <td className="px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </td>
      {children}
    </tr>
  )
}

function Cell({
  children,
  highlight,
}: {
  children: React.ReactNode
  highlight?: boolean
}) {
  return (
    <td
      className={`px-3 py-2 align-top text-xs ${
        highlight ? 'bg-emerald-50 font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : ''
      }`}
    >
      {children}
    </td>
  )
}

/** 默认参数摘要(最多展示 3 个关键项,剩余显示 +N) */
function ParamsSummary({ params, t }: { params: Record<string, unknown>; t: ReturnType<typeof useTranslations<string>> }) {
  const items: string[] = []
  if (typeof params.temperature === 'number') items.push(`T=${params.temperature}`)
  if (typeof params.max_tokens === 'number') items.push(`max=${params.max_tokens}`)
  if (typeof params.top_p === 'number') items.push(`top_p=${params.top_p}`)
  if (params.system) items.push('sys')
  if (params.response_format) items.push('json')
  if (items.length === 0) return <span className="text-muted-foreground">{t('noParams')}</span>
  const extra = Object.keys(params).length - items.length
  return (
    <span className="font-mono text-[10px]">
      {items.join(' · ')}
      {extra > 0 ? ` +${extra}` : ''}
    </span>
  )
}
