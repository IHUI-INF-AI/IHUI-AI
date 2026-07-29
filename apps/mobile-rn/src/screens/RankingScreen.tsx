import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { RankingScreen as SharedRankingScreen, type RankingItem, type RankingRange } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function RankingScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [range, setRange] = useState<RankingRange>('weekly')
  const [list, setList] = useState<RankingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      setError('')
      const resp = await fetchApi<RankingItem[]>('/ranking', { params: { range } })
      if (!resp.success) {
        setError(t('ranking.loadFailed'))
        setLoading(false)
        setRefreshing(false)
        return
      }
      const uid = user?.id
      setList(
        (resp.data ?? []).map((i) => ({
          ...i,
          isMe: i.isMe || (uid !== undefined && i.id === String(uid)),
        })),
      )
      setLoading(false)
      setRefreshing(false)
    },
    [range, t, user?.id],
  )

  useEffect(() => {
    void load()
  }, [load])

  const onSelectRange = (next: RankingRange) => {
    if (next === range) return
    setRange(next)
  }

  const top3 = list.slice(0, 3)
  const rest = list.slice(3)

  return (
    <SharedRankingScreen
      t={t}
      top3={top3}
      rest={rest}
      range={range}
      onSelectRange={onSelectRange}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={() => load(true)}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
