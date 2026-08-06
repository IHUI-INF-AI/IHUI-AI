import type { I18nOverview } from './types'

/** 加载失败时的诚实空态,避免用假数据冒充真实缺失统计 */
export const EMPTY: I18nOverview = {
  languages: [],
  totalMissing: 0,
  recentUpdates: [],
}

export const LOCALE_COLORS: Record<string, string> = {
  'zh-CN': '#10b981',
  en: '#3b82f6',
  ja: '#f59e0b',
  ko: '#8b5cf6',
  'zh-TW': '#ec4899',
}

export function fmtTime(v: string) {
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '-'
  const now = Date.now()
  const diff = now - d.getTime()
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  return `${Math.floor(diff / 86_400_000)} 天前`
}
