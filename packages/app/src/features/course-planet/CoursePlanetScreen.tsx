import { useMemo } from 'react'
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { TFunction } from '../../types'

export interface CoursePlanetScreenProps {
  t: TFunction
  data: {
    hot: { id: string; title: string; coverImage?: string; price: number; isFree: boolean }[]
    beginner: { id: string; title: string; coverImage?: string; price: number; isFree: boolean }[]
    selected: { id: string; title: string; coverImage?: string; price: number; isFree: boolean }[]
  }
  loading: boolean
  refreshing: boolean
  error: string
  selectedType: 'all' | 'free' | 'paid'
  onTypeChange: (type: 'all' | 'free' | 'paid') => void
  onCoursePress: (id: string) => void
  onRefresh: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

const TYPE_TABS = [
  { key: 'all', label: '全部' },
  { key: 'free', label: '免费' },
  { key: 'paid', label: '付费' },
] as const

export function CoursePlanetScreen({
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
          <Text style={styles.courseCoverEmoji}>📚</Text>
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
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>返回</Text>
        </TouchableOpacity>
        <Text style={styles.title}>课程星球</Text>
      </View>
      {error ? (
        <View style={styles.centerWrap}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
            <Text style={styles.retryText}>重试</Text>
          </TouchableOpacity>
        </View>
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
            <View style={styles.centerWrap}>
              <Text style={styles.loadingText}>加载中...</Text>
            </View>
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
                  <View style={styles.centerWrap}>
                    <Text style={styles.emptyText}>暂无课程</Text>
                  </View>
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
      paddingHorizontal: 16,
      paddingTop: 48,
      paddingBottom: 12,
      gap: 12,
    },
    backText: { fontSize: 14, color: tk.text.medium },
    title: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    scroll: { flex: 1 },
    centerWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    loadingText: { fontSize: 14, color: tk.text.secondary },
    errorText: { fontSize: 14, color: tk.danger.DEFAULT, textAlign: 'center' },
    retryBtn: {
      marginTop: 12,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: tk.brand.DEFAULT,
    },
    retryText: { fontSize: 13, fontWeight: '600', color: tk.surface.light },
    typeTabsRow: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 8,
    },
    typeTab: {
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: tk.surface.card,
    },
    typeTabActive: {
      backgroundColor: tk.brand.DEFAULT,
    },
    typeTabText: {
      fontSize: 13,
      color: tk.text.secondary,
    },
    typeTabTextActive: {
      color: tk.surface.light,
      fontWeight: '600',
    },
    section: {
      paddingHorizontal: 16,
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: tk.text.primary,
      marginBottom: 12,
    },
    horizontalList: {
      flexDirection: 'row',
      gap: 12,
    },
    verticalList: {
      gap: 12,
    },
    courseCard: {
      width: 140,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: tk.surface.card,
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
      padding: 10,
      gap: 6,
    },
    courseTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: tk.text.primary,
      lineHeight: 18,
    },
    coursePrice: {
      fontSize: 13,
      fontWeight: '700',
      color: tk.brand.DEFAULT,
    },
    emptyText: { fontSize: 14, color: tk.text.secondary },
  })
}
