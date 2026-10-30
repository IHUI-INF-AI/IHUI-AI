// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { SectionHeader } from '../../components/SectionHeader'
import { EmptyState, ErrorState, ScreenSkeleton } from '../../components/ScreenStates'
import { Smartphone, Users, PenLine, BarChart3, BookOpen } from 'lucide-react-native'
import type { LearnCategory, LearnScreenProps } from '../../types'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'

/** LearnScreen props re-export(单一来源 @ihui/types) */
export type { LearnCategory, LearnScreenProps }

const CATEGORIES: readonly LearnCategory[] = [
  { id: 'douyin', name: '抖音运营', icon: Smartphone },
  { id: 'private', name: '私域运营', icon: Users },
  { id: 'content', name: '内容创作', icon: PenLine },
  { id: 'data', name: '数据分析', icon: BarChart3 },
] as const

function difficultyLabel(d?: string): string {
  if (d === 'beginner') return '入门'
  if (d === 'intermediate') return '进阶'
  if (d === 'advanced') return '高级'
  return ''
}

function formatCourseDuration(duration?: number): string {
  if (!duration || duration <= 0) return ''
  if (duration < 60) return `${duration}分钟`
  const hours = Math.floor(duration / 60)
  const mins = duration % 60
  return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`
}

export function LearnScreen({
  t,
  progress,
  paths,
  recommended,
  loading,
  error,
  onOpenCourse,
  onOpenBrowse,
  onOpenCategory,
  categories,
  onBack,
  colorScheme = 'light',
}: LearnScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const renderSectionHeader = (title: string, onMore?: () => void) => (
    <SectionHeader
      title={title}
      moreText={t('common.more')}
      onMore={onMore}
      colorScheme={colorScheme}
      style={styles.sectionHeader}
    />
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>学习</Text>
      </View>
      {loading ? (
        <ScreenSkeleton variant="card" count={4} colorScheme={colorScheme} />
      ) : error && !progress ? (
        <ErrorState
          message={error}
          onRetry={onOpenBrowse}
          retryLabel={t('common.retry')}
          colorScheme={colorScheme}
        />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.progressOverview}>
            <View style={styles.progressItem}>
              <Text style={styles.progressNum}>{progress?.totalCourses ?? 0}</Text>
              <Text style={styles.progressLabel}>总课程数</Text>
            </View>
            <View style={styles.progressItem}>
              <Text style={styles.progressNum}>{progress?.completedCourses ?? 0}</Text>
              <Text style={styles.progressLabel}>已完成</Text>
            </View>
            <View style={styles.progressItem}>
              <Text style={styles.progressNum}>{progress?.learningHours ?? 0}</Text>
              <Text style={styles.progressLabel}>学习时长(小时)</Text>
            </View>
          </View>

          <View style={styles.section}>
            {renderSectionHeader('学习路径', onOpenBrowse)}
            {paths.length === 0 ? (
              <EmptyState title="暂无学习路径" colorScheme={colorScheme} />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.horizontalList}>
                  {paths.map((path) => (
                    <TouchableOpacity
                      key={path.id}
                      style={styles.pathCard}
                      onPress={() => onOpenCourse(path.id)}
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

          <View style={styles.section}>
            {renderSectionHeader('课程分类', onOpenBrowse)}
            <View style={styles.categoryGrid}>
              {(categories && categories.length > 0 ? categories : CATEGORIES).map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={styles.categoryItem}
                  onPress={() => onOpenCategory(cat)}
                  activeOpacity={0.7}
                >
                  {typeof cat.icon === 'string' ? (
                    <Text style={styles.categoryIcon}>{cat.icon}</Text>
                  ) : cat.icon ? (
                    <cat.icon size={32} color={tk.text.primary} />
                  ) : null}
                  <Text style={styles.categoryName}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            {renderSectionHeader('推荐课程', onOpenBrowse)}
            {recommended.length === 0 ? (
              <EmptyState title="暂无推荐" colorScheme={colorScheme} />
            ) : (
              <View style={styles.courseList}>
                {recommended.map((item) => {
                  const level = difficultyLabel(item.difficulty)
                  const duration = formatCourseDuration(item.duration)
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.courseCard}
                      onPress={() => onOpenCourse(item.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.courseImageWrap}>
                        {item.coverImage ? (
                          <Image
                            source={{ uri: item.coverImage }}
                            style={styles.courseImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <BookOpen size={40} color={tk.text.medium} />
                        )}
                      </View>
                      <View style={styles.courseInfo}>
                        <Text style={styles.courseTitle} numberOfLines={2}>
                          {item.title}
                        </Text>
                        {item.description ? (
                          <Text style={styles.courseDesc} numberOfLines={2}>
                            {item.description}
                          </Text>
                        ) : null}
                        <View style={styles.courseMeta}>
                          {level ? (
                            <View style={styles.levelBadge}>
                              <Text style={styles.levelText}>{level}</Text>
                            </View>
                          ) : null}
                          {duration ? <Text style={styles.durationText}>{duration}</Text> : null}
                        </View>
                      </View>
                    </TouchableOpacity>
                  )
                })}
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
    } as ViewStyle,
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingBottom: rnSpacing.md,
      gap: rnSpacing.md,
    },
    title: {
      fontSize: rnType.heading.size,
      fontWeight: '600',
      color: tk.text.primary,
    } as TextStyle,
    scroll: { flex: 1 } as ViewStyle,
    scrollContent: {
      paddingBottom: rnSpacing['2xl'],
    } as ViewStyle,

    progressOverview: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      paddingVertical: rnSpacing.xl,
      marginBottom: rnSpacing.sm,
      backgroundColor: tk.surface.light,
    } as ViewStyle,
    progressItem: {
      alignItems: 'center',
    } as ViewStyle,
    progressNum: {
      fontSize: rnType.display.size,
      fontWeight: '700',
      color: tk.brand.DEFAULT,
      marginBottom: rnSpacing.sm,
    } as TextStyle,
    progressLabel: {
      fontSize: rnType.body.size,
      color: tk.text.secondary,
    } as TextStyle,

    section: {
      padding: 14,
      marginBottom: rnSpacing.sm,
      backgroundColor: tk.surface.light,
    } as ViewStyle,
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: rnSpacing.md,
    } as ViewStyle,

    horizontalList: {
      flexDirection: 'row',
      gap: rnSpacing.md,
    } as ViewStyle,
    pathCard: {
      width: 140,
      borderRadius: rnRadius.lg,
      overflow: 'hidden',
      backgroundColor: tk.surface.light,
    } as ViewStyle,
    pathCover: {
      width: '100%',
      height: 100,
      backgroundColor: tk.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
    } as ViewStyle,
    pathCoverImage: {
      width: '100%',
      height: '100%',
      backgroundColor: tk.border.light,
    } as ImageStyle,
    pathTitle: {
      padding: 10,
      fontSize: rnType.body.size,
      fontWeight: '600',
      color: tk.text.primary,
    } as TextStyle,

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
    } as ViewStyle,
    categoryIcon: {
      fontSize: 32,
    } as TextStyle,
    categoryName: {
      fontSize: rnType.body.size,
      color: tk.text.primary,
    } as TextStyle,

    courseList: {
      gap: rnSpacing.md,
    } as ViewStyle,
    courseCard: {
      flexDirection: 'row',
      borderRadius: rnRadius.lg,
      overflow: 'hidden',
      backgroundColor: tk.surface.light,
    } as ViewStyle,
    courseImageWrap: {
      width: 110,
      height: 110,
      backgroundColor: tk.border.light,
      alignItems: 'center',
      justifyContent: 'center',
    } as ViewStyle,
    courseImage: {
      width: '100%',
      height: '100%',
      backgroundColor: tk.border.light,
    } as ImageStyle,

    courseInfo: {
      flex: 1,
      padding: rnSpacing.md,
      justifyContent: 'space-between',
    } as ViewStyle,
    courseTitle: {
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tk.text.primary,
    } as TextStyle,
    courseDesc: {
      fontSize: rnType.body.size,
      color: tk.text.secondary,
      marginTop: rnSpacing.sm,
    } as TextStyle,
    courseMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: rnSpacing.sm,
      gap: rnSpacing.sm,
    } as ViewStyle,
    levelBadge: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
    } as ViewStyle,
    levelText: {
      fontSize: rnType.caption.size,
      fontWeight: '600',
      color: tk.brand.DEFAULT,
    } as TextStyle,
    durationText: {
      fontSize: rnType.caption.size,
      color: tk.text.secondary,
    } as TextStyle,
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
