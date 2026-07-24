import { useEffect, useState } from 'react'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { Badge, Loading } from '@ihui/ui-native'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

interface Circle { id: string; name: string; description: string; memberCount: number; postCount: number; isJoined: boolean; cover?: string }

type Route = RouteProp<RootStackParamList, 'CircleDetail'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function CircleDetailScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { id } = route.params
  const [circle, setCircle] = useState<Circle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true); setError('')
      const res = await fetchApi<Circle>(`/api/circles/${encodeURIComponent(id)}`)
      if (cancelled) return
      if (res.success) setCircle(res.data)
      else setError(res.error || t('circleDetail.loadFailed'))
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [id, t])

  const onJoin = async () => {
    if (!circle) return
    setJoining(true)
    const res = await fetchApi<void>(`/api/circles/${encodeURIComponent(id)}/join`, { method: 'POST' })
    setJoining(false)
    if (res.success) setCircle({ ...circle, isJoined: true, memberCount: circle.memberCount + 1 })
    else setError(res.error || t('common.failed'))
  }

  if (loading) return (
    <View className="flex-1 items-center justify-center bg-card p-4">
      <Loading />
      <Text className="mt-2 text-[13px] text-muted-foreground">{t('common.loading')}</Text>
    </View>
  )
  if (error || !circle) return (
    <View className="flex-1 items-center justify-center bg-card p-4">
      <Text className="mb-2 text-center text-[13px] text-destructive">{error || t('circleDetail.loadFailed')}</Text>
      <TouchableOpacity className="mt-3 rounded-md bg-primary px-4 py-2" onPress={() => navigation.goBack()}>
        <Text className="text-sm text-primary-foreground">{t('common.back')}</Text>
      </TouchableOpacity>
    </View>
  )
  return (
    <ScrollView className="flex-1 bg-card px-4 pb-8 pt-12">
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text className="text-sm text-muted-foreground">{t('common.back')}</Text>
      </TouchableOpacity>
      <Text className="mt-2 text-[22px] font-semibold text-foreground">{circle.name}</Text>
      <View className="mt-1.5 mb-3 flex-row gap-3">
        <Badge variant="secondary" label={t('circleDetail.members', { count: circle.memberCount })} />
        <Badge variant="secondary" label={t('circleDetail.posts', { count: circle.postCount })} />
      </View>
      <Text className="text-sm leading-[22px] text-foreground/80">{circle.description || '—'}</Text>
      <View className="mt-5 flex-row gap-2">
        {circle.isJoined ? (
          <>
            <TouchableOpacity
              className="flex-1 items-center rounded-md border border-primary py-3"
              onPress={() => navigation.navigate('CircleChat', { circleId: circle.id, name: circle.name })}
            >
              <Text className="text-sm font-semibold text-primary">{t('circleDetail.chat')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 items-center rounded-md bg-primary py-3"
              onPress={() => navigation.navigate('PostCreate', { circleId: circle.id })}
            >
              <Text className="text-sm font-semibold text-primary-foreground">{t('circleDetail.post')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            className="flex-1 items-center rounded-md bg-primary py-3"
            onPress={onJoin}
            disabled={joining}
          >
            <Text className="text-sm font-semibold text-primary-foreground">
              {joining ? t('common.loading') : t('circleDetail.join')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  )
}
