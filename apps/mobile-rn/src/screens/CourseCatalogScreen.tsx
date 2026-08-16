import { useCallback, useEffect, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import {
  CourseCatalogScreen as SharedCourseCatalogScreen,
  type CourseCatalogItem,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Route = RouteProp<RootStackParamList, 'CourseCatalog'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function CourseCatalogScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { courseId } = route.params
  const [items, setItems] = useState<CourseCatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchApi<CourseCatalogItem[]>(
        `/api/courses/${encodeURIComponent(courseId)}/catalog`,
      )
      if (!res.success) throw new Error(res.error)
      setItems(res.data ?? [])
    } catch {
      setError(t('courseCatalog.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [courseId, t])

  useEffect(() => {
    void load()
  }, [load])

  const onPressItem = (item: CourseCatalogItem) => {
    // 路由参数契约为 { courseId }(RootStackParamList 'CourseChapter'),传章节 id
    navigation.navigate('CourseChapter', { courseId: item.id })
  }

  return (
    <SharedCourseCatalogScreen
      t={t}
      items={items}
      loading={loading}
      error={error}
      onPressItem={onPressItem}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
