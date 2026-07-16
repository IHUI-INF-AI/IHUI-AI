import { createContext, useContext, useEffect } from 'react'
import { View, Text } from 'react-native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import type { WSNotification } from '@ihui/api-client'
import { useAuth } from '../context/AuthContext'
import { useNotificationWebSocket } from '../hooks/use-websocket'
import { LoginScreen } from '../screens/LoginScreen'
import { HomeScreen } from '../screens/HomeScreen'
import { ChatScreen } from '../screens/ChatScreen'
import { ProfileScreen } from '../screens/ProfileScreen'
import { CourseScreen } from '../screens/CourseScreen'
import { OrderScreen } from '../screens/OrderScreen'
import { WalletScreen } from '../screens/WalletScreen'
import SettingsScreen from '../screens/SettingsScreen'

export type RootStackParamList = {
  Login: undefined
  Chat: undefined
  Home: undefined
  Profile: undefined
  Course: undefined
  Order: undefined
  Wallet: undefined
  Settings: undefined
}

const Stack = createNativeStackNavigator<RootStackParamList>()

// 通知 Context:在 RootNavigator 顶层订阅 WS,通过 Context 分发给已登录栈各 Screen
interface NotificationContextValue {
  connected: boolean
  lastMessage: WSNotification | null
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

export function useNotification(): NotificationContextValue {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotification must be used within RootNavigator')
  return ctx
}

export function RootNavigator() {
  const { token, ready } = useAuth()
  const { connected, lastMessage } = useNotificationWebSocket(token)

  useEffect(() => {
    if (lastMessage) {
      // 开发期可见:WS 通知到达后输出到控制台
      // eslint-disable-next-line no-console
      console.log('[WS] notification:', lastMessage)
    }
  }, [lastMessage])

  if (!ready) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <Text className="text-gray-500">加载中...</Text>
      </View>
    )
  }

  return (
    <NotificationContext.Provider value={{ connected, lastMessage }}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {token ? (
          <>
            <Stack.Screen name="Chat" component={ChatScreen} />
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="Course" component={CourseScreen} />
            <Stack.Screen name="Order" component={OrderScreen} />
            <Stack.Screen name="Wallet" component={WalletScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NotificationContext.Provider>
  )
}
