import { logger } from '@/utils/logger'
import { View, Text, Switch } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getProfile, logout, type UserInfo } from '@/api'
import { useI18n } from '@/i18n'
import './settings.css'

const VERSION = '1.0.0'
const NOTIFICATION_KEY = 'messageNotificationEnabled'

export default function Settings() {
  const { t } = useI18n()
  const [user, setUser] = useState<Partial<UserInfo>>({})
  const [notifEnabled, setNotifEnabled] = useState(true)

  const tt = useCallback((k: string, fb: string) => {
    const v = t(k)
    return v === k ? fb : v
  }, [t])

  const load = useCallback(async () => {
    try {
      setUser(await getProfile())
    } catch (e) {
      logger.error('user/settings', '获取用户信息', e)
    }
    try {
      const saved = Taro.getStorageSync(NOTIFICATION_KEY)
      setNotifEnabled(saved !== false)
    } catch {
      // 默认开启
    }
  }, [])

  useDidShow(() => load())

  function navigate(url: string) {
    Taro.navigateTo({ url })
  }

  async function onNotifChange(e: { detail: { value: boolean } }) {
    const value = e.detail.value
    setNotifEnabled(value)
    try {
      Taro.setStorageSync(NOTIFICATION_KEY, value)
    } catch {
      // ignore
    }
    if (value) {
      try {
        const setting = await Taro.getSetting()
        if (setting.authSetting && (setting.authSetting as Record<string, boolean | undefined>)['scope.notify'] === false) {
          Taro.showModal({
            title: tt('setting.hint', '提示'),
            content: tt('setting.notifOpenHint', '要接收消息通知,请在系统设置中开启通知权限'),
            confirmText: tt('setting.goSetting', '去设置'),
            success: (res) => {
              if (res.confirm) Taro.openSetting()
            },
          })
        } else {
          Taro.showToast({ title: tt('setting.notifOn', '已开启消息通知'), icon: 'none' })
        }
      } catch {
        Taro.showToast({ title: tt('setting.notifOn', '已开启消息通知'), icon: 'none' })
      }
    } else {
      Taro.showToast({ title: tt('setting.notifOff', '已关闭消息通知'), icon: 'none' })
    }
  }

  function handleLogout() {
    Taro.showModal({
      title: tt('setting.hint', '提示'),
      content: tt('setting.logoutConfirm', '确定要退出登录吗?'),
      success: async (res) => {
        if (res.confirm) {
          try {
            await logout()
          } catch (e) {
            logger.error('user/settings', '退出登录', e)
          }
          try {
            Taro.clearStorageSync()
          } catch {
            // ignore
          }
          Taro.showToast({ title: tt('user.loggedOut', '已退出登录'), icon: 'success' })
          setTimeout(() => Taro.reLaunch({ url: '/pages/login/login' }), 800)
        }
      },
    })
  }

  const maskedPhone = (() => {
    const p = (user.phone || '').trim()
    if (!p || p.length < 11) return tt('setting.unboundPhone', '未绑定')
    return p.slice(0, 3) + '****' + p.slice(-4)
  })()

  return (
    <View className="settings-page">
      {/* 账号与安全 */}
      <View className="settings-section">
        <Text className="section-title">{tt('setting.accountSecurity', '账号与安全')}</Text>
        <View className="section-card">
          <View className="settings-item settings-item-divider" onClick={() => navigate('/pages/user/phone')}>
            <Text className="item-label">{tt('setting.changePhone', '更换手机号')}</Text>
            <Text className="item-value">{maskedPhone}</Text>
            <Text className="arrow-icon">›</Text>
          </View>
          <View className="settings-item settings-item-divider" onClick={() => navigate('/pages/user/password')}>
            <Text className="item-label">{tt('setting.changePassword', '修改密码')}</Text>
            <Text className="arrow-icon">›</Text>
          </View>
          <View className="settings-item settings-item-divider" onClick={() => navigate('/pages/user/realname')}>
            <Text className="item-label">{tt('setting.realNameAuth', '实名认证')}</Text>
            <Text className="arrow-icon">›</Text>
          </View>
          <View className="settings-item settings-item-divider" onClick={() => navigate('/pages/user/email')}>
            <Text className="item-label">{tt('setting.emailBinding', '邮箱绑定')}</Text>
            <Text className="arrow-icon">›</Text>
          </View>
          <View className="settings-item" onClick={() => navigate('/pages/account-cancel/index/index')}>
            <Text className="item-label">{tt('setting.accountCancel', '账号注销')}</Text>
            <Text className="arrow-icon">›</Text>
          </View>
        </View>
      </View>

      {/* 通用设置 */}
      <View className="settings-section">
        <Text className="section-title">{tt('setting.general', '通用设置')}</Text>
        <View className="section-card">
          <View className="settings-item settings-item-divider settings-item-switch">
            <Text className="item-label">{tt('setting.notification', '消息通知')}</Text>
            <Switch checked={notifEnabled} color="#07c160" onChange={onNotifChange} />
          </View>
          <View className="settings-item settings-item-divider" onClick={() => navigate('/pages/setting/language')}>
            <Text className="item-label">{tt('setting.languageSetting', '语言设置')}</Text>
            <Text className="arrow-icon">›</Text>
          </View>
          <View className="settings-item settings-item-divider" onClick={() => navigate('/pages/setting/theme')}>
            <Text className="item-label">{tt('setting.themeSetting', '主题设置')}</Text>
            <Text className="arrow-icon">›</Text>
          </View>
          <View className="settings-item" onClick={() => navigate('/pages/setting/cache')}>
            <Text className="item-label">{tt('setting.clearCache', '清除缓存')}</Text>
            <Text className="arrow-icon">›</Text>
          </View>
        </View>
      </View>

      {/* 帮助与反馈 */}
      <View className="settings-section">
        <Text className="section-title">{tt('setting.helpFeedback', '帮助与反馈')}</Text>
        <View className="section-card">
          <View className="settings-item settings-item-divider" onClick={() => navigate('/pages/user/feedback')}>
            <Text className="item-label">{tt('setting.feedback', '意见反馈')}</Text>
            <Text className="arrow-icon">›</Text>
          </View>
          <View className="settings-item" onClick={() => navigate('/pages/about/index')}>
            <Text className="item-label">{tt('setting.aboutUs', '关于我们')}</Text>
            <Text className="arrow-icon">›</Text>
          </View>
        </View>
      </View>

      {/* 隐私与权限 */}
      <View className="settings-section">
        <Text className="section-title">{tt('setting.privacyPermission', '隐私与权限')}</Text>
        <View className="section-card">
          <View className="settings-item settings-item-divider" onClick={() => navigate('/pages/about/privacy')}>
            <Text className="item-label">{tt('setting.privacyPolicy', '隐私政策')}</Text>
            <Text className="arrow-icon">›</Text>
          </View>
          <View className="settings-item" onClick={() => navigate('/pages/about/protocol')}>
            <Text className="item-label">{tt('setting.userAgreement', '用户协议')}</Text>
            <Text className="arrow-icon">›</Text>
          </View>
        </View>
      </View>

      {/* 其他 */}
      <View className="settings-section">
        <Text className="section-title">{tt('setting.other', '其他')}</Text>
        <View className="section-card">
          <View className="settings-item settings-item-divider" onClick={() => navigate('/pages/about/app-permission/index')}>
            <Text className="item-label">{tt('setting.appPermission', '应用权限')}</Text>
            <Text className="arrow-icon">›</Text>
          </View>
          <View className="settings-item settings-item-disabled">
            <Text className="item-label">{tt('setting.version', '当前版本号')}</Text>
            <Text className="item-value">{VERSION}</Text>
          </View>
        </View>
      </View>

      {/* 退出登录 */}
      <View className="settings-section settings-section-logout">
        <View className="section-card section-card-logout">
          <View className="settings-item logout-item" onClick={handleLogout}>
            <Text className="logout-label">{tt('user.logout', '退出登录')}</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
