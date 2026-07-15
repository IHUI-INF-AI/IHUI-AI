import { logger } from '@/utils/logger'
import { View, Text, Image, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getProfile, logout, type UserInfo } from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

export default function SettingIndexPage() {
  const { t } = useI18n()
  const [user, setUser] = useState<Partial<UserInfo>>({})

  const load = useCallback(async () => {
    try {
      setUser(await getProfile())
    } catch (e) {
      logger.error('setting/index', '获取用户信息', e)
      Taro.showToast({ title: t('setting.operationFailed'), icon: 'none' })
    }
  }, [t])

  const navigate = useCallback((url: string) => {
    Taro.navigateTo({ url })
  }, [])

  const onLogout = useCallback(() => {
    Taro.showModal({
      title: t('setting.hint'),
      content: t('setting.logoutConfirm'),
      success: async (res) => {
        if (res.confirm) {
          try {
            await logout()
          } catch (e) {
            logger.error('setting/index', '退出登录', e)
            Taro.showToast({ title: t('setting.operationFailed'), icon: 'none' })
          }
          Taro.reLaunch({ url: '/pages/login/login' })
        }
      },
    })
  }, [t])

  useDidShow(() => load())

  return (
    <View className="page">
      {user.nickname ? (
        <View className="user-info">
          <Image
            className="avatar"
            src={user.avatar || '/static/default-avatar.png'}
            mode="aspectFill"
          />
          <View className="info">
            <Text className="name">{user.nickname}</Text>
            <Text className="phone">{user.phone || t('setting.unboundPhone')}</Text>
          </View>
        </View>
      ) : null}

      <View className="menu-group">
        <Text className="group-title">{t('setting.account')}</Text>
        <View className="menu">
          <View className="menu-item" onClick={() => navigate('/pages/user/profile')}>
            <Text>{t('setting.profile')}</Text>
            <Text className="arrow">›</Text>
          </View>
          <View className="menu-item" onClick={() => navigate('/pages/setting/notification')}>
            <Text>{t('setting.notificationSetting')}</Text>
            <Text className="arrow">›</Text>
          </View>
          <View className="menu-item" onClick={() => navigate('/pages/setting/cache')}>
            <Text>{t('setting.clearCache')}</Text>
            <Text className="arrow">›</Text>
          </View>
        </View>
      </View>

      <View className="menu-group">
        <Text className="group-title">{t('setting.general')}</Text>
        <View className="menu">
          <View className="menu-item" onClick={() => navigate('/pages/setting/language')}>
            <Text>{t('setting.languageSetting')}</Text>
            <Text className="arrow">›</Text>
          </View>
          <View className="menu-item" onClick={() => navigate('/pages/setting/theme')}>
            <Text>{t('setting.themeSetting')}</Text>
            <Text className="arrow">›</Text>
          </View>
          <View className="menu-item" onClick={() => navigate('/pages/about/index')}>
            <Text>{t('setting.aboutUs')}</Text>
            <Text className="arrow">›</Text>
          </View>
        </View>
      </View>

      <Button className="logout" onClick={onLogout}>
        {t('setting.logout')}
      </Button>
    </View>
  )
}
