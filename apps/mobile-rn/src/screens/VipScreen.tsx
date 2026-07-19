import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Button, Card } from '@ihui/ui-native'
import {
  createOrder,
  getMembershipInfo,
  getVipLevels,
  type MembershipInfo,
  type VipLevel,
} from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

function formatAmount(n: number | undefined | null): string {
  if (typeof n !== 'number') return '—'
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(iso))
  } catch {
    return '—'
  }
}

export function VipScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [levels, setLevels] = useState<VipLevel[]>([])
  const [membership, setMembership] = useState<MembershipInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [purchasingId, setPurchasingId] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    const [levelsRes, membershipRes] = await Promise.all([getVipLevels(), getMembershipInfo()])
    if (levelsRes.success) {
      setLevels(levelsRes.data)
    } else {
      setError(levelsRes.error || t('vip.loadFailed'))
    }
    if (membershipRes.success) {
      setMembership(membershipRes.data)
    }
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const handlePurchase = async (level: VipLevel) => {
    setPurchasingId(level.id)
    setToast('')
    const res = await createOrder({ type: 'vip', targetId: level.id })
    setPurchasingId(null)
    if (res.success) {
      setToast(t('vip.orderCreated', { orderNo: res.data.orderNo }))
    } else {
      setToast(res.error || t('vip.purchaseFailed'))
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-black">
        <ActivityIndicator />
        <Text className="mt-2 text-sm text-neutral-500">{t('common.loading')}</Text>
      </View>
    )
  }

  if (error && levels.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-4 dark:bg-black">
        <Text className="text-red-600">{error}</Text>
        <Button className="mt-4" variant="outline" onPress={() => load()}>
          {t('vip.retry')}
        </Button>
      </View>
    )
  }

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-black"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
    >
      <View className="px-4 pt-12 pb-2">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text className="text-base text-neutral-700 dark:text-neutral-300">
            {t('common.back')}
          </Text>
        </TouchableOpacity>
        <Text className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
          {t('vip.title')}
        </Text>
        <Text className="mt-1 text-sm text-neutral-500">{t('vip.subtitle')}</Text>
      </View>

      {error ? (
        <View className="px-4 py-2">
          <Text className="text-sm text-red-600">{error}</Text>
        </View>
      ) : null}

      {toast ? (
        <View className="px-4 py-2">
          <Text className="text-sm text-emerald-600">{toast}</Text>
        </View>
      ) : null}

      {membership && membership.isActive ? (
        <View className="px-4 mt-4">
          <Card className="bg-emerald-50 dark:bg-emerald-900/20">
            <Text className="text-sm text-emerald-700 dark:text-emerald-300">
              {t('vip.currentLevel')}
            </Text>
            <Text className="mt-1 text-xl font-semibold text-emerald-700 dark:text-emerald-300">
              {membership.levelName}
            </Text>
            <View className="mt-2 flex-row items-center justify-between">
              <Text className="text-xs text-emerald-700 dark:text-emerald-300">
                {t('vip.expireAt')}:{formatDate(membership.expireTime)}
              </Text>
              <Text className="text-xs text-emerald-700 dark:text-emerald-300">
                {t('vip.daysRemaining', { count: membership.daysRemaining })}
              </Text>
            </View>
          </Card>
        </View>
      ) : null}

      <View className="px-4 mt-4 pb-8">
        <Text className="mb-3 text-lg font-semibold text-neutral-900 dark:text-neutral-50">
          {t('vip.levelsTitle')}
        </Text>
        {levels.length === 0 ? (
          <Card>
            <Text className="text-sm text-neutral-500">{t('vip.empty')}</Text>
          </Card>
        ) : (
          levels.map((level) => {
            const isCurrent = membership?.level === level.levelValue
            return (
              <View key={level.id} className="mb-3">
                <Card>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-base font-semibold text-neutral-900 dark:text-neutral-50">
                      {level.levelName}
                    </Text>
                    {isCurrent ? (
                      <View className="rounded-md bg-emerald-100 px-2 py-0.5">
                        <Text className="text-xs text-emerald-700">{t('vip.currentBadge')}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View className="mt-2 flex-row items-end justify-between">
                    <Text className="text-xs text-neutral-500">
                      {t('vip.duration', { days: level.durationDays })}
                    </Text>
                    <Text className="text-lg font-semibold text-emerald-600">
                      ¥ {formatAmount(level.price)}
                    </Text>
                  </View>
                  {level.benefits && Object.keys(level.benefits).length > 0 ? (
                    <Text className="mt-2 text-xs text-neutral-500">
                      {t('vip.benefitsCount', { count: Object.keys(level.benefits).length })}
                    </Text>
                  ) : null}
                  {!isCurrent && level.status === 1 ? (
                    <View className="mt-3">
                      <Button
                        loading={purchasingId === level.id}
                        disabled={purchasingId === level.id}
                        onPress={() => handlePurchase(level)}
                      >
                        {t('vip.purchase')}
                      </Button>
                    </View>
                  ) : null}
                </Card>
              </View>
            )
          })
        )}
      </View>
    </ScrollView>
  )
}
