import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  createOrder,
  getMembershipInfo,
  getVipLevels,
  type MembershipInfo,
  type VipLevel,
} from '@ihui/api-client'
import {
  VipScreen as SharedVipScreen,
  type VipLevelItem2,
  type VipMembershipInfo,
} from '@ihui/rn-app'
import { formatDateOnly } from '@ihui/shared/utils/date-utils'
import { PurchaseNoticePopUp } from '../components/PurchaseNoticePopUp'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

function toVipLevel(l: VipLevel): VipLevelItem2 {
  return {
    id: l.id,
    levelName: l.levelName,
    levelValue: l.levelValue,
    price: l.price,
    durationDays: l.durationDays,
    status: l.status,
    benefits: l.benefits ?? undefined,
  }
}

function toVipMembership(m: MembershipInfo): VipMembershipInfo {
  return {
    isActive: m.isActive,
    level: m.level,
    levelName: m.levelName,
    expireTime: formatDateOnly(m.expireTime ?? ''),
    daysRemaining: m.daysRemaining,
  }
}

export function VipScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [levels, setLevels] = useState<VipLevelItem2[]>([])
  const [membership, setMembership] = useState<VipMembershipInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [purchasingId, setPurchasingId] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  // VIP 权益介绍弹窗(首次进入自动展示,关闭后本次会话不再弹出)
  const [introVisible, setIntroVisible] = useState(false)
  const [introShown, setIntroShown] = useState(false)

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      setError('')
      const [levelsRes, membershipRes] = await Promise.all([getVipLevels(), getMembershipInfo()])
      if (levelsRes.success) setLevels(levelsRes.data.map(toVipLevel))
      else setError(levelsRes.error || t('vip.loadFailed'))
      if (membershipRes.success && membershipRes.data)
        setMembership(toVipMembership(membershipRes.data))
      setLoading(false)
      setRefreshing(false)
    },
    [t],
  )

  useEffect(() => {
    void load()
  }, [load])

  const onPurchase = async (level: VipLevelItem2) => {
    setPurchasingId(level.id)
    setToast('')
    const res = await createOrder({ type: 'vip', targetId: level.id })
    setPurchasingId(null)
    if (res.success) {
      setToast(t('vip.orderCreated', { orderNo: res.data.orderNo }))
      // 订单创建成功后弹出购买须知,引导用户完成支付
      if (!introShown) {
        setIntroVisible(true)
        setIntroShown(true)
      }
    } else {
      setToast(res.error || t('vip.purchaseFailed'))
    }
  }

  return (
    <>
      <SharedVipScreen
        t={t}
        levels={levels}
        membership={membership}
        loading={loading}
        refreshing={refreshing}
        error={error}
        toast={toast}
        purchasingId={purchasingId}
        onRefresh={() => load(true)}
        onPurchase={onPurchase}
        onBack={() => navigation.goBack()}
        colorScheme={resolvedTheme}
      />
      <PurchaseNoticePopUp
        visible={introVisible}
        title="VIP 会员权益"
        subtitle="解锁全部高级内容与专属服务"
        icon="👑"
        bullets={['畅享全站 VIP 课程与直播', '专属客服优先响应', '每月赠送积分,可兑换礼品', '专享会员折扣与活动']}
        primaryLabel="立即查看"
        onClose={() => setIntroVisible(false)}
        onPrimary={() => setIntroVisible(false)}
      />
    </>
  )
}
