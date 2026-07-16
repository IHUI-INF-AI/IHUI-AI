import { useState } from 'react'
import { View, Text } from 'react-native'
import { Button, Card, Input } from '@ihui/ui-native'
import { useAuth } from '../context/AuthContext'

export function LoginScreen() {
  const { login } = useAuth()
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    if (!account || !password) {
      setError('请输入账号和密码')
      return
    }
    setLoading(true)
    setError('')
    const res = await login(account, password)
    if (!res.success) {
      setError(res.error ?? '登录失败')
    }
    setLoading(false)
  }

  return (
    <View className="flex-1 bg-white px-4 justify-center">
      <Card className="p-4">
        <Text className="text-lg font-semibold text-center mb-4 text-gray-900">IHUI AI 登录</Text>
        <Input
          value={account}
          onChangeText={setAccount}
          placeholder="账号 / 手机号 / 邮箱"
          autoCapitalize="none"
          className="mb-2"
        />
        <Input
          value={password}
          onChangeText={setPassword}
          placeholder="密码"
          secureTextEntry
          className="mb-2"
        />
        {error ? <Text className="text-red-600 text-sm mb-2">{error}</Text> : null}
        <Button onPress={handleLogin} disabled={loading}>
          {loading ? '登录中...' : '登录'}
        </Button>
      </Card>
    </View>
  )
}
