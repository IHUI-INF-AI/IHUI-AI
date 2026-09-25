// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  streamChat,
  fetchModels,
  formatSSEError,
  getModelContextCapacity,
  createConversation,
  sendMessage as persistChatMessage,
  branchConversation,
  getMessages as getConversationMessages,
  type StreamChatOptions,
  type TerminalDeltaEvent,
  type LlmModel,
} from '@ihui/api-client'
import { GitBranch } from 'lucide-react'
import { formatTokenCount } from '@ihui/shared/utils'
import { FALLBACK_MODELS as SHARED_FALLBACK_MODELS } from '@ihui/shared'
import { Button, Input } from '@ihui/ui-react'
import { useOutletContext } from 'react-router-dom'
import { useI18n } from '../../../src/i18n'
import { pickRetryTarget } from './chat-send-utils'
import {
  branchTargetServerId,
  failureReasonText,
  failureStatusText,
  hydrateBranchTranscript,
} from './chat-branch-utils'
import { categoryLabel, historyLabel, splitModelCatalog } from '../../../src/lib/model-catalog'
import { toolsForChatRequest } from '../../../lib/ui-control-tools'
import { VoiceInput } from '../components/VoiceInput'
import { MessageContent } from '../components/MessageContent'
import { TaskStatusBar } from '../components/TaskStatusBar'
import type { PlanStep, TerminalTask } from '@ihui/types'
import type { ChatMessage } from './types'

interface Ctx {
  onLogout: () => void
}

// 共享层兜底模型(FallbackModel:value/label/vendor)→ LlmModel 形态
// 2026-08-04 Phase E 收敛:13 个硬编码模型收敛到共享层 3 个(AGENTS.md §3)
const FALLBACK_MODELS: LlmModel[] = SHARED_FALLBACK_MODELS.map((m) => ({
  id: m.value,
  name: m.label,
  provider: m.vendor,
  context_length: 8192,
  input_price: 0,
}))

// D106(2026-09-24):单消息 steer 交代上限,对齐后端 _STEER_QUEUE_LIMIT 与 web appendSteerNotice
const STEER_NOTICE_MAX = 8

// ===== D19(2026-09-25 接):terminal_delta 实时输出增量的端内折叠 =====
// 后端在命令执行期间逐块下发 `event: terminal_delta`(stdout/stderr 增量,4 行/批)。
// 本端刻意**不新建第二套终端 UI**:增量按 terminalId 累加进既有 terminalTasks[].output,
// 由 MessageContent 既有终端块(buildRenderModel → TerminalRenderBlock.output)渲染。
// 单键上限与 web store.terminalOutputs / mobile-rn TERMINAL_LIVE_MAX_CHARS 同值(超限保尾部)。

/** terminal_delta 累计输出单键上限(超出保尾部,防长命令把内存撑爆) */
export const TERMINAL_LIVE_MAX_CHARS = 20000

/**
 * 把一帧 terminal_delta 折进对应 terminalId 的 task.output。
 * 空帧(无 terminalId / 空 text)与无主帧(该 terminalId 没有 terminal_start 建过任务)
 * 整帧丢弃并返回原数组引用 —— web 同一口径(其渲染按 task id 取 live 键,无任务帧本就不可见)。
 */
export function foldTerminalDeltaIntoTasks(
  tasks: TerminalTask[],
  evt: Pick<TerminalDeltaEvent, 'terminalId' | 'text'>,
): TerminalTask[] {
  if (!evt.terminalId || !evt.text) return tasks
  let hit = false
  const next = tasks.map((task) => {
    if (task.id !== evt.terminalId) return task
    hit = true
    const merged = (task.output ?? '') + evt.text
    return {
      ...task,
      output:
        merged.length > TERMINAL_LIVE_MAX_CHARS ? merged.slice(-TERMINAL_LIVE_MAX_CHARS) : merged,
    }
  })
  return hit ? next : tasks
}

/**
 * terminal_end 输出归并口径(对齐 web terminal-section 的 effectiveOutput):取更长者。
 * 后端整帧 output 截 8000 字符,构建日志尾部只存在于流期累计里 —— 直接覆盖会丢尾。
 */
export function pickTerminalEndOutput(
  evtOutput: string | undefined,
  taskOutput: string | undefined,
): string | undefined {
  return (evtOutput?.length ?? 0) >= (taskOutput?.length ?? 0) ? evtOutput : taskOutput
}

export default function ChatPage() {
  const { onLogout } = useOutletContext<Ctx>()
  const { t, locale } = useI18n()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')
  const [models, setModels] = useState<LlmModel[]>(FALLBACK_MODELS)
  const [model, setModel] = useState<string>(FALLBACK_MODELS[0]!.id)
  const [notice, setNotice] = useState('')
  const scrollRef = useRef<HTMLDivElement | null>(null)
  // 分叉(2026-09-25 接后端既有 branch 出口):扩展端原本是"无会话"纯流式聊天,
  // 后端 branch 接口只认已落库的 conversationId + messageId,所以宿主必须先持有
  // 一条真实会话。首轮发送时懒创建会话并逐条落库,才谈得上"对某条 AI 回复分叉"。
  const [conversationId, setConversationId] = useState<string | null>(null)
  /** 本地消息 id → 后端 chat_messages.id(只有持久化成功的消息才有) */
  const [serverIds, setServerIds] = useState<Record<string, string>>({})
  const [branching, setBranching] = useState(false)

  // 默认只展示"最新 + 对话类",其余按用途分类收进"历史模型"optgroup
  // (原生 select 无法折叠,optgroup 就是它的折叠区)
  const split = useMemo(() => splitModelCatalog(models), [models])

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

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  // W6:把更新应用到「流式输出的当前 assistant 消息」。
  // 扩展端消息 id 为本地生成,后端 SSE 的 messageId 不一定与本地相等:
  // 故显式传入 messageId 时优先精确匹配,匹配不到则回退到最后一条 assistant 消息。
  const updateAssistantMessage = (updater: (m: ChatMessage) => ChatMessage, messageId?: string) => {
    setMessages((cur) => {
      const copy = [...cur]
      let target = -1
      if (messageId) {
        target = copy.findIndex((m) => m.id === messageId && m.role === 'assistant')
      }
      if (target < 0) {
        for (let i = copy.length - 1; i >= 0; i -= 1) {
          if (copy[i]?.role === 'assistant') {
            target = i
            break
          }
        }
      }
      const current = target >= 0 ? copy[target] : undefined
      if (!current) return cur
      copy[target] = updater(current)
      return copy
    })
  }

  /** 懒创建后端会话;失败不阻断本轮对话(流式本身不依赖会话),但必须交代原因。 */
  const ensureConversation = async (): Promise<string | null> => {
    if (conversationId) return conversationId
    const res = await createConversation({ model })
    if (!res.success) {
      setNotice(
        t('chat.conversationCreateFailed', {
          reason: failureReasonText(res.error),
          status: failureStatusText(res.status),
        }),
      )
      return null
    }
    setConversationId(res.data.conversation.id)
    return res.data.conversation.id
  }

  /** 逐条落库(与 web persistMessageSafe 同一形态:失败要响但不打断对话)。
   *  成功后登记 本地 id → 服务端 id,该条才具备被分叉的资格。 */
  const persistTurnMessage = async (
    localId: string,
    cid: string,
    content: string,
    role: 'user' | 'assistant',
  ) => {
    const trimmed = content.trim()
    if (!trimmed) return
    const res = await persistChatMessage(cid, trimmed, role)
    if (!res.success) {
      setNotice(
        t('chat.messageSaveFailed', {
          reason: failureReasonText(res.error),
          status: failureStatusText(res.status),
        }),
      )
      return
    }
    const serverId = res.data.message.id
    setServerIds((cur) => ({ ...cur, [localId]: serverId }))
  }

  /** 对某条 AI 回复分叉出新会话(后端既有出口 branchConversation)。
   *  成功后整页切到新会话:新会话消息由服务端回读,本地 id 即服务端 id。 */
  const onBranch = async (messageId: string) => {
    if (!conversationId || branching) return
    const targetServerId = serverIds[messageId]
    if (!targetServerId) return
    setBranching(true)
    setError('')
    setNotice('')
    try {
      const res = await branchConversation(conversationId, targetServerId)
      if (!res.success) {
        setError(
          t('chat.branchFailed', {
            reason: failureReasonText(res.error),
            status: failureStatusText(res.status),
          }),
        )
        return
      }
      const newConversationId = res.data.conversation.id
      const loaded = await getConversationMessages(newConversationId, { pageSize: 100 })
      if (!loaded.success) {
        setError(
          t('chat.branchFailed', {
            reason: failureReasonText(loaded.error),
            status: failureStatusText(loaded.status),
          }),
        )
        return
      }
      const hydrated = hydrateBranchTranscript(loaded.data.messages)
      setConversationId(newConversationId)
      setServerIds(hydrated.serverIds)
      setMessages(hydrated.messages)
      setNotice(t('chat.branchDone'))
    } catch (err) {
      setError(
        t('chat.branchFailed', {
          reason: failureReasonText(err instanceof Error ? err.message : String(err)),
          status: failureStatusText(undefined),
        }),
      )
    } finally {
      setBranching(false)
    }
  }

  /** overrideText 用于 G-152「重试上一条」:错误后不要求用户重新输入同一句话。 */
  const onSend = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim()
    if (!text || streaming) return
    setInput('')
    setError('')
    setNotice('')
    const userLocalId = `u-${Date.now()}`
    const assistantLocalId = `a-${Date.now()}`
    const next: ChatMessage[] = [
      ...messages,
      { id: userLocalId, role: 'user', content: text },
      { id: assistantLocalId, role: 'assistant', content: '' },
    ]
    setMessages(next)
    setStreaming(true)

    // 会话与落库:失败只交代、不打断流式(流式不依赖会话)
    const cid = await ensureConversation()
    if (cid) void persistTurnMessage(userLocalId, cid, text, 'user')
    // onDone 时 React 状态未必已刷新,正文用局部累加量兜住;出错的那轮不落库
    let assistantText = ''
    let streamFailed = false

    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), 15_000)
    // W6:记录每个工具调用的起始时间,tool-result 到达时补算耗时(与 web stream-handlers 一致)
    const toolStartTimes = new Map<string, number>()

    const opts: StreamChatOptions = {
      model,
      messages: next
        .filter((m) => m.content || m.role === 'user')
        .map(({ role, content }) => ({ role, content: content || ' ' })),
      // 2026-09-21 第五族 ext_ui:命中"操控本站"意图才带工具名(llm.py 的 tool loop
      // 入口是 `if req.agent_tools and chat_mode != "ask"`,不带就不进工具链)
      agentTools: toolsForChatRequest(text),
      signal: controller.signal,
      // 2026-08-16 修复:显式声明流式,避免后端/中间件对 request.stream 做严格字段检测时关闭 SSE。
      stream: true,
      // 跨端统一 88% 阈值自动压缩:从模型 ID 推断 contextLimit,后端压缩后通过 SSE 回调提示用户
      contextLimit: getModelContextCapacity(model),
      onCompaction: (info) => {
        setNotice(
          t('chat.compactionNotice', {
            before: formatTokenCount(info.tokensBefore),
            after: formatTokenCount(info.tokensAfter),
            removed: info.removedCount,
          }),
        )
      },
      onDelta: (delta) => {
        window.clearTimeout(timeoutId)
        assistantText += delta
        updateAssistantMessage((m) => ({ ...m, content: m.content + delta }))
      },
      // W6:推理过程(reasoning model),追加到 assistant 消息的 reasoning 字段
      onReasoning: (delta) => {
        window.clearTimeout(timeoutId)
        updateAssistantMessage((m) => ({ ...m, reasoning: (m.reasoning ?? '') + delta }))
      },
      onError: (msg, info) => {
        window.clearTimeout(timeoutId)
        // 错误正文是端内自造的占位文本,不得当成 AI 回复落库(否则分叉过去是半截错误)
        streamFailed = true
        // info 必须透传给 formatSSEError:errorCode 是"厂商账号额度耗尽"等稳定码的唯一判据
        // (ai-service 未登记该码的 HTTP 状态,实际仍回落默认 502,按状态码分类会误判)
        const formatted = formatSSEError(new Error(msg), info)
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
        if (cid && !streamFailed) {
          void persistTurnMessage(assistantLocalId, cid, assistantText, 'assistant')
        }
      },
      // ===== W6 新增回调:与 web 端 use-chat 对齐,补齐工具/用量/计划/终端 =====
      // 工具调用:start 追加 running 项;result 按 toolCallId 回填状态、结果与耗时
      onToolCall: (event) => {
        window.clearTimeout(timeoutId)
        if (event.type === 'tool-call-start') {
          toolStartTimes.set(event.toolCallId, Date.now())
          updateAssistantMessage((m) => ({
            ...m,
            toolCalls: [
              ...(m.toolCalls ?? []),
              {
                id: event.toolCallId,
                toolName: event.toolName,
                args: event.args ?? {},
                status: 'running',
                serverSource: event.serverSource,
                serverId: event.serverId,
                serverName: event.serverName,
              },
            ],
          }))
          return
        }
        const startedAt = toolStartTimes.get(event.toolCallId)
        const durationMs = startedAt !== undefined ? Date.now() - startedAt : undefined
        updateAssistantMessage((m) => ({
          ...m,
          toolCalls: (m.toolCalls ?? []).map((call) =>
            call.id === event.toolCallId
              ? {
                  ...call,
                  toolName: event.toolName,
                  status: event.isError ? 'error' : 'success',
                  isError: event.isError,
                  result: event.result,
                  args: event.args ?? call.args,
                  durationMs,
                  serverSource: event.serverSource ?? call.serverSource,
                  serverId: event.serverId ?? call.serverId,
                  serverName: event.serverName ?? call.serverName,
                  image_url: event.image_url,
                  audio_url: event.audio_url,
                  video_url: event.video_url,
                  task_id: event.task_id,
                }
              : call,
          ),
        }))
      },
      // 工具调用汇总:流末尾一次性写入 message.toolCallSummary
      onToolSummary: (summary) => {
        updateAssistantMessage((m) => ({ ...m, toolCallSummary: summary }))
      },
      // Token 用量:写入 message.meta.usage,由共享渲染模型提取并展示
      onUsage: (usage) => {
        updateAssistantMessage((m) => ({ ...m, meta: { ...(m.meta ?? {}), usage } }))
      },
      // 执行计划:PlanUpdateEvent 为权威快照,整体替换 message.planSteps
      onPlanUpdate: (evt) => {
        const steps: PlanStep[] = evt.plan.map((item, i) => ({
          id: `plan-${i}-${item.step.slice(0, 16)}`,
          step: item.step,
          status: item.status,
          explanation: evt.explanation,
          startedAt: item.startedAt,
          endedAt: item.endedAt,
          durationMs: item.durationMs,
          tokenUsage: item.tokenUsage,
          messageId: evt.messageId,
        }))
        updateAssistantMessage((m) => ({ ...m, planSteps: steps }), evt.messageId)
      },
      // 终端任务:start 追加 running 项;end 回填状态、输出与退出码
      onTerminalStart: (evt) => {
        const task: TerminalTask = {
          id: evt.terminalId,
          command: evt.command,
          status: 'running',
          startedAt: evt.startedAt ?? new Date().toISOString(),
          messageId: evt.messageId,
        }
        updateAssistantMessage(
          (m) => ({ ...m, terminalTasks: [...(m.terminalTasks ?? []), task] }),
          evt.messageId,
        )
      },
      // D19(2026-09-25 接):命令执行期间的 stdout/stderr 逐块增量。
      // 折进既有 terminalTasks[].output(渲染走 MessageContent 既有终端块),不落正文 ——
      // api-client 已把 terminal_delta 从 onDelta 通道分流(tryParseTerminalDelta),
      // 端内不注册这个回调就是二次静默丢帧(守门 90 的登记面)。
      onTerminalDelta: (evt) => {
        window.clearTimeout(timeoutId)
        updateAssistantMessage(
          (m) => ({
            ...m,
            terminalTasks: foldTerminalDeltaIntoTasks(m.terminalTasks ?? [], evt),
          }),
          evt.messageId,
        )
      },
      onTerminalEnd: (evt) => {
        updateAssistantMessage(
          (m) => ({
            ...m,
            terminalTasks: (m.terminalTasks ?? []).map((task) =>
              task.id === evt.terminalId
                ? {
                    ...task,
                    status: evt.status,
                    // 取更长者(web terminal-section 同一口径):整帧 output 截 8000,
                    // 流期累计的尾部不能被短整帧吃掉
                    output: pickTerminalEndOutput(evt.output, task.output),
                    // 缺省不覆盖:后端只在真截断时带 truncated,历史值要留住
                    truncated: evt.truncated ?? task.truncated,
                    totalChars: evt.totalChars ?? task.totalChars,
                    exitCode: evt.exitCode,
                    endedAt: evt.endedAt,
                    durationMs: evt.durationMs,
                  }
                : task,
            ),
          }),
          evt.messageId,
        )
      },
      // D39/D108 上游重试交代(第 48 轮):api-client 有通道,端内不注册就是静默丢帧。
      // 整体替换为最近一次(attempt 递增),与 web 同一口径。
      onRetryScheduled: (evt) => {
        updateAssistantMessage(
          (m) => ({
            ...m,
            retryNotice: {
              attempt: evt.attempt,
              maxRetries: evt.maxRetries,
              retryInMs: evt.retryInMs,
              ...(typeof evt.httpStatus === 'number' ? { httpStatus: evt.httpStatus } : {}),
            },
          }),
          evt.messageId,
        )
      },
      // #11 引用溯源(第 52 轮):端内枚举式合并,不显式写 citations 就等于静默丢帧
      onCitations: (evt) => {
        updateAssistantMessage((m) => {
          const existing = m.citations ?? []
          const incoming = (evt.citations ?? []).map((x) => ({
            source: x.source,
            label: x.label,
            ...(typeof x.url === 'string' ? { url: x.url } : {}),
          }))
          const next = [...existing]
          for (const item of incoming) {
            if (next.some((x) => x.source === item.source && x.label === item.label)) continue
            next.push(item)
          }
          return { ...m, citations: next }
        }, evt.messageId)
      },
      onInjectionApplied: (evt) => {
        // D34 跨端(第 43 轮):api-client 已有通道,端内必须显式承接 ——
        // extension 的消息更新是枚举式合并,不写字段就等于静默丢弃。
        // 按 kind+collapsed 去重(重连补发不得出现重复行),与 web #26 citations 同口径。
        updateAssistantMessage((m) => {
          const existing = m.injections ?? []
          if (existing.some((x) => x.kind === evt.kind && x.collapsed === evt.collapsed)) {
            return m
          }
          return {
            ...m,
            injections: [
              ...existing,
              {
                kind: evt.kind,
                collapsed: evt.collapsed,
                ...(evt.fullText ? { fullText: evt.fullText } : {}),
                ...(typeof evt.count === 'number' ? { count: evt.count } : {}),
              },
            ],
          }
        }, evt.messageId)
      },
      // D106(2026-09-24):steer 交代帧 —— 中途引导注入确认,同枚举式合并纪律,
      // 逐字段显式承接,空文本防御,单消息 8 条封顶(对齐后端 _STEER_QUEUE_LIMIT)。
      onSteer: (evt) => {
        if (evt.phase !== 'injected') return
        const text = evt.text.trim()
        if (!text) return
        updateAssistantMessage((m) => {
          const existing = m.steerNotices ?? []
          if (existing.length >= STEER_NOTICE_MAX) return m
          return {
            ...m,
            steerNotices: [
              ...existing,
              {
                phase: evt.phase,
                text,
                ...(evt.timestamp ? { timestamp: evt.timestamp } : {}),
              },
            ],
          }
        }, evt.messageId)
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

  const lastMessageId = messages[messages.length - 1]?.id
  // G-152:仅在有错误时找可重发的用户原文;没有就返回空串 → 界面不给按钮
  const retryText = pickRetryTarget(messages, error !== '')
  // 任务状态条数据源:最后一条带 planSteps 的 assistant 消息(消息级权威快照)
  const taskMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (m && m.role === 'assistant' && (m.planSteps?.length ?? 0) > 0) return m
    }
    return undefined
  }, [messages])
  const taskStreaming = streaming && taskMessage?.id === lastMessageId

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <h3 className="m-0 text-sm font-semibold">{t('chat.title')}</h3>
        <select
          className="text-xs text-foreground px-2 py-1 border border-border rounded-md bg-card cursor-pointer transition-colors hover:border-muted-foreground focus:outline-none focus:border-muted-foreground"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={streaming}
          aria-label={t('chat.selectModel')}
        >
          {split.primary.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name || m.id}
            </option>
          ))}
          {split.archived.map((g) => (
            <optgroup
              key={g.category}
              label={`${historyLabel(locale)} · ${categoryLabel(g.category, locale)}`}
            >
              {g.items.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name || m.id}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onLogout}
          className="bg-transparent border-none text-primary cursor-pointer text-xs px-1.5 py-0.5"
        >
          {t('chat.exit')}
        </Button>
      </div>
      <div
        className="flex-1 overflow-auto p-3 md:p-4 flex flex-col gap-2"
        ref={scrollRef}
        data-testid="chat-list"
      >
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8 px-4 text-sm">
            {t('chat.emptyHint')}
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col max-w-[85%] md:max-w-[75%] lg:max-w-[70%] ${m.role === 'user' ? 'self-end' : ''}`}
            >
              <div
                className={`px-2.5 py-2 rounded-lg text-sm break-words leading-relaxed ${m.role === 'user' ? 'bg-cta text-cta-foreground whitespace-pre-wrap' : 'bg-muted text-foreground'}`}
              >
                {m.role === 'user' ? (
                  m.content
                ) : (
                  // W6:assistant 消息改为结构化渲染(轻量 Markdown + 推理/工具/计划/终端/子代理),
                  // 数据归一化由共享纯函数 @ihui/shared buildRenderModel 提供
                  <MessageContent message={m} streaming={streaming && m.id === lastMessageId} />
                )}
              </div>
              {/* 分叉入口(2026-09-25):仅对**已落库的 AI 回复**给出 —— 判据见 chat-branch-utils */}
              {branchTargetServerId(m, serverIds, { streaming }) ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="mt-1 self-start px-1.5 text-xs text-muted-foreground"
                  disabled={branching}
                  data-testid="branch-from-here"
                  onClick={() => void onBranch(m.id)}
                >
                  <GitBranch className="h-3 w-3" aria-hidden />
                  {t('chat.branchFromHere')}
                </Button>
              ) : null}
            </div>
          ))
        )}
      </div>
      {notice ? (
        <div className="bg-cta/10 text-primary px-2.5 py-2 rounded-md border border-primary my-2 text-xs">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="bg-destructive/10 text-destructive px-2.5 py-2 rounded-md border border-destructive my-2 text-xs">
          {error}
          {/* G-152(WorkBuddy 一手对标):错误必须带**动作**,只说"请稍后重试"等于让用户自己重打 */}
          {retryText ? (
            <button
              type="button"
              data-testid="retry-last-turn"
              className="ml-2 rounded-sm border border-destructive/60 px-1.5 py-px text-[11px] text-destructive hover:bg-destructive/10"
              onClick={() => {
                setError('')
                void onSend(retryText)
              }}
            >
              {t('chat.retryMessage')}
            </button>
          ) : null}
        </div>
      ) : null}
      {/* 任务进度常驻状态条:plan_updated 驱动,流式时随事件自动刷新,空闲时零占位。
          taskStreaming 门控:新一轮流式开始时上一轮残留 planSteps 不得再当活动态转圈 */}
      <TaskStatusBar
        planSteps={taskMessage?.planSteps ?? []}
        toolCalls={taskMessage?.toolCalls}
        terminalTasks={taskMessage?.terminalTasks}
        isStreaming={taskStreaming}
      />
      <form
        className="flex gap-1.5 px-2.5 py-2 border-t border-border bg-card"
        onSubmit={(e) => {
          e.preventDefault()
          void onSend()
        }}
      >
        <Input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('chat.inputPlaceholder')}
          disabled={streaming}
        />
        <VoiceInput
          onTranscript={(text) => {
            setInput((prev) => (prev && !prev.endsWith(' ') ? `${prev} ${text}` : `${prev}${text}`))
          }}
          disabled={streaming}
        />
        <Button type="submit" variant="send" size="sm" disabled={!input.trim() || streaming}>
          {t('chat.send')}
        </Button>
      </form>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
