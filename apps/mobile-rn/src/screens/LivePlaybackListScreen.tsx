import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import {
  LivePlaybackListScreen as SharedLivePlaybackListScreen,
  type LivePlaybackItem,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * 直播回放列表屏 wrapper — 平台特定层
 *
 * 负责:useI18n 取 t、useTheme 取 resolvedTheme、useNavigation 取 navigation、
 * fetchApi 拉数据,把依赖通过 props 注入共享组件。
 * 原实现无卡片点击跳转,onPressItem 传 no-op。
 */
export function LivePlaybackListScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [items, setItems] = useState<LivePlaybackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetchApi<LivePlaybackItem[]>('/live/history')
      if (!res.success) throw new Error()
      setItems(res.data ?? [])
    } catch {
      setError(t('livePlaybackList.loadFailed'))
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

  return (
    <SharedLivePlaybackListScreen
      t={t}
      items={items}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={onRefresh}
      onPressItem={() => {}}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
