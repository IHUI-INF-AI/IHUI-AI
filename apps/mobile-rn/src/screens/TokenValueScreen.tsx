// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan)
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { tokens } from '../theme/active-tokens'
import {
  getTokenBalance,
  getTokenFlows,
  getTopUpRecords,
  type TokenBalance,
  type TokenFlowItem,
  type TopUpOrder,
} from '@ihui/api-client'
import {
  CategoryInlineBar,
  TokenValueScreen as SharedTokenValueScreen,
  type TokenRecordType,
  type TokenValueBalance,
  type TokenValueRecord,
} from '@ihui/rn-app'
import { formatShortDateTime } from '../utils/date-utils'
import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { rpx } from '../utils/rpx'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 记录时间范围 key(对齐 Uniapp token_value.vue barList 的 value: w/m/y/a) */
type RangeKey = 'w' | 'm' | 'y' | 'a'

const RANGE_ITEMS: readonly { key: RangeKey; labelKey: string }[] = [
  { key: 'w', labelKey: 'tokenValue.range7d' },
  { key: 'm', labelKey: 'tokenValue.range1m' },
  { key: 'y', labelKey: 'tokenValue.range1y' },
  { key: 'a', labelKey: 'tokenValue.rangeAll' },
]

/** 各范围的天数(a=全部不设限) */
const RANGE_DAYS: Record<RangeKey, number> = { w: 7, m: 30, y: 365, a: Number.POSITIVE_INFINITY }

/** 单页记录条数(与端内 /token/records 的 PAGE_SIZE 对齐) */
const PAGE_SIZE = 20

/** 记录 + 原始 ISO 时间(排序/时间范围过滤的键;TokenValueRecord 不含原始时间) */
type TaggedRecord = { iso: string; rec: TokenValueRecord }

function byTimeDesc(a: { iso: string }, b: { iso: string }): number {
  return a.iso < b.iso ? 1 : a.iso > b.iso ? -1 : 0
}

export default function TokenValueScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [tab, setTab] = useState<TokenRecordType>('all')
  const [balance, setBalance] = useState<TokenValueBalance | null>(null)
  // 记录与原始 ISO 时间同行(分类条按时间范围过滤用;TokenValueRecord 类型不含原始时间)
  const [tagged, setTagged] = useState<TaggedRecord[]>([])
  // 已加载到第几页 + 是否还有下一页(触底分页状态)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  // 时间范围(对齐 Uniapp token_value.vue type 默认 'w' 7天)
  const [range, setRange] = useState<RangeKey>('w')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  /** 把一页「消耗流水 + 充值记录」并成按时间倒序的记录行 */
  const tagPage = useCallback(
    (flowItems: TokenFlowItem[], topUpItems: TopUpOrder[]): TaggedRecord[] => {
      const rows: TaggedRecord[] = []
      for (const f of flowItems) {
        rows.push({
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
        rows.push({
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
      return rows.sort(byTimeDesc)
    },
    [t],
  )

  /** 取第 p 页记录;任一端点还有剩余即「还有下一页」 */
  const fetchPage = useCallback(
    async (p: number) => {
      const [flowRes, topUpRes] = await Promise.all([
        getTokenFlows({ page: p, pageSize: PAGE_SIZE }),
        getTopUpRecords({ page: p, pageSize: PAGE_SIZE }),
      ])
      const flowItems = flowRes.success ? (flowRes.data.list ?? []) : []
      const topUpItems = topUpRes.success ? (topUpRes.data.list ?? []) : []
      const flowTotal = flowRes.success ? (flowRes.data.total ?? 0) : 0
      const topUpTotal = topUpRes.success ? (topUpRes.data.total ?? 0) : 0
      return {
        rows: tagPage(flowItems, topUpItems),
        hasMore: flowTotal > p * PAGE_SIZE || topUpTotal > p * PAGE_SIZE,
      }
    },
    [tagPage],
  )

  const load = useCallback(async () => {
    setError('')
    try {
      const [balRes, first] = await Promise.all([getTokenBalance(), fetchPage(1)])

      if (balRes.success) {
        const bal: TokenBalance = balRes.data
        // TokenBalance API 不返回 frozen 字段,占位 0(保留 UI 结构)
        setBalance({ balance: bal.balance, frozen: 0, totalUsed: bal.totalUsed })
      }

      setTagged(first.rows)
      setPage(1)
      setHasMore(first.hasMore)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('tokenValue.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
      setLoadingMore(false)
    }
  }, [fetchPage, t])

  // 触底加载下一页(共享屏 FlatList 的 onEndReached 由此接上)
  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const next = page + 1
      const res = await fetchPage(next)
      setTagged((prev) => [...prev, ...res.rows].sort(byTimeDesc))
      setPage(next)
      setHasMore(res.hasMore)
    } catch {
      // 下一页取失败时保留已加载的分页,由下拉刷新重新对齐
    } finally {
      setLoadingMore(false)
    }
  }, [fetchPage, hasMore, loading, loadingMore, page])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = () => {
    setRefreshing(true)
    void load()
  }

  // 套餐卡片只落到统一充值页(在册路由 Recharge → AppTopupScreen 真实支付链);
  // 端内同样只跳 /pkg-shop/wallet/recharge/index,不按套餐伪造选中态(后端无在册套餐下单端点)
  const handleRecharge = () => navigation.navigate('Recharge')

  // 时间范围过滤(对齐 Uniapp token_value.vue onTabChange → type 参数重新拉取;此处前端过滤已加载记录)
  const records = useMemo(() => {
    if (range === 'a') return tagged.map((item) => item.rec)
    const cutoff = Date.now() - RANGE_DAYS[range] * 24 * 60 * 60 * 1000
    return tagged.filter((item) => new Date(item.iso).getTime() >= cutoff).map((item) => item.rec)
  }, [tagged, range])

  return (
    <View style={styles.container}>
      {/* 记录时间范围切换(统一分类条;对齐 Uniapp token_value.vue TabBar barList: 7天/一个月/近一年/全部) */}
      <View style={styles.studyBarWrap}>
        <CategoryInlineBar
          items={RANGE_ITEMS.map((item) => ({ id: item.key, label: t(item.labelKey) }))}
          selectedId={range}
          onSelect={(id) => setRange(id as RangeKey)}
          colorScheme={resolvedTheme}
          contentPaddingHorizontal={0}
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
          onLoadMore={loadMore}
          loadingMore={loadingMore}
          hasMore={hasMore}
          colorScheme={resolvedTheme}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
  studyBarWrap: { paddingHorizontal: rpx(32), paddingTop: rpx(16) },
  sharedWrap: { flex: 1 },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
