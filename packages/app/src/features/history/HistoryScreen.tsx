import { useMemo } from 'react'
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { HistoryItem, HistoryScreenProps, HistoryTargetType } from '../../types'

/**
 * 浏览历史共享屏 — props 注入式跨端组件
 *
 * 平台无关:只负责渲染列表 UI + 下拉刷新 + 历史卡片渲染。
 * 平台特定(导航 / API 调用)由 wrapper 通过 props 注入。
 */

export type { HistoryItem, HistoryScreenProps, HistoryTargetType }

export function HistoryScreen({
  t,
  items,
  loading,
  refreshing,
  error,
  onRefresh,
  onPressItem,
  onBack,
  colorScheme = 'light',
}: HistoryScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const typeLabel = (targetType: HistoryTargetType) => {
    switch (targetType) {
      case 'course':
        return t('history.type.course')
      case 'article':
        return t('history.type.article')
      case 'post':
        return t('history.type.post')
      case 'note':
        return t('history.type.note')
      case 'live':
        return t('history.type.live')
      default:
        return t('history.type.course')
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('history.title')}</Text>
        <TouchableOpacity onPress={onRefresh} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.refreshText}>{t('history.refresh')}</Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{t('common.loading')}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listBody}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {items.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.muted}>{t('history.empty')}</Text>
            </View>
          ) : (
            items.map((item: HistoryItem) => (
              <TouchableOpacity
                key={item.id}
                style={styles.card}
                onPress={() => onPressItem(item)}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              >
                <View style={styles.cardHead}>
                  <Text style={styles.cardType}>{typeLabel(item.targetType)}</Text>
                  <Text style={styles.cardTime}>{item.visitedAt}</Text>
                </View>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.title}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
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
      paddingHorizontal: 10,
      paddingVertical: 12,
      gap: 12,
    },
    backText: { fontSize: 16, color: tk.text.medium },
    title: { flex: 1, fontSize: 20, fontWeight: '600', color: tk.text.primary },
    refreshText: { fontSize: 14, color: tk.success.DEFAULT },
    errorText: { paddingHorizontal: 10, fontSize: 14, color: tk.danger.DEFAULT },
    center: { alignItems: 'center', paddingVertical: 48 },
    muted: { fontSize: 14, color: tk.text.secondary, marginTop: 8 },
    listBody: { padding: 10 },
    card: {
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      marginBottom: 8,
    },
    cardHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    cardType: {
      fontSize: 10,
      fontWeight: '600',
      color: tk.success.DEFAULT,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: tk.success.light,
      overflow: 'hidden',
    },
    cardTime: { fontSize: 11, color: tk.text.tertiary, textAlign: 'right' },
    cardTitle: { fontSize: 16, fontWeight: '600', color: tk.text.primary },
  })
}
