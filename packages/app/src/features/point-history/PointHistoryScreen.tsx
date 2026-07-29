import { useMemo } from 'react'
import { View, Text, TouchableOpacity, FlatList, RefreshControl, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { PointHistoryItem, PointHistoryScreenProps } from '../../types'

/** 积分历史/Props 类型 re-export(单一来源 @ihui/types) */
export type { PointHistoryItem, PointHistoryScreenProps }

/**
 * 积分历史共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header(返回 + 标题)+ 错误提示(可选)+ loading 态
 * + 积分卡片列表(action + points[正数绿/负数红] + balance + createdAt)
 * + 下拉刷新 + 空态。
 * 平台特定(导航 / API 调用)由 wrapper 通过 props 注入。
 */
export function PointHistoryScreen({
  t,
  items,
  loading,
  refreshing,
  error,
  onRefresh,
  onBack,
  colorScheme = 'light',
}: PointHistoryScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('pointHistory.title')}</Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{t('common.loading')}</Text>
        </View>
      ) : (
        <FlatList<PointHistoryItem>
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listBody}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.muted}>{t('pointHistory.empty')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.titleRow}>
                <Text style={styles.cardAction} numberOfLines={1}>
                  {item.action}
                </Text>
                <Text
                  style={[
                    styles.cardPoints,
                    item.points < 0 ? styles.pointsNegative : styles.pointsPositive,
                  ]}
                >
                  {item.points > 0 ? '+' : ''}
                  {item.points}
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.cardMeta}>
                  {t('pointHistory.balance')}: {item.balance}
                </Text>
                <Text style={styles.cardTime}>{item.createdAt}</Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    backText: { fontSize: 14, color: tk.text.medium },
    title: { flex: 1, fontSize: 18, fontWeight: '600', color: tk.text.primary },
    errorText: { paddingHorizontal: 16, fontSize: 12, color: tk.danger.DEFAULT },
    center: { alignItems: 'center', paddingVertical: 48 },
    muted: { fontSize: 12, color: tk.text.secondary, marginTop: 8 },
    listBody: { padding: 16 },
    separator: { height: 8 },
    card: {
      padding: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    titleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    cardAction: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: tk.text.primary,
      marginRight: 8,
    },
    cardPoints: { fontSize: 14, fontWeight: '600' },
    pointsPositive: { color: tk.success.DEFAULT },
    pointsNegative: { color: tk.danger.DEFAULT },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 6,
    },
    cardMeta: { fontSize: 11, color: tk.text.secondary },
    cardTime: { fontSize: 11, color: tk.text.tertiary },
  })
}
