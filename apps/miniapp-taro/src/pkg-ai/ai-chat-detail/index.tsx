// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AI 对话详情页 — miniapp-taro 端薄壳(2026-11-05)
 *
 * 形制 = 直载共享屏 + 注入本端事实,与 pkg-ai/ai-assistant、pkg-about/about-shared 同一条路线:
 * 布局/气泡/输入栏/语音态/全屏态/附件 chips 的真相源在
 * `packages/app/src/features/chat/ChatScreen.tsx`(RN 端 `apps/mobile-rn/src/screens/ChatScreen.tsx:2866`
 * 消费同一份),本页只出本端事实 —— 取词、主题档、Taro 平台能力(chooseImage/chooseMessageFile)、
 * 历史/流式数据与自动滚底。
 *
 * 自动滚底走共享屏 `onListRef`(`ChatScreen.tsx:199-203`)拿到的 FlatList 句柄:
 * 小程序侧由 `src/rn-compat/primitives.tsx` 的 forwardRef 把 `scrollToEnd` 转译为
 * scrollTop+scrollWithAnimation;该透传的阴性/阳性对照见 tests/rn-compat-flatlist-ref.test.tsx。
 */
import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChatScreen as SharedChatScreen } from '@ihui/rn-app/features/chat/ChatScreen'
import { EmptyState, ErrorState, ScreenSkeleton } from '@/components/ScreenStates.taro'
import { useTheme } from '@/rn-compat/theme'
import ThemeRoot from '@/components/ThemeRoot'
import { useI18n } from '@/i18n'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import { chatStream, getChatHistory, type ChatMessage } from '@/api'
import { logger } from '@/utils/logger'
import { onToast } from '@/host/on-toast'
import type { ChatScreenMessage, MessageInputFile } from '@ihui/types'

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

/** 共享屏 FlatList 句柄的最小面(只取本页用到的命令式方法) */
interface ListHandle {
  scrollToEnd: (params?: { animated?: boolean }) => void
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
  const gate = useAuthReadyGate()
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
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

  // MessageInput 平台能力(共享层 props 契约对齐)
  const [inputFiles, setInputFiles] = useState<MessageInputFile[]>([])
  const [isInputFullscreen, setIsInputFullscreen] = useState(false)
  const [isVoiceMode, setIsVoiceMode] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [inputError, setInputError] = useState('')

  const listRef = useRef<ListHandle | null>(null)
  const sendingRef = useRef(false)
  const idCounter = useRef(0)
  const nextMsgId = (): string => `${++idCounter.current}`

  const scrollToBottom = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50)
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
    // G-933 冷启动抢跑门:getChatHistory → GET /api/ai/history(ai-user-model-chat.ts:246 组级
    // checkAuth)需鉴权;判定落定前不发,落定后每次显示补跑。
    gate.waitUntilReady(() => {
      void loadData()
    })
  })

  /** 共享屏词汇 → 本页历史键位(chat.title / chat.thinking / 输入框占位与发送键) */
  const tScreen = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      if (key === 'chat.title') return t('aiChatDetail.title')
      if (key === 'chat.thinking') return tt('aiChatDetail.thinking', '思考中…')
      if (key === 'messageInput.placeholder')
        return tt('aiChatDetail.inputPlaceholder', '输入消息…')
      if (key === 'messageInput.send') return t('chat.send')
      return params ? t(key, params) : t(key)
    },
    [t, tt],
  )

  const handleFullscreenToggle = useCallback(() => {
    setIsInputFullscreen((v) => !v)
  }, [])

  const handleVoiceToggle = useCallback(() => {
    setIsVoiceMode((v) => !v)
  }, [])

  const handleClear = useCallback(() => {
    setInputValue('')
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
      onToast(tt('aiChatDetail.filePickFailed', '文件选择失败'), { kind: 'error' })
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
      onToast(tt('aiChatDetail.imagePickFailed', '图片选择失败'), { kind: 'error' })
      await handleAddFile()
    }
  }, [tt, handleAddFile])

  const sendMessage = useCallback(async () => {
    const text = inputValue.trim()
    if (!text || sendingRef.current) return
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
    sendingRef.current = true
    setSending(true)
    scrollToBottom()
    try {
      const chatMessages: ChatMessage[] = [
        ...messages.map((m) => ({ role: m.role, content: m.content }) as ChatMessage),
        { role: 'user' as const, content: text },
      ]
      // #12 小程序 AI 增强(2026-09-16 立):阻塞式 chat() 切换为 chatStream 流式——
      // onChunk 逐 token 更新最后一条 assistant 气泡(与主聊天页 ai/chat.tsx 同一传输层
      // src/lib/sse.ts:enableChunked + 断点续传 + 指数退避重连),onMeta 取回 sessionId;
      // 历史会话接口(getChatHistory)不动。
      await chatStream(
        chatMessages,
        sessionId || '',
        {},
        (delta) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === aiMsg.id ? { ...m, content: m.content + delta } : m)),
          )
          scrollToBottom()
        },
        undefined,
        (meta) => {
          if (meta.sessionId) setSessionId(meta.sessionId)
        },
      )
      // 流结束兜底:零输出时显示占位(原阻塞式 result.reply 为空的等价场景)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsg.id && !m.content
            ? { ...m, content: tt('aiChatDetail.noReply', '暂无回复') }
            : m,
        ),
      )
      if (!sessionId) scrollToBottom()
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
      onToast(tt('aiChatDetail.sendFailed', '发送失败,请重试'), { kind: 'error' })
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }, [inputValue, sessionId, messages, scrollToBottom, tt])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  /**
   * 思考中占位:共享屏只在 `isStreaming` 下注入 `chat.thinking`,而本页发送态用的是
   * `isSending`(发送按钮转菊花、不出现无人接管的「停止」)。故在渲染前的投影上补同一语义,
   * 原始 messages 不掺显示态(发送载荷仍用原文)。
   */
  const displayMessages = useMemo(
    () =>
      messages.map((m) =>
        m.role === 'assistant' && !m.content && sending
          ? { ...m, content: tt('aiChatDetail.thinking', '思考中…') }
          : m,
      ),
    [messages, sending, tt],
  )

  const listHeader = loading ? (
    <ScreenSkeleton variant="list" count={4} colorScheme={resolvedTheme} />
  ) : error ? (
    <ErrorState
      message={tt('aiChatDetail.loadFailed', '加载失败')}
      retryLabel={t('common.retry')}
      onRetry={loadData}
      colorScheme={resolvedTheme}
    />
  ) : messages.length === 0 ? (
    <EmptyState title={t('aiChatDetail.empty')} colorScheme={resolvedTheme} />
  ) : null

  return (
    <ThemeRoot>
      <SharedChatScreen
        t={tScreen}
        messages={displayMessages}
        inputText={inputValue}
        isStreaming={false}
        error=""
        models={[]}
        model=""
        pickerOpen={false}
        navItems={[]}
        inputFiles={inputFiles}
        isInputFullscreen={isInputFullscreen}
        isVoiceMode={isVoiceMode}
        isRecording={isRecording}
        isSending={sending}
        inputError={inputError}
        onInputTextChange={setInputValue}
        onSend={() => void sendMessage()}
        onStop={() => undefined}
        onModelChange={() => undefined}
        onPickerOpenChange={() => undefined}
        onLongPressMessage={() => undefined}
        onInputFullscreenToggle={handleFullscreenToggle}
        onInputVoiceToggle={handleVoiceToggle}
        onInputAddImage={() => void handleAddImage()}
        onInputAddFile={() => void handleAddFile()}
        onInputRemoveFile={handleRemoveFile}
        onInputClear={handleClear}
        onInputVoiceStart={() => setIsRecording(true)}
        onInputVoiceEnd={() => setIsRecording(false)}
        onListRef={(ref) => {
          listRef.current = ref as ListHandle | null
        }}
        renderListHeader={listHeader}
        colorScheme={resolvedTheme}
        onNavigate={(target) => void Taro.navigateTo({ url: target })}
        onToast={onToast}
      />
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
