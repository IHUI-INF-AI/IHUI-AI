import { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  Pressable,
  Alert,
  Share,
  Modal,
  TouchableOpacity,
} from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Button, Input } from '@ihui/ui-native'
import { streamChat, fetchModels, formatSSEError, type LlmModel } from '@ihui/api-client'
import { useAuth } from '../context/AuthContext'
import { useScreenshot } from '../hooks/use-screenshot'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Role = 'user' | 'assistant' | 'system'

interface ChatMessage {
  id: string
  role: Role
  content: string
}

const FALLBACK_MODELS: LlmModel[] = [
  {
    id: 'stepfun/step-3.7-flash',
    name: 'Step 3.7 Flash',
    provider: 'stepfun',
    context_length: 8192,
    input_price: 0,
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o mini',
    provider: 'openai',
    context_length: 128000,
    input_price: 0,
  },
  {
    id: 'anthropic/claude-3.5-haiku',
    name: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    context_length: 200000,
    input_price: 0,
  },
]

export function ChatScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Chat'>) {
  const { logout } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState('')
  const [models, setModels] = useState<LlmModel[]>(FALLBACK_MODELS)
  const [model, setModel] = useState<string>(FALLBACK_MODELS[0]!.id)
  const [pickerOpen, setPickerOpen] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const idCounter = useRef(0)
  const nextId = () => `${++idCounter.current}`

  useEffect(() => {
    let cancelled = false
    fetchModels()
      .then((res) => {
        if (cancelled) return
        const list = res?.models?.length ? res.models : FALLBACK_MODELS
        setModels(list)
        const def =
          res.default && list.some((m) => m.id === res.default) ? res.default : list[0]!.id
        setModel(def)
      })
      .catch(() => {
        if (!cancelled) setModels(FALLBACK_MODELS)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const send = async () => {
    const text = inputText.trim()
    if (!text || isStreaming) return
    setInputText('')
    setError('')

    const userMsg: ChatMessage = { id: nextId(), role: 'user', content: text }
    const aiMsg: ChatMessage = { id: nextId(), role: 'assistant', content: '' }
    const history = [...messages, userMsg]
    setMessages([...history, aiMsg])
    setIsStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    const apiMessages = history.map((m) => ({ role: m.role, content: m.content }))

    await streamChat({
      model,
      messages: apiMessages,
      signal: controller.signal,
      onDelta: (delta) => {
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last && last.role === 'assistant') {
            next[next.length - 1] = { ...last, content: last.content + delta }
          }
          return next
        })
      },
      onError: (err) => {
        const formatted = formatSSEError(new Error(err))
        setError(formatted.message)
        setIsStreaming(false)
        abortRef.current = null
        if (formatted.severity === 'auth') {
          Alert.alert(formatted.title, formatted.message, [
            { text: '去登录', onPress: () => logout() },
            { text: '取消', style: 'cancel' },
          ])
        } else if (formatted.severity === 'ratelimit') {
          Alert.alert(formatted.title, formatted.message)
        } else {
          Alert.alert(formatted.title, formatted.message)
        }
      },
      onDone: () => {
        setIsStreaming(false)
        abortRef.current = null
      },
    })
  }

  const stop = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setIsStreaming(false)
  }

  // 长按消息气泡:截图并弹出分享/保存菜单
  const messageRefs = useRef<Map<string, View | null>>(new Map())
  const { capture, busy: capturing } = useScreenshot()
  const setMessageRef = (id: string) => (el: View | null) => {
    if (el) messageRefs.current.set(id, el)
    else messageRefs.current.delete(id)
  }
  const handleLongPress = async (item: ChatMessage) => {
    const el = messageRefs.current.get(item.id)
    if (!el || capturing) return
    const uri = await capture({ current: el } as React.RefObject<View>)
    if (!uri) return
    Alert.alert(item.role === 'user' ? '我的消息' : 'AI 消息', '截图已生成', [
      { text: '分享', onPress: () => Share.share({ url: uri, message: item.content }) },
      { text: '取消', style: 'cancel' },
    ])
  }

  const renderItem = ({ item, index }: { item: ChatMessage; index: number }) => {
    const isUser = item.role === 'user'
    const isLastAi = item.role === 'assistant' && isStreaming && index === messages.length - 1
    return (
      <View className={isUser ? 'items-end' : 'items-start'}>
        <Pressable
          ref={setMessageRef(item.id)}
          onLongPress={() => handleLongPress(item)}
          delayLongPress={500}
          className={
            isUser
              ? 'max-w-[80%] rounded-lg bg-gray-100 px-3 py-2'
              : 'max-w-[80%] rounded-lg border border-gray-100 bg-white px-3 py-2'
          }
        >
          <Text className="text-sm text-gray-900">
            {item.content || (isLastAi ? '思考中...' : '')}
          </Text>
        </Pressable>
      </View>
    )
  }

  const currentModelName = models.find((m) => m.id === model)?.name || model

  return (
    <View className="flex-1 bg-white">
      <View className="flex-row items-center justify-between border-b border-gray-100 px-4 py-3">
        <Text className="text-lg font-semibold text-gray-900">IHUI AI</Text>
        <View className="flex-row gap-3">
          <Pressable onPress={() => navigation.navigate('Agent')} hitSlop={8}>
            <Text className="text-sm text-gray-500">智能体</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('Wallet')} hitSlop={8}>
            <Text className="text-sm text-gray-500">钱包</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('Course')} hitSlop={8}>
            <Text className="text-sm text-gray-500">课程</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('Order')} hitSlop={8}>
            <Text className="text-sm text-gray-500">订单</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('Profile')} hitSlop={8}>
            <Text className="text-sm text-gray-500">我的</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('Settings')} hitSlop={8}>
            <Text className="text-sm text-gray-500">设置</Text>
          </Pressable>
          <Pressable onPress={logout} hitSlop={8}>
            <Text className="text-sm text-gray-500">退出</Text>
          </Pressable>
        </View>
      </View>

      <Pressable
        onPress={() => setPickerOpen(true)}
        className="border-b border-gray-100 px-4 py-2"
        hitSlop={4}
      >
        <Text className="text-xs text-gray-500">模型: {currentModelName} ▾</Text>
      </Pressable>

      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <TouchableOpacity
          className="flex-1 bg-black/20"
          activeOpacity={1}
          onPress={() => setPickerOpen(false)}
        >
          <View className="mt-auto bg-white">
            <View className="border-b border-gray-100 px-4 py-3">
              <Text className="text-sm font-semibold text-gray-900">选择模型</Text>
            </View>
            <FlatList
              data={models}
              keyExtractor={(m) => m.id}
              renderItem={({ item }) => {
                const active = item.id === model
                return (
                  <Pressable
                    onPress={() => {
                      setModel(item.id)
                      setPickerOpen(false)
                    }}
                    className="px-4 py-3"
                  >
                    <Text
                      className={
                        active ? 'text-sm font-medium text-gray-900' : 'text-sm text-gray-700'
                      }
                    >
                      {item.name || item.id}
                    </Text>
                    <Text className="text-xs text-gray-400">{item.provider}</Text>
                  </Pressable>
                )
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      <FlatList
        className="flex-1 px-4"
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View className="h-2" />}
        contentContainerStyle={{ paddingVertical: 12 }}
        keyboardShouldPersistTaps="handled"
      />

      {error ? (
        <View className="px-4 pb-2">
          <Text className="text-sm text-red-600">{error}</Text>
        </View>
      ) : null}

      <View className="flex-row items-center border-t border-gray-100 px-4 py-2">
        <Input
          value={inputText}
          onChangeText={setInputText}
          placeholder="输入消息..."
          className="mr-2 flex-1"
        />
        {isStreaming ? (
          <Button variant="outline" onPress={stop}>
            停止
          </Button>
        ) : (
          <Button onPress={send} disabled={!inputText.trim()}>
            发送
          </Button>
        )}
      </View>
    </View>
  )
}
