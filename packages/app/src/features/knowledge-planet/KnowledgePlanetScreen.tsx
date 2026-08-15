import { useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, type TextStyle, type ViewStyle } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { TFunction } from '../../types'

export interface KnowledgePlanetScreenProps {
  t: TFunction
  items: { id: string; title: string; cover?: string; summary?: string; createdAt: number }[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onItemClick: (id: string) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

export function KnowledgePlanetScreen({
  t,
  items,
  loading,
  refreshing,
  error,
  onRefresh,
  onItemClick,
  onBack,
  colorScheme = 'light',
}: KnowledgePlanetScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const formatDate = (ts: number) => {
    const d = new Date(ts)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>返回</Text>
        </TouchableOpacity>
        <Text style={styles.title}>知识星球</Text>
      </View>
      {loading ? (
        <View style={styles.centerWrap}>
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerWrap}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
            <Text style={styles.retryText}>重试</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.flex}>
          {items.length === 0 ? (
            <View style={styles.centerWrap}>
              <Text style={styles.emptyText}>暂无内容</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {items.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.itemCard}
                  onPress={() => onItemClick(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.itemCover}>
                    {item.cover ? (
                      <View style={styles.itemCoverImage} />
                    ) : (
                      <Text style={styles.itemCoverEmoji}>📰</Text>
                    )}
                  </View>
                  <View style={styles.itemBody}>
                    <Text style={styles.itemTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                    {item.summary ? (
                      <Text style={styles.itemSummary} numberOfLines={1}>
                        {item.summary}
                      </Text>
                    ) : null}
                    <Text style={styles.itemDate}>{formatDate(item.createdAt)}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
    } as ViewStyle,
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 48,
      paddingBottom: 12,
      gap: 12,
    },
    backText: { fontSize: 14, color: tk.text.medium } as TextStyle,
    title: { fontSize: 18, fontWeight: '600', color: tk.text.primary } as TextStyle,
    flex: { flex: 1 } as ViewStyle,
    centerWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      gap: 12,
    } as ViewStyle,
    loadingText: { fontSize: 14, color: tk.text.secondary } as TextStyle,
    errorText: {
      fontSize: 14,
      lineHeight: 18,
      color: tk.error.text,
      textAlign: 'center',
    } as TextStyle,
    retryBtn: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: tk.brand.DEFAULT,
    } as ViewStyle,
    retryText: { fontSize: 13, fontWeight: '600', color: tk.surface.light } as TextStyle,
    list: {
      paddingHorizontal: 16,
      paddingBottom: 24,
      gap: 12,
    } as ViewStyle,
    itemCard: {
      flexDirection: 'row',
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: tk.surface.card,
      gap: 12,
    } as ViewStyle,
    itemCover: {
      width: 120,
      height: 90,
      backgroundColor: tk.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
    } as ViewStyle,
    itemCoverImage: {
      width: '100%',
      height: '100%',
      backgroundColor: tk.border.light,
    } as ViewStyle,
    itemCoverEmoji: { fontSize: 32 } as TextStyle,
    itemBody: { flex: 1, padding: 12, gap: 6, justifyContent: 'space-between' } as ViewStyle,
    itemTitle: { fontSize: 15, fontWeight: '600', color: tk.text.primary } as TextStyle,
    itemSummary: { fontSize: 12, color: tk.text.secondary } as TextStyle,
    itemDate: { fontSize: 11, color: tk.text.tertiary } as TextStyle,
    emptyText: { fontSize: 14, color: tk.text.secondary } as TextStyle,
  })
}
