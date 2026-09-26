// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useChatStore, type ChatMessage, type ChatRole } from '@/stores/chat'
import { useAuthStore } from '@/stores/auth'
import { useLoginDialogStore } from '@/stores/login-dialog'
import { useAiPanelStore } from '@/stores/ai-panel'
import { useModeStore } from '@/stores/mode'
import { getSamplingParams } from '@/stores/sampling-params'
import { useTimelineStore } from '@/stores/timeline-store'
import { toast } from '@/components/common'
import {
  streamChat,
  formatSSEError,
  postToolResult,
  getMessages,
  createConversation,
  regenerateConversation,
  editAndRerunConversation,
  autoTitleConversation,
  branchConversation,
  type ToolDelegateEvent,
  // V3 #58(2026-09-26 立):主对话流工具审批请求事件(ai-service 高危工具执行前发)
  type ToolApprovalEvent,
  type WorkspacePermissionMode,
  // Budget 用量分档提醒事件(2026-09-19 立,网关发,流首 toast 提示用量进度)
  type BudgetEvent,
} from '@ihui/api-client'
// V3 #58(2026-09-26 立):审批请求桥接到全局 ToolApprovalDialog(channel 标记让
// 弹窗把决策回传到主聊天流端点,而非 agent 任务流端点 —— 两套注册表互不相通)
import { dispatchToolApprovalRequest } from '@/components/ai/tool-approval-dialog'
import { listCheckpoints, restoreCheckpoint, type CheckpointMeta } from '@/api/checkpoint-api'
import { expandRuleToken } from '@/stores/memory'
import { expandContextTokens } from '@/lib/context-token-expander'
// P3 #30(2026-09-16 立):diff 评审意见 → agent 上下文注入
import { appendDiffComments } from '@/lib/diff-comments'
import { emitAgentHook } from '@/stores/agent-hooks'
import { maybeAutoCaptureWiki } from '@/stores/repo-wiki'
import { openLoginDialogOnce } from '@/lib/login-dialog-trigger'
// P3 #43(2026-09-16 立):成本预检/对比状态
import {
  useCostGuardStore,
  isCostNegotiationEnabled,
  COST_NEGOTIATION_THRESHOLD_USD,
} from '@/stores/cost-guard'
import { fetchApi } from '@/lib/api'
import { logger } from '@/lib/logger'
import { getModelContextCapacity } from '@/lib/model-context-capacity'
import { isContextAtCompactionThreshold } from '@/lib/token-estimate'
import { getBrowserWorkspaceHandle } from '@/lib/workspace-context-loader'
import { executeWorkspaceTool } from '@/lib/workspace-tool-executor'
import {
  mapSpawnToTimelineEvent,
  mapProgressToTimelineUpdate,
  mapEndToTimelineUpdate,
} from '@/lib/subagent-timeline-mapper'
import { loadBrowserWorkspaceContext } from './workspace'
import { resolveRoundModel } from './model-switch'
import { eduToolsFor, fileToolsFor, mergeAgentTools, uiControlToolsFor } from './tool-config'
import {
  clearCompactionPreview,
  createToolCallHandler,
  createToolSummaryHandler,
  createUsageHandler,
  createDeltaBatcher,
  createAgentDeltaBatcher,
  localizeQuotaExhausted,
} from './stream-handlers'
import { createSmoothDeltaBatcher } from './smooth-delta-batcher'
import { estimateLiveUsage } from './live-usage'
// V3 #69:budget 命名帧的唯一落点(输入框上方 ContextBudgetBar 读它;toast 照旧)
import { clearBudgetEvent, setBudgetEvent } from './budget-state'
import {
  tryHandlePlanModeSlash,
  tryHandleChatModeSlash,
  tryHandlePermissionSlash,
  tryAutoDetectMode,
  tryHandleSelfMediaSlash,
  tryHandleGoalSlash,
  tryHandleBtwSlash,
  tryHandleCommitSlash,
} from './slash-commands'
import { persistMessageSafe, persistQuestionSafe } from './persistence'
import type { PlanStep, TerminalTask } from '@ihui/types/ai'
import type { ChatActionContext } from './types'

// =============================================================================
// 模块级单例注册表(2026-08-30 立,重新生成 / 分支闭环)
// =============================================================================
// useChat hook 全局唯一实例(ai-side-panel 单挂载),createSendMessage 每次渲染
// 都会用最新 ctx 重建 sendMessage。这里保存最新实例,供 MessageList 等无 ctx 的
// 组件通过 CustomEvent(ihui:regenerate-message / ihui:branch-message)触发
// regenerate / branch 时,复用同一套流式发送逻辑,避免重写流式处理。
export interface SendMessageOptions {
  /** 重新生成模式(2026-08-30 立):
   *  true 时不重复 addMessage/persist 用户消息 —— 历史已被截断到该用户消息之前,
   *  store 中已存在该用户消息,仅需补一个 assistant 占位并走流式。 */
  regenerate?: boolean
}

let sendMessageInstance: ((content: string, opts?: SendMessageOptions) => Promise<boolean>) | null =
  null
let sendActionCtx: ChatActionContext | null = null

/**
 * 首轮回复后自动生成会话标题(2026-09-15 立,四竞品对标 V2 #15):
 * 调 POST /conversations/:id/auto-title(LLM 依据首条用户消息生成,仅默认标题「新对话」被覆盖)。
 * 成功后 invalidate 会话列表缓存,侧栏即时显示新标题。任何失败静默(不打扰用户)。
 */
async function autoTitleAfterFirstTurn(
  queryClient: ChatActionContext['queryClient'],
  conversationId: string,
  firstUserText: string,
  model: string,
): Promise<void> {
  try {
    const res = await autoTitleConversation(conversationId, firstUserText, { model })
    if (res.success && res.data?.updated && res.data.title) {
      await queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] })
      await queryClient.invalidateQueries({ queryKey: ['chat', 'favorites'] })
    }
  } catch {
    // 标题生成失败:静默降级,保持默认标题(与后端静默策略对称)
  }
}

export function createSendMessage(
  ctx: ChatActionContext,
): (content: string, opts?: SendMessageOptions) => Promise<boolean> {
  const {
    t,
    router,
    queryClient,
    setFallbackNotice,
    abortRef,
    lastSentContentRef,
    sendInFlightRef,
    streamGenerationRef,
    streamConversationRef,
  } = ctx
  sendActionCtx = ctx
  const sendMessage = async (content: string, opts?: SendMessageOptions): Promise<boolean> => {
    const text = content.trim()
    if (!text) return false
    // 重新生成模式:跳过斜杠命令拦截/AI 自动模式检测(用户问题来自历史,不应再触发)
    const isRegenerate = opts?.regenerate === true
    // 2026-08-06 修复:入口即置在途锁,覆盖 createConversation/斜杠命令等
    // await 间隙,防止快速连按 Enter/双击重复发送(原仅靠 isStreaming 防重,
    // 但 setStreaming(true) 在网络往返之后才执行,存在竞态窗口)。
    if (sendInFlightRef.current) return false

    // W25(2026-09-14):#Rule token 展开 —— 正文含 #Rule 时把规则 YAML 内联进发送文本,
    // 仅影响发给 LLM 的内容,store/持久化仍保留原始用户输入(避免展开块污染历史气泡)。
    // 四竞品对标 V2 #18(2026-09-15):#Codebase/#Terminal/#Docs/@目录:<路径> 语义源展开。
    const baseLlmText = await expandContextTokens(expandRuleToken(text))
    // P3 #30(2026-09-16 立):diff 评审意见定向注入 —— 用户对上一轮代码改动的意见格式化为
    // `<diff_review>` 块追加到发给 LLM 的文本尾部(同样只影响发给 LLM 的内容)。
    // 重新生成模式跳过:该路径发送的是历史上下文,llmText 不参与请求,
    // 若此处一并注入并在发起前清空,意见会白白丢失 → regenerate 时保留队列不动。
    const pendingDiffComments = useChatStore.getState().pendingDiffComments
    const llmText =
      isRegenerate || pendingDiffComments.length === 0
        ? baseLlmText
        : appendDiffComments(baseLlmText, pendingDiffComments)
    const store = useChatStore.getState()
    if (store.isStreaming) return false

    sendInFlightRef.current = true
    // 所有提前 return 前必须解锁(见下方各处 sendInFlightRef.current = false)
    lastSentContentRef.current = text

    // /plan & /act 动作型斜杠命令拦截(2026-07-25 立,对标 主流 AI IDE SOLO Plan 模式):
    // - 纯 UI 模式切换,不需要登录,不调用 LLM,不创建会话
    // - 命中即清空输入框 + toast 反馈
    // 重新生成模式跳过:历史问题不应再次触发斜杠命令
    if (!isRegenerate && tryHandlePlanModeSlash(text, t)) {
      sendInFlightRef.current = false
      return true
    }

    // /build /review /spec 动作型斜杠命令拦截(2026-07-28 立,补全 ChatMode 4态三通道):
    // - 纯 ChatMode 切换,不需要登录,不调用 LLM,不创建会话
    // - 命中即清空输入框 + toast 反馈(返回 true 与 tryHandlePlanModeSlash 一致)
    if (!isRegenerate && tryHandleChatModeSlash(text, t)) {
      sendInFlightRef.current = false
      return true
    }

    // /goal 会话目标斜杠命令拦截(W24,2026-09-14 立):
    // - 纯 goal store 状态机操作,不需要登录,不调用 LLM,不创建会话
    // - 设定/查看/标记完成/清除,命中即清空输入框 + toast 反馈
    if (!isRegenerate && tryHandleGoalSlash(text, t)) {
      sendInFlightRef.current = false
      return true
    }

    // /btw 临时侧聊斜杠命令拦截(W24,2026-09-14 立,对标 Claude Code 侧聊):
    // - 直调 REST 单副本问答,不走 LLM chat 流,不创建会话,不写主线历史
    // - 回答携带 meta.sidechat 标记,主线历史构建与持久化均过滤
    if (!isRegenerate && (await tryHandleBtwSlash(text, t))) {
      sendInFlightRef.current = false
      return true
    }

    // /commit Smart Commit 斜杠命令拦截(W28,2026-09-14 立,对标 CodeBuddy AI 提交):
    // - AI 生成提交信息并自动 git add + commit,不走 LLM chat 流,不创建会话
    // - commit.before/after 钩子事件在此触发
    if (!isRegenerate && (await tryHandleCommitSlash(text, t))) {
      sendInFlightRef.current = false
      return true
    }

    // /permission ask|auto|full 动作型斜杠命令拦截(2026-07-25 深化,对标 Codex approvalMode):
    // - 纯 UI 模式切换,不需要登录,不调用 LLM,不创建会话
    // - 命中即清空输入框 + toast 反馈(切 full 时弹 5s 撤销 toast)
    if (!isRegenerate && (await tryHandlePermissionSlash(text, t))) {
      sendInFlightRef.current = false
      return true
    }

    // AI 自动判断 ChatMode(2026-07-28 立,移除 4 按钮后由 AI 决定用哪种模式):
    // - 时机:所有 /命令拦截后、createConversation 前(用户敲完按发送才触发)
    // - 静默切换,无 toast(自动判断是辅助能力,反复提示会刷屏)
    // - 当前模式徽章(CurrentModeBadge)实时反映新模式,提供视觉反馈
    // - 显式 /命令优先级最高(已在上方拦截,这里只处理普通对话)
    if (!isRegenerate) tryAutoDetectMode(text)

    // 未登录拦截(2026-07-24 立,修复"未登录点发送无反应"问题):
    // - 不调 createConversation(避免 401 无可见反馈)
    // - toast 提示 + 弹出登录弹窗(用户偏好:登录/注册用弹窗)
    // - return false 让 MessageInput 保留输入内容,登录后可直接重发
    // - 注意:仅检查 isAuthenticated(UI 标志位)。token 刷新后为 null 但 cookie 仍有效,
    //   不能用 !token 判断,否则会误拦刷新后已登录用户。stale 场景由 createConversation
    //   401 失败兜底(下方 createRes.status === 401 分支处理)。
    if (!useAuthStore.getState().isAuthenticated) {
      toast.warning('请先登录', {
        description: '登录后即可与 AI 对话',
      })
      useLoginDialogStore.getState().open('login')
      sendInFlightRef.current = false
      return false
    }

    // 拦截自媒体斜杠命令(/wechat-article / /koubo-script / /auto-task),
    // 直接调 skill API,不走 LLM chat 流。结果作为 assistant 消息追加到对话。
    // 2026-08-16 修复:命中后 assistant 消息需携带 permissionMode,
    // 且需确保 conversationId 已创建后再持久化 user/assistant(原逻辑只 addMessage 不持久化,
    // 导致刷新或跨端同步时丢失斜杠命令结果)。
    const slashHit = !isRegenerate
      ? await tryHandleSelfMediaSlash(text, (assistantContent, extra) => {
          const m = store.currentModel
          // 2026-08-31:未绑定工作区时读暂存模式,消息徽章透明性不丢失
          const st = useAiPanelStore.getState()
          const slashMode = st.activeWorkspace?.mode ?? st.pendingPermissionMode ?? undefined
          store.addMessage({ role: 'user', content: text, model: m })
          store.addMessage({
            role: 'assistant',
            content: assistantContent,
            model: m,
            permissionMode: slashMode,
            // P3 #36(2026-09-16 立):/bestof 结果卡按 runId 关联,消息流内渲染并排对比
            meta: extra?.bestOfRunId ? { bestOfRunId: extra.bestOfRunId } : undefined,
          })
        })
      : false
    if (slashHit) {
      // 斜杠命令路径同样需要 conversationId 才能持久化 user/assistant。
      // 若尚无会话,先创建(与下方主流程对齐,保持 fire-and-forget 后台持久化)。
      let slashCid = store.conversationId
      if (!slashCid) {
        const createRes = await createConversation({ model: store.currentModel })
        if (!createRes.success) {
          if (createRes.status === 401) {
            toast.warning('登录已过期', {
              description: '请重新登录后继续对话',
            })
            useAuthStore.setState({ isAuthenticated: false, user: null })
            const { isAuthenticated: isAuth, token } = useAuthStore.getState()
            if (!(isAuth && !token)) {
              openLoginDialogOnce('/')
            }
          } else {
            toast.error('创建会话失败', {
              description: createRes.error || `服务异常(${createRes.status ?? '未知'})`,
              action: {
                label: t('retry'),
                onClick: () => sendMessage(lastSentContentRef.current),
              },
            })
          }
          sendInFlightRef.current = false
          return false
        }
        slashCid = createRes.data.conversation.id
        store.setConversationId(slashCid)
        // 工作区按会话隔离(2026-09-04):新会话挂上当前待绑定工作区
        useAiPanelStore.getState().bindWorkspaceToConversation(slashCid)
        const sp = new URLSearchParams(window.location.search)
        sp.set('conversationId', slashCid)
        router.replace(`/chat?${sp.toString()}`, { scroll: false })
        queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] })
      }
      // 持久化 user + assistant(后台 fire-and-forget,失败沿用 persistMessageSafe 现有 toast 行为)
      void persistMessageSafe(slashCid, text, 'user')
      const lastAssistant = useChatStore
        .getState()
        .messages.findLast((mm) => mm.role === 'assistant' && mm.content)
      if (lastAssistant) {
        void persistMessageSafe(
          slashCid,
          lastAssistant.content,
          'assistant',
          undefined,
          lastAssistant.reasoning,
        )
      }
      sendInFlightRef.current = false
      return true
    }

    const model = store.currentModel

    // 1. 若无 conversationId，先创建会话并同步 URL
    let conversationId = store.conversationId
    if (!conversationId) {
      const createRes = await createConversation({ model })
      if (!createRes.success) {
        // 401 兜底(2026-07-24 立):isAuthenticated 可能 stale(localStorage 持久化但 cookie 已失效),
        // createConversation 返回 401 时需明确提示用户重新登录,而非静默 setError。
        // fetchApi wrapper 已调 openLoginDialogOnce 打开弹窗,此处补 toast + 同步 auth 状态。
        if (createRes.status === 401) {
          toast.warning('登录已过期', {
            description: '请重新登录后继续对话',
          })
          useAuthStore.setState({ isAuthenticated: false, user: null })
          const { isAuthenticated: isAuth, token } = useAuthStore.getState()
          // bootstrap 幽灵态不弹窗(避免刷新后并发请求的 401 打断自动登录)
          if (!(isAuth && !token)) {
            openLoginDialogOnce('/')
          }
        } else {
          // 2026-07-27 修复"登录后点击发送无反应":createConversation 非 401 失败时
          // (如 500/502/网络错误)只调 store.setError 用户看不到任何反馈,误以为按钮失灵。
          // 必须 toast.error 让用户看到错误原因,并附带重试按钮。
          const errMsg = createRes.error || `服务异常(${createRes.status ?? '未知'})`
          toast.error('创建会话失败', {
            description: errMsg,
            action: {
              label: t('retry'),
              onClick: () => sendMessage(lastSentContentRef.current),
            },
          })
          store.setError(createRes.error)
        }
        sendInFlightRef.current = false
        return false
      }
      conversationId = createRes.data.conversation.id
      // 埋点:创建对话成功(非 React 模块,轻量上报不阻塞)
      void fetchApi('/api/analytics/track', {
        method: 'POST',
        body: JSON.stringify({
          events: [{ name: 'conversation_create', category: 'chat', props: { ts: Date.now() } }],
        }),
      })
      store.setConversationId(conversationId)
      // W28 Hooks 事件:session.start(新会话创建完成)
      emitAgentHook('session.start', { summary: conversationId })
      // 工作区按会话隔离(2026-09-04):新会话挂上当前待绑定工作区,
      // 必须先于 ai-side-panel 的换装 effect 执行,否则会被"未绑定→解绑"逻辑清掉
      useAiPanelStore.getState().bindWorkspaceToConversation(conversationId)
      const sp = new URLSearchParams(window.location.search)
      sp.set('conversationId', conversationId)
      router.replace(`/chat?${sp.toString()}`, { scroll: false })
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] })
    }

    // 2. 持久化用户消息(后台 fire-and-forget,不阻塞流式响应)
    // 重新生成模式跳过:store 中已存在该用户消息(后端 /regenerate 已保留),无需重复持久化
    if (!isRegenerate) {
      void persistMessageSafe(conversationId, text, 'user')
    }

    // W24(2026-09-14):/btw 侧聊消息(meta.sidechat)不进入主线 LLM 历史
    const history = store.messages
      .filter(
        (m) =>
          !m.error &&
          (m.role === 'user' || m.role === 'assistant') &&
          m.content &&
          m.meta?.sidechat !== true,
      )
      .map((m) => ({ role: m.role, content: m.content }))

    // 四竞品对标 V2 #15(2026-09-15 立):是否为该会话首轮对话(无历史 assistant 回复)。
    // 仅首轮结束后自动生成会话标题;后续轮次/重新生成不触发。
    const isFirstAssistantTurn = !isRegenerate && !history.some((m) => m.role === 'assistant')

    // P3 #43 阶段2(2026-09-16 立):阻塞式成本协商——位于 addMessage 副作用之前,
    // 取消时零残留。开关 off(默认)= 静默预检(v1 知情);on 且估算超阈值 = 确认条。
    const costGuardMessages = [...history, { role: 'user' as const, content: llmText }]
    if (costGuardMessages.length > 0 && model) {
      try {
        const r = await fetchApi<{
          estimatedTokensIn: number
          estimatedTokensOut: number
          estimatedCostUsd: number
          priced: boolean
        }>('/api/chat/cost-estimate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages: costGuardMessages }),
        })
        if (r.success && r.data) {
          const estimate = {
            estimatedTokensIn: r.data.estimatedTokensIn,
            estimatedTokensOut: r.data.estimatedTokensOut,
            estimatedCostUsd: r.data.estimatedCostUsd,
            priced: r.data.priced,
          }
          useCostGuardStore.getState().setEstimate(estimate)
          if (
            isCostNegotiationEnabled() &&
            estimate.estimatedCostUsd > COST_NEGOTIATION_THRESHOLD_USD
          ) {
            const okToSend = await new Promise<boolean>((resolve) => {
              useCostGuardStore.getState().setPendingConfirm(resolve)
            })
            useCostGuardStore.getState().setPendingConfirm(null)
            if (!okToSend) {
              // 用户取消:解锁在途锁,静默返回(消息未入流,零残留)
              sendInFlightRef.current = false
              return true
            }
          }
        }
      } catch {
        // 预检失败静默:不阻塞聊天(v1/阶段2 同一原则)
      }
    }

    // V3 #68(2026-09-27 立):本轮真正使用的模型,必须在**最后一个 await 之后**复核。
    // 入口取的 `model`(:321)到这里之间隔着建会话 / 成本预检(「成本协商」还会等用户点确认),
    // 期间用户改了模型档位 —— 若沿用旧值,就是票面禁止的"用旧模型发新一轮"。
    // 这里取最新档位而不是终止本轮:用户已经按了发送,让他重发一次等于没做这张票;
    // 且这一轮尚未触达 provider,终止只会留下一条空气泡。
    const roundModel = resolveRoundModel(model, useChatStore.getState().currentModel)

    // 重新生成模式跳过用户消息重复添加(历史已截断到该用户消息之前,store 已包含它)
    if (!isRegenerate) {
      store.addMessage({ role: 'user', content: text, model: roundModel })
    }
    // 记录该消息生成时的工作区权限模式(2026-07-25 深化,深度对标 Codex 透明性)
    // 模式用于消息气泡的徽章展示,让用户事后能识别"这条回答是基于哪种权限模式生成的"
    // 2026-08-31:未绑定工作区时读暂存模式
    const permState = useAiPanelStore.getState()
    const currentMode: WorkspacePermissionMode | undefined =
      permState.activeWorkspace?.mode ?? permState.pendingPermissionMode ?? undefined
    const assistantId = store.addMessage({
      role: 'assistant',
      content: '',
      model: roundModel,
      permissionMode: currentMode,
    })

    // 2026-09-13 批次 2 #16:记录流开始时间戳,用于消息级运行时长展示
    const streamStartedAt = Date.now()

    store.setStreaming(true)
    store.setError(null)
    store.resetSubAgentActivities()
    // #21 中断后追加指令继续(2026-09-13 立):新流开始 → 清除中断提示态
    store.setInterruptedMessage(null)
    // P1-6 断点续传(2026-09-13 立):流开始 → 标记该助手消息「未完成」。
    // 若中途刷新页面,finally 不会执行,此标记保持 false 落盘,
    // 页面重新挂载时据此判定可续接;正常/异常收尾在 finally 里置回 true。
    store.setMessageStreamCompleted(assistantId, false)
    // P4-2: 清除上一轮 fallback 通知,避免旧横幅残留到新对话轮次
    setFallbackNotice(null)
    // Steer(中途引导,2026-09-19 立):记录当前流式 assistant 消息 ID。
    // 闪电按钮触发 steer 端点时凭 conversationId+messageId 反查 upstreamSessionId,
    // 流收尾(finally 代际守卫)时同步置回 null。
    store.setStreamingAssistantId(assistantId)

    const controller = new AbortController()
    abortRef.current = controller
    // 2026-08-21 修复(C2/C3):记录流代际与绑定会话。
    // - 代际:旧流被 abort 后其 finally 跳过全局清理,防止污染新流状态
    // - 绑定会话:切换会话的 effect 据此 abort 旧流;onCompaction 据此丢弃过期压缩结果
    const streamGeneration = ++streamGenerationRef.current
    streamConversationRef.current = conversationId

    // #13 首 token 超时区分 reasoning(2026-07-25 立):
    // 双阶超时适配 reasoning 模型(o1/R1)长思考场景:
    // - timeout30s:30s 内 reasoning + content 都未收到 → abort(完全冷启动)
    //   2026-07-27 修复:15s → 30s。StepFun step-router-v1 等推理模型首次请求冷启动
    //   可能 >15s(含 CORS preflight + TCP + LLM 首 token 延迟),15s 误 abort 导致 net::ERR_ABORTED。
    // - timeout60s:60s 内 content 未收到但 reasoning 已收到 → abort(reasoning 模型可能长时间只产 reasoning)
    // - 任一 content token 到达 → clearTimeout 两个 timer(进入正常流式)
    // - 用户主动 stop 触发的 abort 不报错(由 abortedByTimeout* 标志区分)
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

    // #16 流式平滑渲染(2026-09-15 立):content 走平滑 batcher(rAF 逐帧推进,落后越多追越快);
    // reasoning/agent 保持原帧级 rAF 合并(原样不动)。onProgress 节流估算实时 token 用量(#21)。
    let finalUsageReceived = false
    let lastLiveUsageAt = 0
    const contentBatcher = createSmoothDeltaBatcher(
      (d) => useChatStore.getState().appendToMessage(assistantId, d),
      {
        // #21 流内实时 token 估算:节流 800ms 调 estimateLiveUsage 并写入 meta.usage(estimated)。
        // 取 store 中真实已生成文本做 CJK 计数(比 charCount 更准确);权威 usage 到达后由 finalUsageReceived 停更。
        onProgress: (_charCount: number) => {
          if (finalUsageReceived) return
          const now = Date.now()
          if (now - lastLiveUsageAt < 800) return
          lastLiveUsageAt = now
          const msg = useChatStore.getState().messages.find((m) => m.id === assistantId)
          const text = msg?.content ?? ''
          if (text.length === 0) return
          useChatStore.getState().updateMessageMeta(assistantId, { usage: estimateLiveUsage(text) })
        },
      },
    )
    const reasoningBatcher = createDeltaBatcher((d) =>
      useChatStore.getState().appendReasoningToMessage(assistantId, d),
    )
    const agentBatcher = createAgentDeltaBatcher()

    // 从 auth store 获取 userId(用于回调链路关联)
    const userId = useAuthStore.getState().user?.id ?? ''
    // 从 ai-panel store 获取当前绑定的本地工作区路径(用于注入 CLAUDE.md/AGENTS.md 项目记忆)
    const workspacePath = useAiPanelStore.getState().activeWorkspace?.path
    // web 非 Tauri 环境:用 FileSystemDirectoryHandle 预加载工作区文件内容(阶段 1)
    // Tauri 桌面端返回 undefined,走原有 workspacePath 逻辑
    const workspaceContext = await loadBrowserWorkspaceContext()

    // 2026-08-06 立:不再做 'auto' → stepfun/step-router-v1 防御性降级。
    // 原降级会把 Auto 模式绑死 stepfun 一家,违反用户反馈"应该自动切换所有可使用的模型"。
    // 现在把 'auto' 原样透传到 ai-service,由后端 llm_gateway._resolve_auto_model
    // 从 model_availability 全量可用模型池中跨厂商选最优(stepfun/agnes/cloudflare/nvidia_nim/gemini 等)。
    // V3 #68:发起前**再**复核一次档位 —— `loadBrowserWorkspaceContext()`(:550)也是 await,
    // 从 :442 到这里仍可能被一次模型切换插进来。判据"绝不能把旧模型送到 provider"要求在
    // 离 provider 最近的那一处定档;消息徽章取 :442 的值(那之后到这里的窗口是毫秒级读盘,
    // 不是用户交互),这一格已知不闭合,登记在交付报告。
    const effectiveModel = resolveRoundModel(roundModel, useChatStore.getState().currentModel)

    // 2026-08-07 修复:web 端无活跃工作区 / 无 workspace handle 时,fs 类工具静默失败,
    // 给用户一个一次性 toast 提示(整个 sendMessage 周期内只弹一次,避免刷屏)。
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
      // 2026-08-16 立:强制传 contextLimit,后端根据该值判断是否触发 88% 自动压缩。
      const resolvedContextLimit = getModelContextCapacity(effectiveModel)
      // 2026-09-21 修复:"正在压缩上下文"预告必须与后端触发口径一致。原实现每次发送无条件
      // 点亮 compacting(与是否压缩无关),且仅靠 onResponse 清除 —— 请求在响应头之前
      // 失败/被 abort 时永久常驻。现在:① 占用率未达 88% 阈值不显示;② finally 兜底回收。
      if (isContextAtCompactionThreshold(store.messages, resolvedContextLimit)) {
        useChatStore.getState().setCompactionStatus({ phase: 'compacting' })
      }
      logger.debug(
        '[Compaction] sendMessage contextLimit=',
        resolvedContextLimit,
        'model=',
        effectiveModel,
      )

      // P1-7(2026-09-13 立):读取会话级高级参数(全局默认 + 会话覆盖),
      // 发送时一次性快照,避免流式过程中用户改参数导致同一轮请求参数不一致。
      const samplingParams = getSamplingParams(conversationId)

      // W28 Hooks 事件:message.send(用户消息即将发送给 LLM)
      emitAgentHook('message.send', { summary: llmText.slice(0, 80) })

      // P3 #30:意见已进入本次请求的 messages payload,发起前清空队列(消费即清,避免重复注入)。
      // 置于此处而非 llmText 构造处:中间有斜杠命令等提前 return 分支,过早清空会误丢意见。
      // 请求失败时 streamChat 内部重试复用同一 messages,意见不会丢失。
      if (!isRegenerate && pendingDiffComments.length > 0) {
        useChatStore.getState().clearDiffComments()
      }

      // V3 #69:每轮发起前回收上一轮的额度快照 —— 进度条反映的是"本轮"的窗口占用,
      // 不接这一格会让切会话/重新生成后继续挂着上一轮的百分比(同上方"消费即清"姿势)。
      clearBudgetEvent()

      await streamChat({
        model: effectiveModel,
        // W25:#Rule 展开后的文本发给 LLM(重新生成模式:用户消息已在 store/历史中,直接作为完整上下文发送,不重复追加)
        messages: isRegenerate ? history : [...history, { role: 'user', content: llmText }],
        signal: controller.signal,
        // P1-7(2026-09-13 立):会话级采样参数(高级参数面板),undefined = 用模型默认,
        // api-client 仅在字段存在时写入 body(见 client.ts streamChat body 构造)。
        temperature: samplingParams.temperature,
        topP: samplingParams.topP,
        topK: samplingParams.topK,
        maxTokens: samplingParams.maxTokens,
        // P1 #26(2026-09-16 立):知识库默认注入开关。
        // undefined = 后端默认开(top-3 检索注入);false = 显式关闭(api-client 仅在 false 时写入 body)。
        knowledgeContext: samplingParams.knowledgeContext,
        metadata: {
          conversationId,
          userId,
          messageId: assistantId,
        },
        // 模式透传(2026-07-22 立,对标 主流 AI IDE Plan/Spec):build/plan/review/spec
        // Plan/Act 模式(2026-07-24 立):plan=只制定计划不执行工具,act=正常执行
        extraBody: {
          // ChatMode 4 态唯一模式字段(2026-07-28 移除独立 PlanActToggle 后,plan_mode 字段已废弃,语义合并到 mode)
          mode: useModeStore.getState().currentMode,
          // P1-7:自定义 system prompt(会话级),ai-service 注入系统消息最顶部;
          // 未设置时不传该 key,保持上游默认行为。
          ...(samplingParams.systemPrompt ? { systemPrompt: samplingParams.systemPrompt } : {}),
        },
        // V3 #58(2026-09-26 立):权限模式档位透传 —— ai-service 工具审批门据此
        // 决定高危工具是否弹审批(bypass-permissions 不拦截;accept-edits 放行
        // 文件编辑类;缺省按 default 处理)。currentMode 即消息徽章同源的档位快照。
        permissionMode: currentMode,
        workspacePath,
        workspaceContext,
        // 跨端统一 88% 阈值自动压缩:从模型 ID 推断 contextLimit,API 端调用共享包压缩
        contextLimit: resolvedContextLimit,
        // 2026-08-16 修复:显式声明流式,与 sendAnswer 保持一致,
        // 避免某些后端/中间件对 request.stream 做严格字段检测时关闭 SSE。
        stream: true,
        onCompaction: async (info) => {
          // 2026-08-21 修复(C2):压缩结果只允许写回发起流的会话。
          // 原缺陷:流式期间用户切换会话后,setMessages 会用旧会话的压缩消息
          // 整体覆盖新会话的消息列表(消息串会话)。
          if (useChatStore.getState().conversationId !== conversationId) return
          // 显示底部压缩状态栏(2026-08-16 立)
          useChatStore.getState().setCompactionStatus({
            phase: 'done',
            tokensBefore: info.tokensBefore,
            tokensAfter: info.tokensAfter,
            removedCount: info.removedCount,
            trigger: info.trigger,
          })
          // 2026-09-18 v2:压缩元信息同步挂到当前 assistant 消息
          // (MessageItem 渲染 CompressionDivider"上方历史已压缩"分隔线;压缩重写消息列表时
          //  active assistant 消息(lastLocal)被保留,setMessageCompaction 按 id 定位不受影响)
          if (assistantId) {
            useChatStore.getState().setMessageCompaction(assistantId, {
              originalTokens: info.tokensBefore,
              compressedTokens: info.tokensAfter,
              removedCount: info.removedCount,
              trigger: info.trigger,
            })
          }

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
            const result = await getMessages(currentConversationId, {
              direction: 'initial',
              pageSize: 100,
            })
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
        // P4-2: 后端 fallback 触发时设置通知状态,UI 展示"已切换到备用模型"横幅
        onFallback: (event) => setFallbackNotice(event),
        // P1 重连提示(2026-08-02 立):streamChat 自动重连时 toast 通知用户,避免无感知等待
        onReconnect: (attempt: number, delay: number) => {
          const reconnectingMsg =
            t('reconnecting') === 'reconnecting' ? 'Reconnecting...' : t('reconnecting')
          const attemptMsg =
            t('reconnectAttempt', { n: String(attempt), ms: String(delay) }) === 'reconnectAttempt'
              ? `Attempt ${attempt}, retrying in ${delay}ms`
              : t('reconnectAttempt', { n: String(attempt), ms: String(delay) })
          toast.info(reconnectingMsg, { description: attemptMsg })
        },
        // 2026-07-27 修复:response 已到达即清除"完全冷启动"超时(timeout15s),
        // 避免"response 到达但首 token 未到达"时误 abort 导致 net::ERR_ABORTED。
        // 保留 timeout60s(防止 reasoning 模型长时间只产 reasoning 不产 content)。
        // 2026-08-16 立:收到响应后立即清除压缩中状态(无论是否触发压缩)
        onResponse: () => {
          clearTimeout(timeout15sId)
          clearCompactionPreview()
        },
        onUsage: (usage) => {
          // P1 token 用量写入消息 meta(2026-08-15 立):后端 SSE 流末尾发送 usage chunk,
          // 前端收到后更新 assistant 消息 meta.usage,UI 展示 token 计数。
          // #21 权威值到达:置 finalUsageReceived 停止实时估算覆盖,确保最终展示权威数字。
          finalUsageReceived = true
          useChatStore.getState().updateMessageMeta(assistantId, { usage })
          // D1 消息级计量(2026-09-19 立):写入 store.usageByMessageId,驱动消息底部徽章行。
          // 载荷即 api-client UsageEvent(扁平契约):messageId/timing/costUsd 缺失(null)时
          // createUsageHandler 兜底(回退 assistantId / 0 / null)。
          createUsageHandler(assistantId)(usage)
          // P3 #43:实际 tokens 到达,供「实际 vs 预估」对比条展示
          if (usage.totalTokens > 0) {
            useCostGuardStore.getState().setActualTokens(usage.totalTokens)
          }
        },
        onDelta: (delta) => {
          if (!firstContentTokenReceived) {
            firstContentTokenReceived = true
            clearTimeout(timeout15sId)
            clearTimeout(timeout60sId)
          }
          contentBatcher.batch(delta)
        },
        onAgentDelta: (_agentId, delta) => {
          if (!firstContentTokenReceived) {
            firstContentTokenReceived = true
            clearTimeout(timeout15sId)
            clearTimeout(timeout60sId)
          }
          agentBatcher.batch(_agentId, delta)
        },
        onReasoning: (delta) => {
          if (!firstReasoningTokenReceived) {
            firstReasoningTokenReceived = true
            // 2026-07-27 修复:收到 reasoning token 即清除 timeout15s(完全冷启动超时),
            // 避免冷启动延迟 + 首个 reasoning 到达间隔 >30s 时误 abort。
            // 保留 timeout60s(防止 reasoning 模型长时间只产 reasoning 不产 content)。
            clearTimeout(timeout15sId)
          }
          reasoningBatcher.batch(delta)
        },
        onToolCall: (event) => {
          // 2026-07-27 修复工具调用场景下 15s 超时中断 SSE 流:
          // 工具调用过程中 SSE 只发 tool-call-start/tool-result 事件,不发 content/reasoning token,
          // 导致 firstContentTokenReceived 和 firstReasoningTokenReceived 都为 false,
          // 15s 后 timeout15s 触发 controller.abort() 中断 SSE 流,UI 显示"无响应"。
          // 修复:收到任意 tool-call 事件即视为正常响应,清除两个超时定时器。
          if (!firstContentTokenReceived) {
            firstContentTokenReceived = true
            clearTimeout(timeout15sId)
            clearTimeout(timeout60sId)
          }
          createToolCallHandler(assistantId)(event)
        },
        // Subagent 自动派发(2026-07-28 立,对标 AI 工作台):
        // 后端 dispatch_subagent 工具执行前后发 subagent_spawn/end SSE 事件,
        // 前端通过回调写入 chat store.subAgentActivities,UI 自动展示生命周期。
        // 2026-07-29 Phase 21:同步写入 timeline-store,让 Timeline tab 实时响应。
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
        // 2026-07-31 立,AI 对话可视化深度接入:SSE 流末尾 tool-summary 事件落地
        onToolSummary: createToolSummaryHandler(assistantId),
        // 2026-08-01 Phase 4a:消息级 plan/terminal 事件落地(inline 到消息气泡)
        // subagent 事件无需新增回调:store 的 addSubagentSpawn/markSubagentEnd/updateSubagentProgress
        // 已内部判断 event.messageId 同步写入 message.subagentActivities。
        onPlanUpdate: (evt) => {
          if (!evt.messageId) return
          const steps: PlanStep[] = evt.plan.map((item, i) => ({
            // 2026-09-18 v2:优先用后端步骤 id(= toolCallId,支持步骤↔工具卡精确关联),旧事件回退本地生成
            id: item.id ?? `plan-${i}-${item.step.slice(0, 16)}`,
            step: item.step,
            // v2 五态契约:后端可直接发 failed;旧事件 error=true 归一化为 failed
            status: item.status === 'failed' || item.error === true ? 'failed' : item.status,
            explanation: evt.explanation,
            startedAt: item.startedAt,
            endedAt: item.endedAt,
            durationMs: item.durationMs,
            tokenUsage: item.tokenUsage,
            ...(Array.isArray(item.toolCallIds) ? { toolCallIds: item.toolCallIds } : {}),
            ...(item.error === true ? { error: true } : {}),
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
        // 2026-09-18 立(对标 Codex/Trae 的 bash 实时回显):终端命令执行期间后端逐块下发
        // terminal_delta(4 行/批),此处累加到 store.terminalOutputs(terminalId 为键),
        // 由终端实时面板边执行边滚动渲染。刻意不要求 messageId(事件只保证 terminalId),
        // 缺失时按 terminalId 关联即可;缓冲上限由 store 侧裁剪(20000 字符/键)。
        onTerminalDelta: (evt) => {
          if (!evt.terminalId || !evt.text) return
          useChatStore.getState().appendTerminalOutput(evt.terminalId, evt.text)
        },
        onTerminalEnd: (evt) => {
          if (!evt.messageId) return
          useChatStore.getState().updateMessageTerminalTask(evt.messageId, evt.terminalId, {
            status: evt.status,
            output: evt.output,
            // 截断交代必须一起落 store:回放/刷新时没有 live 缓冲,长度相等看不出内容不完整
            truncated: evt.truncated,
            totalChars: evt.totalChars,
            exitCode: evt.exitCode,
            endedAt: evt.endedAt,
            durationMs: evt.durationMs,
          })
        },
        // #11 Citations 全链路(2026-09-13 立):引用溯源落地
        // 后端 knowledge_lookup 工具执行后 done 前下发 citations 事件,
        // 写入 message.citations,MessageItem 渲染 CitationBar。
        // messageId 缺省时回退到本条 assistant 消息 ID(事件必然属于当前流)。
        // P1 #26(2026-09-16 改):整替 → 追加合并(source+label 去重)。流首的 rag citations
        // (#26 网关合成)与流中的工具 citations(#11 knowledge_lookup)共存时互不覆盖。
        onCitations: (evt) => {
          const targetId = evt.messageId ?? assistantId
          if (!targetId || !evt.citations?.length) return
          const store = useChatStore.getState()
          const existing =
            store.messages
              .find((m) => m.id === targetId)
              ?.citations?.filter(
                (c) => !evt.citations.some((n) => n.source === c.source && n.label === c.label),
              ) ?? []
          store.setMessageCitations(targetId, [...existing, ...evt.citations])
        },
        // D34 上下文注入交代(2026-09-22 立):后端在注入真正生效后、任何增量前下发
        // injection_applied,写入 message.injections,MessageItem 渲染 InjectionBar。
        // 此前该帧在 api-client 里只被"不喷进正文"地丢弃 —— 生产了却没人看。
        onInjectionApplied: (evt) => {
          const targetId = evt.messageId ?? assistantId
          if (!targetId) return
          useChatStore.getState().appendMessageInjection(targetId, {
            kind: evt.kind,
            collapsed: evt.collapsed,
            ...(evt.fullText ? { fullText: evt.fullText } : {}),
            ...(typeof evt.count === 'number' ? { count: evt.count } : {}),
          })
        },
        // D39/D108 上游重试交代:retry_scheduled → 本条 assistant 消息的一行提示。
        // 不接就等于让 web 用户在退避期只看到"停顿"(该帧第 42 轮已入契约,当时只补了通道)。
        onRetryScheduled: (evt) => {
          const targetId = evt.messageId ?? assistantId
          if (!targetId) return
          useChatStore.getState().setMessageRetryNotice(targetId, {
            attempt: evt.attempt,
            maxRetries: evt.maxRetries,
            retryInMs: evt.retryInMs,
            ...(typeof evt.httpStatus === 'number' ? { httpStatus: evt.httpStatus } : {}),
          })
        },
        // P1 #27 记忆更新可视化(2026-09-16 立):后端 done 事件 payload 携带 memoryUpdates,
        // 写入 message 级提示条数据,MessageItem 在本条 assistant 消息下方渲染「已记住」提示条。
        // messageId 缺省时回退到本条 assistant 消息 ID(done 必然属于当前流)。
        onMemoryUpdates: (evt) => {
          const targetId = evt.messageId ?? assistantId
          if (!targetId || !evt.items?.length) return
          useChatStore.getState().appendMemoryNotice(targetId, evt.items)
        },
        // Steer(中途引导,2026-09-19 立):ai-service 在 tool loop 边界注入用户引导后
        // 下发 steer 事件(phase='injected')确认,写入消息级引导徽章数据,
        // MessageItem 在本条 assistant 消息下方渲染「已引导」徽章。
        // messageId 缺省时回退到本条 assistant 消息 ID(事件必然属于当前流)。
        onSteer: (evt) => {
          const targetId = evt.messageId ?? assistantId
          if (!targetId || !evt.text) return
          useChatStore.getState().appendSteerNotice(targetId, {
            text: evt.text,
            timestamp: evt.timestamp,
          })
        },
        // Budget 用量分档提醒(2026-09-19 立):网关 checkTokenBudget 三态决策,流放行前在
        // 流首下发 budget 命名帧——80%≤用量<95% 为 level='warning'、95%≤用量<100% 为
        // level='critical',本条消息照常生成不受影响,仅 toast 提示用量进度;用量≥100% 则
        // 429 硬中断,走 onError 的 BUDGET_EXHAUSTED 分支(见下)。
        onBudget: (evt: BudgetEvent) => {
          // V3 #69:先把帧落进进度条状态(输入框上方常驻实时条),再按 2026-09-19 原设计提示一次
          setBudgetEvent(evt)
          // token 数格式化:≥1 万用「X.X 万」缩写,否则原样展示
          const fmtTokens = (n: number | undefined) =>
            n === undefined ? '?' : n >= 10000 ? `${Math.floor(n / 1000) / 10} 万` : `${n}`
          const parts: string[] = []
          if (evt.usedTokens !== undefined && evt.limitTokens !== undefined) {
            parts.push(`已用 ${fmtTokens(evt.usedTokens)} / ${fmtTokens(evt.limitTokens)} tokens`)
          }
          if (evt.percent !== undefined) parts.push(`${evt.percent}%`)
          parts.push('明日 0 点重置')
          if (evt.tier) parts.push(`(${evt.tier} 档)`)
          if (evt.level === 'critical') {
            // 95%~100% 临界档:强提醒,本条仍会正常完成
            toast.warning('今日 AI 用量即将耗尽', { description: parts.join(',') })
          } else {
            // 80%~95% 提醒档:信息级提示,不打断阅读
            toast.info('今日 AI 用量较高', { description: parts.join(',') })
          }
        },
        // 阶段 2:浏览器端工具执行代理(2026-08-02 立)
        // ai-service 在远程服务器无法访问本地文件,LLM 调用 fs 类工具时通过 SSE
        // tool-delegate 事件委托前端用 FileSystemDirectoryHandle 执行,通过 postToolResult 回传
        // 2026-08-07:无工作区提示已移到 sendMessage 顶层,通过 noWorkspaceNoticeShown 去重,
        // 多个 fs 工具失败时只弹一次 toast,避免刷屏。
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
        // V3 #58(2026-09-26 立):主对话流工具审批 —— ai-service tool loop 在高危
        // 工具(run_command/delete_file/write_file 等)执行前发 tool-approval 帧,
        // 桥接到全局 ToolApprovalDialog 弹窗(approve/deny + once/session/always 三档
        // + 原因输入全部复用既有组件)。channel='chat-stream' 标记让弹窗把决策经
        // postToolApprovalResponse 回传到主聊天流端点(llm.py _approval_sessions),
        // 而非 agent 任务流的 /agents/approval-response —— 两套审批注册表互不相通。
        onToolApproval: (event: ToolApprovalEvent) => {
          dispatchToolApprovalRequest({
            approvalId: event.approvalId,
            toolName: event.toolName,
            toolCallId: event.toolCallId,
            argsPreview: event.argsPreview,
            dangerLevel: event.dangerLevel,
            sessionId: event.sessionId,
            channel: 'chat-stream',
          })
        },
        // 2026-08-29 修复:仅当用户显式启用插件工具时才携带 agentTools。
        // 普通问答不携带 → 后端不命中 tool loop,走流式 astream() 恢复打字机输出(详见 tool-config.ts)
        // 2026-09-19:消息含教育管理意图(催费/欠费/学费/缴费/退费/账单)时条件携带对应 edu_* 工具
        // 2026-09-21:消息在"要求操作本站"(打开/点击/填写/查后台…)时条件携带 web_ui_* / api_* ——
        //   否则端侧操控桥在普通对话里永远进不了模型视野(llm.py 无 agentTools 就不进 tool loop)。
        ...(() => {
          const agentTools = [
            ...new Set([
              ...mergeAgentTools(),
              ...eduToolsFor(content),
              ...uiControlToolsFor(content),
              ...fileToolsFor(content),
            ]),
          ]
          return agentTools.length > 0 ? { agentTools } : {}
        })(),
        onError: (errMsg, info) => {
          // #9 错误前先 flush 累积 token,避免最后一批内容丢失
          contentBatcher.flush()
          reasoningBatcher.flush()
          agentBatcher.flushAll()
          // W28 Hooks 事件:error(SSE 流式错误)
          emitAgentHook('error', { summary: errMsg?.slice(0, 120) })
          const formatted = formatSSEError(errMsg, info)
          // 前端错误码透出(P1,2026-07-22 立):errorCode 是唯一可靠判据(见 localizeQuotaExhausted)
          const ec = info?.errorCode
          // 厂商账号额度耗尽(2026-09-22 批次 60):人话化 + 不给 retry(重试必然再撞)
          const quotaNotice = localizeQuotaExhausted(ec, t)
          // Budget 三态·硬中断档(2026-09-19 立):网关判定日用量 ≥100% 时返回 429 +
          // errorCode='BUDGET_EXHAUSTED'(响应体含 percent/usedTokens/limitTokens/resetAt)。
          // 与普通限频区分:预算要到次日 0 点才重置,通用「频率超限,60 秒后重试」文案会误导。
          const isBudgetBlock = ec === 'BUDGET_EXHAUSTED'
          const budgetBlockMessage = '今日 token 预算已用尽,明日 0 点重置后可继续对话'
          const displayMessage = isBudgetBlock
            ? budgetBlockMessage
            : (quotaNotice?.message ?? formatted.message)
          // V3 #69:errorCode 一并落进消息 —— 失败卡的 D67 归属分型(fromErrorCode)只认消息上的
          // 码;不带码则 429 只落通用失败标题,"额度已用尽"分型卡永远进不了屏幕
          // (与 send-answer.ts 的 D92 同一姿势:`setMessageError(id, error, errorCode)`)。
          useChatStore.getState().setMessageError(assistantId, displayMessage, ec)
          useChatStore.getState().setError(displayMessage)
          if (formatted.severity === 'auth') {
            useLoginDialogStore.getState().open('login')
          }
          // toast description 前缀 [errorCode],让用户直接定位问题
          // (MODEL_NOT_CONFIGURED/PROVIDER_NOT_IMPLEMENTED/LLM_ERROR 等)
          const toastDesc =
            formatted.severity === 'auth'
              ? formatted.message
              : ec
                ? `[${ec}] ${formatted.rawMessage}`
                : formatted.rawMessage
          if (isBudgetBlock) {
            // Budget 硬中断档 toast:预算次日 0 点才重置,立即重试必然再 429,故不给 retry 按钮
            toast.error('今日 AI 用量已达上限', {
              description: budgetBlockMessage,
            })
          } else if (quotaNotice) {
            // 额度耗尽档:全部候选通道都已失败,立即重试必然再撞,故不给 retry 按钮(同 Budget 档理由)
            toast.error(quotaNotice.title, {
              description: toastDesc,
            })
          } else if (formatted.severity === 'ratelimit') {
            toast.warning(formatted.title, { description: toastDesc })
          } else if (formatted.severity === 'safety') {
            // 内容被 AI 厂商安全策略拦截,用 warning 级别提示用户调整提问方式
            toast.warning(formatted.title, { description: formatted.message })
          } else {
            // P1 错误重试(2026-07-23):toast 加 retry 按钮,一键重发
            toast.error(formatted.title, {
              description: toastDesc,
              action: {
                label: t('retry'),
                onClick: () => sendMessage(lastSentContentRef.current),
              },
            })
          }
        },
      })
    } catch (err) {
      // #9 catch 前先 flush 累积 token,避免最后一批内容丢失
      contentBatcher.flush()
      reasoningBatcher.flush()
      agentBatcher.flushAll()
      // W28 Hooks 事件:error(请求异常,含超时/中止之外的网络错误)
      emitAgentHook('error', {
        summary: err instanceof Error ? err.message.slice(0, 120) : 'unknown',
      })
      if (err instanceof DOMException && err.name === 'AbortError') {
        // #13 区分两种超时:15s 完全冷启动 vs 60s reasoning 已收到但 content 未到
        // 用户主动 stop 触发的 abort(abortedByTimeout* 均为 false)静默不报错
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
          toast.warning(formatted.title, { description: `${prefix}${formatted.message}` })
        } else if (formatted.severity === 'network') {
          // P1 错误重试(2026-07-23):网络错误 toast 加 retry 按钮
          toast.error(formatted.title, {
            description: `${prefix}${formatted.message}`,
            action: { label: t('retry'), onClick: () => sendMessage(lastSentContentRef.current) },
          })
        } else {
          toast.error(formatted.title, {
            description: `${prefix}${formatted.rawMessage}`,
            action: { label: t('retry'), onClick: () => sendMessage(lastSentContentRef.current) },
          })
        }
      }
    } finally {
      clearTimeout(timeout15sId)
      clearTimeout(timeout60sId)
      // 2026-07-27 修复"AI 响应不显示":finally 必须先 flush 再 cancel,
      // 否则最后一批 token(还在 pending 未触发 rAF)会被 cancel 直接丢弃,
      // 导致 streamChat 成功返回后 UI 仍为空。
      // flush 内部已 cancelAnimationFrame + 清 pending,后续 cancel 仅兜底。
      contentBatcher.flush()
      reasoningBatcher.flush()
      agentBatcher.flushAll()
      // assistant 消息持久化由后端 ai-callback worker 权威负责(带扣费/幂等/WS 推送):
      // 前端 streamChat metadata 已携带 conversationId/userId/messageId,
      // ai-service 推理完成后 _fire_callback → /api/ai/callback → worker 落库。
      // 2026-08-21 修复:删除此处前端持久化(曾每轮必现 400 误报 toast)。
      contentBatcher.cancel()
      reasoningBatcher.cancel()
      agentBatcher.cancelAll()
      // 2026-08-21 修复(C3):代际守卫。仅当本流仍是最新流时才清理全局状态,
      // 防止被"切换会话"abort 的旧流把新流/新会话的 isStreaming 错误置 false、
      // 或把新会话正在跑的 agent 流误标完成。batcher 为流私有,无需守卫。
      if (streamGenerationRef.current === streamGeneration) {
        abortRef.current = null
        // 2026-09-21 修复:兜底回收"压缩中"预告态。onResponse 之前失败(HTTP 4xx/5xx throw)、
        // 超时 abort、主动 stop 都不会触发 onResponse,不清则灰条全站常驻(状态在全局 store)。
        clearCompactionPreview()
        useChatStore.getState().setStreaming(false)
        // Steer(中途引导,2026-09-19 立):流收尾同步清除流式消息 ID。
        // 代际守卫内清理,防止被「切换会话」abort 的旧流清掉新流的指向。
        useChatStore.getState().setStreamingAssistantId(null)
        useChatStore.getState().markAllAgentStreamsDone()
        // #23 撤回未执行工具卡(2026-09-13 立):流收尾时把仍处 running 的工具卡置为
        // cancelled(报错/中断/超时路径下后端不会再返回 tool-result)。
        // 正常 done 路径所有工具卡已有终态,此调用为空操作。
        useChatStore.getState().revokePendingToolCalls(assistantId)
      }
      // P1-6:流已收尾(正常完成 / 报错 / 超时 / 主动 stop)→ 标记完成,刷新后不再续接。
      // 注意:必须在 generation 守卫之外 —— 被「切换会话」abort 的旧流同样已终止,
      // 不置 true 会导致用户切回该会话时误触发续接。
      useChatStore.getState().setMessageStreamCompleted(assistantId, true)
      // 2026-09-13 批次 2 #16:写入消息级运行时长(耗时 = 流结束 - 流开始)
      const streamEndedAt = Date.now()
      useChatStore.getState().updateMessageMeta(assistantId, {
        durationMs: streamEndedAt - streamStartedAt,
        startedAt: streamStartedAt,
        toolCallCount:
          useChatStore.getState().messages.find((m) => m.id === assistantId)?.toolCalls?.length ??
          0,
      })
      // 2026-08-06 修复:发送完成(成功/异常)释放 in-flight 锁,允许下一次发送
      sendInFlightRef.current = false
      // W28 Hooks 事件:message.receive(助手回复收尾,异常路径下跳过)+ session.end(本轮流结束)
      const finalMsg = useChatStore.getState().messages.find((m) => m.id === assistantId)
      if (!finalMsg?.error) {
        emitAgentHook('message.receive', {
          summary: finalMsg?.content.slice(0, 80) ?? '',
        })
        // W29 Repo Wiki 自动捕获(开启 autoCapture 时):对最近一轮问答提取知识卡片,
        // fire-and-forget,失败静默不打断主链路。
        maybeAutoCaptureWiki(llmText, finalMsg?.content ?? '', conversationId ?? undefined)
        // 四竞品对标 V2 #15(2026-09-15 立):首轮回复完成后自动生成会话标题。
        // fire-and-forget:后端 LLM 生成失败/超时静默保持默认标题,绝不 toast 打扰;
        // 仅首轮触发(history 无 assistant),重新生成/后续轮次跳过。
        if (isFirstAssistantTurn && conversationId && finalMsg?.content) {
          void autoTitleAfterFirstTurn(queryClient, conversationId, text, model)
        }
      }
      emitAgentHook('session.end', { summary: conversationId })
    }
    // 消息已提交到 store(即使流式出错也有 error 标记 + retry 按钮),可清空输入框
    return true
  }
  // 注册到模块级单例,供无 ctx 组件(MessageList)通过 CustomEvent 触发 regenerate
  sendMessageInstance = sendMessage
  return sendMessage
}

/**
 * 重新生成消息(2026-08-30 立)。
 * 由 MessageList 监听 `ihui:regenerate-message` 后调用,完整闭环:
 * 1. 调后端 POST /conversations/:id/regenerate —— 事务删除目标 AI 消息及之后所有消息(保留之前历史)
 * 2. store.truncateMessagesFrom 同步截断前端消息列表(保留目标消息之前的内容,含前一条用户消息)
 * 3. 复用 sendMessage(regenerate 模式)重新发送前一条用户问题 —— 不重复添加/持久化用户消息,
 *    走既有流式链路(超时/节流/工具调用/错误重试全部复用,不重写)。
 */
export async function regenerateMessage(messageId: string): Promise<boolean> {
  const sendMessage = sendMessageInstance
  if (!sendMessage || !sendActionCtx) return false

  const store = useChatStore.getState()
  const conversationId = store.conversationId
  if (!conversationId || store.isStreaming) return false

  const messages = store.messages
  const targetIdx = messages.findIndex((m) => m.id === messageId)
  if (targetIdx === -1) return false
  const target = messages[targetIdx]
  if (!target || target.role !== 'assistant') return false

  // 找到目标 AI 消息之前最近的用户消息,作为重新发送的问题
  const userMsg = [...messages.slice(0, targetIdx)].reverse().find((m) => m.role === 'user')
  if (!userMsg || !userMsg.content.trim()) return false

  try {
    const res = await regenerateConversation(conversationId, messageId)
    if (!res.success) {
      toast.error('重新生成失败', {
        description: res.error || `服务异常(${res.status ?? '未知'})`,
      })
      return false
    }
  } catch (err) {
    toast.error('重新生成失败', {
      description: err instanceof Error ? err.message : String(err),
    })
    return false
  }

  // 后端已删除该消息及之后内容,同步截断前端消息列表(保留该消息之前的历史)
  useChatStore.getState().truncateMessagesFrom(messageId)
  // 复用 sendMessage(regenerate 模式):不重复添加用户消息,直接流式生成新回复
  return sendMessage(userMsg.content, { regenerate: true })
}

/**
 * 编辑重跑(2026-09-12 立,四竞品对标 P0-1,对标 Cursor/Trae 消息编辑)。
 * 由 MessageList 监听 `ihui:edit-message` 后调用,完整闭环:
 * 1. 调后端 POST /conversations/:id/edit-rerun —— 事务更新目标用户消息 content + 删除其后所有消息
 * 2. store.editMessageContent 同步更新前端该消息内容,truncateMessagesFrom(messageId) 删除其后的消息
 * 3. 复用 sendMessage(regenerate 模式)以新内容重新流式生成回复 —— 不重复添加/持久化用户消息,
 *    走既有流式链路(超时/节流/工具调用/错误重试全部复用,不重写)。
 * 注意:truncateMessagesFrom(目标用户消息 id) 会把该用户消息也从前端列表移除,
 * 但 regenerate 模式的 sendMessage 不重复 addMessage,而是把 content 直接作为历史末尾 ——
 * 因此这里先 editMessageContent 更新内容,再截断到该消息之后(保留编辑后的用户消息在 store 中)。
 *
 * 2026-09-14 W16 扩展(对标 Qoder 编辑消息可选回滚工作区文件):rollbackFiles=true 时,
 * 在编辑重跑前先把工作区(文件 + 对话历史)回滚到目标用户消息之前最近的 checkpoint:
 * 1. listCheckpoints 找 created_at <= 目标消息 createdAt 的最近 checkpoint
 * 2. restoreCheckpoint(checkpointId, conversationId, 'both') —— 服务端恢复对话历史 + 回滚文件版本
 * 3. getMessages 重新拉取服务端历史快照覆盖前端 store(checkpoint 时点可能早于目标消息前一条,
 *    不能只做本地截断,必须以服务端为准)
 * 4. 以新内容走普通 sendMessage(非 regenerate 模式)—— 用户消息作为全新消息追加到已回滚历史末尾
 * 无可用 checkpoint 时降级为不回滚文件的既有 edit-rerun 链路(toast 提示)。
 */
export async function editMessageAndRerun(
  messageId: string,
  newContent: string,
  rollbackFiles = false,
): Promise<boolean> {
  const sendMessage = sendMessageInstance
  if (!sendMessage || !sendActionCtx) return false

  const text = newContent.trim()
  if (!text) return false

  const store = useChatStore.getState()
  const conversationId = store.conversationId
  if (!conversationId || store.isStreaming) return false

  const messages = store.messages
  const targetIdx = messages.findIndex((m) => m.id === messageId)
  if (targetIdx === -1) return false
  const target = messages[targetIdx]
  if (!target || target.role !== 'user') return false
  // 内容未变化时无需重跑,直接关闭编辑态即可
  if (target.content === text) return true

  // W16(2026-09-14):编辑前可选回滚工作区到目标消息之前的最近 checkpoint
  if (rollbackFiles) {
    try {
      const list = await listCheckpoints(conversationId)
      const targetTime = target.createdAt ?? Number.MAX_SAFE_INTEGER
      const candidates = list.checkpoints.filter((c) => c.created_at <= targetTime)
      const cp = candidates.reduce<CheckpointMeta | undefined>(
        (best, c) => (!best || c.created_at >= best.created_at ? c : best),
        undefined,
      )
      if (cp) {
        await restoreCheckpoint(cp.checkpoint_id, conversationId, 'both')
        // 服务端历史已回滚到 checkpoint 时点(可能早于目标消息前一条),以服务端为准刷新前端
        const snap = await getMessages(conversationId, { direction: 'initial', pageSize: 100 })
        if (snap.success && snap.data) {
          useChatStore.setState({
            messages: snap.data.messages.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              createdAt: new Date(m.createdAt).getTime(),
              model: '',
              reasoning: m.reasoning,
            })),
            error: null,
          })
        } else {
          // 快照拉取失败时至少截断本地目标消息及其后,避免与已回滚的服务端历史错位
          useChatStore.getState().truncateMessagesFrom(messageId)
        }
        // 已回滚到 checkpoint,编辑后的内容作为全新用户消息追加并发送
        return sendMessage(text)
      }
      toast.warning('未找到可回滚的 checkpoint', {
        description: '将仅编辑消息内容,不回滚文件改动',
      })
    } catch (err) {
      toast.error('工作区回滚失败', {
        description: err instanceof Error ? err.message : String(err),
      })
      return false
    }
  }

  try {
    const res = await editAndRerunConversation(conversationId, messageId, text)
    if (!res.success) {
      toast.error('编辑重跑失败', {
        description: res.error || `服务异常(${res.status ?? '未知'})`,
      })
      return false
    }
  } catch (err) {
    toast.error('编辑重跑失败', {
      description: err instanceof Error ? err.message : String(err),
    })
    return false
  }

  // 后端已更新内容并删除其后消息,同步前端:先更新内容,再截断该消息之后的所有消息
  useChatStore.getState().editMessageContent(messageId, text)
  // 截断该用户消息之后的所有消息(该用户消息保留,regenerate 模式不重复添加用户消息)
  useChatStore.getState().truncateMessagesFromAfter(messageId)
  // 复用 sendMessage(regenerate 模式):以新内容重新流式生成回复,不重复添加用户消息
  return sendMessage(text, { regenerate: true })
}

/**
 * 分支/回退(2026-08-30 立)。
 * 由 MessageList 监听 `ihui:branch-message` 后调用:
 * 1. 调后端 POST /conversations/:id/branch —— 基于目标消息之前的内容创建新会话(旧会话原样保留)
 * 2. store 切换到新会话(ai-side-panel 的 loadHistory effect 自动加载新会话消息)
 * 3. 打开 AI 面板 + 刷新会话列表 + 更新 URL(?conversationId=)便于分享/书签
 */
export async function branchMessage(messageId: string): Promise<boolean> {
  const ctx = sendActionCtx
  if (!ctx) return false

  const store = useChatStore.getState()
  const conversationId = store.conversationId
  if (!conversationId || store.isStreaming) return false

  try {
    const res = await branchConversation(conversationId, messageId)
    if (!res.success) {
      toast.error('创建分支失败', {
        description: res.error || `服务异常(${res.status ?? '未知'})`,
      })
      return false
    }
    const newId = res.data.conversation.id
    // 切换到新分支会话(loadHistory effect 会加载新会话消息)
    store.setConversationId(newId)
    // 工作区按会话隔离(2026-09-04):分支会话继承源会话的工作区绑定
    const srcWs = useAiPanelStore.getState().conversationWorkspaces[conversationId] ?? null
    useAiPanelStore.getState().setActiveWorkspace(srcWs)
    // 打开面板(若当前折叠/关闭,让用户看到新分支会话)
    useAiPanelStore.getState().openPanel()
    // 刷新会话列表,让新分支出现在历史里
    ctx.queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] })
    // 更新 URL 便于分享/书签(?conversationId=)
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search)
      sp.set('conversationId', newId)
      ctx.router.replace(`/chat?${sp.toString()}`, { scroll: false })
    }
    toast.success('已创建分支会话')
    return true
  } catch (err) {
    toast.error('创建分支失败', {
      description: err instanceof Error ? err.message : String(err),
    })
    return false
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
