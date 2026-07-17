import './global.css'
import { useColorScheme, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { NavigationContainer } from '@react-navigation/native'
import { StatusBar } from 'expo-status-bar'
import { AuthProvider } from './src/context/AuthContext'
import { I18nProvider } from './src/i18n'
import { RootNavigator } from './src/navigation/RootNavigator'

export default function App() {
  // 跟随系统主题 toggle .dark class（对齐 web 端 next-themes .dark 策略）
  const isDark = useColorScheme() === 'dark'

  return (
    <View className={isDark ? 'dark' : ''} style={{ flex: 1 }}>
      <SafeAreaProvider>
        <I18nProvider>
          <AuthProvider>
            <NavigationContainer>
              <RootNavigator />
            </NavigationContainer>
          </AuthProvider>
        </I18nProvider>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </View>
  )
}
