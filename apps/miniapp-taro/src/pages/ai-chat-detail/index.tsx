/**
 * AI 对话详情页 — miniapp-taro 端实现
 *
 * 2026-07-29 迁移:从 Taro 原生 170 行实现 → 接入 @ihui/rn-app 共享层类型契约
 * (ChatScreenProps / MessageInputProps),平台能力用 Taro 原生 API 实现
 * (Taro.chooseImage / Taro.chooseMessageFile / Taro.navigateBack 等)。
 *
 * 共享层 @ihui/rn-app 的 ChatScreen / MessageInput 组件本身基于 react-native,
 * 不能直接在 Taro 小程序中渲染,因此本页保留 Taro 原生实现,但严格遵循
 * 共享层 props 契约,确保未来 web / mobile-rn 包装层可共用类型与业务逻辑。
 *
 * 涉及共享类型(全部从 @ihui/types 单源导出,@ihui/rn-app 仅是 react-native 包装):
 * - ChatScreenMessage   聊天消息条目
 * - ChatScreenModel     模型选项
 * - MessageInputFile    附件条目(图片/文档/视频)
 * - MessageInputProps   输入框共享 props 契约
 *
 * 约束:
 * - 不引入新依赖(@ihui/types 已在 dependencies,无需 @ihui/rn-app)
 * - 禁用 any,异步回调统一 unknown + 类型守卫
 * - Taro API 返回类型显式声明 chooseImageRes / chooseMessageFileRes
 */
import { View, Text, ScrollView, Input } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useRef, useEffect } from 'react'
import type { ChatScreenMessage, MessageInputFile } from '@ihui/types'
import { chat, getChatHistory, type ChatMessage } from '@/api'
import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'

/** Taro.chooseImage 返回类型(避免 any) */
interface ChooseImageRes {
  tempFilePaths: string[]
  errMsg?: string
}

/** Taro.chooseMessageFile 返回的临时文件条目 */
interface ChooseMessageFileEntry {
  path: string
  size?: number
  name?: string
  type?: string
}

/** Taro.chooseMessageFile 返回类型(避免 any) */
interface ChooseMessageFileRes {
  tempFiles: ChooseMessageFileEntry[]
  errMsg?: string
}

/** 文件 ID 自增计数器(模块级,避免多实例碰撞) */
let fileIdCounter = 0
const nextFileId = (): string => `file-${Date.now()}-${++fileIdCounter}`

/** 从 Taro.chooseMessageFile 的 type 字段推断 MessageInputFileType */
function inferFileType(rawType: string | undefined): MessageInputFile['type'] {
  if (!rawType) return 'document'
  if (rawType.startsWith('image')) return 'image'
  if (rawType.startsWith('video')) return 'video'
  return 'document'
}

export default function AiChatDetail() {
  const { t } = useI18n()
  // 兜底翻译:key 缺失时返回 fallback,避免显示原始 key
  const tt = useCallback(
    (k: string, fb: string, params?: Record<string, string | number>): string => {
      const v = params ? t(k, params) : t(k)
      if (v !== k) return v
      if (!params) return fb
      return fb.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? ''))
    },
    [t],
  )

  // 消息状态(共享层 ChatScreenMessage 契约)
  const [messages, setMessages] = useState<ChatScreenMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [sending, setSending] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [scrollTop, setScrollTop] = useState(0)

  // MessageInput 平台能力(共享层 props 契约对齐)
  const [inputFiles, setInputFiles] = useState<MessageInputFile[]>([])
  const [isInputFullscreen, setIsInputFullscreen] = useState(false)
  const [isInputFocused, setIsInputFocused] = useState(false)
  const [isVoiceMode, setIsVoiceMode] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [inputError, setInputError] = useState('')

  const inputRef = useRef('')
  const idCounter = useRef(0)
  const nextMsgId = (): string => `${++idCounter.current}`

  const scrollToBottom = useCallback(() => {
    setTimeout(() => setScrollTop((s) => (s === 99998 ? 99999 : 99998)), 50)
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await getChatHistory({ page: 1, pageSize: 1 })
      const sessions = res?.list ?? []
      const firstSession = sessions[0]
      if (firstSession && firstSession.messages?.length) {
        const msgs: ChatScreenMessage[] = firstSession.messages.map(
          (m: ChatMessage, idx: number) => ({
            id: `${firstSession.id}_${idx}`,
            role: m.role === 'user' ? 'user' : 'assistant',
            content: String(m.content || ''),
          }),
        )
        setMessages(msgs)
        setSessionId(String(firstSession.id || ''))
        scrollToBottom()
      }
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e))
      logger.error('unknown', '加载聊天记录', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [scrollToBottom])

  useDidShow(() => {
    loadData()
  })

  const handleInputChange = useCallback((e: { detail: { value: string } }) => {
    const val = e.detail.value
    setInputValue(val)
    inputRef.current = val
  }, [])

  const handleInputFocus = useCallback(() => {
    setIsInputFocused(true)
  }, [])

  const handleInputBlur = useCallback(() => {
    setIsInputFocused(false)
  }, [])

  const handleFullscreenToggle = useCallback(() => {
    setIsInputFullscreen((v) => !v)
  }, [])

  const handleVoiceToggle = useCallback(() => {
    setIsVoiceMode((v) => !v)
  }, [])

  const handleClear = useCallback(() => {
    setInputValue('')
    inputRef.current = ''
    setInputError('')
  }, [])

  const handleRemoveFile = useCallback((id: string) => {
    setInputFiles((prev) => prev.filter((f) => f.id !== id))
  }, [])

  /**
   * 添加文件:Taro.chooseMessageFile
   * 根据 type 字段推断 MessageInputFileType(image/document/video)
   */
  const handleAddFile = useCallback(async () => {
    try {
      const res = (await Taro.chooseMessageFile({
        type: 'file',
        count: 1,
      })) as ChooseMessageFileRes
      const entries = Array.isArray(res.tempFiles) ? res.tempFiles : []
      if (entries.length === 0) return
      const newFiles: MessageInputFile[] = entries.map((entry) => {
        const filename = entry.name ?? ''
        const type = inferFileType(entry.type ?? filename.split('.').pop())
        return {
          id: nextFileId(),
          url: entry.path,
          filename: filename || undefined,
          type,
        }
      })
      setInputFiles((prev) => [...prev, ...newFiles])
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e))
      const msg = String((err as { errMsg?: string }).errMsg || '').toLowerCase()
      if (msg.includes('cancel')) return
      Taro.showToast({ title: tt('aiChatDetail.filePickFailed', '文件选择失败'), icon: 'none' })
    }
  }, [tt])

  /**
   * 添加图片:Taro.chooseImage
   * 失败回退(非用户取消)→ Taro.chooseMessageFile 通用文件选择
   */
  const handleAddImage = useCallback(async () => {
    try {
      const res = (await Taro.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
      })) as ChooseImageRes
      const files = Array.isArray(res.tempFilePaths) ? res.tempFilePaths : []
      if (files.length === 0) return
      const newFiles: MessageInputFile[] = files.map((path) => ({
        id: nextFileId(),
        url: path,
        type: 'image',
      }))
      setInputFiles((prev) => [...prev, ...newFiles])
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e))
      const msg = String((err as { errMsg?: string }).errMsg || '').toLowerCase()
      // 用户主动取消 → 静默;其他错误 → toast + fallback 文件选择
      if (msg.includes('cancel')) return
      Taro.showToast({ title: tt('aiChatDetail.imagePickFailed', '图片选择失败'), icon: 'none' })
      await handleAddFile()
    }
  }, [tt, handleAddFile])

  const sendMessage = useCallback(async () => {
    const text = inputRef.current.trim()
    if (!text || sending) return
    const userMsg: ChatScreenMessage = {
      id: nextMsgId(),
      role: 'user',
      content: text,
    }
    const aiMsg: ChatScreenMessage = {
      id: nextMsgId(),
      role: 'assistant',
      content: '',
    }
    setMessages((prev) => [...prev, userMsg, aiMsg])
    setInputValue('')
    inputRef.current = ''
    setSending(true)
    scrollToBottom()
    try {
      const chatMessages: ChatMessage[] = [
        ...messages.map((m) => ({ role: m.role, content: m.content }) as ChatMessage),
        { role: 'user' as const, content: text },
      ]
      const result = await chat(chatMessages, sessionId || undefined)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsg.id
            ? { ...m, content: result?.reply || tt('aiChatDetail.noReply', '暂无回复') }
            : m,
        ),
      )
      if (result?.sessionId) setSessionId(result.sessionId)
      scrollToBottom()
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e))
      logger.error('unknown', '发送消息', err)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsg.id
            ? { ...m, content: tt('aiChatDetail.sendFailed', '发送失败,请重试') }
            : m,
        ),
      )
      Taro.showToast({ title: tt('aiChatDetail.sendFailed', '发送失败,请重试'), icon: 'none' })
    } finally {
      setSending(false)
    }
  }, [sending, sessionId, messages, scrollToBottom, tt])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  return (
    <View className="flex flex-col h-screen bg-background">
      <View className="p-[24rpx] bg-card flex-shrink-0">
        <Text className="text-[36rpx] font-semibold text-foreground">{t('aiChatDetail.title')}</Text>
      </View>
      <ScrollView scrollY className="flex-1 min-h-0" scrollTop={scrollTop} scrollWithAnimation>
        {loading ? (
          <View className="flex flex-col items-center py-[80rpx]">
            <Text className="text-center text-muted-foreground text-[26rpx]">{t('common.loading')}</Text>
          </View>
        ) : error ? (
          <View className="flex flex-col items-center py-[80rpx]">
            <Text className="text-center text-muted-foreground text-[26rpx]">
              {tt('aiChatDetail.loadFailed', '加载失败')}
            </Text>
            <View
              className="mt-[24rpx] px-[48rpx] py-[16rpx] bg-primary text-foreground text-center rounded-[12rpx] text-[26rpx]"
              onClick={loadData}
            >
              <Text>{t('common.retry')}</Text>
            </View>
          </View>
        ) : messages.length ? (
          <View className="p-[24rpx]">
            {messages.map((msg) => (
              <View
                key={msg.id}
                className={`flex mb-[24rpx] ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <View
                  className={`max-w-[70%] py-[20rpx] px-[24rpx] rounded-[12rpx] ${msg.role === 'user' ? 'bg-primary' : 'bg-card'}`}
                >
                  <Text className="text-[28rpx] leading-[1.5] break-words text-foreground">
                    {msg.content ||
                      (msg.role === 'assistant' && sending
                        ? tt('aiChatDetail.thinking', '思考中…')
                        : '')}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View className="flex flex-col items-center py-[80rpx]">
            <Text className="text-center text-muted-foreground text-[26rpx]">
              {t('aiChatDetail.empty')}
            </Text>
          </View>
        )}
      </ScrollView>

      {inputError ? (
        <View className="px-[24rpx] py-[8rpx] bg-card">
          <Text className="text-[24rpx] text-destructive">{inputError}</Text>
        </View>
      ) : null}

      {inputFiles.length > 0 ? (
        <View className="flex flex-row flex-wrap gap-[12rpx] px-[24rpx] py-[12rpx] bg-card">
          {inputFiles.map((f) => (
            <View
              key={f.id}
              className="relative w-[96rpx] h-[96rpx] rounded-[8rpx] bg-muted flex items-center justify-center"
            >
              <Text className="text-[20rpx] text-foreground px-[8rpx] text-center" numberOfLines={1}>
                {f.filename || f.type}
              </Text>
              <View
                className="absolute -top-[8rpx] -right-[8rpx] w-[32rpx] h-[32rpx] rounded-full bg-destructive flex items-center justify-center"
                onClick={() => handleRemoveFile(f.id)}
              >
                <Text className="text-[20rpx] text-white leading-none">×</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {isInputFullscreen ? (
        <View className="flex flex-row items-center justify-between px-[24rpx] py-[12rpx] bg-card border-t border-border">
          <View onClick={handleFullscreenToggle}>
            <Text className="text-[26rpx] text-foreground">← {t('messageInput.fullscreenBack')}</Text>
          </View>
          <Text className="text-[22rpx] text-muted-foreground">
            {t('messageInput.fullscreenHint')}
          </Text>
        </View>
      ) : null}

      {isVoiceMode ? (
        <View className="flex flex-col items-center px-[24rpx] py-[32rpx] bg-card">
          <Text className="text-[24rpx] text-muted-foreground mb-[12rpx]">
            {isRecording ? t('messageInput.recording') : t('messageInput.voiceHint')}
          </Text>
          <View
            className={`w-full py-[24rpx] rounded-[12rpx] flex items-center justify-center ${isRecording ? 'bg-destructive' : 'bg-muted'}`}
            onTouchStart={() => setIsRecording(true)}
            onTouchEnd={() => setIsRecording(false)}
            onTouchCancel={() => setIsRecording(false)}
          >
            <Text className="text-[28rpx] text-foreground">
              {isRecording
                ? tt('messageInput.releaseToSend', '松开发送')
                : tt('messageInput.holdToSpeak', '按住说话')}
            </Text>
          </View>
        </View>
      ) : (
        <View className="flex items-center px-[24rpx] py-[16rpx] bg-card flex-shrink-0 gap-[12rpx]">
          <View
            className="w-[64rpx] h-[64rpx] flex items-center justify-center rounded-[8rpx] bg-muted"
            onClick={handleVoiceToggle}
          >
            <Text className="text-[28rpx] text-foreground">🎙</Text>
          </View>
          <View
            className="w-[64rpx] h-[64rpx] flex items-center justify-center rounded-[8rpx] bg-muted"
            onClick={handleAddImage}
          >
            <Text className="text-[28rpx] text-foreground">+</Text>
          </View>
          {isInputFocused ? (
            <View
              className="w-[64rpx] h-[64rpx] flex items-center justify-center rounded-[8rpx] bg-muted"
              onClick={handleFullscreenToggle}
            >
              <Text className="text-[24rpx] text-foreground">⛶</Text>
            </View>
          ) : null}
          {isInputFocused ? (
            <View
              className="w-[64rpx] h-[64rpx] flex items-center justify-center rounded-[8rpx] bg-muted"
              onClick={handleAddFile}
            >
              <Text className="text-[28rpx] text-foreground">📎</Text>
            </View>
          ) : null}
          <View
            className={`flex-1 h-[72rpx] px-[24rpx] text-[28rpx] bg-background rounded-[12rpx] flex items-center ${isInputFullscreen ? 'min-h-[200rpx]' : ''}`}
          >
            <View className="flex-1">
              {/* Taro Input 组件:支持 onInput / onFocus / onBlur / onConfirm + i18n placeholder */}
              <Input
                className="w-full h-[72rpx] text-[28rpx] bg-transparent text-foreground"
                type="text"
                value={inputValue}
                placeholder={tt('aiChatDetail.inputPlaceholder', '输入消息…')}
                placeholderClass="text-muted-foreground"
                onInput={handleInputChange}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                onConfirm={sendMessage}
                confirmType="send"
                disabled={sending}
              />
            </View>
            {inputValue.length > 0 && !sending ? (
              <View
                className="w-[40rpx] h-[40rpx] flex items-center justify-center rounded-md bg-muted ml-[8rpx]"
                onClick={handleClear}
              >
                <Text className="text-[24rpx] text-muted-foreground leading-none">×</Text>
              </View>
            ) : null}
          </View>
          <View
            className={`px-[32rpx] h-[72rpx] rounded-[12rpx] flex-shrink-0 flex items-center justify-center ${!inputValue.trim() || sending ? 'bg-muted' : 'bg-primary'}`}
            onClick={sendMessage}
          >
            <Text
              className={`text-[28rpx] ${!inputValue.trim() || sending ? 'text-muted-foreground' : 'text-foreground'}`}
            >
              {sending ? tt('aiChatDetail.sending', '发送中…') : t('chat.send')}
            </Text>
          </View>
        </View>
      )}
    </View>
  )
}
