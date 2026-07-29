import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow, useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { useState, useMemo, useCallback } from 'react'
import { isLoggedIn, getUserInfo, clearAuth, type UserInfo } from '@/utils/auth'
import { logout } from '@/api'
import { useI18n } from '@/i18n'

const defaultAvatar =
  'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/tabbar/home.png'

const quickEntries = [
  { icon: '📋', key: 'user.menu.orders', path: '/pages/user/orders' },
  { icon: '⭐', key: 'user.menu.favorites', path: '/pages/favorites/index' },
  { icon: '👤', key: 'user.menu.following', path: '/pages/following/index' },
  { icon: '🔔', key: 'user.menu.subscriptions', path: '/pages/subscriptions/index' },
]

const menus = [
  { icon: '📚', key: 'user.menu.courses', path: '/pages/course/list' },
  { icon: '🤖', key: 'user.menu.ai', path: '/pages/ai/chat' },
  { icon: '⚙️', key: 'user.menu.settings', path: '/pages/user/settings' },
]

// 会员权益项:i18n key 不存在时用中文 fallback(后续补 key 后自动切换)
const membershipBenefits: ReadonlyArray<{ icon: string; key: string; fallback: string }> = [
  { icon: '🤖', key: 'user.benefits.exclusiveModel', fallback: '专属模型' },
  { icon: '💎', key: 'user.benefits.pointsBoost', fallback: '积分加倍' },
  { icon: '🎧', key: 'user.benefits.prioritySupport', fallback: '优先客服' },
  { icon: '🏆', key: 'user.benefits.vipZone', fallback: '会员专区' },
  { icon: '🏷️', key: 'user.benefits.discount', fallback: '折扣优惠' },
  { icon: '🎉', key: 'user.benefits.exclusiveEvents', fallback: '专属活动' },
]

export default function UserIndex() {
  const { t } = useI18n()
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [showBenefits, setShowBenefits] = useState<boolean>(false)
  const isLogin = useMemo(() => !!userInfo, [userInfo])

  const refresh = useCallback(() => {
    setUserInfo(isLoggedIn() ? getUserInfo() : null)
  }, [])

  const maskPhone = useCallback((phone: string) => {
    return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
  }, [])

  const toggleBenefits = useCallback(() => setShowBenefits((v) => !v), [])

  // i18n key 不存在时(t 返回 key 本身)回退到中文文案
  const tf = useCallback(
    (key: string, fallback: string): string => {
      const v = t(key)
      return v === key ? fallback : v
    },
    [t],
  )

  function goLogin() {
    Taro.navigateTo({ url: '/pages/login/login' })
  }

  function goPage(path: string) {
    Taro.navigateTo({ url: path })
  }

  function handleLogout() {
    Taro.showModal({
      title: t('common.hint'),
      content: t('user.logoutConfirm'),
      success: async (res) => {
        if (res.confirm) {
          try {
            await logout()
          } catch {
            // 忽略退出接口错误
          }
          clearAuth()
          setUserInfo(null)
          Taro.showToast({ title: t('user.loggedOut'), icon: 'success' })
        }
      },
    })
  }

  useDidShow(() => {
    refresh()
  })

  useShareAppMessage(() => ({
    title: t('share.appTitle'),
    path: '/pages/index/index',
    imageUrl: '/static/share.png',
  }))
  useShareTimeline(() => ({
    title: t('share.timelineTitle'),
    query: '',
  }))

  return (
    <View className="min-h-screen pb-[40rpx]">
      {/* 用户信息头部 — primary 实色背景 */}
      <View
        className="pt-[120rpx] px-[32rpx] pb-[48rpx]"
        style={{ background: 'var(--color-primary)' }}
      >
        {userInfo ? (
          <View className="flex items-center">
            <Image
              className="w-[120rpx] h-[120rpx] rounded-md border-[4rpx] border-solid border-primary-foreground"
              src={userInfo.avatar || defaultAvatar}
              mode="aspectFill"
            />
            <View className="ml-[24rpx]">
              <Text className="block text-primary-foreground text-[36rpx] font-semibold">
                {userInfo.userName || userInfo.nickname || t('common.user')}
              </Text>
              {userInfo.phone ? (
                <Text className="block mt-[8rpx] text-primary-foreground text-[24rpx] opacity-85">
                  {maskPhone(userInfo.phone)}
                </Text>
              ) : null}
              {userInfo.isVip ? (
                <Text className="inline-block mt-[12rpx] px-[16rpx] py-[4rpx] bg-accent text-accent-foreground text-[20rpx] rounded-[20rpx]">
                  {t('user.vipMember')}
                </Text>
              ) : null}
            </View>
          </View>
        ) : (
          <View className="flex items-center" onClick={goLogin}>
            <Image
              className="w-[120rpx] h-[120rpx] rounded-md border-[4rpx] border-solid border-primary-foreground"
              src={defaultAvatar}
              mode="aspectFill"
            />
            <View className="ml-[24rpx]">
              <Text className="block text-primary-foreground text-[36rpx] font-semibold">
                {t('user.tapLogin')}
              </Text>
              <Text className="block mt-[8rpx] text-primary-foreground text-[24rpx] opacity-85">
                {t('user.loginHint')}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* 会员权益卡片 — 展开/收起 */}
      <View className="mx-[32rpx] my-[24rpx] bg-card border border-border rounded-lg overflow-hidden">
        <View
          className="flex items-center justify-between px-[32rpx] py-[28rpx]"
          onClick={toggleBenefits}
        >
          <Text className="text-[28rpx] font-semibold text-foreground">
            {tf('user.benefits.title', '会员权益')}
          </Text>
          <Text
            className={`text-[24rpx] text-muted-foreground transition-transform duration-300 ${
              showBenefits ? 'rotate-180' : ''
            }`}
          >
            ▼
          </Text>
        </View>
        {showBenefits ? (
          <View className="flex flex-wrap px-[8rpx] pb-[16rpx]">
            {membershipBenefits.map((b) => (
              <View
                key={b.key}
                className="w-1/3 flex flex-col items-center py-[16rpx]"
              >
                <Text className="text-[44rpx]">{b.icon}</Text>
                <Text className="mt-[8rpx] text-[24rpx] text-foreground text-center">
                  {tf(b.key, b.fallback)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {/* 快捷入口(订单/收藏/关注/订阅)— */}
      <View className="mx-[32rpx] my-[24rpx] py-[28rpx]">
        <View className="flex">
          {quickEntries.map((entry) => (
            <View
              key={entry.path}
              className="flex-1 flex flex-col items-center"
              onClick={() => goPage(entry.path)}
            >
              <Text className="text-[44rpx]">{entry.icon}</Text>
              <Text className="mt-[6rpx] text-[24rpx] text-foreground">{t(entry.key)}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 功能列表 */}
      <View className="mx-[32rpx] my-[24rpx] overflow-hidden">
        {menus.map((item, idx) => (
          <View
            key={item.path}
            className={`flex items-center px-[32rpx] py-[32rpx] ${
              idx < menus.length - 1 ? 'mb-[8rpx]' : ''
            }`}
            onClick={() => goPage(item.path)}
          >
            <Text className="text-[40rpx]">{item.icon}</Text>
            <Text className="flex-1 ml-[20rpx] text-[30rpx] text-foreground">{t(item.key)}</Text>
            <Text className="text-[26rpx] text-[var(--color-primary)]">{'>'}</Text>
          </View>
        ))}
      </View>

      {/* 退出登录 */}
      {isLogin ? (
        <View
          className="mx-[32rpx] my-[48rpx] h-[96rpx] leading-[96rpx] text-center border border-primary text-primary rounded-lg text-[30rpx]"
          onClick={handleLogout}
        >
          <Text>{t('user.logout')}</Text>
        </View>
      ) : null}
    </View>
  )
}
