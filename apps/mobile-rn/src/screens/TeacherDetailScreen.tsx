// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * TeacherDetailScreen 讲师详情页(mobile-rn 端 wrapper)
 *
 * 2026-09-14 迁移:UI 与展示逻辑已下沉共享层 @ihui/rn-app LecturerDetailScreen
 * (对齐 miniapp pages/teacher/detail),本 wrapper 仅保留平台特定职责:
 * - 数据:fetchApi(/teacher/:id、/teacher/:id/courses、/teacher/:id/reviews)
 * - 关注:乐观更新 + 失败回滚 + Alert 提示
 * - 联系讲师:ActionSheet 降级为 Alert 选项
 * - 导航:CourseDetail 跳转 / goBack;主题色 / i18n 注入
 */
import { useEffect, useState } from 'react'
import { Alert } from 'react-native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import { fetchApi, type Teacher, type TeacherCourse, type TeacherReview } from '@ihui/api-client'
import { LecturerDetailScreen, type LecturerDetailInfo } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Route = RouteProp<RootStackParamList, 'TeacherDetail'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'TeacherDetail'>

/** 课程/评价接口响应兼容「数组」或「{ list }」两种返回结构 */
type ListRes<T> = T[] | { list?: T[] }

function normalizeList<T>(data: ListRes<T> | undefined): T[] {
  if (Array.isArray(data)) return data
  return data?.list ?? []
}

/** 金牌讲师:课程数 >=10 或学员数 >=1000(对齐 miniapp isGoldTeacher) */
function isGoldTeacher(t: Teacher): boolean {
  return (t.courses ?? 0) >= 10 || (t.students ?? 0) >= 1000
}

/** Teacher(/teacher/:id)→ 共享层 LecturerDetailInfo 映射 */
function toInfo(teacher: Teacher, following: boolean): LecturerDetailInfo {
  return {
    id: String(teacher.id),
    nickname: teacher.name,
    avatar: teacher.avatar ?? null,
    title: teacher.title,
    intro: teacher.intro,
    fans: teacher.fans,
    rating: teacher.rating,
    courseCount: teacher.courses ?? 0,
    studentCount: teacher.students ?? 0,
    isFollowing: following,
    isGold: isGoldTeacher(teacher),
  }
}

export function TeacherDetailScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { id } = route.params

  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [courses, setCourses] = useState<TeacherCourse[]>([])
  const [reviews, setReviews] = useState<TeacherReview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [following, setFollowing] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const [teacherRes, coursesRes, reviewsRes] = await Promise.all([
        fetchApi<Teacher>(`/teacher/${id}`),
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

  return (
    <LecturerDetailScreen
      t={t}
      info={teacher ? toInfo(teacher, following) : null}
      courses={courses.map((c) => ({
        id: String(c.id),
        title: c.title,
        coverUrl: c.coverUrl ?? null,
        price: c.price,
        students: c.students,
      }))}
      reviews={reviews.map((r) => ({
        id: r.id !== undefined ? String(r.id) : undefined,
        nickname: r.nickname,
        avatar: r.avatar,
        rating: r.rating,
        content: r.content,
        time: r.time,
      }))}
      loading={loading}
      error={error}
      onToggleFollow={() => void onToggleFollow()}
      onContact={onContact}
      onOpenCourse={(courseId) => navigation.navigate('CourseDetail', { id: courseId })}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
