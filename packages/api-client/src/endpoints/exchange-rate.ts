// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
  return normalizeLiveFxRates(res.success ? res.data : null)
}

function normalizeLiveFxRates(d: LiveFxRates | null | undefined): LiveFxRates | null {
  if (!d) return null
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

/**
 * 服务端(Next SSR)取汇率:显式基址 + 数据缓存窗口。
 *
 * 为什么单独一条(2026-11-19,守门 73 收口):SSR 里模块级 `setBaseUrl()` 的注入顺序
 * 不由请求方保证,`fetchApi` 的同源相对 URL 在 Node 侧没有 origin 可依;而端内自己拼
 * `${API_URL}/api/...` 直连又是"端内绕过 api-client"(门 73 明确要拦的那一型)。
 * 因此把这条 fetch 留在传输层:调用方只传基址,URL 拼接、响应壳解包、异常归一都在这里。
 */
export async function getLiveExchangeRatesAt(
  baseUrl: string,
  revalidateSeconds = 300,
): Promise<LiveFxRates | null> {
  const base = String(baseUrl ?? '').replace(/\/$/, '')
  try {
    const res = await fetch(`${base}/api/exchange-rates/live`, {
      // Next 的 data cache 字段;非 Next 运行时(纯 Node fetch)会忽略未知属性
      next: { revalidate: revalidateSeconds },
    } as RequestInit)
    if (!res.ok) return null
    const json = (await res.json()) as { success?: boolean; code?: number; data?: LiveFxRates }
    if (json.success !== true && json.code !== 0) return null
    return normalizeLiveFxRates(json.data)
  } catch {
    return null
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
