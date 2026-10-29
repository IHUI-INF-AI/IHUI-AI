// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { BookOpen } from 'lucide-react-native'
import { BackChevron } from '../../components/BackChevron'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { EmptyState, ErrorState, ScreenSkeleton } from '../../components/ScreenStates'
import type { CoursePlanetScreenProps } from '@ihui/types'
export type { CoursePlanetScreenProps }

const TYPE_TABS = [
  { key: 'all', label: '全部' },
  { key: 'free', label: '免费' },
  { key: 'paid', label: '付费' },
] as const

export function CoursePlanetScreen({
  t,
  data,
  loading,
  refreshing,
  error,
  selectedType,
  onTypeChange,
  onCoursePress,
  onRefresh,
  onBack,
  colorScheme = 'light',
}: CoursePlanetScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const renderCourse = (course: {
    id: string
    title: string
    coverImage?: string
    price: number
    isFree: boolean
  }) => (
    <TouchableOpacity
      key={course.id}
      style={styles.courseCard}
      onPress={() => onCoursePress(course.id)}
      activeOpacity={0.7}
    >
      <View style={styles.courseCover}>
        {course.coverImage ? (
          <View style={styles.courseCoverPlaceholder} />
        ) : (
          <BookOpen size={32} color={tk.text.medium} />
        )}
      </View>
      <View style={styles.courseInfo}>
        <Text style={styles.courseTitle} numberOfLines={2}>
          {course.title}
        </Text>
        <Text style={styles.coursePrice}>
          {course.isFree || course.price <= 0 ? '免费' : `¥${course.price.toFixed(2)}`}
        </Text>
      </View>
    </TouchableOpacity>
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>课程星球</Text>
      </View>
      {error ? (
        <ErrorState
          message={error}
          onRetry={onRefresh}
          retryLabel="重试"
          colorScheme={colorScheme}
        />
      ) : (
        <ScrollView
          style={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={tk.text.tertiary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.typeTabsRow}>
            {TYPE_TABS.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.typeTab, selectedType === tab.key && styles.typeTabActive]}
                onPress={() => onTypeChange(tab.key)}
              >
                <Text
                  style={[styles.typeTabText, selectedType === tab.key && styles.typeTabTextActive]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {loading ? (
            <ScreenSkeleton variant="card" count={4} colorScheme={colorScheme} />
          ) : (
            <>
              {data.hot.length > 0 && (selectedType === 'all' || selectedType === 'paid') && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>热门课程</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.horizontalList}>{data.hot.map(renderCourse)}</View>
                  </ScrollView>
                </View>
              )}
              {data.beginner.length > 0 && selectedType === 'all' && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>新手推荐</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.horizontalList}>{data.beginner.map(renderCourse)}</View>
                  </ScrollView>
                </View>
              )}
              {data.selected.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>精选课程</Text>
                  <View style={styles.verticalList}>
                    {data.selected.map((c) => (
                      <View key={c.id}>{renderCourse(c)}</View>
                    ))}
                  </View>
                </View>
              )}
              {data.hot.length === 0 &&
                data.beginner.length === 0 &&
                data.selected.length === 0 && (
                  <EmptyState title="暂无课程" colorScheme={colorScheme} />
                )}
            </>
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
      paddingBottom: rnSpacing.md,
      gap: rnSpacing.md,
    },
    title: { fontSize: rnType.heading.size, fontWeight: '600', color: tk.text.primary },
    scroll: { flex: 1 },
    typeTabsRow: {
      flexDirection: 'row',
      paddingHorizontal: 10,
      paddingVertical: rnSpacing.md,
      gap: rnSpacing.sm,
    },
    typeTab: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: rnRadius.xl,
      backgroundColor: tk.surface.card,
    },
    typeTabActive: {
      backgroundColor: tk.brand.cta,
    },
    typeTabText: {
      fontSize: rnType.body.size,
      color: tk.text.secondary,
    },
    typeTabTextActive: {
      color: tk.surface.light,
      fontWeight: '600',
    },
    section: {
      paddingHorizontal: 10,
      marginBottom: rnSpacing.lg,
    },
    sectionTitle: {
      fontSize: rnType.subtitle.size,
      fontWeight: '600',
      color: tk.text.primary,
      marginBottom: rnSpacing.md,
    },
    horizontalList: {
      flexDirection: 'row',
      gap: rnSpacing.md,
    },
    verticalList: {
      gap: rnSpacing.md,
    },
    courseCard: {
      width: 140,
      borderRadius: rnRadius.lg,
      overflow: 'hidden',
      backgroundColor: tk.surface.light,
    },
    courseCover: {
      width: '100%',
      height: 100,
      backgroundColor: tk.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    courseCoverPlaceholder: {
      width: '100%',
      height: '100%',
      backgroundColor: tk.border.light,
    },
    courseCoverEmoji: { fontSize: 32 },
    courseInfo: {
      padding: rnSpacing.md,
      gap: 6,
    },
    courseTitle: {
      fontSize: rnType.body.size,
      fontWeight: '600',
      color: tk.text.primary,
      lineHeight: 18,
    },
    coursePrice: {
      fontSize: rnType.title.size,
      fontWeight: '700',
      color: tk.brand.DEFAULT,
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
