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
import ConversationSidebar from '../components/ConversationSidebar'
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

export default function ChatPage({ onLogout }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')
  const [models, setModels] = useState<LlmModel[]>(FALLBACK_MODELS)
  const [model, setModel] = useState<string>(FALLBACK_MODELS[0]!.id)
  const [notice, setNotice] = useState('')
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [busyFile, setBusyFile] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { t } = useI18n()
  // 会话历史(仅 Tauri 启用)
  const conv = useConversations()
  const [currentConvId, setCurrentConvId] = useState<string | null>(null)
  // messages ref:onDone 闭包需要拿最新值持久化(streaming 累积的内容不在闭包内 messages 里)
  const messagesRef = useRef<ChatMessage[]>([])
  messagesRef.current = messages

  useEffect(() => {
    document.title = 'IHUI AI 桌面端 - 对话'
  }, [])

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

  const onSend = async () => {
    const text = input.trim()
    if ((!text && attachments.length === 0) || streaming) return
    setInput('')
    setError('')
    setNotice('')
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
      },
      { id: `a-${Date.now()}`, role: 'assistant', content: '' },
    ]
    setMessages(next)
    setAttachments([])
    setStreaming(true)

    const controller = new AbortController()
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
    }
  }

  const onStop = () => setStreaming(false)

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
        />
      ) : null}
      <div className="chat-main">
        <header className="page-header">
          <h2>AI 对话</h2>
          <div className="header-actions">
            <select
              className="model-select"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={streaming}
              aria-label="选择模型"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name || m.id}
                </option>
              ))}
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
            <button type="button" onClick={onClear} disabled={streaming || messages.length === 0}>
              清空
            </button>
            <button type="button" onClick={onLogout}>
              退出登录
            </button>
          </div>
        </header>

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
            输入消息开始对话
            <br />
            <span className="empty-state-hint">
              支持拖拽文件 / 粘贴图片 / 点击 📎 按钮选择文件
            </span>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`chat-bubble ${m.role}`}>
              <span className="role">{m.role === 'user' ? '你' : 'AI'}</span>
              <div className="content">
                {m.content || (m.role === 'assistant' ? '...' : '')}
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
                aria-label="移除附件"
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
          aria-label="添加附件"
          title="选择本地文件(图片/文本/PDF)"
        >
          {busyFile ? '⏳' : '📎'}
        </button>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPaste={(e) => {
            void onPaste(e)
          }}
          placeholder={attachments.length > 0 ? '输入消息内容(附件已就绪)...' : '说点什么...'}
          disabled={streaming}
          autoFocus
        />
        {streaming ? (
          <button type="button" onClick={onStop}>
            停止
          </button>
        ) : (
          <button type="submit" disabled={!input.trim() && attachments.length === 0}>
            发送
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
