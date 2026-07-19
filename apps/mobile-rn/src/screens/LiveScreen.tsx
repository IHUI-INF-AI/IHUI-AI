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
import { Card } from '@ihui/ui-native'
import { getLiveList, type Live } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { LiveStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<LiveStackParamList>

function formatStart(iso: string): string {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return ''
  }
}

function statusKey(live: Live): 'live.ongoing' | 'live.upcoming' | 'live.ended' {
  if (live.isLive) return 'live.ongoing'
  if (new Date(live.startTime).getTime() > Date.now()) return 'live.upcoming'
  return 'live.ended'
}

function statusColor(key: 'live.ongoing' | 'live.upcoming' | 'live.ended'): string {
  if (key === 'live.ongoing') return 'bg-red-500'
  if (key === 'live.upcoming') return 'bg-amber-500'
  return 'bg-neutral-400'
}

export function LiveScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [lives, setLives] = useState<Live[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    const res = await getLiveList({ page: 1, pageSize: 20 })
    if (res.success) {
      setLives(res.data.list)
    } else {
      setError(res.error || t('live.loadFailed'))
    }
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <View className="flex-1 bg-white dark:bg-black">
      <View className="px-4 pt-12 pb-2">
        <Text className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
          {t('live.title')}
        </Text>
      </View>

      {error ? (
        <View className="px-4 py-2">
          <Text className="text-sm text-red-600">{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={lives}
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
              <Text className="text-sm text-neutral-500">{t('live.empty')}</Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const key = statusKey(item)
          return (
            <TouchableOpacity
              onPress={() => navigation.navigate('LiveDetail', { id: item.id })}
              activeOpacity={0.7}
            >
              <Card>
                <View className="flex-row items-center justify-between">
                  <Text
                    className="flex-1 text-base font-semibold text-neutral-900 dark:text-neutral-50"
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  <View className={`rounded-md px-2 py-0.5 ${statusColor(key)}`}>
                    <Text className="text-xs text-white">{t(key)}</Text>
                  </View>
                </View>
                {item.lecturerName ? (
                  <Text className="mt-1 text-xs text-neutral-500">
                    {t('live.lecturer')}:{item.lecturerName}
                  </Text>
                ) : null}
                <View className="mt-2 flex-row items-center justify-between">
                  <Text className="text-xs text-neutral-500">
                    {t('live.startAt')}:{formatStart(item.startTime)}
                  </Text>
                  <Text className="text-xs text-neutral-500">
                    {t('live.viewerCount', { count: item.viewCount })}
                  </Text>
                </View>
              </Card>
            </TouchableOpacity>
          )
        }}
      />
    </View>
  )
}
