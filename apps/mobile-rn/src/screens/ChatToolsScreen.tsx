// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AI 对话 / 工具 WebView 承载屏(P2-4,2026-09-02 立;补法 A:WebView 复用 web /chat)
 *
 * 背景:mobile-rn 是 8 端中唯一缺工具能力的端。web 端 /chat 承载完整 AI 对话 + 工具生态
 * (MCP 商店、连接器配置、技能面板等)。本屏用 WebView 内嵌 web /chat,自动继承全部工具能力,
 * 最省且无双端维护负担。
 *
 * 会话打通(App→Web):web /chat 以 httpOnly cookie(auth_token)鉴权,无法靠 localStorage 注入 token,
 * 故复用 M4 WebViewScreen 已落地的 SSO 一次性授权码方案——已登录时先调 /api/auth/sso/code 生成
 * 30s 一次性码,改走 <origin>/sso/mobile-auth?sso_code=xxx&redirect=/chat,由 web 端 exchange 后
 * Set-Cookie,WebView 内免登录访问;未登录 / 授权码失败降级直开(web 端登录页兜底)。
 *
 * 入口:个人中心「AI 对话 / 工具」菜单项(navigate('ChatTools'))。已登录呈现 WebView,
 * 未登录呈现引导登录的空态(不白屏)。
 *
 * 体验:loading 态、web 不可达错误态 + 重试、Android 返回键WebView 内部 canGoBack 优先 goBack。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, BackHandler, Text, TouchableOpacity, View } from 'react-native'
import WebViewRN, { type WebViewNavigation } from 'react-native-webview'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { MessagesSquare, LogIn } from 'lucide-react-native'
import { generateSsoCode } from '@ihui/api-client'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { useAuthStore } from '../stores/auth-store'
import { WEB_BASE_URL } from '../lib/webview-portal-config'
import type { RootStackParamList } from '../navigation/RootNavigator'

// react-native-webview v14 的 platform-agnostic 类型将 WebView 声明为普通
// FunctionComponent,带 ref 时 props 会被折叠为 never(本仓库 WebViewScreen 因不用 ref 而能过 typecheck)。
// 此处将组件放宽以接收 ref(运行时 Android/iOS 实现支持命令式 API),并按 v14 规范以
// onNavigationStateChange 的 nav.canGoBack 跟踪可后退态,而非已移除的 ref.canGoBack()。
type WebViewRefHandle = { canGoBack: () => boolean; goBack: () => void; reload: () => void }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const WebView = WebViewRN as any

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** web 聊天页相对路径(与 apps/web/app/(main)/chat 路由一致) */
const CHAT_PATH = '/chat'

export function ChatToolsScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const token = useAuthStore((s) => s.token)
  const webViewRef = useRef<WebViewRefHandle | null>(null)
  const [sourceUri, setSourceUri] = useState(`${WEB_BASE_URL}${CHAT_PATH}`)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  // v14 以 onNavigationStateChange 的 nav.canGoBack 跟踪可后退态(ref.canGoBack 已移除)
  const [canGoBack, setCanGoBack] = useState(false)

  const dark = resolvedTheme === 'dark'

  // App→Web 会话打通:已登录 → sso_code → mobile-auth 消费页;失败 / 未登录降级直开
  useEffect(() => {
    let cancelled = false
    if (!token) {
      setSourceUri(`${WEB_BASE_URL}${CHAT_PATH}`)
      return
    }
    const origin = WEB_BASE_URL
    void generateSsoCode('mobile-rn', `${WEB_BASE_URL}${CHAT_PATH}`)
      .then((res) => {
        if (cancelled) return
        if (res.success) {
          setSourceUri(
            `${origin}/sso/mobile-auth?sso_code=${encodeURIComponent(res.data.code)}&redirect=${encodeURIComponent(`${WEB_BASE_URL}${CHAT_PATH}`)}`,
          )
        } else {
          setSourceUri(`${WEB_BASE_URL}${CHAT_PATH}`)
        }
      })
      .catch(() => {
        if (!cancelled) setSourceUri(`${WEB_BASE_URL}${CHAT_PATH}`)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const handleBack = useCallback(() => {
    if (canGoBack && webViewRef.current) {
      webViewRef.current.goBack()
      return
    }
    navigation.goBack()
  }, [canGoBack, navigation])

  // Android 硬件返回键:WebView 内部可后退则优先后退
  useEffect(() => {
    if (!token) return
    const onHardwareBack = () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack()
        return true
      }
      return false
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack)
    return () => sub.remove()
  }, [token, canGoBack])

  const onNavigationStateChange = useCallback((nav: WebViewNavigation) => {
    setCanGoBack(nav.canGoBack)
    if (nav.loading) {
      setFailed(false)
    } else {
      setLoading(false)
    }
  }, [])

  const onError = useCallback(() => {
    setLoading(false)
    setFailed(true)
  }, [])

  // 未登录:引导登录空态(不白屏)
  if (!token) {
    return (
      <View
        className={`flex-1 items-center justify-center px-8 ${dark ? 'bg-neutral-900' : 'bg-white'}`}
      >
        <View
          className={`mb-5 flex h-16 w-16 items-center justify-center rounded-2xl ${dark ? 'bg-neutral-800' : 'bg-gray-100'}`}
        >
          <MessagesSquare size={32} color={dark ? tokens.gray[200] : tokens.text.medium} />
        </View>
        <Text
          className={`text-center text-base font-semibold ${dark ? 'text-neutral-100' : 'text-gray-900'}`}
        >
          {t('webChat.title')}
        </Text>
        <Text
          className={`mt-2 text-center text-sm leading-relaxed ${dark ? 'text-neutral-400' : 'text-gray-500'}`}
        >
          {t('webChat.loginRequired')}
        </Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('Login')}
          className="mt-6 flex-row items-center gap-2 rounded-lg bg-gray-900 px-6 py-3 dark:bg-white"
          accessibilityRole="button"
        >
          <LogIn size={18} color={dark ? tokens.gray[900] : tokens.surface.light} />
          <Text className={`text-sm font-medium ${dark ? 'text-neutral-900' : 'text-white'}`}>
            {t('webChat.loginButton')}
          </Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View className={`flex-1 ${dark ? 'bg-neutral-900' : 'bg-white'}`}>
      <View className="flex-row items-center justify-between border-b border-gray-200 px-4 pb-2 pt-3 dark:border-neutral-700">
        <TouchableOpacity onPress={handleBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text className="text-sm text-gray-500">{t('common.back')}</Text>
        </TouchableOpacity>
        <Text className="max-w-[60%] truncate text-base font-medium">{t('webChat.title')}</Text>
        <View className="w-10" />
      </View>

      <View className="flex-1">
        <WebView
          key={sourceUri}
          ref={webViewRef}
          source={{ uri: sourceUri }}
          style={{ flex: 1, backgroundColor: dark ? tokens.gray[900] : tokens.surface.light }}
          onNavigationStateChange={onNavigationStateChange}
          onError={onError}
          onHttpError={onError}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          setSupportMultipleWindows={false}
        />
        {loading ? (
          <View className="absolute inset-0 items-center justify-center bg-white/70 dark:bg-neutral-900/70">
            <ActivityIndicator size="large" />
            <Text className="mt-3 text-sm text-gray-500">{t('common.loading')}</Text>
          </View>
        ) : null}
        {failed ? (
          <View className="absolute inset-0 items-center justify-center bg-white dark:bg-neutral-900">
            <Text className="mb-3 text-sm text-gray-500">{t('webView.loadFailed')}</Text>
            <TouchableOpacity
              onPress={() => {
                setFailed(false)
                setLoading(true)
                // key={sourceUri} 不变,必须显式 reload 才会真正重新加载
                webViewRef.current?.reload()
              }}
              className="rounded-md bg-gray-200 px-4 py-2"
            >
              <Text className="text-sm">{t('webView.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </View>
  )
}

export default ChatToolsScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
