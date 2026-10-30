// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对齐目标(RN 共享屏): packages/app/src/features/course-detail/CourseDetailScreen.tsx
import { useI18n } from '@/i18n'
import { View, Text } from '@tarojs/components'
import LineIcon from '@/components/LineIcon'
import Taro, { useRouter, useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { useState, useEffect, useCallback } from 'react'
import { get, getCourseDetail, post, type Course } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'
import { ScreenSkeleton } from '@/components/ScreenStates.taro'
import {
  CourseHeader,
  CourseCatalog,
  TeacherCard,
  CourseIntro,
  LessonListItem,
  ProgressCircle,
  NoteEditor,
  LessonComplete,
  StudyStats,
  CourseRating,
  QrCodeShare,
  LearningStreak,
  type CourseHeaderData,
  type LessonListItemData,
  type StreakDay,
} from '@/components'

export default function CourseDetail() {
  const router = useRouter()
  const { t, tList } = useI18n()
  const [course, setCourse] = useState<Course | null>(null)
  const [showNote, setShowNote] = useState(false)
  const [showRating, setShowRating] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [showComplete, setShowComplete] = useState(false)
  // 真实学习进度:原先硬编码 35 ⇒ 进度环、"已看 N 课时"、"当前课时"与统计数字全是编的。
  const [learningProgress, setLearningProgress] = useState(0)
  const [noteContent, setNoteContent] = useState('')

  const loadDetail = useCallback(
    async (id: string | number) => {
      try {
        const res = await getCourseDetail(id)
        setCourse(res)
        // GET /edu/courses/:id/progress 返回 { progress };未报名时 404 ⇒ 按 0 处理(不弹错)。
        try {
          const p = await get<{ progress?: number }>(
            `/edu/courses/${encodeURIComponent(id)}/progress`,
          )
          setLearningProgress(typeof p.progress === 'number' ? p.progress : 0)
        } catch {
          setLearningProgress(0)
        }
      } catch {
        Taro.showToast({ title: t('course.loadFailed'), icon: 'none' })
      }
    },
    [t],
  )

  useEffect(() => {
    const id = router.params.id || ''
    if (id) loadDetail(id)
  }, [router.params.id, loadDetail])

  useShareAppMessage(() => ({
    title: course ? t('share.courseTitle', { title: course.title }) : t('share.appTitle'),
    path: router.path ? `${router.path}?id=${router.params.id || ''}` : '/pkg-learn/course/detail',
    imageUrl: course?.coverUrl || '/static/share.png',
  }))
  useShareTimeline(() => ({
    title: course ? t('share.courseTitle', { title: course.title }) : t('share.timelineTitle'),
    query: `id=${router.params.id || ''}`,
  }))

  const handleBuy = useCallback(async () => {
    const courseId = course?.id
    if (courseId === null || courseId === undefined) return
    try {
      const res = await post<{
        orderId?: string
        orderNo?: string
        amount?: number
        status?: string
      }>('/courses/buy', { courseId })
      // 后端 /courses/buy 是**余额直接扣款**：成功即 status='paid'（余额已在服务端扣掉），
      // 免费课返回 status='free'。改前不看 status 就一律跳收银台 ⇒ 用户余额已被扣一次，
      // 又被引到微信/支付宝再付一次（重复收费）。已支付/免费都在本页收口。
      if (res?.status === 'paid' || res?.status === 'free') {
        Taro.showToast({ title: t('common.success'), icon: 'success' })
        setTimeout(() => {
          void Taro.navigateBack()
        }, 600)
        return
      }
      // 仍走预付单的入口：只读 `router.params.orderNo`（pkg-shop/pay/index.tsx，no 为空时
      // onPay 直接弹「订单异常」），因此订单号必须作为 orderNo 传，不能当 orderId 传。
      const orderNo = res?.orderNo || res?.orderId || ''
      const amount = res?.amount ?? course?.price ?? 0
      if (!orderNo) {
        Taro.showToast({ title: t('course.buyDeveloping'), icon: 'none' })
        return
      }
      Taro.navigateTo({
        url: `/pkg-shop/pay/index?orderNo=${encodeURIComponent(orderNo)}&amount=${amount}`,
      })
    } catch {
      // 失败原因已由 api-bridge 统一 toast（余额不足会显示后端原文 402「余额不足」），
      // 这里不能再盖一句「功能开发中」——那会让用户以为课程买不了是产品没上线。
    }
  }, [course?.id, course?.price, t])

  const handleTeacherClick = useCallback(() => {
    const teacherId =
      (course as (Course & { teacherId?: string | number }) | null)?.teacherId ?? course?.id ?? ''
    if (!teacherId) return
    Taro.navigateTo({ url: `/pkg-learn/teacher/detail?id=${teacherId}` })
  }, [course])

  // 三处原先都只弹"成功"toast、一个请求都不发 ⇒ 用户以为签到/评价/笔记已保存,
  // 实际什么都没落库(笔记尤其:写完的内容直接丢失)。接上后端真实端点。
  const handleSign = useCallback(async () => {
    try {
      await post('/sign-in', {})
      Taro.showToast({ title: t('course.signSuccess'), icon: 'success' })
    } catch {
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    }
  }, [t])

  const handleLessonClick = useCallback(
    (lesson: LessonListItemData, idx: number) => {
      if (lesson.locked) {
        Taro.showToast({ title: t('course.buyFirst'), icon: 'none' })
        return
      }
      Taro.navigateTo({
        url: `/pages/study/video-detail/index?courseId=${course?.id || ''}&lessonIdx=${idx}`,
      })
    },
    [course?.id, t],
  )

  const handleSubmitRating = useCallback(
    async (rating: number, comment: string) => {
      const courseId = router.params.id || ''
      if (!courseId) return
      try {
        // 课程页只有一个星级,后端 createRateSchema 按三个分项存 ⇒ 统一填到"内容实用性"
        // (最接近"这门课好不好"的整体判断),不虚构另外两项。
        await post(`/learn/${encodeURIComponent(courseId)}/rates`, {
          content: comment.trim() || undefined,
          contentUtilityScore: Math.min(5, Math.max(1, Math.round(rating))),
        })
        setShowRating(false)
        Taro.showToast({ title: t('course.rated', { n: rating }), icon: 'success' })
      } catch {
        Taro.showToast({ title: t('common.failed'), icon: 'none' })
      }
    },
    [t, router.params.id],
  )

  const handleSaveNote = useCallback(
    async (content: string) => {
      const courseId = router.params.id || ''
      const text = content.trim()
      if (!courseId || !text) return
      try {
        await post(`/edu/courses/${encodeURIComponent(courseId)}/notes`, { content: text })
        setNoteContent(content)
        setShowNote(false)
        Taro.showToast({ title: t('course.noteSaved'), icon: 'success' })
      } catch {
        Taro.showToast({ title: t('common.failed'), icon: 'none' })
      }
    },
    [t, router.params.id],
  )

  const handleLessonComplete = useCallback(() => {
    setShowComplete(false)
    setLearningProgress((p) => Math.min(100, p + 10))
    Taro.showToast({ title: t('course.lessonComplete'), icon: 'success' })
  }, [t])

  if (!course) {
    return (
      <ThemeRoot>
        <View className="min-h-screen bg-background">
          <ScreenSkeleton variant="list" count={4} />
        </View>
      </ThemeRoot>
    )
  }

  const headerData: CourseHeaderData = {
    title: course.title,
    cover: course.coverUrl,
    teacher: course.teacher,
    lessonCount: course.outline?.length,
    price: course.price ?? 0,
    tags: course.subtitle ? [course.subtitle] : undefined,
  }

  const lessons: LessonListItemData[] = (course.outline || []).map((item, idx) => ({
    id: String(idx),
    title: item.title,
    duration: item.duration,
    type: 'video',
    isFree: idx === 0,
    watched: idx < Math.floor((learningProgress / 100) * (course.outline?.length || 0)),
    locked: idx > 0 && (course.price ?? 0) > 0,
  }))

  const weekDays: StreakDay[] = [
    { date: '一', signed: true, isToday: false },
    { date: '二', signed: true, isToday: false },
    { date: '三', signed: false, isToday: false },
    { date: '四', signed: true, isToday: false },
    { date: '五', signed: false, isToday: true },
    { date: '六', signed: false, isToday: false },
    { date: '日', signed: false, isToday: false },
  ]

  return (
    <ThemeRoot>
      <View className="min-h-screen pb-[120rpx] bg-background">
        <CourseHeader
          data={headerData}
          onTeacherClick={() => Taro.showToast({ title: t('course.viewTeacher'), icon: 'none' })}
        />

        {/* 工具行卡片:对齐 RN card(白底 + border.light 描边 + radius12/padding14) */}
        <View className="flex items-center justify-around mx-3 my-3 bg-card rounded-lg p-[28rpx] border border-border">
          <View className="flex flex-col items-center">
            <ProgressCircle percent={learningProgress} size={60} />
            <Text className="text-xs text-muted-foreground mt-2">
              {t('course.learningProgress')}
            </Text>
          </View>
          <View
            className="flex flex-col items-center"
            hoverClass="opacity-60"
            onClick={() => setShowNote(true)}
          >
            <View className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <LineIcon name="book-open" size={40} color="var(--color-muted-foreground)" />
            </View>
            <Text className="text-xs text-muted-foreground mt-2">{t('course.note')}</Text>
          </View>
          <View
            className="flex flex-col items-center"
            hoverClass="opacity-60"
            onClick={() => setShowRating(true)}
          >
            <View className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
              <LineIcon name="star-fill" size={40} color="var(--color-warning)" />
            </View>
            <Text className="text-xs text-muted-foreground mt-2">{t('course.rating')}</Text>
          </View>
          <View
            className="flex flex-col items-center"
            hoverClass="opacity-60"
            onClick={() => setShowShare(true)}
          >
            <View className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <LineIcon name="share-2" size={40} color="var(--color-muted-foreground)" />
            </View>
            <Text className="text-xs text-muted-foreground mt-2">{t('course.share')}</Text>
          </View>
        </View>

        <LearningStreak
          streakDays={3}
          totalSigned={15}
          weekDays={weekDays}
          signedToday={false}
          onSign={handleSign}
        />

        <StudyStats
          data={{
            totalMinutes: 480,
            totalLessons: Math.floor((learningProgress / 100) * (course.outline?.length || 0)),
            streakDays: 3,
            weekMinutes: 180,
            weekTarget: 300,
          }}
        />

        <TeacherCard
          name={course.teacher || t('course.teacher')}
          title={t('course.goldTeacher')}
          bio={course.subtitle}
          courseCount={12}
          studentCount={1280}
          rating={4.8}
          isFollowing={false}
          onFollow={() => Taro.showToast({ title: t('course.followed'), icon: 'success' })}
          onClick={handleTeacherClick}
        />

        <CourseIntro
          data={{
            description: course.description || t('course.noIntro'),
            objectives: tList('course.objectives'),
            suitableFor: tList('course.suitableFor'),
            highlights: tList('course.highlights'),
          }}
        />

        <CourseCatalog
          lessons={lessons}
          currentId={String(Math.floor((learningProgress / 100) * (course.outline?.length || 0)))}
          onLessonClick={handleLessonClick}
        />

        <View className="mx-3 my-3">
          <LessonListItem
            data={{
              id: 'next',
              title: t('course.nextLesson', {
                title: course.outline?.[0]?.title || t('course.startLearning'),
              }),
              type: 'video',
              duration: '15:30',
            }}
            index={0}
            active
            onClick={() => setShowComplete(true)}
          />
        </View>

        {/* 底部购买条:价格/按钮字号字重对齐 RN actionRow(price 20dp w700 + enroll btn radius12/16dp 字) */}
        <View className="fixed left-0 right-0 bottom-0 h-[100rpx] bg-card flex items-center px-4 shadow-[0_-2rpx_12rpx_var(--color-black-6)]">
          <View className="flex-1 flex flex-row items-baseline">
            <Text className="text-[length:28rpx] text-primary font-bold">¥</Text>
            <Text className="text-[length:40rpx] text-primary font-bold">{course.price ?? 0}</Text>
          </View>
          <View
            className="px-[20rpx] h-[80rpx] leading-[80rpx] bg-cta text-cta-foreground rounded-xl text-[length:32rpx] font-semibold"
            hoverClass="opacity-60"
            onClick={handleBuy}
          >
            <Text>{t('course.buyNow')}</Text>
          </View>
        </View>

        <NoteEditor
          visible={showNote}
          initialContent={noteContent}
          title={t('course.noteTitle', { title: course.title })}
          onSave={handleSaveNote}
          onCancel={() => setShowNote(false)}
        />

        <CourseRating visible={showRating} initialRating={0} onSubmit={handleSubmitRating} />

        {showShare && (
          <View
            className="fixed inset-0 z-[2000] bg-[var(--color-black-40)]"
            onClick={() => setShowShare(false)}
          >
            <View
              className="absolute bottom-0 left-0 right-0 bg-card ui-panel rounded-t-xl"
              hoverClass="opacity-60"
              onClick={(e) => e.stopPropagation()}
            >
              <QrCodeShare
                title={course.title}
                desc={t('course.scanCourse')}
                userName=""
                onSave={() => setShowShare(false)}
                onShare={() => {
                  Taro.showShareMenu({ withShareTicket: true })
                  setShowShare(false)
                }}
              />
            </View>
          </View>
        )}

        <LessonComplete
          visible={showComplete}
          lessonTitle={course.outline?.[0]?.title || course.title}
          duration="15:30"
          points={10}
          nextLessonTitle={course.outline?.[1]?.title}
          onContinue={handleLessonComplete}
          onShare={() => Taro.showShareMenu({ withShareTicket: true })}
          onClose={() => setShowComplete(false)}
        />
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
