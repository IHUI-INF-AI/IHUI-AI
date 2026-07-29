import { useMemo } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { CourseDetailScreenProps } from '../../types'

/** 课程详情共享屏 — props 注入式跨端组件(纯 UI,不依赖平台 API) */
export type { CourseDetailScreenProps }

export function CourseDetailScreen({
  t,
  item,
  lessons,
  loading,
  error,
  enrolling,
  onEnroll,
  onPlayLesson,
  onBack,
  colorScheme = 'light',
}: CourseDetailScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tk.brand.DEFAULT} />
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  }

  if (error || !item) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || t('courseDetail.loadFailed')}</Text>
        <TouchableOpacity style={styles.btn} onPress={onBack}>
          <Text style={styles.btnText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{item.title}</Text>
        <View style={styles.tagRow}>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{item.categoryName}</Text>
          </View>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{item.level}</Text>
          </View>
          <View style={styles.tag}>
            <Text style={styles.tagText}>
              {t('courseDetail.studentCount', { count: item.studentCount })}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {t('courseDetail.instructor')}：{item.instructor}
          </Text>
          <Text style={styles.cardMeta}>
            {t('courseDetail.rating')}：{item.rating.toFixed(1)}
          </Text>
          <Text style={styles.cardDesc}>{item.description}</Text>
          <View style={styles.actionRow}>
            <Text style={styles.price}>
              {item.isFree ? t('courseDetail.free') : `¥${item.price.toFixed(2)}`}
            </Text>
            {item.isEnrolled ? (
              <View style={styles.enrolledBadge}>
                <Text style={styles.enrolledText}>{t('courseDetail.enrolled')}</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.btn, enrolling && styles.btnDisabled]}
                onPress={onEnroll}
                disabled={enrolling}
              >
                <Text style={styles.btnText}>
                  {item.isFree
                    ? t('courseDetail.enroll')
                    : t('courseDetail.pay', { amount: item.price.toFixed(2) })}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      <View style={styles.lessons}>
        <Text style={styles.sectionTitle}>{t('courseDetail.lessons')}</Text>
        {lessons.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.muted}>{t('common.empty')}</Text>
          </View>
        ) : (
          lessons.map((l) => (
            <TouchableOpacity
              key={l.lessonId}
              onPress={() => onPlayLesson(l.lessonId)}
              style={styles.lessonItem}
            >
              <View style={styles.lessonRow}>
                <Text style={styles.lessonTitle} numberOfLines={1}>
                  {l.title}
                </Text>
                {l.isCompleted ? (
                  <Text style={styles.completed}>{t('courseDetail.completed')}</Text>
                ) : null}
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.bg,
      padding: 16,
    },
    muted: { marginTop: 8, fontSize: 13, color: tk.text.secondary },
    error: { fontSize: 13, color: tk.danger.DEFAULT, marginBottom: 8, textAlign: 'center' },
    btn: {
      marginTop: 12,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: tk.brand.DEFAULT,
    },
    btnDisabled: { opacity: 0.5 },
    btnText: { color: tk.surface.light, fontSize: 14 },
    header: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 16 },
    back: { fontSize: 14, color: tk.text.secondary },
    title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: tk.text.primary },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    tag: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: tk.surface.muted,
    },
    tagText: { fontSize: 12, color: tk.text.medium },
    body: { paddingHorizontal: 16 },
    card: {
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    cardTitle: { fontSize: 16, fontWeight: '600', color: tk.text.primary },
    cardMeta: { marginTop: 4, fontSize: 13, color: tk.text.secondary },
    cardDesc: { marginTop: 12, fontSize: 13, color: tk.text.medium },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 12,
    },
    price: { fontSize: 18, fontWeight: '600', color: tk.success.DEFAULT },
    enrolledBadge: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 6,
      backgroundColor: tk.success.lighter,
    },
    enrolledText: { fontSize: 12, color: tk.success.deepText },
    lessons: { paddingHorizontal: 16, marginTop: 16, paddingBottom: 32 },
    sectionTitle: { marginBottom: 8, fontSize: 18, fontWeight: '600', color: tk.text.primary },
    lessonItem: {
      marginBottom: 8,
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    lessonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    lessonTitle: { flex: 1, fontSize: 14, color: tk.text.primary },
    completed: { marginLeft: 8, fontSize: 12, color: tk.success.DEFAULT },
  })
}
