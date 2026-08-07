import { useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  getAllStudyProgress,
  getCourses,
  getLiveList,
  type Course,
  type Live,
  type StudyProgress,
} from '@ihui/api-client'
import {
  HomeScreen as SharedHomeScreen,
  type HomeLiveItem,
  type HomeMenuItem,
  type HomeProgressItem,
  type HomeRecommendItem,
} from '@ihui/rn-app'
import CourseCarousel, { type CourseCarouselItem } from '../components/CourseCarousel'
import { useAuth } from '../context/AuthContext'
import { useNotificationStore } from '../stores/notification'
import { useI18n } from '../i18n'
import type { HomeStackParamList } from '../navigation/RootNavigator'
import { formatShortDateTime } from '../utils/date-utils'

type NavigationProp = NativeStackNavigationProp<HomeStackParamList>

const MENU_ITEMS: HomeMenuItem[] = [
  { key: 'Search', labelKey: 'menu.search', icon: '🔍' },
  { key: 'History', labelKey: 'menu.history', icon: '🕘' },
  { key: 'Bookmark', labelKey: 'menu.bookmark', icon: '🔖' },
  { key: 'CourseFilter', labelKey: 'menu.courseFilter', icon: '🎯' },
  { key: 'LiveList', labelKey: 'menu.liveList', icon: '📡' },
  { key: 'LivePlaybackList', labelKey: 'menu.livePlaybackList', icon: '🎬' },
  { key: 'CourseAnnex', labelKey: 'menu.courseAnnex', icon: '📎' },
  { key: 'CourseResource', labelKey: 'menu.courseResource', icon: '📚' },
  { key: 'CourseQAList', labelKey: 'menu.courseQAList', icon: '❓' },
]

function toRecommend(courses: Course[]): HomeRecommendItem[] {
  return courses.map((c) => ({
    id: c.id,
    title: c.title,
    instructor: c.instructor,
    level: c.level,
    studentCount: c.studentCount,
    price: c.price,
    isFree: c.isFree,
  }))
}

function toLiveItem(lives: Live[]): HomeLiveItem[] {
  return lives.map((l) => ({
    id: l.id,
    title: l.title,
    lecturerName: l.lecturerName,
    isLive: l.isLive,
    startTimeText: formatShortDateTime(l.startTime),
  }))
}

function toProgressItem(items: StudyProgress[]): HomeProgressItem[] {
  return items.map((p) => ({
    courseId: p.courseId,
    courseTitle: p.courseTitle,
    progress: p.progress,
    completedLessons: p.completedLessons,
    totalLessons: p.totalLessons,
  }))
}

/** 顶部轮播:取前 5 条推荐课程,适配 CourseCarouselItem 形状 */
function toCarouselItems(items: HomeRecommendItem[]): CourseCarouselItem[] {
  return items.slice(0, 5).map((r) => ({
    id: r.id,
    title: r.title,
    price: r.price,
    isFree: r.isFree,
    icon: '📘',
  }))
}

export function HomeScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const { user } = useAuth()
  const { connected, unreadCount, setVisible } = useNotificationStore()
  const [recommends, setRecommends] = useState<HomeRecommendItem[]>([])
  const [lives, setLives] = useState<HomeLiveItem[]>([])
  const [progress, setProgress] = useState<HomeProgressItem[]>([])
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
    if (courseRes.success) setRecommends(toRecommend(courseRes.data.list))
    if (liveRes.success) setLives(toLiveItem(liveRes.data.list))
    if (progressRes.success) setProgress(toProgressItem(progressRes.data.list))
    if (!courseRes.success && !liveRes.success && !progressRes.success) {
      setError(courseRes.error || liveRes.error || progressRes.error || t('common.networkError'))
    }
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const carouselItems = useMemo<CourseCarouselItem[]>(
    () => toCarouselItems(recommends),
    [recommends],
  )

  return (
    <View style={shellStyles.root}>
      <CourseCarousel
        courses={carouselItems}
        onPress={(id) => navigation.navigate('CourseDetail', { id })}
      />
      <SharedHomeScreen
        t={t}
        userNickname={user?.nickname || user?.phone || ''}
        connected={connected}
        unreadCount={unreadCount}
        recommends={recommends}
        lives={lives}
        progress={progress}
        menuItems={MENU_ITEMS}
        loading={loading}
        refreshing={refreshing}
        error={error}
        onRefresh={() => load(true)}
        onOpenNotifications={() => setVisible(true)}
        onPressProgress={(courseId) => navigation.navigate('CourseDetail', { id: courseId })}
        onPressLive={(id) => navigation.navigate('LiveDetail', { id })}
        onPressCourse={(id) => navigation.navigate('CourseDetail', { id })}
        onPressMenu={(key) => navigation.getParent()?.navigate(key as never)}
        onNavigateCourses={() => navigation.getParent()?.navigate('CourseTab' as never)}
        onNavigateLives={() => navigation.getParent()?.navigate('LiveTab' as never)}
      />
    </View>
  )
}

const shellStyles = {
  root: { flex: 1 } as const,
}
