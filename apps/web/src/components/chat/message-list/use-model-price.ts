// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { getModelPriceCny, type ModelPriceCny } from '@ihui/api-client'

// W12(2026-09-13 立):消息级 token/成本明细的模型价目查询 hook。
// 模块级 Promise 缓存:消息列表可能有几十条消息同时查询同一模型,
// 不缓存会放大 /api/ai-pricing 请求(SessionUsageBadge 每实例一拉的教训)。

const priceCache = new Map<string, Promise<ModelPriceCny | null>>()

function fetchPriceCached(model: string): Promise<ModelPriceCny | null> {
  let p = priceCache.get(model)
  if (!p) {
    p = getModelPriceCny(model).catch(() => null)
    priceCache.set(model, p)
  }
  return p
}

/**
 * useModelPriceCny — 查询模型人民币单价(元/千 token),带模块级缓存。
 * 模型为空 / 'auto' / 无价目数据时返回 null(调用方降级为仅显示 token 数)。
 */
export function useModelPriceCny(model?: string): ModelPriceCny | null {
  const [price, setPrice] = React.useState<ModelPriceCny | null>(null)
  React.useEffect(() => {
    if (!model) {
      setPrice(null)
      return
    }
    let cancelled = false
    void fetchPriceCached(model).then((p) => {
      if (!cancelled) setPrice(p)
    })
    return () => {
      cancelled = true
    }
  }, [model])
  return price
}

/** 按单价折算消息成本(元):prompt/completion 各按千 token 计价 */
export function computeMessageCostCny(
  price: ModelPriceCny | null,
  usage: { promptTokens?: number | null; completionTokens?: number | null },
): { inputCost: number | null; outputCost: number | null; totalCost: number | null } {
  if (!price) return { inputCost: null, outputCost: null, totalCost: null }
  const { promptTokens, completionTokens } = usage
  const inputCost =
    typeof promptTokens === 'number' ? (promptTokens / 1000) * price.inputPricePer1kCny : null
  const outputCost =
    typeof completionTokens === 'number'
      ? (completionTokens / 1000) * price.outputPricePer1kCny
      : null
  const totalCost = inputCost !== null && outputCost !== null ? inputCost + outputCost : null
  return { inputCost, outputCost, totalCost }
}

/** token 数紧凑格式化:1234 → 1.2k */
export function formatCompactTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
