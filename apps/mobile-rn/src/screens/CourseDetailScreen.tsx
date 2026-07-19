import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Button, Card } from '@ihui/ui-native'
import {
  enrollCourse,
  getCourseById,
  getProgress,
  type Course,
  type LessonProgress,
} from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { HomeStackParamList } from '../navigation/RootNavigator'

type Route = RouteProp<HomeStackParamList, 'CourseDetail'>
type NavigationProp = NativeStackNavigationProp<HomeStackParamList>

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

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
        <Text className="mt-2 text-sm text-neutral-500">{t('common.loading')}</Text>
      </View>
    )
  }

  if (error || !course) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-4">
        <Text className="text-red-600">{error || t('course.loadFailed')}</Text>
        <Button className="mt-4" onPress={() => navigation.goBack()}>
          {t('common.back')}
        </Button>
      </View>
    )
  }

  return (
    <ScrollView className="flex-1 bg-white dark:bg-black">
      <View className="px-4 pt-12 pb-4">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text className="text-base text-neutral-700 dark:text-neutral-300">
            {t('common.back')}
          </Text>
        </TouchableOpacity>
        <Text className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
          {course.title}
        </Text>
        <View className="mt-2 flex-row flex-wrap gap-2">
          <Text className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
            {course.categoryName}
          </Text>
          <Text className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
            {course.level}
          </Text>
          <Text className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
            {t('course.studentCount', { count: course.studentCount })}
          </Text>
        </View>
      </View>

      <View className="px-4">
        <Card>
          <Text className="text-base font-semibold text-neutral-900 dark:text-neutral-50">
            {t('course.instructor')}:{course.instructor}
          </Text>
          <Text className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {t('course.rating')}:{course.rating.toFixed(1)}
          </Text>
          <Text className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">
            {course.description}
          </Text>
          <View className="mt-3 flex-row items-center justify-between">
            <Text className="text-lg font-semibold text-emerald-600">
              {course.isFree ? t('course.free') : `¥${course.price.toFixed(2)}`}
            </Text>
            {course.isEnrolled ? (
              <View className="rounded-md bg-emerald-100 px-3 py-1">
                <Text className="text-xs text-emerald-700">{t('course.enrolled')}</Text>
              </View>
            ) : (
              <Button loading={enrolling} onPress={onEnroll}>
                {course.isFree
                  ? t('course.enroll')
                  : t('course.pay', { amount: course.price.toFixed(2) })}
              </Button>
            )}
          </View>
        </Card>
      </View>

      <View className="px-4 mt-4 pb-8">
        <Text className="mb-2 text-lg font-semibold text-neutral-900 dark:text-neutral-50">
          {t('course.lessons')}
        </Text>
        {lessons.length === 0 ? (
          <Card>
            <Text className="text-sm text-neutral-500">{t('common.empty')}</Text>
          </Card>
        ) : (
          lessons.map((l) => (
            <TouchableOpacity
              key={l.lessonId}
              onPress={() => onPlay(l.lessonId)}
              className="mb-2 rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <View className="flex-row items-center justify-between">
                <Text
                  className="flex-1 text-sm text-neutral-900 dark:text-neutral-50"
                  numberOfLines={1}
                >
                  {l.title}
                </Text>
                {l.isCompleted ? (
                  <Text className="ml-2 text-xs text-emerald-600">{t('course.completed')}</Text>
                ) : null}
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  )
}
