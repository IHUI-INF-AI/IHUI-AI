import { useCallback, useEffect, useRef, useState } from 'react'
import {
  streamChat,
  fetchModels,
  formatSSEError,
  getModelContextCapacity,
  formatTokenCount,
  type StreamChatOptions,
  type LlmModel,
} from '@ihui/api-client'
import type { ChatAttachment, ChatMessage } from '../lib/types'
import {
  FILE_FILTERS,
  formatFileSize,
  isTauri,
  pickFile,
  readBinaryFile,
  readTextFile,
  sendDesktopNotification,
} from '../lib/desktop'
import { useConversations } from '../hooks/use-conversations'
import { useModelPersist } from '../hooks/use-model-persist'
import { useCodeTheme } from '../hooks/use-code-theme'
import ConversationSidebar from '../components/ConversationSidebar'
import MarkdownRenderer from '../components/MarkdownRenderer'
import PromptTemplates from '../components/PromptTemplates'
import { exportConversationToFile, type ExportFormat } from '../lib/export-conversation'
import { useI18n } from '../i18n'

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'])
const TEXT_EXTENSIONS = new Set(['txt', 'md', 'log', 'csv', 'json', 'xml', 'yml', 'yaml', 'toml'])
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB 单文件上限

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
  // 2026-07-22 新增免费 / 试用 credits provider 兜底(参考 cheahjs/free-llm-api-resources)
  {
    id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    name: 'Llama 3.3 70B Fast (Cloudflare 免费)',
    provider: 'cloudflare_workers_ai',
    context_length: 128000,
    input_price: 0,
  },
  {
    id: 'nvidia/llama-3.1-nemotron-70b-instruct',
    name: 'Llama 3.1 Nemotron 70B (NVIDIA NIM 免费)',
    provider: 'nvidia_nim',
    context_length: 128000,
    input_price: 0,
  },
  {
    id: 'github/gpt-4o',
    name: 'GPT-4o (GitHub Models 免费)',
    provider: 'github_models',
    context_length: 128000,
    input_price: 0,
  },
  {
    id: 'vercel/auto',
    name: 'Vercel AI Gateway Auto',
    provider: 'vercel_ai_gateway',
    context_length: 128000,
    input_price: 0,
  },
  {
    id: 'opencode/big-pickle-stealth',
    name: 'Big Pickle Stealth (OpenCode Zen 免费)',
    provider: 'opencode_zen',
    context_length: 256000,
    input_price: 0,
  },
  {
    id: 'modal/labcompute/qwen2.5-72b',
    name: 'Qwen2.5 72B (Modal 试用 credits)',
    provider: 'modal',
    context_length: 32768,
    input_price: 0,
  },
  {
    id: 'inferencenet/meta-llama/Llama-3.3-70B-Instruct',
    name: 'Llama 3.3 70B (Inference.net 试用 credits)',
    provider: 'inferencenet',
    context_length: 128000,
    input_price: 0,
  },
  {
    id: 'nlpcloud/finetuned-llama-3-70b',
    name: 'Finetuned Llama 3 70B (NLP Cloud 试用 credits)',
    provider: 'nlpcloud',
    context_length: 32768,
    input_price: 0,
  },
  {
    id: 'scaleway/mistral-small-3.2-24b-instruct-2506',
    name: 'Mistral Small 3.2 24B (Scaleway 免费)',
    provider: 'scaleway',
    context_length: 128000,
    input_price: 0,
  },
  {
    id: 'alibaba-intl/qwen-max',
    name: 'Qwen Max (Alibaba Intl 免费)',
    provider: 'alibaba_intl',
    context_length: 131072,
    input_price: 0,
  },
]

interface Props {
  onLogout: () => void
}

/** 格式化消息时间戳:同一天显示 HH:MM,跨天显示 MM-DD HH:MM。 */
function formatMsgTime(ts: number | undefined, locale: string): string {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  const intlLocale = locale === 'zh-CN' || locale === 'zh-TW' ? 'zh-CN' : locale === 'en' ? 'en-US' : locale
  if (sameDay) {
    return new Intl.DateTimeFormat(intlLocale, { hour: '2-digit', minute: '2-digit' }).format(d)
  }
  return new Intl.DateTimeFormat(intlLocale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export default function ChatPage({ onLogout }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')
  const [models, setModels] = useState<LlmModel[]>(FALLBACK_MODELS)
  const [model, setModel] = useModelPersist(FALLBACK_MODELS[0]!.id)
  // 代码块语法高亮主题跟随应用主题(light→github.css / dark→github-dark.css)
  useCodeTheme()
  const [notice, setNotice] = useState('')
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [busyFile, setBusyFile] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { t, locale } = useI18n()
  // 会话历史(仅 Tauri 启用)
  const conv = useConversations()
  const [currentConvId, setCurrentConvId] = useState<string | null>(null)
  // messages ref:onDone 闭包需要拿最新值持久化(streaming 累积的内容不在闭包内 messages 里)
  const messagesRef = useRef<ChatMessage[]>([])
  messagesRef.current = messages
  // AbortController ref:onStop 真正 abort 流式请求(不是只 setStreaming(false))
  const abortRef = useRef<AbortController | null>(null)
  // 消息编辑(inline edit + resend)
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  // 对话导出菜单
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  // 对话搜索
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  // 过滤后的消息(搜索时只显示匹配项)
  const filteredMessages = searchQuery
    ? messages.filter((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages
  // 最后一条 AI 消息 id(用于显示"重新生成"按钮)
  const lastAssistantId = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (m && m.role === 'assistant') return m.id
    }
    return null
  })()

  useEffect(() => {
    document.title = 'IHUI AI 桌面端 - 对话'
  }, [])

  // 点击外部关闭导出菜单
  useEffect(() => {
    if (!exportMenuOpen) return
    const onDocClick = () => setExportMenuOpen(false)
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [exportMenuOpen])

  useEffect(() => {
    let cancelled = false
    fetchModels()
      .then((res) => {
        if (cancelled) return
        const list = res?.models?.length ? res.models : FALLBACK_MODELS
        setModels(list)
        // persisted model 优先,其次 API default,最后列表首个
        const persistedValid = list.some((m) => m.id === model)
        const def = persistedValid
          ? model
          : res.default && list.some((m) => m.id === res.default)
            ? res.default
            : list[0]!.id
        setModel(def)
      })
      .catch(() => {
        if (!cancelled) setModels(FALLBACK_MODELS)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 首次加载:hook ready 后,若存在 activeId,自动加载历史会话
  useEffect(() => {
    if (!conv.ready || !conv.enabled) return
    if (currentConvId !== null) return // 已加载过
    if (conv.activeId) {
      void conv.select(conv.activeId).then((c) => {
        if (c && c.messages.length > 0) {
          setMessages(
            c.messages.map((m) => ({
              id: m.id,
              role: m.role as 'user' | 'assistant',
              content: m.content,
            })),
          )
          setCurrentConvId(c.id)
        }
      })
    }
  }, [conv.ready, conv.enabled, conv.activeId, currentConvId, conv])

  // 切换会话:加载该会话消息,同步 currentConvId
  const onSelectConversation = useCallback(
    async (id: string) => {
      if (streaming) return
      if (id === currentConvId) return
      const c = await conv.select(id)
      setMessages(
        c?.messages?.length
          ? c.messages.map((m) => ({
              id: m.id,
              role: m.role as 'user' | 'assistant',
              content: m.content,
            }))
          : [],
      )
      setCurrentConvId(id)
      setError('')
      setNotice('')
    },
    [streaming, currentConvId, conv],
  )

  // 新建会话:清空 messages + activeId
  const onNewConversation = useCallback(async () => {
    if (streaming) return
    await conv.startNew()
    setMessages([])
    setCurrentConvId(null)
    setError('')
    setNotice('')
  }, [streaming, conv])

  // 删除会话:若删的是当前,清空 messages
  const onDeleteConversation = useCallback(
    async (id: string) => {
      await conv.remove(id)
      if (id === currentConvId) {
        setMessages([])
        setCurrentConvId(null)
      }
    },
    [conv, currentConvId],
  )

  // 持久化当前会话(发完一条消息后调用)
  const persistConversation = useCallback(
    async (msgs: ChatMessage[]) => {
      if (!conv.enabled || msgs.length === 0) return
      const id = currentConvId ?? `c-${Date.now()}`
      const firstUser = msgs.find((m) => m.role === 'user')
      const title = firstUser ? firstUser.content.slice(0, 40).replace(/\n/g, ' ') : '新会话'
      const stored = msgs.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
      }))
      await conv.persist(id, title, stored)
      if (currentConvId === null) setCurrentConvId(id)
    },
    [conv, currentConvId],
  )

  // 消息复制
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null)
  const onCopyMessage = useCallback(
    async (m: ChatMessage) => {
      try {
        await navigator.clipboard.writeText(m.content)
        setCopiedMsgId(m.id)
        window.setTimeout(() => setCopiedMsgId(null), 1500)
      } catch {
        // 静默
      }
    },
    [],
  )

  // 对话导出
  const onExportConversation = useCallback(
    async (format: ExportFormat) => {
      setExportMenuOpen(false)
      if (streaming || messages.length === 0) return
      const firstUser = messages.find((m) => m.role === 'user')
      const title = firstUser
        ? firstUser.content.slice(0, 40).replace(/\n/g, ' ')
        : t('chat.newChat')
      try {
        const path = await exportConversationToFile({ format, title, messages })
        if (path) {
          setNotice(`${t('chat.exportDone')}:${path}`)
          setError('')
        }
      } catch (err) {
        setError(`${t('chat.exportFailed')}:${err instanceof Error ? err.message : String(err)}`)
      }
    },
    [streaming, messages, t],
  )

  /** 从扩展名判断是否图片。 */
  const isImageExt = (ext: string): boolean => IMAGE_EXTENSIONS.has(ext.toLowerCase())

  /** 从扩展名判断是否文本。 */
  const isTextExt = (ext: string): boolean => TEXT_EXTENSIONS.has(ext.toLowerCase())

  /** 处理单个文件路径,读取内容生成 ChatAttachment。 */
  const ingestFile = async (filePath: string): Promise<ChatAttachment | null> => {
    const name = filePath.split(/[\\/]/).pop() || filePath
    const ext = name.split('.').pop() || ''
    try {
      if (isImageExt(ext)) {
        const r = await readBinaryFile(filePath)
        if (r.size > MAX_FILE_SIZE) {
          setError(`文件过大(> ${formatFileSize(MAX_FILE_SIZE)}):${name}`)
          return null
        }
        return {
          name,
          mime: r.mime,
          size: r.size,
          data: `data:${r.mime};base64,${r.base64}`,
          isImage: true,
        }
      }
      if (isTextExt(ext)) {
        const r = await readTextFile(filePath)
        if (r.size > MAX_FILE_SIZE) {
          setError(`文件过大(> ${formatFileSize(MAX_FILE_SIZE)}):${name}`)
          return null
        }
        return {
          name,
          mime: ext === 'json' ? 'application/json' : 'text/plain',
          size: r.size,
          data: r.content,
          isImage: false,
        }
      }
      // 其他二进制文件:读 base64,但限制 1 MB(避免超长 base64 拖慢聊天)
      if (isTauri()) {
        const stat = await readBinaryFile(filePath)
        if (stat.size > 1024 * 1024) {
          setError(`二进制文件过大(> 1 MB):${name}`)
          return null
        }
        return {
          name,
          mime: stat.mime,
          size: stat.size,
          data: `data:${stat.mime};base64,${stat.base64}`,
          isImage: false,
        }
      }
      setError(`暂不支持的文件类型:${ext}`)
      return null
    } catch (e) {
      setError(`读取文件失败:${e instanceof Error ? e.message : String(e)}`)
      return null
    }
  }

  /** 文件选择按钮(打开原生对话框)。 */
  const onPickFile = async () => {
    if (busyFile || streaming) return
    setBusyFile(true)
    setError('')
    try {
      const filePath = await pickFile([FILE_FILTERS.images, FILE_FILTERS.text, FILE_FILTERS.pdf, FILE_FILTERS.all])
      if (!filePath) {
        setBusyFile(false)
        return
      }
      const att = await ingestFile(filePath)
      if (att) {
        setAttachments((cur) => [...cur, att])
      }
    } finally {
      setBusyFile(false)
    }
  }

  /** 拖拽放置处理。 */
  const onDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    if (streaming || busyFile) return
    // Tauri 拖拽事件:files 是文件路径(通过 dataTransfer.items 或 effectAllowed)
    // 实际 Tauri 2 中,拖拽文件路径通过 getCurrentWebview().onDragDropEvent 在 Rust 端监听
    // Web Drop API 在 Tauri 中 dataTransfer.files 为空,改用 Rust 事件 — 这里保留兜底
    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return
    setBusyFile(true)
    setError('')
    try {
      // Tauri 2 拖拽:file 对象的 path 属性可用
      const paths = files.map((f) => (f as unknown as { path?: string }).path).filter(Boolean) as string[]
      if (paths.length === 0) {
        setError('拖拽文件需要桌面端环境(Tauri),浏览器无法获取文件路径')
        return
      }
      for (const p of paths) {
        const att = await ingestFile(p)
        if (att) {
          setAttachments((cur) => [...cur, att])
        }
      }
    } finally {
      setBusyFile(false)
    }
  }

  /** 粘贴处理(支持图片 + 文件路径文本)。 */
  const onPaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (streaming || busyFile) return
    const items = e.clipboardData?.items
    if (!items) return
    let handled = false
    setBusyFile(true)
    setError('')
    try {
      for (const item of Array.from(items)) {
        if (item.kind === 'file') {
          const file = item.getAsFile()
          if (!file) continue
          // 浏览器 File API:读取为 base64 / text
          const ext = (file.name.split('.').pop() || '').toLowerCase()
          if (file.size > MAX_FILE_SIZE) {
            setError(`文件过大(> ${formatFileSize(MAX_FILE_SIZE)}):${file.name}`)
            continue
          }
          if (isImageExt(ext) || file.type.startsWith('image/')) {
            const dataUrl = await readFileAsDataURL(file)
            setAttachments((cur) => [
              ...cur,
              {
                name: file.name,
                mime: file.type || 'image/png',
                size: file.size,
                data: dataUrl,
                isImage: true,
              },
            ])
            handled = true
          } else if (isTextExt(ext) || file.type.startsWith('text/')) {
            const text = await file.text()
            setAttachments((cur) => [
              ...cur,
              {
                name: file.name,
                mime: file.type || 'text/plain',
                size: file.size,
                data: text,
                isImage: false,
              },
            ])
            handled = true
          }
        }
      }
    } finally {
      setBusyFile(false)
      if (handled) e.preventDefault()
    }
  }

  /** 删除附件。 */
  const onRemoveAttachment = (idx: number) => {
    setAttachments((cur) => cur.filter((_, i) => i !== idx))
  }

  /** 启动流式聊天(共享给 onSend / onRegenerate / onSubmitEdit)。 */
  const runStream = async (next: ChatMessage[]) => {
    setStreaming(true)
    setError('')
    setNotice('')
    const controller = new AbortController()
    abortRef.current = controller
    const timeoutId = window.setTimeout(() => controller.abort(), 15_000)
    const opts: StreamChatOptions = {
      model,
      messages: next
        .filter((m) => m.content || m.role === 'user')
        .map(({ role, content }) => ({ role, content: content || ' ' })),
      signal: controller.signal,
      // 跨端统一 88% 阈值自动压缩:从模型 ID 推断 contextLimit,后端压缩后通过 SSE 回调提示用户
      contextLimit: getModelContextCapacity(model),
      onCompaction: (info) => {
        setNotice(
          `上下文已自动压缩:${formatTokenCount(info.tokensBefore)} → ${formatTokenCount(info.tokensAfter)}(移除 ${info.removedCount} 条历史)`,
        )
      },
      onDelta: (delta) => {
        window.clearTimeout(timeoutId)
        setMessages((cur) => {
          const copy = [...cur]
          const last = copy[copy.length - 1]
          if (last?.role === 'assistant') {
            copy[copy.length - 1] = { ...last, content: last.content + delta }
          }
          return copy
        })
      },
      onError: (msg) => {
        window.clearTimeout(timeoutId)
        const formatted = formatSSEError(new Error(msg))
        setMessages((cur) => {
          const copy = [...cur]
          const last = copy[copy.length - 1]
          if (last?.role === 'assistant') {
            copy[copy.length - 1] = {
              ...last,
              content: last.content || `⚠ ${formatted.title}: ${formatted.message}`,
            }
          }
          return copy
        })
        setError(formatted.message)
        setStreaming(false)
      },
      onDone: () => {
        window.clearTimeout(timeoutId)
        setStreaming(false)
        // 标记最后一条 AI 消息的完成时间(用于时间戳显示)
        const doneAt = Date.now()
        setMessages((cur) => {
          const copy = [...cur]
          const last = copy[copy.length - 1]
          if (last?.role === 'assistant') {
            copy[copy.length - 1] = { ...last, createdAt: last.createdAt ?? doneAt }
          }
          return copy
        })
        // 窗口隐藏(最小化到托盘)时发送系统通知
        if (document.hidden) {
          sendDesktopNotification('AI 回复完成', '点击托盘图标查看新消息')
        }
        // 持久化会话(非阻塞)
        void persistConversation(messagesRef.current)
      },
    }
    try {
      await streamChat(opts)
    } catch (err) {
      window.clearTimeout(timeoutId)
      const formatted = formatSSEError(err)
      setError(formatted.message)
      setStreaming(false)
    } finally {
      abortRef.current = null
    }
  }

  const onSend = async () => {
    const text = input.trim()
    if ((!text && attachments.length === 0) || streaming) return
    setInput('')
    // 拼接附件摘要到消息内容,便于 LLM 理解
    const attSummary =
      attachments.length > 0
        ? attachments
            .map((a) =>
              a.isImage
                ? `[图片:${a.name}]`
                : a.isImage === false && a.mime.startsWith('text/')
                  ? `\n\n--- 附件:${a.name} ---\n${a.data.slice(0, 2000)}${a.data.length > 2000 ? '\n...(已截断)' : ''}\n--- 附件结束 ---`
                  : `[附件:${a.name}(${a.mime})]`,
            )
            .join('\n')
        : ''
    const userContent = attSummary ? `${text}\n${attSummary}` : text
    const pendingAttachments = attachments
    const next: ChatMessage[] = [
      ...messages,
      {
        id: `u-${Date.now()}`,
        role: 'user',
        content: userContent || '(仅附件)',
        attachments: pendingAttachments.length > 0 ? pendingAttachments : undefined,
        createdAt: Date.now(),
      },
      { id: `a-${Date.now()}`, role: 'assistant', content: '', createdAt: Date.now() },
    ]
    setMessages(next)
    setAttachments([])
    await runStream(next)
  }

  /** 重新生成最后一条 AI 消息:删除其后所有消息,用最后一条 user 消息重发。 */
  const onRegenerate = async () => {
    if (streaming) return
    let lastUserIdx = -1
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (m && m.role === 'user') {
        lastUserIdx = i
        break
      }
    }
    if (lastUserIdx === -1) return
    const retained = messages.slice(0, lastUserIdx + 1)
    const next: ChatMessage[] = [
      ...retained,
      { id: `a-${Date.now()}`, role: 'assistant', content: '', createdAt: Date.now() },
    ]
    setMessages(next)
    await runStream(next)
  }

  const onStop = () => {
    abortRef.current?.abort()
    setStreaming(false)
  }

  /** 开始编辑用户消息:inline 编辑,重发后删除其后所有消息(含 AI 回复)。 */
  const onStartEdit = (m: ChatMessage) => {
    if (streaming) return
    setEditingMsgId(m.id)
    setEditContent(m.content)
  }

  const onCancelEdit = () => {
    setEditingMsgId(null)
    setEditContent('')
  }

  /** 提交编辑:用编辑后内容替换原消息,删除其后所有消息,加空 AI 占位,重发。 */
  const onSubmitEdit = async () => {
    if (!editingMsgId || streaming) return
    const text = editContent.trim()
    if (!text) return
    const editIdx = messages.findIndex((m) => m.id === editingMsgId)
    if (editIdx === -1) {
      setEditingMsgId(null)
      return
    }
    const retained = messages.slice(0, editIdx)
    const next: ChatMessage[] = [
      ...retained,
      { id: `u-${Date.now()}`, role: 'user', content: text, createdAt: Date.now() },
      { id: `a-${Date.now()}`, role: 'assistant', content: '', createdAt: Date.now() },
    ]
    setMessages(next)
    setEditingMsgId(null)
    setEditContent('')
    await runStream(next)
  }

  const onClear = () => {
    if (streaming) return
    void onNewConversation()
  }

  return (
    <div className={`chat-page${conv.enabled ? ' chat-page--with-sidebar' : ''}`}>
      {conv.enabled ? (
        <ConversationSidebar
          list={conv.list}
          activeId={currentConvId}
          onSelect={(id) => void onSelectConversation(id)}
          onDelete={(id) => void onDeleteConversation(id)}
          onNew={() => void onNewConversation()}
          onRename={(id, title) => conv.rename(id, title)}
        />
      ) : null}
      <div className="chat-main">
        <header className="page-header">
          <h2>{t('chat.title')}</h2>
          <div className="header-actions">
            <select
              className="model-select"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={streaming}
              aria-label={t('chat.modelSelect')}
              title={t('chat.modelSelect')}
            >
              {(() => {
                // 按 provider 分组,提升浏览体验(避免长列表)
                const groups = new Map<string, LlmModel[]>()
                for (const m of models) {
                  const p = m.provider || 'other'
                  const arr = groups.get(p)
                  if (arr) arr.push(m)
                  else groups.set(p, [m])
                }
                return Array.from(groups.entries()).map(([provider, list]) => (
                  <optgroup key={provider} label={provider}>
                    {list.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name || m.id}
                      </option>
                    ))}
                  </optgroup>
                ))
              })()}
            </select>
            {conv.enabled ? (
              <button
                type="button"
                onClick={() => void onNewConversation()}
                disabled={streaming}
              >
                {t('chat.newChat')}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              disabled={messages.length === 0}
              title={t('chat.search')}
              aria-label={t('chat.search')}
              className={searchOpen ? 'active' : undefined}
            >
              {t('chat.search')}
            </button>
            <div className="export-dropdown">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setExportMenuOpen((v) => !v)
                }}
                disabled={streaming || messages.length === 0}
                title={t('chat.exportConversation')}
              >
                {t('chat.exportConversation')}
              </button>
              {exportMenuOpen ? (
                <div className="export-menu" onClick={(e) => e.stopPropagation()}>
                  <button type="button" onClick={() => void onExportConversation('markdown')}>
                    {t('chat.exportAsMarkdown')}
                  </button>
                  <button type="button" onClick={() => void onExportConversation('json')}>
                    {t('chat.exportAsJson')}
                  </button>
                  <button type="button" onClick={() => void onExportConversation('txt')}>
                    {t('chat.exportAsTxt')}
                  </button>
                </div>
              ) : null}
            </div>
            <button type="button" onClick={onClear} disabled={streaming || messages.length === 0}>
              {t('chat.clear')}
            </button>
            <button type="button" onClick={onLogout}>
              {t('auth.logout')}
            </button>
          </div>
        </header>

        {searchOpen ? (
          <div className="chat-search-bar">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('chat.searchPlaceholder')}
              autoFocus
              aria-label={t('chat.search')}
            />
            <span className="chat-search-count">
              {searchQuery
                ? `${filteredMessages.length}/${messages.length}`
                : ''}
            </span>
            <button
              type="button"
              className="chat-search-close"
              onClick={() => {
                setSearchOpen(false)
                setSearchQuery('')
              }}
              aria-label={t('common.close')}
            >
              ×
            </button>
          </div>
        ) : null}

        <div
          className={`chat-list${dragOver ? ' chat-list--drag-over' : ''}`}
          data-testid="chat-list"
        onDragOver={(e) => {
          e.preventDefault()
          if (!dragOver) setDragOver(true)
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDragOver(false)
        }}
        onDrop={(e) => {
          void onDrop(e)
        }}
      >
        {messages.length === 0 ? (
          <div className="empty-state">
            {t('chat.emptyState')}
            <br />
            <span className="empty-state-hint">
              {t('desktop.dragHint')}
            </span>
          </div>
        ) : filteredMessages.length === 0 && searchQuery ? (
          <div className="empty-state">
            {t('chat.noSearchResults', { query: searchQuery })}
          </div>
        ) : (
          filteredMessages.map((m) => (
            <div key={m.id} className={`chat-bubble ${m.role}${searchQuery && m.content.toLowerCase().includes(searchQuery.toLowerCase()) ? ' chat-bubble--match' : ''}`}>
              <div className="msg-header">
                <span className="role">
                  {m.role === 'user' ? t('chat.roleUser') : t('chat.roleAI')}
                </span>
                {m.createdAt ? (
                  <span className="msg-time" title={new Date(m.createdAt).toLocaleString(locale)}>
                    {formatMsgTime(m.createdAt, locale)}
                  </span>
                ) : null}
              </div>
              <div className="content">
                {editingMsgId === m.id ? (
                  <div className="msg-edit-form">
                    <textarea
                      className="msg-edit-textarea"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      autoFocus
                      rows={3}
                      aria-label={t('chat.edit')}
                    />
                    <div className="msg-edit-actions">
                      <button
                        type="button"
                        onClick={() => void onSubmitEdit()}
                        disabled={!editContent.trim() || streaming}
                      >
                        {t('common.save')}
                      </button>
                      <button type="button" onClick={onCancelEdit}>
                        {t('common.cancel')}
                      </button>
                    </div>
                  </div>
                ) : m.role === 'assistant' ? (
                  m.content ? (
                    <MarkdownRenderer content={m.content} />
                  ) : (
                    '...'
                  )
                ) : (
                  <div className="md-plain">{m.content}</div>
                )}
                {m.attachments && m.attachments.length > 0 ? (
                  <div className="msg-attachments">
                    {m.attachments.map((att, i) => (
                      <div key={`${m.id}-att-${i}`} className="msg-attachment">
                        {att.isImage ? (
                          <img
                            src={att.data}
                            alt={att.name}
                            className="msg-attachment-img"
                            loading="lazy"
                          />
                        ) : (
                          <div className="msg-attachment-file">
                            <span className="msg-attachment-name">{att.name}</span>
                            <span className="msg-attachment-size">{formatFileSize(att.size)}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
              {m.content && editingMsgId !== m.id ? (
                <button
                  type="button"
                  className="msg-copy-btn"
                  onClick={() => void onCopyMessage(m)}
                  aria-label={t('chat.copyMessage')}
                  title={t('chat.copyMessage')}
                >
                  {copiedMsgId === m.id ? t('chat.copied') : t('chat.copy')}
                </button>
              ) : null}
              {m.role === 'user' && m.content && editingMsgId !== m.id && !streaming ? (
                <button
                  type="button"
                  className="msg-edit-btn"
                  onClick={() => onStartEdit(m)}
                  aria-label={t('chat.edit')}
                  title={t('chat.editHint')}
                >
                  {t('chat.edit')}
                </button>
              ) : null}
              {m.role === 'assistant' && m.content && m.id === lastAssistantId && !streaming ? (
                <button
                  type="button"
                  className="msg-regenerate-btn"
                  onClick={() => void onRegenerate()}
                  aria-label={t('chat.regenerate')}
                  title={t('chat.regenerate')}
                >
                  {t('chat.regenerate')}
                </button>
              ) : null}
            </div>
          ))
        )}
      </div>

      {notice ? <div className="notice-banner">{notice}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}

      {attachments.length > 0 ? (
        <div className="attachment-preview" data-testid="attachment-preview">
          {attachments.map((att, idx) => (
            <div key={`att-${idx}`} className="attachment-item">
              {att.isImage ? (
                <img src={att.data} alt={att.name} className="attachment-thumb" />
              ) : (
                <div className="attachment-file-icon">📄</div>
              )}
              <div className="attachment-info">
                <div className="attachment-name" title={att.name}>
                  {att.name}
                </div>
                <div className="attachment-size">{formatFileSize(att.size)}</div>
              </div>
              <button
                type="button"
                className="attachment-remove"
                onClick={() => onRemoveAttachment(idx)}
                aria-label={t('desktop.removeAttachment')}
                disabled={streaming}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault()
          void onSend()
        }}
      >
        <button
          type="button"
          className="attach-btn"
          onClick={() => void onPickFile()}
          disabled={busyFile || streaming}
          aria-label={t('desktop.attachFile')}
          title={t('desktop.attachFile')}
        >
          {busyFile ? '⏳' : '📎'}
        </button>
        <PromptTemplates
          disabled={streaming}
          onPick={(text) => {
            setInput((cur) => (cur ? `${cur}\n${text}` : text))
            inputRef.current?.focus()
          }}
        />
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPaste={(e) => {
            void onPaste(e)
          }}
          placeholder={attachments.length > 0 ? t('chat.placeholderWithAttachments') : t('chat.placeholder')}
          disabled={streaming}
          autoFocus
        />
        {streaming ? (
          <button type="button" onClick={onStop}>
            {t('chat.stop')}
          </button>
        ) : (
          <button type="submit" disabled={!input.trim() && attachments.length === 0}>
            {t('chat.send')}
          </button>
        )}
      </form>
      </div>
    </div>
  )
}

/** 浏览器 File API:读为 data URL(用于粘贴的图片)。 */
function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
