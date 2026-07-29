import { useMemo } from 'react'
import {
  FlatList,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { CourseScreenProps } from '../../types'

/** 课程列表共享屏 — props 注入式跨端组件(纯 UI,不依赖平台 API) */
export type { CourseScreenProps }

export function CourseScreen({
  t,
  items,
  keyword,
  loading,
  error,
  page,
  totalPages,
  onKeywordChange,
  onPageChange,
  onPressItem,
  colorScheme = 'light',
}: CourseScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('courseScreen.title')}</Text>
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.input}
          value={keyword}
          onChangeText={onKeywordChange}
          placeholder={t('courseScreen.searchPlaceholder')}
          placeholderTextColor={tk.text.tertiary}
          returnKeyType="search"
        />
      </View>

      {error ? (
        <View style={styles.errorWrap}>
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          loading ? (
            <View style={styles.empty}>
              <Text style={styles.muted}>{t('common.loading')}</Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.muted}>{t('courseScreen.empty')}</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => onPressItem(item.id)}
            activeOpacity={0.7}
            style={styles.card}
          >
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>{item.instructor}</Text>
              <Text style={styles.metaText}>{item.level}</Text>
            </View>
            {item.description ? (
              <Text style={styles.cardDesc} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}
            <View style={styles.footerRow}>
              <Text style={styles.price}>
                {item.isFree ? t('courseScreen.free') : `¥${item.price.toFixed(2)}`}
              </Text>
              <Text style={styles.metaText}>
                {t('courseScreen.studentCount', { count: item.studentCount })}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListFooterComponent={
          totalPages > 1 ? (
            <View style={styles.pagination}>
              <Pressable
                onPress={() => onPageChange(Math.max(1, page - 1))}
                disabled={page <= 1}
                hitSlop={8}
              >
                <Text style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}>
                  {t('common.back')}
                </Text>
              </Pressable>
              <Text style={styles.pageIndicator}>
                {page} / {totalPages}
              </Text>
              <Pressable
                onPress={() => onPageChange(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                hitSlop={8}
              >
                <Text style={[styles.pageBtn, page >= totalPages && styles.pageBtnDisabled]}>
                  {t('courseScreen.nextPage')}
                </Text>
              </Pressable>
            </View>
          ) : null
        }
      />
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    title: {
      paddingHorizontal: 16,
      paddingTop: 48,
      paddingBottom: 8,
      fontSize: 22,
      fontWeight: '600',
      color: tk.text.primary,
    },
    searchWrap: { paddingHorizontal: 16, paddingVertical: 12, marginBottom: 4 },
    input: {
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: 8,
      backgroundColor: tk.surface.muted,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 14,
      color: tk.text.primary,
    },
    errorWrap: { paddingHorizontal: 16, paddingVertical: 8 },
    error: { fontSize: 13, color: tk.danger.DEFAULT },
    empty: { alignItems: 'center', paddingVertical: 48 },
    muted: { fontSize: 13, color: tk.text.secondary },
    card: {
      padding: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    cardTitle: { fontSize: 16, fontWeight: '600', color: tk.text.primary },
    metaRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
    metaText: { fontSize: 12, color: tk.text.secondary },
    cardDesc: { marginTop: 8, fontSize: 13, color: tk.text.secondary },
    footerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    price: { fontSize: 14, fontWeight: '600', color: tk.success.DEFAULT },
    pagination: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 16,
    },
    pageBtn: { fontSize: 14, color: tk.text.primary },
    pageBtnDisabled: { opacity: 0.4 },
    pageIndicator: { fontSize: 12, color: tk.text.secondary },
  })
}
