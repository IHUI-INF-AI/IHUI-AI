import { useEffect, useState } from 'react'
import { ScrollView, Text, View, Alert } from 'react-native'
import { Button, Input } from '@ihui/ui-native'
import { useBiometrics } from '../hooks/use-biometrics'
import { useClipboard } from '../hooks/use-clipboard'
import { usePush } from '../hooks/use-push'
import { useScreenshot } from '../hooks/use-screenshot'
import { useAuth } from '../context/AuthContext'

export default function SettingsScreen() {
  const { user, logout } = useAuth()
  const bio = useBiometrics()
  const clip = useClipboard()
  const push = usePush()
  const shot = useScreenshot()
  const [clipboardInput, setClipboardInput] = useState('')

  useEffect(() => {
    void bio.probe()
  }, [bio])

  const onAuth = async () => {
    const r = await bio.authenticate('解锁 IHUI AI 设置')
    Alert.alert(
      r.success ? '验证成功' : '验证失败',
      r.success ? '已通过生物识别' : (r.error ?? '未知错误'),
    )
  }

  return (
    <ScrollView className="flex-1 bg-white p-4 dark:bg-black">
      <Text className="mb-2 text-xl font-semibold text-neutral-900 dark:text-neutral-50">账户</Text>
      <View className="mb-6 rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
        <Text className="text-sm text-neutral-500">当前用户</Text>
        <Text className="text-base text-neutral-900 dark:text-neutral-50">
          {user?.nickname ?? '未登录'}
        </Text>
      </View>

      <Text className="mb-2 text-xl font-semibold text-neutral-900 dark:text-neutral-50">
        生物识别
      </Text>
      <View className="mb-6 rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
        <Text className="mb-2 text-sm text-neutral-600 dark:text-neutral-400">
          硬件支持:{bio.supported ? '✓' : '✗'} · 已录入:{bio.enrolled ? '✓' : '✗'}
        </Text>
        <Button onPress={onAuth} variant="default">
          验证身份
        </Button>
      </View>

      <Text className="mb-2 text-xl font-semibold text-neutral-900 dark:text-neutral-50">
        剪贴板
      </Text>
      <View className="mb-6 rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
        <Input
          value={clipboardInput}
          onChangeText={setClipboardInput}
          placeholder="输入要复制的内容"
          className="mb-2"
        />
        <View className="flex-row gap-2">
          <Button onPress={() => clip.copy(clipboardInput)} variant="default">
            复制
          </Button>
          <Button
            onPress={async () => {
              const v = await clip.read()
              setClipboardInput(v)
            }}
            variant="outline"
          >
            读取
          </Button>
        </View>
        {clip.lastCopied !== null && (
          <Text className="mt-2 text-xs text-neutral-500">已复制:{clip.lastCopied}</Text>
        )}
      </View>

      <Text className="mb-2 text-xl font-semibold text-neutral-900 dark:text-neutral-50">
        推送通知
      </Text>
      <View className="mb-6 rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
        <Text className="mb-2 text-sm text-neutral-600 dark:text-neutral-400">
          权限:{push.state.permission}
        </Text>
        {push.state.error && <Text className="mb-2 text-xs text-red-500">{push.state.error}</Text>}
        {push.state.token && (
          <Text className="mb-2 text-xs text-neutral-500">Token:{push.state.token}</Text>
        )}
        <Button onPress={() => void push.register()} variant="default">
          注册推送
        </Button>
      </View>

      <Text className="mb-2 text-xl font-semibold text-neutral-900 dark:text-neutral-50">截图</Text>
      <View className="mb-6 rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
        <Text className="mb-2 text-sm text-neutral-600 dark:text-neutral-400">
          状态:{shot.busy ? '截取中…' : shot.lastUri ? '已保存' : '就绪'}
        </Text>
        {shot.lastUri && <Text className="mb-2 text-xs text-neutral-500">{shot.lastUri}</Text>}
        <Text className="text-xs text-neutral-500">提示:长按聊天消息即可截屏保存</Text>
      </View>

      <Button onPress={logout} variant="destructive">
        退出登录
      </Button>
    </ScrollView>
  )
}
