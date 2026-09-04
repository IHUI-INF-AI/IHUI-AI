// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * TeacherDetailScreen 讲师详情页(mobile-rn 端)
 *
 * 镜像 miniapp-taro pages/teacher/detail(P0 课程交易链路):
 * - 复用共享层:@ihui/api-client fetchApi(端点 /teacher/:id、/teacher/:id/courses、
 *   /teacher/:id/reviews、/teacher/:id/follow)+ Teacher 类型,端内不重造业务逻辑
 * - 结构:头部(头像/姓名/金牌徽章/关注)→ 统计行 → 简介(>60 字展开收起)
 *   → 主讲课程卡(点击复用现有 CourseDetail 路由)→ 学员评价 → 底部"联系讲师"
 * - 样式:getRnTokens 语义 token(零 hex,过 check:rn-parity);图标 lucide-react-native(无 emoji)
 */
import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
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
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import { Star } from 'lucide-react-native'
import { fetchApi, type Teacher } from '@ihui/api-client'
import { getRnTokens, type RnThemeTokens } from '@ihui/design-tokens'
import { NavBar } from '../components/NavBar'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { rpx } from '../utils/rpx'

type Route = RouteProp<RootStackParamList, 'TeacherDetail'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'TeacherDetail'>

/** 讲师详情扩展字段(fans/rating 由 /teacher/:id 返回,共享 Teacher 类型未覆盖) */
interface TeacherDetailData extends Teacher {
  fans?: number
  rating?: number
}

/** 讲师主讲课程(对齐 miniapp TeacherCourse,price 单位:分) */
interface TeacherCourse {
  id: string | number
  title: string
  coverUrl?: string
  price?: number
  students?: number
}

/** 学员评价(对齐 miniapp review 渲染字段) */
interface TeacherReview {
  id?: string | number
  nickname?: string
  avatar?: string
  rating?: number
  content?: string
  time?: string
}

/** 课程/评价接口响应兼容「数组」或「{ list }」两种返回结构 */
type ListRes<T> = T[] | { list?: T[] }

/** 简介超过该字数显示展开/收起(对齐 miniapp 60 字阈值) */
const INTRO_COLLAPSE_LEN = 60

function normalizeList<T>(data: ListRes<T> | undefined): T[] {
  if (Array.isArray(data)) return data
  return data?.list ?? []
}

/** 分转元(对齐 miniapp formatPrice) */
function fenToYuan(cents?: number): string {
  if (typeof cents !== 'number') return ''
  return (cents / 100).toFixed(2)
}

/** 人数格式化:>=1万 → x.xw;>=1000 → x.xk(对齐 miniapp formatStudents) */
function formatStudents(n?: number): string {
  const v = n ?? 0
  if (v >= 10000) return `${(v / 10000).toFixed(1)}w`
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
  return String(v)
}

export function TeacherDetailScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { id } = route.params
  const tk = getRnTokens(resolvedTheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const [teacher, setTeacher] = useState<TeacherDetailData | null>(null)
  const [courses, setCourses] = useState<TeacherCourse[]>([])
  const [reviews, setReviews] = useState<TeacherReview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [following, setFollowing] = useState(false)
  const [introExpanded, setIntroExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const [teacherRes, coursesRes, reviewsRes] = await Promise.all([
        fetchApi<TeacherDetailData>(`/teacher/${id}`),
        fetchApi<ListRes<TeacherCourse>>(`/teacher/${id}/courses`),
        fetchApi<ListRes<TeacherReview>>(`/teacher/${id}/reviews`),
      ])
      if (cancelled) return
      if (teacherRes.success) {
        setTeacher(teacherRes.data ?? null)
      } else {
        setError(teacherRes.error || t('teacher.detail.notFound'))
      }
      if (coursesRes.success) setCourses(normalizeList(coursesRes.data))
      if (reviewsRes.success) setReviews(normalizeList(reviewsRes.data))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, t])

  // 关注/取消关注(乐观更新,失败回滚)
  const onToggleFollow = async () => {
    const next = !following
    setFollowing(next)
    const res = await fetchApi(`/teacher/${id}/follow`, {
      method: 'POST',
      body: JSON.stringify({ follow: next }),
    })
    if (!res.success) {
      setFollowing(!next)
      Alert.alert(t('common.failed'))
      return
    }
    Alert.alert(next ? t('teacher.detail.followed') : t('teacher.detail.unfollowed'))
  }

  // 联系讲师:ActionSheet 降级为 Alert 选项(对齐 miniapp 行为)
  const onContact = () => {
    Alert.alert(t('teacher.detail.contact'), undefined, [
      {
        text: t('teacher.detail.contactMessage'),
        onPress: () => Alert.alert(t('teacher.detail.contact'), t('teacher.detail.imSoon')),
      },
      {
        text: t('teacher.detail.contactPhone'),
        onPress: () => Alert.alert(t('teacher.detail.contact'), t('teacher.detail.phoneHint')),
      },
      { text: t('common.cancel'), style: 'cancel' },
    ])
  }

  // 金牌讲师:课程数 >=10 或学员数 >=1000(对齐 miniapp isGoldTeacher)
  const isGoldTeacher = (teacher?.courses ?? 0) >= 10 || (teacher?.students ?? 0) >= 1000

  const intro = teacher?.intro ?? ''
  const introOverflow = intro.length > INTRO_COLLAPSE_LEN
  const introText =
    introOverflow && !introExpanded ? `${intro.slice(0, INTRO_COLLAPSE_LEN)}…` : intro

  const statItems: Array<{ label: string; value: string }> = [
    { label: t('teacher.detail.fans'), value: formatStudents(teacher?.fans) },
    { label: t('teacher.detail.courses'), value: String(teacher?.courses ?? 0) },
    { label: t('teacher.detail.students'), value: formatStudents(teacher?.students) },
    { label: t('teacher.detail.rating'), value: String(teacher?.rating ?? 0) },
  ]

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <NavBar title={t('teacher.list.title')} onBack={() => navigation.goBack()} />
        <ActivityIndicator color={tk.text.secondary} />
      </View>
    )
  }

  if (error && !teacher) {
    return (
      <View style={styles.container}>
        <NavBar title={t('teacher.list.title')} onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <NavBar title={teacher?.name ?? t('teacher.list.title')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 头部:头像 + 姓名/金牌徽章/头衔 + 关注按钮 */}
        <View style={styles.header}>
          {teacher?.avatar ? (
            <Image source={{ uri: teacher.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarFallbackText}>{(teacher?.name ?? '').slice(0, 1)}</Text>
            </View>
          )}
          <View style={styles.headerBody}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {teacher?.name ?? ''}
              </Text>
              {isGoldTeacher ? (
                <View style={styles.goldBadge}>
                  <Text style={styles.goldBadgeText}>{t('teacher.detail.goldBadge')}</Text>
                </View>
              ) : null}
            </View>
            {teacher?.title ? (
              <Text style={styles.title} numberOfLines={1}>
                {teacher.title}
              </Text>
            ) : null}
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.followBtn,
              following ? styles.followBtnActive : null,
              pressed ? styles.pressed : null,
            ]}
            onPress={onToggleFollow}
            accessibilityRole="button"
            accessibilityLabel={
              following ? t('teacher.detail.following') : t('teacher.detail.follow')
            }
          >
            <Text style={following ? styles.followBtnTextActive : styles.followBtnText}>
              {following ? t('teacher.detail.following') : t('teacher.detail.follow')}
            </Text>
          </Pressable>
        </View>

        {/* 统计行:粉丝/课程/学员/评分 */}
        <View style={styles.statRow}>
          {statItems.map((s) => (
            <View key={s.label} style={styles.statItem}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* 简介:超长可展开/收起 */}
        {intro ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('teacher.detail.intro')}</Text>
            <Text style={styles.introText}>{introText}</Text>
            {introOverflow ? (
              <Pressable onPress={() => setIntroExpanded((v) => !v)} hitSlop={8}>
                <Text style={styles.expandText}>
                  {introExpanded ? t('teacher.detail.collapse') : t('teacher.detail.expand')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* 主讲课程:卡片点击复用现有 CourseDetail 路由 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('teacher.detail.courseSection')}</Text>
          {courses.length === 0 ? (
            <Text style={styles.emptyText}>{t('teacher.detail.noCourses')}</Text>
          ) : (
            courses.map((c) => (
              <Pressable
                key={String(c.id)}
                style={({ pressed }) => [styles.courseCard, pressed ? styles.pressed : null]}
                onPress={() => navigation.navigate('CourseDetail', { id: String(c.id) })}
                accessibilityRole="button"
                accessibilityLabel={c.title}
              >
                {c.coverUrl ? (
                  <Image source={{ uri: c.coverUrl }} style={styles.courseCover} />
                ) : (
                  <View style={[styles.courseCover, styles.courseCoverFallback]} />
                )}
                <View style={styles.courseBody}>
                  <Text style={styles.courseTitle} numberOfLines={2}>
                    {c.title}
                  </Text>
                  <View style={styles.courseMetaRow}>
                    {typeof c.price === 'number' && c.price > 0 ? (
                      <Text style={styles.coursePrice}>¥{fenToYuan(c.price)}</Text>
                    ) : (
                      <Text style={styles.courseFree}>{t('common.free')}</Text>
                    )}
                    <Text style={styles.courseStudents}>
                      {formatStudents(c.students)} {t('teacher.detail.learnUnit')}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))
          )}
        </View>

        {/* 学员评价:头像/昵称/星级/内容/时间 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('teacher.detail.reviewSection')}</Text>
          {reviews.length === 0 ? (
            <Text style={styles.emptyText}>{t('teacher.detail.noReviews')}</Text>
          ) : (
            reviews.map((r, idx) => {
              const stars = Math.round(r.rating ?? 0)
              return (
                <View key={String(r.id ?? idx)} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    {r.avatar ? (
                      <Image source={{ uri: r.avatar }} style={styles.reviewAvatar} />
                    ) : (
                      <View style={[styles.reviewAvatar, styles.avatarFallback]}>
                        <Text style={styles.reviewAvatarText}>
                          {(r.nickname ?? '').slice(0, 1)}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.reviewNickname} numberOfLines={1}>
                      {r.nickname ?? ''}
                    </Text>
                    <View style={styles.starRow}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={14}
                          color={i < stars ? tk.vip.gold : tk.border.light}
                          fill={i < stars ? tk.vip.gold : undefined}
                        />
                      ))}
                    </View>
                  </View>
                  {r.content ? <Text style={styles.reviewContent}>{r.content}</Text> : null}
                  {r.time ? <Text style={styles.reviewTime}>{r.time}</Text> : null}
                </View>
              )
            })
          )}
        </View>
      </ScrollView>

      {/* 底部动作条:联系讲师(私信/电话选项) */}
      <View style={styles.footerBar}>
        <Pressable
          style={({ pressed }) => [styles.footerBtn, pressed ? styles.pressed : null]}
          onPress={onContact}
          accessibilityRole="button"
          accessibilityLabel={t('teacher.detail.contact')}
        >
          <Text style={styles.footerBtnText}>{t('teacher.detail.contact')}</Text>
        </Pressable>
      </View>
    </View>
  )
}

const createStyles = (tk: RnThemeTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: rpx(16),
    },
    scrollContent: {
      padding: rpx(24),
      paddingBottom: rpx(48),
      gap: rpx(24),
    },
    pressed: {
      opacity: 0.85,
    },
    /* 头部 */
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rpx(24),
    },
    avatar: {
      width: rpx(128),
      height: rpx(128),
      borderRadius: rpx(64),
      backgroundColor: tk.surface.muted,
    },
    avatarFallback: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarFallbackText: {
      fontSize: 24,
      fontWeight: '600',
      color: tk.text.secondary,
    },
    headerBody: {
      flex: 1,
      gap: rpx(8),
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rpx(12),
    },
    name: {
      fontSize: 18,
      fontWeight: '600',
      color: tk.text.primary,
      flexShrink: 1,
    },
    goldBadge: {
      paddingHorizontal: rpx(12),
      paddingVertical: rpx(4),
      borderRadius: rpx(8),
      backgroundColor: tk.vip.gold,
    },
    goldBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: tk.text.primary,
    },
    title: {
      fontSize: 13,
      color: tk.text.secondary,
    },
    followBtn: {
      paddingHorizontal: rpx(28),
      paddingVertical: rpx(12),
      borderRadius: rpx(32),
      backgroundColor: tk.brand.DEFAULT,
    },
    followBtnActive: {
      backgroundColor: tk.surface.muted,
    },
    followBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: tk.surface.light,
    },
    followBtnTextActive: {
      fontSize: 13,
      fontWeight: '600',
      color: tk.text.secondary,
    },
    /* 统计行 */
    statRow: {
      flexDirection: 'row',
      paddingVertical: rpx(24),
      borderRadius: rpx(16),
      backgroundColor: tk.surface.card,
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
      gap: rpx(8),
    },
    statValue: {
      fontSize: 16,
      fontWeight: '600',
      color: tk.text.primary,
    },
    statLabel: {
      fontSize: 12,
      color: tk.text.tertiary,
    },
    /* 区块通用 */
    section: {
      gap: rpx(16),
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: tk.text.primary,
    },
    introText: {
      fontSize: 13,
      lineHeight: 20,
      color: tk.text.secondary,
    },
    expandText: {
      fontSize: 13,
      color: tk.indigo.DEFAULT,
    },
    /* 主讲课程 */
    courseCard: {
      flexDirection: 'row',
      gap: rpx(20),
      padding: rpx(20),
      borderRadius: rpx(16),
      backgroundColor: tk.surface.card,
    },
    courseCover: {
      width: rpx(192),
      height: rpx(120),
      borderRadius: rpx(12),
      backgroundColor: tk.surface.muted,
    },
    courseCoverFallback: {},
    courseBody: {
      flex: 1,
      justifyContent: 'space-between',
      gap: rpx(12),
    },
    courseTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: tk.text.primary,
    },
    courseMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rpx(16),
    },
    coursePrice: {
      fontSize: 14,
      fontWeight: '600',
      color: tk.vip.gold,
    },
    courseFree: {
      fontSize: 14,
      fontWeight: '600',
      color: tk.success.deepText,
    },
    courseStudents: {
      fontSize: 12,
      color: tk.text.tertiary,
    },
    /* 学员评价 */
    reviewCard: {
      gap: rpx(12),
      padding: rpx(20),
      borderRadius: rpx(16),
      backgroundColor: tk.surface.card,
    },
    reviewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rpx(16),
    },
    reviewAvatar: {
      width: rpx(64),
      height: rpx(64),
      borderRadius: rpx(32),
      backgroundColor: tk.surface.muted,
    },
    reviewAvatarText: {
      fontSize: 12,
      color: tk.text.secondary,
    },
    reviewNickname: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      color: tk.text.primary,
    },
    starRow: {
      flexDirection: 'row',
      gap: 2,
    },
    reviewContent: {
      fontSize: 13,
      lineHeight: 19,
      color: tk.text.secondary,
    },
    reviewTime: {
      fontSize: 11,
      color: tk.text.tertiary,
    },
    /* 底部动作条 */
    footerBar: {
      paddingHorizontal: rpx(24),
      paddingVertical: rpx(16),
      borderTopWidth: 1,
      borderTopColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    footerBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: rpx(24),
      borderRadius: rpx(44),
      backgroundColor: tk.brand.DEFAULT,
    },
    footerBtnText: {
      fontSize: 15,
      fontWeight: '600',
      color: tk.surface.light,
    },
    emptyText: {
      fontSize: 13,
      color: tk.text.tertiary,
    },
  } satisfies Record<string, ViewStyle | TextStyle | ImageStyle>)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
