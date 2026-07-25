import { useEffect, useState } from 'react'
import { FlatList, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { Avatar, Badge, Card, Loading } from '@ihui/ui-native'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

interface Member {
  id: string
  nickname: string
  avatar?: string
  role: 'owner' | 'admin' | 'member'
  joinedAt: string
}

const CIRCLE_ROLE_KEYS: Record<Member['role'], string> = {
  owner: 'circleMember.owner',
  admin: 'circleMember.admin',
  member: 'circleMember.member',
}

type Route = RouteProp<RootStackParamList, 'CircleMember'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function CircleMemberScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { circleId } = route.params
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await fetchApi<Member[]>(`/api/circles/${encodeURIComponent(circleId)}/members`)
      if (cancelled) return
      if (res.success) setMembers(res.data ?? [])
      else setError(res.error || t('circleMember.loadFailed'))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [circleId, t])

  if (loading)
    return (
      <View className="flex-1 items-center justify-center bg-card p-4">
        <Loading />
        <Text className="mt-2 text-[13px] text-muted-foreground">{t('common.loading')}</Text>
      </View>
    )
  if (error)
    return (
      <View className="flex-1 items-center justify-center bg-card p-4">
        <Text className="mb-2 text-center text-[13px] text-destructive">{error}</Text>
        <TouchableOpacity
          className="mt-3 rounded-md bg-primary px-4 py-2"
          onPress={() => navigation.goBack()}
        >
          <Text className="text-sm text-primary-foreground">{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  return (
    <View className="flex-1 bg-card px-4 pt-12">
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text className="text-sm text-muted-foreground">{t('common.back')}</Text>
      </TouchableOpacity>
      <Text className="mb-3 mt-2 text-[22px] font-semibold text-foreground">
        {t('circleMember.title')}
      </Text>
      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View className="items-center py-10">
            <Text className="text-[13px] text-muted-foreground">{t('circleMember.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card className="mb-2 flex-row items-center p-3">
            <Avatar name={item.nickname} size="sm" shape="rounded" className="mr-3 bg-primary" />
            <View className="flex-1">
              <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
                {item.nickname}
              </Text>
              <Text className="mt-0.5 text-[11px] text-muted-foreground">{item.joinedAt}</Text>
            </View>
            <Badge
              variant={item.role === 'owner' ? 'default' : 'secondary'}
              label={t(CIRCLE_ROLE_KEYS[item.role])}
            />
          </Card>
        )}
      />
    </View>
  )
}
