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

interface LocalMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export function AIMultimodalScreen() {
  const { t } = useI18n()
  const { user } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [mode, setMode] = useState<AiMultimodalMode>('text')
  const [models, setModels] = useState<string[]>([])
  const [model, setModel] = useState('')
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<LocalMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    const userMsg: LocalMessage = {
      id: `${Date.now()}-u`,
      role: 'user',
      content: text,
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setError(null)
    const res = await sendAiChat({ message: text, model })
    setLoading(false)
    if (res.success) {
      const data = res.data as { content?: string; message?: string; reply?: string }
      const reply =
        data.content || data.message || data.reply || t('aiMultimodal.error')
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-a`, role: 'assistant', content: reply },
      ])
    } else {
      setError(t('aiMultimodal.error'))
    }
  }

  const sharedMessages: AiMultimodalMessage[] = messages

  return (
    <SharedAIMultimodalScreen
      t={t}
      userName={user?.nickname || user?.username || ''}
      mode={mode}
      models={models}
      model={model}
      messages={sharedMessages}
      input={input}
      loading={loading}
      error={error}
      onModeChange={setMode}
      onModelChange={setModel}
      onInputChange={setInput}
      onSend={() => void handleSend()}
      onClear={() => {
        setMessages([])
        setError(null)
      }}
      onBack={() => navigation.goBack()}
    />
  )
}
