// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import './global.css'
import { useEffect } from 'react'
import { Platform, Text, TextInput, View } from 'react-native'
import { useFonts } from 'expo-font'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native'
import { StatusBar } from 'expo-status-bar'
import { AuthProvider } from './src/context/AuthContext'
import { useTheme } from './src/context/ThemeContext'
import { I18nProvider } from './src/i18n'
import { NetworkProvider, useNetwork } from './src/context/NetworkContext'
import { OfflineBanner } from './src/components/OfflineBanner'
import { RootNavigator } from './src/navigation/RootNavigator'
import { linking } from './src/navigation/linking'
import { navigationRef, navigateTo } from './src/navigation/navigation-ref'
import { registerWechat } from './src/lib/wechat'
import {
  subscribeOAuthDeepLink,
  getInitialOAuthDeepLink,
  type OAuthRedirectResult,
} from './src/lib/oauth-deeplink'
import { rnAuthStore } from './src/stores/auth-store'
import type { LoginResult } from '@ihui/api-client'
import { GlobalFloatBox } from './src/components/GlobalFloatBox'
import './src/lib/web-shell'

/**
 * 全局默认字体:阿里妈妈方圆体(对齐 D 盘 uniapp Ai-WXMiniVue 的 App.vue 全局字体)。
 * PostScript name = AlimamaFangYuanTiVF-Thin(见 assets/fonts/AlimamaFangYuanTiVF-Thin.ttf)。
 * 通过 defaultProps.style 注入,所有未显式指定 fontFamily 的 Text/TextInput 默认走此字体;
 * 显式 style 中的 fontFamily 优先级更高,不受影响。
 */
const GLOBAL_FONT_FAMILY = 'AlimamaFangYuanTiVF-Thin'
// 注入全局默认字体（React Native 限制，defaultProps 需要 any 断言）
/* eslint-disable @typescript-eslint/no-explicit-any */
;(Text as any).defaultProps = {
  ...(Text as any).defaultProps,
  style: { fontFamily: GLOBAL_FONT_FAMILY },
}
;(TextInput as any).defaultProps = {
  ...(TextInput as any).defaultProps,
  style: { fontFamily: GLOBAL_FONT_FAMILY },
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function ThemedNavigation() {
  const { resolvedTheme } = useTheme()
  return (
    <NavigationContainer
      ref={navigationRef}
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

  // 浮窗跳转:目标页(赚米→推广/客服/反馈)需登录,未登录先引导到登录页
  const goFloat = (name: 'Promote' | 'CustomerService' | 'Feedback'): void => {
    if (rnAuthStore.getState().token) {
      navigateTo(name)
    } else {
      navigateTo('Login')
    }
  }

  return (
    <View className={resolvedTheme === 'dark' ? 'dark' : ''} style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
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
      {/* 全局浮窗:赚米/客服/反馈,覆盖在 RootNavigator 之上(右下角悬浮)。
          对齐历史 Uniapp FloatBox.vue:靠右竖条 + 左滑展开,非箭头按钮显隐。
          未登录时这三个功能页不在导航器里(token 条件分支),先引导到登录页。 */}
      <GlobalFloatBox
        onPromote={() => goFloat('Promote')}
        onConsult={() => goFloat('CustomerService')}
        onFeedback={() => goFloat('Feedback')}
      />
    </View>
  )
}

export default function App() {
  // 加载阿里妈妈方圆体(对齐 uniapp)。Web 端 expo-av useFonts 在字体 URL 404/CORS/解析失败时
  // 会永远停留在未加载状态,导致整棵树 return null → 灰屏(2026-09-05 修复):
  // Web 端浏览器有系统字体兜底,字体加载失败不阻塞渲染;原生端保持原逻辑。
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fontAsset = require('./assets/fonts/AlimamaFangYuanTiVF-Thin.ttf')
  const [fontsLoaded, fontError] = useFonts({
    'AlimamaFangYuanTiVF-Thin': fontAsset,
  })
  if (!fontsLoaded && !(Platform.OS === 'web' && fontError)) return null
  return (
    <AppContent />
  )
}

// 组件注册与挂载由 Expo 虚拟入口(.expo/.virtual-metro-entry)统一处理:
// 它 import 本模块(default export App)后自行调用 AppRegistry.registerComponent('main')
// + runApplication。此前(2026-09-05)在此手动补 registerComponent/runApplication 兜底,
// 结果与虚拟入口重复挂载 → ReactDOM createRoot 冲突 + NavigationContainer/linking 双实例
// ("linking configured in multiple places")→ 页面白屏。真正的黑屏根因是 RootNavigator
// 引用了未 import 的 Screen(UserOrderListScreen 等)导致渲染抛错,已在 RootNavigator 修复。
// 故此处不再手动挂载。
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
