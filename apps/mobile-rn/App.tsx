import './global.css'
import { AppRegistry, Platform, View } from 'react-native'
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

function ThemedNavigation() {
  const { resolvedTheme } = useTheme()
  return (
    <NavigationContainer linking={linking} theme={resolvedTheme === 'dark' ? DarkTheme : DefaultTheme}>
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

function AppContent() {
  const { resolvedTheme } = useTheme()
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
