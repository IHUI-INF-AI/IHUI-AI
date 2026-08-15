import './global.css'
import { useEffect, useState } from 'react'
import { AppRegistry, Platform, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native'
import { StatusBar } from 'expo-status-bar'
import { AuthProvider } from './src/context/AuthContext'
import { ThemeProvider, useTheme } from './src/context/ThemeContext'
import { I18nProvider } from './src/i18n'
import { NetworkProvider, useNetwork } from './src/context/NetworkContext'
import { OfflineBanner } from './src/components/OfflineBanner'
import { RootNavigator } from './src/navigation/RootNavigator'
import { linking } from './src/navigation/linking'
import { registerWechat } from './src/lib/wechat'
import {
  subscribeOAuthDeepLink,
  getInitialOAuthDeepLink,
  type OAuthRedirectResult,
} from './src/lib/oauth-deeplink'
import { rnAuthStore } from './src/stores/auth-store'
import type { LoginResult } from '@ihui/api-client'
import { GlobalFloatBox } from './src/components/GlobalFloatBox'
import { PrivacyPolicyModal } from './src/components/PrivacyPolicyModal'
import { PRIVACY_POLICY_STORAGE_KEY } from './src/constants/privacyPolicy'

function ThemedNavigation() {
  const { resolvedTheme } = useTheme()
  return (
    <NavigationContainer
      linking={linking}
      theme={resolvedTheme === 'dark' ? DarkTheme : DefaultTheme}
    >
      {/* BISECT-3: RootNavigator 替换为空 View */}
      <View style={{ flex: 1, backgroundColor: 'seagreen' }} />
    </NavigationContainer>
  )
}

function AppInner() {
  const { isOnline } = useNetwork()
  return (
    <>
      <OfflineBanner isOnline={isOnline} />
      <ThemedNavigation />
    </>
  )
}

/**
 * 将 OAuth deep link 换取的 JWT 写入 rnAuthStore(与 AuthContext.applySsoCode 同语义)。
 *
 * App.tsx 位于 AuthProvider 之外,无法用 useAuth(),但 rnAuthStore 是 zustand 实例,
 * 可直接 import 调用,跨组件树更新认证态(AuthContext 订阅同一 store,会自动重渲染)。
 */
async function applyOAuthResult(result: OAuthRedirectResult): Promise<void> {
  if (!result.success || !result.data) return
  const { accessToken, refreshToken, user }: LoginResult = result.data
  await rnAuthStore.getState().setAuth({ token: accessToken, refreshToken, user })
}

function AppContent() {
  const { resolvedTheme } = useTheme()

  // 隐私政策弹窗:App 启动时检查 AsyncStorage,未同意 → 显示弹窗 + 阻止 SDK 初始化。
  // 1:1 复刻 Uniapp App.vue onLaunch 行 146-163 的 privacyPolicyAccepted 逻辑;
  // SDK 初始化阻止本任务用 console.info 占位,实际初始化是后续任务。
  const [showPrivacy, setShowPrivacy] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const accepted = await AsyncStorage.getItem(PRIVACY_POLICY_STORAGE_KEY)
        if (accepted === 'true') {
          console.info('[App] 用户已同意隐私政策,可以初始化 SDK')
        } else {
          console.info('[App] 用户未同意隐私政策,显示隐私政策弹窗')
          setShowPrivacy(true)
        }
      } catch (error) {
        // AsyncStorage 读取失败(极罕见),降级显示弹窗让用户重新同意
        console.warn('[App] 读取隐私政策同意状态失败,降级显示弹窗', error)
        setShowPrivacy(true)
      }
    })()
  }, [])

  const handlePrivacyAgree = async () => {
    try {
      await AsyncStorage.setItem(PRIVACY_POLICY_STORAGE_KEY, 'true')
    } catch (error) {
      console.warn('[App] 写入隐私政策同意状态失败', error)
    }
    setShowPrivacy(false)
    console.info('[App] 用户已同意隐私政策,触发 onPrivacyAccepted,开始初始化 SDK')
  }

  // 初始化微信 SDK + OAuth deep link 监听(ihui://oauth/callback?platform=xxx&code=xxx&state=xxx)
  // 与 SSO deep link(ihui://sso/callback)互不干扰,后者由 AuthContext 监听
  useEffect(() => {
    let unsubOAuth: (() => void) | null = null
    void registerWechat()

    // 冷启动时检查 OAuth deep link + 运行时监听
    void (async () => {
      const initial = await getInitialOAuthDeepLink()
      if (initial) await applyOAuthResult(initial)

      unsubOAuth = subscribeOAuthDeepLink(async (result) => {
        await applyOAuthResult(result)
      })
    })()

    return () => {
      if (unsubOAuth) unsubOAuth()
    }
  }, [])

  return (
    <View className={resolvedTheme === 'dark' ? 'dark' : ''} style={{ flex: 1 }}>
      <SafeAreaProvider>
        <I18nProvider>
          <AuthProvider>
            <NetworkProvider>
              <AppInner />
            </NetworkProvider>
          </AuthProvider>
        </I18nProvider>
        <StatusBar style="auto" />
      </SafeAreaProvider>
      {/* 全局浮窗:推广/咨询/更多,覆盖在 RootNavigator 之上(右下角悬浮) */}
      <GlobalFloatBox />
      <PrivacyPolicyModal visible={showPrivacy} onAgree={handlePrivacyAgree} />
    </View>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  )
}

// 显式注册 main 组件（Expo CLI 的 .expo/.virtual-metro-entry 虚拟入口在当前
// pnpm isolated monorepo 环境下未正确注入 registerRootComponent 调用，
// 导致 RN 运行时报 "main" has not been registered。这里手动注册兜底。）
AppRegistry.registerComponent('main', () => App)

// Web 平台需要显式调用 runApplication 挂载到 DOM（原生平台由原生代码自动调用，
// index.js 注释已说明；web 平台无原生代码，react-native-web 不会自动 runApplication）。
if (Platform.OS === 'web') {
  AppRegistry.runApplication('main', {
    rootTag: document.getElementById('root'),
  })
}
