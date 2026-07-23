import { useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { ProfileScreen as SharedProfileScreen } from '@ihui/app'
import type { SharedMenuSection } from '@ihui/app'
import { getOrders, getUserStatistics, type UserStatistics } from '@ihui/api-client'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import type { ProfileStackParamList } from '../navigation/RootNavigator'
import { MENU_SECTIONS, type MenuItem } from './profileMenuData'

type NavigationProp = NativeStackNavigationProp<ProfileStackParamList>

/**
 * RN 端 Profile 包装器 — 注入 t + 真实 API 数据(user/stats/orderCount)+ 导航回调,
 * 渲染共享 ProfileScreen。menuSections 从本地 profileMenuData 映射为共享契约格式。
 */
export function ProfileScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const { user, logout, ready } = useAuth()
  const [stats, setStats] = useState<UserStatistics | null>(null)
  const [orderCount, setOrderCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const [statsRes, orderRes] = await Promise.all([
        getUserStatistics(),
        getOrders({ page: 1, pageSize: 1 }),
      ])
      if (cancelled) return
      if (statsRes.success) setStats(statsRes.data)
      if (orderRes.success) setOrderCount(orderRes.data.total)
      if (!statsRes.success && !orderRes.success) {
        setError(statsRes.error || orderRes.error || t('error.network'))
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [ready, t])

  const onNavigate = (item: MenuItem) => {
    if (item.viaParent) {
      navigation.getParent()?.navigate(item.key as never)
    } else {
      navigation.navigate(item.key as never)
    }
  }

  const menuSections: SharedMenuSection[] = MENU_SECTIONS.map((section) => ({
    title: t(section.titleKey),
    items: section.items.map((m) => ({
      key: m.key,
      label: t(m.labelKey),
      icon: m.icon,
    })),
  }))

  return (
    <SharedProfileScreen
      t={t}
      user={
        user
          ? {
              id: user.id,
              nickname: user.nickname,
              avatar: user.avatar ?? null,
              email: user.email,
              phone: user.phone,
            }
          : null
      }
      stats={stats}
      orderCount={orderCount}
      loading={loading}
      error={error}
      menuSections={menuSections}
      onNavigate={(key) => {
        const item = MENU_SECTIONS.flatMap((s) => s.items).find((m) => m.key === key)
        if (item) onNavigate(item)
      }}
      onLogout={() => void logout()}
      onBack={() => navigation.goBack()}
    />
  )
}
