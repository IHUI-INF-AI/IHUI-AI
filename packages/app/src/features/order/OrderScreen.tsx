import { useMemo, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Image,
  TouchableOpacity,
  ScrollView,
  FlatList,
  RefreshControl,
  StyleSheet,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { AppOrderStatus, OrderItem, OrderScreenProps, OrderTab } from '../../types'

/** 订单/Tab/Props 类型 re-export(单一来源 @ihui/types) */
export type { AppOrderStatus, OrderItem, OrderScreenProps, OrderTab }

/**
 * Tab 集对齐 Uniapp pages/user_order_list/index.vue tabList:
 * 全部 / 待支付 / 待收货 / 已完成 / 已退款(原 RN 多 paid 缺 refunded)。
 * 'shipped' 在后端映射为 'paid'(见 mobile-rn tabToStatus,对齐 Uniapp 待收货筛 status 1|2)。
 */
const TABS: OrderTab[] = ['all', 'pending', 'shipped', 'completed', 'refunded']

/**
 * 订单列表共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header + tab 切换栏 + 订单卡片列表 + 下拉刷新。
 * 平台特定(导航 / API 调用 / tab 切换拉取)由 wrapper 通过 props 注入。
 */
export function OrderScreen({
  t,
  items,
  activeTab,
  onSelectTab,
  loading,
  refreshing,
  error,
  onRefresh,
  onPressItem,
  onBack,
  colorScheme = 'light',
  // 上拉分页(可选注入,对齐 Uniapp onReachBottom → loadMore;未注入则列表不分页)
  onLoadMore,
  loadingMore = false,
  hasMore = true,
}: OrderScreenProps & {
  /** 上拉加载下一页回调(平台注入,内部自行守卫 hasMore/loading) */
  onLoadMore?: () => void
  /** 是否正在加载下一页(控制 footer 提示) */
  loadingMore?: boolean
  /** 是否还有更多数据(控制 footer 提示) */
  hasMore?: boolean
}) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  // 本地搜索关键词:匹配订单号 / 商品名(对齐 Uniapp user_order_list searchText 过滤,见 index.vue:195-197)
  const [keyword, setKeyword] = useState('')
  const filteredItems = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    if (!kw) return items
    return items.filter(
      (item) =>
        item.orderNo.toLowerCase().includes(kw) || item.title.toLowerCase().includes(kw),
    )
  }, [items, keyword])

  const statusColors = (status: AppOrderStatus) => {
    switch (status) {
      case 'pending':
        return { bg: tk.warning.amberLight, text: tk.warning.amberText }
      case 'paid':
        return { bg: tk.success.light, text: tk.success.deepText }
      case 'shipped':
        return { bg: tk.brand.DEFAULT, text: tk.surface.light }
      case 'completed':
        return { bg: tk.success.light, text: tk.success.deepText }
      case 'cancelled':
        return { bg: tk.danger.light, text: tk.danger.DEFAULT }
      case 'refunded':
        return { bg: tk.surface.muted, text: tk.text.tertiary }
      default:
        return { bg: tk.surface.muted, text: tk.text.tertiary }
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('order.title')}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
      >
        {TABS.map((tab) => {
          const active = tab === activeTab
          return (
            <TouchableOpacity
              key={tab}
              onPress={() => onSelectTab(tab)}
              style={[styles.tab, active && styles.tabActive]}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {t(`order.tab.${tab}`)}
              </Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      <TextInput
        style={styles.searchInput}
        value={keyword}
        onChangeText={setKeyword}
        placeholder={t('order.searchPlaceholder')}
        placeholderTextColor={tk.text.tertiary}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        accessibilityLabel={t('order.searchPlaceholder')}
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{t('common.loading')}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item: OrderItem) => item.id}
          renderItem={({ item }) => {
            const sc = statusColors(item.status)
            // 商品图信息块(有 image 时与图并排;无图直接平铺,保持现状不占位)
            const info = (
              <>
                <View style={styles.cardHead}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.badgeText, { color: sc.text }]}>
                      {t(`order.status.${item.status}`)}
                    </Text>
                  </View>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.orderNo}>{item.orderNo}</Text>
                  <Text style={styles.metaTime}>{item.createdAt}</Text>
                </View>
                <View style={styles.amountRow}>
                  <Text style={styles.amountLabel}>{t('order.amount')}</Text>
                  <Text style={styles.amountValue}>
                    ¥{item.amount !== null ? item.amount.toFixed(2) : '—'}
                  </Text>
                </View>
              </>
            )
            return (
              <TouchableOpacity
                onPress={() => onPressItem(item)}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              >
                <View style={styles.card}>
                  {item.image ? (
                    <View style={styles.cardBodyRow}>
                      <Image
                        source={{ uri: item.image }}
                        style={styles.cardImg}
                        resizeMode="cover"
                        accessibilityLabel={item.title}
                      />
                      <View style={styles.cardInfo}>{info}</View>
                    </View>
                  ) : (
                    info
                  )}
                </View>
              </TouchableOpacity>
            )
          }}
          contentContainerStyle={styles.listBody}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.muted}>{t('order.empty')}</Text>
            </View>
          }
          onEndReachedThreshold={0.2}
          onEndReached={onLoadMore ? () => onLoadMore() : undefined}
          ListFooterComponent={
            onLoadMore && filteredItems.length > 0 ? (
              <View style={styles.footer}>
                {loadingMore ? (
                  <Text style={styles.muted}>{t('common.loading')}</Text>
                ) : !hasMore ? (
                  <Text style={styles.muted}>{t('order.noMore')}</Text>
                ) : null}
              </View>
            ) : null
          }
        />
      )}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 12,
      gap: 12,
    },
    backText: { fontSize: 16, color: tk.text.medium },
    title: { fontSize: 20, fontWeight: '600', color: tk.text.primary },
    tabs: { paddingHorizontal: 10, paddingVertical: 8, gap: 8 },
    tab: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: tk.surface.card,
    },
    tabActive: { backgroundColor: tk.brand.DEFAULT },
    tabText: { fontSize: 14, color: tk.text.secondary },
    tabTextActive: { color: tk.surface.light, fontWeight: '600' },
    searchInput: {
      marginHorizontal: 10,
      marginTop: 4,
      marginBottom: 4,
      paddingHorizontal: 12,
      height: 40,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      fontSize: 14,
      color: tk.text.primary,
    },
    errorText: { paddingHorizontal: 10, fontSize: 14, color: tk.danger.DEFAULT },
    center: { alignItems: 'center', paddingVertical: 48 },
    muted: { fontSize: 14, color: tk.text.secondary, marginTop: 8 },
    // 上拉分页 footer:对齐 Uniapp loadMore 底部加载提示
    footer: { alignItems: 'center', paddingVertical: 16 },
    listBody: { padding: 10 },
    card: {
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
      marginBottom: 12,
    },
    // 商品图 130×130 圆角(对齐 Uniapp card-img;无图不渲染)
    cardBodyRow: { flexDirection: 'row', gap: 12 },
    cardImg: {
      width: 130,
      height: 130,
      borderRadius: 10,
      backgroundColor: tk.surface.card,
    },
    cardInfo: { flex: 1 },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    cardTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      color: tk.text.primary,
    },
    badge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      overflow: 'hidden',
    },
    badgeText: { fontSize: 11 },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    orderNo: { fontSize: 11, color: tk.text.tertiary },
    metaTime: { fontSize: 11, color: tk.text.tertiary },
    amountRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    amountLabel: { fontSize: 11, color: tk.text.tertiary },
    amountValue: {
      fontSize: 20,
      fontWeight: '700',
      color: tk.text.primary,
    },
  })
}
