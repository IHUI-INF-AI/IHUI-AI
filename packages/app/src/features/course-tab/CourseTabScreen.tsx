// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'

import { useMemo } from 'react'
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { SearchInput } from '../../components/SearchInput'
import { MoreLink } from '../../components/MoreLink'
import { EmptyState, ScreenSkeleton } from '../../components/ScreenStates'
import type { TFunction } from '../../types'
import type {
  AppIcon,
  CoursePath,
  PopularCourseItem,
  CourseListItem,
  ProgressOverview,
} from '@ihui/types'
import { ChevronLeft, BarChart3, BookOpen, PenLine, Smartphone, Users } from 'lucide-react-native'

/** 课程分类(对齐 Uniapp learn.vue) */
export interface CourseCategory {
  id: string
  name: string
  icon: AppIcon | string
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
  /**
   * 滚动内容区底部预留(px,默认 24)。mobile-rn 各屏 TabBar 改绝对悬浮胶囊后
   * (2026-10-16),由调用方传 tabBarScrollReserve(insets.bottom) 让内容可滚到胶囊底下。
   */
  contentBottomPadding?: number
}

const COURSE_CATEGORIES: readonly CourseCategory[] = [
  { id: 'douyin', name: '抖音运营', icon: Smartphone },
  { id: 'private', name: '私域运营', icon: Users },
  { id: 'content', name: '内容创作', icon: PenLine },
  { id: 'data', name: '数据分析', icon: BarChart3 },
]

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
  contentBottomPadding = 24,
  colorScheme = 'light',
}: CourseTabScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const renderSectionHeader = (title: string, onMore?: () => void) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {onMore ? (
        <MoreLink label={t('common.more')} onPress={onMore} colorScheme={colorScheme} />
      ) : null}
    </View>
  )

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: contentBottomPadding }]}
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
            <EmptyState title="暂无学习路径" colorScheme={colorScheme} />
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
                        <BookOpen size={32} color={tk.text.medium} />
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
                {typeof cat.icon === 'string' ? (
                  <Text style={styles.categoryIcon}>{cat.icon}</Text>
                ) : (
                  <cat.icon size={32} color={tk.text.primary} />
                )}
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
                  <BookOpen size={32} color={tk.text.medium} />
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
          <SearchInput
            value={keyword}
            onChangeText={onKeywordChange}
            placeholder="搜索课程"
            colorScheme={colorScheme}
          />
          {error ? (
            <View style={styles.errorWrap}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : loading ? (
            <ScreenSkeleton variant="list" count={4} colorScheme={colorScheme} />
          ) : courses.length === 0 ? (
            <EmptyState title="暂无课程" colorScheme={colorScheme} />
          ) : (
            <View style={styles.courseList}>
              {courses.map((c) => (
                // 按压态样式**不得写在 Pressable 的 style 上**(守门 131 那一型):Pressable 注册过
                // cssInterop,函数形态声明被 `{ ...declaration }` 清成 `{}`,卡面底色/圆角/overflow
                // 裁切静默消失。courseCard 在这份表里是纯视觉档(无 margin/flex/width),外层在
                // courseList(column,默认 alignItems stretch)里横向撑满 ⇒ 整档下移后盒子逐像素不变。
                <Pressable key={c.id} onPress={() => onPressCourse(c.id)}>
                  {({ pressed }) => (
                    <View style={[styles.courseCard, pressed ? styles.courseCardPressed : null]}>
                      {c.cover ? (
                        <Image
                          source={{ uri: c.cover }}
                          style={styles.courseImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.courseImage, styles.courseImageFallback]}>
                          <BookOpen size={32} color={tk.text.medium} />
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
                    </View>
                  )}
                </Pressable>
              ))}
              {totalPages > 1 ? (
                <View style={styles.pagination}>
                  <Pressable
                    onPress={() => onPageChange(Math.max(1, page - 1))}
                    disabled={page <= 1}
                    hitSlop={8}
                    accessibilityLabel={t('common.back')}
                  >
                    <ChevronLeft
                      size={16}
                      color={tk.text.primary}
                      style={page <= 1 ? styles.pageBtnDisabled : null}
                    />
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
      paddingBottom: rnSpacing['2xl'],
    } as ViewStyle,
    popularWrap: {
      paddingTop: rnSpacing.xs,
      paddingBottom: rnSpacing.xs,
    } as ViewStyle,

    // 进度概览
    progressOverview: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      paddingVertical: rnSpacing.xl,
      marginBottom: rnSpacing.sm,
      backgroundColor: tk.surface.card,
    } as ViewStyle,
    progressItem: {
      alignItems: 'center',
    } as ViewStyle,
    progressNum: {
      fontSize: rnType.display.size,
      fontWeight: '700',
      color: tk.brand.DEFAULT,
      marginBottom: rnSpacing.xs,
    } as TextStyle,
    progressLabel: {
      fontSize: rnType.body.size,
      color: tk.text.secondary,
    } as TextStyle,

    // 区块
    section: {
      padding: 14,
      marginBottom: rnSpacing.sm,
      backgroundColor: tk.surface.card,
    } as ViewStyle,
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: rnSpacing.md,
    } as ViewStyle,
    sectionTitle: {
      fontSize: rnType.heading.size,
      fontWeight: '600',
      color: tk.text.primary,
    } as TextStyle,

    // 学习路径
    horizontalList: {
      flexDirection: 'row',
      gap: rnSpacing.md,
    } as ViewStyle,
    pathCard: {
      width: 140,
      alignItems: 'center',
    } as ViewStyle,
    pathCover: {
      width: 140,
      height: 90,
      borderRadius: rnRadius.lg,
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
      marginTop: rnSpacing.sm,
      fontSize: rnType.body.size,
      color: tk.text.primary,
      textAlign: 'center',
    } as TextStyle,

    // 课程分类
    categoryGrid: {
      flexDirection: 'row',
      paddingVertical: rnSpacing.xs,
      gap: rnSpacing.md,
    } as ViewStyle,
    categoryItem: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: rnSpacing.md,
      gap: rnSpacing.sm,
      borderRadius: rnRadius.xl,
      backgroundColor: tk.surface.card,
    } as ViewStyle,
    categoryIcon: {
      fontSize: 32,
    } as TextStyle,
    categoryName: {
      fontSize: rnType.body.size,
      color: tk.text.primary,
    } as TextStyle,

    // 热门课程
    popularGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: rnSpacing.md,
    } as ViewStyle,
    popularCard: {
      width: '48%',
      borderRadius: rnRadius.lg,
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
      borderRadius: rnRadius.md,
    } as ViewStyle,
    vipBadgeText: {
      fontSize: 10,
      fontWeight: '600',
      color: tk.brand.foreground,
    } as TextStyle,
    popularBody: {
      padding: 10,
      gap: rnSpacing.xs,
    } as ViewStyle,
    popularTitle: {
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tk.text.primary,
    } as TextStyle,
    popularMeta: {
      fontSize: rnType.label.size,
      color: tk.text.secondary,
    } as TextStyle,
    popularFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: rnSpacing.xs,
    } as ViewStyle,
    popularPrice: {
      fontSize: rnType.body.size,
      fontWeight: '600',
      color: tk.success.DEFAULT,
    } as TextStyle,
    popularStudents: {
      fontSize: rnType.label.size,
      color: tk.text.secondary,
    } as TextStyle,

    // 全部课程
    searchInput: {
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
      paddingHorizontal: rnSpacing.md,
      height: 50,
      fontSize: rnType.title.size,
      color: tk.text.primary,
      marginBottom: rnSpacing.md,
    } as TextStyle,
    errorWrap: {
      alignItems: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing.lg,
    } as ViewStyle,
    errorText: {
      fontSize: rnType.body.size,
      color: tk.danger.DEFAULT,
      textAlign: 'center',
    } as TextStyle,
    courseList: {
      gap: rnSpacing.md,
    } as ViewStyle,
    courseCard: {
      flexDirection: 'row',
      borderRadius: rnRadius.lg,
      overflow: 'hidden',
      backgroundColor: tk.surface.card,
    } as ViewStyle,
    courseCardPressed: {
      backgroundColor: tk.surface.muted,
    } as ViewStyle,
    courseImage: {
      width: 110,
      height: 110,
      borderRadius: rnRadius.xl,
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
      padding: rnSpacing.md,
      gap: 6,
    } as ViewStyle,
    courseTitle: {
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tk.text.primary,
    } as TextStyle,
    courseDesc: {
      fontSize: rnType.body.size,
      color: tk.text.secondary,
    } as TextStyle,
    courseMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
    } as ViewStyle,
    levelBadge: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 3,
      borderRadius: rnRadius.md,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: tk.border.medium,
    } as ViewStyle,
    levelText: {
      fontSize: rnType.label.size,
      fontWeight: '600',
      color: tk.text.primary,
    } as TextStyle,
    metaText: {
      fontSize: rnType.label.size,
      color: tk.text.secondary,
    } as TextStyle,
    priceFree: {
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tk.success.DEFAULT,
    } as TextStyle,
    pricePaid: {
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tk.text.primary,
    } as TextStyle,
    pagination: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: rnSpacing.sm,
    } as ViewStyle,
    pageBtn: {
      fontSize: rnType.title.size,
      color: tk.text.primary,
    } as TextStyle,
    pageBtnDisabled: {
      opacity: 0.4,
    } as TextStyle,
    pageIndicator: {
      fontSize: rnType.label.size,
      color: tk.text.secondary,
    } as TextStyle,
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
