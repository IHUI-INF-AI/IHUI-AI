import { logger } from '@/utils/logger'
import { View, Text, Image, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getProfile, logout, type UserInfo } from '@/api'
import { useI18n } from '@/i18n'

const VERSION = '1.0.0'

export default function SettingIndexPage() {
  const { t } = useI18n()
  const [user, setUser] = useState<Partial<UserInfo>>({})

  // 本地 fallback:t(key) 未命中时返回 fb,保证页面可用(主 agent 补 i18n key 后自动切换)
  const tt = useCallback(
    (k: string, fb: string) => {
      const v = t(k)
      return v === k ? fb : v
    },
    [t],
  )

  const load = useCallback(async () => {
    try {
      setUser(await getProfile())
    } catch (e) {
      logger.error('setting/index', '获取用户信息', e)
      Taro.showToast({ title: tt('setting.operationFailed', '操作失败'), icon: 'none' })
    }
  }, [tt])

  const navigate = useCallback((url: string) => {
    Taro.navigateTo({ url })
  }, [])

  const onLogout = useCallback(() => {
    Taro.showModal({
      title: tt('setting.hint', '提示'),
      content: tt('setting.logoutConfirm', '确定要退出登录吗?'),
      success: async (res) => {
        if (res.confirm) {
          try {
            await logout()
          } catch (e) {
            logger.error('setting/index', '退出登录', e)
            Taro.showToast({ title: tt('setting.operationFailed', '操作失败'), icon: 'none' })
          }
          Taro.reLaunch({ url: '/pages/login/login' })
        }
      },
    })
  }, [tt])

  useDidShow(() => load())

  return (
    <View className="min-h-screen bg-background">
      {user.nickname ? (
        <View className="flex items-center py-[60rpx] px-[32rpx] bg-card">
          <Image
            className="w-[120rpx] h-[120rpx] rounded-[8rpx] bg-background"
            src={user.avatar || '/static/default-avatar.png'}
            mode="aspectFill"
          />
          <View className="ml-[24rpx]">
            <Text className="block text-[32rpx] text-foreground font-semibold">
              {user.nickname}
            </Text>
            <Text className="block mt-[8rpx] text-[24rpx] text-muted-foreground">
              {user.phone || tt('setting.unboundPhone', '未绑定')}
            </Text>
          </View>
        </View>
      ) : null}

      <View className="mt-[24rpx]">
        <Text className="block px-[32rpx] pb-[16rpx] text-[24rpx] text-muted-foreground">
          {tt('setting.account', '账号与安全')}
        </Text>
        <View className="flex flex-col gap-[16rpx] mx-[24rpx] bg-card rounded-[16rpx] overflow-hidden">
          <View
            className="flex items-center justify-between p-[32rpx] text-[28rpx] text-foreground"
            onClick={() => navigate('/pages/user/profile')}
          >
            <Text>{tt('setting.profile', '个人资料')}</Text>
            <Text className="text-muted-foreground">›</Text>
          </View>
          <View
            className="flex items-center justify-between p-[32rpx] text-[28rpx] text-foreground"
            onClick={() => navigate('/pages/account-cancel/index/index')}
          >
            <Text>{tt('setting.accountCancel', '账号注销')}</Text>
            <Text className="text-muted-foreground">›</Text>
          </View>
          <View
            className="flex items-center justify-between p-[32rpx] text-[28rpx] text-foreground"
            onClick={() => navigate('/pages/setting/notification')}
          >
            <Text>{tt('setting.notificationSetting', '通知设置')}</Text>
            <Text className="text-muted-foreground">›</Text>
          </View>
        </View>
      </View>

      <View className="mt-[24rpx]">
        <Text className="block px-[32rpx] pb-[16rpx] text-[24rpx] text-muted-foreground">
          {tt('setting.general', '通用')}
        </Text>
        <View className="flex flex-col gap-[16rpx] mx-[24rpx] bg-card rounded-[16rpx] overflow-hidden">
          <View
            className="flex items-center justify-between p-[32rpx] text-[28rpx] text-foreground"
            onClick={() => navigate('/pages/setting/cache')}
          >
            <Text>{tt('setting.clearCache', '清除缓存')}</Text>
            <Text className="text-muted-foreground">›</Text>
          </View>
          <View
            className="flex items-center justify-between p-[32rpx] text-[28rpx] text-foreground"
            onClick={() => navigate('/pages/setting/language')}
          >
            <Text>{tt('setting.languageSetting', '语言设置')}</Text>
            <Text className="text-muted-foreground">›</Text>
          </View>
          <View
            className="flex items-center justify-between p-[32rpx] text-[28rpx] text-foreground"
            onClick={() => navigate('/pages/setting/theme')}
          >
            <Text>{tt('setting.themeSetting', '主题设置')}</Text>
            <Text className="text-muted-foreground">›</Text>
          </View>
        </View>
      </View>

      <View className="mt-[24rpx]">
        <Text className="block px-[32rpx] pb-[16rpx] text-[24rpx] text-muted-foreground">
          {tt('setting.other', '其他')}
        </Text>
        <View className="flex flex-col gap-[16rpx] mx-[24rpx] bg-card rounded-[16rpx] overflow-hidden">
          <View
            className="flex items-center justify-between p-[32rpx] text-[28rpx] text-foreground"
            onClick={() => navigate('/pages/user/feedback')}
          >
            <Text>{tt('setting.feedback', '意见反馈')}</Text>
            <Text className="text-muted-foreground">›</Text>
          </View>
          <View
            className="flex items-center justify-between p-[32rpx] text-[28rpx] text-foreground"
            onClick={() => navigate('/pages/setting/privacy')}
          >
            <Text>{tt('setting.privacyPermission', '隐私与权限')}</Text>
            <Text className="text-muted-foreground">›</Text>
          </View>
          <View
            className="flex items-center justify-between p-[32rpx] text-[28rpx] text-foreground"
            onClick={() => navigate('/pages/about/index')}
          >
            <Text>{tt('setting.aboutUs', '关于我们')}</Text>
            <Text className="text-muted-foreground">›</Text>
          </View>
          <View className="flex items-center justify-between p-[32rpx] text-[28rpx] text-foreground opacity-[0.85]">
            <Text>{tt('setting.version', '版本')}</Text>
            <Text className="text-[26rpx] text-muted-foreground">{VERSION}</Text>
          </View>
        </View>
      </View>

      <Button
        className="mx-[32rpx] my-[60rpx] bg-card text-destructive rounded-[40rpx] text-[30rpx]"
        onClick={onLogout}
      >
        {tt('setting.logout', '退出登录')}
      </Button>
    </View>
  )
}
