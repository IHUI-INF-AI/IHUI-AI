// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * CartScreen 购物车页(mobile-rn 端)—— 薄壳,渲染真相源在共享层
 * `packages/app/src/features/cart/CartScreen.tsx`(经 `@ihui/rn-app` 具名导出),
 * 本文件只管平台侧:取数、导航、取词、主题,以及 RN 独占的微信支付结算腿
 * (isWeChatInstalled → createWechatAppPayment → openWeChatPayment,与 OrderDetailScreen
 *  /PaymentScreen 同款)和删除确认(appAlert,对齐小程序 Taro.showModal 语义)。
 *
 * 数据源:共享层 @ihui/api-client selectGoods(GET /goods/select,page=1&pageSize=50
 * 对齐小程序),字段兜底收敛进共享 normalizeCartGoods(与小程序 pkg-shop/cart 同一份)。
 * 结算成功后 navigate PayResult(orderNo) 对齐统一支付结果页。
 */
import { useCallback, useEffect, useState } from 'react'
import { View } from 'react-native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useNavigation } from '@react-navigation/native'
import { ShoppingCart } from 'lucide-react-native'
import {
  createWechatAppPayment,
  normalizeCartGoods,
  selectGoods,
  type CartGoods,
} from '@ihui/api-client'
import { CartScreen as SharedCartScreen, type CartItemView } from '@ihui/rn-app'
import { appAlert } from '../components/BottomPops'
import {
  ConfirmPurchasePopUp,
  type ConfirmPurchaseProduct,
} from '../components/ConfirmPurchasePopUp'
import { useI18n } from '../i18n'
import { useRefreshOnFocus } from '../hooks'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { isWeChatInstalled, openWeChatPayment } from '../lib/wechat-pay'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function CartScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()

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
        setItems(
          rawList.map((item: CartGoods) => ({
            ...normalizeCartGoods(item, t('cart.product')),
            selected: true,
          })),
        )
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

  // 回屏即重取(对齐小程序 useDidShow 的每次显示刷新;首屏由上面的 useEffect 负责)
  useRefreshOnFocus(load)

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
  const onRemove = (id: string) => {
    appAlert(t('common.hint'), t('cart.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => setItems((prev) => prev.filter((it) => it.id !== id)),
      },
    ])
  }

  const { totalCount, totalPrice } = items.reduce(
    (acc, it) =>
      it.selected
        ? {
            totalCount: acc.totalCount + it.quantity,
            totalPrice: acc.totalPrice + it.quantity * it.price,
          }
        : acc,
    { totalCount: 0, totalPrice: 0 },
  )

  const onCheckout = () => {
    if (totalCount === 0) {
      appAlert(t('cart.selectFirst'))
      return
    }
    setCheckoutVisible(true)
  }

  /** 结算:复用 RN 现有微信支付链路(OrderDetailScreen 同款),成功后进统一支付结果页 */
  const executeCheckout = async () => {
    setPaying(true)
    try {
      const installed = await isWeChatInstalled()
      if (!installed) {
        appAlert(t('payment.wechatNotInstalled'))
        return
      }
      // 创建微信 APP 支付订单(amount 单位:分,后端契约)
      const res = await createWechatAppPayment({
        amount: Math.round(totalPrice * 100),
        description: t('cart.title'),
      })
      if (!res.success || !res.data) {
        appAlert(res.error || t('payment.createFailed'))
        return
      }
      // DEV mock(无微信支付配置):后端已落单,直接进结果页轮询状态
      if (res.data.mock && res.data.outTradeNo) {
        setCheckoutVisible(false)
        navigation.navigate('PayResult', { orderNo: res.data.outTradeNo })
        return
      }
      if (!res.data.prepayData) {
        appAlert(t('payment.nativeUnavailable'))
        return
      }
      const paid = await openWeChatPayment(res.data.prepayData)
      setCheckoutVisible(false)
      if (paid && res.data.outTradeNo) {
        navigation.navigate('PayResult', { orderNo: res.data.outTradeNo })
      } else if (!paid) {
        appAlert(t('payment.payCancelled'))
      } else {
        appAlert(t('payment.payFailed'))
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg === 'WECHAT_NOT_INSTALLED') appAlert(t('payment.wechatNotInstalled'))
      else if (msg === 'WECHAT_NATIVE_UNAVAILABLE') appAlert(t('payment.nativeUnavailable'))
      else appAlert(t('payment.payFailed'))
    } finally {
      setPaying(false)
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <SharedCartScreen
        t={t}
        colorScheme={resolvedTheme}
        items={items}
        loading={loading}
        refreshing={refreshing}
        error={error}
        onBack={() => navigation.goBack()}
        onRetry={() => void load()}
        onRefresh={() => void load(true)}
        onToggleItem={onToggleItem}
        onToggleAll={onToggleAll}
        onQuantityChange={onQuantityChange}
        onRemove={onRemove}
        onCheckout={onCheckout}
      />
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

export default CartScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
