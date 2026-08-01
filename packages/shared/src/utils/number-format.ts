/**
 * Compact 数字格式化工具(跨端共享,2026-08-01 P3-4.2 批次5 立,从 apps/web/src/lib/number-format.ts 下沉)。
 *
 * locale-aware:en → 1.2M / 12K,zh-CN → 1.2 亿 / 1.2 万,ja → 1.2 億 / 1.2 万,ko → 1.2억 / 1.2만
 *
 * 注:getLocale(SSR 安全读 document.documentElement.lang)留在各端实现,
 * 因为它依赖 DOM API,各端可自行注入 locale(如 RN 端从 i18n state 读取)。
 */

/**
 * compact 数字格式化(< 10000 时返回原数字字符串,>= 10000 时用 Intl compact)。
 * - HotRanking / AiFeedTimeline 热度值
 * - TrendChartDialog Y 轴刻度
 *
 * 调用方负责传入 locale(如 web 端从 document.documentElement.lang 读取,RN 端从 i18n state 读取)。
 */
export function formatCompact(n: number | null | undefined, locale: string): string {
  if (n === null || n === undefined || n === 0) return ''
  if (n < 10000) return String(n)
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n)
}
