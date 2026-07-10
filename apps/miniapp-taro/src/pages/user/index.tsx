import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useMemo, useCallback } from 'react'
import { isLoggedIn, getUserInfo, clearAuth, type UserInfo } from '@/utils/auth'
import { logout } from '@/api'

const defaultAvatar = 'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/tabbar/home.png'

const menus = [
  { icon: '📋', text: '我的订单', path: '/pages/user/orders' },
  { icon: '⚙️', text: '设置', path: '/pages/user/settings' },
  { icon: '📚', text: '我的课程', path: '/pages/course/list' },
  { icon: '🤖', text: 'AI 对话', path: '/pages/ai/chat' },
]

export default function UserIndex() {
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
      title: '提示',
      content: '确定退出登录吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await logout()
          } catch (e) {
            // 忽略退出接口错误
          }
          clearAuth()
          setUserInfo(null)
          Taro.showToast({ title: '已退出登录', icon: 'success' })
        }
      },
    })
  }

  useDidShow(() => { refresh() })

  return (
    <View className="min-h-screen">
      {/* 用户信息头部 */}
      <View
        className="pt-[60px] px-[16px] pb-[24px]"
        style={{ background: 'linear-gradient(135deg, #007aff, #00c6ff)' }}
      >
        {userInfo ? (
          <View className="flex items-center">
            <Image
              className="w-[60px] h-[60px] rounded-full border-[2px] border-solid border-white"
              src={userInfo.avatar || defaultAvatar}
              mode="aspectFill"
            />
            <View className="ml-[12px]">
              <Text className="block text-white text-[18px] font-semibold">
                {userInfo.userName || userInfo.nickname || '用户'}
              </Text>
              {userInfo.phone ? (
                <Text className="block mt-[4px] text-white text-[12px] opacity-85">
                  {maskPhone(userInfo.phone)}
                </Text>
              ) : null}
              {userInfo.isVip ? (
                <Text className="inline-block mt-[6px] px-[8px] py-[2px] bg-[#f0ad4e] text-white text-[10px] rounded-[10px]">
                  VIP 会员
                </Text>
              ) : null}
            </View>
          </View>
        ) : (
          <View className="flex items-center" onClick={goLogin}>
            <Image
              className="w-[60px] h-[60px] rounded-full border-[2px] border-solid border-white"
              src={defaultAvatar}
              mode="aspectFill"
            />
            <View className="ml-[12px]">
              <Text className="block text-white text-[18px] font-semibold">点击登录</Text>
              <Text className="block mt-[4px] text-white text-[12px] opacity-85">登录后享受更多服务</Text>
            </View>
          </View>
        )}
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
            <Text className="flex-1 ml-[10px] text-[15px] text-[#333]">{item.text}</Text>
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
          <Text>退出登录</Text>
        </View>
      ) : null}
    </View>
  )
}
