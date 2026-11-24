// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 薄壳:渲染全部委托共享屏 packages/app/src/features/settings/SettingsScreen.tsx
// (RN 原屏 apps/mobile-rn/src/screens/SettingsScreen.tsx:333 同屏消费,0 新增 prop)。
// 端内保留:① getProfile 用户卡;② 语言/主题偏好落库与广播;③ 通知三键 GET/PUT;
// ④ 修改密码 API;⑤ 退出登录(登出接口 + clearAuth + goToLogin);⑥ 菜单行跳转。
// 分组标题按共享屏口径拍平为菜单行(RN 同款);手机号尾值并入行文案,不新增 prop。
import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useState } from 'react'
import { useI18n, useTt, type Locale } from '@/i18n'
import {
  changePassword,
  getNotificationPreferences,
  getProfile,
  logout,
  setLanguage,
  setTheme,
  updateNotificationPreferences,
  type UserInfo,
  type NotificationPreferences,
} from '@/api'
import { clearAuth, goToLogin } from '@/utils/auth'
import { getMiniappVersion } from '@/utils/app-version'
import { logger } from '@/utils/logger'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import { onToast } from '@/host/on-toast'
import ThemeRoot from '@/components/ThemeRoot'
import { useTheme } from '@/rn-compat/theme'
import { SettingsScreen as SharedSettingsScreen } from '@ihui/rn-app/features/settings/SettingsScreen'
import type {
  SharedLocaleOption,
  SharedMenuItem,
  SharedNotificationToggles,
  SharedThemeOption,
} from '@ihui/rn-app'

type NotifKey = keyof SharedNotificationToggles

/** 菜单行 → 小程序路由;语言/主题/通知/修改密码/退出由共享屏内建。 */
const MENU_ROUTES: Readonly<Record<string, string>> = {
  changePhone: '/pkg-user/user/phone',
  realname: '/pkg-user/user/realname',
  email: '/pkg-user/user/email',
  accountCancel: '/pkg-user/account-cancel/index',
  cache: '/pages/setting/cache',
  feedback: '/pkg-user/user/feedback',
  about: '/pkg-about/about/index',
  announcement: '/pkg-content/announcement/index',
  activity: '/pkg-content/activity/index',
  aiSkill: '/pkg-ai/ai-skill/index',
  privacy: '/pkg-about/about/privacy',
  agreement: '/pkg-about/about/protocol',
  appPermission: '/pkg-about/about/app-permission/index',
}

/** 共享屏通知键 ↔ 后端 /notifications/preferences 字段(三键同源,非新概念)。 */
const NOTIF_FIELD: Record<NotifKey, keyof NotificationPreferences> = {
  push: 'pushEnabled',
  message: 'inAppEnabled',
  email: 'emailEnabled',
}

/** 手机号脱敏:不足 11 位视为未绑定(与页内旧 IIFE 同口径,导出仅为测试可钉)。 */
export function maskPhone(phone: string | undefined, fallback = '未绑定'): string {
  const p = (phone || '').trim()
  if (!p || p.length < 11) return fallback
  return p.slice(0, 3) + '****' + p.slice(-4)
}

export default function Settings() {
  const { t, locale, setLocale } = useI18n()
  const tt = useTt()
  const gate = useAuthReadyGate()
  const { themeMode, resolvedTheme, setThemeMode } = useTheme()
  const [user, setUser] = useState<Partial<UserInfo>>({})
  const [notifications, setNotifications] = useState<SharedNotificationToggles>({
    push: true,
    message: true,
    email: false,
  })
  const appVersion = getMiniappVersion()

  const maskedPhone = maskPhone(user.phone, tt('setting.unboundPhone', '未绑定'))

  const load = useCallback(async () => {
    try {
      setUser(await getProfile())
    } catch (e) {
      logger.error('user/settings', '获取用户信息', e)
    }
    try {
      const prefs = await getNotificationPreferences()
      setNotifications({
        push: prefs.pushEnabled,
        message: prefs.inAppEnabled,
        email: prefs.emailEnabled,
      })
    } catch (e) {
      logger.error('user/settings', '获取通知偏好', e)
    }
  }, [])

  useDidShow(() => {
    gate.waitUntilReady(() => {
      void load()
    })
  })

  const navigate = useCallback((url: string) => {
    Taro.navigateTo({ url })
  }, [])

  const onMenuPress = useCallback(
    (key: string) => {
      const url = MENU_ROUTES[key]
      if (url) navigate(url)
    },
    [navigate],
  )

  const onSelectLocale = useCallback(
    (value: string) => {
      if (value === locale) return
      setLocale(value as Locale)
      setLanguage(value).catch((e) => {
        logger.error('user/settings', '设置语言', e)
        onToast(tt('setting.operationFailed', '操作失败'), { kind: 'error' })
      })
    },
    [locale, setLocale, tt],
  )

  const onSelectTheme = useCallback(
    (value: string) => {
      if (value === themeMode) return
      setThemeMode(value as 'light' | 'dark' | 'system')
      // 端内偏好存 'auto'|'light'|'dark'(setting/theme.tsx 同法),system ↔ auto 仅此处映射
      setTheme(value === 'system' ? 'auto' : value).catch((e) => {
        logger.error('user/settings', '设置主题', e)
        onToast(tt('setting.operationFailed', '操作失败'), { kind: 'error' })
      })
    },
    [themeMode, setThemeMode, tt],
  )

  const onToggleNotification = useCallback(
    (key: NotifKey, value: boolean) => {
      const previous = notifications
      setNotifications((prev) => ({ ...prev, [key]: value }))
      updateNotificationPreferences({ [NOTIF_FIELD[key]]: value }).catch((e) => {
        logger.error('user/settings', '更新通知偏好', e)
        setNotifications(previous)
        onToast(tt('setting.operationFailed', '操作失败'), { kind: 'error' })
      })
    },
    [notifications, tt],
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

  const onAlert = useCallback((title: string) => {
    onToast(title)
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

  const onLogout = useCallback(async () => {
    try {
      await logout()
    } catch (e) {
      logger.error('user/settings', '退出登录', e)
    }
    // 登出接口只吊销服务端会话;清凭据 + 落登出标记必须成对执行
    clearAuth()
    goToLogin()
  }, [])

  const localeOptions: SharedLocaleOption[] = [
    { value: 'zh-CN', label: tt('legal.supportedRegions.languageZhCN', '简体中文') },
    { value: 'zh-TW', label: tt('legal.supportedRegions.languageZhTW', '繁體中文') },
    { value: 'en', label: tt('legal.supportedRegions.languageEN', 'English') },
    { value: 'ko', label: tt('legal.supportedRegions.languageKO', '한국어') },
    { value: 'ja', label: tt('legal.supportedRegions.languageJA', '日本語') },
  ]

  const themeOptions: SharedThemeOption[] = [
    { value: 'light', label: tt('themeToggle.lightMode', '浅色模式') },
    { value: 'dark', label: tt('themeToggle.darkMode', '深色模式') },
    { value: 'system', label: tt('settings.themeSystem', '跟随系统') },
  ]

  const menuItems: SharedMenuItem[] = [
    {
      key: 'changePhone',
      label: `${tt('setting.changePhone', '更换手机号')}（${maskedPhone}）`,
    },
    { key: 'realname', label: tt('setting.realNameAuth', '实名认证') },
    { key: 'email', label: tt('setting.emailBinding', '邮箱绑定') },
    { key: 'accountCancel', label: tt('setting.accountCancel', '账号注销') },
    { key: 'cache', label: tt('setting.clearCache', '清除缓存') },
    { key: 'feedback', label: tt('setting.feedback', '意见反馈') },
    { key: 'about', label: tt('setting.aboutUs', '关于我们') },
    { key: 'announcement', label: tt('announcement.title', '平台公告') },
    { key: 'activity', label: tt('activity.title', '平台活动') },
    { key: 'aiSkill', label: tt('aiSkill.title', 'AI 技能') },
    { key: 'privacy', label: tt('setting.privacyPolicy', '隐私政策') },
    { key: 'agreement', label: tt('setting.userAgreement', '用户协议') },
    { key: 'appPermission', label: tt('setting.appPermission', '应用权限') },
  ]

  return (
    <ThemeRoot>
      <SharedSettingsScreen
        t={t}
        user={
          user.id
            ? {
                id: user.id,
                nickname: user.nickname,
                avatar: user.avatar ?? null,
                email: user.email,
                phone: user.phone,
              }
            : null
        }
        locale={locale}
        localeOptions={localeOptions}
        onSelectLocale={onSelectLocale}
        theme={themeMode}
        themeOptions={themeOptions}
        onSelectTheme={onSelectTheme}
        notifications={notifications}
        onToggleNotification={onToggleNotification}
        onEditProfile={() => navigate('/pkg-user/user/profile')}
        onChangePassword={onChangePassword}
        onAlert={onAlert}
        onConfirm={onConfirm}
        onLogout={onLogout}
        menuItems={menuItems}
        onMenuPress={onMenuPress}
        appVersion={appVersion}
        onBack={() => void Taro.navigateBack()}
        colorScheme={resolvedTheme}
      />
    </ThemeRoot>
  )
}
