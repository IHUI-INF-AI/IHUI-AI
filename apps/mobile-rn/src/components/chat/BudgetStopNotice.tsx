// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 预算硬停止内联提示条(批次 3,2026-11-06)。
 *
 * 位置:聊天消息列表尾部(`messageListSlots.orphanTailNode`),不是网络失败卡 ——
 * 请求本身是成功的,护栏是在流内主动收口。因此文案、配色、位置都与错误卡区分:
 *  - 原因码文案只取 shared 的 `budgetStopReasonText`(六值闭集 + 通用回落,三端同源);
 *  - 已用/限额/百分比直接展示服务端字段,端内不重算百分比,也不把 usagePercent>100 裁平;
 *  - 刷新/换端后由屏幕查询 `/budget-stops` 回填同一条记录,不依赖一次性 toast。
 */
import { StyleSheet, Text, View } from 'react-native'
import { rnGeometry, rnRadius } from '@ihui/design-tokens'
import { budgetStopReasonText } from '@ihui/shared/chat/budget-stop-note'
import { formatTokenCount } from '@ihui/shared/utils/format'
import type { ChatBudgetStopRow } from '../../api/chat-ledger'
import { tokens } from '../../theme/active-tokens'
import { rpx } from '../../utils/rpx'

export interface BudgetStopNoticeProps {
  stop: ChatBudgetStopRow
}

function formatPercent(percent: number): string {
  return Number.isInteger(percent) ? `${percent}%` : `${percent.toFixed(1)}%`
}

/** 用量事实行:缺哪一项就不说哪一项(不拿 0 冒充"未采集")。 */
export function budgetStopUsageText(stop: ChatBudgetStopRow): string | null {
  const parts: string[] = []
  if (stop.usedTokens !== null && stop.limitTokens !== null) {
    parts.push(
      `已用 ${formatTokenCount(stop.usedTokens)} / 限额 ${formatTokenCount(stop.limitTokens)} tokens`,
    )
  } else if (stop.usedTokens !== null) {
    parts.push(`已用 ${formatTokenCount(stop.usedTokens)} tokens`)
  } else if (stop.limitTokens !== null) {
    parts.push(`限额 ${formatTokenCount(stop.limitTokens)} tokens`)
  }
  if (stop.usagePercent !== null) parts.push(`已达 ${formatPercent(stop.usagePercent)}`)
  if (stop.remainingTokens !== null)
    parts.push(`剩余 ${formatTokenCount(stop.remainingTokens)} tokens`)
  return parts.length > 0 ? parts.join(' · ') : null
}

export function BudgetStopNotice({ stop }: BudgetStopNoticeProps) {
  const usageText = budgetStopUsageText(stop)
  return (
    <View testID="budget-stop-notice" accessibilityRole="text" style={styles.card}>
      <View style={styles.titleRow}>
        <View style={styles.dot} />
        <Text style={styles.title}>预算硬停止</Text>
      </View>
      <Text style={styles.reason}>{budgetStopReasonText(stop.reasonCode)}</Text>
      {usageText ? <Text style={styles.usage}>{usageText}</Text> : null}
      {stop.stoppedAtIteration !== null ? (
        <Text style={styles.meta}>触发于第 {stop.stoppedAtIteration} 轮迭代</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: rpx(24),
    marginVertical: rpx(12),
    paddingHorizontal: rpx(20),
    paddingVertical: rpx(16),
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.warning.light,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.warning.amber,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rpx(8),
  },
  dot: {
    width: rpx(12),
    height: rpx(12),
    borderRadius: rpx(6),
    backgroundColor: tokens.warning.amber,
  },
  title: {
    fontSize: rnGeometry.textStrong,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  reason: {
    marginTop: rpx(8),
    fontSize: rnGeometry.textBody,
    lineHeight: rpx(36),
    color: tokens.text.primary,
  },
  usage: {
    marginTop: rpx(6),
    fontSize: rnGeometry.textCaption,
    color: tokens.text.secondary,
  },
  meta: {
    marginTop: rpx(4),
    fontSize: rnGeometry.textCaption,
    color: tokens.text.tertiary,
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
