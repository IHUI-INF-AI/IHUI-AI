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
