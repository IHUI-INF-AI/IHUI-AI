import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Card } from '@ihui/ui-native'
import { getOrders, getUserStatistics, type UserStatistics } from '@ihui/api-client'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import type { ProfileStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<ProfileStackParamList>

interface MenuItem {
  key: string
  labelKey: string
  icon: string
  viaParent?: boolean
}

interface MenuSection {
  titleKey: string
  items: MenuItem[]
}

const MENU_SECTIONS: MenuSection[] = [
  {
    titleKey: 'menu.sectionOrder',
    items: [
      { key: 'Order', labelKey: 'menu.order', icon: '🧾' },
      { key: 'OrderRefund', labelKey: 'menu.orderRefund', icon: '↩️', viaParent: true },
      { key: 'Payment', labelKey: 'menu.payment', icon: '💳', viaParent: true },
      { key: 'OrderLog', labelKey: 'menu.orderLog', icon: '📋', viaParent: true },
      { key: 'OrderTrack', labelKey: 'menu.orderTrack', icon: '📦', viaParent: true },
      { key: 'RefundHistory', labelKey: 'menu.refundHistory', icon: '🔄', viaParent: true },
    ],
  },
  {
    titleKey: 'menu.sectionWallet',
    items: [
      { key: 'Wallet', labelKey: 'menu.wallet', icon: '💰' },
      { key: 'Finance', labelKey: 'menu.finance', icon: '📊', viaParent: true },
      { key: 'Withdraw', labelKey: 'menu.withdraw', icon: '💸', viaParent: true },
      { key: 'BankCard', labelKey: 'menu.bankCard', icon: '🏦', viaParent: true },
    ],
  },
  {
    titleKey: 'menu.sectionVip',
    items: [
      { key: 'Vip', labelKey: 'menu.vip', icon: '👑', viaParent: true },
      { key: 'VipBenefit', labelKey: 'menu.vipBenefit', icon: '🎁', viaParent: true },
      { key: 'VipCompare', labelKey: 'menu.vipCompare', icon: '⚖️', viaParent: true },
      { key: 'Coupon', labelKey: 'menu.coupon', icon: '🎟️', viaParent: true },
      { key: 'Promotion', labelKey: 'menu.promotion', icon: '🏷️', viaParent: true },
    ],
  },
  {
    titleKey: 'menu.sectionPoints',
    items: [
      { key: 'PointsMall', labelKey: 'menu.pointsMall', icon: '🛍️', viaParent: true },
      { key: 'PointsRecord', labelKey: 'menu.pointsRecord', icon: '📈', viaParent: true },
      { key: 'PointRule', labelKey: 'menu.pointRule', icon: '📖', viaParent: true },
      { key: 'PointHistory', labelKey: 'menu.pointHistory', icon: '🗂️', viaParent: true },
      { key: 'TaskCenter', labelKey: 'menu.taskCenter', icon: '✅', viaParent: true },
      { key: 'CheckIn', labelKey: 'menu.checkIn', icon: '📅', viaParent: true },
      { key: 'Ranking', labelKey: 'menu.ranking', icon: '🏆', viaParent: true },
    ],
  },
  {
    titleKey: 'menu.sectionPromote',
    items: [
      { key: 'Promote', labelKey: 'menu.promote', icon: '📢', viaParent: true },
      { key: 'Distribution', labelKey: 'menu.distribution', icon: '🤝', viaParent: true },
      { key: 'Team', labelKey: 'menu.team', icon: '👥', viaParent: true },
      { key: 'Referrer', labelKey: 'menu.referrer', icon: '👤', viaParent: true },
      { key: 'Invite', labelKey: 'menu.invite', icon: '✉️', viaParent: true },
      { key: 'QrCode', labelKey: 'menu.qrCode', icon: '📱', viaParent: true },
      { key: 'Activity', labelKey: 'menu.activity', icon: '🎉', viaParent: true },
    ],
  },
  {
    titleKey: 'menu.sectionStudy',
    items: [
      { key: 'Note', labelKey: 'menu.note', icon: '📝', viaParent: true },
      { key: 'StudyRecord', labelKey: 'menu.studyRecord', icon: '📚', viaParent: true },
      { key: 'StudyPlan', labelKey: 'menu.studyPlan', icon: '🗓️', viaParent: true },
      { key: 'StudyProgress', labelKey: 'menu.studyProgress', icon: '📈', viaParent: true },
      { key: 'AIMultimodal', labelKey: 'menu.aiMultimodal', icon: '🎨', viaParent: true },
      { key: 'CourseEnroll', labelKey: 'menu.courseEnroll', icon: '🎓', viaParent: true },
      { key: 'LivePlayback', labelKey: 'menu.livePlayback', icon: '▶️', viaParent: true },
    ],
  },
  {
    titleKey: 'menu.sectionExam',
    items: [
      { key: 'Exam', labelKey: 'menu.exam', icon: '✏️', viaParent: true },
      { key: 'ExamHistory', labelKey: 'menu.examHistory', icon: '🗂️', viaParent: true },
      { key: 'Certificate', labelKey: 'menu.certificate', icon: '📜' },
      { key: 'CertList', labelKey: 'menu.certList', icon: '📋', viaParent: true },
      { key: 'CertApply', labelKey: 'menu.certApply', icon: '✍️', viaParent: true },
      { key: 'CertVerify', labelKey: 'menu.certVerify', icon: '✔️', viaParent: true },
    ],
  },
  {
    titleKey: 'menu.sectionSocial',
    items: [
      { key: 'Favorites', labelKey: 'menu.favorites', icon: '⭐' },
      { key: 'Following', labelKey: 'menu.following', icon: '👀' },
      { key: 'Follow', labelKey: 'menu.follow', icon: '🤝' },
      { key: 'Favorite', labelKey: 'menu.favorite', icon: '❤️' },
      { key: 'MessageCenter', labelKey: 'menu.messageCenter', icon: '💬' },
      { key: 'MessageSystem', labelKey: 'menu.messageSystem', icon: '🔔', viaParent: true },
      { key: 'MessageDirect', labelKey: 'menu.messageDirect', icon: '📩', viaParent: true },
      { key: 'MessageGroup', labelKey: 'menu.messageGroup', icon: '👥', viaParent: true },
      { key: 'NotificationList', labelKey: 'menu.notificationList', icon: '📣', viaParent: true },
      {
        key: 'NotificationSettings',
        labelKey: 'menu.notificationSettings',
        icon: '⚙️',
        viaParent: true,
      },
    ],
  },
  {
    titleKey: 'menu.sectionAuth',
    items: [
      { key: 'ProfileEdit', labelKey: 'menu.profileEdit', icon: '✏️' },
      { key: 'RealNameAuth', labelKey: 'menu.realNameAuth', icon: '🪪', viaParent: true },
    ],
  },
  {
    titleKey: 'menu.sectionAgent',
    items: [
      { key: 'Agent', labelKey: 'menu.agent', icon: '🤖' },
      { key: 'AgentMarket', labelKey: 'menu.agentMarket', icon: '🏪', viaParent: true },
      { key: 'AgentCreate', labelKey: 'menu.agentCreate', icon: '➕', viaParent: true },
      { key: 'AgentReviewList', labelKey: 'menu.agentReviewList', icon: '💬', viaParent: true },
      { key: 'AgentStat', labelKey: 'menu.agentStat', icon: '📊', viaParent: true },
      { key: 'AgentSetting', labelKey: 'menu.agentSetting', icon: '⚙️', viaParent: true },
    ],
  },
  {
    titleKey: 'menu.sectionCommunity',
    items: [
      { key: 'ArticleList', labelKey: 'menu.articleList', icon: '📰', viaParent: true },
      { key: 'PostCreate', labelKey: 'menu.postCreate', icon: '✍️', viaParent: true },
      { key: 'CircleCreate', labelKey: 'menu.circleCreate', icon: '⭕', viaParent: true },
      { key: 'AskList', labelKey: 'menu.askList', icon: '❓', viaParent: true },
      { key: 'AskCreate', labelKey: 'menu.askCreate', icon: '➕', viaParent: true },
      { key: 'NoteList', labelKey: 'menu.noteList', icon: '📝', viaParent: true },
      { key: 'NoteCreate', labelKey: 'menu.noteCreate', icon: '✏️', viaParent: true },
    ],
  },
  {
    titleKey: 'menu.sectionSettings',
    items: [
      { key: 'Subscriptions', labelKey: 'menu.subscriptions', icon: '🔁' },
      { key: 'Settings', labelKey: 'menu.settings', icon: '⚙️' },
    ],
  },
]

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
        setError(statsRes.error || orderRes.error || t('common.networkError'))
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

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    )
  }

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-black"
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      <View className="px-4 pt-12 pb-4">
        <Text className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
          {t('profile.title')}
        </Text>
      </View>

      <View className="px-4">
        <Card>
          <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            {user?.nickname || user?.phone || t('profile.notLoggedIn')}
          </Text>
          {user?.id ? <Text className="mt-1 text-xs text-neutral-500">ID: {user.id}</Text> : null}
          <View className="mt-3 flex-row items-center gap-3">
            <View className="rounded-md bg-emerald-50 px-3 py-1.5">
              <Text className="text-[10px] text-emerald-700">{t('profile.points')}</Text>
              <Text className="text-sm font-semibold text-emerald-700">{stats?.points ?? 0}</Text>
            </View>
            <View className="rounded-md bg-blue-50 px-3 py-1.5">
              <Text className="text-[10px] text-blue-700">{t('profile.studyHours')}</Text>
              <Text className="text-sm font-semibold text-blue-700">{stats?.studyHours ?? 0}</Text>
            </View>
          </View>
        </Card>
      </View>

      {error ? (
        <View className="px-4 py-2">
          <Text className="text-sm text-red-600">{error}</Text>
        </View>
      ) : null}

      <View className="px-4 mt-4">
        <Text className="mb-2 text-base font-semibold text-neutral-900 dark:text-neutral-50">
          {t('profile.statistics')}
        </Text>
        <Card>
          <View className="flex-row justify-between">
            <View className="items-center">
              <Text className="text-lg font-semibold text-neutral-900">
                {stats?.courseCount ?? 0}
              </Text>
              <Text className="text-[10px] text-neutral-500">{t('profile.courseCount')}</Text>
            </View>
            <View className="items-center">
              <Text className="text-lg font-semibold text-neutral-900">{orderCount}</Text>
              <Text className="text-[10px] text-neutral-500">{t('nav.orders')}</Text>
            </View>
            <View className="items-center">
              <Text className="text-lg font-semibold text-neutral-900">
                {stats?.favoriteCount ?? 0}
              </Text>
              <Text className="text-[10px] text-neutral-500">{t('profile.favoriteCount')}</Text>
            </View>
          </View>
        </Card>
      </View>

      {MENU_SECTIONS.map((section) => (
        <View key={section.titleKey} className="mt-4 px-4">
          <Text className="mb-2 text-xs font-semibold uppercase text-neutral-500">
            {t(section.titleKey)}
          </Text>
          <View className="rounded-lg bg-neutral-50 dark:bg-neutral-900 p-1">
            {section.items.map((m) => (
              <TouchableOpacity
                key={m.key}
                onPress={() => onNavigate(m)}
                activeOpacity={0.7}
                className="p-3"
              >
                <View className="flex-row items-center">
                  <Text className="text-lg">{m.icon}</Text>
                  <Text className="ml-3 flex-1 text-sm text-neutral-900 dark:text-neutral-50">
                    {t(m.labelKey)}
                  </Text>
                  <Text className="text-neutral-400">›</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      <View className="mt-4 px-4">
        <TouchableOpacity
          onPress={() => void logout()}
          className="rounded-lg border border-red-200 bg-red-50 p-3"
        >
          <Text className="text-center text-sm text-red-600">{t('auth.logout')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}
