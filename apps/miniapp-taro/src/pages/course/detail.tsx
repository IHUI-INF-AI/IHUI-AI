import { View, Text } from '@tarojs/components'
import Taro, { useRouter, useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { useState, useEffect, useCallback } from 'react'
import { getCourseDetail, type Course } from '@/api'
import { useI18n } from '@/i18n'
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
  const [learningProgress, setLearningProgress] = useState(35)
  const [noteContent, setNoteContent] = useState('')

  const loadDetail = useCallback(
    async (id: string | number) => {
      try {
        const res = await getCourseDetail(id)
        setCourse(res)
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
    path: router.path ? `${router.path}?id=${router.params.id || ''}` : '/pages/course/detail',
    imageUrl: course?.coverUrl || '/static/share.png',
  }))
  useShareTimeline(() => ({
    title: course ? t('share.courseTitle', { title: course.title }) : t('share.timelineTitle'),
    query: `id=${router.params.id || ''}`,
  }))

  const handleBuy = useCallback(() => {
    Taro.showToast({ title: t('course.buyDeveloping'), icon: 'none' })
  }, [t])

  const handleSign = useCallback(() => {
    Taro.showToast({ title: t('course.signSuccess'), icon: 'success' })
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
    (rating: number, _comment: string) => {
      setShowRating(false)
      Taro.showToast({ title: t('course.rated', { n: rating }), icon: 'success' })
    },
    [t],
  )

  const handleSaveNote = useCallback(
    (content: string) => {
      setNoteContent(content)
      setShowNote(false)
      Taro.showToast({ title: t('course.noteSaved'), icon: 'success' })
    },
    [t],
  )

  const handleLessonComplete = useCallback(() => {
    setShowComplete(false)
    setLearningProgress((p) => Math.min(100, p + 10))
    Taro.showToast({ title: t('course.lessonComplete'), icon: 'success' })
  }, [t])

  if (!course) {
    return (
      <View className="flex items-center justify-center h-screen text-[#999]">
        <Text>{t('common.loading')}</Text>
      </View>
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
    <View className="min-h-screen pb-[80px] bg-[#f7f8fa]">
      <CourseHeader
        data={headerData}
        onTeacherClick={() => Taro.showToast({ title: t('course.viewTeacher'), icon: 'none' })}
      />

      <View className="flex items-center justify-around mx-3 my-3 bg-white rounded-xl p-4">
        <View className="flex flex-col items-center">
          <ProgressCircle percent={learningProgress} size={60} />
          <Text className="text-xs text-gray-500 mt-2">{t('course.learningProgress')}</Text>
        </View>
        <View className="flex flex-col items-center" onClick={() => setShowNote(true)}>
          <View className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
            <Text className="text-xl">📝</Text>
          </View>
          <Text className="text-xs text-gray-500 mt-2">{t('course.note')}</Text>
        </View>
        <View className="flex flex-col items-center" onClick={() => setShowRating(true)}>
          <View className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center">
            <Text className="text-xl">⭐</Text>
          </View>
          <Text className="text-xs text-gray-500 mt-2">{t('course.rating')}</Text>
        </View>
        <View className="flex flex-col items-center" onClick={() => setShowShare(true)}>
          <View className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
            <Text className="text-xl">📤</Text>
          </View>
          <Text className="text-xs text-gray-500 mt-2">{t('course.share')}</Text>
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
        onClick={() => Taro.navigateTo({ url: '/pages/teacher/detail?id=1' })}
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

      <View className="fixed left-0 right-0 bottom-0 h-[60px] bg-white flex items-center px-4 shadow-[0_-2rpx_12rpx_rgba(0,0,0,0.06)]">
        <View className="flex-1">
          <Text className="text-sm text-[#dd524d]">¥</Text>
          <Text className="text-2xl text-[#dd524d] font-bold">{course.price ?? 0}</Text>
        </View>
        <View
          className="px-7 h-10 leading-10 bg-[#07c160] text-white rounded-lg text-sm"
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
        <View className="fixed inset-0 z-50 bg-black/50" onClick={() => setShowShare(false)}>
          <View
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl"
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
  )
}
