// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * CartScreen 购物车页(mobile-rn 端)
 *
 * 镜像 miniapp-taro pages/cart/index(P0 交易闭环补齐):
 * - 数据源:复用共享层 @ihui/api-client selectGoods(GET /goods/select,page=1&pageSize=50 对齐小程序),
 *   商品字段兜底收敛进共享 normalizeCartGoods 适配层;展示型 CartItemView 端内定义
 * - 交互:单选/全选 → 数量增减(下限 1)→ 删除(Alert 确认)→ 底部合计栏去结算
 * - 结算:复用 RN 现有微信支付链路(isWeChatInstalled → createWechatAppPayment → openWeChatPayment,
 *   与 OrderDetailScreen/PaymentScreen 同款),支付成功 navigate PayResult(orderNo)对齐统一支付结果页
 * - 样式:getRnTokens 语义 token(零 hex,过 check:rn-parity);图标 lucide-react-native(无 emoji)
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useNavigation } from '@react-navigation/native'
import { Check, Minus, Package, Plus, ShoppingCart, Trash2 } from 'lucide-react-native'
import {
  createWechatAppPayment,
  normalizeCartGoods,
  selectGoods,
  type CartGoods,
} from '@ihui/api-client'
import { getRnTokens, type RnThemeTokens } from '@ihui/design-tokens'
import { NavBar } from '../components/NavBar'
import {
  ConfirmPurchasePopUp,
  type ConfirmPurchaseProduct,
} from '../components/ConfirmPurchasePopUp'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { rpx } from '../utils/rpx'
import { isWeChatInstalled, openWeChatPayment } from '../lib/wechat-pay'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 展示型购物车项(端内局部类型,仅 UI 用) */
interface CartItemView {
  id: string
  title: string
  coverUrl: string
  price: number
  quantity: number
  selected: boolean
}

/** 后端记录 → 展示项映射(兜底规则收敛在共享 normalizeCartGoods,对齐 miniapp pages/cart/index) */
function toCartItem(item: CartGoods, fallbackTitle: string): CartItemView {
  return { ...normalizeCartGoods(item, fallbackTitle), selected: true }
}

export function CartScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const tk = getRnTokens(resolvedTheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const [items, setItems] = useState<CartItemView[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)
  // 结算确认弹窗(复用 ConfirmPurchasePopUp,与 PaymentScreen 同款)
  const [checkoutVisible, setCheckoutVisible] = useState(false)
  const [paying, setPaying] = useState(false)

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      setError(false)
      const res = await selectGoods({ page: 1, pageSize: 50 })
      if (res.success) {
        const rawList = res.data?.list ?? []
        setItems(rawList.map((item) => toCartItem(item, t('cart.product'))))
      } else {
        setError(true)
      }
      setLoading(false)
      setRefreshing(false)
    },
    [t],
  )

  // 首次进入加载(对齐 miniapp useDidShow)
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** 数量增减(下限 1,对齐 miniapp onQuantityChange) */
  const onQuantityChange = (id: string, delta: number) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, quantity: Math.max(1, it.quantity + delta) } : it)),
    )
  }

  const onToggleItem = (id: string) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, selected: !it.selected } : it)))
  }

  const allSelected = items.length > 0 && items.every((it) => it.selected)
  const onToggleAll = () =>
    setItems((prev) => prev.map((it) => ({ ...it, selected: !allSelected })))

  /** 删除(Alert 二次确认,对齐 miniapp Taro.showModal) */
  const onRemove = (item: CartItemView) => {
    Alert.alert(t('common.hint'), t('cart.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => setItems((prev) => prev.filter((it) => it.id !== item.id)),
      },
    ])
  }

  // 已选合计(仅统计 selected 项,对齐 miniapp useMemo 统计)
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

  const onCheckout = () => {
    if (totalCount === 0) {
      Alert.alert(t('cart.selectFirst'))
      return
    }
    setCheckoutVisible(true)
  }

  /** 结算:复用 RN 现有微信支付链路(OrderDetailScreen 同款),成功后进统一支付结果页 */
  const executeCheckout = async () => {
    setPaying(true)
    try {
      // 1. 检查微信客户端
      const installed = await isWeChatInstalled()
      if (!installed) {
        Alert.alert(t('payment.wechatNotInstalled'))
        return
      }
      // 2. 创建微信 APP 支付订单(amount 单位:分,后端契约)
      const res = await createWechatAppPayment({
        amount: Math.round(totalPrice * 100),
        description: t('cart.title'),
      })
      if (!res.success || !res.data) {
        Alert.alert(res.error || t('payment.createFailed'))
        return
      }
      // 3. DEV mock(无微信支付配置):后端已落单,直接进结果页轮询状态
      if (res.data.mock && res.data.outTradeNo) {
        setCheckoutVisible(false)
        navigation.navigate('PayResult', { orderNo: res.data.outTradeNo })
        return
      }
      if (!res.data.prepayData) {
        Alert.alert(t('payment.nativeUnavailable'))
        return
      }
      // 4. 调起微信 APP 支付
      const paid = await openWeChatPayment(res.data.prepayData)
      setCheckoutVisible(false)
      if (paid && res.data.outTradeNo) {
        // 支付成功 → 统一支付结果页(PayResult 内部轮询订单状态)
        navigation.navigate('PayResult', { orderNo: res.data.outTradeNo })
      } else if (!paid) {
        Alert.alert(t('payment.payCancelled'))
      } else {
        Alert.alert(t('payment.payFailed'))
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg === 'WECHAT_NOT_INSTALLED') Alert.alert(t('payment.wechatNotInstalled'))
      else if (msg === 'WECHAT_NATIVE_UNAVAILABLE') Alert.alert(t('payment.nativeUnavailable'))
      else Alert.alert(t('payment.payFailed'))
    } finally {
      setPaying(false)
    }
  }

  const renderItem = ({ item }: { item: CartItemView }) => (
    <View style={styles.card}>
      {/* 勾选框(选中态 success 底 + Check 图标,对齐 miniapp checkbox) */}
      <Pressable
        style={[styles.checkbox, item.selected ? styles.checkboxChecked : null]}
        onPress={() => onToggleItem(item.id)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.selected }}
        accessibilityLabel={item.title}
      >
        {item.selected ? <Check size={rpx(24)} color={tk.surface.light} /> : null}
      </Pressable>
      {item.coverUrl ? (
        <Image source={{ uri: item.coverUrl }} style={styles.cover} />
      ) : (
        <View style={[styles.cover, styles.coverFallback]}>
          <Package size={rpx(44)} color={tk.text.tertiary} />
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
            <Minus
              size={rpx(28)}
              color={item.quantity <= 1 ? tk.text.tertiary : tk.text.secondary}
            />
          </Pressable>
          <Text style={styles.qtyValue}>{item.quantity}</Text>
          <Pressable
            style={styles.qtyBtn}
            onPress={() => onQuantityChange(item.id, 1)}
            accessibilityRole="button"
            accessibilityLabel="+"
          >
            <Plus size={rpx(28)} color={tk.text.secondary} />
          </Pressable>
        </View>
      </View>
      <Pressable
        style={styles.deleteBtn}
        onPress={() => onRemove(item)}
        accessibilityRole="button"
        accessibilityLabel={t('common.delete')}
      >
        <Trash2 size={rpx(36)} color={tk.danger.DEFAULT} />
      </Pressable>
    </View>
  )

  return (
    <View style={styles.container}>
      <NavBar title={t('cart.title')} onBack={() => navigation.goBack()} />
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={tk.text.secondary}
          />
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={tk.text.secondary} />
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Text style={styles.emptyText}>{t('cart.loadFailed')}</Text>
              <Pressable style={styles.retryBtn} onPress={() => void load()}>
                <Text style={styles.retryText}>{t('common.retry')}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.center}>
              <ShoppingCart size={rpx(80)} color={tk.text.tertiary} />
              <Text style={styles.emptyText}>{t('cart.empty')}</Text>
            </View>
          )
        }
      />
      {/* 底部合计栏:全选 + 合计 + 去结算(对齐 miniapp cart-footer) */}
      {items.length > 0 && (
        <View style={styles.footer}>
          <Pressable
            style={[styles.checkbox, allSelected ? styles.checkboxChecked : null]}
            onPress={onToggleAll}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: allSelected }}
            accessibilityLabel={t('cart.selectAll')}
          >
            {allSelected ? <Check size={rpx(24)} color={tk.surface.light} /> : null}
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
      )}
      <ConfirmPurchasePopUp
        visible={checkoutVisible}
        title={t('cart.checkout')}
        message={t('cart.checkoutConfirm')}
        product={
          {
            name: `${t('cart.title')} × ${totalCount}`,
            price: totalPrice,
            icon: ShoppingCart,
          } satisfies ConfirmPurchaseProduct
        }
        loading={paying}
        cancelText={t('common.cancel')}
        confirmText={t('cart.checkout')}
        onCancel={() => setCheckoutVisible(false)}
        onConfirm={() => void executeCheckout()}
      />
    </View>
  )
}

const createStyles = (tk: RnThemeTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
    },
    listContent: {
      paddingBottom: rpx(40),
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rpx(20),
      marginHorizontal: rpx(24),
      marginTop: rpx(24),
      padding: rpx(24),
      borderRadius: rpx(16),
      backgroundColor: tk.surface.card,
    },
    checkbox: {
      width: rpx(40),
      height: rpx(40),
      borderRadius: rpx(20),
      borderWidth: 1.5,
      borderColor: tk.border.medium,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxChecked: {
      backgroundColor: tk.success.DEFAULT,
      borderColor: tk.success.DEFAULT,
    },
    cover: {
      width: rpx(140),
      height: rpx(140),
      borderRadius: rpx(12),
      backgroundColor: tk.surface.muted,
    },
    coverFallback: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    info: {
      flex: 1,
      gap: rpx(10),
    },
    title: {
      fontSize: 15,
      fontWeight: '600',
      color: tk.text.primary,
    },
    price: {
      fontSize: 15,
      fontWeight: '600',
      color: tk.success.DEFAULT,
    },
    qtyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rpx(16),
      alignSelf: 'flex-start',
    },
    qtyBtn: {
      width: rpx(48),
      height: rpx(48),
      borderRadius: rpx(8),
      borderWidth: 1,
      borderColor: tk.border.light,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.bg,
    },
    qtyBtnDisabled: {
      opacity: 0.5,
    },
    qtyValue: {
      minWidth: rpx(40),
      textAlign: 'center',
      fontSize: 14,
      color: tk.text.primary,
    },
    deleteBtn: {
      width: rpx(56),
      height: rpx(56),
      alignItems: 'center',
      justifyContent: 'center',
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rpx(16),
      paddingHorizontal: rpx(24),
      paddingVertical: rpx(20),
      paddingBottom: rpx(40),
      borderTopWidth: 1,
      borderTopColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    selectAll: {
      fontSize: 14,
      color: tk.text.primary,
    },
    totalWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'flex-end',
      gap: rpx(8),
    },
    totalLabel: {
      fontSize: 13,
      color: tk.text.secondary,
    },
    totalPrice: {
      fontSize: 18,
      fontWeight: '700',
      color: tk.danger.DEFAULT,
    },
    checkoutBtn: {
      paddingHorizontal: rpx(36),
      height: rpx(72),
      borderRadius: rpx(36),
      backgroundColor: tk.success.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkoutBtnDisabled: {
      opacity: 0.5,
    },
    checkoutText: {
      fontSize: 14,
      fontWeight: '600',
      color: tk.surface.light,
    },
    center: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: rpx(160),
      gap: rpx(20),
    },
    emptyText: {
      fontSize: 14,
      color: tk.text.tertiary,
    },
    retryBtn: {
      paddingHorizontal: rpx(40),
      paddingVertical: rpx(14),
      borderRadius: rpx(32),
      backgroundColor: tk.surface.card,
    },
    retryText: {
      fontSize: 14,
      color: tk.text.secondary,
    },
  } satisfies Record<string, ViewStyle | TextStyle>)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
