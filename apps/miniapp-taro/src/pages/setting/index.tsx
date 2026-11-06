// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 薄壳:渲染全部委托共享屏 packages/app/src/features/settings/SettingsScreen.tsx
// (RN 端消费点 apps/mobile-rn/src/screens/SettingsScreen.tsx:333 同屏)。
// 端内保留:① getProfile 取用户卡;② 语言/主题偏好的落库与广播(setLanguage/setTheme/setThemeMode);
// ③ 通知三键 GET/PUT;④ 修改密码 API;⑤ 退出登录(登出接口 + clearAuth + goToLogin);⑥ 菜单行跳转。
// 删除 ./parts(RowsSection/NotificationSection/PasswordModal):三段均为共享屏同段,页面不再自绘。
import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useState } from 'react'
import { useI18n, type Locale } from '@/i18n'
import { useTt } from '@/i18n'
import {
  changePassword,
  getNotificationSettings,
  getProfile,
  logout,
  setLanguage,
  setTheme,
  updateNotificationSettings,
  type UserInfo,
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

/** 菜单行:仅保留共享屏没有的入口(语言/主题/通知开关/修改密码/退出已在共享屏内)。 */
const MENU_ROUTES: Readonly<Record<string, string>> = {
  accountCancel: '/pkg-user/account-cancel/index/index',
  notification: '/pages/setting/notification',
  cache: '/pages/setting/cache',
  feedback: '/pkg-user/user/feedback',
  privacy: '/pages/setting/privacy',
  web: '/pkg-about/about/web-portal/index',
  about: '/pkg-about/about/index',
}

export default function SettingIndexPage() {
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

  const load = useCallback(async () => {
    try {
      setUser(await getProfile())
    } catch (e) {
      logger.error('setting/index', '获取用户信息', e)
      onToast(tt('setting.operationFailed', '操作失败'), { kind: 'error' })
    }
  }, [tt])

  const loadNotifications = useCallback(async () => {
    try {
      const res = await getNotificationSettings()
      setNotifications((prev) => {
        const next = { ...prev }
        for (const item of res.list || []) {
          if (item.key === 'push' || item.key === 'message' || item.key === 'email') {
            next[item.key] = item.enabled
          }
        }
        return next
      })
    } catch (e) {
      // 取不到保持默认值渲染:开关仍在、交互仍在,只记日志不打断页面
      logger.error('setting/index', '获取通知设置', e)
    }
  }, [])

  // G-933 冷启动抢跑门控:profile 与通知设置两支 GET 均需鉴权
  useDidShow(() => {
    gate.waitUntilReady(() => {
      void load()
      void loadNotifications()
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
        logger.error('setting/index', '设置语言', e)
        onToast(tt('setting.operationFailed', '操作失败'), { kind: 'error' })
      })
    },
    [locale, setLocale, tt],
  )

  const onSelectTheme = useCallback(
    (value: string) => {
      if (value === themeMode) return
      setThemeMode(value as 'light' | 'dark' | 'system')
      // 端内偏好存 'auto'|'light'|'dark',与 RN 的 'system' 是本端既有对照(setting/theme.tsx 同法)
      setTheme(value === 'system' ? 'auto' : value).catch((e) => {
        logger.error('setting/index', '设置主题', e)
        onToast(tt('setting.operationFailed', '操作失败'), { kind: 'error' })
      })
    },
    [themeMode, setThemeMode, tt],
  )

  const onToggleNotification = useCallback(
    (key: NotifKey, value: boolean) => {
      const previous = notifications
      setNotifications((prev) => ({ ...prev, [key]: value }))
      updateNotificationSettings({ [key]: value }).catch((e) => {
        logger.error('setting/index', '更新通知设置', e)
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
      logger.error('setting/index', '修改密码', e)
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
      logger.error('setting/index', '退出登录', e)
    }
    // 登出接口只吊销服务端会话;清凭据 + 落登出标记必须成对执行(原页注释同款约束)
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
    { key: 'accountCancel', label: tt('setting.accountCancel', '账号注销') },
    { key: 'notification', label: tt('setting.notificationSetting', '通知设置') },
    { key: 'cache', label: tt('setting.clearCache', '清除缓存') },
    { key: 'feedback', label: tt('setting.feedback', '意见反馈') },
    { key: 'privacy', label: tt('setting.privacyPermission', '隐私与权限') },
    { key: 'web', label: tt('setting.webPortal', '网页版功能') },
    { key: 'about', label: tt('setting.aboutUs', '关于我们') },
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
        colorScheme={resolvedTheme}
      />
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
