// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getTraderDetail, getOverview, getInviteInfo } from '@ihui/api-client'
import type { CommissionOverview, InviteInfo } from '@ihui/api-client'
import { apiFailureToText } from '@ihui/shared/utils'
import { VipTraderScreen as SharedVipTraderScreen, type VipTraderStat } from '@ihui/rn-app'
import { ConfirmPurchasePopUp } from '../components/ConfirmPurchasePopUp'
import { useWechatPayment } from '../hooks/useWechatPayment'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { Medal } from 'lucide-react-native'
import { useRefreshOnFocus } from '../hooks'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** VIP 操盘手价格(分),对齐 SharedVipTraderScreen TRADER_PRICE ¥9980 */
const TRADER_PRICE_CENTS = 998000
const TRADER_PRODUCT_NAME_KEY = 'viptrader.productName'

function formatYuan(n: number): string {
  return `¥${n.toLocaleString()}`
}

function buildStats(
  o: CommissionOverview,
  invite: InviteInfo | undefined,
  t: (k: string, v?: Record<string, string | number>) => string,
): VipTraderStat[] {
  const base: VipTraderStat[] = [
    {
      label: t('viptrader.teamCount'),
      value: String(o.invitedCount),
      trend: t('viptrader.activeTrend', { n: o.activeCount }),
    },
    {
      label: t('viptrader.totalCommission'),
      value: formatYuan(o.totalCommission),
      trend: t('viptrader.rankTrend', { n: o.rank }),
    },
    {
      label: t('viptrader.monthIncome'),
      value: formatYuan(o.availableCommission),
      trend: t('viptrader.withdrawnTrend', { v: formatYuan(o.withdrawnCommission) }),
    },
    {
      label: t('viptrader.pendingIncome'),
      value: formatYuan(o.pendingCommission),
      trend: t('viptrader.frozenTrend', { v: formatYuan(o.frozenCommission) }),
    },
  ]
  // 邀请码 / 佣金比例 / 分销等级(对齐 Uniapp trader 页邀请信息展示)
  if (invite) {
    base.push(
      {
        label: t('viptrader.myInviteCode'),
        value: invite.inviteCode || '—',
        trend: t('viptrader.invitedTrend', { n: invite.inviteCount }),
      },
      {
        label: t('viptrader.distLevel'),
        value: invite.level || '—',
        trend: t('viptrader.rateTrend', { n: invite.commissionRate }),
      },
    )
  }
  return base
}

export default function VipTraderScreen() {
  const { resolvedTheme } = useTheme()
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
        setStats(buildStats(overviewRes.value.data, inviteInfo, t))
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
                  orderCount: null,
                },
                inviteInfo,
                t,
              )
            : [],
        )
        if (overviewRes.status === 'fulfilled' && !overviewRes.value.success) {
          setError(apiFailureToText(overviewRes.value, t('vipTrader.loadFailed')))
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

  // 回屏即重取(对齐小程序 useDidShow 的每次显示刷新;首次挂载由上面的 useEffect 负责)
  useRefreshOnFocus(load)

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
    void pay(TRADER_PRICE_CENTS, t(TRADER_PRODUCT_NAME_KEY))
  }, [pay, t])

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
        colorScheme={resolvedTheme}
      />
      <ConfirmPurchasePopUp
        visible={confirmVisible}
        title={t('vipTrader.title')}
        message={t('vipTrader.heroDesc', { price: '9,980', power: '1600W' })}
        product={{ name: t(TRADER_PRODUCT_NAME_KEY), price: 9980, icon: Medal }}
        onCancel={() => setConfirmVisible(false)}
        onConfirm={onConfirmPurchase}
        loading={paying}
        confirmText={t('vipTrader.openNow')}
      />
    </>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
