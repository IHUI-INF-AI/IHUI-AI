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

export default function UserIndex() {
  const { t } = useI18n()
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const isLogin = useMemo(() => !!userInfo, [userInfo])

  const refresh = useCallback(() => {
    setUserInfo(isLoggedIn() ? getUserInfo() : null)
  }, [])

  const maskPhone = useCallback((phone: string) => {
    return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
  }, [])

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
    <View className="min-h-screen">
      {/* 用户信息头部 */}
      <View
        className="pt-[60px] px-[16px] pb-[24px]"
        style={{ background: 'linear-gradient(135deg, #07c160, #35e683)' }}
      >
        {userInfo ? (
          <View className="flex items-center">
            <Image
              className="w-[60px] h-[60px] rounded-md border-[2px] border-solid border-white"
              src={userInfo.avatar || defaultAvatar}
              mode="aspectFill"
            />
            <View className="ml-[12px]">
              <Text className="block text-white text-[18px] font-semibold">
                {userInfo.userName || userInfo.nickname || t('common.user')}
              </Text>
              {userInfo.phone ? (
                <Text className="block mt-[4px] text-white text-[12px] opacity-85">
                  {maskPhone(userInfo.phone)}
                </Text>
              ) : null}
              {userInfo.isVip ? (
                <Text className="inline-block mt-[6px] px-[8px] py-[2px] bg-[#f0ad4e] text-white text-[10px] rounded-[10px]">
                  {t('user.vipMember')}
                </Text>
              ) : null}
            </View>
          </View>
        ) : (
          <View className="flex items-center" onClick={goLogin}>
            <Image
              className="w-[60px] h-[60px] rounded-md border-[2px] border-solid border-white"
              src={defaultAvatar}
              mode="aspectFill"
            />
            <View className="ml-[12px]">
              <Text className="block text-white text-[18px] font-semibold">
                {t('user.tapLogin')}
              </Text>
              <Text className="block mt-[4px] text-white text-[12px] opacity-85">
                {t('user.loginHint')}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* 快捷入口(订单/收藏/关注/订阅) */}
      <View className="mx-[16px] my-[12px] bg-white rounded-[8px] py-[14px]">
        <View className="flex">
          {quickEntries.map((entry) => (
            <View
              key={entry.path}
              className="flex-1 flex flex-col items-center"
              onClick={() => goPage(entry.path)}
            >
              <Text className="text-[22px]">{entry.icon}</Text>
              <Text className="mt-[3px] text-[12px] text-[#333]">{t(entry.key)}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 功能列表 */}
      <View className="mx-[16px] my-[12px] bg-white rounded-[8px] overflow-hidden">
        {menus.map((item, idx) => (
          <View
            key={item.path}
            className={`flex items-center px-[16px] py-[16px] ${
              idx < menus.length - 1 ? 'border-b-[1px] border-solid border-[#f5f5f5]' : ''
            }`}
            onClick={() => goPage(item.path)}
          >
            <Text className="text-[20px]">{item.icon}</Text>
            <Text className="flex-1 ml-[10px] text-[15px] text-[#333]">{t(item.key)}</Text>
            <Text className="text-[13px] text-[#ccc]">{'>'}</Text>
          </View>
        ))}
      </View>

      {/* 退出登录 */}
      {isLogin ? (
        <View
          className="mx-[16px] my-[24px] h-[48px] leading-[48px] text-center bg-white rounded-[24px] text-[#dd524d] text-[15px]"
          onClick={handleLogout}
        >
          <Text>{t('user.logout')}</Text>
        </View>
      ) : null}
    </View>
  )
}
