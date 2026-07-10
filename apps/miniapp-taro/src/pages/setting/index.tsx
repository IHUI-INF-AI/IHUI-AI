import { View, Text, Image, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getProfile, logout, type UserInfo } from '@/api'
import './index.css'

export default function SettingIndexPage() {
  const [user, setUser] = useState<Partial<UserInfo>>({})

  const load = useCallback(async () => {
    try { setUser(await getProfile()) } catch {}
  }, [])

  const navigate = useCallback((url: string) => {
    Taro.navigateTo({ url })
  }, [])

  const onLogout = useCallback(() => {
    Taro.showModal({
      title: '提示',
      content: '确定退出登录吗？',
      success: async (res) => {
        if (res.confirm) {
          try { await logout() } catch {}
          Taro.reLaunch({ url: '/pages/login/login' })
        }
      }
    })
  }, [])

  useDidShow(() => load())

  return (
    <View className="page">
      {user.nickname ? (
        <View className="user-info">
          <Image className="avatar" src={user.avatar || '/static/default-avatar.png'} mode="aspectFill" />
          <View className="info">
            <Text className="name">{user.nickname}</Text>
            <Text className="phone">{user.phone || '未绑定手机'}</Text>
          </View>
        </View>
      ) : null}

      <View className="menu-group">
        <Text className="group-title">账号</Text>
        <View className="menu">
          <View className="menu-item" onClick={() => navigate('/pages/user/profile')}>
            <Text>个人资料</Text><Text className="arrow">›</Text>
          </View>
          <View className="menu-item" onClick={() => navigate('/pages/setting/notification')}>
            <Text>通知设置</Text><Text className="arrow">›</Text>
          </View>
          <View className="menu-item" onClick={() => navigate('/pages/setting/cache')}>
            <Text>清除缓存</Text><Text className="arrow">›</Text>
          </View>
        </View>
      </View>

      <View className="menu-group">
        <Text className="group-title">通用</Text>
        <View className="menu">
          <View className="menu-item" onClick={() => navigate('/pages/setting/language')}>
            <Text>语言设置</Text><Text className="arrow">›</Text>
          </View>
          <View className="menu-item" onClick={() => navigate('/pages/setting/theme')}>
            <Text>主题设置</Text><Text className="arrow">›</Text>
          </View>
          <View className="menu-item" onClick={() => navigate('/pages/about/index')}>
            <Text>关于我们</Text><Text className="arrow">›</Text>
          </View>
        </View>
      </View>

      <Button className="logout" onClick={onLogout}>退出登录</Button>
    </View>
  )
}
