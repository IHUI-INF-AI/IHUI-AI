import { useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { LearnCategory, LearnScreenProps } from '../../types'

/** LearnScreen props re-export(单一来源 @ihui/types) */
export type { LearnCategory, LearnScreenProps }

const CATEGORIES: readonly LearnCategory[] = [
  { id: 'douyin', name: '抖音运营', icon: '📱' },
  { id: 'private', name: '私域运营', icon: '👥' },
  { id: 'content', name: '内容创作', icon: '✍️' },
  { id: 'data', name: '数据分析', icon: '📊' },
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
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {onMore ? (
        <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={onMore}>
          <Text style={styles.moreLink}>更多</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>学习</Text>
      </View>
      {loading ? (
        <View style={styles.centerWrap}>
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      ) : error && !progress ? (
        <View style={styles.centerWrap}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={onOpenBrowse}>
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
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
                      onPress={() => onOpenCourse(path.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.pathCover}>
                        {path.coverImage ? (
                          <View style={styles.pathCoverImage} />
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
                  <Text style={styles.categoryIcon}>{cat.icon}</Text>
                  <Text style={styles.categoryName}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            {renderSectionHeader('推荐课程', onOpenBrowse)}
            {recommended.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>暂无推荐</Text>
              </View>
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
                          <View style={styles.courseImage} />
                        ) : (
                          <Text style={styles.courseImageEmoji}>📚</Text>
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
      paddingHorizontal: 16,
      paddingTop: 48,
      paddingBottom: 12,
      gap: 12,
    },
    backText: { fontSize: 14, color: tk.text.medium } as TextStyle,
    title: { fontSize: 18, fontWeight: '600', color: tk.text.primary } as TextStyle,
    scroll: { flex: 1 } as ViewStyle,
    scrollContent: {
      paddingBottom: 24,
    } as ViewStyle,
    centerWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    } as ViewStyle,
    loadingText: { fontSize: 14, color: tk.text.secondary } as TextStyle,
    errorText: { fontSize: 14, color: tk.danger.DEFAULT, textAlign: 'center' } as TextStyle,
    retryBtn: {
      marginTop: 12,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: tk.brand.DEFAULT,
    } as ViewStyle,
    retryText: { fontSize: 13, fontWeight: '600', color: tk.surface.light } as TextStyle,

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

    horizontalList: {
      flexDirection: 'row',
      gap: 12,
    } as ViewStyle,
    pathCard: {
      width: 140,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: tk.surface.card,
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
    } as ViewStyle,
    pathCoverEmoji: { fontSize: 32 } as TextStyle,
    pathTitle: {
      padding: 10,
      fontSize: 13,
      fontWeight: '600',
      color: tk.text.primary,
    } as TextStyle,

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

    courseList: {
      gap: 12,
    } as ViewStyle,
    courseCard: {
      flexDirection: 'row',
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: tk.surface.card,
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
    } as ViewStyle,
    courseImageEmoji: { fontSize: 40 } as TextStyle,
    courseInfo: {
      flex: 1,
      padding: 12,
      justifyContent: 'space-between',
    } as ViewStyle,
    courseTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: tk.text.primary,
    } as TextStyle,
    courseDesc: {
      fontSize: 12,
      color: tk.text.secondary,
      marginTop: 4,
    } as TextStyle,
    courseMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 8,
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
    durationText: {
      fontSize: 11,
      color: tk.text.secondary,
    } as TextStyle,

    emptyWrap: {
      paddingVertical: 24,
      alignItems: 'center',
    } as ViewStyle,
    emptyText: { fontSize: 14, color: tk.text.secondary } as TextStyle,
  })
}
