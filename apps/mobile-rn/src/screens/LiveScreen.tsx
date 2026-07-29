import { useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getLiveList, type Live } from '@ihui/api-client'
import { LiveScreen as SharedLiveScreen, type LiveScreenItem } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { LiveStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<LiveStackParamList>

export function LiveScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [lives, setLives] = useState<Live[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    const res = await getLiveList({ page: 1, pageSize: 20 })
    if (res.success) {
      setLives(res.data.list)
    } else {
      setError(res.error || t('live.loadFailed'))
    }
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const items: LiveScreenItem[] = lives.map((live) => ({
    id: live.id,
    title: live.title,
    lecturerName: live.lecturerName ?? undefined,
    isLive: live.isLive,
    startTime: live.startTime,
    viewCount: live.viewCount,
  }))

  return (
    <SharedLiveScreen
      t={t}
      items={items}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={() => load(true)}
      onPressItem={(id) => navigation.navigate('LiveDetail', { id })}
      onBack={() => navigation.goBack()}
    />
  )
}
