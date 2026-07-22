'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { streamChat, formatSSEError } from '@ihui/api-client'

import { useChatStore } from '@/stores/chat'
import type { ToolCall } from '@/stores/chat'
import { useAuthStore } from '@/stores/auth'
import { useLoginDialogStore } from '@/stores/login-dialog'
import { useAiPanelStore } from '@/stores/ai-panel'
import { useWorkPanelStore } from '@/stores/work-panel'
import { createConversation, sendMessage as persistMessage, persistQuestion } from '@/lib/chat-api'
import { fetchApi } from '@/lib/api'
import { logger } from '@/lib/logger'
import { getModelContextCapacity, formatTokenCount } from '@/lib/model-context-capacity'

/** 自媒体斜杠命令 API 返回数据 */
interface SlashCommandData {
  ok?: boolean
  title?: string
  mdPath?: string
  duration_ms?: number
  error?: string
  stdout?: string
  date?: string
  articlesCount?: number
  outputPath?: string
  articles?: Array<Record<string, unknown>>
}

/** 自媒体斜杠命令 fetchApi 结果 */
interface SlashCommandResult {
  success: boolean
  error?: string
  data?: SlashCommandData
}

// 斜杠命令 → 自媒体 skill 直调映射(避免走 LLM chat 流,直接调 skill API)
// /wechat-article <title>  → POST /api/self-media/wechat/generate {title, dryRun:true}
// /koubo-script <MMDD>     → POST /api/self-media/koubo/generate {date, dryRun:true}
// /auto-task <taskId> <HH:MM> [titleTemplate]  → POST /api/self-media/automation/tasks/:taskId/config
//   taskId: wechat_daily | koubo_daily(仅这 2 个内置任务可配置)
//   时间格式: HH:MM(24 小时制),默认 09:00
//   titleTemplate: 可选,仅 wechat_daily 用,支持 {date} 占位符
const SELF_MEDIA_SLASH_MAP = {
  '/wechat-article': {
    endpoint: '/api/self-media/wechat/generate',
    parseArgs: (rest: string) => ({ title: rest || '今日公众号文章' }),
    format: (r: SlashCommandResult) => {
      if (!r.success) return `❌ 公众号文章生成失败: ${r.error || '未知错误'}`
      const d: SlashCommandData = r.data || {}
      const ok = d.ok ?? false
      const lines = [
        `### 公众号文章生成 ${ok ? '✅' : '⚠️'}`,
        `- 标题: ${d.title || ''}`,
        `- md 路径: ${d.mdPath || '(无)'}`,
        `- 耗时: ${d.duration_ms ?? 0} ms`,
      ]
      if (d.error) lines.push(`- 错误: ${d.error}`)
      if (d.stdout) lines.push('\n```\n' + String(d.stdout).slice(0, 2000) + '\n```')
      return lines.join('\n')
    },
  },
  '/koubo-script': {
    endpoint: '/api/self-media/koubo/generate',
    parseArgs: (rest: string) => {
      // rest 可能是 "MMDD" 或 "MMDD 选题方向"
      const [date, ...topicParts] = rest.split(/\s+/)
      return { date: date || '0720', topic: topicParts.join(' ') }
    },
    format: (r: SlashCommandResult) => {
      if (!r.success) return `❌ 口播稿生成失败: ${r.error || '未知错误'}`
      const d: SlashCommandData = r.data || {}
      const ok = d.ok ?? false
      const lines = [
        `### 口播稿生成 ${ok ? '✅' : '⚠️'}`,
        `- 日期: ${d.date || ''}`,
        `- 篇数: ${d.articlesCount ?? 0}`,
        `- 输出: ${d.outputPath || '(无)'}`,
        `- 耗时: ${d.duration_ms ?? 0} ms`,
      ]
      if (d.error) lines.push(`- 错误: ${d.error}`)
      const articles: Array<Record<string, unknown>> = d.articles || []
      if (articles.length) {
        lines.push('\n---')
        for (const a of articles.slice(0, 8)) {
          lines.push(`\n#### 第 ${a.index} 篇\n\n${a.content || ''}`)
        }
      }
      return lines.join('\n')
    },
  },
} as const

/** /auto-task 斜杠命令:配置自媒体自动化定时任务(2026-07-22 新增)
 *  格式:/auto-task <taskId> <HH:MM> [titleTemplate]
 *  示例:/auto-task wechat_daily 09:00
 *        /auto-task koubo_daily 08:00
 *  说明:直接调 /api/self-media/automation/tasks/:taskId/config,不走 LLM chat 流 */
async function tryHandleAutoTaskSlash(
  text: string,
  onResult: (assistantContent: string) => void,
): Promise<boolean> {
  const trimmed = text.trim()
  if (trimmed !== '/auto-task' && !trimmed.startsWith('/auto-task ') && !trimmed.startsWith('/auto-task\n')) {
    return false
  }
  const rest = trimmed.slice('/auto-task'.length).trim()
  const [taskIdRaw, timeRaw, ...titleParts] = rest.split(/\s+/)
  const taskId = taskIdRaw === 'koubo_daily' ? 'koubo_daily' : 'wechat_daily'
  const [h, m] = (timeRaw || '09:00').split(':').map(Number)
  const hour = typeof h === 'number' && Number.isFinite(h) && h >= 0 && h <= 23 ? h : 9
  const minute = typeof m === 'number' && Number.isFinite(m) && m >= 0 && m <= 59 ? m : 0
  const titleTemplate = titleParts.join(' ') || undefined
  try {
    const r = await fetchApi<{
      ok: boolean
      message?: string
      error?: string
      config?: { dry_run?: boolean; enabled?: boolean }
    }>(`/api/self-media/automation/tasks/${encodeURIComponent(taskId)}/config`, {
      method: 'POST',
      body: JSON.stringify({
        hour,
        minute,
        dry_run: true,
        enabled: true,
        ...(titleTemplate ? { title_template: titleTemplate } : {}),
      }),
    })
    if (!r.success) {
      onResult(`❌ 自动化任务配置失败: ${r.error}`)
      return true
    }
    const d = r.data
    if (!d.ok) {
      onResult(`❌ 自动化任务配置失败: ${d.message || d.error || '未知错误'}`)
      return true
    }
    const cfg = d.config || {}
    const lines = [
      `### 自动化任务配置 ✅`,
      `- 任务 ID: ${taskId}`,
      `- 执行时间: 每天 ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      `- dry-run: ${cfg.dry_run ? '是' : '否'}`,
      `- 已启用: ${cfg.enabled ? '是' : '否'}`,
    ]
    if (titleTemplate) lines.push(`- 标题模板: ${titleTemplate}`)
    lines.push(`\n请在自动化任务页面查看详情,点击"立即触发"可测试运行。`)
    onResult(lines.join('\n'))
  } catch (e: unknown) {
    onResult(`❌ /auto-task 调用失败: ${e instanceof Error ? e.message : String(e)}`)
  }
  return true
}

async function tryHandleSelfMediaSlash(
  text: string,
  onResult: (assistantContent: string) => void,
): Promise<boolean> {
  // 返回 true 表示命中斜杠命令(已调 skill),false 表示走原 chat 流程
  // 优先检查 /auto-task(独立处理,因 endpoint 含路径参数)
  if (await tryHandleAutoTaskSlash(text, onResult)) return true
  const trimmed = text.trim()
  const matched = Object.keys(SELF_MEDIA_SLASH_MAP).find(
    (cmd) => trimmed === cmd || trimmed.startsWith(cmd + ' ') || trimmed.startsWith(cmd + '\n'),
  )
  if (!matched) return false
  const cfg = SELF_MEDIA_SLASH_MAP[matched as keyof typeof SELF_MEDIA_SLASH_MAP]
  const rest = trimmed.slice(matched.length).trim()
  const body = cfg.parseArgs(rest)
  try {
    const r = await fetchApi<SlashCommandData>(cfg.endpoint, {
      method: 'POST',
      body: JSON.stringify({ ...body, dryRun: true }),
    })
    onResult(cfg.format(r))
  } catch (e: unknown) {
    onResult(`❌ ${matched} 调用失败: ${e instanceof Error ? e.message : String(e)}`)
  }
  return true
}

/** Agent 工具名列表(2026-07-22 立,AI 浏览器/电脑控制):
 *  传入 streamChat → api /ai/chat/stream → ai-service /api/llm/complete/stream
 *  ai-service 收到后从 mcp_server 加载完整 schema,走 tool loop(complete→tool_calls→execute→astream)
 *  12 browser tools + 10 computer tools = 22 个 */
const AGENT_TOOLS = [
  // 12 browser tools
  'browser_screenshot',
  'browser_click_element',
  'browser_type_text',
  'browser_scroll',
  'browser_navigate',
  'browser_extract_dom',
  'browser_wait_for_element',
  'browser_get_attribute',
  'browser_hover',
  'browser_select_option',
  'browser_switch_tab',
  'browser_close_tab',
  // 10 computer tools
  'computer_screenshot_screen',
  'computer_mouse_move',
  'computer_mouse_click',
  'computer_keyboard_type',
  'computer_mouse_scroll',
  'computer_keyboard_press',
  'computer_keyboard_hotkey',
  'computer_active_window',
  'computer_clipboard_get',
  'computer_clipboard_set',
] as const

/** 浏览器类工具:命中即自动在右侧 WorkPanel 打开 URL(2026-07-22 立,P2 联动) */
const BROWSER_TOOL_NAMES = new Set([
  'browser_navigate',
  'browser_click',
  'browser_extract',
  'browser_screenshot',
  'web_search',
  'fetch-url',
  'fetch_url',
  'web_fetch',
])

/** 从 tool args/result 提取 URL(与 tool-call-card.tsx extractUrl 逻辑一致) */
function extractToolUrl(
  args?: Record<string, unknown>,
  result?: unknown,
): string | null {
  if (args) {
    const fromArgs =
      (args.url as string) ||
      (args.href as string) ||
      (args.link as string) ||
      (args.target as string)
    if (typeof fromArgs === 'string' && /^https?:\/\//i.test(fromArgs)) return fromArgs
  }
  if (typeof result === 'string') {
    const match = result.match(/https?:\/\/[^\s"'<>]+/i)
    if (match) return match[0]
  } else if (result && typeof result === 'object') {
    const obj = result as Record<string, unknown>
    const fromResult =
      (obj.url as string) || (obj.href as string) || (obj.link as string)
    if (typeof fromResult === 'string' && /^https?:\/\//i.test(fromResult)) return fromResult
  }
  if (Array.isArray(result)) {
    const first = result.find((r) => {
      if (typeof r === 'object' && r !== null) {
        const u = (r as Record<string, unknown>).url
        return typeof u === 'string' && /^https?:\/\//i.test(u)
      }
      return false
    })
    if (first) return (first as Record<string, unknown>).url as string
  }
  return null
}

/** onToolCall 工厂:绑定 assistantMessageId,生成统一 handler 给 streamChat 用 */
function createToolCallHandler(assistantMessageId: string) {
  return (event: {
    type: 'tool-call-start' | 'tool-result'
    toolCallId: string
    toolName: string
    args?: Record<string, unknown>
    result?: unknown
    isError?: boolean
    iteration?: number
  }) => {
    if (event.type === 'tool-call-start') {
      useChatStore.getState().addToolCall(assistantMessageId, {
        id: event.toolCallId,
        toolName: event.toolName,
        args: event.args ?? {},
        status: 'running',
        iteration: event.iteration,
      })
      // browser_navigate 类工具:args 含 url 时立即打开 WorkPanel(无需等 result)
      if (BROWSER_TOOL_NAMES.has(event.toolName) && event.args) {
        const url = extractToolUrl(event.args)
        if (url) {
          useWorkPanelStore.getState().openPanel({ url, source: 'ai-tool' })
        }
      }
    } else {
      // tool-result
      const updates: Partial<ToolCall> = {
        status: event.isError ? 'error' : 'success',
        result: event.result,
      }
      if (event.args) updates.args = event.args
      if (event.iteration !== undefined) updates.iteration = event.iteration
      useChatStore.getState().updateToolCall(assistantMessageId, event.toolCallId, updates)

      // tool-result 含 URL:延迟打开(仅当之前 args 没 url 时,result 含 url 的场景)
      if (!BROWSER_TOOL_NAMES.has(event.toolName)) return
      const url = extractToolUrl(event.args, event.result)
      if (url) {
        useWorkPanelStore.getState().openPanel({ url, source: 'ai-tool' })
      }
    }
  }
}

export interface UseChatReturn {
  messages: ReturnType<typeof useChatStore.getState>['messages']
  currentModel: string
  isStreaming: boolean
  error: string | null
  /** 当前挂起的 AI 提问;非 null 时弹窗阻塞输入 */
  pendingQuestion: ReturnType<typeof useChatStore.getState>['pendingQuestion']
  sendMessage: (content: string) => Promise<void>
  /** 用户回答 AI 主动提问,触发 /chat/answer 续流 */
  sendAnswer: (answer: string) => Promise<void>
  /** 跳过当前挂起的提问(不续流,允许用户继续发新消息) */
  skipQuestion: () => void
  stop: () => void
  clearMessages: () => void
  setModel: (model: string) => void
}

/** 后台持久化消息，失败仅打日志，不阻塞流式体验
 *  P2 多端同步:metadata 参数用于标记 questionId/isAnswer(用户回答)或其他业务元数据 */
async function persistMessageSafe(
  conversationId: string,
  content: string,
  role: 'user' | 'assistant',
  metadata?: { questionId?: string; isAnswer?: boolean; [key: string]: unknown },
) {
  const res = await persistMessage(conversationId, content, role, metadata)
  if (!res.success) {
    logger.error(`[chat] persist ${role} message failed:`, res.error)
    // 用户可见提示(非阻塞 toast),让用户知道消息未保存到服务端
    toast.error('消息保存失败', {
      description: res.error || '网络异常,本次对话未被服务端记录',
    })
  }
}

/** 后台持久化 AI 主动提问挂起状态 + WS 广播到多端
 *  失败仅打日志,不阻塞主流程(用户仍能在当前端看到弹窗,只是其他端不会同步) */
async function persistQuestionSafe(
  conversationId: string,
  question: {
    questionId: string
    prompt: string
    options: { id: string; label: string }[]
    allowCustom: boolean
    allowMultiple: boolean
  },
) {
  const res = await persistQuestion({ conversationId, ...question })
  if (!res.success) {
    logger.error(`[chat] persist question ${question.questionId} failed:`, res.error)
    // 静默失败:不弹 toast(避免干扰用户),仅日志记录
    // 影响:其他端不会收到 ai_question WS 事件,但当前端弹窗仍正常工作
  }
}

export function useChat(): UseChatReturn {
  const messages = useChatStore((s) => s.messages)
  const currentModel = useChatStore((s) => s.currentModel)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const error = useChatStore((s) => s.error)

  const router = useRouter()
  const queryClient = useQueryClient()
  const abortRef = React.useRef<AbortController | null>(null)

  const sendMessage = React.useCallback(
    async (content: string) => {
      const text = content.trim()
      if (!text) return

      const store = useChatStore.getState()
      if (store.isStreaming) return

      // 拦截自媒体斜杠命令(/wechat-article / /koubo-script),直接调 skill API,
      // 不走 LLM chat 流。结果作为 assistant 消息追加到对话。
      const slashHit = await tryHandleSelfMediaSlash(text, (assistantContent) => {
        const m = store.currentModel
        store.addMessage({ role: 'user', content: text, model: m })
        store.addMessage({ role: 'assistant', content: assistantContent, model: m })
      })
      if (slashHit) return

      const model = store.currentModel

      // 1. 若无 conversationId，先创建会话并同步 URL
      let conversationId = store.conversationId
      if (!conversationId) {
        const createRes = await createConversation({ model })
        if (!createRes.success) {
          store.setError(createRes.error)
          return
        }
        conversationId = createRes.data.conversation.id
        store.setConversationId(conversationId)
        const sp = new URLSearchParams(window.location.search)
        sp.set('conversationId', conversationId)
        router.replace(`/chat?${sp.toString()}`, { scroll: false })
        queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] })
      }

      // 2. 持久化用户消息(后台 fire-and-forget,不阻塞流式响应)
      void persistMessageSafe(conversationId, text, 'user')

      const history = store.messages
        .filter((m) => !m.error && (m.role === 'user' || m.role === 'assistant') && m.content)
        .map((m) => ({ role: m.role, content: m.content }))

      store.addMessage({ role: 'user', content: text, model })
      const assistantId = store.addMessage({ role: 'assistant', content: '', model })

      store.setStreaming(true)
      store.setError(null)
      store.resetSubAgentActivities()

      const controller = new AbortController()
      abortRef.current = controller

      // 首 token 超时:15s 内未收到任何内容则中止
      let firstTokenReceived = false
      const timeoutId = setTimeout(() => {
        if (!firstTokenReceived) {
          controller.abort()
        }
      }, 15000)

      // 从 auth store 获取 userId(用于回调链路关联)
      const userId = useAuthStore.getState().user?.id ?? ''
      // 从 ai-panel store 获取当前绑定的本地工作区路径(用于注入 CLAUDE.md/AGENTS.md 项目记忆)
      const workspacePath = useAiPanelStore.getState().activeWorkspace?.path

      try {
        await streamChat({
          model,
          messages: [...history, { role: 'user', content: text }],
          signal: controller.signal,
          metadata: {
            conversationId,
            userId,
            messageId: assistantId,
          },
          workspacePath,
          // 跨端统一 88% 阈值自动压缩:从模型 ID 推断 contextLimit,API 端调用共享包压缩
          contextLimit: getModelContextCapacity(model),
          onCompaction: (info) => {
            // 后端自动压缩完成,toast 提示用户(对标 CLI /compact 命令的可见性)
            toast.success('上下文已自动压缩', {
              description: `${formatTokenCount(info.tokensBefore)} → ${formatTokenCount(info.tokensAfter)}(移除 ${info.removedCount} 条历史)`,
            })
          },
          onQuestion: (q) => {
            // AI 主动提问:挂起对话,弹窗阻塞输入,等用户回答后 sendAnswer 续流
            useChatStore.getState().setPendingQuestion({
              questionId: q.questionId,
              prompt: q.prompt,
              options: q.options,
              allowCustom: q.allowCustom,
              allowMultiple: q.allowMultiple,
              assistantMessageId: assistantId,
            })
            // P2 多端同步:持久化挂起状态到 conversation.metadata + WS 广播 ai_question 给其他端
            // fire-and-forget,失败仅日志(当前端弹窗仍正常,只是其他端不会同步)
            const convId = useChatStore.getState().conversationId
            if (convId) {
              void persistQuestionSafe(convId, {
                questionId: q.questionId,
                prompt: q.prompt,
                options: q.options,
                allowCustom: q.allowCustom,
                allowMultiple: q.allowMultiple,
              })
            }
          },
          onDelta: (delta) => {
            firstTokenReceived = true
            useChatStore.getState().appendToMessage(assistantId, delta)
          },
          onAgentDelta: (_agentId, delta) => {
            firstTokenReceived = true
            useChatStore.getState().appendToAgentStream(_agentId, delta)
          },
          onReasoning: (delta) => {
            useChatStore.getState().appendReasoningToMessage(assistantId, delta)
          },
          onToolCall: createToolCallHandler(assistantId),
          agentTools: [...AGENT_TOOLS],
          onError: (errMsg) => {
            const formatted = formatSSEError(errMsg)
            useChatStore.getState().setMessageError(assistantId, formatted.message)
            useChatStore.getState().setError(formatted.message)
            if (formatted.severity === 'auth') {
              useLoginDialogStore.getState().open('login')
            }
            const toastDesc =
              formatted.severity === 'auth' ? formatted.message : formatted.rawMessage
            if (formatted.severity === 'ratelimit') {
              toast.warning(formatted.title, { description: toastDesc })
            } else if (formatted.severity === 'safety') {
              // 内容被 AI 厂商安全策略拦截,用 warning 级别提示用户调整提问方式
              toast.warning(formatted.title, { description: formatted.message })
            } else {
              toast.error(formatted.title, { description: toastDesc })
            }
          },
        })
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          if (!firstTokenReceived) {
            const formatted = formatSSEError(err, 'AI 响应超时(15 秒内未收到任何内容),请稍后重试')
            useChatStore.getState().setMessageError(assistantId, formatted.message)
            useChatStore.getState().setError(formatted.message)
          }
        } else {
          const formatted = formatSSEError(err)
          useChatStore.getState().setMessageError(assistantId, formatted.message)
          useChatStore.getState().setError(formatted.message)
          if (formatted.severity === 'auth') {
            useLoginDialogStore.getState().open('login')
          }
          if (formatted.severity === 'ratelimit' || formatted.severity === 'safety') {
            toast.warning(formatted.title, { description: formatted.message })
          } else if (formatted.severity === 'network') {
            toast.error(formatted.title, { description: formatted.message })
          } else {
            toast.error(formatted.title, { description: formatted.rawMessage })
          }
        }
      } finally {
        clearTimeout(timeoutId)
        abortRef.current = null
        useChatStore.getState().setStreaming(false)
        useChatStore.getState().markAllAgentStreamsDone()
      }
    },
    [router, queryClient],
  )

  const stop = React.useCallback(() => {
    abortRef.current?.abort()
  }, [])

  // 用户回答 AI 主动提问:调 /chat/answer 续流,不中断对话
  // 后端会把 answer 作为新 user 消息 append 到 messages 末尾,继续生成
  const sendAnswer = React.useCallback(async (answer: string) => {
    const trimmed = answer.trim()
    if (!trimmed) return
    const store = useChatStore.getState()
    const pending = store.pendingQuestion
    if (!pending || store.isStreaming) return

    // 立即关闭弹窗,避免重复提交
    store.clearPendingQuestion()

    const model = store.currentModel

    // 历史消息(不含 answer,后端 /chat/answer 自动 append answer 到末尾)
    const history = store.messages
      .filter((m) => !m.error && (m.role === 'user' || m.role === 'assistant') && m.content)
      .map((m) => ({ role: m.role, content: m.content }))

    // UI 上把 answer 显示为 user 消息(让用户看到自己回答了什么)
    store.addMessage({ role: 'user', content: trimmed, model })
    const assistantId = store.addMessage({ role: 'assistant', content: '', model })

    store.setStreaming(true)
    store.setError(null)
    store.resetSubAgentActivities()

    const controller = new AbortController()
    abortRef.current = controller

    let firstTokenReceived = false
    const timeoutId = setTimeout(() => {
      if (!firstTokenReceived) controller.abort()
    }, 15000)

    const userId = useAuthStore.getState().user?.id ?? ''
    const workspacePath = useAiPanelStore.getState().activeWorkspace?.path

    try {
      await streamChat({
        model,
        messages: history,
        path: '/ai/chat/answer',
        extraBody: { questionId: pending.questionId, answer: trimmed },
        signal: controller.signal,
        metadata: {
          conversationId: store.conversationId ?? undefined,
          userId,
          messageId: assistantId,
        },
        workspacePath,
        contextLimit: getModelContextCapacity(model),
        onDelta: (delta) => {
          firstTokenReceived = true
          useChatStore.getState().appendToMessage(assistantId, delta)
        },
        onAgentDelta: (agentId, delta) => {
          firstTokenReceived = true
          useChatStore.getState().appendToAgentStream(agentId, delta)
        },
        onReasoning: (delta) => {
          useChatStore.getState().appendReasoningToMessage(assistantId, delta)
        },
        onToolCall: createToolCallHandler(assistantId),
        agentTools: [...AGENT_TOOLS],
        onError: (errMsg) => {
          const formatted = formatSSEError(errMsg)
          useChatStore.getState().setMessageError(assistantId, formatted.message)
          useChatStore.getState().setError(formatted.message)
          if (formatted.severity === 'auth') {
            useLoginDialogStore.getState().open('login')
          }
          const toastDesc =
            formatted.severity === 'auth' ? formatted.message : formatted.rawMessage
          if (formatted.severity === 'ratelimit') {
            toast.warning(formatted.title, { description: toastDesc })
          } else if (formatted.severity === 'safety') {
            toast.warning(formatted.title, { description: formatted.message })
          } else {
            toast.error(formatted.title, { description: toastDesc })
          }
        },
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        if (!firstTokenReceived) {
          const formatted = formatSSEError(err, 'AI 响应超时(15 秒内未收到任何内容),请稍后重试')
          useChatStore.getState().setMessageError(assistantId, formatted.message)
          useChatStore.getState().setError(formatted.message)
        }
      } else {
        const formatted = formatSSEError(err)
        useChatStore.getState().setMessageError(assistantId, formatted.message)
        useChatStore.getState().setError(formatted.message)
        if (formatted.severity === 'auth') {
          useLoginDialogStore.getState().open('login')
        }
        if (formatted.severity === 'ratelimit' || formatted.severity === 'safety') {
          toast.warning(formatted.title, { description: formatted.message })
        } else if (formatted.severity === 'network') {
          toast.error(formatted.title, { description: formatted.message })
        } else {
          toast.error(formatted.title, { description: formatted.rawMessage })
        }
      }
    } finally {
      clearTimeout(timeoutId)
      abortRef.current = null
      useChatStore.getState().setStreaming(false)
      useChatStore.getState().markAllAgentStreamsDone()
    }
  }, [])

  // 跳过当前挂起的提问:不续流 LLM,允许用户继续发新消息
  const skipQuestion = React.useCallback(() => {
    useChatStore.getState().clearPendingQuestion()
  }, [])

  // 组件卸载时中止进行中的流式请求,避免后台僵尸请求
  React.useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const clearMessages = useChatStore((s) => s.clearMessages)
  const setModel = useChatStore((s) => s.setModel)
  const pendingQuestion = useChatStore((s) => s.pendingQuestion)

  return {
    messages,
    currentModel,
    isStreaming,
    error,
    pendingQuestion,
    sendMessage,
    sendAnswer,
    skipQuestion,
    stop,
    clearMessages,
    setModel,
  }
}
