// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { ActivityIndicator, FlatList, Image, Pressable, Text, View } from 'react-native'
import { Check, Minus, Package, Plus, ShoppingCart, Trash2 } from 'lucide-react-native'
import { getTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { createCartStyles } from './cart-styles'

/**
 * 购物车跨端共享屏 —— RN 端与小程序端的唯一渲染真相源。
 *
 * 结构(逐元素,小程序端 pkg-shop/cart 同形对齐):
 * 页头(返回键 + cart.title) → 商品行(勾选框 | 封面/Package 兜底 | 标题+价格+数量增减 | Trash2 删除)
 * → 空态三分支(loading 指示 / error: cart.loadFailed + common.retry / cart.empty + ShoppingCart)
 * → 底部合计栏(全选勾选框 + cart.selectAll | cart.total + 合计金额 | cart.checkout(件数) 主 CTA)。
 *
 * 平台侧只注入取数与副作用:本屏不触网、不弹窗、不支付 ——
 * 删除确认(RN appAlert / 小程序 Taro.showModal)与结算腿(微信支付 / toast)留在各端薄壳。
 */
export interface CartItemView {
  id: string
  title: string
  coverUrl: string
  price: number
  quantity: number
  selected: boolean
}

export interface CartScreenProps {
  t: (key: string) => string
  colorScheme?: 'light' | 'dark'
  items: readonly CartItemView[]
  /** 首屏加载(空列表时渲染加载指示) */
  loading?: boolean
  /** 下拉刷新中(交给 FlatList 原生刷新腿) */
  refreshing?: boolean
  /** 加载失败态(渲染 cart.loadFailed + 重试) */
  error?: boolean
  onBack: () => void
  onRetry: () => void
  onRefresh?: () => void
  onToggleItem: (id: string) => void
  onToggleAll: () => void
  onQuantityChange: (id: string, delta: number) => void
  /** 删除请求(确认交互由承载端决定,屏只负责把意图交出去) */
  onRemove: (id: string) => void
  /** 去结算(件数为 0 的拦截留在端内,与两端现行口径一致) */
  onCheckout: () => void
}

export function CartScreen({
  t,
  colorScheme = 'light',
  items,
  loading = false,
  refreshing = false,
  error = false,
  onBack,
  onRetry,
  onRefresh,
  onToggleItem,
  onToggleAll,
  onQuantityChange,
  onRemove,
  onCheckout,
}: CartScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createCartStyles(tk), [tk])

  const allSelected = items.length > 0 && items.every((it) => it.selected)
  // 已选合计(仅统计 selected 项,两端现行口径)
  const { totalCount, totalPrice } = useMemo(() => {
    let count = 0
    let price = 0
    items.forEach((it) => {
      if (it.selected) {
        count += it.quantity
        price += it.quantity * it.price
      }
    })
    return { totalCount: count, totalPrice: price }
  }, [items])

  const renderItem = ({ item }: { item: CartItemView }) => (
    <View style={styles.card}>
      <Pressable
        style={[styles.checkbox, item.selected ? styles.checkboxChecked : null]}
        onPress={() => onToggleItem(item.id)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.selected }}
        accessibilityLabel={item.title}
      >
        {item.selected ? <Check size={12} color={tk.surface.light} strokeWidth={3} /> : null}
      </Pressable>
      {item.coverUrl ? (
        <Image source={{ uri: item.coverUrl }} style={styles.cover} />
      ) : (
        <View style={[styles.cover, styles.coverFallback]}>
          <Package size={22} color={tk.text.tertiary} strokeWidth={2} />
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.price}>¥{item.price.toFixed(2)}</Text>
        <View style={styles.qtyRow}>
          <Pressable
            style={[styles.qtyBtn, item.quantity <= 1 ? styles.qtyBtnDisabled : null]}
            disabled={item.quantity <= 1}
            onPress={() => onQuantityChange(item.id, -1)}
            accessibilityRole="button"
            accessibilityLabel="-"
          >
            <Minus size={14} color={item.quantity <= 1 ? tk.text.tertiary : tk.text.secondary} />
          </Pressable>
          <Text style={styles.qtyValue}>{item.quantity}</Text>
          <Pressable
            style={styles.qtyBtn}
            onPress={() => onQuantityChange(item.id, 1)}
            accessibilityRole="button"
            accessibilityLabel="+"
          >
            <Plus size={14} color={tk.text.secondary} />
          </Pressable>
        </View>
      </View>
      <Pressable
        style={styles.deleteBtn}
        onPress={() => onRemove(item.id)}
        accessibilityRole="button"
        accessibilityLabel={t('common.delete')}
      >
        <Trash2 size={18} color={tk.danger.DEFAULT} strokeWidth={2} />
      </Pressable>
    </View>
  )

  const emptyState = loading ? (
    <View style={styles.center}>
      <ActivityIndicator color={tk.text.secondary} />
    </View>
  ) : error ? (
    <View style={styles.center}>
      <Text style={styles.emptyText}>{t('cart.loadFailed')}</Text>
      <Pressable style={styles.retryBtn} onPress={onRetry}>
        <Text style={styles.retryText}>{t('common.retry')}</Text>
      </Pressable>
    </View>
  ) : (
    <View style={styles.center}>
      <ShoppingCart size={40} color={tk.text.tertiary} strokeWidth={2} />
      <Text style={styles.emptyText}>{t('cart.empty')}</Text>
    </View>
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.headerTitle}>{t('cart.title')}</Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListEmptyComponent={emptyState}
      />
      {items.length > 0 ? (
        <View style={styles.footer}>
          <Pressable
            style={[styles.checkbox, allSelected ? styles.checkboxChecked : null]}
            onPress={onToggleAll}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: allSelected }}
            accessibilityLabel={t('cart.selectAll')}
          >
            {allSelected ? <Check size={12} color={tk.surface.light} strokeWidth={3} /> : null}
          </Pressable>
          <Text style={styles.selectAll} onPress={onToggleAll}>
            {t('cart.selectAll')}
          </Text>
          <View style={styles.totalWrap}>
            <Text style={styles.totalLabel}>{t('cart.total')}:</Text>
            <Text style={styles.totalPrice}>¥{totalPrice.toFixed(2)}</Text>
          </View>
          <Pressable
            style={[styles.checkoutBtn, totalCount === 0 ? styles.checkoutBtnDisabled : null]}
            onPress={onCheckout}
            accessibilityRole="button"
            accessibilityLabel={t('cart.checkout')}
          >
            <Text style={styles.checkoutText}>
              {t('cart.checkout')}({totalCount})
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
