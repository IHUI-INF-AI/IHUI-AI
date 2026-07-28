import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { CourseQAListScreen as SharedCourseQAListScreen, type CourseQAListItem } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * 课程问答列表屏 — mobile-rn 薄 wrapper
 *
 * 仅负责:useI18n / useTheme / useNavigation / fetchApi 数据获取,
 * 把 t/items/loading/refreshing/error/onRefresh/onPressItem/onAsk/onBack/colorScheme
 * 透传给 @ihui/rn-app 共享组件。
 */
export function CourseQAListScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [items, setItems] = useState<CourseQAListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetchApi<CourseQAListItem[]>('/course-qa')
      if (!res.success) throw new Error()
      setItems(res.data ?? [])
    } catch {
      setError(t('courseQAList.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    void load()
  }, [load])

  return (
    <SharedCourseQAListScreen
      t={t}
      items={items}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={onRefresh}
      onPressItem={() => {}}
      onAsk={() => navigation.navigate('CourseQAAsk')}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
