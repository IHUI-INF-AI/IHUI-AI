/**
 * TeamDetailScreen 团队成员详情(mobile-rn 端 wrapper)
 *
 * 保留 RN 特定逻辑(导航/路由/拨号),UI 委托给 @ihui/rn-app 共享组件。
 * 2026-08-21:真实 API 接入(getTeamMemberDetail,后端 /api/distribution/team/members/:id),
 * 替代原 buildMockMember mock 数据(对齐 Uniapp distribution_personnel_list/detail.vue)。
 */
import { useCallback, useEffect, useState } from 'react'
import { Alert, Linking, StyleSheet, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getTeamMemberDetail, type TeamMemberDetail } from '@ihui/api-client'
import { TeamDetailScreen, type TeamDetailScreenProps } from '@ihui/rn-app'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { useI18n } from '../i18n'

type LocalParamList = RootStackParamList & {
  TeamDetail: { memberId: string }
  DistributionOrderList: undefined
}
type TeamDetailRouteProp = RouteProp<LocalParamList, 'TeamDetail'>
type NavigationProp = NativeStackNavigationProp<LocalParamList>

export default function TeamDetailScreenWrapper() {
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<TeamDetailRouteProp>()
  const { memberId } = route.params
  const { t } = useI18n()
  const [member, setMember] = useState<TeamMemberDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getTeamMemberDetail(memberId)
      if (!res.success || !res.data) {
        setError('加载失败,请重试')
        setMember(null)
        return
      }
      setMember(res.data)
    } catch {
      setError('加载失败,请重试')
      setMember(null)
    } finally {
      setLoading(false)
    }
  }, [memberId])

  useEffect(() => {
    void load()
  }, [load])

  const onContact = (): void => {
    if (!member?.phone) {
      Alert.alert('提示', '该成员未提供手机号')
      return
    }
    const phone = String(member.phone).replace(/[^\d+]/g, '')
    void Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('提示', '无法拨号,请检查设备')
    })
  }
  const onViewOrders = (): void => {
    navigation.navigate('DistributionOrderList')
  }

  const props: TeamDetailScreenProps = {
    t,
    onBack: () => navigation.goBack(),
    loading,
    error,
    onRetry: () => void load(),
    member: member
      ? {
          id: member.id,
          nickname: member.nickname,
          phone: member.phone ?? '',
          avatar: member.avatar,
          joinedAt: member.joinedAt,
          transactionVolume: member.transactionVolume,
          commission: member.commission,
          orderNum: member.orderNum,
        }
      : null,
    onContact,
    onViewOrders,
    colorScheme: 'light',
  }

  return (
    <View style={styles.container}>
      <TeamDetailScreen {...props} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
})
