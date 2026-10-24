// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { ScrollView, Text, TouchableOpacity, View, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { CourseDetailScreenProps } from '../../types'
import {
  EmptyState,
  ErrorState,
  PressableCard,
  ScreenSkeleton,
} from '../../components/ScreenStates'

import { rnRadius } from '@ihui/design-tokens'

/**
 * 课程详情共享屏 — props 注入式跨端组件(纯 UI,不依赖平台 API)。
 *
 * 页头归属(2026-09-27,双层页头收敛,同 SettingsScreen 先例):本组件**不渲染内置页头/返回键**,
 * 页头(标题 + 返回)由宿主 NavBar 提供 —— RN 端生产页(apps/mobile-rn/src/screens/CourseDetailScreen.tsx)
 * 渲染 NavBar(标题取课程名,加载期就有返回键)。此前组件自带 BackChevron + 标题,与宿主 NavBar
 * 同屏两条返回键两个标题(守门 102 GA7 / 守门 145 DH2 判定型)。
 * onBack 仍留在 props 契约中(错误态按钮「返回」在用)。
 */
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
      <View style={styles.container}>
        <ScreenSkeleton variant="list" count={4} colorScheme={colorScheme} />
      </View>
    )
  }

  if (error || !item) {
    return (
      <ErrorState
        message={error || t('courseDetail.loadFailed')}
        onRetry={onBack}
        retryLabel={t('common.back')}
        colorScheme={colorScheme}
      />
    )
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
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
          <EmptyState title={t('common.empty')} colorScheme={colorScheme} />
        ) : (
          lessons.map((l) => (
            <PressableCard
              key={l.lessonId}
              onPress={() => onPlayLesson(l.lessonId)}
              colorScheme={colorScheme}
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
            </PressableCard>
          ))
        )}
      </View>
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    btn: {
      marginTop: 12,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
    },
    btnDisabled: { opacity: 0.5 },
    btnText: { color: tk.surface.light, fontSize: 16 },
    header: { paddingHorizontal: 10, paddingTop: 12, paddingBottom: 16 },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    tag: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
    },
    tagText: { fontSize: 12, color: tk.text.medium },
    body: { paddingHorizontal: 10 },
    card: {
      padding: 14,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    cardTitle: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    cardMeta: { marginTop: 8, fontSize: 14, color: tk.text.secondary },
    cardDesc: { marginTop: 12, fontSize: 14, color: tk.text.medium },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 12,
    },
    price: { fontSize: 20, fontWeight: '700', color: tk.brand.DEFAULT },
    enrolledBadge: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: rnRadius.md,
      backgroundColor: tk.success.lighter,
    },
    enrolledText: { fontSize: 12, color: tk.success.deepText },
    lessons: { paddingHorizontal: 10, marginTop: 16, paddingBottom: 32 },
    sectionTitle: { marginBottom: 8, fontSize: 20, fontWeight: '600', color: tk.text.primary },
    lessonItem: {
      marginBottom: 12,
      padding: 14,
      borderRadius: rnRadius.xl,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    lessonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    lessonTitle: { flex: 1, fontSize: 16, color: tk.text.primary },
    completed: { marginLeft: 8, fontSize: 12, color: tk.success.DEFAULT },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
