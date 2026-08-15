import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import {
  getTokenBalance,
  getTokenFlows,
  getTopUpRecords,
  type TokenBalance,
} from '@ihui/api-client'
import {
  TokenValueScreen as SharedTokenValueScreen,
  type TokenRecordType,
  type TokenValueBalance,
  type TokenValuePackage,
  type TokenValueRecord,
} from '@ihui/rn-app'
import StudyBar from '../components/StudyBar'
import { formatShortDateTime } from '../utils/date-utils'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 记录时间范围 key(对齐 Uniapp token_value.vue barList 的 value: w/m/y/a) */
type RangeKey = 'w' | 'm' | 'y' | 'a'

const RANGE_ITEMS: readonly { key: RangeKey; label: string }[] = [
  { key: 'w', label: '7天' },
  { key: 'm', label: '一个月' },
  { key: 'y', label: '近一年' },
  { key: 'a', label: '全部' },
]

/** 各范围的天数(a=全部不设限) */
const RANGE_DAYS: Record<RangeKey, number> = { w: 7, m: 30, y: 365, a: Number.POSITIVE_INFINITY }

function formatToken(n: number): string {
  if (Math.abs(n) >= 100000000) return `${(n / 100000000).toFixed(2)}亿`
  if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(1)}万`
  return `${n}`
}

export default function TokenValueScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [tab, setTab] = useState<TokenRecordType>('all')
  const [balance, setBalance] = useState<TokenValueBalance | null>(null)
  // 全量记录 + 平行时间戳数组(StudyBar 按时间范围过滤用;TokenValueRecord 类型不含原始时间)
  const [allRecords, setAllRecords] = useState<TokenValueRecord[]>([])
  const [allTimes, setAllTimes] = useState<number[]>([])
  // 时间范围(对齐 Uniapp token_value.vue type 默认 'w' 7天)
  const [range, setRange] = useState<RangeKey>('w')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const [balRes, flowRes, topUpRes] = await Promise.all([
        getTokenBalance(),
        getTokenFlows({ page: 1, pageSize: 50 }),
        getTopUpRecords({ page: 1, pageSize: 50 }),
      ])

      if (balRes.success) {
        const bal: TokenBalance = balRes.data
        // TokenBalance API 不返回 frozen 字段,占位 0(保留 UI 结构)
        setBalance({ balance: bal.balance, frozen: 0, totalUsed: bal.totalUsed })
      }

      const flowItems = flowRes.success ? (flowRes.data.list ?? []) : []
      const topUpItems = topUpRes.success ? (topUpRes.data.list ?? []) : []

      // 用 ISO 时间戳排序,合并消耗与充值记录(倒序)
      const tagged: Array<{ iso: string; rec: TokenValueRecord }> = []
      for (const f of flowItems) {
        tagged.push({
          iso: f.createdAt,
          rec: {
            id: f.id,
            type: 'cost',
            title: `${f.agentName} · ${f.modelName}`,
            amount: -f.token,
            time: formatShortDateTime(f.createdAt),
          },
        })
      }
      for (const r of topUpItems) {
        tagged.push({
          iso: r.createdAt,
          rec: {
            id: r.orderId,
            type: 'recharge',
            title: `${t('tokenValue.rechargeLabel')} ¥${r.amount}`,
            amount: r.amount,
            time: formatShortDateTime(r.createdAt),
          },
        })
      }
      tagged.sort((a, b) => (a.iso < b.iso ? 1 : a.iso > b.iso ? -1 : 0))
      setAllRecords(tagged.map((item) => item.rec))
      setAllTimes(tagged.map((item) => new Date(item.iso).getTime()))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('tokenValue.loadFailed'))
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

  const handleRecharge = (p: TokenValuePackage) =>
    Alert.alert(
      t('tokenValue.recharge.title'),
      t('tokenValue.recharge.message', { tokens: formatToken(p.tokens), price: p.price }),
      [
        { text: t('common.cancel') },
        {
          text: t('tokenValue.recharge.payBtn'),
          onPress: () =>
            Alert.alert(
              t('tokenValue.recharge.success.title'),
              t('tokenValue.recharge.success.message', {
                tokens: formatToken(p.tokens + p.bonus),
              }),
            ),
        },
      ],
    )

  // StudyBar 时间范围过滤(对齐 Uniapp token_value.vue onTabChange → type 参数重新拉取;此处前端过滤已加载记录)
  const records = useMemo(() => {
    if (range === 'a') return allRecords
    const cutoff = Date.now() - RANGE_DAYS[range] * 24 * 60 * 60 * 1000
    return allRecords.filter((_, i) => (allTimes[i] ?? 0) >= cutoff)
  }, [allRecords, allTimes, range])

  return (
    <View style={styles.container}>
      {/* StudyBar — 记录时间范围切换(对齐 Uniapp token_value.vue TabBar barList: 7天/一个月/近一年/全部) */}
      <View style={styles.studyBarWrap}>
        <StudyBar
          items={RANGE_ITEMS.map((item) => ({ key: item.key, label: item.label }))}
          activeKey={range}
          onChange={(key) => setRange(key as RangeKey)}
        />
      </View>
      <View style={styles.sharedWrap}>
        <SharedTokenValueScreen
          t={t}
          balance={balance}
          records={records}
          loading={loading}
          refreshing={refreshing}
          error={error}
          activeTab={tab}
          onSelectTab={setTab}
          onRefresh={onRefresh}
          onRecharge={handleRecharge}
          onBack={() => navigation.goBack()}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
  studyBarWrap: { paddingHorizontal: 16, paddingTop: 8 },
  sharedWrap: { flex: 1 },
})
