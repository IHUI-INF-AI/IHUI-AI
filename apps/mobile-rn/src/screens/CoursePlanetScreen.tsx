import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useI18n } from '../i18n'
import { CoursePlanetScreen as SharedCoursePlanetScreen } from '@ihui/rn-app'
import { fetchApi } from '@ihui/api-client'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function CoursePlanetScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()

  const [data, setData] = useState<{
    hot: { id: string; title: string; coverImage?: string; price: number; isFree: boolean }[]
    beginner: { id: string; title: string; coverImage?: string; price: number; isFree: boolean }[]
    selected: { id: string; title: string; coverImage?: string; price: number; isFree: boolean }[]
  }>({
    hot: [],
    beginner: [],
    selected: [],
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [selectedType, setSelectedType] = useState<'all' | 'free' | 'paid'>('all')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetchApi<{
        hot: { id: string; title: string; coverImage?: string; price: number; isFree: boolean }[]
        beginner: {
          id: string
          title: string
          coverImage?: string
          price: number
          isFree: boolean
        }[]
        selected: {
          id: string
          title: string
          coverImage?: string
          price: number
          isFree: boolean
        }[]
      }>('/api/course-planet')
      if (res.success && res.data) {
        setData(res.data)
      } else {
        setError('加载失败，请下拉刷新重试')
      }
    } catch {
      setError('加载失败，请下拉刷新重试')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    void load()
  }, [load])

  const onCoursePress = useCallback(
    (id: string) => {
      navigation.navigate('CourseDetail', { id })
    },
    [navigation],
  )

  return (
    <SharedCoursePlanetScreen
      t={t}
      data={data}
      loading={loading}
      refreshing={refreshing}
      error={error}
      selectedType={selectedType}
      onTypeChange={setSelectedType}
      onCoursePress={onCoursePress}
      onRefresh={onRefresh}
      onBack={() => navigation.goBack()}
    />
  )
}

export default CoursePlanetScreen
