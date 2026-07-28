import { useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { AppOrderStatus, OrderItem, OrderScreenProps, OrderTab } from '../../types'

/** 订单/Tab/Props 类型 re-export(单一来源 @ihui/types) */
export type { AppOrderStatus, OrderItem, OrderScreenProps, OrderTab }

const TABS: OrderTab[] = ['all', 'pending', 'paid', 'shipped', 'completed']

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
}: OrderScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const statusColors = (status: AppOrderStatus) => {
    switch (status) {
      case 'pending':
        return { bg: tk.warning.amberLight, text: tk.warning.amberText }
      case 'paid':
        return { bg: tk.success.light, text: tk.success.deepText }
      case 'shipped':
        return { bg: tk.indigo.light, text: tk.indigo.deep }
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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
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

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{t('common.loading')}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listBody}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {items.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.muted}>{t('order.empty')}</Text>
            </View>
          ) : (
            items.map((item: OrderItem) => {
              const sc = statusColors(item.status)
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => onPressItem(item)}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <View style={styles.card}>
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
                      <Text style={styles.amountValue}>¥{item.amount.toFixed(2)}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )
            })
          )}
        </ScrollView>
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
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    backText: { fontSize: 14, color: tk.text.medium },
    title: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    tabs: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
    tab: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: tk.surface.card,
    },
    tabActive: { backgroundColor: tk.success.light },
    tabText: { fontSize: 12, color: tk.text.secondary },
    tabTextActive: { color: tk.success.DEFAULT, fontWeight: '600' },
    errorText: { paddingHorizontal: 16, fontSize: 12, color: tk.danger.DEFAULT },
    center: { alignItems: 'center', paddingVertical: 48 },
    muted: { fontSize: 12, color: tk.text.secondary, marginTop: 8 },
    listBody: { padding: 16 },
    card: {
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      marginBottom: 8,
    },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    cardTitle: {
      flex: 1,
      fontSize: 14,
      fontWeight: '500',
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
      marginTop: 6,
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
      fontSize: 16,
      fontWeight: '600',
      color: tk.text.primary,
    },
  })
}
