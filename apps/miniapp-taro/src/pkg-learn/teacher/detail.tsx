// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 薄壳:渲染全部委托共享屏 packages/app/src/features/lecturer-detail/LecturerDetailScreen.tsx
// 端内只留平台事实:取数(GET /teacher/:id 与 /teacher/:id/courses)、关注 POST、联系弹层、导航出口。
import { useI18n, useTt } from '@/i18n'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { useState, useCallback, useEffect, useMemo } from 'react'
import { getTeacherDetail, get, post, type Teacher } from '@/api'
import { logger } from '@/utils/logger'
import ThemeRoot from '@/components/ThemeRoot'
import { LecturerDetailScreen } from '@ihui/rn-app/features/lecturer-detail/LecturerDetailScreen'
import type {
  LecturerDetailCourse,
  LecturerDetailInfo,
  LecturerDetailReview,
  OnNavigate,
} from '@ihui/types'
import { useAppTheme } from '@/lib/theme'
import { onToast } from '@/host/on-toast'

interface TeacherCourse {
  id: string | number
  title: string
  coverUrl?: string
  price?: number
  students?: number
}

interface TeacherExtra extends Teacher {
  fans?: number
  rating?: number
  isFollowed?: boolean
}

/** B1 契约冻结:共享屏本轮只 assert 端口、尚未调用导航(与 about-shared 同形制)。 */
const onNavigate: OnNavigate = (target) => {
  onToast(`导航未接入: ${target}`, { kind: 'error' })
}

/** 评价无真数据源(全仓无课程/讲师评价表),保持空列表,不造数据。 */
const REVIEWS: LecturerDetailReview[] = []

export default function TeacherDetail() {
  const { t } = useI18n()
  const tt = useTt()
  const { resolved } = useAppTheme()
  const router = useRouter()
  const [teacher, setTeacher] = useState<TeacherExtra | null>(null)
  const [courses, setCourses] = useState<TeacherCourse[]>([])
  const [loading, setLoading] = useState(true)
  const [followed, setFollowed] = useState(false)

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
      logger.error('teacher/detail', t('teacherDetail.q1'), e)
      onToast(tt('common.failed', '加载失败'), { kind: 'error' })
    } finally {
      setLoading(false)
    }
    try {
      const res = await get<{ list: TeacherCourse[] }>(`/teacher/${id}/courses`)
      setCourses(res?.list || [])
    } catch {
      setCourses([])
    }
  }, [router.params.id, tt, t])

  useDidShow(() => {
    load()
  })

  // 原生导航栏标题对齐共享屏 Header(本页无自绘标题栏,原生导航栏就是共享屏 Header 的承载位)
  useEffect(() => {
    Taro.setNavigationBarTitle({ title: teacher?.name || tt('teacher.list.title', '讲师') }).catch(
      () => {},
    )
  }, [teacher?.name, tt])

  const onToggleFollow = useCallback(async () => {
    if (!teacher) return
    const next = !followed
    setFollowed(next)
    try {
      await post(`/teacher/${teacher.id}/follow`, { follow: next })
      onToast(
        next ? tt('teacher.detail.followed', '已关注') : tt('teacher.detail.unfollowed', '已取消'),
        { kind: 'info' },
      )
    } catch (e) {
      setFollowed(!next)
      logger.error('teacher/detail', t('teacherDetail.q2'), e)
    }
  }, [teacher, followed, tt, t])

  const onContact = useCallback(() => {
    if (!teacher) return
    Taro.showActionSheet({
      itemList: [
        tt('teacher.detail.contactMessage', '发消息'),
        tt('teacher.detail.contactPhone', '电话联系'),
      ],
      success: (res) => {
        if (res.tapIndex === 0) {
          // 项目无 /pages/im/* 私信页,优雅降级为提示
          onToast(tt('teacher.detail.imSoon', '私信功能即将开放'), { kind: 'info' })
        } else if (res.tapIndex === 1) {
          onToast(tt('teacher.detail.phoneHint', '已复制联系方式'), { kind: 'info' })
        }
      },
    })
  }, [teacher, tt])

  const onViewCourses = useCallback((teacherName: string) => {
    Taro.navigateTo({ url: `/pkg-learn/course/list?keyword=${encodeURIComponent(teacherName)}` })
  }, [])

  const onOpenCourse = useCallback((courseId: string) => {
    Taro.navigateTo({ url: `/pkg-learn/course/detail?id=${courseId}` })
  }, [])

  // 取数面 → 共享屏 info(字段名两端同一份 @ihui/types,这里只做列名映射,不造数据)
  const info = useMemo<LecturerDetailInfo | null>(() => {
    if (!teacher) return null
    const courseCount = teacher.courses ?? 0
    const studentCount = teacher.students ?? 0
    return {
      id: String(teacher.id),
      nickname: teacher.name,
      avatar: teacher.avatar ?? null,
      title: teacher.title,
      intro: teacher.intro,
      fans: teacher.fans ?? 0,
      rating: teacher.rating ?? 0,
      courseCount,
      studentCount,
      isFollowing: followed,
      isGold: courseCount >= 10 || studentCount >= 1000,
    }
  }, [teacher, followed])

  const mappedCourses = useMemo<LecturerDetailCourse[]>(
    () =>
      courses.map((c) => ({
        id: String(c.id),
        title: c.title,
        coverUrl: c.coverUrl,
        price: c.price,
        students: c.students,
      })),
    [courses],
  )

  return (
    <ThemeRoot>
      <LecturerDetailScreen
        t={t}
        info={info}
        courses={mappedCourses}
        reviews={REVIEWS}
        loading={loading}
        error=""
        onToggleFollow={onToggleFollow}
        onContact={onContact}
        onOpenCourse={onOpenCourse}
        onBack={() => Taro.navigateBack()}
        colorScheme={resolved}
        onViewCourses={onViewCourses}
        onNavigate={onNavigate}
      />
    </ThemeRoot>
  )
}
