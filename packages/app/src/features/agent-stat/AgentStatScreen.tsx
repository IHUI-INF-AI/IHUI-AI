// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { AgentStatScreenProps } from '../../types'
import { BackChevron } from '../../components/BackChevron'
import { ErrorState, ScreenSkeleton } from '../../components/ScreenStates'

import { rnSpacing } from '@ihui/design-tokens'
/** Agent 统计共享屏 — props 注入式跨端组件(纯 UI,不依赖平台 API) */
export type { AgentStatScreenProps }

export function AgentStatScreen({
  t,
  stat,
  loading,
  error,
  onBack,
  colorScheme = 'light',
}: AgentStatScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenSkeleton variant="card" count={4} colorScheme={colorScheme} />
      </View>
    )
  }
  if (error || !stat) {
    return (
      <View style={styles.container}>
        {/* 原错误/空态只有「返回」一个动作,这里如实沿用该动作(不新增键) */}
        <ErrorState
          message={error || t('common.empty')}
          onRetry={onBack}
          retryLabel={t('common.back')}
          colorScheme={colorScheme}
        />
      </View>
    )
  }

  // 字段契约(2026-11-01):AgentStatData 全部可选 —— 后端 GET /agents/stats 只回
  // totalAgents/totalUsers/totalCalls/publishedCount/pendingCount/avgRating,
  // conversations/messages/tokens 当前无后端来源。只渲染有值的指标,避免空值卡。
  const metrics: Array<[string, string | number]> = []
  if (stat.totalAgents !== undefined)
    metrics.push([t('agentStat.totalAgents'), stat.totalAgents])
  if (stat.totalUsers !== undefined) metrics.push([t('agentStat.totalUsers'), stat.totalUsers])
  if (stat.totalCalls !== undefined) metrics.push([t('agentStat.totalCalls'), stat.totalCalls])
  if (stat.publishedCount !== undefined)
    metrics.push([t('agentStat.publishedCount'), stat.publishedCount])
  if (stat.pendingCount !== undefined)
    metrics.push([t('agentStat.pendingCount'), stat.pendingCount])
  if (stat.conversations !== undefined)
    metrics.push([t('agentStat.conversations'), stat.conversations])
  if (stat.messages !== undefined) metrics.push([t('agentStat.messages'), stat.messages])
  if (stat.tokens !== undefined) metrics.push([t('agentStat.tokens'), stat.tokens])
  if (stat.avgRating !== undefined)
    metrics.push([t('agentStat.avgRating'), stat.avgRating.toFixed(2)])

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('agentStat.title')}</Text>
      </View>
      <View style={styles.body}>
        {metrics.map(([label, value]) => (
          <View key={label} style={styles.row}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.value}>{value}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing.md,
      gap: rnSpacing.md,
    },
    body: { padding: 14 },
    title: { fontSize: 20, fontWeight: '700', color: tk.text.primary },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: rnSpacing.md,
    },
    label: { fontSize: 14, color: tk.text.secondary },
    value: { fontSize: 16, fontWeight: '600', color: tk.brand.DEFAULT, flexShrink: 0 },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
