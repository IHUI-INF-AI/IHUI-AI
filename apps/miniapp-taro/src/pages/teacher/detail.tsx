import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getTeacherDetail, get, post, type Teacher } from '@/api'
import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import './detail.css'

interface TeacherCourse {
  id: string | number
  title: string
  coverUrl?: string
  price?: number
  students?: number
}

interface TeacherReview {
  id: string | number
  nickname: string
  avatar?: string
  rating: number
  content: string
  time: string
}

interface TeacherExtra extends Teacher {
  fans?: number
  rating?: number
  isFollowed?: boolean
}

const formatStudents = (n: number): string => {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

const formatPrice = (price?: number): { text: string; free: boolean } => {
  if (price === undefined || price === null || price === 0) {
    return { text: '免费', free: true }
  }
  return { text: `¥${(price / 100).toFixed(2)}`, free: false }
}

const buildStars = (rating: number): string => {
  const full = Math.round(rating)
  return '★'.repeat(Math.min(5, Math.max(0, full))) + '☆'.repeat(Math.max(0, 5 - full))
}

export default function TeacherDetail() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))

  const router = useRouter()
  const [teacher, setTeacher] = useState<TeacherExtra | null>(null)
  const [courses, setCourses] = useState<TeacherCourse[]>([])
  const [reviews, setReviews] = useState<TeacherReview[]>([])
  const [loading, setLoading] = useState(true)
  const [followed, setFollowed] = useState(false)
  const [introExpanded, setIntroExpanded] = useState(false)

  const load = useCallback(async () => {
    const id = router.params.id
    if (!id) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await getTeacherDetail(id)
      const extra = data as TeacherExtra
      setTeacher(extra)
      setFollowed(Boolean(extra.isFollowed))
    } catch (e) {
      logger.error('teacher/detail', '获取讲师详情', e)
      Taro.showToast({ title: tt('common.failed', '加载失败'), icon: 'none' })
    } finally {
      setLoading(false)
    }
    try {
      const res = await get<{ list: TeacherCourse[] }>(`/teacher/${id}/courses`)
      setCourses(res?.list || [])
    } catch {
      setCourses([])
    }
    try {
      const res = await get<{ list: TeacherReview[] }>(`/teacher/${id}/reviews`)
      setReviews(res?.list || [])
    } catch {
      setReviews([])
    }
  }, [router.params.id, tt])

  useDidShow(() => {
    load()
  })

  const onToggleFollow = useCallback(async () => {
    if (!teacher) return
    const next = !followed
    setFollowed(next)
    try {
      await post(`/teacher/${teacher.id}/follow`, { follow: next })
      Taro.showToast({
        title: next
          ? tt('teacher.detail.followed', '已关注')
          : tt('teacher.detail.unfollowed', '已取消'),
        icon: 'none',
      })
    } catch (e) {
      setFollowed(!next)
      logger.error('teacher/detail', '切换关注', e)
    }
  }, [teacher, followed, tt])

  const onToggleIntro = useCallback(() => {
    setIntroExpanded((v) => !v)
  }, [])

  const onContact = useCallback(() => {
    if (!teacher) return
    Taro.showActionSheet({
      itemList: [
        tt('teacher.detail.contactMessage', '发消息'),
        tt('teacher.detail.contactPhone', '电话联系'),
      ],
      success: (res) => {
        if (res.tapIndex === 0) {
          Taro.navigateTo({ url: `/pages/im/chat?teacherId=${teacher.id}` })
        } else if (res.tapIndex === 1) {
          Taro.showToast({ title: tt('teacher.detail.phoneHint', '已复制联系方式'), icon: 'none' })
        }
      },
    })
  }, [teacher, tt])

  const onViewCourses = useCallback(() => {
    if (!teacher) return
    Taro.navigateTo({ url: `/pages/course/list?keyword=${encodeURIComponent(teacher.name)}` })
  }, [teacher])

  const onOpenCourse = useCallback((courseId: string | number) => {
    Taro.navigateTo({ url: `/pages/course/detail?id=${courseId}` })
  }, [])

  const isGoldTeacher =
    (teacher?.courses ?? 0) >= 10 || (teacher?.students ?? 0) >= 1000

  const stats: Array<{ num: number; label: string }> = [
    { num: teacher?.fans ?? 0, label: tt('teacher.detail.fans', '粉丝') },
    { num: teacher?.courses ?? 0, label: tt('teacher.detail.courses', '课程') },
    { num: teacher?.students ?? 0, label: tt('teacher.detail.students', '学员') },
    {
      num: teacher?.rating ?? 0,
      label: tt('teacher.detail.rating', '评分'),
    },
  ]

  return (
    <View className="tdetail-page">
      {loading && <Text className="tdetail-skeleton">{tt('common.loading', '加载中...')}</Text>}

      {!loading && teacher && (
        <>
          {/* 教师头部 */}
          <View className="tdetail-header">
            <View className="tdetail-header-top">
              {teacher.avatar ? (
                <Image
                  className="tdetail-avatar"
                  src={teacher.avatar}
                  mode="aspectFill"
                />
              ) : (
                <View className="tdetail-avatar tdetail-avatar-fallback">
                  <Text>{teacher.name.charAt(0) || '?'}</Text>
                </View>
              )}
              <View className="tdetail-header-info">
                <View className="tdetail-name-row">
                  <Text className="tdetail-name">{teacher.name}</Text>
                  {isGoldTeacher && (
                    <Text className="tdetail-badge">
                      {tt('teacher.detail.goldBadge', '金牌讲师')}
                    </Text>
                  )}
                </View>
                {teacher.title && <Text className="tdetail-title">{teacher.title}</Text>}
              </View>
              <Text
                className={`tdetail-follow-btn ${followed ? 'tdetail-follow-btn-active' : ''}`}
                onClick={onToggleFollow}
              >
                {followed
                  ? tt('teacher.detail.following', '已关注')
                  : tt('teacher.detail.follow', '+ 关注')}
              </Text>
            </View>
          </View>

          {/* 数据统计 */}
          <View className="tdetail-stats">
            {stats.map((s, idx) => (
              <View key={idx} className="tdetail-stat-item">
                <Text className="tdetail-stat-num">
                  {idx === 3 ? s.num.toFixed(1) : formatStudents(s.num)}
                </Text>
                <Text className="tdetail-stat-label">{s.label}</Text>
              </View>
            ))}
          </View>

          {/* 教师简介 */}
          {teacher.intro && (
            <View className="tdetail-intro">
              <Text className="tdetail-section-title">
                {tt('teacher.detail.intro', '简介')}
              </Text>
              <Text
                className={`tdetail-intro-text ${introExpanded ? '' : 'tdetail-intro-text-collapsed'}`}
              >
                {teacher.intro}
              </Text>
              {teacher.intro.length > 60 && (
                <Text className="tdetail-intro-toggle" onClick={onToggleIntro}>
                  {introExpanded
                    ? tt('teacher.detail.collapse', '收起')
                    : tt('teacher.detail.expand', '展开')}
                </Text>
              )}
            </View>
          )}

          {/* 主讲课程 */}
          <View className="tdetail-section">
            <Text className="tdetail-section-title">
              {tt('teacher.detail.courseSection', '主讲课程')}
            </Text>
            {courses.length > 0 ? (
              <View className="tdetail-course-list">
                {courses.map((c) => {
                  const price = formatPrice(c.price)
                  return (
                    <View key={c.id} className="tdetail-course-card" onClick={() => onOpenCourse(c.id)}>
                      {c.coverUrl ? (
                        <Image
                          className="tdetail-course-cover"
                          src={c.coverUrl}
                          mode="aspectFill"
                        />
                      ) : (
                        <View className="tdetail-course-cover" />
                      )}
                      <View className="tdetail-course-body">
                        <Text className="tdetail-course-title">{c.title}</Text>
                        <View className="tdetail-course-meta">
                          <Text
                            className={`tdetail-course-price ${price.free ? 'tdetail-course-price-free' : ''}`}
                          >
                            {price.text}
                          </Text>
                          <Text className="tdetail-course-students">
                            {formatStudents(c.students ?? 0)}
                            {tt('teacher.detail.learnUnit', '人学习')}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )
                })}
              </View>
            ) : (
              <Text className="tdetail-empty">
                {tt('teacher.detail.noCourses', '暂无课程')}
              </Text>
            )}
          </View>

          {/* 学员评价 */}
          <View className="tdetail-section">
            <Text className="tdetail-section-title">
              {tt('teacher.detail.reviewSection', '学员评价')}
            </Text>
            {reviews.length > 0 ? (
              <View className="tdetail-review-list">
                {reviews.map((rv) => (
                  <View key={rv.id} className="tdetail-review-card">
                    {rv.avatar ? (
                      <Image
                        className="tdetail-review-avatar"
                        src={rv.avatar}
                        mode="aspectFill"
                      />
                    ) : (
                      <View className="tdetail-review-avatar tdetail-review-avatar-fallback">
                        <Text>{rv.nickname.charAt(0) || '?'}</Text>
                      </View>
                    )}
                    <View className="tdetail-review-body">
                      <View className="tdetail-review-head">
                        <Text className="tdetail-review-name">{rv.nickname}</Text>
                        <Text className="tdetail-review-stars">{buildStars(rv.rating)}</Text>
                      </View>
                      <Text className="tdetail-review-content">{rv.content}</Text>
                      <Text className="tdetail-review-time">{rv.time}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text className="tdetail-empty">
                {tt('teacher.detail.noReviews', '暂无评价')}
              </Text>
            )}
          </View>

          {/* 底部按钮 */}
          <View className="tdetail-actions">
            <Text className="tdetail-action-btn tdetail-action-secondary" onClick={onContact}>
              {tt('teacher.detail.contact', '联系讲师')}
            </Text>
            <Text className="tdetail-action-btn tdetail-action-primary" onClick={onViewCourses}>
              {tt('teacher.detail.viewCourses', '查看全部课程')}
            </Text>
          </View>
        </>
      )}

      {!loading && !teacher && (
        <Text className="tdetail-skeleton">{tt('teacher.detail.notFound', '讲师不存在')}</Text>
      )}
    </View>
  )
}
