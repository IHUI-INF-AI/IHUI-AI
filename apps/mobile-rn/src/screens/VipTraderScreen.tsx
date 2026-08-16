import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getTraderDetail, getOverview, getInviteInfo } from '@ihui/api-client'
import type { CommissionOverview, InviteInfo } from '@ihui/api-client'
import { VipTraderScreen as SharedVipTraderScreen, type VipTraderStat } from '@ihui/rn-app'
import { ConfirmPurchasePopUp } from '../components/ConfirmPurchasePopUp'
import { useWechatPayment } from '../hooks/useWechatPayment'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** VIP 操盘手价格(分),对齐 SharedVipTraderScreen TRADER_PRICE ¥9980 */
const TRADER_PRICE_CENTS = 998000
const TRADER_PRODUCT_NAME = 'VIP 操盘手'

function formatYuan(n: number): string {
  return `¥${n.toLocaleString()}`
}

function buildStats(o: CommissionOverview, invite?: InviteInfo): VipTraderStat[] {
  const base: VipTraderStat[] = [
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
  // 邀请码 / 佣金比例 / 分销等级(对齐 Uniapp trader 页邀请信息展示)
  if (invite) {
    base.push(
      {
        label: '我的邀请码',
        value: invite.inviteCode || '—',
        trend: `已邀请 ${invite.inviteCount} 人`,
      },
      {
        label: '分销等级',
        value: invite.level || '—',
        trend: `佣金比例 ${invite.commissionRate}%`,
      },
    )
  }
  return base
}

export default function VipTraderScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [opened, setOpened] = useState(false)
  const [stats, setStats] = useState<VipTraderStat[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [confirmVisible, setConfirmVisible] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const [traderRes, overviewRes, inviteRes] = await Promise.allSettled([
        getTraderDetail('me'),
        getOverview(),
        getInviteInfo(),
      ])
      // 团队统计数据从 distribution overview 提取,邀请信息丰富统计项
      let inviteInfo: InviteInfo | undefined
      if (inviteRes.status === 'fulfilled' && inviteRes.value.success) {
        inviteInfo = inviteRes.value.data
      }
      if (overviewRes.status === 'fulfilled' && overviewRes.value.success) {
        setStats(buildStats(overviewRes.value.data, inviteInfo))
      } else {
        setStats(
          inviteInfo
            ? buildStats(
                {
                  totalCommission: 0,
                  availableCommission: 0,
                  frozenCommission: 0,
                  withdrawnCommission: 0,
                  pendingCommission: 0,
                  invitedCount: inviteInfo.inviteCount,
                  activeCount: 0,
                  rank: 0,
                },
                inviteInfo,
              )
            : [],
        )
        if (overviewRes.status === 'fulfilled' && !overviewRes.value.success) {
          setError(overviewRes.value.error || t('vipTrader.loadFailed'))
        }
      }
      // trader 详情(followers/level)已获取,统计已由 overview+invite 覆盖
      void traderRes
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

  // 微信 APP 支付(orderType=1 VIP 订单),对齐 VipScreen pay 流程
  const { paying, pay } = useWechatPayment({
    orderType: 1,
    onSuccess: async () => {
      setOpened(true)
      await load()
    },
  })

  // 立即开通 → 弹出确认购买弹窗(对齐 Uniapp trader.vue openPopup + ConfirmPurchasePopUp)
  const onOpen = useCallback(() => {
    setConfirmVisible(true)
  }, [])

  const onConfirmPurchase = useCallback(() => {
    setConfirmVisible(false)
    void pay(TRADER_PRICE_CENTS, TRADER_PRODUCT_NAME)
  }, [pay])

  return (
    <>
      <SharedVipTraderScreen
        t={t}
        stats={stats}
        opened={opened}
        loading={loading}
        refreshing={refreshing}
        error={error}
        onRefresh={onRefresh}
        onOpen={onOpen}
        onBack={() => navigation.goBack()}
      />
      <ConfirmPurchasePopUp
        visible={confirmVisible}
        title={t('vipTrader.title')}
        message={t('vipTrader.heroDesc', { price: '9,980', power: '1600W' })}
        product={{ name: TRADER_PRODUCT_NAME, price: 9980, icon: '🏅' }}
        onCancel={() => setConfirmVisible(false)}
        onConfirm={onConfirmPurchase}
        loading={paying}
        confirmText={t('vipTrader.openNow')}
      />
    </>
  )
}
