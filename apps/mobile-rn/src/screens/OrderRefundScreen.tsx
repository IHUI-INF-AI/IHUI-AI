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
import { Button, Card, Input } from '@ihui/ui-native'
import { getOrders, refundOrder, type Order } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

function formatAmount(n: number | undefined | null): string {
  if (typeof n !== 'number') return '—'
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatTime(iso: string): string {
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

export function OrderRefundScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [orders, setOrders] = useState<Order[]>([])
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
      setOrders(res.data.list)
    } else {
      setError(res.error || t('orderRefund.loadFailed'))
    }
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const handleSubmit = async (order: Order) => {
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
    <View className="flex-1 bg-white dark:bg-black">
      <View className="px-4 pt-12 pb-2">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text className="text-base text-neutral-700 dark:text-neutral-300">
            {t('common.back')}
          </Text>
        </TouchableOpacity>
        <Text className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
          {t('orderRefund.title')}
        </Text>
        <Text className="mt-1 text-sm text-neutral-500">{t('orderRefund.subtitle')}</Text>
      </View>

      {error ? (
        <View className="px-4 py-2">
          <Text className="text-sm text-red-600">{error}</Text>
          <Button className="mt-2" variant="outline" size="sm" onPress={() => load()}>
            {t('orderRefund.retry')}
          </Button>
        </View>
      ) : null}

      {submitSuccess ? (
        <View className="px-4 py-2">
          <Text className="text-sm text-emerald-600">{submitSuccess}</Text>
        </View>
      ) : null}

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
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
              <Text className="text-sm text-neutral-500">{t('orderRefund.empty')}</Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const isSelected = selectedId === item.id
          return (
            <Card>
              <View className="flex-row items-center justify-between">
                <Text
                  className="flex-1 text-base font-semibold text-neutral-900 dark:text-neutral-50"
                  numberOfLines={1}
                >
                  {item.targetTitle}
                </Text>
                <Text className="ml-2 text-base font-semibold text-emerald-600">
                  ¥ {formatAmount(item.payAmount)}
                </Text>
              </View>
              <View className="mt-1 flex-row justify-between">
                <Text className="text-xs text-neutral-500">
                  {t('orderRefund.orderNo')}:{item.orderNo}
                </Text>
                <Text className="text-xs text-neutral-500">{formatTime(item.createdAt)}</Text>
              </View>

              {isSelected ? (
                <View className="mt-3 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
                  <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    {t('orderRefund.reasonLabel')}
                  </Text>
                  <Input
                    value={reason}
                    onChangeText={setReason}
                    placeholder={t('orderRefund.reasonPlaceholder')}
                    multiline
                    className="mt-2 h-20"
                  />
                  {submitError ? (
                    <Text className="mt-2 text-xs text-red-600">{submitError}</Text>
                  ) : null}
                  <View className="mt-3 flex-row gap-2">
                    <View className="flex-1">
                      <Button
                        loading={submitting}
                        disabled={submitting}
                        onPress={() => handleSubmit(item)}
                      >
                        {t('orderRefund.submit')}
                      </Button>
                    </View>
                    <View className="flex-1">
                      <Button
                        variant="outline"
                        disabled={submitting}
                        onPress={() => {
                          setSelectedId(null)
                          setReason('')
                          setSubmitError('')
                        }}
                      >
                        {t('common.cancel')}
                      </Button>
                    </View>
                  </View>
                </View>
              ) : (
                <View className="mt-3">
                  <Button variant="outline" size="sm" onPress={() => setSelectedId(item.id)}>
                    {t('orderRefund.applyRefund')}
                  </Button>
                </View>
              )}
            </Card>
          )
        }}
      />
    </View>
  )
}
