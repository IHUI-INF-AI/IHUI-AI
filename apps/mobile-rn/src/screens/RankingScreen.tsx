import { useCallback, useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import {
  RankingScreen as SharedRankingScreen,
  type RankingItem,
  type RankingRange,
} from '@ihui/rn-app'
import FullRankingList, { type FullRankingItem } from '../components/FullRankingList'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 排行榜数据 → FullRankingItem(取昵称首字母作头像占位) */
function toFullRankingItems(items: RankingItem[]): FullRankingItem[] {
  return items.map((i) => ({
    id: i.id,
    rank: i.rank,
    nickname: i.nickname,
    value: i.points,
    avatarInitial: i.nickname ? i.nickname.slice(0, 1).toUpperCase() : undefined,
  }))
}

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
  const fullItems = useMemo<FullRankingItem[]>(() => toFullRankingItems(list), [list])

  return (
    <View style={shellStyles.root}>
      <View style={shellStyles.rankingWrap}>
        <FullRankingList items={fullItems} valueLabel="积分" />
      </View>
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
    </View>
  )
}

const shellStyles = {
  root: { flex: 1 } as const,
  rankingWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 } as const,
}
