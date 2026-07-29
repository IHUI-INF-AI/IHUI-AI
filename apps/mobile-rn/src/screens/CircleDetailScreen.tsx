import { useCallback, useEffect, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { CircleDetailScreen as SharedCircleDetailScreen, type CircleDetailItem } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

interface ApiCircle {
  id: string
  name: string
  description: string
  memberCount: number
  postCount: number
  isJoined: boolean
  createdAt?: string
}

type Route = RouteProp<RootStackParamList, 'CircleDetail'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function CircleDetailScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { id } = route.params
  const [circle, setCircle] = useState<CircleDetailItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [joining, setJoining] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetchApi<ApiCircle>(`/api/circles/${encodeURIComponent(id)}`)
      if (res.success && res.data) {
        setCircle({ ...res.data, createdAt: res.data.createdAt ?? '' })
      } else {
        setError(res.error || t('circleDetail.loadFailed'))
      }
    } catch {
      setError(t('circleDetail.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [id, t])

  useEffect(() => {
    void load()
  }, [load])

  const onJoin = async () => {
    if (!circle || joining) return
    setJoining(true)
    const res = await fetchApi<void>(`/api/circles/${encodeURIComponent(id)}/join`, {
      method: 'POST',
    })
    setJoining(false)
    if (res.success) {
      setCircle({ ...circle, isJoined: true, memberCount: circle.memberCount + 1 })
    } else {
      setError(res.error || t('common.failed'))
    }
  }

  const onLeave = async () => {
    if (!circle || joining) return
    setJoining(true)
    const res = await fetchApi<void>(`/api/circles/${encodeURIComponent(id)}/leave`, {
      method: 'POST',
    })
    setJoining(false)
    if (res.success) {
      setCircle({ ...circle, isJoined: false, memberCount: Math.max(0, circle.memberCount - 1) })
    } else {
      setError(res.error || t('common.failed'))
    }
  }

  return (
    <SharedCircleDetailScreen
      t={t}
      item={circle}
      loading={loading}
      error={error}
      onJoin={onJoin}
      onLeave={onLeave}
      onPressPost={() => navigation.navigate('PostCreate', { circleId: circle?.id ?? id })}
      onPressMembers={() => navigation.navigate('CircleMember', { circleId: circle?.id ?? id })}
      onBack={() => navigation.goBack()}
    />
  )
}
