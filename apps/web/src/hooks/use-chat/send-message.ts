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
  createConversation,
  type ToolDelegateEvent,
} from '@ihui/api-client'
import { openLoginDialogOnce } from '@/lib/login-dialog-trigger'
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
import {
  tryHandlePlanModeSlash,
  tryHandleChatModeSlash,
  tryHandlePermissionSlash,
  tryAutoDetectMode,
  tryHandleSelfMediaSlash,
} from './slash-commands'
import { persistMessageSafe, persistQuestionSafe } from './persistence'
import type { PlanStep, TerminalTask } from '@ihui/types/ai'
import type { ChatActionContext } from './types'

export function createSendMessage(ctx: ChatActionContext): (content: string) => Promise<boolean> {
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
  const sendMessage = async (content: string): Promise<boolean> => {
    const text = content.trim()
    if (!text) return false
    // 2026-08-06 修复:入口即置在途锁,覆盖 createConversation/斜杠命令等
    // await 间隙,防止快速连按 Enter/双击重复发送(原仅靠 isStreaming 防重,
    // 但 setStreaming(true) 在网络往返之后才执行,存在竞态窗口)。
    if (sendInFlightRef.current) return false

    const store = useChatStore.getState()
    if (store.isStreaming) return false

    sendInFlightRef.current = true
    // 所有提前 return 前必须解锁(见下方各处 sendInFlightRef.current = false)
    lastSentContentRef.current = text

    // /plan & /act 动作型斜杠命令拦截(2026-07-25 立,对标 Trae SOLO Plan 模式):
    // - 纯 UI 模式切换,不需要登录,不调用 LLM,不创建会话
    // - 命中即清空输入框 + toast 反馈
    if (tryHandlePlanModeSlash(text, t)) {
      sendInFlightRef.current = false
      return true
    }

    // /build /review /spec 动作型斜杠命令拦截(2026-07-28 立,补全 ChatMode 4态三通道):
    // - 纯 ChatMode 切换,不需要登录,不调用 LLM,不创建会话
    // - 命中即清空输入框 + toast 反馈(返回 true 与 tryHandlePlanModeSlash 一致)
    if (tryHandleChatModeSlash(text, t)) {
      sendInFlightRef.current = false
      return true
    }

    // /permission ask|auto|full 动作型斜杠命令拦截(2026-07-25 深化,对标 Codex approvalMode):
    // - 纯 UI 模式切换,不需要登录,不调用 LLM,不创建会话
    // - 命中即清空输入框 + toast 反馈(切 full 时弹 5s 撤销 toast)
    if (await tryHandlePermissionSlash(text, t)) {
      sendInFlightRef.current = false
      return true
    }

    // AI 自动判断 ChatMode(2026-07-28 立,移除 4 按钮后由 AI 决定用哪种模式):
    // - 时机:所有 /命令拦截后、createConversation 前(用户敲完按发送才触发)
    // - 静默切换,无 toast(自动判断是辅助能力,反复提示会刷屏)
    // - 当前模式徽章(CurrentModeBadge)实时反映新模式,提供视觉反馈
    // - 显式 /命令优先级最高(已在上方拦截,这里只处理普通对话)
    tryAutoDetectMode(text)

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
    const slashHit = await tryHandleSelfMediaSlash(text, (assistantContent) => {
      const m = store.currentModel
      const slashMode = useAiPanelStore.getState().activeWorkspace?.mode
      store.addMessage({ role: 'user', content: text, model: m })
      store.addMessage({
        role: 'assistant',
        content: assistantContent,
        model: m,
        permissionMode: slashMode,
      })
    })
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
    // 记录该消息生成时的工作区权限模式(2026-07-25 深化,深度对标 Codex 透明性)
    // 模式用于消息气泡的徽章展示,让用户事后能识别"这条回答是基于哪种权限模式生成的"
    const currentMode = useAiPanelStore.getState().activeWorkspace?.mode
    const assistantId = store.addMessage({
      role: 'assistant',
      content: '',
      model,
      permissionMode: currentMode,
    })

    store.setStreaming(true)
    store.setError(null)
    store.resetSubAgentActivities()
    // P4-2: 清除上一轮 fallback 通知,避免旧横幅残留到新对话轮次
    setFallbackNotice(null)

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

    // #9 流式 token 节流(2026-07-25 立):
    // 用 requestAnimationFrame 每帧合并一次 token,避免每个 token 触发 store 更新 + React 重渲染
    const contentBatcher = createDeltaBatcher((d) =>
      useChatStore.getState().appendToMessage(assistantId, d),
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
    const effectiveModel = model
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
      // 显示压缩中状态(发送消息后、流式响应前,给用户即时反馈)
      useChatStore.getState().setCompactionStatus({ phase: 'compacting' })

      // 2026-08-16 立:强制传 contextLimit,后端根据该值判断是否触发 88% 自动压缩。
      const resolvedContextLimit = getModelContextCapacity(effectiveModel)
      logger.debug(
        '[Compaction] sendMessage contextLimit=',
        resolvedContextLimit,
        'model=',
        effectiveModel,
      )

      await streamChat({
        model: effectiveModel,
        messages: [...history, { role: 'user', content: text }],
        signal: controller.signal,
        metadata: {
          conversationId,
          userId,
          messageId: assistantId,
        },
        // 模式透传(2026-07-22 立,对标 Trae Plan/Spec):build/plan/review/spec
        // Plan/Act 模式(2026-07-24 立):plan=只制定计划不执行工具,act=正常执行
        extraBody: {
          // ChatMode 4 态唯一模式字段(2026-07-28 移除独立 PlanActToggle 后,plan_mode 字段已废弃,语义合并到 mode)
          mode: useModeStore.getState().currentMode,
        },
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
          const status = useChatStore.getState().compactionStatus
          if (status?.phase === 'compacting') {
            useChatStore.getState().setCompactionStatus(null)
          }
        },
        onUsage: (usage) => {
          // P1 token 用量写入消息 meta(2026-08-15 立):后端 SSE 流末尾发送 usage chunk,
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
        // Subagent 自动派发(2026-07-28 立,对标 Trae Work):
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
        agentTools: mergeAgentTools(),
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
          // 前端错误码透出(P1,2026-07-22 立):toast description 前缀 [errorCode],
          // 让用户直接定位问题(MODEL_NOT_CONFIGURED/PROVIDER_NOT_IMPLEMENTED/LLM_ERROR 等)
          const ec = info?.errorCode
          const toastDesc =
            formatted.severity === 'auth'
              ? formatted.message
              : ec
                ? `[${ec}] ${formatted.rawMessage}`
                : formatted.rawMessage
          if (formatted.severity === 'ratelimit') {
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
        useChatStore.getState().setStreaming(false)
        useChatStore.getState().markAllAgentStreamsDone()
      }
      // 2026-08-06 修复:发送完成(成功/异常)释放 in-flight 锁,允许下一次发送
      sendInFlightRef.current = false
    }
    // 消息已提交到 store(即使流式出错也有 error 标记 + retry 按钮),可清空输入框
    return true
  }
  return sendMessage
}
