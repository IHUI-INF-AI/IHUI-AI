import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useI18n } from '../i18n'
import { KnowledgePlanetScreen as SharedKnowledgePlanetScreen } from '@ihui/rn-app'
import { fetchApi } from '@ihui/api-client'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const API_PATH = '/resource/getKnowledgePlanet?type=1'

function toTimestamp(time: string | number | undefined): number {
  if (time === undefined || time === null) return Date.now()
  if (typeof time === 'number') {
    return time < 1e12 ? time * 1000 : time
  }
  const parsed = Date.parse(time)
  return Number.isNaN(parsed) ? Date.now() : parsed
}

export function KnowledgePlanetScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [items, setItems] = useState<
    { id: string; title: string; cover?: string; summary?: string; createdAt: number }[]
  >([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetchApi<
        {
          id: string | number
          title: string
          img?: string
          time?: string | number
          classification?: string
        }[]
      >(API_PATH)
      if (!res.success) throw new Error()
      const rawList = res.data ?? []
      setItems(
        rawList.map((raw) => ({
          id: String(raw.id),
          title: raw.title,
          cover: raw.img,
          summary: raw.classification,
          createdAt: toTimestamp(raw.time),
        })),
      )
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

  const onItemClick = useCallback(
    (id: string) => {
      navigation.navigate('AnnouncementDetail', { id })
    },
    [navigation],
  )

  return (
    <SharedKnowledgePlanetScreen
      t={t}
      items={items}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={onRefresh}
      onItemClick={onItemClick}
      onBack={() => navigation.goBack()}
    />
  )
}
