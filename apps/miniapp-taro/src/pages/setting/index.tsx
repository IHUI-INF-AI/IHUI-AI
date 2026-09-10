// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text, Image, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getProfile, logout, type UserInfo } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'

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
    <ThemeRoot>
      {/* 根容器背景对齐 RN container(pageBg=surface.bg → --color-background);
          上下留白对齐 body paddingTop 12dp→24rpx / paddingBottom 24dp→48rpx */}
      <View className="min-h-screen bg-background pb-[48rpx] pt-[24rpx]">
        {user.nickname ? (
          <View className="mx-[20rpx] flex items-center gap-[24rpx] rounded-[16rpx] bg-muted p-[28rpx]">
            {/* 头像对齐 RN avatar: 48dp→96rpx + 圆角 8dp→16rpx */}
            <Image
              className="w-[96rpx] h-[96rpx] rounded-[16rpx] bg-background"
              src={user.avatar || '/static/default-avatar.png'}
              mode="aspectFill"
            />
            <View className="min-w-0 flex-1">
              {/* 昵称对齐 RN nickname: 16dp→32rpx semibold + text.primary */}
              <Text className="block text-[32rpx] text-foreground font-semibold">
                {user.nickname}
              </Text>
              {/* 副行对齐 RN subText: 14dp→28rpx + text.secondary;间距对齐 userMeta gap 2dp→4rpx */}
              <Text className="mt-[4rpx] block text-[28rpx] text-muted-foreground">
                {user.phone || tt('setting.unboundPhone', '未绑定')}
              </Text>
            </View>
          </View>
        ) : null}

        {/* 分组对齐 RN Section: 分组间距 body gap 16dp→32rpx;标题 14dp→28rpx(text.secondary) + 距卡片 gap 8dp→16rpx;
            左右随 body paddingHorizontal 10dp→20rpx */}
        <View className="mx-[20rpx] mt-[32rpx]">
          <Text className="mb-[16rpx] block text-[28rpx] text-muted-foreground">
            {tt('setting.account', '账号与安全')}
          </Text>
          {/* sectionCard 对齐 RN: 圆角 8dp→16rpx + divider(border.light)背景 + 行间 hairline(2rpx)分隔 */}
          <View className="flex flex-col gap-[2rpx] overflow-hidden rounded-[16rpx] bg-[color:var(--color-border)]">
            <View
              className="flex min-h-[120rpx] items-center justify-between bg-card px-[24rpx] py-[28rpx] dark:bg-muted"
              onClick={() => navigate('/pages/user/profile')}
              hoverClass="opacity-60"
            >
              {/* rowLabel 对齐 RN: 16dp→32rpx + text.medium 语义映射 muted-foreground */}
              <Text className="text-[32rpx] text-muted-foreground">
                {tt('setting.profile', '个人资料')}
              </Text>
              {/* arrow 对齐 RN: 20dp→40rpx + text.tertiary */}
              <Text className="text-[40rpx] text-[color:var(--color-text-tertiary)]">›</Text>
            </View>
            <View
              className="flex min-h-[120rpx] items-center justify-between bg-card px-[24rpx] py-[28rpx] dark:bg-muted"
              onClick={() => navigate('/pages/account-cancel/index/index')}
              hoverClass="opacity-60"
            >
              <Text className="text-[32rpx] text-muted-foreground">
                {tt('setting.accountCancel', '账号注销')}
              </Text>
              <Text className="text-[40rpx] text-[color:var(--color-text-tertiary)]">›</Text>
            </View>
            <View
              className="flex min-h-[120rpx] items-center justify-between bg-card px-[24rpx] py-[28rpx] dark:bg-muted"
              onClick={() => navigate('/pages/setting/notification')}
              hoverClass="opacity-60"
            >
              <Text className="text-[32rpx] text-muted-foreground">
                {tt('setting.notificationSetting', '通知设置')}
              </Text>
              <Text className="text-[40rpx] text-[color:var(--color-text-tertiary)]">›</Text>
            </View>
          </View>
        </View>

        <View className="mx-[20rpx] mt-[32rpx]">
          <Text className="mb-[16rpx] block text-[28rpx] text-muted-foreground">
            {tt('setting.general', '通用')}
          </Text>
          <View className="flex flex-col gap-[2rpx] overflow-hidden rounded-[16rpx] bg-[color:var(--color-border)]">
            <View
              className="flex min-h-[120rpx] items-center justify-between bg-card px-[24rpx] py-[28rpx] dark:bg-muted"
              onClick={() => navigate('/pages/setting/cache')}
              hoverClass="opacity-60"
            >
              <Text className="text-[32rpx] text-muted-foreground">
                {tt('setting.clearCache', '清除缓存')}
              </Text>
              <Text className="text-[40rpx] text-[color:var(--color-text-tertiary)]">›</Text>
            </View>
            <View
              className="flex min-h-[120rpx] items-center justify-between bg-card px-[24rpx] py-[28rpx] dark:bg-muted"
              onClick={() => navigate('/pages/setting/language')}
              hoverClass="opacity-60"
            >
              <Text className="text-[32rpx] text-muted-foreground">
                {tt('setting.languageSetting', '语言设置')}
              </Text>
              <Text className="text-[40rpx] text-[color:var(--color-text-tertiary)]">›</Text>
            </View>
            <View
              className="flex min-h-[120rpx] items-center justify-between bg-card px-[24rpx] py-[28rpx] dark:bg-muted"
              onClick={() => navigate('/pages/setting/theme')}
              hoverClass="opacity-60"
            >
              <Text className="text-[32rpx] text-muted-foreground">
                {tt('setting.themeSetting', '主题设置')}
              </Text>
              <Text className="text-[40rpx] text-[color:var(--color-text-tertiary)]">›</Text>
            </View>
          </View>
        </View>

        <View className="mx-[20rpx] mt-[32rpx]">
          <Text className="mb-[16rpx] block text-[28rpx] text-muted-foreground">
            {tt('setting.other', '其他')}
          </Text>
          <View className="flex flex-col gap-[2rpx] overflow-hidden rounded-[16rpx] bg-[color:var(--color-border)]">
            <View
              className="flex min-h-[120rpx] items-center justify-between bg-card px-[24rpx] py-[28rpx] dark:bg-muted"
              onClick={() => navigate('/pages/user/feedback')}
              hoverClass="opacity-60"
            >
              <Text className="text-[32rpx] text-muted-foreground">
                {tt('setting.feedback', '意见反馈')}
              </Text>
              <Text className="text-[40rpx] text-[color:var(--color-text-tertiary)]">›</Text>
            </View>
            <View
              className="flex min-h-[120rpx] items-center justify-between bg-card px-[24rpx] py-[28rpx] dark:bg-muted"
              onClick={() => navigate('/pages/setting/privacy')}
              hoverClass="opacity-60"
            >
              <Text className="text-[32rpx] text-muted-foreground">
                {tt('setting.privacyPermission', '隐私与权限')}
              </Text>
              <Text className="text-[40rpx] text-[color:var(--color-text-tertiary)]">›</Text>
            </View>
            <View
              className="flex min-h-[120rpx] items-center justify-between bg-card px-[24rpx] py-[28rpx] dark:bg-muted"
              onClick={() => navigate('/pages/about/index')}
              hoverClass="opacity-60"
            >
              <Text className="text-[32rpx] text-muted-foreground">
                {tt('setting.aboutUs', '关于我们')}
              </Text>
              <Text className="text-[40rpx] text-[color:var(--color-text-tertiary)]">›</Text>
            </View>
          </View>
        </View>

        {/* logoutBtn 对齐 RN: 高 50dp→100rpx + 圆角 8dp→16rpx + 卡面底色;
            文字 16dp→32rpx semibold + danger(对齐 RN danger.DEFAULT,亮暗随 --color-danger);
            上边距 logoutBtn marginTop 8dp + body gap 16dp = 24dp→48rpx */}
        <Button
          className="mx-[20rpx] mt-[48rpx] flex h-[100rpx] items-center justify-center rounded-[16rpx] bg-card text-[32rpx] font-semibold dark:bg-muted"
          style={{ color: 'var(--color-danger)' }}
          onClick={onLogout}
        >
          {tt('setting.logout', '退出登录')}
        </Button>

        {/* versionText 对齐 RN: 独立居中行 + 12dp→24rpx + text.tertiary + marginTop 4dp→8rpx */}
        <Text className="mt-[8rpx] block text-center text-[24rpx] text-[color:var(--color-text-tertiary)]">
          {tt('setting.version', '版本')} {VERSION}
        </Text>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
