import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Button, Card } from '@ihui/ui-native'
import {
  getAllStudyProgress,
  getCourses,
  getLiveList,
  type Course,
  type Live,
  type StudyProgress,
} from '@ihui/api-client'
import { useAuth } from '../context/AuthContext'
import { useNotificationStore } from '../stores/notification'
import { useI18n } from '../i18n'
import type { HomeStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<HomeStackParamList>

function greetingKey(): 'home.greetingMorning' | 'home.greetingNoon' | 'home.greetingAfternoon' | 'home.greetingEvening' {
  const h = new Date().getHours()
  if (h < 11) return 'home.greetingMorning'
  if (h < 13) return 'home.greetingNoon'
  if (h < 18) return 'home.greetingAfternoon'
  return 'home.greetingEvening'
}

function formatStart(iso: string): string {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return ''
  }
}

export function HomeScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const { user } = useAuth()
  const { connected, unreadCount, setVisible } = useNotificationStore()
  const [recommends, setRecommends] = useState<Course[]>([])
  const [lives, setLives] = useState<Live[]>([])
  const [progress, setProgress] = useState<StudyProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    const [courseRes, liveRes, progressRes] = await Promise.all([
      getCourses({ page: 1, pageSize: 6 }),
      getLiveList({ page: 1, pageSize: 3 }),
      getAllStudyProgress({ page: 1, pageSize: 3 }),
    ])
    if (courseRes.success) setRecommends(courseRes.data.list)
    if (liveRes.success) setLives(liveRes.data.list)
    if (progressRes.success) setProgress(progressRes.data.list)
    if (!courseRes.success && !liveRes.success && !progressRes.success) {
      setError(courseRes.error || liveRes.error || progressRes.error || t('common.networkError'))
    }
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => {
    void load()
  }, [])

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    )
  }

  const firstProgress = progress[0]

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-black"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      <View className="flex-row items-center justify-between px-4 pt-12">
        <View className="flex-1">
          <Text className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
            {t(greetingKey())},
            {user?.nickname || user?.phone || '访客'}
          </Text>
          <Text className="mt-1 text-xs text-neutral-500">{t('home.welcome')}</Text>
        </View>
        <View className="flex-row items-center">
          <View
            className={`mr-2 h-2 w-2 rounded-md ${connected ? 'bg-emerald-500' : 'bg-neutral-400'}`}
            accessibilityLabel={connected ? 'connected' : 'disconnected'}
          />
          <TouchableOpacity onPress={() => setVisible(true)} className="p-1">
            <Text className="text-lg">🔔</Text>
            {unreadCount > 0 ? (
              <View className="absolute -right-1 -top-1 min-w-[16px] items-center justify-center rounded-md bg-red-500 px-1 h-4">
                <Text className="text-[10px] font-bold text-white">{unreadCount}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>
      </View>

      {error ? (
        <View className="px-4 py-2">
          <Text className="text-sm text-red-600">{error}</Text>
        </View>
      ) : null}

      <View className="px-4 mt-4">
        <Text className="mb-2 text-lg font-semibold text-neutral-900 dark:text-neutral-50">
          {t('home.learningProgress')}
        </Text>
        {firstProgress ? (
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('CourseDetail', { id: firstProgress.courseId })
            }
            activeOpacity={0.7}
          >
            <Card>
              <Text
                className="text-base font-semibold text-neutral-900 dark:text-neutral-50"
                numberOfLines={1}
              >
                {firstProgress.courseTitle || firstProgress.courseId}
              </Text>
              <View className="mt-2 h-2 overflow-hidden rounded-md bg-neutral-200">
                <View
                  className="h-2 bg-emerald-500"
                  style={{ width: `${Math.round((firstProgress.progress ?? 0) * 100)}%` }}
                />
              </View>
              <Text className="mt-1 text-xs text-neutral-500">
                {t('home.progressLessons', {
                  completed: firstProgress.completedLessons,
                  total: firstProgress.totalLessons,
                })}
              </Text>
            </Card>
          </TouchableOpacity>
        ) : (
          <Card>
            <Text className="text-sm text-neutral-500">{t('home.progressEmpty')}</Text>
            <Button
              className="mt-3"
              variant="outline"
              onPress={() => navigation.getParent()?.navigate('CourseTab' as never)}
            >
              {t('nav.courses')}
            </Button>
          </Card>
        )}
      </View>

      <View className="px-4 mt-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            {t('home.livePreview')}
          </Text>
          <TouchableOpacity onPress={() => navigation.getParent()?.navigate('LiveTab' as never)}>
            <Text className="text-xs text-emerald-600">{t('home.livePreviewMore')}</Text>
          </TouchableOpacity>
        </View>
        {lives.length === 0 ? (
          <Card className="mt-2">
            <Text className="text-sm text-neutral-500">{t('live.empty')}</Text>
          </Card>
        ) : (
          lives.map((l) => (
            <TouchableOpacity
              key={l.id}
              onPress={() => navigation.navigate('LiveDetail', { id: l.id })}
              className="mt-2"
              activeOpacity={0.7}
            >
              <Card>
                <View className="flex-row items-center justify-between">
                  <Text
                    className="flex-1 text-base font-semibold text-neutral-900 dark:text-neutral-50"
                    numberOfLines={1}
                  >
                    {l.title}
                  </Text>
                  <View
                    className={`rounded-md px-2 py-0.5 ${l.isLive ? 'bg-red-500' : 'bg-amber-500'}`}
                  >
                    <Text className="text-xs text-white">
                      {l.isLive ? t('live.ongoing') : t('live.upcoming')}
                    </Text>
                  </View>
                </View>
                {l.lecturerName ? (
                  <Text className="mt-1 text-xs text-neutral-500">
                    {t('live.lecturer')}:{l.lecturerName}
                  </Text>
                ) : null}
                <Text className="mt-1 text-xs text-neutral-400">
                  {t('live.startAt')}:{formatStart(l.startTime)}
                </Text>
              </Card>
            </TouchableOpacity>
          ))
        )}
      </View>

      <View className="px-4 mt-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            {t('home.recommend')}
          </Text>
          <TouchableOpacity onPress={() => navigation.getParent()?.navigate('CourseTab' as never)}>
            <Text className="text-xs text-emerald-600">{t('home.livePreviewMore')}</Text>
          </TouchableOpacity>
        </View>
        {recommends.length === 0 ? (
          <Card className="mt-2">
            <Text className="text-sm text-neutral-500">{t('course.empty')}</Text>
          </Card>
        ) : (
          recommends.map((c) => (
            <TouchableOpacity
              key={c.id}
              onPress={() => navigation.navigate('CourseDetail', { id: c.id })}
              className="mt-2"
              activeOpacity={0.7}
            >
              <Card>
                <View className="flex-row items-center justify-between">
                  <Text
                    className="flex-1 text-base font-semibold text-neutral-900 dark:text-neutral-50"
                    numberOfLines={1}
                  >
                    {c.title}
                  </Text>
                  <Text className="text-sm font-semibold text-emerald-600">
                    {c.isFree ? t('course.free') : `¥${c.price.toFixed(2)}`}
                  </Text>
                </View>
                <Text className="mt-1 text-xs text-neutral-500">
                  {c.instructor} · {c.level} · {t('course.studentCount', { count: c.studentCount })}
                </Text>
              </Card>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  )
}
