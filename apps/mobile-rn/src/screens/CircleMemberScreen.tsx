// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

import { useCallback, useEffect, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { apiFailureToText } from '@ihui/shared/utils'
import { CircleMemberScreen as SharedCircleMemberScreen, type CircleMemberItem } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

interface ApiMember {
  id: string
  nickname: string
  avatar?: string
  role: 'owner' | 'admin' | 'member'
  joinedAt: string
}

type Route = RouteProp<RootStackParamList, 'CircleMember'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function CircleMemberScreen() {
  const { resolvedTheme } = useTheme()
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { circleId } = route.params
  const [items, setItems] = useState<CircleMemberItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetchApi<ApiMember[]>(
        `/api/circles/${encodeURIComponent(circleId)}/members`,
      )
      if (res.success) {
        setItems(
          (res.data ?? []).map((m) => ({
            id: m.id,
            name: m.nickname,
            avatar: m.avatar,
            role: m.role,
            joinedAt: m.joinedAt,
          })),
        )
      } else {
        setError(apiFailureToText(res, t('circleMember.loadFailed')))
      }
    } catch {
      setError(t('circleMember.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [circleId, t])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <SharedCircleMemberScreen
      t={t}
      items={items}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={() => {
        setRefreshing(true)
        void load()
      }}
      onPressItem={() => {}}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
