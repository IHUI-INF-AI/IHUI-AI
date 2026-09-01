// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useChatStore, type ChatMessage, type ChatRole } from '@/stores/chat'
import { useAuthStore } from '@/stores/auth'
import { useLoginDialogStore } from '@/stores/login-dialog'
import { useAiPanelStore } from '@/stores/ai-panel'
import { useModeStore } from '@/stores/mode'
import { useTimelineStore } from '@/stores/timeline-store'
import { toast } from '@/components/common'
import {
  streamChat,
  formatSSEError,
  postToolResult,
  getMessages,
  type ToolDelegateEvent,
  type WorkspacePermissionMode,
} from '@ihui/api-client'
import { logger } from '@/lib/logger'
import { getModelContextCapacity } from '@/lib/model-context-capacity'
import { getBrowserWorkspaceHandle } from '@/lib/workspace-context-loader'
import { executeWorkspaceTool } from '@/lib/workspace-tool-executor'
import {
  mapSpawnToTimelineEvent,
  mapProgressToTimelineUpdate,
  mapEndToTimelineUpdate,
} from '@/lib/subagent-timeline-mapper'
import { loadBrowserWorkspaceContext } from './workspace'
import { mergeAgentTools } from './tool-config'
import {
  createToolCallHandler,
  createToolSummaryHandler,
  createDeltaBatcher,
  createAgentDeltaBatcher,
} from './stream-handlers'
import type { PlanStep, TerminalTask } from '@ihui/types/ai'
import type { ChatActionContext } from './types'

export function createSendAnswer(
  ctx: ChatActionContext,
): (answer: string, opts?: { fromRetry?: boolean }) => Promise<void> {
  const {
    t,
    setFallbackNotice,
    abortRef,
    lastSentAnswerRef,
    streamGenerationRef,
    streamConversationRef,
  } = ctx
  const sendAnswer = async (answer: string, opts?: { fromRetry?: boolean }) => {
    const trimmed = answer.trim()
    if (!trimmed) return
    const store = useChatStore.getState()
    const pending = store.pendingQuestion
    if ((!pending && !opts?.fromRetry) || store.isStreaming) return
    // fromRetry 时 pending 已被清除,questionId 从 lastSentAnswerRef 恢复
    const questionId = pending?.questionId ?? lastSentAnswerRef.current?.questionId
    if (!questionId) return

    // #10 入口存储 lastSentAnswerRef(2026-07-25 立):catch 块 retry 按钮用
    lastSentAnswerRef.current = { answer: trimmed, questionId }

    // 立即关闭弹窗,避免重复提交
    store.clearPendingQuestion()

    const model = store.currentModel

    // 历史消息(不含 answer,后端 /chat/answer 自动 append answer 到末尾)
    const history = store.messages
      .filter((m) => !m.error && (m.role === 'user' || m.role === 'assistant') && m.content)
      .map((m) => ({ role: m.role, content: m.content }))

    // UI 上把 answer 显示为 user 消息(让用户看到自己回答了什么)
    store.addMessage({ role: 'user', content: trimmed, model })
    // 记录续流时的工作区权限模式(2026-07-25 深化,深度对标 Codex 透明性)
    // 2026-08-31:未绑定工作区时读暂存模式
    const permState = useAiPanelStore.getState()
    const currentMode: WorkspacePermissionMode | undefined =
      permState.activeWorkspace?.mode ?? permState.pendingPermissionMode ?? undefined
    const assistantId = store.addMessage({
      role: 'assistant',
      content: '',
      model,
      permissionMode: currentMode,
    })

    store.setStreaming(true)
    store.setError(null)
    store.resetSubAgentActivities()
    // P4-2: 清除上一轮 fallback 通知(与 sendMessage 对称)
    setFallbackNotice(null)

    const controller = new AbortController()
    abortRef.current = controller
    // 2026-08-21 修复(C2/C3):流代际与绑定会话(与 sendMessage 对称)
    const streamGeneration = ++streamGenerationRef.current
    const convAtStart = store.conversationId
    streamConversationRef.current = convAtStart

    // #13 首 token 超时区分 reasoning(2026-07-25 立,与 sendMessage 对称)
    // 2026-07-27 修复:15s → 30s(与 sendMessage 同步,防冷启动误 abort)
    let firstContentTokenReceived = false
    let firstReasoningTokenReceived = false
    let abortedByTimeout15s = false
    let abortedByTimeout60s = false
    const timeout15sId = setTimeout(() => {
      if (!firstContentTokenReceived && !firstReasoningTokenReceived) {
        abortedByTimeout15s = true
        controller.abort()
      }
    }, 30000)
    const timeout60sId = setTimeout(() => {
      if (!firstContentTokenReceived && firstReasoningTokenReceived) {
        abortedByTimeout60s = true
        controller.abort()
      }
    }, 60000)

    // #9 流式 token 节流(2026-07-25 立,与 sendMessage 对称)
    const contentBatcher = createDeltaBatcher((d) =>
      useChatStore.getState().appendToMessage(assistantId, d),
    )
    const reasoningBatcher = createDeltaBatcher((d) =>
      useChatStore.getState().appendReasoningToMessage(assistantId, d),
    )
    const agentBatcher = createAgentDeltaBatcher()

    const userId = useAuthStore.getState().user?.id ?? ''
    const workspacePath = useAiPanelStore.getState().activeWorkspace?.path
    // web 非 Tauri 环境:用 FileSystemDirectoryHandle 预加载工作区文件内容(与 sendMessage 对称)
    const workspaceContext = await loadBrowserWorkspaceContext()

    // 2026-08-06 立:与 sendMessage 对称,删除 'auto' → stepfun/step-router-v1 降级,
    // 让 'auto' 透传到 ai-service 跨厂商路由(详见 line 1246-1249 注释)。
    const effectiveModel = model
    // 2026-08-07 修复:与 sendMessage 对称,无工作区时给用户一次性 toast(避免 fs 工具静默失败)
    let noWorkspaceNoticeShown = false
    const notifyNoWorkspace = (reason: string): void => {
      if (noWorkspaceNoticeShown) return
      noWorkspaceNoticeShown = true
      toast.warning('未选择工作区,文件类工具无法执行', {
        description: `${reason}。请在 AI 面板选择一个工作区后再发起对话,或选择不需要文件操作的提问。`,
        duration: 6000,
      })
    }
    try {
      // 显示压缩中状态(发送消息后、流式响应前,给用户即时反馈)
      useChatStore.getState().setCompactionStatus({ phase: 'compacting' })

      const answerContextLimit = getModelContextCapacity(effectiveModel)
      logger.debug(
        '[Compaction] sendAnswer contextLimit=',
        answerContextLimit,
        'model=',
        effectiveModel,
        'history=',
        history.length,
      )

      await streamChat({
        model: effectiveModel,
        messages: history,
        path: '/ai/chat/answer',
        extraBody: {
          // 2026-08-21 修复(C4):fromRetry 时 pending 为 null,用入口恢复的 questionId
          questionId,
          answer: trimmed,
          // 模式透传(2026-07-22 立,对标 Trae Plan/Spec):build/plan/review/spec
          // 2026-07-28 移除独立 PlanActToggle 后,plan_mode 字段已废弃,仅传 mode
          mode: useModeStore.getState().currentMode,
        },
        signal: controller.signal,
        metadata: {
          conversationId: store.conversationId ?? undefined,
          userId,
          messageId: assistantId,
        },
        // 2026-08-15 立:显式声明流式,后端 detectStreamUsage 依赖 stream===true 才启用 usage chunk。
        stream: true,
        workspacePath,
        workspaceContext,
        contextLimit: answerContextLimit,
        onCompaction: async (info) => {
          // 2026-08-21 修复(C2):压缩结果只允许写回发起流的会话(与 sendMessage 对称)
          if (useChatStore.getState().conversationId !== convAtStart) return
          // 显示底部压缩状态栏(2026-08-16 立)
          useChatStore.getState().setCompactionStatus({
            phase: 'done',
            tokensBefore: info.tokensBefore,
            tokensAfter: info.tokensAfter,
            removedCount: info.removedCount,
            trigger: info.trigger,
          })

          // 优先使用 SSE 携带的 compressedMessages 直接更新前端,避免再调 getMessages 拿旧数据
          const compressedMessages = info.compressedMessages as
            Array<{ role: ChatRole; content: string }> | undefined
          if (compressedMessages && compressedMessages.length > 0) {
            const localMessages = useChatStore.getState().messages
            const lastLocal = localMessages[localMessages.length - 1]
            const hasLocalAssistant =
              lastLocal && lastLocal.role === 'assistant' && lastLocal.id === assistantId
            const converted: ChatMessage[] = compressedMessages.map((m) => ({
              id: crypto.randomUUID(),
              role: m.role,
              content: m.content,
              createdAt: Date.now(),
              model: '',
            }))
            const finalMessages = hasLocalAssistant ? [...converted, lastLocal] : converted
            useChatStore.getState().setMessages(finalMessages)
            return
          }

          // 兜底:旧版本后端未携带 compressedMessages 时,仍从后端重新加载
          const currentConversationId = useChatStore.getState().conversationId
          if (!currentConversationId) return

          try {
            const result = await getMessages(currentConversationId, { pageSize: 100 })
            if (!result.success || !result.data) return
            const remoteMessages = result.data.messages

            // 保留前端本地当前 assistant 消息(流式输出中,后端可能尚未持久化)
            const localMessages = useChatStore.getState().messages
            const lastLocal = localMessages[localMessages.length - 1]
            const hasLocalAssistant =
              lastLocal && lastLocal.role === 'assistant' && lastLocal.id === assistantId
            const remoteIds = new Set(remoteMessages.map((m) => m.id))
            const keepLocalAssistant = hasLocalAssistant && !remoteIds.has(assistantId)

            const converted: ChatMessage[] = remoteMessages.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              createdAt: new Date(m.createdAt).getTime(),
              model: '',
              reasoning: m.reasoning,
            }))

            const finalMessages = keepLocalAssistant ? [...converted, lastLocal] : converted

            useChatStore.getState().setMessages(finalMessages)
          } catch (e) {
            console.error('压缩后同步消息失败:', e)
          }
        },
        // P4-2: 后端 fallback 触发时设置通知状态(与 sendMessage 对称)
        onFallback: (event) => setFallbackNotice(event),
        // P1 重连提示(2026-08-02 立,与 sendMessage 对称):streamChat 自动重连时 toast 通知用户
        onReconnect: (attempt: number, delay: number) => {
          const reconnectingMsg =
            t('reconnecting') === 'reconnecting' ? 'Reconnecting...' : t('reconnecting')
          const attemptMsg =
            t('reconnectAttempt', { n: String(attempt), ms: String(delay) }) === 'reconnectAttempt'
              ? `Attempt ${attempt}, retrying in ${delay}ms`
              : t('reconnectAttempt', { n: String(attempt), ms: String(delay) })
          toast.info(reconnectingMsg, { description: attemptMsg })
        },
        // 2026-07-27 修复:与 sendMessage 同步,response 到达即清除 timeout15s
        // 2026-08-16 立:与 sendMessage 对称,收到响应后立即清除压缩中状态(无论是否触发压缩)
        onResponse: () => {
          clearTimeout(timeout15sId)
          const status = useChatStore.getState().compactionStatus
          if (status?.phase === 'compacting') {
            useChatStore.getState().setCompactionStatus(null)
          }
        },
        onUsage: (usage) => {
          // P1 token 用量写入消息 meta(2026-08-15 立,与 sendMessage 对称):sendAnswer 续流同样收到 usage chunk,
          // 前端收到后更新 assistant 消息 meta.usage,UI 展示 token 计数。
          useChatStore.getState().updateMessageMeta(assistantId, { usage })
        },
        onDelta: (delta) => {
          if (!firstContentTokenReceived) {
            firstContentTokenReceived = true
            clearTimeout(timeout15sId)
            clearTimeout(timeout60sId)
          }
          contentBatcher.batch(delta)
        },
        onAgentDelta: (agentId, delta) => {
          if (!firstContentTokenReceived) {
            firstContentTokenReceived = true
            clearTimeout(timeout15sId)
            clearTimeout(timeout60sId)
          }
          agentBatcher.batch(agentId, delta)
        },
        onReasoning: (delta) => {
          if (!firstReasoningTokenReceived) {
            firstReasoningTokenReceived = true
            // 2026-07-27 修复:与 sendMessage 同步,收到 reasoning 即清除 timeout15s
            clearTimeout(timeout15sId)
          }
          reasoningBatcher.batch(delta)
        },
        onToolCall: createToolCallHandler(assistantId),
        // Subagent 自动派发(2026-07-28 立,与 sendMessage 对称):
        // sendAnswer 续流同样可能触发 dispatch_subagent 工具,需写入 store。
        // 2026-07-29 Phase 21:补齐 onSubagentProgress + 同步写入 timeline-store。
        onSubagentSpawn: (evt) => {
          useChatStore.getState().addSubagentSpawn(evt)
          useTimelineStore.getState().addEvent(mapSpawnToTimelineEvent(evt))
        },
        onSubagentProgress: (evt) => {
          useChatStore.getState().updateSubagentProgress(evt)
          const update = mapProgressToTimelineUpdate(evt)
          if (update) useTimelineStore.getState().updateEvent(update.id, update.updates)
        },
        onSubagentEnd: (evt) => {
          useChatStore.getState().markSubagentEnd(evt)
          const update = mapEndToTimelineUpdate(evt)
          if (update) useTimelineStore.getState().updateEvent(update.id, update.updates)
        },
        // 2026-07-31 立,与 sendMessage 对称:sendAnswer 续流同样发出 tool-summary 事件
        onToolSummary: createToolSummaryHandler(assistantId),
        // 2026-08-01 Phase 4a:与 sendMessage 对称,消息级 plan/terminal 事件落地
        onPlanUpdate: (evt) => {
          if (!evt.messageId) return
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
          useChatStore.getState().setMessagePlanSteps(evt.messageId, steps)
        },
        onTerminalStart: (evt) => {
          if (!evt.messageId) return
          const task: TerminalTask = {
            id: evt.terminalId,
            command: evt.command,
            status: 'running',
            startedAt: evt.startedAt ?? new Date().toISOString(),
            messageId: evt.messageId,
          }
          useChatStore.getState().appendMessageTerminalTask(evt.messageId, task)
        },
        onTerminalEnd: (evt) => {
          if (!evt.messageId) return
          useChatStore.getState().updateMessageTerminalTask(evt.messageId, evt.terminalId, {
            status: evt.status,
            output: evt.output,
            exitCode: evt.exitCode,
            endedAt: evt.endedAt,
            durationMs: evt.durationMs,
          })
        },
        // 阶段 2:浏览器端工具执行代理(2026-08-02 立,与 sendMessage 对称)
        // ai-service 在远程服务器无法访问本地文件,LLM 调用 fs 类工具时通过 SSE
        // tool-delegate 事件委托前端用 FileSystemDirectoryHandle 执行,通过 postToolResult 回传
        // 2026-08-07:与 sendMessage 对称,无工作区 toast 提示
        onToolDelegate: async (event: ToolDelegateEvent) => {
          const ws = useAiPanelStore.getState().activeWorkspace
          if (!ws?.name) {
            notifyNoWorkspace('当前没有活跃工作区')
            await postToolResult(event.session_id, event.tool_call_id, null, 'No active workspace')
            return
          }
          const handle = getBrowserWorkspaceHandle(ws.name)
          if (!handle) {
            notifyNoWorkspace('工作区未授权目录访问权限')
            await postToolResult(
              event.session_id,
              event.tool_call_id,
              null,
              'No browser workspace handle',
            )
            return
          }
          const execResult = await executeWorkspaceTool(event.tool_name, event.args, handle)
          await postToolResult(
            event.session_id,
            event.tool_call_id,
            execResult.result,
            execResult.error,
          )
        },
        // 2026-08-29 修复:与 sendMessage 对称,仅当用户显式启用插件工具时才携带 agentTools。
        // 普通问答不携带 → 后端不命中 tool loop,走流式 astream() 恢复打字机输出(详见 tool-config.ts)
        ...(mergeAgentTools().length > 0 ? { agentTools: mergeAgentTools() } : {}),
        onError: (errMsg, info) => {
          // #9 错误前先 flush 累积 token,避免最后一批内容丢失
          contentBatcher.flush()
          reasoningBatcher.flush()
          agentBatcher.flushAll()
          const formatted = formatSSEError(errMsg, info)
          useChatStore.getState().setMessageError(assistantId, formatted.message)
          useChatStore.getState().setError(formatted.message)
          if (formatted.severity === 'auth') {
            useLoginDialogStore.getState().open('login')
          }
          // 前端错误码透出(P1):sendAnswer 路径同 sendMessage,toast description 加 [errorCode] 前缀
          const ec = info?.errorCode
          const toastDesc =
            formatted.severity === 'auth'
              ? formatted.message
              : ec
                ? `[${ec}] ${formatted.rawMessage}`
                : formatted.rawMessage
          if (formatted.severity === 'ratelimit') {
            // ratelimit/safety 错误保持 warning 无 retry(与 sendMessage 一致)
            toast.warning(formatted.title, { description: toastDesc })
          } else if (formatted.severity === 'safety') {
            toast.warning(formatted.title, { description: formatted.message })
          } else {
            // #10 sendAnswer 错误加 retry 按钮(2026-07-25 立,与 sendMessage 路径对齐)
            toast.error(formatted.title, {
              description: toastDesc,
              action: {
                label: t('retry'),
                onClick: () => {
                  const last = lastSentAnswerRef.current
                  if (last) sendAnswer(last.answer, { fromRetry: true })
                },
              },
            })
          }
        },
      })
    } catch (err) {
      // #9 catch 前先 flush 累积 token
      contentBatcher.flush()
      reasoningBatcher.flush()
      agentBatcher.flushAll()
      if (err instanceof DOMException && err.name === 'AbortError') {
        // #13 区分两种超时,用户主动 stop 静默不报错
        if (abortedByTimeout15s) {
          const formatted = formatSSEError(err, t('errorTimeout15s'))
          useChatStore.getState().setMessageError(assistantId, formatted.message)
          useChatStore.getState().setError(formatted.message)
        } else if (abortedByTimeout60s) {
          const formatted = formatSSEError(err, t('errorTimeout60s'))
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
        // 前端错误码透出(P1):catch 路径(HTTP 4xx throw)的 errorCode 从 formatted 直接取
        const ec = formatted.errorCode
        const prefix = ec ? `[${ec}] ` : ''
        if (formatted.severity === 'ratelimit' || formatted.severity === 'safety') {
          // ratelimit/safety 错误保持 warning 无 retry
          toast.warning(formatted.title, { description: `${prefix}${formatted.message}` })
        } else if (formatted.severity === 'network') {
          // #10 网络错误 toast 加 retry 按钮(2026-07-25 立,与 sendMessage 对称)
          toast.error(formatted.title, {
            description: `${prefix}${formatted.message}`,
            action: {
              label: t('retry'),
              onClick: () => {
                const last = lastSentAnswerRef.current
                if (last) sendAnswer(last.answer, { fromRetry: true })
              },
            },
          })
        } else {
          // #10 通用错误 toast 加 retry 按钮
          toast.error(formatted.title, {
            description: `${prefix}${formatted.rawMessage}`,
            action: {
              label: t('retry'),
              onClick: () => {
                const last = lastSentAnswerRef.current
                if (last) sendAnswer(last.answer, { fromRetry: true })
              },
            },
          })
        }
      }
    } finally {
      clearTimeout(timeout15sId)
      clearTimeout(timeout60sId)
      // 2026-07-27 修复"AI 响应不显示"(与 sendMessage 对称):先 flush 再 cancel
      contentBatcher.flush()
      reasoningBatcher.flush()
      agentBatcher.flushAll()
      // assistant 消息持久化由后端 ai-callback worker 权威负责(同 sendMessage finally 注释)。
      // 2026-08-21 修复:删除此处前端持久化(曾每轮必现 400 误报 toast)。
      contentBatcher.cancel()
      reasoningBatcher.cancel()
      agentBatcher.cancelAll()
      // 2026-08-21 修复(C3):代际守卫(与 sendMessage 对称),旧流不清理新流全局状态
      if (streamGenerationRef.current === streamGeneration) {
        abortRef.current = null
        useChatStore.getState().setStreaming(false)
        useChatStore.getState().markAllAgentStreamsDone()
      }
    }
    return
  }
  return sendAnswer
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
