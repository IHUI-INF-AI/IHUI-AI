import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  cancelPaymentOrder,
  createWechatAppPayment,
  getPaymentOrders,
  syncPaymentStatus,
  type PaymentOrder,
} from '@ihui/api-client'
import { PaymentScreen as SharedPaymentScreen, type PaymentOrderItem } from '@ihui/rn-app'
import { openWeChatPayment } from '../lib/wechat-pay'
import {
  ConfirmPurchasePopUp,
  type ConfirmPurchaseProduct,
} from '../components/ConfirmPurchasePopUp'
import { PayButton } from '../components/PayButton'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { formatDateByTemplate } from '../utils/date-utils'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

function toPaymentItem(orders: PaymentOrder[]): PaymentOrderItem[] {
  return orders.map((o) => ({
    orderNo: o.orderNo,
    subject: o.subject ?? '',
    amount: o.amount,
    status: o.status,
    createdAtText: formatDateByTemplate(o.createdAt, 'YYYY-MM-DD HH:mm'),
    paidAtText: o.paidAt ? formatDateByTemplate(o.paidAt, 'YYYY-MM-DD HH:mm') : null,
    paymentMethod: o.paymentMethod,
  }))
}

export function PaymentScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [orders, setOrders] = useState<PaymentOrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [actioningId, setActioningId] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  // 待确认购买的订单:点击 Pay 时先弹 ConfirmPurchasePopUp,用户确认后再发起微信支付
  const [pendingPurchase, setPendingPurchase] = useState<PaymentOrderItem | null>(null)
  const [purchaseLoading, setPurchaseLoading] = useState(false)

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    const res = await getPaymentOrders({ page: 1, pageSize: 20 })
    if (res.success) {
      setOrders(toPaymentItem(res.data.list))
    } else {
      setError(res.error || t('payment.loadFailed'))
    }
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSync = async (orderNo: string) => {
    setActioningId(orderNo)
    setToast('')
    const res = await syncPaymentStatus(orderNo)
    setActioningId(null)
    if (res.success) {
      setToast(t('payment.syncSuccess', { orderNo }))
      void load(true)
    } else {
      setToast(res.error || t('payment.syncFailed'))
    }
  }

  const handleCancel = async (orderNo: string) => {
    setActioningId(orderNo)
    setToast('')
    const res = await cancelPaymentOrder(orderNo)
    setActioningId(null)
    if (res.success) {
      setToast(t('payment.cancelSuccess', { orderNo }))
      void load(true)
    } else {
      setToast(res.error || t('payment.cancelFailed'))
    }
  }

  const handlePay = async (order: PaymentOrderItem) => {
    // 第一步:弹出 ConfirmPurchasePopUp 让用户二次确认
    setPendingPurchase(order)
  }

  const executePayment = async (order: PaymentOrderItem) => {
    setActioningId(order.orderNo)
    setPurchaseLoading(true)
    setToast('')
    try {
      const res = await createWechatAppPayment({
        amount: Math.round((order.amount ?? 0) * 100),
        description: order.subject || t('payment.untitledOrder'),
      })
      if (!res.success || !res.data?.prepayData) {
        setToast(res.error || t('payment.createFailed'))
        return
      }
      const paid = await openWeChatPayment(res.data.prepayData)
      if (paid) {
        setToast(t('payment.paySuccess'))
        navigation.navigate('TopupSuccess', { amount: order.amount ?? 0, orderId: order.orderNo })
        void load(true)
      } else {
        setToast(t('payment.payCancelled'))
        navigation.navigate('TopupFail', { reason: t('payment.payCancelled') })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg === 'WECHAT_NOT_INSTALLED') setToast(t('payment.wechatNotInstalled'))
      else if (msg === 'WECHAT_NATIVE_UNAVAILABLE') setToast(t('payment.nativeUnavailable'))
      else setToast(`${t('payment.payFailed')}: ${msg}`)
      navigation.navigate('TopupFail', { reason: msg })
    } finally {
      setActioningId(null)
      setPurchaseLoading(false)
      setPendingPurchase(null)
    }
  }

  const cancelPurchase = () => {
    if (purchaseLoading) return
    setPendingPurchase(null)
  }

  /** 「去充值」入口:跳转 Recharge(钱包页),对齐 ProfileScreen handleRecharge */
  const handleRecharge = () => {
    navigation.navigate('Recharge')
  }

  const pendingProduct: ConfirmPurchaseProduct | null = pendingPurchase
    ? {
        name: pendingPurchase.subject || t('payment.untitledOrder'),
        price: (pendingPurchase.amount ?? 0) / 100,
        icon: '💳',
      }
    : null

  return (
    <View style={styles.container}>
      <SharedPaymentScreen
        t={t}
        orders={orders}
        loading={loading}
        refreshing={refreshing}
        error={error}
        actioningId={actioningId}
        toast={toast}
        onPay={handlePay}
        onSync={handleSync}
        onCancel={handleCancel}
        onRefresh={() => load(true)}
        onBack={() => navigation.goBack()}
      />
      <View style={styles.rechargeWrap}>
        <PayButton amount={0} label="去充值" onPress={handleRecharge} />
      </View>
      {pendingProduct ? (
        <ConfirmPurchasePopUp
          visible={pendingPurchase !== null}
          title="确认支付"
          message={`订单号:${pendingPurchase?.orderNo ?? ''}`}
          product={pendingProduct}
          loading={purchaseLoading}
          cancelText="再看看"
          confirmText="确认支付"
          onCancel={cancelPurchase}
          onConfirm={() => {
            if (pendingPurchase) void executePayment(pendingPurchase)
          }}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  rechargeWrap: { padding: 16, paddingBottom: 24 },
})
