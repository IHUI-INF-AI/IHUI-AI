/**
 * 共享数字格式化工具:统一 compact 表示法,消除硬编码"亿/万"。
 * locale-aware:en → 1.2M / 12K,zh-CN → 1.2 亿 / 1.2 万,ja → 1.2 億 / 1.2 万,ko → 1.2억 / 1.2만
 *
 * 2026-08-01 P3-4.2 批次5:formatCompact 核心逻辑下沉到 @ihui/shared/utils/number-format,
 * 本文件保留 web 端专属的 getLocale(DOM 依赖)+ formatCompact wrapper(locale 可选,默认 getLocale)。
 */

// re-export shared/format 的通用格式化函数(formatFileSize/formatPrice/formatMoney/formatPhone/formatTokenCount)
export * from '@ihui/shared/utils/format'
// re-export shared/number-format 的跨端 formatCompactCore(locale 必传版)
export { formatCompact as formatCompactCore } from '@ihui/shared/utils/number-format'

import { formatCompact as formatCompactCore } from '@ihui/shared/utils/number-format'

/** 获取当前 locale(SSR 安全,web 端专属 DOM 依赖) */
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
 *
 * web 端 wrapper:locale 可选,默认调 getLocale()。
 * 跨端调用方应直接用 @ihui/shared/utils/number-format 的 formatCompact(locale 必传)。
 */
export function formatCompact(n: number | null | undefined, locale?: string): string {
  return formatCompactCore(n, locale ?? getLocale())
}
