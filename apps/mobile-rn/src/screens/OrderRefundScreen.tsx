import { useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getOrders, refundOrder, type Order } from '@ihui/api-client'
import {
  OrderRefundScreen as SharedOrderRefundScreen,
  type OrderRefundItem,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { formatDateByTemplate } from '../utils/date-utils'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

function toRefundItem(orders: Order[]): OrderRefundItem[] {
  return orders.map((o) => ({
    id: o.id,
    orderNo: o.orderNo,
    targetTitle: o.targetTitle,
    payAmount: o.payAmount,
    createdAtText: formatDateByTemplate(o.createdAt, 'YYYY-MM-DD HH:mm'),
  }))
}

export function OrderRefundScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [orders, setOrders] = useState<OrderRefundItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitSuccess, setSubmitSuccess] = useState('')

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    // 仅拉取已支付订单(可退款)
    const res = await getOrders({ page: 1, pageSize: 20, status: 'paid' })
    if (res.success) {
      setOrders(toRefundItem(res.data.list))
    } else {
      setError(res.error || t('orderRefund.loadFailed'))
    }
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = async (order: OrderRefundItem) => {
    if (!reason.trim()) {
      setSubmitError(t('orderRefund.reasonRequired'))
      return
    }
    setSubmitting(true)
    setSubmitError('')
    setSubmitSuccess('')
    const res = await refundOrder(order.orderNo, reason.trim())
    setSubmitting(false)
    if (res.success) {
      setSubmitSuccess(t('orderRefund.submitSuccess', { orderNo: order.orderNo }))
      setReason('')
      setSelectedId(null)
      void load(true)
    } else {
      setSubmitError(res.error || t('orderRefund.submitFailed'))
    }
  }

  return (
    <SharedOrderRefundScreen
      t={t}
      orders={orders}
      loading={loading}
      refreshing={refreshing}
      error={error}
      selectedId={selectedId}
      reason={reason}
      submitting={submitting}
      submitError={submitError}
      submitSuccess={submitSuccess}
      onSelectOrder={setSelectedId}
      onReasonChange={setReason}
      onSubmit={handleSubmit}
      onCancel={() => {
        setSelectedId(null)
        setReason('')
        setSubmitError('')
      }}
      onRefresh={() => load(true)}
      onBack={() => navigation.goBack()}
    />
  )
}
