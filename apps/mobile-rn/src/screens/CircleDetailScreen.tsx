// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

import { useCallback, useEffect, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { apiFailureToText } from '@ihui/shared/utils'
import { CircleDetailScreen as SharedCircleDetailScreen, type CircleDetailItem } from '@ihui/rn-app'
import { tokens } from '../theme/active-tokens'
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
  const { resolvedTheme } = useTheme()
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
        setError(apiFailureToText(res, t('circleDetail.loadFailed')))
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
      setError(apiFailureToText(res, t('common.failed')))
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
      setError(apiFailureToText(res, t('common.failed')))
    }
  }

  return (
    <View style={styles.container}>
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
        colorScheme={resolvedTheme}
      />
      {/* 群聊入口(孤儿路由修复:CircleChat 注册无入口,圈子详情补挂)
          守门 131 改型:chatBtn 无边距、内容自定高 ⇒ 外层不设 style(通栏宽/命中盒不变),
          行盒 + pressed 淡出落内层数组形态。 */}
      <Pressable
        onPress={() =>
          navigation.navigate('CircleChat', {
            circleId: circle?.id ?? id,
            name: circle?.name ?? '',
          })
        }
        accessibilityRole="button"
        accessibilityLabel="进入群聊"
      >
        {({ pressed }) => (
          <View style={[styles.chatBtn, pressed ? styles.chatBtnPressed : null]}>
            <Text style={styles.chatBtnText}>进入群聊 ›</Text>
          </View>
        )}
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  chatBtn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatBtnPressed: {
    opacity: 0.7,
  },
  chatBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.brandAccent.deep,
  },
})
