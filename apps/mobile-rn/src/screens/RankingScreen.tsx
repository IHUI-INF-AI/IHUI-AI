import { useCallback, useEffect, useMemo, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import {
  RankingScreen as SharedRankingScreen,
  type RankingItem,
  type RankingRange,
} from '@ihui/rn-app'
import FullRankingList, { type FullRankingItem } from '../components/FullRankingList'
import BottomFigure from '../components/BottomFigure'
import { BottomPops } from '../components/BottomPops'
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
  // BottomPops 排名详情弹层(对齐 Uniapp bottom-pops 详情展示)
  const [detailVisible, setDetailVisible] = useState(false)
  const [selectedItem, setSelectedItem] = useState<RankingItem | null>(null)

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

  /** 点击排名项 → 弹出 BottomPops 详情(对齐 Uniapp bottom-pops/index.vue) */
  const onItemPress = useCallback((id: string) => {
    const item = list.find((i) => i.id === id)
    if (item) {
      setSelectedItem(item)
      setDetailVisible(true)
    }
  }, [list])

  return (
    <View style={shellStyles.root}>
      <ScrollView style={shellStyles.scroll} contentContainerStyle={shellStyles.scrollContent}>
        <View style={shellStyles.rankingWrap}>
          <FullRankingList items={fullItems} valueLabel="积分" onPress={onItemPress} />
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
        {/* BottomFigure 底部装饰图(对齐 Uniapp BottomFigure/index.vue) */}
        <View style={shellStyles.bottomFigureWrap}>
          <BottomFigure height={120} />
        </View>
      </ScrollView>
      {/* BottomPops 排名详情弹层(对齐 Uniapp bottom-pops/index.vue) */}
      <BottomPops
        visible={detailVisible}
        title="排名详情"
        onClose={() => setDetailVisible(false)}
      >
        {selectedItem ? (
          <View style={shellStyles.detailContent}>
            <Text style={shellStyles.detailText}>
              排名:第 {selectedItem.rank} 名
            </Text>
            <Text style={shellStyles.detailText}>
              昵称:{selectedItem.nickname}
            </Text>
            <Text style={shellStyles.detailText}>
              积分:{selectedItem.points}
            </Text>
          </View>
        ) : null}
      </BottomPops>
    </View>
  )
}

const shellStyles = {
  root: { flex: 1 } as const,
  scroll: { flex: 1 } as const,
  scrollContent: { paddingBottom: 16 } as const,
  rankingWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 } as const,
  bottomFigureWrap: { paddingHorizontal: 16, paddingTop: 16 } as const,
  detailContent: { gap: 10, paddingVertical: 8 } as const,
  detailText: { fontSize: 14, color: '#333' } as const,
}
