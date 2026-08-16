import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  enrollCourse,
  getCourseById,
  getProgress,
  type Course,
  type LessonProgress,
} from '@ihui/api-client'
import {
  CourseDetailScreen as SharedCourseDetailScreen,
  type CourseDetailItem,
  type CourseDetailLesson,
} from '@ihui/rn-app'
import { NavBar } from '../components/NavBar'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Route = RouteProp<RootStackParamList, 'CourseDetail'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'CourseDetail'>

export function CourseDetailScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { id } = route.params
  const [course, setCourse] = useState<Course | null>(null)
  const [lessons, setLessons] = useState<LessonProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [enrolling, setEnrolling] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const [courseRes, progressRes] = await Promise.all([getCourseById(id), getProgress(id)])
      if (cancelled) return
      if (courseRes.success) {
        setCourse(courseRes.data)
      } else {
        setError(courseRes.error || t('course.loadFailed'))
      }
      if (progressRes.success) {
        setLessons(progressRes.data.lessons ?? [])
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, t])

  const onEnroll = async () => {
    if (!course) return
    setEnrolling(true)
    const res = await enrollCourse(course.id)
    setEnrolling(false)
    if (res.success) {
      setCourse({ ...course, isEnrolled: true })
    } else {
      setError(res.error || t('common.failed'))
    }
  }

  const onPlay = (lessonId: string) => {
    if (!course) return
    navigation.navigate('VideoPlayer', { courseId: course.id, lessonId, title: course.title })
  }

  const detailItem: CourseDetailItem | null = course
    ? {
        id: course.id,
        title: course.title,
        description: course.description,
        categoryName: course.categoryName,
        level: course.level,
        instructor: course.instructor,
        studentCount: course.studentCount,
        rating: course.rating,
        price: course.price,
        isFree: course.isFree,
        isEnrolled: course.isEnrolled,
      }
    : null

  const detailLessons: CourseDetailLesson[] = lessons.map((l) => ({
    lessonId: l.lessonId,
    title: l.title,
    isCompleted: l.isCompleted,
  }))

  return (
    <View style={{ flex: 1 }}>
      <NavBar title={course?.title ?? '课程详情'} onBack={() => navigation.goBack()} />
      <SharedCourseDetailScreen
        t={t}
        item={detailItem}
        lessons={detailLessons}
        loading={loading}
        error={error}
        enrolling={enrolling}
        onEnroll={onEnroll}
        onPlayLesson={onPlay}
        onBack={() => navigation.goBack()}
      />
    </View>
  )
}
