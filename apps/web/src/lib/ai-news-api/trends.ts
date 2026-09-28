// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

import { safeApi } from './http'
import type { TrendChartData } from './types'

export async function fetchAiTrendChart(
  itemId: string,
  window = 14,
): Promise<TrendChartData | null> {
  const params = new URLSearchParams({ itemId, window: String(window) })
  const data = await safeApi<TrendChartData>(`/api/ai-feed/trends?${params.toString()}`)
  return data
}
