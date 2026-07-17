import { useEffect, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { VipBadge } from '@ihui/ui-native'
import {
  getAgents,
  getAgentDetail,
  getAgentPermission,
  type Agent,
  type AgentPermission,
} from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Props = NativeStackScreenProps<RootStackParamList, 'Agent'>

function getInitial(name: string): string {
  return name?.trim().charAt(0)?.toUpperCase() || '?'
}

function permissionLabel(p: AgentPermission | null): string {
  if (!p) return ''
  if (p.hasPermission) return '可使用'
  return p.reason || p.type
}

export function AgentScreen(_: Props) {
  const { t } = useI18n()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<Agent | null>(null)
  const [permission, setPermission] = useState<AgentPermission | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    getAgents({ status: 'published', pageSize: 50 })
      .then((res) => {
        if (cancelled) return
        if (res.success) setAgents(res.data.list)
        else setError(res.error)
      })
      .catch((e) => !cancelled && setError(e?.message || t('common.networkError')))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [t])

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      setPermission(null)
      return
    }
    let cancelled = false
    setDetailLoading(true)
    setDetail(null)
    setPermission(null)
    Promise.all([getAgentDetail(selectedId), getAgentPermission(selectedId)])
      .then(([d, p]) => {
        if (cancelled) return
        if (d.success) setDetail(d.data)
        else setError(d.error)
        if (p.success) setPermission(p.data)
      })
      .catch((e) => !cancelled && setError(e?.message || t('common.networkError')))
      .finally(() => !cancelled && setDetailLoading(false))
    return () => {
      cancelled = true
    }
  }, [selectedId, t])

  if (selectedId) {
    return (
      <View className="flex-1 bg-white">
        <View className="flex-row items-center border-b border-gray-100 px-4 py-3">
          <TouchableOpacity onPress={() => setSelectedId(null)} className="mr-3" hitSlop={8}>
            <Text className="text-base text-gray-700">{t('common.back')}</Text>
          </TouchableOpacity>
          <Text className="flex-1 text-lg font-semibold text-gray-900" numberOfLines={1}>
            {detail?.name || ''}
          </Text>
        </View>
        {detailLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator />
          </View>
        ) : detail ? (
          <View className="flex-1 px-4 py-4">
            <View className="flex-row items-center">
              {detail.avatar ? (
                <Image
                  source={{ uri: detail.avatar }}
                  className="h-14 w-14 rounded-lg bg-gray-100"
                  resizeMode="cover"
                />
              ) : (
                <View className="h-14 w-14 items-center justify-center rounded-lg bg-gray-100">
                  <Text className="text-xl font-semibold text-gray-700">
                    {getInitial(detail.name)}
                  </Text>
                </View>
              )}
              <View className="ml-3 flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className="flex-1 text-lg font-semibold text-gray-900" numberOfLines={1}>
                    {detail.name}
                  </Text>
                  {detail.isVipExclusive ? <VipBadge /> : null}
                </View>
                <Text className="mt-1 text-xs text-gray-500">
                  {`使用 ${detail.useCount} · 评分 ${detail.rating.toFixed(1)}`}
                </Text>
              </View>
            </View>
            <Text className="mt-4 text-sm text-gray-700">{detail.description}</Text>
            <View className="mt-4 rounded-lg bg-gray-50 px-3 py-2">
              <Text className="text-sm text-gray-700">
                {`权限: ${permissionLabel(permission)}`}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    )
  }

  return (
    <View className="flex-1 bg-white">
      <View className="border-b border-gray-100 px-4 py-3">
        <Text className="text-lg font-semibold text-gray-900">{t('nav.agents')}</Text>
      </View>
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-sm text-red-600">{error}</Text>
        </View>
      ) : (
        <FlatList
          data={agents}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          ItemSeparatorComponent={() => <View className="h-3" />}
          ListEmptyComponent={
            <View className="items-center py-12">
              <Text className="text-sm text-gray-500">{t('common.empty')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setSelectedId(item.id)}
              className="flex-row items-center rounded-lg border border-gray-100 bg-white px-3 py-3"
            >
              {item.avatar ? (
                <Image
                  source={{ uri: item.avatar }}
                  className="h-12 w-12 rounded-lg bg-gray-100"
                  resizeMode="cover"
                />
              ) : (
                <View className="h-12 w-12 items-center justify-center rounded-lg bg-gray-100">
                  <Text className="text-lg font-semibold text-gray-700">
                    {getInitial(item.name)}
                  </Text>
                </View>
              )}
              <View className="ml-3 flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className="flex-1 text-base font-semibold text-gray-900" numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.isVipExclusive ? <VipBadge /> : null}
                </View>
                <Text className="mt-1 text-xs text-gray-500" numberOfLines={2}>
                  {item.description}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  )
}
