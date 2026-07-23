import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Button, Card } from '@ihui/ui-native'
import {
  cancelPaymentOrder,
  createWechatAppPayment,
  getPaymentOrders,
  syncPaymentStatus,
  type PaymentOrder,
  type PaymentStatus,
} from '@ihui/api-client'
import { openWeChatPayment } from '../lib/wechat-pay'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const STATUS_STYLE: Record<PaymentStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  paid: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-neutral-200 text-neutral-600',
  refunded: 'bg-violet-100 text-violet-700',
}

const STATUS_KEY: Record<PaymentStatus, string> = {
  pending: 'payment.status.pending',
  paid: 'payment.status.paid',
  failed: 'payment.status.failed',
  cancelled: 'payment.status.cancelled',
  refunded: 'payment.status.refunded',
}

function formatAmount(n: number | undefined | null): string {
  if (typeof n !== 'number') return '—'
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatTime(iso: string | undefined): string {
  if (!iso) return ''
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return ''
  }
}

export function PaymentScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [orders, setOrders] = useState<PaymentOrder[]>([])
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
      setOrders(res.data.list)
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

  const handlePay = async (order: PaymentOrder) => {
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
    <View className="flex-1 bg-white dark:bg-black">
      <View className="px-4 pt-12 pb-2">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text className="text-base text-neutral-700 dark:text-neutral-300">
            {t('common.back')}
          </Text>
        </TouchableOpacity>
        <Text className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
          {t('payment.title')}
        </Text>
        <Text className="mt-1 text-sm text-neutral-500">{t('payment.subtitle')}</Text>
      </View>

      {error ? (
        <View className="px-4 py-2">
          <Text className="text-sm text-red-600">{error}</Text>
          <Button className="mt-2" variant="outline" size="sm" onPress={() => load()}>
            {t('payment.retry')}
          </Button>
        </View>
      ) : null}

      {toast ? (
        <View className="px-4 py-2">
          <Text className="text-sm text-emerald-600">{toast}</Text>
        </View>
      ) : null}

      <FlatList
        data={orders}
        keyExtractor={(item) => item.orderNo}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ItemSeparatorComponent={() => <View className="h-3" />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        ListEmptyComponent={
          loading ? (
            <View className="items-center py-12">
              <ActivityIndicator />
              <Text className="mt-2 text-sm text-neutral-500">{t('common.loading')}</Text>
            </View>
          ) : (
            <View className="items-center py-12">
              <Text className="text-sm text-neutral-500">{t('payment.empty')}</Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const statusKey = STATUS_KEY[item.status] ?? 'payment.status.pending'
          const statusStyle =
            STATUS_STYLE[item.status] ?? 'bg-neutral-200 text-neutral-600'
          const isPending = item.status === 'pending'
          return (
            <Card>
              <View className="flex-row items-center justify-between">
                <Text
                  className="flex-1 text-base font-semibold text-neutral-900 dark:text-neutral-50"
                  numberOfLines={1}
                >
                  {item.subject || t('payment.untitledOrder')}
                </Text>
                <View className={`ml-2 rounded-md px-2 py-0.5 ${statusStyle}`}>
                  <Text className="text-xs">{t(statusKey)}</Text>
                </View>
              </View>
              <View className="mt-1 flex-row justify-between">
                <Text className="text-xs text-neutral-500">
                  {t('payment.orderNo')}:{item.orderNo}
                </Text>
                <Text className="text-xs text-neutral-500">{formatTime(item.createdAt)}</Text>
              </View>
              <View className="mt-2 flex-row items-end justify-between">
                <Text className="text-xs text-neutral-500">{t('payment.amount')}</Text>
                <Text className="text-lg font-semibold text-emerald-600">
                  ¥ {formatAmount(item.amount)}
                </Text>
              </View>
              {item.paymentMethod ? (
                <Text className="mt-1 text-xs text-neutral-500">
                  {t('payment.method')}:{item.paymentMethod}
                </Text>
              ) : null}
              {item.paidAt ? (
                <Text className="mt-1 text-xs text-neutral-500">
                  {t('payment.paidAt')}:{formatTime(item.paidAt)}
                </Text>
              ) : null}
              {isPending ? (
                <View className="mt-3 gap-2">
                  <Button
                    loading={actioningId === item.orderNo}
                    disabled={actioningId === item.orderNo}
                    onPress={() => handlePay(item)}
                  >
                    {t('payment.payNow')}
                  </Button>
                  <View className="flex-row gap-2">
                    <View className="flex-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={actioningId === item.orderNo}
                        onPress={() => handleSync(item.orderNo)}
                      >
                        {t('payment.syncStatus')}
                      </Button>
                    </View>
                    <View className="flex-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={actioningId === item.orderNo}
                        onPress={() => handleCancel(item.orderNo)}
                      >
                        {t('payment.cancelOrder')}
                      </Button>
                    </View>
                  </View>
                </View>
              ) : null}
            </Card>
          )
        }}
      />
    </View>
  )
}
