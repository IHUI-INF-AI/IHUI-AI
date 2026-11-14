// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 实时汇率端点封装(2026-11-14 立)。
 *
 * 后端:apps/api/src/routes/admin-exchange-rate.ts 的 GET /api/exchange-rates/live。
 * 用途:模型价格 / 聊天成本等展示层按「即时汇率」在 USD / CNY / USDT 之间换算;
 * 扣费仍以 CNY 为基准,本接口不参与计费。
 */
import { fetchApi } from '../client.js'

/** 实时汇率快照(1 外币 = cnyPer[币种] CNY) */
export interface LiveFxRates {
  base: 'CNY'
  cnyPer: { USD: number; USDT: number }
  perCny: { USD: number; USDT: number }
  /** 各货币对来源(审计/悬浮提示用) */
  sources: { usdCny: string; usdtCny: string }
  fetchedAt: string
  /** 上游不可用时为 true(前端仍可展示,但提示非实时) */
  stale: boolean
  ttlSeconds: number
}

/** 拉取实时汇率快照;接口不可用时返回 null(调用方降级为 CNY 展示) */
export async function getLiveExchangeRates(): Promise<LiveFxRates | null> {
  const res = await fetchApi<LiveFxRates>('/api/exchange-rates/live')
  if (!res.success || !res.data) return null
  const d = res.data
  if (
    typeof d.cnyPer?.USD !== 'number' ||
    typeof d.cnyPer?.USDT !== 'number' ||
    !(d.cnyPer.USD > 0) ||
    !(d.cnyPer.USDT > 0)
  ) {
    return null
  }
  return d
}
