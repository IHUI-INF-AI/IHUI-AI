// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { Search } from 'lucide-react-native'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getOrders, type Order, type OrderStatus } from '@ihui/api-client'
import NavBar from '../components/NavBar'
import SearchInput from '../components/SearchInput'
import FloatBox, { type FloatBoxType } from '../components/FloatBox'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { formatDateByTemplate } from '../utils/date-utils'
import { rpx } from '../utils/rpx'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PAGE_SIZE = 20

type OrderTab = 'all' | 'pending' | 'shipped' | 'completed' | 'refunded'

const TABS: ReadonlyArray<{ id: OrderTab; labelKey: string }> = [
  { id: 'all', labelKey: 'userOrder.tabAll' },
  { id: 'pending', labelKey: 'userOrder.tabPending' },
  { id: 'shipped', labelKey: 'userOrder.tabShipped' },
  { id: 'completed', labelKey: 'userOrder.tabCompleted' },
  { id: 'refunded', labelKey: 'userOrder.tabRefunded' },
]

/**
 * 将前端 tab 映射为后端 OrderStatus 查询参数。
 * - 'all' → 不过滤(返回全部)
 * - 'shipped'(待收货)→ 后端无 'shipped' 状态,降级为 'paid'(对齐 Uniapp「待收货」tab 筛 status 1|2 的已支付生命周期)
 * - 其他 → 直接作为 OrderStatus 传递
 */
function tabToStatus(tab: OrderTab): OrderStatus | undefined {
  if (tab === 'all') return undefined
  if (tab === 'shipped') return 'paid'
  return tab as OrderStatus
}

/** 订单状态徽标底色(对齐 Uniapp user_order_list status-*:pending 橙 / shipping 蓝 / refund 红 / finished 绿 / cancelled 灰) */
function statusBadgeColor(status: OrderStatus): string {
  switch (status) {
    case 'pending':
      return tokens.warning.DEFAULT
    case 'paid':
      return tokens.indigo.DEFAULT
    case 'refunded':
      return tokens.danger.DEFAULT
    case 'completed':
      return tokens.success.DEFAULT
    case 'cancelled':
    case 'failed':
    case 'refunding':
    default:
      return tokens.text.tertiary
  }
}

function formatOrderTime(input: string | null | undefined): string {
  return formatDateByTemplate(input, 'YYYY-MM-DD HH:mm')
}

export function UserOrderListScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()

  const [items, setItems] = useState<Order[]>([])
  const [activeTab, setActiveTab] = useState<OrderTab>('all')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const [floatVisible, setFloatVisible] = useState(false)
  const [floatMessage, setFloatMessage] = useState('')
  const [floatType, setFloatType] = useState<FloatBoxType>('info')
  const showFloat = useCallback((message: string, type: FloatBoxType = 'info') => {
    setFloatMessage(message)
    setFloatType(type)
    setFloatVisible(true)
  }, [])

  const loadPage = useCallback(
    async (nextPage: number, reset: boolean) => {
      if (reset) setLoading(true)
      else setLoadingMore(true)
      try {
        const status = tabToStatus(activeTab)
        const res = await getOrders({ status, page: nextPage, pageSize: PAGE_SIZE })
        if (!res.success) throw new Error('failed')
        const list = res.data?.list ?? []
        setItems((prev) => (reset ? list : [...prev, ...list]))
        const total = res.data?.total
        setHasMore(
          typeof total === 'number' ? nextPage * PAGE_SIZE < total : list.length >= PAGE_SIZE,
        )
        setPage(nextPage)
      } catch {
        showFloat(t('userOrder.loadFailed'), 'warning')
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [activeTab, showFloat, t],
  )

  useEffect(() => {
    void loadPage(1, true)
  }, [loadPage])

  // 切换 tab 重置并重新加载(对齐 Uniapp watch activeTab)
  const onSelectTab = (tab: OrderTab) => {
    if (tab === activeTab) return
    setActiveTab(tab)
    void loadPage(1, true)
  }

  // 搜索(后端 /api/orders/me 不支持关键词,前端按 商品名/订单号 过滤,对齐 Uniapp 搜索语义)
  const displayList = useMemo(() => {
    const kw = searchKeyword.trim().toLowerCase()
    if (!kw) return items
    return items.filter(
      (o) =>
        (o.targetTitle ?? '').toLowerCase().includes(kw) ||
        (o.orderNo ?? '').toLowerCase().includes(kw),
    )
  }, [items, searchKeyword])

  const onEndReached = useCallback(() => {
    if (!loading && !loadingMore && hasMore) {
      void loadPage(page + 1, false)
    }
  }, [loading, loadingMore, hasMore, page, loadPage])

  const goBack = () => navigation.goBack()

  return (
    <View style={styles.root}>
      <NavBar
        title={t('userOrder.title')}
        onBack={goBack}
        rightActions={[
          {
            icon: Search,
            label: t('userOrder.searchPlaceholder'),
            showLabel: false,
            onPress: () => setShowSearch((v) => !v),
          },
        ]}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        onScroll={({ nativeEvent }) => {
          const { contentOffset, contentSize, layoutMeasurement } = nativeEvent
          if (contentOffset.y + layoutMeasurement.height >= contentSize.height - rpx(40)) {
            onEndReached()
          }
        }}
        scrollEventThrottle={400}
      >
        {showSearch ? (
          <View style={styles.searchWrap}>
            <SearchInput
              value={searchKeyword}
              onChangeText={setSearchKeyword}
              placeholder={t('userOrder.searchPlaceholder')}
            />
          </View>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
        >
          {TABS.map((tab) => {
            const active = activeTab === tab.id
            return (
              <Pressable
                key={tab.id}
                style={({ pressed }) => [
                  styles.tabBtn,
                  active ? styles.tabBtnActive : null,
                  pressed ? styles.pressed : null,
                ]}
                onPress={() => onSelectTab(tab.id)}
                accessibilityRole="button"
                accessibilityLabel={t(tab.labelKey)}
              >
                <Text style={active ? styles.tabTextActive : styles.tabText} numberOfLines={1}>
                  {t(tab.labelKey)}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>

        {loading && items.length === 0 ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={tokens.brand.DEFAULT} />
          </View>
        ) : displayList.length === 0 ? (
          <View style={styles.centerState}>
            <Text style={styles.emptyText}>{t('userOrder.empty')}</Text>
          </View>
        ) : (
          displayList.map((order) => (
            <View key={order.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.orderNo}>
                  {t('userOrder.orderNo')}：{order.orderNo}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: statusBadgeColor(order.status) }]}>
                  <Text style={styles.statusText}>{t(`order.status.${order.status}`)}</Text>
                </View>
              </View>
              <View style={styles.cardBody}>
                {order.image ? (
                  <Image source={{ uri: order.image }} style={styles.cardImg} resizeMode="cover" />
                ) : (
                  <View style={[styles.cardImg, styles.cardImgPlaceholder]} />
                )}
                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {order.targetTitle || '-'}
                  </Text>
                </View>
              </View>
              <View style={styles.cardBottom}>
                <Text style={styles.orderTime}>
                  {t('userOrder.orderTime')}：{formatOrderTime(order.createdAt)}
                </Text>
                <Text style={styles.price}>¥{(order.payAmount / 100).toFixed(2)}</Text>
              </View>
            </View>
          ))
        )}

        {loadingMore ? (
          <View style={styles.loadingMore}>
            <ActivityIndicator size="small" color={tokens.brand.DEFAULT} />
            <Text style={styles.loadingMoreText}>{t('userOrder.loading')}</Text>
          </View>
        ) : null}
      </ScrollView>
      <FloatBox
        visible={floatVisible}
        type={floatType}
        message={floatMessage}
        onHide={() => setFloatVisible(false)}
      />
    </View>
  )
}

const styles = {
  root: { flex: 1, backgroundColor: tokens.surface.light },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: rpx(40), paddingTop: rpx(20), paddingBottom: rpx(40) },
  searchWrap: { marginBottom: rpx(20) },
  tabsRow: { gap: rpx(20), paddingVertical: rpx(10), marginBottom: rpx(10) },
  tabBtn: {
    paddingHorizontal: rpx(28),
    height: rpx(64),
    borderRadius: rpx(15),
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.light,
    alignItems: 'center',
    justifyContent: 'center',
  } as const,
  tabBtnActive: { borderColor: tokens.text.primary, backgroundColor: tokens.surface.card },
  tabText: { fontSize: rpx(30), color: tokens.text.secondary, fontWeight: '600' as const } as const,
  tabTextActive: { fontSize: rpx(30), color: tokens.text.primary, fontWeight: '700' as const } as const,
  card: {
    borderRadius: rpx(30),
    padding: rpx(24),
    marginBottom: rpx(24),
    backgroundColor: tokens.surface.card,
    borderWidth: 1,
    borderColor: tokens.border.light,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  orderNo: { fontSize: rpx(26), color: tokens.text.secondary, flex: 1, marginRight: rpx(12) },
  statusBadge: { paddingHorizontal: rpx(20), height: rpx(44), borderRadius: rpx(8), alignItems: 'center' as const, justifyContent: 'center' as const },
  statusText: { fontSize: rpx(24), color: tokens.surface.light, fontWeight: '600' as const },
  cardBody: { flexDirection: 'row', alignItems: 'center', marginTop: rpx(16) },
  cardImg: {
    width: rpx(130),
    height: rpx(130),
    borderRadius: rpx(15),
    marginRight: rpx(24),
    backgroundColor: tokens.surface.muted,
  } as const,
  cardImgPlaceholder: {},
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: rpx(32), color: tokens.text.primary, fontWeight: '700' as const },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: rpx(20),
  },
  orderTime: { fontSize: rpx(26), color: tokens.text.secondary },
  price: { fontSize: rpx(36), color: tokens.danger.DEFAULT, fontWeight: '700' as const },
  centerState: { paddingVertical: rpx(120), alignItems: 'center' as const },
  emptyText: { fontSize: rpx(28), color: tokens.text.tertiary },
  loadingMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rpx(12),
    paddingVertical: rpx(20),
  },
  loadingMoreText: { fontSize: rpx(26), color: tokens.text.secondary },
  pressed: { opacity: 0.85 },
} as const
