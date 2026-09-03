// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'
import { WebView, type WebViewNavigation } from 'react-native-webview'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { generateSsoCode } from '@ihui/api-client'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { useAuthStore } from '../stores/auth-store'
import { WEB_BASE_URL } from '../lib/webview-portal-config'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
type RouteProps = RouteProp<RootStackParamList, 'WebView'>

/**
 * 通用 WebView 承载页(M4 方案,2026-08-26 立;App→Web 会话打通 2026-08-27 增补)
 *
 * 用途:移动端无法原生实现的复杂页面(管理后台、营销大屏、家长端、H5 活动页等)
 * 通过本页内嵌 WebView 访问,复用 web 端既有实现,避免移动端重复开发。
 *
 * 用法:navigation.navigate('WebView', { url, title })
 * - url:完整 http(s) 地址(生产 aizhs.top;开发环境可用 http://<局域网IP>:8801)
 * - title:可选,展示在头部(缺省显示域名)
 *
 * 会话打通(App→Web):App 已登录时,先调 /api/auth/sso/code 生成 30s 一次性授权码,
 * 改走 <目标origin>/sso/mobile-auth?sso_code=xxx&redirect=<url> —— web 端消费页
 * exchange 后由后端 Set-Cookie auth_token(httpOnly),WebView 内免登录访问。
 * 未登录 / 授权码失败 → 直接打开原 url(web 端登录页兜底)。
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

  const dark = resolvedTheme === 'dark'

  // App→Web 会话打通:已登录 → sso_code → mobile-auth 消费页;失败/未登录降级直开
  useEffect(() => {
    let cancelled = false
    if (!token) {
      setSourceUri(url)
      return
    }
    let origin = WEB_BASE_URL
    try {
      origin = new URL(url).origin
    } catch {
      // url 非法时用门户 base
    }
    void generateSsoCode('mobile-rn', url)
      .then((res) => {
        if (cancelled) return
        if (res.success) {
          setSourceUri(
            `${origin}/sso/mobile-auth?sso_code=${encodeURIComponent(res.data.code)}&redirect=${encodeURIComponent(url)}`,
          )
        } else {
          setSourceUri(url)
        }
      })
      .catch(() => {
        if (!cancelled) setSourceUri(url)
      })
    return () => {
      cancelled = true
    }
  }, [url, token])

  const onNavigationStateChange = useCallback((nav: WebViewNavigation) => {
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

  const headerTitle = title || (() => {
    try {
      return new URL(url).host
    } catch {
      return 'Web'
    }
  })()

  return (
    <View className={`flex-1 ${dark ? 'bg-neutral-900' : 'bg-white'}`}>
      <View className="flex-row items-center justify-between border-b border-gray-200 px-4 pb-2 pt-3 dark:border-neutral-700">
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text className="text-sm text-gray-500">{t('common.back')}</Text>
        </TouchableOpacity>
        <Text className="max-w-[60%] truncate text-base font-medium">{headerTitle}</Text>
        <View className="w-10" />
      </View>

      <View className="flex-1">
        <WebView
          key={sourceUri}
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
