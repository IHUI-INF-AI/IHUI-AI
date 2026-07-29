import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getTraderDetail, getOverview, getInviteInfo } from '@ihui/api-client'
import type { CommissionOverview } from '@ihui/api-client'
import {
  VipTraderScreen as SharedVipTraderScreen,
  type VipTraderStat,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

function formatYuan(n: number): string {
  return `¥${n.toLocaleString()}`
}

function buildStats(o: CommissionOverview): VipTraderStat[] {
  return [
    { label: '团队人数', value: String(o.invitedCount), trend: `活跃 ${o.activeCount}` },
    { label: '累计佣金', value: formatYuan(o.totalCommission), trend: `排名 #${o.rank}` },
    {
      label: '本月收益',
      value: formatYuan(o.availableCommission),
      trend: `已提现 ${formatYuan(o.withdrawnCommission)}`,
    },
    {
      label: '待结算',
      value: formatYuan(o.pendingCommission),
      trend: `冻结 ${formatYuan(o.frozenCommission)}`,
    },
  ]
}

export default function VipTraderScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [opened, setOpened] = useState(false)
  const [stats, setStats] = useState<VipTraderStat[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const [traderRes, overviewRes, inviteRes] = await Promise.allSettled([
        getTraderDetail('me'),
        getOverview(),
        getInviteInfo(),
      ])
      // 团队统计数据从 distribution overview 提取
      if (overviewRes.status === 'fulfilled' && overviewRes.value.success) {
        setStats(buildStats(overviewRes.value.data))
      } else {
        setStats([])
        if (overviewRes.status === 'fulfilled' && !overviewRes.value.success) {
          setError(overviewRes.value.error || t('vipTrader.loadFailed'))
        }
      }
      // trader / invite 信息已并行获取,供后续业务扩展使用
      void traderRes
      void inviteRes
    } catch {
      setError(t('vipTrader.loadFailed'))
      setStats([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    void load()
  }, [load])

  return (
    <SharedVipTraderScreen
      t={t}
      stats={stats}
      opened={opened}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={onRefresh}
      onOpen={() => setOpened(true)}
      onBack={() => navigation.goBack()}
    />
  )
}
