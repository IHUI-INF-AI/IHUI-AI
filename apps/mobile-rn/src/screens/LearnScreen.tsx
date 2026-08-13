/**
 * LearnScreen 学习页面(mobile-rn 端)
 *
 * 对齐历史项目 pages/learn/learn.vue:
 * - 顶部 NavBar(标题「学习」+ 返回)
 * - 学习进度概览(总课程数 / 已完成 / 学习时长)— getStudyStatistics
 * - 学习路径(横向滚动卡片)— getHotLearnCourses
 * - 课程分类(4 列网格入口)— 静态分类(对齐 Uniapp 静态 categories)
 * - 推荐课程(纵向列表卡片)— getRecommendLearnCourses
 * - 数据加载走 @ihui/api-client;空态用 common/Empty;浅色优雅风;圆角守门;无分割线
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  getHotLearnCourses,
  getRecommendLearnCourses,
  getStudyStatistics,
  type LearnCourse,
} from '@ihui/api-client'
import { getRnTokens, type RnThemeTokens } from '@ihui/design-tokens'
import Empty from '../components/common/Empty'
import { NavBar } from '../components/NavBar'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 学习进度概览(对齐 getStudyStatistics 返回,totalDuration 视为秒) */
interface ProgressOverview {
  totalCourses: number
  completedCourses: number
  learningHours: number
}

/** 课程分类入口(对齐 Uniapp 静态 categories,点击进入课程筛选) */
interface LearnCategory {
  id: string
  name: string
  icon: string
}

const CATEGORIES: readonly LearnCategory[] = [
  { id: 'douyin', name: '抖音运营', icon: '📱' },
  { id: 'private', name: '私域运营', icon: '👥' },
  { id: 'content', name: '内容创作', icon: '✍️' },
  { id: 'data', name: '数据分析', icon: '📊' },
] as const

/** 难度 → 中文标签(对齐 Uniapp level 字段) */
function difficultyLabel(d: LearnCourse['difficulty'] | undefined): string {
  if (d === 'beginner') return '入门'
  if (d === 'intermediate') return '进阶'
  if (d === 'advanced') return '高级'
  return ''
}

/** 课程时长格式化(duration 字段按分钟处理,对齐 Uniapp "2小时" 展示) */
function formatCourseDuration(duration: number | undefined): string {
  if (!duration || duration <= 0) return ''
  if (duration < 60) return `${duration}分钟`
  const hours = Math.floor(duration / 60)
  const mins = duration % 60
  return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`
}

export function LearnScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const tk = getRnTokens(resolvedTheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const [progress, setProgress] = useState<ProgressOverview | null>(null)
  const [paths, setPaths] = useState<LearnCourse[]>([])
  const [recommended, setRecommended] = useState<LearnCourse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const [statsRes, hotRes, recommendRes] = await Promise.all([
        getStudyStatistics(),
        getHotLearnCourses(6),
        getRecommendLearnCourses(6),
      ])
      if (statsRes.success && statsRes.data) {
        const d = statsRes.data
        setProgress({
          totalCourses: d.totalCourses,
          completedCourses: d.completedCourses,
          learningHours: Math.round((d.totalDuration ?? 0) / 3600),
        })
      }
      if (hotRes.success) setPaths(hotRes.data ?? [])
      if (recommendRes.success) setRecommended(recommendRes.data ?? [])
    } catch {
      setError(t('common.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const openCourse = (id: string) => navigation.navigate('CourseDetail', { id })
  const openBrowse = () => navigation.navigate('CourseFilter')

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
      <NavBar title="学习" onBack={() => navigation.goBack()} />
      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="small" color={tk.text.secondary} />
        </View>
      ) : error && !progress ? (
        <View style={styles.centerWrap}>
          <Empty text={error} actionText={t('common.retry')} onAction={() => void load()} />
        </View>
      ) : (
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
            {renderSectionHeader('学习路径', openBrowse)}
            {paths.length === 0 ? (
              <Empty />
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pathScroll}
              >
                {paths.map((item) => (
                  <Pressable
                    key={item.id}
                    style={styles.pathCard}
                    onPress={() => openCourse(item.id)}
                    accessibilityRole="button"
                    accessibilityLabel={item.title}
                  >
                    {item.coverImage ? (
                      <Image
                        source={{ uri: item.coverImage }}
                        style={styles.pathImage}
                        resizeMode="cover"
                      />
                    ) : null}
                    <View style={styles.pathInfo}>
                      <Text style={styles.pathTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      {item.description ? (
                        <Text style={styles.pathDesc} numberOfLines={1}>
                          {item.description}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>

          {/* 课程分类 */}
          <View style={styles.section}>
            {renderSectionHeader('课程分类', openBrowse)}
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => (
                <Pressable
                  key={cat.id}
                  style={styles.categoryItem}
                  onPress={openBrowse}
                  accessibilityRole="button"
                  accessibilityLabel={cat.name}
                >
                  <Text style={styles.categoryIcon}>{cat.icon}</Text>
                  <Text style={styles.categoryName}>{cat.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* 推荐课程 */}
          <View style={styles.section}>
            {renderSectionHeader('推荐课程', openBrowse)}
            {recommended.length === 0 ? (
              <Empty />
            ) : (
              <View style={styles.courseList}>
                {recommended.map((item) => {
                  const level = difficultyLabel(item.difficulty)
                  const duration = formatCourseDuration(
                    typeof item.duration === 'number' ? item.duration : undefined,
                  )
                  return (
                    <Pressable
                      key={item.id}
                      style={({ pressed }) => [
                        styles.courseCard,
                        pressed ? styles.courseCardPressed : null,
                      ]}
                      onPress={() => openCourse(item.id)}
                      accessibilityRole="button"
                      accessibilityLabel={item.title}
                    >
                      {item.coverImage ? (
                        <Image
                          source={{ uri: item.coverImage }}
                          style={styles.courseImage}
                          resizeMode="cover"
                        />
                      ) : null}
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
                          {duration ? (
                            <Text style={styles.durationText}>{duration}</Text>
                          ) : null}
                        </View>
                      </View>
                    </Pressable>
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

function createStyles(tk: RnThemeTokens) {
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
    centerWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
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

    // 学习路径(横向)
    pathScroll: {
      paddingVertical: 4,
      gap: 12,
    } as ViewStyle,
    pathCard: {
      width: 220,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: tk.surface.light,
    } as ViewStyle,
    pathImage: {
      width: '100%',
      height: 110,
      backgroundColor: tk.border.light,
    } as ImageStyle,
    pathInfo: {
      padding: 10,
      gap: 4,
    } as ViewStyle,
    pathTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: tk.text.primary,
    } as TextStyle,
    pathDesc: {
      fontSize: 12,
      color: tk.text.secondary,
    } as TextStyle,

    // 课程分类(4 列)
    categoryGrid: {
      flexDirection: 'row',
      paddingVertical: 4,
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

    // 推荐课程(纵向)
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
  })
}

export default LearnScreen
