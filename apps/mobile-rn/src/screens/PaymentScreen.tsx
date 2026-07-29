import { useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  cancelPaymentOrder,
  createWechatAppPayment,
  getPaymentOrders,
  syncPaymentStatus,
  type PaymentOrder,
} from '@ihui/api-client'
import {
  PaymentScreen as SharedPaymentScreen,
  type PaymentOrderItem,
} from '@ihui/rn-app'
import { openWeChatPayment } from '../lib/wechat-pay'
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
    setActioningId(order.orderNo)
    setToast('')
    try {
      const res = await createWechatAppPayment({
        amount: Math.round((order.amount ?? 0) * 100),
        description: order.subject || t('payment.untitledOrder'),
      })
      if (!res.success || !res.data?.prepayData) {
        setToast(res.error || t('payment.createFailed'))
        setActioningId(null)
        return
      }
      const paid = await openWeChatPayment(res.data.prepayData)
      if (paid) {
        setToast(t('payment.paySuccess'))
        void load(true)
      } else {
        setToast(t('payment.payCancelled'))
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg === 'WECHAT_NOT_INSTALLED') setToast(t('payment.wechatNotInstalled'))
      else if (msg === 'WECHAT_NATIVE_UNAVAILABLE') setToast(t('payment.nativeUnavailable'))
      else setToast(`${t('payment.payFailed')}: ${msg}`)
    }
    setActioningId(null)
  }

  return (
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
  )
}
