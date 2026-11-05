// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像 packages/app/src/features/settings/SettingsScreen.tsx(直载共享屏 + 注入本端事实)
//
// 端内保留的业务:GET /user/profile 取用户体(仅用于"更换手机号"行的掩码读数);
// 通知三开关真值来自 GET /notifications/preferences(pushEnabled / inAppEnabled / emailEnabled),
// 落库走 PUT /notifications/preferences,失败回滚并出声;语言/主题切换保留旧页的服务端同步
// (POST /settings/language|theme),主题值在本端 'auto' 与共享屏 'system' 之间映射;
// 密码修改走 PUT /auth/password(共享屏内置 Modal,本端不再跳独立页);登出复用 profile-logout
// 的吊销腿(refreshToken → POST /auth/logout → clearAuth),确认弹窗由共享屏 onConfirm 发起。
// 渲染(语言/主题/通知/账号四分区 + 退出登录 + 版本号)全部委托共享屏,本页无自有渲染段。

import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useState } from 'react'
import {
  changePassword,
  getNotificationPreferences,
  getProfile,
  setLanguage,
  setTheme,
  updateNotificationPreferences,
  type NotificationPreferences,
  type UserInfo,
} from '@/api'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import { useI18n, useTt, type Locale } from '@/i18n'
import { logger } from '@/utils/logger'
import { getMiniappVersion } from '@/utils/app-version'
import ThemeRoot from '@/components/ThemeRoot'
import { useTheme } from '@/rn-compat/theme'
import { getThemePreference, setThemePreference, type ThemePreference } from '@/lib/theme'
import { onToast } from '@/host/on-toast'
import { SettingsScreen } from '@ihui/rn-app/features/settings/SettingsScreen'
import { performLogout } from './profile-logout'

/** 本机通知缓存键:仅在后端取不到时作兜底读数(全仓无第二个消费方,不得当服务端真值) */
const NOTIFICATION_KEY = 'messageNotificationEnabled'

/** 共享屏通知键 → 后端偏好字段 */
const NOTIF_FIELD: Record<'push' | 'message' | 'email', keyof NotificationPreferences> = {
  push: 'pushEnabled',
  message: 'inAppEnabled',
  email: 'emailEnabled',
}

/** 菜单 key → 本端分包路由(与旧页逐项对齐;语言/主题/密码改为共享屏内联) */
const MENU_ROUTES: Record<string, string> = {
  ChangePhone: '/pkg-user/user/phone',
  RealNameAuth: '/pkg-user/user/realname',
  EmailBinding: '/pkg-user/user/email',
  AccountCancel: '/pkg-user/account-cancel/index',
  ClearCache: '/pages/setting/cache',
  Feedback: '/pkg-user/user/feedback',
  AboutUs: '/pkg-about/about/index',
  Announcement: '/pkg-content/announcement/index',
  Activity: '/pkg-content/activity/index',
  AiSkill: '/pkg-ai/ai-skill/index',
  PrivacyPolicy: '/pkg-about/about/privacy',
  UserAgreement: '/pkg-about/about/protocol',
  AppPermission: '/pkg-about/about/app-permission/index',
}

export default function Settings() {
  const { t, locale, setLocale } = useI18n()
  const tt = useTt()
  const gate = useAuthReadyGate()
  const { resolvedTheme } = useTheme()
  const [user, setUser] = useState<Partial<UserInfo>>({})
  const [notifications, setNotifications] = useState({ push: true, message: true, email: false })
  // 共享屏主题值 'light' | 'dark' | 'system';本端持久化值是 'auto' | 'light' | 'dark'
  const [themeMode, setThemeMode] = useState<string>(() => {
    const pref = getThemePreference()
    return pref === 'auto' ? 'system' : pref
  })
  /* 版本号走全端唯一出口 utils/app-version;此前写死 '1.0.0' —— 屏上那个数字与任何构建都无关 */
  const appVersion = getMiniappVersion()

  const load = useCallback(async () => {
    try {
      setUser(await getProfile())
    } catch (e) {
      logger.error('user/settings', '获取用户信息', e)
    }
    // 通知开关的真值在后端:本机 storage 只是后端取不到时的兜底,不把"取不到"读成"关闭"。
    try {
      const prefs = await getNotificationPreferences()
      setNotifications({
        push: prefs.pushEnabled,
        message: prefs.inAppEnabled,
        email: prefs.emailEnabled,
      })
      try {
        Taro.setStorageSync(NOTIFICATION_KEY, prefs.pushEnabled)
      } catch {
        // 本地缓存写不进不影响真值
      }
    } catch {
      try {
        const saved = Taro.getStorageSync(NOTIFICATION_KEY)
        if (saved === false) setNotifications((prev) => ({ ...prev, push: false }))
      } catch {
        // 默认开启
      }
    }
  }, [])

  // G-933 冷启动门控:GET /user/profile(checkAuth)需鉴权,落定前不发
  useDidShow(() => gate.waitUntilReady(() => void load()))

  const onSelectLocale = useCallback(
    async (value: string) => {
      if (value === locale) return
      setLocale(value as Locale)
      try {
        await setLanguage(value)
      } catch (e) {
        logger.error('user/settings', '同步语言设置', e)
        onToast(tt('common.failed', '保存失败,请重试'), { kind: 'error' })
      }
    },
    [locale, setLocale, tt],
  )

  const onSelectTheme = useCallback(
    async (value: string) => {
      const pref: ThemePreference = value === 'system' ? 'auto' : (value as ThemePreference)
      if (pref === getThemePreference()) return
      setThemeMode(value)
      setThemePreference(pref)
      try {
        await setTheme(pref)
      } catch (e) {
        logger.error('user/settings', '同步主题设置', e)
        onToast(tt('common.failed', '保存失败,请重试'), { kind: 'error' })
      }
    },
    [tt],
  )

  const onToggleNotification = useCallback(
    async (key: 'push' | 'message' | 'email', value: boolean) => {
      const previous = !value
      setNotifications((prev) => ({ ...prev, [key]: value }))
      if (key === 'push') {
        try {
          Taro.setStorageSync(NOTIFICATION_KEY, value)
        } catch {
          // 本地缓存写不进不影响真值
        }
      }
      try {
        await updateNotificationPreferences({ [NOTIF_FIELD[key]]: value })
      } catch (e) {
        setNotifications((prev) => ({ ...prev, [key]: previous }))
        if (key === 'push') {
          try {
            Taro.setStorageSync(NOTIFICATION_KEY, previous)
          } catch {
            // ignore
          }
        }
        logger.error('user/settings', '保存通知偏好', e)
        onToast(tt('common.failed', '保存失败,请重试'), { kind: 'error' })
        return
      }
      if (key !== 'push') return
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
            onToast(tt('setting.notifOn', '已开启消息通知'), { kind: 'info' })
          }
        } catch {
          onToast(tt('setting.notifOn', '已开启消息通知'), { kind: 'info' })
        }
      } else {
        onToast(tt('setting.notifOff', '已关闭消息通知'), { kind: 'info' })
      }
    },
    [tt],
  )

  const onChangePassword = useCallback(async (oldPwd: string, newPwd: string) => {
    try {
      await changePassword({ oldPassword: oldPwd, newPassword: newPwd })
      return true
    } catch (e) {
      logger.error('user/settings', '修改密码', e)
      return false
    }
  }, [])

  const onAlert = useCallback((title: string, message?: string) => {
    Taro.showModal({ title, content: message, showCancel: false })
  }, [])

  const onConfirm = useCallback((title: string, message: string, onOk: () => void) => {
    Taro.showModal({
      title,
      content: message,
      success: (res) => {
        if (res.confirm) onOk()
      },
    })
  }, [])

  const onLogout = useCallback(() => {
    void performLogout(t)
  }, [t])

  const onMenuPress = useCallback((key: string) => {
    const url = MENU_ROUTES[key]
    if (url) Taro.navigateTo({ url })
  }, [])

  const maskedPhone = (() => {
    const p = (user.phone || '').trim()
    if (!p || p.length < 11) return tt('setting.unboundPhone', '未绑定')
    return p.slice(0, 3) + '****' + p.slice(-4)
  })()

  const localeOptions = [
    { value: 'zh-CN', label: tt('settings.lang_zhCN', '简体中文') },
    { value: 'en', label: tt('settings.lang_en', 'English') },
    { value: 'ja', label: tt('settings.lang_ja', '日本語') },
    { value: 'ko', label: tt('settings.lang_ko', '한국어') },
    { value: 'zh-TW', label: tt('settings.lang_zhTW', '繁體中文') },
  ]

  const themeOptions = [
    { value: 'light', label: tt('settings.theme_light', '浅色模式') },
    { value: 'dark', label: tt('settings.theme_dark', '深色模式') },
    { value: 'system', label: tt('settings.theme_system', '跟随系统') },
  ]

  const menuItems = [
    {
      key: 'ChangePhone',
      label: tt('setting.changePhone', '更换手机号'),
      value: maskedPhone,
    },
    { key: 'RealNameAuth', label: tt('setting.realNameAuth', '实名认证') },
    { key: 'EmailBinding', label: tt('setting.emailBinding', '邮箱绑定') },
    { key: 'AccountCancel', label: tt('setting.accountCancel', '账号注销') },
    { key: 'ClearCache', label: tt('setting.clearCache', '清除缓存') },
    { key: 'Feedback', label: tt('setting.feedback', '意见反馈') },
    { key: 'AboutUs', label: tt('setting.aboutUs', '关于我们') },
    { key: 'Announcement', label: tt('announcement.title', '平台公告') },
    { key: 'Activity', label: tt('activity.title', '平台活动') },
    { key: 'AiSkill', label: tt('aiSkill.title', 'AI 技能') },
    { key: 'PrivacyPolicy', label: tt('setting.privacyPolicy', '隐私政策') },
    { key: 'UserAgreement', label: tt('setting.userAgreement', '用户协议') },
    { key: 'AppPermission', label: tt('setting.appPermission', '应用权限') },
  ]

  return (
    <ThemeRoot>
      <SettingsScreen
        t={t}
        locale={locale}
        localeOptions={localeOptions}
        onSelectLocale={onSelectLocale}
        theme={themeMode}
        themeOptions={themeOptions}
        onSelectTheme={onSelectTheme}
        notifications={notifications}
        onToggleNotification={onToggleNotification}
        onChangePassword={onChangePassword}
        onAlert={onAlert}
        onConfirm={onConfirm}
        onLogout={onLogout}
        menuItems={menuItems}
        onMenuPress={onMenuPress}
        appVersion={appVersion}
        colorScheme={resolvedTheme}
        onBack={() => Taro.navigateBack()}
      />
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
