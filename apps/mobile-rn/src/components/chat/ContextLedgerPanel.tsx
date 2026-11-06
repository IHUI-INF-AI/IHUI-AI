// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 七类上下文账本面板(批次 3,2026-11-06)。
 *
 * 挂在现有 ContextUsagePanel 下方:后者回答"缓存命中/总量",这里回答"这一轮的上下文被谁占了"。
 * 纪律:
 *  - 七类必须按契约固定顺序渲染(顺序与齐全性由 `orderContextLedgerCategories` 校验,不齐就整块不渲染);
 *  - free_space 用中性色(它是"剩余容量",不是一类开销);auto_compact 用警示色(预留容量被占用);
 *  - 已用/限额/百分比全部取服务端字段,端内不重算除法(压缩分母与百分比裁剪各有守门);
 *  - 面板默认收起,点标题展开;查询失败时上层保持 ledger 为 null,本组件零占位。
 */
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { rnGeometry, rnRadius } from '@ihui/design-tokens'
import type { ContextLedger, ContextLedgerCategory } from '@ihui/shared'
import { formatTokenCount } from '@ihui/shared/utils/format'
import {
  CONTEXT_LEDGER_LABELS,
  contextLedgerIdentity,
  contextLedgerTokenizerLabel,
  orderContextLedgerCategories,
} from '../../utils/context-ledger'
import { tokens } from '../../theme/active-tokens'
import { rpx } from '../../utils/rpx'

export interface ContextLedgerPanelProps {
  ledger: ContextLedger
  /** 轮次下标(0 起;查询面缺省 0 时按第一轮展示) */
  turnIndex: number
}

function categoryColor(category: ContextLedgerCategory): string {
  switch (category) {
    case 'system_prompt':
      return tokens.brand.DEFAULT
    case 'system_tools':
      return tokens.warning.amber
    case 'skills':
      return tokens.brandAccent.deep
    case 'messages':
      return tokens.success.DEFAULT
    case 'other':
      return tokens.text.secondary
    case 'free_space':
      // 中性色:剩余容量不属于任何一类开销
      return tokens.text.tertiary
    case 'auto_compact':
      return tokens.danger.DEFAULT
  }
}

function formatPercent(percent: number): string {
  return Number.isInteger(percent) ? `${percent}%` : `${percent.toFixed(1)}%`
}

export function ContextLedgerPanel({ ledger, turnIndex }: ContextLedgerPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const rows = orderContextLedgerCategories(ledger.categories)
  if (!rows) return null
  const identity = contextLedgerIdentity(ledger)
  const turnLabel = `第 ${turnIndex + 1} 轮`
  return (
    <View style={styles.card} testID="context-ledger-panel">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={styles.header}
        onPress={() => setExpanded((value) => !value)}
      >
        <View style={styles.headerText}>
          <Text style={styles.title}>上下文账本 · {turnLabel}</Text>
          <Text style={styles.summary}>
            {`已用 ${formatTokenCount(ledger.usedTokens)} / ${formatTokenCount(ledger.contextLimit)} tokens · ${formatPercent(ledger.percentage)} · ${contextLedgerTokenizerLabel(ledger.tokenizer)}`}
          </Text>
        </View>
        <Text style={styles.toggle}>{expanded ? '收起' : '展开'}</Text>
      </Pressable>
      {expanded ? (
        <View style={styles.body}>
          {rows.map((row) => (
            <View key={row.category} style={styles.row}>
              <View style={[styles.dot, { backgroundColor: categoryColor(row.category) }]} />
              <Text style={styles.label}>{CONTEXT_LEDGER_LABELS[row.category]}</Text>
              <Text style={styles.tokens}>{formatTokenCount(row.tokens)}</Text>
              <Text style={styles.percent}>{formatPercent(row.percent)}</Text>
            </View>
          ))}
          {identity && (!identity.usedMatches || !identity.balanceMatches) ? (
            <Text style={styles.warn}>账本口径校验未通过,以上数据仅供粗看。</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: rpx(24),
    marginBottom: rpx(8),
    paddingHorizontal: rpx(20),
    paddingVertical: rpx(14),
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.surface.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.surface.muted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: rpx(12),
  },
  headerText: {
    flex: 1,
    gap: rpx(4),
  },
  title: {
    fontSize: rnGeometry.textCaption,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  summary: {
    fontSize: rnGeometry.textCaption,
    color: tokens.text.secondary,
  },
  toggle: {
    fontSize: rnGeometry.textCaption,
    color: tokens.brandAccent.deep,
  },
  body: {
    marginTop: rpx(12),
    gap: rpx(8),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rpx(8),
  },
  dot: {
    width: rpx(10),
    height: rpx(10),
    borderRadius: rpx(5),
  },
  label: {
    flex: 1,
    fontSize: rnGeometry.textCaption,
    color: tokens.text.primary,
  },
  tokens: {
    fontSize: rnGeometry.textCaption,
    color: tokens.text.secondary,
  },
  percent: {
    minWidth: rpx(80),
    textAlign: 'right',
    fontSize: rnGeometry.textCaption,
    color: tokens.text.secondary,
  },
  warn: {
    marginTop: rpx(4),
    fontSize: rnGeometry.textCaption,
    color: tokens.warning.amberText,
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
