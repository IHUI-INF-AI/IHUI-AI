import { useCallback, useEffect, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import {
  LecturerDetailScreen as SharedLecturerDetailScreen,
  type LecturerDetailCourse,
  type LecturerDetailInfo,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Route = RouteProp<RootStackParamList, 'LecturerDetail'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function LecturerDetailScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<Route>()
  const lecturerId = route.params.id

  const [info, setInfo] = useState<LecturerDetailInfo | null>(null)
  const [courses, setCourses] = useState<LecturerDetailCourse[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [followLoading, setFollowLoading] = useState(false)

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      setError('')
      const [infoRes, coursesRes] = await Promise.all([
        fetchApi<LecturerDetailInfo>(`/live/lecturers/${lecturerId}`),
        fetchApi<{ list: LecturerDetailCourse[] }>(
          `/lecturers/${lecturerId}/courses?page=1&pageSize=20`,
        ),
      ])
      if (!infoRes.success || !coursesRes.success) {
        setError(t('lecturerDetail.loadFailed'))
        setLoading(false)
        setRefreshing(false)
        return
      }
      setInfo(infoRes.data ?? null)
      setCourses(coursesRes.data?.list ?? [])
      setLoading(false)
      setRefreshing(false)
    },
    [lecturerId, t],
  )

  useEffect(() => {
    void load()
  }, [load])

  const handleFollow = async () => {
    if (!info) return
    setFollowLoading(true)
    const res = await fetchApi(`/follows/${info.id}`, {
      method: info.isFollowing ? 'DELETE' : 'POST',
    })
    setFollowLoading(false)
    if (res.success) {
      setInfo({
        ...info,
        isFollowing: !info.isFollowing,
        followers: info.followers + (info.isFollowing ? -1 : 1),
      })
    }
  }

  return (
    <SharedLecturerDetailScreen
      t={t}
      info={info}
      courses={courses}
      loading={loading}
      refreshing={refreshing}
      error={error}
      followLoading={followLoading}
      onRefresh={() => load(true)}
      onFollow={handleFollow}
      onRetry={() => load()}
      onBack={() => navigation.goBack()}
    />
  )
}
