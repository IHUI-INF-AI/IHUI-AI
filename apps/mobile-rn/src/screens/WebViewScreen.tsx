// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, BackHandler, Text, TouchableOpacity, View } from 'react-native'
import WebViewRN, { type WebViewNavigation } from 'react-native-webview'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { generateSsoCode } from '@ihui/api-client'
import { tokens } from '../theme/active-tokens'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { useAuthStore } from '../stores/auth-store'
import { WEB_BASE_URL, toSsoRedirectUri } from '../lib/webview-portal-config'
import { ensureFreshToken } from '../lib/token'
import { isTrustedWebviewUrl } from '@ihui/shared'
import { canStepBackInAdminHistory } from '../lib/webview-history'
import { useWebviewLoadWatchdog } from '../hooks/use-webview-load-watchdog'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { BackChevron } from '@ihui/rn-app'

// react-native-webview 的类型把带 ref 的 props 折叠成 never,这里按运行时能力声明句柄
type WebViewHandle = {
  canGoBack: () => boolean
  goBack: () => void
  reload: () => void
  stopLoading: () => void
  injectJavaScript: (script: string) => void
}
const WebView = WebViewRN as any

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
type RouteProps = RouteProp<RootStackParamList, 'WebView'>

/**
 * 管理后台在手机档的注入修补(2026-11-23)。
 *
 * 三件事都在**页面水合之后**才成立,所以靠 MutationObserver 在窗口内随 DOM 变化重跑:
 *  ① 隐藏只在桌面档出现的 AI 抽屉,分类页才是可见表面;
 *  ② 分类卡片窄屏强制单列,名称不缩成「管…」;
 *  ③ 解除卡片文字的 truncate / 省略号。
 * 页面卸载时 disconnect,不留观察者。
 */
const ADMIN_WEBVIEW_MOBILE_FIX = `(function () {
  try {
    var style = document.createElement('style');
    style.textContent = '.ai-panel-root{display:none!important;} [data-admin-category-grid] span,[data-admin-category-card] span{white-space:normal!important;text-overflow:clip!important;}';
    document.head.appendChild(style);
    var path = location.pathname;
    if (path === '/domains/admin' || path.indexOf('/domains/') === 0 || path === '/admin' || path.indexOf('/admin/') === 0) {
      var apply = function () {
        var grid = document.querySelector('[data-admin-category-grid]');
        if (grid) {
          grid.style.gridTemplateColumns = 'minmax(0, 1fr)';
          grid.style.gap = '12px';
        }
        var cards = document.querySelectorAll('[data-admin-category-card], [data-admin-category-grid] a, [data-admin-category-grid] button');
        for (var i = 0; i < cards.length; i++) {
          var label = cards[i].querySelector('span, div');
          if (!label) continue;
          label.style.whiteSpace = 'normal';
          label.style.whiteSpace = 'normal!important';
          label.style.textOverflow = 'clip';
          label.style.textOverflow = 'clip!important';
          label.style.overflow = 'visible';
        }
      };
      apply();
      var observer = new MutationObserver(function () { apply(); });
      observer.observe(document.body, { childList: true, subtree: true });
      window.addEventListener('beforeunload', function () { observer.disconnect(); });
    }
  } catch (e) {}
})();`

/**
 * 通用 WebView 承载页(M4 方案,2026-08-26 立;App→Web 会话打通 2026-08-27 增补)
 *
 * 用途:移动端无法原生实现的复杂页面(管理后台、营销大屏、家长端、H5 活动页等)
 * 通过本页内嵌 WebView 访问,复用 web 端既有实现。
 *
 * 会话打通:已登录时先调 /api/auth/sso/code 生成 30s 一次性授权码,改走
 * <目标origin>/sso/mobile-auth?sso_code=xxx&redirect=<url>;未登录 / 授权码失败直开。
 */
export function WebViewScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<RouteProps>()
  const { url, title } = route.params
  const token = useAuthStore((s) => s.token)
  const [sourceUri, setSourceUri] = useState(url)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [reloadNonce, setReloadNonce] = useState(0)
  const webViewRef = useRef<WebViewHandle | null>(null)
  const navHistoryRef = useRef<string[]>([url])
  const hasLoadedRef = useRef(false)
  const dark = resolvedTheme === 'dark'

  /** 签发前的信任闸 + 每次重试都重新换码(不得重放已过期的一次性会话码) */
  const buildSourceUri = useCallback(async (): Promise<string> => {
    await ensureFreshToken()
    if (!token || !isTrustedWebviewUrl(url)) return url
    let origin = WEB_BASE_URL
    try {
      origin = new URL(url).origin
    } catch {
      // url 非法时用门户 base
    }
    try {
      const res = await generateSsoCode('mobile-rn', toSsoRedirectUri(url))
      if (!res.success) return url
      return `${origin}/sso/mobile-auth?sso_code=${encodeURIComponent(res.data.code)}&redirect=${encodeURIComponent(url)}`
    } catch {
      return url
    }
  }, [token, url])

  useEffect(() => {
    let cancelled = false
    navHistoryRef.current = [url]
    hasLoadedRef.current = false
    setLoading(true)
    void buildSourceUri().then((next) => {
      if (!cancelled) setSourceUri(next)
    })
    return () => {
      cancelled = true
    }
  }, [buildSourceUri, url])

  const retry = useCallback(() => {
    setFailed(false)
    setLoading(true)
    void buildSourceUri().then((next) => {
      setSourceUri(next)
      setReloadNonce((n) => n + 1)
    })
  }, [buildSourceUri])

  const handleBack = useCallback(() => {
    if (canStepBackInAdminHistory(navHistoryRef.current, WEB_BASE_URL)) {
      webViewRef.current?.goBack()
      return
    }
    if (navigation.canGoBack()) {
      navigation.navigate('Main', undefined as never)
      return
    }
    navigation.goBack()
  }, [navigation])

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canStepBackInAdminHistory(navHistoryRef.current, WEB_BASE_URL)) {
        webViewRef.current?.goBack()
        return true
      }
      handleBack()
      return true
    })
    return () => sub.remove()
  }, [handleBack])

  const onNavigationStateChange = useCallback((nav: WebViewNavigation) => {
    const next = nav.url
    if (next) {
      const history = navHistoryRef.current
      if (history[history.length - 1] !== next) history.push(next)
    }
    if (nav.loading) {
      if (!hasLoadedRef.current) setLoading(true)
      setFailed(false)
    } else {
      setLoading(false)
    }
  }, [])

  const onLoadProgress = useCallback((event: { nativeEvent: { progress: number } }) => {
    // SSO 重定向链可能不触发 onLoadEnd，进度过半即收遮罩
    if (event.nativeEvent.progress < 0.5) return
    setLoading(false)
  }, [])

  const onLoadStart = useCallback(() => {
    if (!hasLoadedRef.current) {
      setLoading(true)
    }
  }, [])

  const onLoadEnd = useCallback(() => {
    hasLoadedRef.current = true
    setLoading(false)
    webViewRef.current?.injectJavaScript(ADMIN_WEBVIEW_MOBILE_FIX)
  }, [])

  const onError = useCallback(() => {
    setLoading(false)
    setFailed(true)
  }, [])

  const handleLoadTimeout = useCallback(() => {
    setLoading(false)
    setFailed(true)
    webViewRef.current?.stopLoading()
  }, [])

  useWebviewLoadWatchdog(loading, handleLoadTimeout)

  const headerTitle =
    title ||
    (() => {
      try {
        return new URL(url).host
      } catch {
        return 'Web'
      }
    })()

  return (
    <View className={`flex-1 ${dark ? 'bg-neutral-900' : 'bg-white'}`}>
      <View className="flex-row items-center justify-between px-4 pb-2 pt-3">
        <BackChevron
          onPress={handleBack}
          label={t('common.back')}
          colorScheme={resolvedTheme}
        />
        <Text
          className="max-w-[60%] truncate text-base font-medium"
          style={{ color: tokens.text.primary }}
        >
          {headerTitle}
        </Text>
        <View className="w-10" />
      </View>

      <View className="flex-1">
        <WebView
          key={`${sourceUri}#${reloadNonce}`}
          ref={webViewRef}
          source={{ uri: sourceUri }}
          style={{ flex: 1, backgroundColor: dark ? tokens.gray[900] : tokens.surface.light }}
          onNavigationStateChange={onNavigationStateChange}
          onLoadStart={onLoadStart}
          onLoadProgress={onLoadProgress}
          onLoadEnd={onLoadEnd}
          onError={onError}
          onHttpError={onError}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState={false}
          setSupportMultipleWindows={false}
        />
        {loading ? (
          <View className="absolute inset-0 items-center justify-center bg-white dark:bg-neutral-900">
            <ActivityIndicator size="large" />
            <Text className="mt-3 text-sm text-gray-500">{t('common.loading')}</Text>
          </View>
        ) : null}
        {failed ? (
          <View className="absolute inset-0 items-center justify-center bg-white dark:bg-neutral-900">
            <Text className="mb-3 text-sm text-gray-500">{t('webView.loadFailed')}</Text>
            <TouchableOpacity
              onPress={retry}
              accessibilityLabel={t('webView.retry')}
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
