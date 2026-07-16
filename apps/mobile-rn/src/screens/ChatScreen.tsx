import { useRef, useState } from 'react'
import { View, Text, FlatList, Pressable } from 'react-native'
import { Button, Input } from '@ihui/ui-native'
import { streamChat } from '@ihui/api-client'
import { useAuth } from '../context/AuthContext'

type Role = 'user' | 'assistant' | 'system'

interface ChatMessage {
  id: string
  role: Role
  content: string
}

const MODEL = 'stepfun/step-3.7-flash'

export function ChatScreen() {
  const { logout } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const idCounter = useRef(0)
  const nextId = () => `${++idCounter.current}`

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
      model: MODEL,
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
        setError(err)
        setIsStreaming(false)
        abortRef.current = null
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

  const renderItem = ({ item, index }: { item: ChatMessage; index: number }) => {
    const isUser = item.role === 'user'
    const isLastAi = item.role === 'assistant' && isStreaming && index === messages.length - 1
    return (
      <View className={isUser ? 'items-end' : 'items-start'}>
        <View
          className={
            isUser
              ? 'max-w-[80%] rounded-lg bg-gray-100 px-3 py-2'
              : 'max-w-[80%] rounded-lg border border-gray-100 bg-white px-3 py-2'
          }
        >
          <Text className="text-sm text-gray-900">
            {item.content || (isLastAi ? '思考中...' : '')}
          </Text>
        </View>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-white">
      <View className="flex-row items-center justify-between border-b border-gray-100 px-4 py-3">
        <Text className="text-lg font-semibold text-gray-900">IHUI AI</Text>
        <Pressable onPress={logout} hitSlop={8}>
          <Text className="text-sm text-gray-500">退出</Text>
        </Pressable>
      </View>

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
