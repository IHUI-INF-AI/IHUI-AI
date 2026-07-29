import { useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getAiModels, sendAiChat } from '@ihui/api-client'
import {
  AIMultimodalScreen as SharedAIMultimodalScreen,
  type AiMultimodalMessage,
  type AiMultimodalMode,
} from '@ihui/rn-app'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function AIMultimodalScreen() {
  const { t } = useI18n()
  const { user } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [mode, setMode] = useState<AiMultimodalMode>('text')
  const [models, setModels] = useState<string[]>([])
  const [model, setModel] = useState('')
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<AiMultimodalMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 从 @ihui/api-client 加载真实模型列表,加载失败静默处理。
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await getAiModels({ page: 1, pageSize: 100 })
      if (cancelled) return
      if (res.success) {
        const names = res.data.list
          .map((m) => m.name)
          .filter((n): n is string => typeof n === 'string' && n.length > 0)
        setModels(names)
        setModel((prev) => prev || names[0] || '')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return
    const userMsg: AiMultimodalMessage = {
      id: `${Date.now()}-u`,
      role: 'user',
      content: text,
      createdAt: Date.now(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setError('')
    const res = await sendAiChat({ message: text, model })
    setLoading(false)
    if (res.success) {
      const data = res.data as { content?: string; message?: string; reply?: string }
      const reply = data?.content ?? data?.message ?? data?.reply ?? JSON.stringify(data)
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-a`, role: 'assistant', content: reply, createdAt: Date.now() },
      ])
    } else {
      setError(res.error || t('aiMultimodal.error'))
    }
  }

  const handleClear = () => {
    setMessages([])
    setError('')
  }

  const userName = user?.nickname ?? user?.username ?? ''

  return (
    <SharedAIMultimodalScreen
      t={t}
      userName={userName}
      mode={mode}
      models={models}
      model={model}
      messages={messages}
      input={input}
      loading={loading}
      error={error}
      onModeChange={setMode}
      onModelChange={setModel}
      onInputChange={setInput}
      onSend={handleSend}
      onClear={handleClear}
      onBack={() => navigation.goBack()}
    />
  )
}
