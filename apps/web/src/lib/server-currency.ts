// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 服务端展示货币播种(2026-11-14 立)。
 *
 * Next 的服务端组件按路由分包:layout 与 page 各自持有独立的 display-currency 模块实例,
 * 只在本 layout 里播种传不到 page —— 实测 /models/overview 的 <html data-currency-effective>
 * 已是 USD,页内金额却仍直出 ¥128.50(首帧混币)。
 *
 * 因此每个会直接格式化金额的服务端页面都要在渲染前调用一次 `await seedServerCurrency()`。
 * React cache() 保证同一次请求里 layout + page 只读一次 cookie、只拉一次汇率
 * (汇率 fetch 另带 300s 数据缓存)。
 */
import { cache } from 'react'
import { cookies, headers } from 'next/headers'
import type { LiveFxRates } from '@ihui/api-client'
import {
  DISPLAY_CURRENCY_KEY,
  FX_SNAPSHOT_COOKIE,
  normalizeDisplayCurrency,
  parseFxSnapshot,
  resolveDisplayCurrencyByLanguage,
  setFxSnapshot,
  setServerDisplayCurrency,
  type CurrencyCode,
  type DisplayCurrency,
} from './display-currency'

export interface ServerCurrencySeed {
  /** cookie 里的原始偏好(auto / CNY / USD / USDT) */
  selected: DisplayCurrency
  /** auto 已按 Accept-Language 解开后的生效币种 */
  effective: CurrencyCode
  /** 汇率快照(cookie 优先,缺失时服务端预取;失败为 null ⇒ 回落原币种) */
  rates: LiveFxRates | null
}

function isStaticExport(): boolean {
  return process.env.EXPORT_STATIC === 'true' || process.env.GITHUB_PAGES === 'true'
}

/** 读取偏好 + 汇率并写入本模块实例的快照;静态导出(output:'export')下不做任何事 */
export const seedServerCurrency = cache(async (): Promise<ServerCurrencySeed> => {
  if (isStaticExport()) {
    return { selected: 'auto', effective: 'CNY', rates: null }
  }
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()])
  const selected = normalizeDisplayCurrency(cookieStore.get(DISPLAY_CURRENCY_KEY)?.value)
  const effective = resolveDisplayCurrencyByLanguage(
    selected,
    requestHeaders.get('accept-language'),
  )
  setServerDisplayCurrency(selected, effective)

  // 汇率快照:cookie 优先;缺失时服务端预取一次,避免首访/清 cookie 后首帧混币。
  let rates = parseFxSnapshot(cookieStore.get(FX_SNAPSHOT_COOKIE)?.value)
  if (!rates) {
    try {
      const apiBase = process.env.API_URL ?? 'http://127.0.0.1:8802'
      const res = await fetch(`${apiBase}/api/exchange-rates/live`, {
        next: { revalidate: 300 },
      })
      if (res.ok) {
        // 后端统一响应壳是 { code: 0, message, data }(api-client 的 fetchApi 负责解包);
        // 这里直连 fetch 绕过了 fetchApi,必须同时认 success:true 与 code:0 两种形态 ——
        // 只判 success 会永远拿不到汇率,SSR 便一直回落原币种(¥ 混币首帧的根因)。
        const json = (await res.json()) as {
          success?: boolean
          code?: number
          data?: LiveFxRates
        }
        const data = json.data
        if (
          (json.success === true || json.code === 0) &&
          data &&
          typeof data.cnyPer?.USD === 'number' &&
          data.cnyPer.USD > 0 &&
          typeof data.cnyPer?.USDT === 'number' &&
          data.cnyPer.USDT > 0
        ) {
          rates = data
        }
      }
    } catch {
      // 汇率服务暂不可用:维持回落原币种,绝不用写死汇率造假
    }
  }
  setFxSnapshot(rates)
  return { selected, effective, rates }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
