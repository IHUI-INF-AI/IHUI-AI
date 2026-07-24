import { logger } from '@/utils/logger'
import { View, Text, Switch } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getProfile, logout, type UserInfo } from '@/api'
import { useI18n } from '@/i18n'

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
    <View className="min-h-screen bg-background p-[24rpx] pb-[48rpx] box-border">
      {/* 账号与安全 */}
      <View className="mb-[32rpx]">
        <Text className="block px-[8rpx] pb-[16rpx] text-[24rpx] text-muted-foreground">{tt('setting.accountSecurity', '账号与安全')}</Text>
        <View className="bg-card rounded-[12rpx] overflow-hidden">
          <View className="flex items-center justify-between py-[28rpx] px-[24rpx] mb-[12rpx] active:bg-muted" onClick={() => navigate('/pages/user/phone')}>
            <Text className="text-[28rpx] text-foreground flex-1">{tt('setting.changePhone', '更换手机号')}</Text>
            <Text className="text-[26rpx] text-muted-foreground mx-[16rpx] max-w-[320rpx] overflow-hidden text-ellipsis whitespace-nowrap">{maskedPhone}</Text>
            <Text className="text-[36rpx] text-muted-foreground font-light leading-none">›</Text>
          </View>
          <View className="flex items-center justify-between py-[28rpx] px-[24rpx] mb-[12rpx] active:bg-muted" onClick={() => navigate('/pages/user/password')}>
            <Text className="text-[28rpx] text-foreground flex-1">{tt('setting.changePassword', '修改密码')}</Text>
            <Text className="text-[36rpx] text-muted-foreground font-light leading-none">›</Text>
          </View>
          <View className="flex items-center justify-between py-[28rpx] px-[24rpx] mb-[12rpx] active:bg-muted" onClick={() => navigate('/pages/user/realname')}>
            <Text className="text-[28rpx] text-foreground flex-1">{tt('setting.realNameAuth', '实名认证')}</Text>
            <Text className="text-[36rpx] text-muted-foreground font-light leading-none">›</Text>
          </View>
          <View className="flex items-center justify-between py-[28rpx] px-[24rpx] mb-[12rpx] active:bg-muted" onClick={() => navigate('/pages/user/email')}>
            <Text className="text-[28rpx] text-foreground flex-1">{tt('setting.emailBinding', '邮箱绑定')}</Text>
            <Text className="text-[36rpx] text-muted-foreground font-light leading-none">›</Text>
          </View>
          <View className="flex items-center justify-between py-[28rpx] px-[24rpx] active:bg-muted" onClick={() => navigate('/pages/account-cancel/index/index')}>
            <Text className="text-[28rpx] text-foreground flex-1">{tt('setting.accountCancel', '账号注销')}</Text>
            <Text className="text-[36rpx] text-muted-foreground font-light leading-none">›</Text>
          </View>
        </View>
      </View>

      {/* 通用设置 */}
      <View className="mb-[32rpx]">
        <Text className="block px-[8rpx] pb-[16rpx] text-[24rpx] text-muted-foreground">{tt('setting.general', '通用设置')}</Text>
        <View className="bg-card rounded-[12rpx] overflow-hidden">
          <View className="flex items-center justify-between py-[28rpx] px-[24rpx] mb-[12rpx] active:bg-muted">
            <Text className="text-[28rpx] text-foreground flex-1">{tt('setting.notification', '消息通知')}</Text>
            <Switch checked={notifEnabled} color="#07c160" onChange={onNotifChange} />
          </View>
          <View className="flex items-center justify-between py-[28rpx] px-[24rpx] mb-[12rpx] active:bg-muted" onClick={() => navigate('/pages/setting/language')}>
            <Text className="text-[28rpx] text-foreground flex-1">{tt('setting.languageSetting', '语言设置')}</Text>
            <Text className="text-[36rpx] text-muted-foreground font-light leading-none">›</Text>
          </View>
          <View className="flex items-center justify-between py-[28rpx] px-[24rpx] mb-[12rpx] active:bg-muted" onClick={() => navigate('/pages/setting/theme')}>
            <Text className="text-[28rpx] text-foreground flex-1">{tt('setting.themeSetting', '主题设置')}</Text>
            <Text className="text-[36rpx] text-muted-foreground font-light leading-none">›</Text>
          </View>
          <View className="flex items-center justify-between py-[28rpx] px-[24rpx] active:bg-muted" onClick={() => navigate('/pages/setting/cache')}>
            <Text className="text-[28rpx] text-foreground flex-1">{tt('setting.clearCache', '清除缓存')}</Text>
            <Text className="text-[36rpx] text-muted-foreground font-light leading-none">›</Text>
          </View>
        </View>
      </View>

      {/* 帮助与反馈 */}
      <View className="mb-[32rpx]">
        <Text className="block px-[8rpx] pb-[16rpx] text-[24rpx] text-muted-foreground">{tt('setting.helpFeedback', '帮助与反馈')}</Text>
        <View className="bg-card rounded-[12rpx] overflow-hidden">
          <View className="flex items-center justify-between py-[28rpx] px-[24rpx] mb-[12rpx] active:bg-muted" onClick={() => navigate('/pages/user/feedback')}>
            <Text className="text-[28rpx] text-foreground flex-1">{tt('setting.feedback', '意见反馈')}</Text>
            <Text className="text-[36rpx] text-muted-foreground font-light leading-none">›</Text>
          </View>
          <View className="flex items-center justify-between py-[28rpx] px-[24rpx] active:bg-muted" onClick={() => navigate('/pages/about/index')}>
            <Text className="text-[28rpx] text-foreground flex-1">{tt('setting.aboutUs', '关于我们')}</Text>
            <Text className="text-[36rpx] text-muted-foreground font-light leading-none">›</Text>
          </View>
        </View>
      </View>

      {/* 隐私与权限 */}
      <View className="mb-[32rpx]">
        <Text className="block px-[8rpx] pb-[16rpx] text-[24rpx] text-muted-foreground">{tt('setting.privacyPermission', '隐私与权限')}</Text>
        <View className="bg-card rounded-[12rpx] overflow-hidden">
          <View className="flex items-center justify-between py-[28rpx] px-[24rpx] mb-[12rpx] active:bg-muted" onClick={() => navigate('/pages/about/privacy')}>
            <Text className="text-[28rpx] text-foreground flex-1">{tt('setting.privacyPolicy', '隐私政策')}</Text>
            <Text className="text-[36rpx] text-muted-foreground font-light leading-none">›</Text>
          </View>
          <View className="flex items-center justify-between py-[28rpx] px-[24rpx] active:bg-muted" onClick={() => navigate('/pages/about/protocol')}>
            <Text className="text-[28rpx] text-foreground flex-1">{tt('setting.userAgreement', '用户协议')}</Text>
            <Text className="text-[36rpx] text-muted-foreground font-light leading-none">›</Text>
          </View>
        </View>
      </View>

      {/* 其他 */}
      <View className="mb-[32rpx]">
        <Text className="block px-[8rpx] pb-[16rpx] text-[24rpx] text-muted-foreground">{tt('setting.other', '其他')}</Text>
        <View className="bg-card rounded-[12rpx] overflow-hidden">
          <View className="flex items-center justify-between py-[28rpx] px-[24rpx] mb-[12rpx] active:bg-muted" onClick={() => navigate('/pages/about/app-permission/index')}>
            <Text className="text-[28rpx] text-foreground flex-1">{tt('setting.appPermission', '应用权限')}</Text>
            <Text className="text-[36rpx] text-muted-foreground font-light leading-none">›</Text>
          </View>
          <View className="flex items-center justify-between py-[28rpx] px-[24rpx] active:bg-transparent">
            <Text className="text-[28rpx] text-foreground flex-1">{tt('setting.version', '当前版本号')}</Text>
            <Text className="text-[26rpx] text-muted-foreground mx-[16rpx] max-w-[320rpx] overflow-hidden text-ellipsis whitespace-nowrap">{VERSION}</Text>
          </View>
        </View>
      </View>

      {/* 退出登录 */}
      <View className="mt-[24rpx] mb-[48rpx]">
        <View className="bg-card rounded-[12rpx] overflow-hidden">
          <View className="flex items-center justify-center py-[32rpx] px-[24rpx] active:bg-muted" onClick={handleLogout}>
            <Text className="text-destructive text-[28rpx]">{tt('user.logout', '退出登录')}</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
