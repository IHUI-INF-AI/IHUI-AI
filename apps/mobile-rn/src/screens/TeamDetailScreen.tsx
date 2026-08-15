/**
 * TeamDetailScreen 团队成员详情(mobile-rn 端 wrapper)
 *
 * 保留 RN 特定逻辑(导航/路由/mock 数据/拨号),UI 委托给 @ihui/rn-app 共享组件。
 */
import { useState } from 'react'
import { Alert, Linking } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { TeamDetailScreen } from '@ihui/rn-app'
import type { RootStackParamList } from '../navigation/RootNavigator'
import type { TeamDetailScreenProps } from '@ihui/rn-app'

/** 团队成员详情(对齐 Uniapp detail.vue member 字段) */
interface TeamMemberDetail {
  id: string
  nickname: string
  phone: string
  avatar: string | null
  joinedAt: string
  transactionVolume: number
  commission: number
  orderNum: number
}

type LocalParamList = RootStackParamList & {
  TeamDetail: { memberId: string }
  DistributionOrderList: undefined
}
type TeamDetailRouteProp = RouteProp<LocalParamList, 'TeamDetail'>
type NavigationProp = NativeStackNavigationProp<LocalParamList>

/** mock 数据(后端 /team/member/:id 待接入,memberId 路由参数已预留) */
function buildMockMember(memberId: string): TeamMemberDetail {
  return {
    id: memberId,
    nickname: '团友' + memberId.slice(-4),
    phone: '138****8888',
    avatar: null,
    joinedAt: '2025-05-16',
    transactionVolume: 128000,
    commission: 2560,
    orderNum: 12,
  }
}

export default function TeamDetailScreenWrapper() {
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<TeamDetailRouteProp>()
  const { memberId } = route.params
  const [member] = useState<TeamMemberDetail>(() => buildMockMember(memberId))

  const onContact = (): void => {
    if (!member.phone) {
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
    t: (key: string) => key,
    onBack: () => navigation.goBack(),
    member: {
      id: member.id,
      nickname: member.nickname,
      phone: member.phone,
      avatar: member.avatar,
      joinedAt: member.joinedAt,
      transactionVolume: member.transactionVolume,
      commission: member.commission,
      orderNum: member.orderNum,
    },
    onContact,
    onViewOrders,
    colorScheme: 'light',
  }

  return <TeamDetailScreen {...props} />
}
