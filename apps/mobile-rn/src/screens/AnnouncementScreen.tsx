import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import {
  AnnouncementScreen as SharedAnnouncementScreen,
  type AnnouncementItem,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * 公告列表屏 wrapper — 平台特定层
 *
 * 负责:useI18n 取 t、useTheme 取 resolvedTheme、useNavigation 取 navigation、
 * fetchApi 拉数据,把依赖通过 props 注入共享组件。
 */
export function AnnouncementScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [items, setItems] = useState<AnnouncementItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetchApi<AnnouncementItem[]>('/announcements')
      if (!res.success) throw new Error()
      setItems(res.data ?? [])
    } catch {
      setError(t('announcement.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = () => {
    setRefreshing(true)
    void load()
  }

  const onPressItem = (item: AnnouncementItem) => {
    navigation.navigate('AnnouncementDetail', { id: item.id })
  }

  return (
    <SharedAnnouncementScreen
      t={t}
      items={items}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={onRefresh}
      onPressItem={onPressItem}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
