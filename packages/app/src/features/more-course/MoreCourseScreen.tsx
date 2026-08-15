import { useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Pressable,
  StyleSheet,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { MoreCourseScreenProps } from '../../types'

/** MoreCourseScreen props re-export(单一来源 @ihui/types) */
export type { MoreCourseScreenProps }

function formatPrice(price: number, isFree: boolean): string {
  if (isFree || price <= 0) return '免费'
  return `¥${price.toFixed(2)}`
}

export function MoreCourseScreen({
  t,
  items,
  loading,
  refreshing,
  loadingMore,
  error,
  total,
  onRefresh,
  onEndReached,
  onPressItem,
  onBack,
  colorScheme = 'light',
}: MoreCourseScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const initialLoading = loading && items.length === 0 && !refreshing

  const renderCard = ({ item }: { item: (typeof items)[number] }) => (
    <Pressable
      style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
      onPress={() => onPressItem({ id: String(item.id), title: item.title })}
    >
      {item.cover ? (
        <View style={styles.cover} />
      ) : (
        <View style={[styles.cover, styles.coverFallback]}>
          <Text style={styles.coverEmoji}>📚</Text>
        </View>
      )}
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.instructor} numberOfLines={1}>
            {'讲师:' + (item.instructor || '匿名')}
          </Text>
          <Text style={styles.lessonCount}>{item.lessonCount ?? 0} 课时</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.price}>{formatPrice(item.price, item.isFree)}</Text>
          <Text style={styles.studentCount}>
            {(item.studentCount ?? 0) > 0 ? `${item.studentCount} 人学过` : ''}
          </Text>
        </View>
      </View>
    </Pressable>
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>更多课程</Text>
        {total > 0 ? <Text style={styles.countText}>{`共${total}门`}</Text> : null}
      </View>
      {initialLoading ? (
        <View style={styles.centerWrap}>
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={resolvedTheme(tk) === 'dark' ? tk.text.tertiary : tk.text.secondary}
            />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            error ? (
              <View style={styles.centerWrap}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
                  <Text style={styles.retryText}>重试</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.centerWrap}>
                <Text style={styles.emptyText}>暂无课程,敬请期待</Text>
              </View>
            )
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoading}>
                <Text style={styles.footerText}>加载更多...</Text>
              </View>
            ) : null
          }
        />
      )}
    </View>
  )
}

function resolvedTheme(tk: AppThemeTokens): 'light' | 'dark' {
  return tk.text.primary === '#000000' ? 'light' : 'dark'
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg } as ViewStyle,
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
    countText: { fontSize: 13, color: tk.text.tertiary, marginLeft: 'auto' } as TextStyle,
    listContent: { paddingHorizontal: 16, paddingVertical: 12, gap: 12 } as ViewStyle,
    card: {
      backgroundColor: tk.surface.card,
      borderRadius: 12,
      overflow: 'hidden',
    } as ViewStyle,
    cardPressed: { backgroundColor: tk.surface.muted } as ViewStyle,
    cover: { width: '100%', height: 160, backgroundColor: tk.surface.muted } as ImageStyle,
    coverFallback: {
      alignItems: 'center',
      justifyContent: 'center',
    } as ViewStyle,
    coverEmoji: { fontSize: 40 } as TextStyle,
    cardBody: { padding: 12, gap: 6 } as ViewStyle,
    cardTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: tk.text.primary,
      lineHeight: 20,
    } as TextStyle,
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    } as ViewStyle,
    instructor: { fontSize: 12, color: tk.text.medium, flex: 1 } as TextStyle,
    lessonCount: { fontSize: 12, color: tk.text.tertiary } as TextStyle,
    price: { fontSize: 14, fontWeight: '700', color: tk.warning.deep } as TextStyle,
    studentCount: { fontSize: 12, color: tk.text.tertiary } as TextStyle,
    centerWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      gap: 12,
    } as ViewStyle,
    loadingText: { fontSize: 14, color: tk.text.secondary } as TextStyle,
    errorText: { fontSize: 14, color: tk.error.text, textAlign: 'center' } as TextStyle,
    retryBtn: {
      marginTop: 12,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: tk.brand.DEFAULT,
    } as ViewStyle,
    retryText: { fontSize: 13, fontWeight: '600', color: tk.surface.light } as TextStyle,
    emptyText: { fontSize: 14, color: tk.text.secondary } as TextStyle,
    footerLoading: { paddingVertical: 12, alignItems: 'center' } as ViewStyle,
    footerText: { fontSize: 12, color: tk.text.secondary } as TextStyle,
  })
}
