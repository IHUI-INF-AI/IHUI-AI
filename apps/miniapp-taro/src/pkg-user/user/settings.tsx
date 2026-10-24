// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { goToLogin } from '@/utils/auth'
import { logger } from '@/utils/logger'
import { View, Text, Switch } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getProfile, logout, type UserInfo } from '@/api'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import { clearAuth } from '@/utils/auth'
import ThemeRoot from '@/components/ThemeRoot'
import LineIcon from '@/components/LineIcon'
import { getRnTokens } from '@ihui/design-tokens'
import { useAppTheme } from '@/lib/theme'

const VERSION = '1.0.0'
const NOTIFICATION_KEY = 'messageNotificationEnabled'

export default function Settings() {
  const { t } = useI18n()
  const gate = useAuthReadyGate()
  /* 微信 <switch color> 走 wxml 原生属性位、不解析 CSS 变量 ⇒ 必须 JS 派生 hex。
     此处原取 --color-brand-accent-deep(非墨档),按同源映射取 brandAccent.deep
     (rn-tokens 由 sync-rn-tokens.mjs 派生自 tokens.css:亮 #4a7a96 / 暗 #a3c4d6),不改变色档。 */
  const { resolved } = useAppTheme()
  const switchAccentDeep = getRnTokens(resolved).brandAccent.deep
  const [user, setUser] = useState<Partial<UserInfo>>({})
  const [notifEnabled, setNotifEnabled] = useState(true)

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
      logger.error('user/settings', '获取用户信息', e)
    }
    try {
      const saved = Taro.getStorageSync(NOTIFICATION_KEY)
      setNotifEnabled(saved !== false)
    } catch {
      // 默认开启
    }
  }, [])

  // G-933 冷启动门控:GET /user/profile(checkAuth)需鉴权,落定前不发
  useDidShow(() => gate.waitUntilReady(() => void load()))

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
        if (
          setting.authSetting &&
          (setting.authSetting as Record<string, boolean | undefined>)['scope.notify'] === false
        ) {
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
          // 清凭据 + 落登出标记是 `clearAuth()` 一件成对动作(顺序在它内部定死)。
          // 原来那句"整片擦 storage"会连用户偏好一起抹掉,且内存里的 token 仍在
          // (下一页/下一个请求还带着它)—— 两处都不该由一次登出造成。
          clearAuth()
          Taro.showToast({ title: tt('user.loggedOut', '已退出登录'), icon: 'success' })
          setTimeout(goToLogin, 800)
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
    <ThemeRoot>
      {/* 对齐 RN 共享 SettingsScreen:页面浅灰底 + 体边距 20rpx + 分组间距 32rpx;
          分组标题 28rpx 次级字色;行卡圆角 16rpx(亮 card/暗 muted),行高 120rpx;
          行文字 32rpx(亮 text.medium/暗 foreground),箭头 40rpx 三级字色;
          通知开关品牌灰蓝 track(RN switchTrackColor true = brandAccent);退出登录 100rpx 危险红字 */}
      <View className="min-h-screen bg-background px-[20rpx] pt-[24rpx] pb-[48rpx] box-border">
        {/* 账号与安全 */}
        <View className="mb-[32rpx]">
          <Text className="block px-[8rpx] pb-[16rpx] text-[length:28rpx] text-muted-foreground">
            {tt('setting.accountSecurity', '账号与安全')}
          </Text>
          <View className="overflow-hidden rounded-lg bg-card dark:bg-muted">
            <View
              className="flex min-h-[120rpx] items-center justify-between px-[24rpx] py-[28rpx]"
              hoverClass="opacity-60"
              onClick={() => navigate('/pkg-user/user/phone')}
            >
              <Text className="flex-1 text-[length:32rpx] text-[var(--color-text-medium)] dark:text-foreground">
                {tt('setting.changePhone', '更换手机号')}
              </Text>
              <Text className="mx-[16rpx] max-w-[320rpx] overflow-hidden ihui-ellipsis whitespace-nowrap text-[length:28rpx] text-muted-foreground">
                {maskedPhone}
              </Text>
              <LineIcon name="chevron-right" size={24} color="var(--color-text-tertiary)" />
            </View>
            <View
              className="flex min-h-[120rpx] items-center justify-between px-[24rpx] py-[28rpx]"
              hoverClass="opacity-60"
              onClick={() => navigate('/pkg-user/user/password')}
            >
              <Text className="flex-1 text-[length:32rpx] text-[var(--color-text-medium)] dark:text-foreground">
                {tt('setting.changePassword', '修改密码')}
              </Text>
              <LineIcon name="chevron-right" size={24} color="var(--color-text-tertiary)" />
            </View>
            <View
              className="flex min-h-[120rpx] items-center justify-between px-[24rpx] py-[28rpx]"
              hoverClass="opacity-60"
              onClick={() => navigate('/pkg-user/user/realname')}
            >
              <Text className="flex-1 text-[length:32rpx] text-[var(--color-text-medium)] dark:text-foreground">
                {tt('setting.realNameAuth', '实名认证')}
              </Text>
              <LineIcon name="chevron-right" size={24} color="var(--color-text-tertiary)" />
            </View>
            <View
              className="flex min-h-[120rpx] items-center justify-between px-[24rpx] py-[28rpx]"
              hoverClass="opacity-60"
              onClick={() => navigate('/pkg-user/user/email')}
            >
              <Text className="flex-1 text-[length:32rpx] text-[var(--color-text-medium)] dark:text-foreground">
                {tt('setting.emailBinding', '邮箱绑定')}
              </Text>
              <LineIcon name="chevron-right" size={24} color="var(--color-text-tertiary)" />
            </View>
            <View
              className="flex min-h-[120rpx] items-center justify-between px-[24rpx] py-[28rpx]"
              hoverClass="opacity-60"
              onClick={() => navigate('/pkg-user/account-cancel/index')}
            >
              <Text className="flex-1 text-[length:32rpx] text-[var(--color-text-medium)] dark:text-foreground">
                {tt('setting.accountCancel', '账号注销')}
              </Text>
              <LineIcon name="chevron-right" size={24} color="var(--color-text-tertiary)" />
            </View>
          </View>
        </View>

        {/* 通用设置 */}
        <View className="mb-[32rpx]">
          <Text className="block px-[8rpx] pb-[16rpx] text-[length:28rpx] text-muted-foreground">
            {tt('setting.general', '通用设置')}
          </Text>
          <View className="overflow-hidden rounded-lg bg-card dark:bg-muted">
            <View className="flex min-h-[120rpx] items-center justify-between px-[24rpx] py-[28rpx]">
              <Text className="flex-1 text-[length:32rpx] text-[var(--color-text-medium)] dark:text-foreground">
                {tt('setting.notificationEntry', '消息通知')}
              </Text>

              <Switch checked={notifEnabled} color={switchAccentDeep} onChange={onNotifChange} />
            </View>
            <View
              className="flex min-h-[120rpx] items-center justify-between px-[24rpx] py-[28rpx]"
              hoverClass="opacity-60"
              onClick={() => navigate('/pages/setting/language')}
            >
              <Text className="flex-1 text-[length:32rpx] text-[var(--color-text-medium)] dark:text-foreground">
                {tt('setting.languageSetting', '语言设置')}
              </Text>
              <LineIcon name="chevron-right" size={24} color="var(--color-text-tertiary)" />
            </View>
            <View
              className="flex min-h-[120rpx] items-center justify-between px-[24rpx] py-[28rpx]"
              hoverClass="opacity-60"
              onClick={() => navigate('/pages/setting/theme')}
            >
              <Text className="flex-1 text-[length:32rpx] text-[var(--color-text-medium)] dark:text-foreground">
                {tt('setting.themeSetting', '主题设置')}
              </Text>
              <LineIcon name="chevron-right" size={24} color="var(--color-text-tertiary)" />
            </View>
            <View
              className="flex min-h-[120rpx] items-center justify-between px-[24rpx] py-[28rpx]"
              hoverClass="opacity-60"
              onClick={() => navigate('/pages/setting/cache')}
            >
              <Text className="flex-1 text-[length:32rpx] text-[var(--color-text-medium)] dark:text-foreground">
                {tt('setting.clearCache', '清除缓存')}
              </Text>
              <LineIcon name="chevron-right" size={24} color="var(--color-text-tertiary)" />
            </View>
          </View>
        </View>

        {/* 帮助与反馈 */}
        <View className="mb-[32rpx]">
          <Text className="block px-[8rpx] pb-[16rpx] text-[length:28rpx] text-muted-foreground">
            {tt('setting.helpFeedback', '帮助与反馈')}
          </Text>
          <View className="overflow-hidden rounded-lg bg-card dark:bg-muted">
            <View
              className="flex min-h-[120rpx] items-center justify-between px-[24rpx] py-[28rpx]"
              hoverClass="opacity-60"
              onClick={() => navigate('/pkg-user/user/feedback')}
            >
              <Text className="flex-1 text-[length:32rpx] text-[var(--color-text-medium)] dark:text-foreground">
                {tt('setting.feedback', '意见反馈')}
              </Text>
              <LineIcon name="chevron-right" size={24} color="var(--color-text-tertiary)" />
            </View>
            <View
              className="flex min-h-[120rpx] items-center justify-between px-[24rpx] py-[28rpx]"
              hoverClass="opacity-60"
              onClick={() => navigate('/pkg-about/about/index')}
            >
              <Text className="flex-1 text-[length:32rpx] text-[var(--color-text-medium)] dark:text-foreground">
                {tt('setting.aboutUs', '关于我们')}
              </Text>
              <LineIcon name="chevron-right" size={24} color="var(--color-text-tertiary)" />
            </View>
            <View
              className="flex min-h-[120rpx] items-center justify-between px-[24rpx] py-[28rpx]"
              hoverClass="opacity-60"
              onClick={() => navigate('/pkg-content/announcement/index')}
            >
              <Text className="flex-1 text-[length:32rpx] text-[var(--color-text-medium)] dark:text-foreground">
                {tt('announcement.title', '平台公告')}
              </Text>
              <LineIcon name="chevron-right" size={24} color="var(--color-text-tertiary)" />
            </View>
            <View
              className="flex min-h-[120rpx] items-center justify-between px-[24rpx] py-[28rpx]"
              hoverClass="opacity-60"
              onClick={() => navigate('/pkg-content/activity/index')}
            >
              <Text className="flex-1 text-[length:32rpx] text-[var(--color-text-medium)] dark:text-foreground">
                {tt('activity.title', '平台活动')}
              </Text>
              <LineIcon name="chevron-right" size={24} color="var(--color-text-tertiary)" />
            </View>
            <View
              className="flex min-h-[120rpx] items-center justify-between px-[24rpx] py-[28rpx]"
              hoverClass="opacity-60"
              onClick={() => navigate('/pkg-ai/ai-skill/index')}
            >
              <Text className="flex-1 text-[length:32rpx] text-[var(--color-text-medium)] dark:text-foreground">
                {tt('aiSkill.title', 'AI 技能')}
              </Text>
              <LineIcon name="chevron-right" size={24} color="var(--color-text-tertiary)" />
            </View>
          </View>
        </View>

        {/* 隐私与权限 */}
        <View className="mb-[32rpx]">
          <Text className="block px-[8rpx] pb-[16rpx] text-[length:28rpx] text-muted-foreground">
            {tt('setting.privacyPermission', '隐私与权限')}
          </Text>
          <View className="overflow-hidden rounded-lg bg-card dark:bg-muted">
            <View
              className="flex min-h-[120rpx] items-center justify-between px-[24rpx] py-[28rpx]"
              hoverClass="opacity-60"
              onClick={() => navigate('/pkg-about/about/privacy')}
            >
              <Text className="flex-1 text-[length:32rpx] text-[var(--color-text-medium)] dark:text-foreground">
                {tt('setting.privacyPolicy', '隐私政策')}
              </Text>
              <LineIcon name="chevron-right" size={24} color="var(--color-text-tertiary)" />
            </View>
            <View
              className="flex min-h-[120rpx] items-center justify-between px-[24rpx] py-[28rpx]"
              hoverClass="opacity-60"
              onClick={() => navigate('/pkg-about/about/protocol')}
            >
              <Text className="flex-1 text-[length:32rpx] text-[var(--color-text-medium)] dark:text-foreground">
                {tt('setting.userAgreement', '用户协议')}
              </Text>
              <LineIcon name="chevron-right" size={24} color="var(--color-text-tertiary)" />
            </View>
          </View>
        </View>

        {/* 其他 */}
        <View className="mb-[32rpx]">
          <Text className="block px-[8rpx] pb-[16rpx] text-[length:28rpx] text-muted-foreground">
            {tt('setting.other', '其他')}
          </Text>
          <View className="overflow-hidden rounded-lg bg-card dark:bg-muted">
            <View
              className="flex min-h-[120rpx] items-center justify-between px-[24rpx] py-[28rpx]"
              hoverClass="opacity-60"
              onClick={() => navigate('/pkg-about/about/app-permission/index')}
            >
              <Text className="flex-1 text-[length:32rpx] text-[var(--color-text-medium)] dark:text-foreground">
                {tt('setting.appPermission', '应用权限')}
              </Text>
              <LineIcon name="chevron-right" size={24} color="var(--color-text-tertiary)" />
            </View>
            <View className="flex min-h-[120rpx] items-center justify-between px-[24rpx] py-[28rpx]">
              <Text className="flex-1 text-[length:32rpx] text-[var(--color-text-medium)] dark:text-foreground">
                {tt('setting.version', '当前版本号')}
              </Text>
              <Text className="mx-[16rpx] max-w-[320rpx] overflow-hidden ihui-ellipsis whitespace-nowrap text-[length:24rpx] text-[var(--color-text-tertiary)]">
                {VERSION}
              </Text>
            </View>
          </View>
        </View>

        {/* 退出登录(RN logoutBtn:100rpx 高 + 圆角 16rpx + 危险红 32rpx/600) */}
        <View className="mb-[48rpx] mt-[24rpx]">
          <View
            className="flex h-[100rpx] items-center justify-center rounded-lg bg-card dark:bg-muted"
            hoverClass="opacity-60"
            onClick={handleLogout}
          >
            <Text className="text-[length:32rpx] font-semibold text-destructive">
              {tt('user.logout', '退出登录')}
            </Text>
          </View>
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
