import { useState } from 'react'
import { Alert, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { SettingsScreen as SharedSettingsScreen } from '@ihui/rn-app'
import type {
  SharedLocaleOption,
  SharedThemeOption,
  SharedMenuItem,
  SharedNotificationToggles,
} from '@ihui/rn-app'
import { updatePassword } from '@ihui/api-client'
import SideMenu, { type SideMenuItem } from '../components/SideMenu'
import { NavBar, type NavBarAction } from '../components/NavBar'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useI18n, type Locale } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Settings'>

const APP_VERSION = '1.0.2'

/**
 * RN 端 Settings 包装器 — 注入 t + Alert/Confirm + 真实 updatePassword API + 导航,
 * 渲染共享 SettingsScreen(内置密码修改 Modal UI + 校验逻辑)。
 */
export default function SettingsScreen() {
  const { t, locale, setLocale } = useI18n()
  const { user, logout } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const { themeMode, setThemeMode, resolvedTheme } = useTheme()
  const [notifications, setNotifications] = useState<SharedNotificationToggles>({
    push: true,
    message: true,
    email: false,
  })
  const [drawerVisible, setDrawerVisible] = useState(false)

  // 右侧菜单按钮(对齐 Uniapp settings 使用 ☰ 触发 Drawer 集成)
  const rightActions: ReadonlyArray<NavBarAction> = [
    {
      icon: '☰',
      label: t('common.menu'),
      onPress: () => setDrawerVisible(true),
    },
  ]

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

  // 菜单项分组:账号与安全 / 通用设置 / 帮助与反馈 / 隐私与权限 / 关于
  const menuItems: SharedMenuItem[] = [
    // 账号与安全
    { key: 'SettingsAccount', label: t('menu.accountManage') },
    { key: 'ChangePhone', label: t('menu.changePhone') },
    { key: 'ChangePwd', label: t('menu.changePwd') },
    { key: 'AccountCancel', label: t('menu.accountCancel') },
    // 通用设置
    { key: 'CheckUpdate', label: t('menu.checkUpdate') },
    // 帮助与反馈
    { key: 'Feedback', label: t('menu.feedback') },
    // 隐私与权限
    { key: 'Agreement', label: t('menu.agreement') },
    { key: 'Privacy', label: t('menu.privacy') },
    { key: 'AppPermission', label: t('menu.appPermission') },
    { key: 'UsageRules', label: t('menu.usageRules') },
    // 关于
    { key: 'BusinessLicense', label: t('menu.businessLicense') },
    { key: 'IcpRecord', label: t('menu.icpRecord') },
    { key: 'ModelRecord', label: t('menu.modelRecord') },
    { key: 'About', label: t('menu.about') },
  ]

  const drawerMenuItems: SideMenuItem[] = [
    { key: 'SettingsAccount', label: t('menu.accountManage'), icon: '👤' },
    { key: 'ChangePhone', label: t('menu.changePhone'), icon: '📱' },
    { key: 'ChangePwd', label: t('menu.changePwd'), icon: '🔑' },
    { key: 'AccountCancel', label: t('menu.accountCancel'), icon: '⚠' },
    { key: 'CheckUpdate', label: t('menu.checkUpdate'), icon: '🔄' },
    { key: 'Feedback', label: t('menu.feedback'), icon: '✎' },
    { key: 'Agreement', label: t('menu.agreement'), icon: '📄' },
    { key: 'Privacy', label: t('menu.privacy'), icon: '🔒' },
    { key: 'AppPermission', label: t('menu.appPermission'), icon: '🛡' },
    { key: 'UsageRules', label: t('menu.usageRules'), icon: '📋' },
    { key: 'BusinessLicense', label: t('menu.businessLicense'), icon: '🏛' },
    { key: 'IcpRecord', label: t('menu.icpRecord'), icon: '🌐' },
    { key: 'ModelRecord', label: t('menu.modelRecord'), icon: '🤖' },
    { key: 'About', label: t('menu.about'), icon: 'ℹ' },
  ]

  const onSelectLocale = (v: string) => {
    if (v === locale) return
    void setLocale(v as Locale)
    Alert.alert(t('settings.languageChanged'))
  }

  const onSelectTheme = (v: string) => {
    setThemeMode(v as 'light' | 'dark' | 'system')
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
    // 检查更新:不跳转,直接弹窗提示
    if (key === 'CheckUpdate') {
      Alert.alert('检查更新', '当前已是最新版本')
      return
    }
    // 更换手机号:ChangePhone 路由需要 { uuid } 参数(取 user.id)
    if (key === 'ChangePhone') {
      if (!user?.id) {
        Alert.alert(t('common.error'), '用户信息缺失,无法更换手机号')
        return
      }
      navigation.getParent()?.navigate('ChangePhone', { uuid: user.id })
      return
    }
    // 目标路由(About/Feedback/Privacy/Agreement 等)在 RootStack 而非 ProfileStack,
    // 需通过 getParent() 跨栈导航
    navigation.getParent()?.navigate(key as never)
  }

  const onDrawerItemPress = (key: string) => {
    // Drawer 内菜单点击复用 onMenuPress 的跨栈导航逻辑
    onMenuPress(key)
  }

  return (
    <View style={{ flex: 1 }}>
      <NavBar
        title={t('settings.title')}
        onBack={() => navigation.goBack()}
        rightActions={rightActions}
      />
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
        theme={themeMode}
        themeOptions={themeOptions}
        onSelectTheme={onSelectTheme}
        colorScheme={resolvedTheme}
        notifications={notifications}
        onToggleNotification={onToggleNotification}
        onEditProfile={() => navigation.navigate('ProfileEdit')}
        onChangePassword={onChangePassword}
        onAlert={onAlert}
        onConfirm={onConfirm}
        onLogout={() =>
          onConfirm(t('common.logout'), '确认退出当前账号？', () => void logout())
        }
        menuItems={menuItems}
        onMenuPress={onMenuPress}
        appVersion={APP_VERSION}
        onBack={() => navigation.goBack()}
      />
      <SideMenu
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        items={drawerMenuItems}
        onSelect={onDrawerItemPress}
      />
    </View>
  )
}
