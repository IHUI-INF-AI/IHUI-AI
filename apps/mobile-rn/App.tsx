import './global.css'
import { useEffect } from 'react'
import { AppRegistry, Platform, Text, TextInput, View } from 'react-native'
import { useFonts } from 'expo-font'
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

/**
 * 全局默认字体:阿里妈妈方圆体(对齐 D 盘 uniapp Ai-WXMiniVue 的 App.vue 全局字体)。
 * PostScript name = AlimamaFangYuanTiVF-Thin(见 assets/fonts/AlimamaFangYuanTiVF-Thin.ttf)。
 * 通过 defaultProps.style 注入,所有未显式指定 fontFamily 的 Text/TextInput 默认走此字体;
 * 显式 style 中的 fontFamily 优先级更高,不受影响。
 */
const GLOBAL_FONT_FAMILY = 'AlimamaFangYuanTiVF-Thin'
// 注入全局默认字体（React Native 限制，defaultProps 需要 any 断言）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(Text as any).defaultProps = { ...(Text as any).defaultProps, style: { fontFamily: GLOBAL_FONT_FAMILY } }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(TextInput as any).defaultProps = { ...(TextInput as any).defaultProps, style: { fontFamily: GLOBAL_FONT_FAMILY } }

function ThemedNavigation() {
  const { resolvedTheme } = useTheme()
  return (
    <NavigationContainer
      linking={linking}
      theme={resolvedTheme === 'dark' ? DarkTheme : DefaultTheme}
    >
      <RootNavigator />
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
    </View>
  )
}

export default function App() {
  // 加载阿里妈妈方圆体(对齐 uniapp);未加载完返回 null 避免字体闪烁
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const [fontsLoaded] = useFonts({
    'AlimamaFangYuanTiVF-Thin': require('./assets/fonts/AlimamaFangYuanTiVF-Thin.ttf'),
  })
  if (!fontsLoaded) return null
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
