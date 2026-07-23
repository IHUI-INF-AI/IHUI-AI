import { useState } from 'react'
import { Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { SettingsScreen as SharedSettingsScreen } from '@ihui/app'
import type {
  SharedLocaleOption,
  SharedThemeOption,
  SharedMenuItem,
  SharedNotificationToggles,
} from '@ihui/app'
import { updatePassword } from '@ihui/api-client'
import { useAuth } from '../context/AuthContext'
import { useI18n, type Locale } from '../i18n'
import type { ProfileStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<ProfileStackParamList>

type ThemeKey = 'light' | 'dark' | 'system'

const APP_VERSION = '1.0.0'

/**
 * RN 端 Settings 包装器 — 注入 t + Alert/Confirm + 真实 updatePassword API + 导航,
 * 渲染共享 SettingsScreen(内置密码修改 Modal UI + 校验逻辑)。
 */
export default function SettingsScreen() {
  const { t, locale, setLocale } = useI18n()
  const { user, logout } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [theme, setTheme] = useState<ThemeKey>('system')
  const [notifications, setNotifications] = useState<SharedNotificationToggles>({
    push: true,
    message: true,
    email: false,
  })

  const localeOptions: SharedLocaleOption[] = [
    { value: 'zh-CN', label: t('settings.lang_zhCN') },
    { value: 'en', label: t('settings.lang_en') },
    { value: 'ja', label: t('settings.lang_ja') },
    { value: 'ko', label: t('settings.lang_ko') },
    { value: 'zh-TW', label: t('settings.lang_zhTW') },
  ]

  const themeOptions: SharedThemeOption[] = [
    { value: 'light', label: t('settings.theme_light') },
    { value: 'dark', label: t('settings.theme_dark') },
    { value: 'system', label: t('settings.theme_system') },
  ]

  const menuItems: SharedMenuItem[] = [
    { key: 'About', label: t('menu.about') },
    { key: 'Feedback', label: t('menu.feedback') },
    { key: 'Privacy', label: t('menu.privacy') },
    { key: 'Agreement', label: t('menu.agreement') },
  ]

  const onSelectLocale = (v: string) => {
    if (v === locale) return
    void setLocale(v as Locale)
    Alert.alert(t('settings.languageChanged'))
  }

  const onSelectTheme = (v: string) => {
    setTheme(v as ThemeKey)
    Alert.alert(t('settings.themeChanged'))
  }

  const onToggleNotification = (key: keyof SharedNotificationToggles, value: boolean) => {
    setNotifications((prev) => ({ ...prev, [key]: value }))
  }

  const onChangePassword = async (oldPwd: string, newPwd: string): Promise<boolean> => {
    const res = await updatePassword({ oldPassword: oldPwd, newPassword: newPwd })
    return res.success
  }

  const onAlert = (title: string, message?: string) => {
    Alert.alert(title, message)
  }

  const onConfirm = (title: string, message: string, onOk: () => void) => {
    Alert.alert(title, message, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.confirm'), style: 'destructive', onPress: onOk },
    ])
  }

  const onMenuPress = (key: string) => {
    // 目标路由(About/Feedback/Privacy/Agreement)在 RootStack 而非 ProfileStack,
    // 需通过 getParent() 跨栈导航;as never 因跨栈类型推断复杂而保留
    navigation.getParent()?.navigate(key as never)
  }

  return (
    <SharedSettingsScreen
      t={t}
      user={
        user
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
      theme={theme}
      themeOptions={themeOptions}
      onSelectTheme={onSelectTheme}
      notifications={notifications}
      onToggleNotification={onToggleNotification}
      onEditProfile={() => navigation.navigate('ProfileEdit' as never)}
      onChangePassword={onChangePassword}
      onAlert={onAlert}
      onConfirm={onConfirm}
      onLogout={() => void logout()}
      menuItems={menuItems}
      onMenuPress={onMenuPress}
      appVersion={APP_VERSION}
    />
  )
}
