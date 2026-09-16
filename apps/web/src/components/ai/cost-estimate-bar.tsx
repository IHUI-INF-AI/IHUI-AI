// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { Coins } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCostGuardStore } from '@/stores/cost-guard'

/**
 * CostEstimateBar — 成本预检/对比条(P3 #43 v1,2026-09-16 立)。
 *
 * 发送前:显示预检估算(tokens + 费用;priced=false 时标注兜底价仅供参考);
 * 流结束后:实际 tokens vs 预估对比。竞品全部只有事后账单——这里是**事前知情**。
 * 阻塞式协商(超预算弹确认)为阶段2。
 */
export function CostEstimateBar() {
  const t = useTranslations('costGuard')
  const estimate = useCostGuardStore((s) => s.estimate)
  const actualTokens = useCostGuardStore((s) => s.actualTokens)

  if (!estimate) return null
  const estTotal = estimate.estimatedTokensIn + estimate.estimatedTokensOut

  return (
    <div
      className="mx-2 mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground"
      data-testid="cost-estimate-bar"
    >
      <Coins className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
      <span>
        {t('estimateLine', {
          tokens: estTotal.toLocaleString(),
          cost: estimate.estimatedCostUsd.toFixed(4),
        })}
        {!estimate.priced && <span className="ml-1 opacity-60">({t('fallbackPrice')})</span>}
      </span>
      {actualTokens !== null && (
        <span className="tabular-nums" data-testid="cost-actual">
          {t('actualLine', {
            actual: actualTokens.toLocaleString(),
            estimate: estTotal.toLocaleString(),
          })}
        </span>
      )}
    </div>
  )
}

export default CostEstimateBar
