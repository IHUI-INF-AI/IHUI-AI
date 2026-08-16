import { useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Image,
  StyleSheet,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { RankingItem, RankingRange, RankingScreenProps } from '../../types'

/** 排行榜/Props 类型 re-export(单一来源 @ihui/types) */
export type { RankingItem, RankingRange, RankingScreenProps }

const RANGES: RankingRange[] = ['weekly', 'monthly', 'allTime']

const RANGE_KEYS: Record<RankingRange, string> = {
  weekly: 'ranking.range_weekly',
  monthly: 'ranking.range_monthly',
  allTime: 'ranking.range_allTime',
}

/** 取昵称首字符(用作头像占位文字) */
function initials(name: string): string {
  if (!name) return '?'
  return name.slice(0, 1).toUpperCase()
}

/**
 * 排行榜共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header + range 切换 + top3 颁奖台 + 剩余列表 + 下拉刷新。
 * 平台特定(导航 / API 调用 / 当前用户匹配 isMe)由 wrapper 通过 props 注入。
 */
export function RankingScreen({
  t,
  top3,
  rest,
  range,
  onSelectRange,
  loading,
  refreshing,
  error,
  onRefresh,
  onBack,
  colorScheme = 'light',
}: RankingScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const rankColor = (rank: number) => {
    if (rank === 1) return tk.warning.amber
    if (rank === 2) return tk.text.tertiary
    if (rank === 3) return tk.warning.amberText
    return tk.text.secondary
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>{t('common.loading')}</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('ranking.title')}</Text>
        <Text style={styles.subtitle}>{t('ranking.subtitle')}</Text>
      </View>

      <View style={styles.tabs}>
        {RANGES.map((r) => {
          const active = r === range
          return (
            <TouchableOpacity
              key={r}
              onPress={() => onSelectRange(r)}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {t(RANGE_KEYS[r]!)}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={onRefresh}>
            <Text style={styles.retryText}>{t('ranking.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {top3.length > 0 ? (
        <View style={styles.podiumRow}>
          {top3.map((item) => (
            <View key={item.id} style={[styles.podiumItem, item.rank === 1 && styles.podiumFirst]}>
              <View style={[styles.podiumAvatar, { borderColor: rankColor(item.rank) }]}>
                {item.avatar ? (
                  <Image source={{ uri: item.avatar }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarInitial}>{initials(item.nickname)}</Text>
                )}
              </View>
              <Text style={styles.podiumName} numberOfLines={1}>
                {item.nickname || t('ranking.anonymous')}
              </Text>
              <Text style={styles.podiumPoints}>{item.points}</Text>
              <View style={[styles.rankBadge, { backgroundColor: rankColor(item.rank) }]}>
                <Text style={styles.rankBadgeText}>#{item.rank}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <FlatList<RankingItem>
        data={rest}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listBody}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>{t('ranking.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, item.isMe && styles.cardMe]}>
            <Text style={[styles.rankText, { color: rankColor(item.rank) }]}>#{item.rank}</Text>
            <View style={[styles.listAvatar, { borderColor: rankColor(item.rank) }]}>
              {item.avatar ? (
                <Image source={{ uri: item.avatar }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarInitial}>{initials(item.nickname)}</Text>
              )}
            </View>
            <View style={styles.listInfo}>
              <Text style={styles.listName} numberOfLines={1}>
                {item.nickname || t('ranking.anonymous')}
                {item.isMe ? ` (${t('ranking.me')})` : ''}
              </Text>
              <Text style={styles.listMeta}>
                {t('ranking.studyHours', { count: item.studyHours })}
              </Text>
            </View>
            <Text style={styles.listPoints}>{item.points}</Text>
          </View>
        )}
      />
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 32 },
    emptyText: { fontSize: 14, color: tk.text.tertiary, marginTop: 8 },
    header: { paddingHorizontal: 10, paddingTop: 48, paddingBottom: 8 },
    backBtn: { marginBottom: 8 },
    backText: { fontSize: 16, color: tk.text.secondary },
    title: { fontSize: 24, fontWeight: '700', color: tk.text.primary },
    subtitle: { marginTop: 8, fontSize: 14, color: tk.text.secondary },
    tabs: { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 8, gap: 6 },
    tab: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: tk.surface.card,
    },
    tabActive: { backgroundColor: tk.brand.DEFAULT },
    tabText: { fontSize: 14, color: tk.text.secondary },
    tabTextActive: { color: tk.surface.light },
    errorBar: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    errorText: { fontSize: 14, color: tk.danger.DEFAULT },
    retryText: { fontSize: 14, color: tk.success.DEFAULT },
    podiumRow: { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 12, gap: 8 },
    podiumItem: {
      flex: 1,
      alignItems: 'center',
      padding: 14,
      borderRadius: 12,
      backgroundColor: tk.surface.muted,
    },
    podiumFirst: { backgroundColor: tk.warning.amberLight },
    podiumAvatar: {
      width: 48, height: 48, borderRadius: 24,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.bg,
      overflow: 'hidden',
    },
    avatarImg: { width: '100%', height: '100%', borderRadius: 8 },
    avatarInitial: { fontSize: 22, fontWeight: '600', color: tk.text.secondary },
    podiumName: { marginTop: 8, fontSize: 14, fontWeight: '600', color: tk.text.primary },
    podiumPoints: { marginTop: 8, fontSize: 14, color: tk.success.DEFAULT },
    rankBadge: { marginTop: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
    rankBadgeText: { fontSize: 11, color: tk.surface.light },
    listBody: { padding: 14, paddingBottom: 32 },
    separator: { height: 8 },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.bg,
    },
    cardMe: { borderColor: tk.success.DEFAULT, backgroundColor: tk.success.light },
    rankText: { width: 36, fontSize: 16, fontWeight: '700' },
    listAvatar: {
      width: 44, height: 44, borderRadius: 22,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.muted,
      overflow: 'hidden',
    },
    listInfo: { flex: 1, marginLeft: 10, marginRight: 8 },
    listName: { fontSize: 16, fontWeight: '600', color: tk.text.primary },
    listMeta: { marginTop: 8, fontSize: 11, color: tk.text.tertiary },
    listPoints: { fontSize: 16, fontWeight: '700', color: tk.success.DEFAULT },
  })
}
