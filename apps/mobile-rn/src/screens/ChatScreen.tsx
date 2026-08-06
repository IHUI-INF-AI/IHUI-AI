import { useEffect, useRef, useState } from 'react'
import { Alert, Share } from 'react-native'
import type { View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import {
  streamChat,
  fetchModels,
  formatSSEError,
  getModelContextCapacity,
  type LlmModel,
} from '@ihui/api-client'
import { formatTokenCount } from '@ihui/shared/utils'
import { FALLBACK_MODELS as SHARED_FALLBACK_MODELS } from '@ihui/shared'
import type { ChatMessage } from '@ihui/shared'
import {
  ChatScreen as SharedChatScreen,
  type ChatScreenMessage,
  type ChatScreenModel,
  type ChatScreenNavItem,
} from '@ihui/rn-app'
import { useAuth } from '../context/AuthContext'
import { useScreenshot } from '../hooks/use-screenshot'
import { useChatInput } from '../hooks/useChatInput'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

// 共享层兜底模型(FallbackModel:value/label/vendor)→ LlmModel 形态
// 2026-08-04 Phase E 收敛:13 个硬编码模型收敛到共享层 3 个(AGENTS.md §3)
const FALLBACK_MODELS: LlmModel[] = SHARED_FALLBACK_MODELS.map((m) => ({
  id: m.value,
  name: m.label,
  provider: m.vendor,
  context_length: 8192,
  input_price: 0,
}))

function toChatScreenModel(m: LlmModel): ChatScreenModel {
  return {
    id: m.id,
    name: m.name,
    provider: m.provider,
    context_length: m.context_length,
    input_price: m.input_price,
  }
}

function toChatScreenMessage(m: ChatMessage): ChatScreenMessage {
  return { id: m.id, role: m.role, content: m.content }
}

export function ChatScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Chat'>) {
  const { logout } = useAuth()
  const { t } = useI18n()
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

  // MessageInput 平台能力:图片/语音/全屏/焦点/Agent 变量(集中 useChatInput 封装)
  const {
    inputFiles,
    isVoiceMode,
    isRecording,
    isInputFullscreen,
    isInputFocused,
    agentVariables,
    onInputAddImage,
    onInputAddFile,
    onInputRemoveFile,
    onInputVoiceToggle,
    onInputFullscreenToggle,
    onInputFocus,
    onInputBlur,
    onInputVoiceStart,
    onInputVoiceEnd,
    onInputAgentVariableTextChange,
    onInputAgentVariableImageChange,
  } = useChatInput()

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
      contextLimit: getModelContextCapacity(model),
      onCompaction: (info) => {
        Alert.alert(
          t('chatAlert.compaction.title'),
          t('chatAlert.compaction.message', {
            before: formatTokenCount(info.tokensBefore),
            after: formatTokenCount(info.tokensAfter),
            removed: info.removedCount,
          }),
        )
      },
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
            { text: t('chatAlert.loginBtn'), onPress: () => logout() },
            { text: t('common.cancel'), style: 'cancel' },
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

  const handleClear = () => {
    setInputText('')
  }

  // 长按消息气泡:截图并弹出分享/保存菜单
  const messageRefs = useRef<Map<string, View | null>>(new Map())
  const { capture, busy: capturing } = useScreenshot()
  const handleLongPress = async (item: ChatScreenMessage) => {
    const original = messages.find((m) => m.id === item.id)
    if (!original) return
    const el = messageRefs.current.get(item.id)
    if (!el || capturing) return
    const uri = await capture({ current: el } as React.RefObject<View>)
    if (!uri) return
    Alert.alert(
      original.role === 'user'
        ? t('chatAlert.longPress.myTitle')
        : t('chatAlert.longPress.aiTitle'),
      t('chatAlert.longPress.message'),
      [
        {
          text: t('chatAlert.longPress.shareBtn'),
          onPress: () => Share.share({ url: uri, message: original.content }),
        },
        { text: t('common.cancel'), style: 'cancel' },
      ],
    )
  }

  const onMessageRef = (id: string, el: unknown) => {
    const node = el as View | null
    if (node) messageRefs.current.set(id, node)
    else messageRefs.current.delete(id)
  }

  const navItems: ChatScreenNavItem[] = [
    { key: 'agent', label: t('chat.navAgent'), onPress: () => navigation.navigate('Agent') },
    { key: 'wallet', label: t('chat.navWallet'), onPress: () => navigation.navigate('Wallet') },
    {
      key: 'course',
      label: t('chat.navCourse'),
      onPress: () => navigation.navigate('Tabs'),
    },
    { key: 'order', label: t('chat.navOrder'), onPress: () => navigation.navigate('Order') },
    {
      key: 'profile',
      label: t('chat.navProfile'),
      onPress: () => navigation.navigate('Tabs'),
    },
    {
      key: 'settings',
      label: t('chat.navSettings'),
      onPress: () => navigation.navigate('Settings'),
    },
    { key: 'logout', label: t('chat.navLogout'), onPress: logout },
  ]

  return (
    <SharedChatScreen
      t={t}
      messages={messages.map(toChatScreenMessage)}
      inputText={inputText}
      isStreaming={isStreaming}
      error={error}
      models={models.map(toChatScreenModel)}
      model={model}
      pickerOpen={pickerOpen}
      navItems={navItems}
      // MessageInput 平台能力(由 useChatInput 注入)
      inputFiles={inputFiles}
      agentVariables={agentVariables}
      isInputFocused={isInputFocused}
      isInputFullscreen={isInputFullscreen}
      isVoiceMode={isVoiceMode}
      isRecording={isRecording}
      isSending={isStreaming}
      onInputTextChange={setInputText}
      onSend={send}
      onStop={stop}
      onModelChange={setModel}
      onPickerOpenChange={setPickerOpen}
      onLongPressMessage={handleLongPress}
      onMessageRef={onMessageRef}
      onInputFocus={onInputFocus}
      onInputBlur={onInputBlur}
      onInputFullscreenToggle={onInputFullscreenToggle}
      onInputVoiceToggle={onInputVoiceToggle}
      onInputAddImage={onInputAddImage}
      onInputAddFile={onInputAddFile}
      onInputRemoveFile={onInputRemoveFile}
      onInputClear={handleClear}
      onInputVoiceStart={onInputVoiceStart}
      onInputVoiceEnd={onInputVoiceEnd}
      onInputAgentVariableTextChange={onInputAgentVariableTextChange}
      onInputAgentVariableImageChange={onInputAgentVariableImageChange}
    />
  )
}
