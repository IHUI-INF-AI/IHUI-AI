// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { Newspaper } from 'lucide-react-native'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ErrorState, ScreenSkeleton } from '../../components/ScreenStates'

import { rnRadius } from '@ihui/design-tokens'
import type { KnowledgePlanetScreenProps } from '@ihui/types'
export type { KnowledgePlanetScreenProps }

export function KnowledgePlanetScreen({
  t,
  items,
  loading,
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
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>知识星球</Text>
      </View>
      {loading ? (
        <ScreenSkeleton variant="list" count={4} colorScheme={colorScheme} />
      ) : error ? (
        <ErrorState message={error} onRetry={onRefresh} colorScheme={colorScheme} />
      ) : (
        <View style={styles.flex}>
          {items.length === 0 ? (
            <EmptyState title="暂无内容" colorScheme={colorScheme} />
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
                      <Newspaper size={32} color={tk.text.medium} />
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
      paddingHorizontal: 10,
      paddingBottom: 12,
      gap: 12,
    },
    title: { fontSize: 20, fontWeight: '600', color: tk.text.primary } as TextStyle,
    flex: { flex: 1 } as ViewStyle,
    list: {
      paddingHorizontal: 10,
      paddingBottom: 24,
      gap: 12,
    } as ViewStyle,
    itemCard: {
      flexDirection: 'row',
      borderRadius: rnRadius.lg,
      overflow: 'hidden',
      backgroundColor: tk.surface.light,
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
    itemBody: { flex: 1, padding: 12, gap: 6, justifyContent: 'space-between' } as ViewStyle,
    itemTitle: { fontSize: 18, fontWeight: '700', color: tk.text.primary } as TextStyle,
    itemSummary: { fontSize: 14, color: tk.text.secondary } as TextStyle,
    itemDate: { fontSize: 11, color: tk.text.tertiary } as TextStyle,
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
