import { useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  TextInput,
  StyleSheet,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { CourseEnrollItem, CourseEnrollScreenProps } from '../../types'

/** 课程报名共享屏 — props 注入式跨端组件 */
export type { CourseEnrollItem, CourseEnrollScreenProps }

function formatPrice(item: CourseEnrollItem): string {
  if (item.isFree || item.price === 0) return ''
  return `\u00a5${item.price.toFixed(2)}`
}

export function CourseEnrollScreen({
  t,
  items,
  loading,
  refreshing,
  error,
  keyword,
  enrollingId,
  toast,
  userNickname,
  onKeywordChange,
  onSearch,
  onRefresh,
  onEnroll,
  onBack,
  colorScheme = 'light',
}: CourseEnrollScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('courseEnroll.title')}</Text>
        <Text style={styles.subtitle}>{t('courseEnroll.subtitle')}</Text>
        {userNickname ? <Text style={styles.userText}>{userNickname}</Text> : null}
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={keyword}
          onChangeText={onKeywordChange}
          placeholder={t('courseEnroll.searchPlaceholder')}
          placeholderTextColor={tk.text.tertiary}
          returnKeyType="search"
          onSubmitEditing={onSearch}
        />
        <TouchableOpacity style={styles.searchBtn} onPress={onSearch}>
          <Text style={styles.searchBtnText}>{t('common.search')}</Text>
        </TouchableOpacity>
      </View>

      {toast ? <Text style={styles.toastText}>{toast}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <FlatList<CourseEnrollItem>
        style={styles.list}
        data={items}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {loading ? t('common.loading') : t('courseEnroll.empty')}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isEnrolling = enrollingId === item.id
          const isDisabled = item.isEnrolled || isEnrolling
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                {item.isEnrolled ? (
                  <View style={styles.badgeEnrolled}>
                    <Text style={styles.badgeText}>{t('courseEnroll.enrolled')}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.cardMeta}>
                {t('courseEnroll.instructor')}:{item.instructor}
              </Text>
              <View style={styles.cardMetaRow}>
                <Text style={styles.cardMetaText}>
                  {t('courseEnroll.level')}:{item.level}
                </Text>
                <Text style={styles.cardMetaText}>
                  {t('courseEnroll.lessons')}:{item.lessonCount}
                </Text>
                <Text style={styles.cardMetaText}>
                  {t('courseEnroll.students')}:{item.studentCount}
                </Text>
              </View>
              <View style={styles.cardFooter}>
                <Text style={styles.priceText}>
                  {item.isFree ? t('courseEnroll.free') : formatPrice(item)}
                </Text>
                <TouchableOpacity
                  style={[styles.enrollBtn, isDisabled && styles.enrollBtnDisabled]}
                  onPress={() => onEnroll(item)}
                  disabled={isDisabled}
                >
                  <Text style={styles.enrollBtnText}>
                    {isEnrolling
                      ? t('common.loading')
                      : item.isEnrolled
                        ? t('courseEnroll.enrolled')
                        : t('courseEnroll.enroll')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )
        }}
      />
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
    back: { fontSize: 14, color: tk.text.secondary },
    title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: tk.text.primary },
    subtitle: { marginTop: 4, fontSize: 13, color: tk.text.secondary },
    userText: { marginTop: 4, fontSize: 11, color: tk.text.tertiary },
    searchRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
    searchInput: {
      flex: 1,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      fontSize: 14,
      color: tk.text.primary,
    },
    searchBtn: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: tk.success.DEFAULT,
    },
    searchBtnText: { color: tk.surface.light, fontSize: 14 },
    toastText: { paddingHorizontal: 16, paddingVertical: 4, fontSize: 12, color: tk.success.DEFAULT },
    errorText: { paddingHorizontal: 16, paddingVertical: 4, fontSize: 12, color: tk.danger.DEFAULT },
    list: { flex: 1, paddingHorizontal: 16 },
    empty: { paddingVertical: 40, alignItems: 'center' },
    emptyText: { fontSize: 13, color: tk.text.tertiary },
    card: {
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      marginBottom: 10,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    cardTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: tk.text.primary, marginRight: 8 },
    badgeEnrolled: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
      backgroundColor: tk.success.lighter,
    },
    badgeText: { fontSize: 11, color: tk.success.deepText },
    cardMeta: { marginTop: 4, fontSize: 12, color: tk.text.secondary },
    cardMetaRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
    cardMetaText: { fontSize: 12, color: tk.text.secondary },
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 10,
    },
    priceText: { fontSize: 16, fontWeight: '600', color: tk.success.DEFAULT },
    enrollBtn: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: tk.success.DEFAULT,
    },
    enrollBtnDisabled: { backgroundColor: tk.text.tertiary },
    enrollBtnText: { color: tk.surface.light, fontSize: 13, fontWeight: '600' },
  })
}
