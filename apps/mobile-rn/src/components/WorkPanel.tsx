/**
 * 工作展示区(mobile-rn 端)— 全屏 WebView 页面。
 * 提供 openWorkPanel(url) 全局方法,通过模块级导航回调实现跳转。
 * 依赖:react-native-webview(需安装:pnpm --filter @ihui/mobile-rn add react-native-webview)
 */
import { useCallback, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import WebView from 'react-native-webview'

// ── 模块级导航回调(由 RootNavigator 中的 NavBridge 注册) ──
let _navigateFn: ((url: string) => void) | null = null

/** 全局方法:打开 WorkPanel 并加载指定 URL */
export function openWorkPanel(url: string): void {
  if (_navigateFn) {
    _navigateFn(url)
  } else {
    console.warn('[WorkPanel] navigator not ready, cannot open:', url)
  }
}

/** 内部方法:注册/注销导航回调 */
export function setWorkPanelNavigator(fn: ((url: string) => void) | null): void {
  _navigateFn = fn
}

// ── WorkPanel 屏幕组件 ──

interface WorkPanelRoute {
  params?: { url: string }
}

export function WorkPanelScreen({ route }: { route: WorkPanelRoute }) {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const url = route.params?.url ?? ''
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const handleLoad = useCallback(() => setLoading(false), [])
  const handleError = useCallback((e: { nativeEvent?: { description?: string } }) => {
    setError(e.nativeEvent?.description || '页面加载失败')
    setLoading(false)
  }, [])

  if (!url) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-sm text-gray-500">缺少 URL</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-3 py-2">
        <Pressable
          onPress={() => navigation.goBack()}
          className="rounded-md px-3 py-1"
          accessibilityLabel="返回"
          testID="work-panel-back"
        >
          <Text className="text-sm text-emerald-600">返回</Text>
        </Pressable>
        <Text className="ml-2 flex-1 text-sm text-gray-600" numberOfLines={1}>
          {url}
        </Text>
      </View>

      <View className="flex-1">
        <WebView
          source={{ uri: url }}
          onLoad={handleLoad}
          onError={handleError}
          style={StyleSheet.absoluteFill}
          testID="work-panel-webview"
        />
        {loading ? (
          <View style={[StyleSheet.absoluteFill, styles.center]}>
            <ActivityIndicator color="#16a34a" />
          </View>
        ) : null}
        {error ? (
          <View style={[StyleSheet.absoluteFill, styles.center]}>
            <Text className="px-4 text-center text-sm text-red-400">{error}</Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
})

export default WorkPanelScreen
