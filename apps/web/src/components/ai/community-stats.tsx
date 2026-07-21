'use client'

import { useTranslations } from 'next-intl'

// 顶部统计数据
const STATS: Array<{ key: 'creations' | 'creators' | 'likes'; value: number }> = [
  { key: 'creations', value: 1234 },
  { key: 'creators', value: 567 },
  { key: 'likes', value: 8900 },
]

// 数字简写:K / M
function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}

/**
 * CommunityStats - 顶部三组统计数据(创作数 / 创作者数 / 点赞数)
 * 高科技工业风的 glass-card 简化版:compact 紧凑 + subtle hover bg
 */
export function CommunityStats() {
  const t = useTranslations('aiCommunity')

  return (
    <div className="flex flex-wrap justify-center gap-3">
      {STATS.map((s) => (
        <div
          key={s.key}
          className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/50"
        >
          <span className="text-2xl font-bold tracking-tight tabular-nums">
            {formatNumber(s.value)}
          </span>
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t(`stats.${s.key}`)}
          </span>
        </div>
      ))}
    </div>
  )
}
