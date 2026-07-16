import { useEffect } from 'react'
import { View, Text } from 'react-native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useAuth } from '../context/AuthContext'
import { useNotificationWebSocket } from '../hooks/use-websocket'
import { NotificationProvider, useNotificationStore } from '../stores/notification'
import NotificationPanel from '../components/NotificationPanel'
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

function RootNavigatorInner() {
  const { token, ready } = useAuth()
  const ws = useNotificationWebSocket(token)
  const { setConnected, addFromWs } = useNotificationStore()

  useEffect(() => {
    setConnected(ws.connected)
  }, [ws.connected, setConnected])

  useEffect(() => {
    addFromWs(ws.lastMessage)
  }, [ws.lastMessage, addFromWs])

  if (!ready) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <Text className="text-gray-500">加载中...</Text>
      </View>
    )
  }

  return (
    <>
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
      <NotificationPanel />
    </>
  )
}

export function RootNavigator() {
  return (
    <NotificationProvider>
      <RootNavigatorInner />
    </NotificationProvider>
  )
}
