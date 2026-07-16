import { View, Text } from 'react-native'
import { Button } from '@ihui/ui-native'
import { useAuth } from '../context/AuthContext'

export function HomeScreen() {
  const { user, logout } = useAuth()

  return (
    <View className="flex-1 bg-white px-4 pt-12">
      <Text className="text-xl font-semibold text-gray-900">欢迎使用 IHUI AI</Text>
      {user ? <Text className="text-gray-600 mt-2">{user.nickname || user.phone}</Text> : null}
      <View className="mt-8">
        <Button onPress={logout}>退出登录</Button>
      </View>
    </View>
  )
}
