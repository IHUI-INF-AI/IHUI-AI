/**
 * EarningsStatisticsCard 收益统计卡片 (mobile-rn 端)
 *
 * 展示收益数据:顶部 label + 主金额 + 可选趋势 + 今日/本月/累计 3 项元数据。
 * 复用历史项目 EarningsStatisticsCard + PersonalInformationCard 的卡片布局语义,
 * 适配 mobile-rn StyleSheet 写法,样式 token 全部走 @ihui/design-tokens(rnLightTokens)。
 *
 * 设计原则(2026-07-30 立):
 * - 单卡片(整块 View),padding 16,borderRadius 12,bgColor surface.card
 * - 顶部 label:13/600,text.secondary,uppercase letterSpacing 0.5
 * - 主数字:28/700,text.primary,前缀 currency(默认 '¥')
 * - 趋势:↑/↓ + 百分比,success(绿)/ danger(红)
 * - 元数据行:flex row 3 项各占 1/3 宽度左对齐,数字 16/600,标签 11
 * - 浅色优雅风,无霓虹无渐变
 * - 系统字体(不显式指定 fontFamily,走平台默认)
 *
 * 共享类型:EarningsStatisticsCardProps / EarningsTrend 已下沉到本组件(组件自身定义,
 * 不强依赖共享层,因其他端无对应类型,避免在 @ihui/types 内创建一次性类型)。
 */
import { StyleSheet, Text, View } from 'react-native'
import { rnLightTokens as tokens } from '@ihui/design-tokens'

export type EarningsTrendDirection = 'up' | 'down'

export interface EarningsTrend {
  direction: EarningsTrendDirection
  percent: number
}

export interface EarningsStatisticsCardProps {
  label: string
  title: number
  todayAmount: number
  monthAmount: number
  totalAmount: number
  trend?: EarningsTrend
  currency?: string
}

const TREND_ARROW: Record<EarningsTrendDirection, string> = {
  up: '↑',
  down: '↓',
}

const META_LABELS: ReadonlyArray<string> = ['今日', '本月', '累计']

function formatAmount(value: number): string {
  return value.toFixed(2)
}

export default function EarningsStatisticsCard({
  label,
  title,
  todayAmount,
  monthAmount,
  totalAmount,
  trend,
  currency = '¥',
}: EarningsStatisticsCardProps) {
  const trendColor =
    trend?.direction === 'up' ? tokens.success.DEFAULT : tokens.danger.DEFAULT
  const trendText = trend ? `${TREND_ARROW[trend.direction]} ${trend.percent}%` : ''

  const amounts: ReadonlyArray<number> = [todayAmount, monthAmount, totalAmount]

  return (
    <View style={styles.card}>
      {/* 顶部小标签 */}
      <Text style={styles.label}>{label}</Text>

      {/* 主数字 + 趋势 */}
      <View style={styles.titleRow}>
        <Text style={styles.title}>
          {currency}
          {formatAmount(title)}
        </Text>
        {trend ? <Text style={[styles.trend, { color: trendColor }]}>{trendText}</Text> : null}
      </View>

      {/* 元数据行:今日 / 本月 / 累计 */}
      <View style={styles.metaRow}>
        {amounts.map((amount, idx) => (
          <View key={META_LABELS[idx]} style={styles.metaItem}>
            <Text style={styles.metaValue}>{formatAmount(amount)}</Text>
            <Text style={styles.metaLabel}>{META_LABELS[idx]}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: tokens.surface.card,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: tokens.text.primary,
  },
  trend: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    marginTop: 16,
  },
  metaItem: {
    flex: 1,
    alignItems: 'flex-start',
  },
  metaValue: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  metaLabel: {
    marginTop: 2,
    fontSize: 11,
    color: tokens.text.secondary,
  },
})
