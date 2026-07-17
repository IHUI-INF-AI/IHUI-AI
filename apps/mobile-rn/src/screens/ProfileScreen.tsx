import { useEffect, useState } from 'react'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Card } from '@ihui/ui-native'
import { getProfile, type AuthUser } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function ProfileScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [profile, setProfile] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await getProfile()
      if (cancelled) return
      if (res.success) setProfile(res.data)
      else setError(res.error || '加载失败')
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-gray-500">加载中...</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-4">
        <Text className="text-red-600">{error}</Text>
      </View>
    )
  }

  const data = profile
  if (!data) return null

  const rows: Array<[string, string | null]> = [
    ['用户 ID', data.id],
    ['昵称', data.nickname ?? null],
    ['邮箱', data.email ?? null],
    ['手机号', data.phone ?? null],
    ['角色', (data.roleId ?? 0) >= 1 ? '管理员' : '普通用户'],
  ]

  const menu: Array<{ label: string; screen: 'Favorites' | 'Following' | 'Subscriptions' }> = [
    { label: t('favorites.title'), screen: 'Favorites' },
    { label: t('following.title'), screen: 'Following' },
    { label: t('subscriptions.title'), screen: 'Subscriptions' },
  ]

  return (
    <ScrollView className="flex-1 bg-white dark:bg-black">
      <View className="px-4 pb-2 pt-6">
        <Text className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
          {data.nickname || '未设置昵称'}
        </Text>
        {data.bio ? <Text className="mt-1 text-sm text-neutral-500">{data.bio}</Text> : null}
      </View>
      <View className="px-4 pb-6">
        <Card>
          {rows.map(([label, value], idx) => (
            <View
              key={label}
              className={
                idx === 0
                  ? 'flex-row justify-between border-b border-neutral-100 py-3 dark:border-neutral-800'
                  : 'flex-row justify-between border-b border-neutral-100 py-3 dark:border-neutral-800'
              }
            >
              <Text className="text-sm text-neutral-500">{label}</Text>
              <Text className="text-sm text-neutral-900 dark:text-neutral-50">{value || '—'}</Text>
            </View>
          ))}
        </Card>
      </View>
      <View className="px-4 pb-6">
        <Text className="mb-2 text-xl font-semibold text-neutral-900 dark:text-neutral-50">
          {t('nav.profile')}
        </Text>
        <Card>
          {menu.map(({ label, screen }, idx) => (
            <TouchableOpacity
              key={screen}
              onPress={() => navigation.navigate(screen as keyof RootStackParamList)}
              className={
                idx === 0
                  ? 'flex-row justify-between border-b border-neutral-100 py-3 dark:border-neutral-800'
                  : 'flex-row justify-between border-b border-neutral-100 py-3 dark:border-neutral-800'
              }
            >
              <Text className="text-sm text-neutral-900 dark:text-neutral-50">{label}</Text>
              <Text className="text-sm text-neutral-400">›</Text>
            </TouchableOpacity>
          ))}
        </Card>
      </View>
    </ScrollView>
  )
}
