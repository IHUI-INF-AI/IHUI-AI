import { View, Text } from 'react-native'
import { Button } from '@ihui/ui-native'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../navigation/RootNavigator'

export function HomeScreen() {
  const { user, logout } = useAuth()
  const { connected } = useNotification()

  return (
    <View className="flex-1 bg-white px-4 pt-12">
      <View className="flex-row items-center gap-2">
        <Text className="text-xl font-semibold text-gray-900">欢迎使用 IHUI AI</Text>
        <View
          className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-400'}`}
          accessibilityLabel={connected ? '实时通知已连接' : '实时通知未连接'}
        />
      </View>
      {user ? <Text className="text-gray-600 mt-2">{user.nickname || user.phone}</Text> : null}
      <View className="mt-8">
        <Button onPress={logout}>退出登录</Button>
      </View>
    </View>
  )
}
