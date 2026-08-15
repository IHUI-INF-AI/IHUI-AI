import { useMemo } from 'react'
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { RankingDetailScreenProps } from '../../types'

/** RankingDetailScreen props re-export(单一来源 @ihui/types) */
export type { RankingDetailScreenProps }

/**
 * 排行榜详情共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染详情卡片(Logo + 标题 + 排名 + 机构 + 关注度 + 简介)。
 * 平台特定(侧边 Drawer + NavBar)由 wrapper 注入渲染。
 */
export function RankingDetailScreen({
  t,
  detail,
  colorScheme = 'light',
}: RankingDetailScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <View style={styles.card}>
        <View style={styles.row1}>
          {detail.avatar ? (
            <Image source={{ uri: detail.avatar }} style={styles.logo} />
          ) : (
            <View style={[styles.logo, styles.logoFallback]}>
              <Text style={styles.logoText}>{detail.title.slice(0, 1)}</Text>
            </View>
          )}
          <View style={styles.titleDesc}>
            <Text style={styles.title} numberOfLines={1}>
              {detail.title}
            </Text>
            <Text style={styles.desc}>
              {`排名:${detail.rank} · 机构:${detail.organization} · 关注度:${detail.attention}`}
            </Text>
          </View>
        </View>
        <View style={styles.row2}>
          <View style={styles.metric}>
            <Text style={[styles.metricLabel, { color: tk.text.tertiary }]}>
              {t('rankingDetail.attention') || '关注度'}
            </Text>
            <Text style={[styles.metricValue, { color: tk.text.primary }]} numberOfLines={1}>
              {String(detail.attention)}
            </Text>
          </View>
          <View style={styles.metric}>
            <Text style={[styles.metricLabel, { color: tk.text.tertiary }]}>
              {t('rankingDetail.rank') || '排名'}
            </Text>
            <Text
              style={[styles.metricValue, { color: tk.text.primary }]}
              numberOfLines={1}
            >{`第${detail.rank}名`}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={[styles.metricLabel, { color: tk.text.tertiary }]}>
              {t('rankingDetail.organization') || '机构'}
            </Text>
            <Text style={[styles.metricValue, { color: tk.text.primary }]} numberOfLines={1}>
              {detail.organization}
            </Text>
          </View>
        </View>
        {detail.context ? (
          <View style={styles.contextBox}>
            <Text style={styles.contextText}>{detail.context}</Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    scroll: { flex: 1 },
    scrollContent: { padding: 16 },
    card: { backgroundColor: tk.surface.light, borderRadius: 12, padding: 16, gap: 16 },
    row1: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    logo: { width: 64, height: 64, borderRadius: 12, backgroundColor: tk.surface.muted },
    logoFallback: { alignItems: 'center', justifyContent: 'center' },
    logoText: { fontSize: 24, fontWeight: '700', color: tk.text.primary },
    titleDesc: { flex: 1, gap: 6 },
    title: { fontSize: 16, fontWeight: '700', color: tk.text.primary },
    desc: { fontSize: 12, color: tk.text.secondary, lineHeight: 18 },
    row2: { flexDirection: 'row', gap: 8 },
    metric: {
      flex: 1,
      backgroundColor: tk.surface.muted,
      borderRadius: 8,
      paddingVertical: 10,
      alignItems: 'center',
      gap: 4,
    },
    metricLabel: { fontSize: 11 },
    metricValue: { fontSize: 13, fontWeight: '600' },
    contextBox: { backgroundColor: tk.surface.muted, borderRadius: 8, padding: 12 },
    contextText: { fontSize: 13, color: tk.text.medium, lineHeight: 20 },
  })
}
