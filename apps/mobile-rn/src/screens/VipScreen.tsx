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
import { VipScreen as SharedVipScreen, type VipLevelItem2, type VipMembershipInfo } from '@ihui/rn-app'
import { formatDateOnly } from '@ihui/shared/utils/date-utils'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

function toVipLevel(l: VipLevel): VipLevelItem2 {
  return {
    id: l.id, levelName: l.levelName, levelValue: l.levelValue,
    price: l.price, durationDays: l.durationDays, status: l.status,
    benefits: l.benefits ?? undefined,
  }
}

function toVipMembership(m: MembershipInfo): VipMembershipInfo {
  return {
    isActive: m.isActive, level: m.level, levelName: m.levelName,
    expireTime: formatDateOnly(m.expireTime ?? ''), daysRemaining: m.daysRemaining,
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

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      setError('')
      const [levelsRes, membershipRes] = await Promise.all([getVipLevels(), getMembershipInfo()])
      if (levelsRes.success) setLevels(levelsRes.data.map(toVipLevel))
      else setError(levelsRes.error || t('vip.loadFailed'))
      if (membershipRes.success && membershipRes.data) setMembership(toVipMembership(membershipRes.data))
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
    if (res.success) setToast(t('vip.orderCreated', { orderNo: res.data.orderNo }))
    else setToast(res.error || t('vip.purchaseFailed'))
  }

  return (
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
  )
}
