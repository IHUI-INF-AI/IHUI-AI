import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Card } from '@ihui/ui-native'
import { getOrders, getUserStatistics, type UserStatistics } from '@ihui/api-client'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import type { ProfileStackParamList } from '../navigation/RootNavigator'
import { MENU_SECTIONS, type MenuItem } from './profileMenuData'

type NavigationProp = NativeStackNavigationProp<ProfileStackParamList>

export function ProfileScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const { user, logout, ready } = useAuth()
  const [stats, setStats] = useState<UserStatistics | null>(null)
  const [orderCount, setOrderCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const [statsRes, orderRes] = await Promise.all([
        getUserStatistics(),
        getOrders({ page: 1, pageSize: 1 }),
      ])
      if (cancelled) return
      if (statsRes.success) setStats(statsRes.data)
      if (orderRes.success) setOrderCount(orderRes.data.total)
      if (!statsRes.success && !orderRes.success) {
        setError(statsRes.error || orderRes.error || t('common.networkError'))
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [ready, t])

  const onNavigate = (item: MenuItem) => {
    if (item.viaParent) {
      navigation.getParent()?.navigate(item.key as never)
    } else {
      navigation.navigate(item.key as never)
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    )
  }

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-black"
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      <View className="px-4 pt-12 pb-4">
        <Text className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
          {t('profile.title')}
        </Text>
      </View>

      <View className="px-4">
        <Card>
          <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            {user?.nickname || user?.phone || t('profile.notLoggedIn')}
          </Text>
          {user?.id ? <Text className="mt-1 text-xs text-neutral-500">ID: {user.id}</Text> : null}
          <View className="mt-3 flex-row items-center gap-3">
            <View className="rounded-md bg-emerald-50 px-3 py-1.5">
              <Text className="text-[10px] text-emerald-700">{t('profile.points')}</Text>
              <Text className="text-sm font-semibold text-emerald-700">{stats?.points ?? 0}</Text>
            </View>
            <View className="rounded-md bg-blue-50 px-3 py-1.5">
              <Text className="text-[10px] text-blue-700">{t('profile.studyHours')}</Text>
              <Text className="text-sm font-semibold text-blue-700">{stats?.studyHours ?? 0}</Text>
            </View>
          </View>
        </Card>
      </View>

      {error ? (
        <View className="px-4 py-2">
          <Text className="text-sm text-red-600">{error}</Text>
        </View>
      ) : null}

      <View className="px-4 mt-4">
        <Text className="mb-2 text-base font-semibold text-neutral-900 dark:text-neutral-50">
          {t('profile.statistics')}
        </Text>
        <Card>
          <View className="flex-row justify-between">
            <View className="items-center">
              <Text className="text-lg font-semibold text-neutral-900">
                {stats?.courseCount ?? 0}
              </Text>
              <Text className="text-[10px] text-neutral-500">{t('profile.courseCount')}</Text>
            </View>
            <View className="items-center">
              <Text className="text-lg font-semibold text-neutral-900">{orderCount}</Text>
              <Text className="text-[10px] text-neutral-500">{t('nav.orders')}</Text>
            </View>
            <View className="items-center">
              <Text className="text-lg font-semibold text-neutral-900">
                {stats?.favoriteCount ?? 0}
              </Text>
              <Text className="text-[10px] text-neutral-500">{t('profile.favoriteCount')}</Text>
            </View>
          </View>
        </Card>
      </View>

      {MENU_SECTIONS.map((section) => (
        <View key={section.titleKey} className="mt-4 px-4">
          <Text className="mb-2 text-xs font-semibold uppercase text-neutral-500">
            {t(section.titleKey)}
          </Text>
          <View className="rounded-lg bg-neutral-50 dark:bg-neutral-900 p-1">
            {section.items.map((m) => (
              <TouchableOpacity
                key={m.key}
                onPress={() => onNavigate(m)}
                activeOpacity={0.7}
                className="p-3"
              >
                <View className="flex-row items-center">
                  <Text className="text-lg">{m.icon}</Text>
                  <Text className="ml-3 flex-1 text-sm text-neutral-900 dark:text-neutral-50">
                    {t(m.labelKey)}
                  </Text>
                  <Text className="text-neutral-400">›</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      <View className="mt-4 px-4">
        <TouchableOpacity
          onPress={() => void logout()}
          className="rounded-lg border border-red-200 bg-red-50 p-3"
        >
          <Text className="text-center text-sm text-red-600">{t('auth.logout')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}
