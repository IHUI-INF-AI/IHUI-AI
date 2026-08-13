/**
 * TeamDetailScreen 团队成员详情(mobile-rn 端)
 *
 * 1:1 复刻历史 Uniapp distribution_personnel_list/detail.vue 的成员信息 + 贡献统计结构:
 * - NavBar「团队成员详情」+ 返回
 * - 成员信息卡片:头像(initials)/昵称/手机号/加入时间
 * - 贡献统计:成交额/获取佣金/成交订单数(对齐 Uniapp transactionVolume/commission/orderNum)
 * - 操作按钮:联系(拨号占位)/查看订单(跳转 DistributionOrderList)
 * - API:仓库暂无 getTeamMemberDetail,使用 mock 数据(memberId 路由参数已预留),后续对接 /team/member/:id
 *
 * 平台独占:仅 mobile-rn 端。
 */
import { useMemo, useState } from 'react'
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { NavBar } from '../components/NavBar'
import type { RootStackParamList } from '../navigation/RootNavigator'

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

function initialsOf(name: string): string {
  return name ? name.slice(0, 1).toUpperCase() : '?'
}

function formatYuan(cents: number): string {
  return (cents / 100).toFixed(2)
}

export default function TeamDetailScreen() {
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<TeamDetailRouteProp>()
  const { memberId } = route.params
  const [member] = useState<TeamMemberDetail>(() => buildMockMember(memberId))

  const stats = useMemo(
    () => [
      { label: '成交额', value: '¥' + formatYuan(member.transactionVolume) },
      { label: '获取佣金', value: '¥' + formatYuan(member.commission) },
      { label: '成交订单数', value: String(member.orderNum) },
    ],
    [member],
  )

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

  return (
    <View style={styles.root}>
      <NavBar title="团队成员详情" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.memberCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initialsOf(member.nickname)}</Text>
          </View>
          <View style={styles.memberMeta}>
            <Text style={styles.nickname}>{member.nickname}</Text>
            <Text style={styles.metaText}>手机号:{member.phone}</Text>
            <Text style={styles.metaText}>加入时间:{member.joinedAt}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          {stats.map((s) => (
            <View key={s.label} style={styles.statItem}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, styles.actionBtnPrimary, pressed ? styles.pressed : null]}
            onPress={onContact}
            accessibilityRole="button"
            accessibilityLabel="联系成员"
          >
            <Text style={styles.actionBtnPrimaryText}>联系</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, pressed ? styles.pressed : null]}
            onPress={onViewOrders}
            accessibilityRole="button"
            accessibilityLabel="查看订单"
          >
            <Text style={styles.actionBtnText}>查看订单</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.surface.bg },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 16 },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.surface.card,
    borderRadius: 12,
    padding: 16,
    gap: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: tokens.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: '600', color: tokens.surface.light },
  memberMeta: { flex: 1, gap: 4 },
  nickname: { fontSize: 16, fontWeight: '600', color: tokens.text.primary },
  metaText: { fontSize: 13, color: tokens.text.secondary },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: tokens.surface.card,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 16, fontWeight: '600', color: tokens.brand.DEFAULT },
  statLabel: { fontSize: 12, color: tokens.text.secondary },
  actionRow: { flexDirection: 'row', gap: 12 },
  actionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.surface.card,
  },
  actionBtnPrimary: { backgroundColor: tokens.brand.DEFAULT },
  actionBtnText: { fontSize: 14, fontWeight: '500', color: tokens.text.primary },
  actionBtnPrimaryText: { fontSize: 14, fontWeight: '600', color: tokens.surface.light },
  pressed: { opacity: 0.85 },
})
