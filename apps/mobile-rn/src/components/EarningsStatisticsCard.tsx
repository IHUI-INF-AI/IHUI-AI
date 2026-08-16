/**
 * EarningsStatisticsCard 收益统计卡片 (mobile-rn 端)
 *
 * 对齐历史项目 EarningsStatisticsCard/index.vue:
 * - Tab 切换(今日/本月/累计) + 数据行(收益/待结算/已结算) + 底部统计(推广订单/团队新增/提现金额)
 * - props: dayStatistics/monthStatistics/sumStatistics 三组统计对象(对齐原项目)
 * - 向后兼容:label/title/todayAmount/monthAmount/totalAmount 旧 API 保留,
 *   未传三组对象时降级为「今日=主金额 + 今日/本月/累计」静态展示。
 * - 浅色优雅风,rnLightTokens;圆角守门;无渐变遮罩。
 */
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native'
import { rnLightTokens as tokens } from '@ihui/design-tokens'

export type EarningsTrendDirection = 'up' | 'down'

export interface EarningsTrend {
  direction: EarningsTrendDirection
  percent: number
}

/** 单期统计(对齐原项目 dayStatistics/monthStatistics/sumStatistics 6 字段) */
export interface EarningsStat {
  amount: number
  incomplete: number
  finish: number
  order: number
  strength: number
  endAmount: number
}

export type EarningsTab = 'today' | 'month' | 'total'

export interface EarningsStatisticsCardProps {
  label: string
  title: number
  todayAmount: number
  monthAmount: number
  totalAmount: number
  trend?: EarningsTrend
  currency?: string
  /** 今日统计(对齐原项目 dayStatistics);缺省用 todayAmount 映射 amount */
  dayStatistics?: EarningsStat
  /** 本月统计(对齐原项目 monthStatistics) */
  monthStatistics?: EarningsStat
  /** 累计统计(对齐原项目 sumStatistics) */
  sumStatistics?: EarningsStat
  /** Tab 切换回调(对齐原项目 tab-change emit) */
  onTabChange?: (tab: EarningsTab) => void
}

const TREND_ARROW: Record<EarningsTrendDirection, string> = {
  up: '↑',
  down: '↓',
}

const TABS: ReadonlyArray<{ key: EarningsTab; label: string; tabLabel: string }> = [
  { key: 'today', label: '今日', tabLabel: '日' },
  { key: 'month', label: '本月', tabLabel: '月' },
  { key: 'total', label: '累计', tabLabel: '总' },
]

const EMPTY_STAT: EarningsStat = {
  amount: 0,
  incomplete: 0,
  finish: 0,
  order: 0,
  strength: 0,
  endAmount: 0,
}

function formatAmount(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : '0.00'
}

export default function EarningsStatisticsCard({
  label,
  title,
  todayAmount,
  monthAmount,
  totalAmount,
  trend,
  currency = '¥',
  dayStatistics,
  monthStatistics,
  sumStatistics,
  onTabChange,
}: EarningsStatisticsCardProps) {
  const [currentTab, setCurrentTab] = useState<EarningsTab>('today')

  const trendColor = trend?.direction === 'up' ? tokens.success.DEFAULT : tokens.danger.DEFAULT
  const trendText = trend ? `${TREND_ARROW[trend.direction]} ${trend.percent}%` : ''

  // 三组统计(优先结构化对象;缺省降级:主金额 → today amount)
  const statMap: Record<EarningsTab, EarningsStat> = {
    today: dayStatistics ?? { ...EMPTY_STAT, amount: todayAmount },
    month: monthStatistics ?? { ...EMPTY_STAT, amount: monthAmount },
    total: sumStatistics ?? { ...EMPTY_STAT, amount: totalAmount },
  }
  const current = statMap[currentTab]
  const tabLabel = TABS.find((t) => t.key === currentTab)?.tabLabel ?? '日'

  const switchTab = (tab: EarningsTab) => {
    setCurrentTab(tab)
    onTabChange?.(tab)
  }

  return (
    <View style={styles.card}>
      {/* Tab 切换(对齐原项目 tab-switcher) */}
      <View style={styles.tabSwitcher}>
        {TABS.map((tab, idx) => (
          <View key={tab.key} style={styles.tabItemWrap}>
            <Pressable
              style={({ pressed }) => [
                styles.tabItem,
                currentTab === tab.key ? styles.tabItemActive : null,
                pressed ? styles.tabItemPressed : null,
              ]}
              onPress={() => switchTab(tab.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: currentTab === tab.key }}
              accessibilityLabel={tab.label}
            >
              <Text style={[styles.tabText, currentTab === tab.key ? styles.tabTextActive : null]}>
                {tab.label}
              </Text>
            </Pressable>
            {idx < TABS.length - 1 ? <View style={styles.tabDivider} /> : null}
          </View>
        ))}
      </View>

      {/* 数据行:收益 / 待结算 / 已结算 */}
      <View style={styles.dataRow}>
        <View style={styles.dataItem}>
          <Text style={styles.dataValue}>
            {currency}
            {formatAmount(current.amount)}
          </Text>
          <Text style={styles.dataLabel}>收益</Text>
        </View>
        <View style={styles.dataItem}>
          <Text style={styles.dataValue}>
            {currency}
            {formatAmount(current.incomplete)}
          </Text>
          <Text style={styles.dataLabel}>待结算</Text>
        </View>
        <View style={styles.dataItem}>
          <Text style={styles.dataValue}>
            {currency}
            {formatAmount(current.finish)}
          </Text>
          <Text style={styles.dataLabel}>已结算</Text>
        </View>
      </View>

      {/* 底部统计:推广订单 / 团队新增人数 / 提现金额 */}
      <View style={styles.bottomStats}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{String(current.order)}</Text>
          <Text style={styles.statLabel}>{`${tabLabel}推广订单`}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{String(current.strength)}</Text>
          <Text style={styles.statLabel}>{`${tabLabel}团队新增人数`}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {currency}
            {formatAmount(current.endAmount)}
          </Text>
          <Text style={styles.statLabel}>{`${tabLabel}提现金额`}</Text>
        </View>
      </View>

      {/* 顶部小标签(旧 API 保留) */}
      {label ? <Text style={styles.label}>{label}</Text> : null}
      {/* 主数字 + 趋势(旧 API 保留) */}
      {title !== undefined ? (
        <View style={styles.titleRow}>
          <Text style={styles.title}>
            {currency}
            {formatAmount(title)}
          </Text>
          {trend ? <Text style={[styles.trend, { color: trendColor }]}>{trendText}</Text> : null}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: tokens.surface.card,
  } as ViewStyle,
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  } as TextStyle,
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 8,
  } as ViewStyle,
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: tokens.text.primary,
  } as TextStyle,
  trend: {
    fontSize: 12,
    marginLeft: 8,
  } as TextStyle,
  // ── Tab 切换(对齐原项目 tab-switcher) ──
  tabSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  } as ViewStyle,
  tabItemWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,
  tabItem: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  } as ViewStyle,
  tabItemActive: {
    backgroundColor: tokens.brand.DEFAULT,
  } as ViewStyle,
  tabItemPressed: {
    opacity: 0.7,
  } as ViewStyle,
  tabText: {
    fontSize: 13,
    color: tokens.text.secondary,
  } as TextStyle,
  tabTextActive: {
    color: tokens.surface.light,
    fontWeight: '600',
  } as TextStyle,
  tabDivider: {
    width: 1,
    height: 14,
    backgroundColor: tokens.border.light,
  } as ViewStyle,
  // ── 数据行 ──
  dataRow: {
    flexDirection: 'row',
    marginBottom: 12,
  } as ViewStyle,
  dataItem: {
    flex: 1,
    alignItems: 'center',
  } as ViewStyle,
  dataValue: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.text.primary,
  } as TextStyle,
  dataLabel: {
    fontSize: 12,
    color: tokens.text.secondary,
    marginTop: 2,
  } as TextStyle,
  // ── 底部统计 ──
  bottomStats: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: tokens.border.light,
    paddingTop: 12,
  } as ViewStyle,
  statItem: {
    flex: 1,
    alignItems: 'center',
  } as ViewStyle,
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.text.primary,
  } as TextStyle,
  statLabel: {
    fontSize: 11,
    color: tokens.text.tertiary,
    marginTop: 2,
  } as TextStyle,
})
