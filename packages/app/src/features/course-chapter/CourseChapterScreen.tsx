import { useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { CourseChapterItem, CourseChapterScreenProps } from '../../types'

/** 课程章节共享屏 — props 注入式跨端组件 */
export type { CourseChapterItem, CourseChapterScreenProps }

export function CourseChapterScreen({
  t,
  items,
  loading,
  error,
  onPressItem,
  onBack,
  colorScheme = 'light',
}: CourseChapterScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <TouchableOpacity style={styles.btn} onPress={onBack}>
          <Text style={styles.btnText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>{t('common.back')}</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{t('courseChapter.title')}</Text>
      <FlatList<CourseChapterItem>
        data={items}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.muted}>{t('common.empty')}</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <TouchableOpacity style={styles.card} onPress={() => onPressItem(item)}>
            <Text style={styles.idx}>{index + 1}</Text>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.meta}>
                {t('courseChapter.lessons', { count: item.lessonCount })} · {item.duration}min
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg, paddingHorizontal: 16, paddingTop: 48 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: tk.surface.bg, padding: 16 },
    muted: { marginTop: 8, fontSize: 13, color: tk.text.secondary },
    error: { fontSize: 13, color: tk.danger.DEFAULT, marginBottom: 8, textAlign: 'center' },
    back: { fontSize: 14, color: tk.text.secondary },
    title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: tk.text.primary, marginBottom: 12 },
    empty: { paddingVertical: 40, alignItems: 'center' },
    card: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: tk.border.light, marginBottom: 8 },
    idx: { width: 28, fontSize: 14, fontWeight: '600', color: tk.success.DEFAULT },
    cardBody: { flex: 1 },
    cardTitle: { fontSize: 14, fontWeight: '500', color: tk.text.primary },
    meta: { marginTop: 2, fontSize: 11, color: tk.text.tertiary },
    btn: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: tk.success.DEFAULT },
    btnText: { color: tk.surface.light, fontSize: 14 },
  })
}
