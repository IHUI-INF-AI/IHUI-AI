/**
 * 共享数字格式化工具:统一 compact 表示法,消除硬编码"亿/万"。
 * locale-aware:en → 1.2M / 12K,zh-CN → 1.2 亿 / 1.2 万,ja → 1.2 億 / 1.2 万,ko → 1.2억 / 1.2만
 */

/** 获取当前 locale(SSR 安全) */
export function getLocale(): string {
  if (typeof document !== 'undefined') {
    return document.documentElement.lang || 'zh-CN'
  }
  return 'zh-CN'
}

/**
 * compact 数字格式化(< 10000 时返回原数字字符串,>= 10000 时用 Intl compact)。
 * - HotRanking / AiFeedTimeline 热度值
 * - TrendChartDialog Y 轴刻度
 */
export function formatCompact(n: number | null | undefined, locale?: string): string {
  if (n === null || n === undefined || n === 0) return ''
  if (n < 10000) return String(n)
  const loc = locale ?? getLocale()
  return new Intl.NumberFormat(loc, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n)
}
