import { useCallback, useEffect, useState } from 'react'
import { Alert, ScrollView, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import {
  DistributionScreen as SharedDistributionScreen,
  type DistributionInfo,
} from '@ihui/rn-app'
import EarningsStatisticsCard from '../components/EarningsStatisticsCard'
import PersonalInformationCard from '../components/PersonalInformationCard'
import { FunctionBlockColumn, type FunctionBlock } from '../components/FunctionBlockColumn'
import CommissionFloatingIcon from '../components/CommissionFloatingIcon'
import { HandPlatePops } from '../components/HandPlatePops'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function DistributionScreen() {
  const { t } = useI18n()
  const { user } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [info, setInfo] = useState<DistributionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [withdrawing, setWithdrawing] = useState(false)
  // HandPlatePops 提现详情弹层(对齐 Uniapp hand-plate-pups/index.vue)
  const [withdrawDetailVisible, setWithdrawDetailVisible] = useState(false)

  /** FunctionBlockColumn 分销工具入口(对齐 Uniapp 分销功能块) */
  const functionBlocks: FunctionBlock[] = [
    { id: 'withdraw', title: '提现', icon: '💰', description: '佣金提现到银行卡' },
    { id: 'bankcard', title: '银行卡', icon: '🏦', description: '管理绑定银行卡' },
    { id: 'realname', title: '实名认证', icon: '🪪', description: '完成实名认证' },
    { id: 'income', title: '收入明细', icon: '📊', description: '查看收入记录' },
  ]

  const onBlockPress = useCallback((id: string) => {
    const routeMap: Record<string, string> = {
      withdraw: 'Withdraw',
      bankcard: 'BankCard',
      realname: 'RealNameAuth',
      income: 'Income',
    }
    const route = routeMap[id]
    if (route) navigation.navigate(route as never)
  }, [navigation])

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      setError('')
      const res = await fetchApi<DistributionInfo>('/distribution/overview')
      if (!res.success) {
        setError(t('distribution.loadFailed'))
        setLoading(false)
        setRefreshing(false)
        return
      }
      setInfo(res.data ?? null)
      setLoading(false)
      setRefreshing(false)
    },
    [t],
  )

  useEffect(() => {
    void load()
  }, [load])

  const handleWithdraw = async () => {
    if (!info) return
    if (info.pending < info.withdrawMin) {
      Alert.alert(
        t('distribution.withdrawFailed'),
        t('distribution.withdrawMin', { amount: info.withdrawMin }),
      )
      return
    }
    setWithdrawing(true)
    const res = await fetchApi('/distribution/withdraw', {
      method: 'POST',
      body: JSON.stringify({ amount: info.pending }),
    })
    setWithdrawing(false)
    if (res.success) {
      Alert.alert(t('distribution.withdrawSuccess'))
      void load(true)
    } else {
      Alert.alert(t('distribution.withdrawFailed'))
    }
  }

  return (
    <View style={shellStyles.root}>
      <ScrollView style={shellStyles.scroll} contentContainerStyle={shellStyles.scrollContent}>
        {/* PersonalInformationCard 个人信息卡片(对齐 Uniapp 分销页个人信息) */}
        <View style={shellStyles.personalInfoWrap}>
          <PersonalInformationCard
            avatar={user?.avatar}
            nickname={user?.nickname || user?.username}
            inviteCode={user?.inviteCode}
            level={info ? '分销商' : undefined}
          />
        </View>
        <View style={shellStyles.statsWrap}>
          <EarningsStatisticsCard
            label="分销收益概览"
            title={info?.totalEarnings ?? 0}
            todayAmount={info?.pending ?? 0}
            monthAmount={info?.withdrawn ?? 0}
            totalAmount={info?.totalEarnings ?? 0}
            trend={info ? { direction: 'up', percent: 12.5 } : undefined}
          />
        </View>
        {/* FunctionBlockColumn 分销工具入口(对齐 Uniapp FunctionBlockColumn/index.vue) */}
        <View style={shellStyles.functionBlocksWrap}>
          <FunctionBlockColumn blocks={functionBlocks} onBlockPress={onBlockPress} />
        </View>
        <SharedDistributionScreen
          t={t}
          info={info}
          loading={loading}
          refreshing={refreshing}
          error={error}
          withdrawing={withdrawing}
          onRefresh={() => void load(true)}
          onWithdraw={handleWithdraw}
          onBack={() => navigation.goBack()}
        />
      </ScrollView>
      {/* CommissionFloatingIcon 佣金悬浮按钮(对齐 Uniapp 分销佣金悬浮按钮) */}
      <CommissionFloatingIcon
        amount={info?.pending}
        onPress={() => setWithdrawDetailVisible(true)}
      />
      {/* HandPlatePops 提现详情弹层(对齐 Uniapp hand-plate-pups/index.vue) */}
      <HandPlatePops
        visible={withdrawDetailVisible}
        title="提现详情"
        onClose={() => setWithdrawDetailVisible(false)}
      >
        <View style={shellStyles.withdrawDetailContent}>
          <Text style={shellStyles.withdrawDetailText}>
            可提现金额:¥{info?.pending ?? 0}
          </Text>
          <Text style={shellStyles.withdrawDetailText}>
            已提现金额:¥{info?.withdrawn ?? 0}
          </Text>
          <Text style={shellStyles.withdrawDetailText}>
            最低提现:¥{info?.withdrawMin ?? 0}
          </Text>
        </View>
      </HandPlatePops>
    </View>
  )
}

const shellStyles = {
  root: { flex: 1 } as const,
  scroll: { flex: 1 } as const,
  scrollContent: { paddingBottom: 16 } as const,
  personalInfoWrap: { paddingHorizontal: 16, paddingTop: 12 } as const,
  statsWrap: { paddingTop: 12, paddingBottom: 4 } as const,
  functionBlocksWrap: { paddingHorizontal: 16, paddingVertical: 8 } as const,
  withdrawDetailContent: { gap: 10, paddingVertical: 8 } as const,
  withdrawDetailText: { fontSize: 14, color: '#333' } as const,
}
