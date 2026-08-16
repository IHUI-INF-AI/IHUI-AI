import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { checkPaymentStatus, createWechatAppPayment, fetchApi } from '@ihui/api-client'
import { OrderDetailScreen as SharedOrderDetailScreen, type OrderDetailItem } from '@ihui/rn-app'
import { BottomActionBar, type BottomActionBarAction } from '../components/BottomActionBar'
import { PurchaseNoticePopUp } from '../components/PurchaseNoticePopUp'
import { isWeChatInstalled, openWeChatPayment } from '../lib/wechat-pay'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Route = RouteProp<RootStackParamList, 'OrderDetail'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * mobile-rn 订单详情(2026-07-30 接入本地 BottomActionBar)
 *
 * shell 层职责:
 * - 主体调用 @ihui/rn-app.SharedOrderDetailScreen(订单信息 / loading / 错误)
 * - 底部叠加 mobile-rn 本地 BottomActionBar:
 *   - 待支付:取消订单(secondary) + 立即支付(primary)
 *   - 已支付:申请退款(secondary) + 联系卖家(primary)
 *   - 已完成:再次购买(primary,单按钮)
 *   - 已取消:无操作
 */
export function OrderDetailScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { id } = route.params
  const [order, setOrder] = useState<OrderDetailItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  // 购买须知弹窗(已支付订单首次进入时自动展示)
  const [noticeVisible, setNoticeVisible] = useState(false)
  // ref 标记提示已展示,避免 setState 触发 effect 重跑导致重复请求
  const noticeHandledRef = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const res = await fetchApi<OrderDetailItem>(`/api/orders/${encodeURIComponent(id)}`)
    if (res.success) {
      setOrder(res.data)
      // 已支付订单首次加载自动展示购买须知
      if (res.data?.status === 'paid' && !noticeHandledRef.current) {
        noticeHandledRef.current = true
        setNoticeVisible(true)
      }
    } else {
      setError(res.error || t('orderDetail.loadFailed'))
    }
    setLoading(false)
  }, [id, t])

  useEffect(() => {
    void load()
  }, [load])

  // cancel/refund:调用后端 POST /api/orders/:id/{cancel|refund}
  const callOrderAction = useCallback(
    async (action: string): Promise<void> => {
      setActionLoading(action)
      try {
        let body: string | undefined
        // refund 接口要求 refundAmount(对齐后端 applyRefundSchema)
        if (action === 'refund' && order) {
          body = JSON.stringify({ refundAmount: order.amount })
        }
        const res = await fetchApi(`/api/orders/${encodeURIComponent(id)}/${action}`, {
          method: 'POST',
          body,
        })
        if (res.success) {
          // 重新拉取详情以反映真实状态
          await load()
        }
      } finally {
        setActionLoading(null)
      }
    },
    [id, order, load],
  )

  // 立即支付:直接走 createWechatAppPayment → openWeChatPayment → checkPaymentStatus 链路
  // (后端无 /api/orders/:id/pay 路由,复用 VipScreen/PaymentScreen 同款支付流程)
  const handlePay = useCallback(async () => {
    if (!order) return
    setActionLoading('pay')
    try {
      // 1. 检查微信客户端
      const installed = await isWeChatInstalled()
      if (!installed) {
        Alert.alert(t('payment.wechatNotInstalled'))
        return
      }

      // 2. 创建微信 APP 支付订单(后端返回签名参数)
      const payRes = await createWechatAppPayment({
        amount: Math.round(order.amount * 100),
        orderType: 1,
        description: order.productName,
      })
      if (!payRes.success || !payRes.data) {
        Alert.alert(payRes.error || t('vipScreen.pay.failed'))
        return
      }

      // 3. mock 模式(DEV 环境无微信支付配置)
      if (payRes.data.mock) {
        if (__DEV__) {
          console.warn('[OrderDetailScreen] mock 支付模式:跳过微信SDK')
        }
        await load()
        return
      }

      // 4. 调起微信 APP 支付
      if (!payRes.data.prepayData) {
        Alert.alert(t('payment.nativeUnavailable'))
        return
      }
      const paySuccess = await openWeChatPayment(payRes.data.prepayData)
      if (!paySuccess) {
        // 用户取消支付
        return
      }

      // 5. 查询支付状态确认(乐观提示:SDK 成功即展示)
      const outTradeNo = payRes.data.outTradeNo
      if (outTradeNo) {
        const statusRes = await checkPaymentStatus(outTradeNo)
        if (!statusRes.success || !statusRes.data?.paid) {
          if (__DEV__) {
            console.warn('[OrderDetailScreen] 支付SDK成功但后端未同步', { outTradeNo })
          }
        }
      }
      // 6. 重新加载订单详情
      await load()
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      if (errMsg === 'WECHAT_NOT_INSTALLED') {
        Alert.alert(t('payment.wechatNotInstalled'))
      } else if (errMsg === 'WECHAT_NATIVE_UNAVAILABLE') {
        Alert.alert(t('payment.nativeUnavailable'))
      } else {
        Alert.alert(t('payment.payFailed'))
      }
    } finally {
      setActionLoading(null)
    }
  }, [order, t, load])

  // 联系卖家:客户端行为(无后端接口)
  const handleContact = useCallback(() => {
    Alert.alert('联系卖家', '如有问题请联系客服微信：aizhs_kefu')
  }, [])

  // 再次购买:跳转 VIP 页(无后端接口)
  const handleRebuy = useCallback(() => {
    navigation.navigate('Vip')
  }, [navigation])

  const actions = useMemo<ReadonlyArray<BottomActionBarAction>>(() => {
    if (!order) return []
    const status = order.status
    const wrap = (key: string, action: () => void): BottomActionBarAction => ({
      key,
      onPress: action,
      loading: actionLoading === key,
    })
    if (status === 'pending' || status === 'unpaid') {
      return [
        wrap('cancel', () => {
          void callOrderAction('cancel')
        }),
        {
          ...wrap('pay', () => {
            void handlePay()
          }),
          label: '立即支付',
          primary: true,
        },
      ]
    }
    if (status === 'paid' || status === 'shipped') {
      return [
        wrap('refund', () => {
          void callOrderAction('refund')
        }),
        {
          ...wrap('contact', () => {
            handleContact()
          }),
          label: '联系卖家',
          primary: true,
        },
      ]
    }
    if (status === 'completed') {
      return [
        {
          ...wrap('rebuy', () => {
            handleRebuy()
          }),
          label: '再次购买',
          primary: true,
        },
      ]
    }
    if (status === 'cancelled') {
      return [
        {
          ...wrap('rebuy', () => {
            handleRebuy()
          }),
          label: '再次购买',
          primary: true,
        },
      ]
    }
    return []
  }, [order, actionLoading, callOrderAction, handlePay, handleContact, handleRebuy])

  return (
    <View style={styles.container}>
      <View style={styles.body}>
        <SharedOrderDetailScreen
          t={t}
          item={order}
          loading={loading}
          error={error}
          onBack={() => navigation.goBack()}
        />
      </View>
      {actions.length > 0 ? <BottomActionBar actions={actions} /> : null}
      <PurchaseNoticePopUp
        visible={noticeVisible}
        title="购买成功"
        subtitle="请仔细阅读购买须知,享受您的权益"
        bullets={[
          '订单已支付成功,请妥善保管凭证',
          '如需退款请在 7 天内申请',
          '专属客服 24 小时在线服务',
        ]}
        primaryLabel="我知道了"
        onClose={() => setNoticeVisible(false)}
        onPrimary={() => setNoticeVisible(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
})
