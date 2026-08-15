import { useMemo } from 'react'
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { TFunction } from '../../types'

/** 课程分类(对齐 Uniapp learn.vue) */
export interface CourseCategory {
  id: string
  name: string
  icon: string
}

/** 学习路径卡片数据 */
export interface CoursePath {
  id: string
  title: string
  coverImage?: string
}

/** 热门课程卡片数据 */
export interface PopularCourseItem {
  id: string
  title: string
  instructor: string
  lessons: number
  price: number
  isFree: boolean
  isVip: boolean
  studentCount: number
}

/** 课程列表项数据 */
export interface CourseListItem {
  id: string
  title: string
  cover?: string
  description?: string
  level?: string
  instructor: string
  studentCount: number
  isFree: boolean
  price: number
}

/** 学习进度概览 */
export interface ProgressOverview {
  totalCourses: number
  completedCourses: number
  learningHours: number
}

export interface CourseTabScreenProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  progress: ProgressOverview | null
  paths: CoursePath[]
  popularItems: PopularCourseItem[]
  courses: CourseListItem[]
  loading: boolean
  error: string
  keyword: string
  page: number
  totalPages: number
  onKeywordChange: (v: string) => void
  onPageChange: (page: number) => void
  onPressCourse: (id: string) => void
  onPressCategory: (cat: CourseCategory) => void
  onPressPath: (id: string) => void
  onPressMoreCourses: () => void
}

const COURSE_CATEGORIES: readonly CourseCategory[] = [
  { id: 'douyin', name: '抖音运营', icon: '📱' },
  { id: 'private', name: '私域运营', icon: '👥' },
  { id: 'content', name: '内容创作', icon: '✍️' },
  { id: 'data', name: '数据分析', icon: '📊' },
] as const

function formatPrice(price: number, isFree: boolean): string {
  if (isFree || price <= 0) return '免费'
  return `¥${price.toFixed(2)}`
}

export function CourseTabScreen({
  t,
  progress,
  paths,
  popularItems,
  courses,
  loading,
  error,
  keyword,
  page,
  totalPages,
  onKeywordChange,
  onPageChange,
  onPressCourse,
  onPressCategory,
  onPressPath,
  onPressMoreCourses,
  colorScheme = 'light',
}: CourseTabScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const renderSectionHeader = (title: string, onMore?: () => void) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {onMore ? (
        <Pressable hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={onMore}>
          <Text style={styles.moreLink}>{'更多'}</Text>
        </Pressable>
      ) : null}
    </View>
  )

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 学习进度概览 */}
        <View style={styles.progressOverview}>
          <View style={styles.progressItem}>
            <Text style={styles.progressNum}>{progress?.totalCourses ?? 0}</Text>
            <Text style={styles.progressLabel}>{'总课程数'}</Text>
          </View>
          <View style={styles.progressItem}>
            <Text style={styles.progressNum}>{progress?.completedCourses ?? 0}</Text>
            <Text style={styles.progressLabel}>{'已完成'}</Text>
          </View>
          <View style={styles.progressItem}>
            <Text style={styles.progressNum}>{progress?.learningHours ?? 0}</Text>
            <Text style={styles.progressLabel}>{'学习时长(小时)'}</Text>
          </View>
        </View>

        {/* 学习路径 */}
        <View style={styles.section}>
          {renderSectionHeader('学习路径', onPressMoreCourses)}
          {paths.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>暂无学习路径</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.horizontalList}>
                {paths.map((path) => (
                  <TouchableOpacity
                    key={path.id}
                    style={styles.pathCard}
                    onPress={() => onPressPath(path.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.pathCover}>
                      {path.coverImage ? (
                        <Image
                          source={{ uri: path.coverImage }}
                          style={styles.pathCoverImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <Text style={styles.pathCoverEmoji}>📖</Text>
                      )}
                    </View>
                    <Text style={styles.pathTitle} numberOfLines={1}>
                      {path.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}
        </View>

        {/* 课程分类 */}
        <View style={styles.section}>
          {renderSectionHeader('课程分类', onPressMoreCourses)}
          <View style={styles.categoryGrid}>
            {COURSE_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={styles.categoryItem}
                onPress={() => onPressCategory(cat)}
                activeOpacity={0.7}
              >
                <Text style={styles.categoryIcon}>{cat.icon}</Text>
                <Text style={styles.categoryName}>{cat.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 热门课程 */}
        <View style={styles.popularWrap}>
          {renderSectionHeader('热门课程', undefined)}
          <View style={styles.popularGrid}>
            {popularItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.popularCard}
                onPress={() => onPressCourse(item.id)}
                activeOpacity={0.7}
              >
                <View style={styles.popularCover}>
                  <Text style={styles.popularCoverEmoji}>📚</Text>
                  {item.isVip && (
                    <View style={styles.vipBadge}>
                      <Text style={styles.vipBadgeText}>VIP</Text>
                    </View>
                  )}
                </View>
                <View style={styles.popularBody}>
                  <Text style={styles.popularTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.popularMeta}>
                    {item.instructor} · {item.lessons}课时
                  </Text>
                  <View style={styles.popularFooter}>
                    <Text style={styles.popularPrice}>{formatPrice(item.price, item.isFree)}</Text>
                    <Text style={styles.popularStudents}>
                      {item.studentCount > 0 ? `${item.studentCount} 人学过` : ''}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 全部课程 */}
        <View style={styles.section}>
          {renderSectionHeader('全部课程', onPressMoreCourses)}
          <TextInput
            style={styles.searchInput}
            value={keyword}
            onChangeText={onKeywordChange}
            placeholder="搜索课程"
            placeholderTextColor={tk.text.tertiary}
            returnKeyType="search"
          />
          {error ? (
            <View style={styles.errorWrap}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : loading ? (
            <View style={styles.centerWrap}>
              <Text style={styles.loadingText}>{t('common.loading') || '加载中...'}</Text>
            </View>
          ) : courses.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>暂无课程</Text>
            </View>
          ) : (
            <View style={styles.courseList}>
              {courses.map((c) => (
                <Pressable
                  key={c.id}
                  style={({ pressed }) => [
                    styles.courseCard,
                    pressed ? styles.courseCardPressed : null,
                  ]}
                  onPress={() => onPressCourse(c.id)}
                >
                  {c.cover ? (
                    <Image
                      source={{ uri: c.cover }}
                      style={styles.courseImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.courseImage, styles.courseImageFallback]}>
                      <Text style={styles.courseImageEmoji}>📚</Text>
                    </View>
                  )}
                  <View style={styles.courseInfo}>
                    <Text style={styles.courseTitle} numberOfLines={2}>
                      {c.title}
                    </Text>
                    {c.description ? (
                      <Text style={styles.courseDesc} numberOfLines={2}>
                        {c.description}
                      </Text>
                    ) : null}
                    <View style={styles.courseMeta}>
                      {c.level ? (
                        <View style={styles.levelBadge}>
                          <Text style={styles.levelText}>{c.level}</Text>
                        </View>
                      ) : null}
                      <Text style={styles.metaText}>
                        {c.instructor} · {t('course.studentCount', { count: c.studentCount })}
                      </Text>
                    </View>
                    <Text style={c.isFree ? styles.priceFree : styles.pricePaid}>
                      {formatPrice(c.price, c.isFree)}
                    </Text>
                  </View>
                </Pressable>
              ))}
              {totalPages > 1 ? (
                <View style={styles.pagination}>
                  <Pressable
                    onPress={() => onPageChange(Math.max(1, page - 1))}
                    disabled={page <= 1}
                    hitSlop={8}
                  >
                    <Text style={[styles.pageBtn, page <= 1 ? styles.pageBtnDisabled : null]}>
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
                    <Text
                      style={[styles.pageBtn, page >= totalPages ? styles.pageBtnDisabled : null]}
                    >
                      下一页
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
    } as ViewStyle,
    scroll: {
      flex: 1,
    } as ViewStyle,
    scrollContent: {
      paddingBottom: 24,
    } as ViewStyle,
    popularWrap: {
      paddingTop: 4,
      paddingBottom: 4,
    } as ViewStyle,

    // 进度概览
    progressOverview: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      paddingVertical: 20,
      marginBottom: 8,
      backgroundColor: tk.surface.light,
    } as ViewStyle,
    progressItem: {
      alignItems: 'center',
    } as ViewStyle,
    progressNum: {
      fontSize: 24,
      fontWeight: '700',
      color: tk.brand.DEFAULT,
      marginBottom: 4,
    } as TextStyle,
    progressLabel: {
      fontSize: 12,
      color: tk.text.secondary,
    } as TextStyle,

    // 区块
    section: {
      padding: 16,
      marginBottom: 8,
      backgroundColor: tk.surface.light,
    } as ViewStyle,
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    } as ViewStyle,
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: tk.text.primary,
    } as TextStyle,
    moreLink: {
      fontSize: 12,
      color: tk.text.secondary,
    } as TextStyle,

    // 学习路径
    horizontalList: {
      flexDirection: 'row',
      gap: 12,
    } as ViewStyle,
    pathCard: {
      width: 140,
      alignItems: 'center',
    } as ViewStyle,
    pathCover: {
      width: 140,
      height: 90,
      borderRadius: 8,
      backgroundColor: tk.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    } as ViewStyle,
    pathCoverImage: {
      width: '100%',
      height: '100%',
    } as ImageStyle,
    pathCoverEmoji: {
      fontSize: 32,
    } as TextStyle,
    pathTitle: {
      marginTop: 8,
      fontSize: 13,
      color: tk.text.primary,
      textAlign: 'center',
    } as TextStyle,

    // 课程分类
    categoryGrid: {
      flexDirection: 'row',
      paddingVertical: 4,
      gap: 12,
    } as ViewStyle,
    categoryItem: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 12,
      gap: 8,
    } as ViewStyle,
    categoryIcon: {
      fontSize: 32,
    } as TextStyle,
    categoryName: {
      fontSize: 12,
      color: tk.text.primary,
    } as TextStyle,

    // 热门课程
    popularGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    } as ViewStyle,
    popularCard: {
      width: '48%',
      borderRadius: 12,
      backgroundColor: tk.surface.card,
      overflow: 'hidden',
    } as ViewStyle,
    popularCover: {
      width: '100%',
      height: 100,
      backgroundColor: tk.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    } as ViewStyle,
    popularCoverEmoji: {
      fontSize: 32,
    } as TextStyle,
    vipBadge: {
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor: tk.brand.DEFAULT,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    } as ViewStyle,
    vipBadgeText: {
      fontSize: 10,
      fontWeight: '600',
      color: '#fff',
    } as TextStyle,
    popularBody: {
      padding: 10,
      gap: 4,
    } as ViewStyle,
    popularTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: tk.text.primary,
    } as TextStyle,
    popularMeta: {
      fontSize: 11,
      color: tk.text.secondary,
    } as TextStyle,
    popularFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 4,
    } as ViewStyle,
    popularPrice: {
      fontSize: 13,
      fontWeight: '600',
      color: tk.success.DEFAULT,
    } as TextStyle,
    popularStudents: {
      fontSize: 11,
      color: tk.text.secondary,
    } as TextStyle,

    // 全部课程
    searchInput: {
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: 8,
      backgroundColor: tk.surface.muted,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 14,
      color: tk.text.primary,
      marginBottom: 12,
    } as TextStyle,
    errorWrap: {
      alignItems: 'center',
      gap: 8,
      paddingVertical: 16,
    } as ViewStyle,
    errorText: {
      fontSize: 13,
      color: tk.danger.DEFAULT,
      textAlign: 'center',
    } as TextStyle,
    centerWrap: {
      alignItems: 'center',
      paddingVertical: 48,
    } as ViewStyle,
    loadingText: {
      fontSize: 14,
      color: tk.text.secondary,
    } as TextStyle,
    emptyWrap: {
      alignItems: 'center',
      paddingVertical: 48,
    } as ViewStyle,
    emptyText: {
      fontSize: 13,
      color: tk.text.secondary,
    } as TextStyle,
    courseList: {
      gap: 12,
    } as ViewStyle,
    courseCard: {
      flexDirection: 'row',
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: tk.surface.light,
    } as ViewStyle,
    courseCardPressed: {
      backgroundColor: tk.surface.muted,
    } as ViewStyle,
    courseImage: {
      width: 110,
      height: 110,
      backgroundColor: tk.border.light,
    } as ImageStyle,
    courseImageFallback: {
      alignItems: 'center',
      justifyContent: 'center',
    } as ViewStyle,
    courseImageEmoji: {
      fontSize: 32,
    } as TextStyle,
    courseInfo: {
      flex: 1,
      padding: 12,
      gap: 6,
    } as ViewStyle,
    courseTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: tk.text.primary,
    } as TextStyle,
    courseDesc: {
      fontSize: 12,
      color: tk.text.secondary,
    } as TextStyle,
    courseMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    } as ViewStyle,
    levelBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: tk.purple.light,
    } as ViewStyle,
    levelText: {
      fontSize: 11,
      fontWeight: '600',
      color: tk.purple.DEFAULT,
    } as TextStyle,
    metaText: {
      fontSize: 11,
      color: tk.text.secondary,
    } as TextStyle,
    priceFree: {
      fontSize: 14,
      fontWeight: '600',
      color: tk.success.DEFAULT,
    } as TextStyle,
    pricePaid: {
      fontSize: 14,
      fontWeight: '600',
      color: tk.text.primary,
    } as TextStyle,
    pagination: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 8,
    } as ViewStyle,
    pageBtn: {
      fontSize: 14,
      color: tk.text.primary,
    } as TextStyle,
    pageBtnDisabled: {
      opacity: 0.4,
    } as TextStyle,
    pageIndicator: {
      fontSize: 12,
      color: tk.text.secondary,
    } as TextStyle,
  })
}
