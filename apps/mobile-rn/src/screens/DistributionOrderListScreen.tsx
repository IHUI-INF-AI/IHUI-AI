/**
 * DistributionOrderListScreen 分销订单列表(mobile-rn 端)
 *
 * 1:1 复刻历史 Uniapp distribution_order_list/index.vue 核心结构:
 * - NavBar「分销订单列表」+ 返回
 * - SearchInput(复用组件)按订单号/买家昵称搜索
 * - 状态 Tab:全部/待结算/退单/已完成(对齐 Uniapp tabs: all/0/1/2)
 * - 订单卡片:关联订单号/买家/商品金额/下单时间/本单佣金/分销佣金比例标记
 * - 分页:FlatList onEndReached 加载下一页
 * - API:getCommissionList(@ihui/api-client,返回 PageData<CommissionRecord>)
 * - 空态:复用 Empty 组件
 *
 * 平台独占:仅 mobile-rn 端。
 */
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  getCommissionList,
  type CommissionRecord,
} from '@ihui/api-client'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { NavBar } from '../components/NavBar'
import { SearchInput } from '../components/SearchInput'
import { SingleTypeBar } from '../components/SingleTypeBar'
import Empty from '../components/common/Empty'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

type TabValue = 'all' | '0' | '1' | '2'

interface TabConfig {
  value: TabValue
  label: string
}

const TABS: readonly TabConfig[] = [
  { value: 'all', label: '全部' },
  { value: '0', label: '待结算' },
  { value: '1', label: '退单' },
  { value: '2', label: '已完成' },
] as const

const PAGE_SIZE = 10

function statusText(status: string): string {
  switch (status) {
    case '0':
    case 'pending':
      return '待结算'
    case '1':
    case 'refunded':
      return '退单'
    case '2':
    case 'settled':
    case 'finished':
      return '已完成'
    default:
      return status || '未知'
  }
}

function statusColor(status: string): string {
  if (status === '1' || status === 'refunded') return tokens.danger.DEFAULT
  if (status === '2' || status === 'settled' || status === 'finished') return '#16a34a'
  return tokens.text.tertiary
}

function formatYuan(cents: number): string {
  return (cents / 100).toFixed(2)
}

export default function DistributionOrderListScreen() {
  const navigation = useNavigation<NavigationProp>()
  const [keyword, setKeyword] = useState('')
  const [activeTab, setActiveTab] = useState<TabValue>('all')
  const [orders, setOrders] = useState<CommissionRecord[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const loadPage = useCallback(
    async (nextPage: number, reset: boolean) => {
      if (reset) setLoading(true)
      else setLoadingMore(true)
      const statusParam = activeTab === 'all' ? undefined : statusText(activeTab)
      const res = await getCommissionList({
        page: nextPage,
        pageSize: PAGE_SIZE,
        status: statusParam,
      })
      const list = res.success ? res.data?.list ?? [] : []
      setOrders((prev) => (reset ? list : [...prev, ...list]))
      setHasMore(list.length >= PAGE_SIZE)
      setPage(nextPage)
      setLoading(false)
      setLoadingMore(false)
    },
    [activeTab],
  )

  useEffect(() => {
    void loadPage(1, true)
  }, [loadPage])

  const onSearch = (): void => {
    void loadPage(1, true)
  }

  const filtered = keyword.trim()
    ? orders.filter(
        (o) =>
          o.orderId.toLowerCase().includes(keyword.toLowerCase()) ||
          o.userNickname.toLowerCase().includes(keyword.toLowerCase()),
      )
    : orders

  const onEndReached = (): void => {
    if (!loading && !loadingMore && hasMore) {
      void loadPage(page + 1, false)
    }
  }

  const renderItem: ListRenderItem<CommissionRecord> = ({ item }) => (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <Text style={styles.orderLabel} numberOfLines={1}>
          {'订单号:' + item.orderId}
        </Text>
        <View style={[styles.statusTag, { backgroundColor: statusColor(item.status) }]}>
          <Text style={styles.statusText}>{statusText(item.status)}</Text>
        </View>
      </View>
      <Text style={styles.buyerText}>{'买家:' + item.userNickname}</Text>
      <View style={styles.orderFooter}>
        <View style={styles.footerLeft}>
          <Text style={styles.amountText}>{'¥' + formatYuan(item.orderAmount)}</Text>
          <View style={styles.rateTag}>
            <Text style={styles.rateText}>{'佣金 ' + item.rate + '%'}</Text>
          </View>
        </View>
        <View style={styles.footerRight}>
          <Text style={styles.commissionLabel}>本单佣金</Text>
          <Text style={styles.commissionValue}>{'¥' + formatYuan(item.commissionAmount)}</Text>
        </View>
      </View>
      <Text style={styles.timeText}>{'下单时间:' + item.createdAt}</Text>
    </View>
  )

  return (
    <View style={styles.root}>
      <NavBar title="分销订单列表" onBack={() => navigation.goBack()} />
      <View style={styles.searchWrap}>
        <SearchInput
          value={keyword}
          onChangeText={setKeyword}
          placeholder="搜索订单号或买家"
          onSubmit={onSearch}
        />
      </View>
      <View style={styles.tabsBar}>
        <SingleTypeBar
          items={TABS.map((tab) => ({ id: tab.value, label: tab.label }))}
          selectedId={activeTab}
          onSelect={(id) => setActiveTab(id as TabValue)}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          loading ? null : <Empty text="暂无订单数据" />
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoading}>
              <ActivityIndicator color={tokens.brand.DEFAULT} />
            </View>
          ) : null
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.surface.bg },
  searchWrap: { padding: 16, paddingBottom: 8 },
  tabsBar: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  listContent: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  orderCard: {
    backgroundColor: tokens.surface.card,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  orderLabel: { flex: 1, fontSize: 13, color: tokens.text.primary },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusText: { fontSize: 11, color: tokens.surface.light, fontWeight: '500' },
  buyerText: { fontSize: 13, color: tokens.text.secondary },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  amountText: { fontSize: 15, fontWeight: '600', color: tokens.text.primary },
  rateTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: tokens.surface.muted,
  },
  rateText: { fontSize: 11, color: tokens.text.secondary },
  footerRight: { alignItems: 'flex-end' },
  commissionLabel: { fontSize: 11, color: tokens.text.secondary },
  commissionValue: { fontSize: 14, fontWeight: '600', color: tokens.danger.DEFAULT },
  timeText: { fontSize: 12, color: tokens.text.tertiary },
  footerLoading: { paddingVertical: 12, alignItems: 'center' },
})
