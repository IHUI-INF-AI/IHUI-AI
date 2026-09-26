// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'
import type { FallbackEvent } from '@ihui/api-client'
import { useChatStore } from '@/stores/chat'
import { useApplyDiff } from '@/hooks/use-apply-diff'
import { fetchApi } from '@/lib/api'
import { createSendMessage } from './use-chat/send-message'
import { createSendAnswer } from './use-chat/send-answer'
import { clearCompactionPreview } from './use-chat/stream-handlers'
import { shouldTerminateForModelSwitch, terminateActiveStream } from './use-chat/model-switch'
import { toast } from '@/components/common'
import type { UseChatReturn, ChatActionContext } from './use-chat/types'

export type { UseChatReturn } from './use-chat/types'

export function useChat(): UseChatReturn {
  const messages = useChatStore((s) => s.messages)
  const currentModel = useChatStore((s) => s.currentModel)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const error = useChatStore((s) => s.error)
  // P4-2: fallback 通知状态(主模型失败切换到备用模型时设置,UI 展示横幅)
  const [fallbackNotice, setFallbackNotice] = React.useState<FallbackEvent | null>(null)

  const router = useRouter()
  const queryClient = useQueryClient()
  // ChatMode 斜杠命令 toast i18n(2026-07-28 立,模块级函数无法调 hook,由此处传入 t)
  const t = useTranslations('chat')
  const abortRef = React.useRef<AbortController | null>(null)
  // P1 错误重试(2026-07-23):保存最后发送内容,toast 加 retry 按钮
  const lastSentContentRef = React.useRef('')
  // #10 sendAnswer 错误重试(2026-07-25 立):保存最后回答内容,toast 加 retry 按钮
  // 与 lastSentContentRef 对称,sendAnswer catch 块复用 sendMessage 路径的 retry 模式
  const lastSentAnswerRef = React.useRef<{ answer: string; questionId: string } | null>(null)
  // 2026-08-06 修复:聊天发送在途锁。原防重仅靠 store.isStreaming,但 sendMessage
  // 在 createConversation 网络往返完成后才 setStreaming(true),期间用户快速连按
  // Enter/双击发送可重复建会话/发消息。此 ref 在函数入口即置位,覆盖所有 await 间隙。
  const sendInFlightRef = React.useRef(false)

  const conversationId = useChatStore((s) => s.conversationId)
  // 2026-08-21 修复(C3):流代际计数。每次新流开始 ++;旧流 finally 据此判断
  // 自己是否仍是最新流,避免被 abort 的旧流把新流/新会话的 isStreaming 错误置 false。
  const streamGenerationRef = React.useRef(0)
  // 2026-08-21 修复(C3):当前活跃流绑定的会话 id,用于切换会话时识别并 abort 旧流
  const streamConversationRef = React.useRef<string | null>(null)
  React.useEffect(() => {
    // 2026-08-21 修复(C5):仅在"离开流绑定的会话"时清空重试上下文。
    // 原缺陷:sendMessage 新建会话也会触发 conversationId 变化(null → newId),
    // 无条件清空会把刚存入的 lastSentContentRef 抹掉,导致新会话里流失败后
    // retry 按钮调 sendMessage('') 静默 return,重试永远无效。
    // 判定:活跃流绑定会话 === 新会话 id(sendMessage 刚创建)→ 保留;否则清空。
    const streamConv = streamConversationRef.current
    const leftStreamConversation = !abortRef.current || streamConv !== conversationId
    if (leftStreamConversation) {
      lastSentContentRef.current = ''
      lastSentAnswerRef.current = null
    }
    // 2026-08-21 修复(C3):切换会话时终止旧会话进行中的流。
    // 原缺陷:旧流不终止 → ① 全局 isStreaming 锁死新会话输入(重连时最长数分钟)
    // ② 旧流 token 持续消耗计费但无处显示 ③ 旧流 onAgentDelta 持续写入全局
    // subAgentActivities,污染新会话的 SubAgent 面板。
    // abort 后走 catch 的 AbortError 静默分支(非超时 abort 不报错),finally 由
    // 代际守卫跳过全局状态清理,不影响新会话。
    if (abortRef.current && streamConv !== conversationId) {
      // 2026-09-21 修复:旧流被 abort 后其 finally 会被代际守卫跳过,全局"压缩中"预告态
      // 必须在这里回收,否则灰条跟着用户留在新会话界面里。
      clearCompactionPreview()
      abortRef.current.abort()
    }
  }, [conversationId])

  const ctx: ChatActionContext = {
    t,
    router,
    queryClient,
    setFallbackNotice,
    abortRef,
    lastSentContentRef,
    lastSentAnswerRef,
    sendInFlightRef,
    streamGenerationRef,
    streamConversationRef,
  }

  const sendMessage = React.useCallback(createSendMessage(ctx), [router, queryClient, t])
  const sendAnswer = React.useCallback(createSendAnswer(ctx), [t])

  // V3 #68(2026-09-27 立):终止在途流的**唯一**出口,由「停止」按钮与「流式中切换模型」共用。
  // 动作与原 stop() 逐条等值(标记中断 → 通知网关 → abort → 回收压缩预告),
  // 差别只在 notice:用户自己点停止不需要额外解释,被动终止(换模型)必须让他看见理由。
  const terminateStream = React.useCallback(
    (notice?: string): boolean =>
      terminateActiveStream({
        abortRef,
        conversationId: useChatStore.getState().conversationId,
        findInterruptedAssistantId: () => {
          const st = useChatStore.getState()
          return (
            st.messages.find((m) => m.role === 'assistant' && m.streamCompleted === false)?.id ??
            null
          )
        },
        setInterruptedMessage: (id) => useChatStore.getState().setInterruptedMessage(id),
        // 2026-09-18 立:停止动作的服务端闭环 —— 本地 abort 只断开 SSE 连接,网关侧上游
        // fetch 原要等 15s 宽限期超时才中止,期间 ai-service 的工具子进程/浏览器操作仍
        // 继续执行(浪费额度 + 留下脏状态)。这里同步通知网关中止该会话的上游流。
        // fire-and-forget:失败静默降级,绝不阻塞本地停止(体验优先)。
        notifyServerAbort: (payload) => {
          void fetchApi('/api/ai/chat/abort', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }).catch(() => {})
        },
        clearCompactionPreview,
        notice,
        showNotice: (message) => toast.info(message),
      }),
    [],
  )

  const stop = React.useCallback(() => {
    // #21 中断后追加指令继续(2026-09-13 立):abort 前记录被中断的 assistant 消息,
    // 输入框上方据此显示「追加指令继续」提示条。
    terminateStream()
  }, [terminateStream])

  // V3 #68:流式中切换模型 → 终止当前这一轮,并让下一轮自动用新模型(用户不必重发/重开对话)。
  // 与"切换会话"effect 同一条设计:abort 后走 catch 的 AbortError 静默分支,
  // 该流自己的 finally 仍是最新代际 ⇒ isStreaming 正常置回 false,界面不会看着像卡住。
  const previousModelRef = React.useRef(currentModel)
  React.useEffect(() => {
    const previousModel = previousModelRef.current
    previousModelRef.current = currentModel
    if (
      !shouldTerminateForModelSwitch({
        previousModel,
        currentModel,
        hasLiveStream: Boolean(abortRef.current),
      })
    ) {
      return
    }
    // 无在途流 = 纯换档,静默生效,不打扰(下面 terminateStream 也会兜同样的判据)。
    terminateStream(t('modelSwitchStopped', { model: currentModel }))
  }, [currentModel, terminateStream, t])

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
  // P4-2: 清除 fallback 通知(用户关闭横幅时调用)
  const clearFallbackNotice = React.useCallback(() => setFallbackNotice(null), [])

  // P3 Inline Diff Apply 工作流:Accept 调 API 写入文件,Reject 纯前端标记
  // #14 批量:applyAllDiffs/rejectAllDiffs 面向消息内全部待决 diff 卡(2026-09-13 立)
  const { applyDiff, rejectDiff, applyAllDiffs, rejectAllDiffs, applyDiffSelection } =
    useApplyDiff()

  return {
    messages,
    currentModel,
    isStreaming,
    error,
    pendingQuestion,
    fallbackNotice,
    sendMessage,
    sendAnswer,
    skipQuestion,
    stop,
    clearMessages,
    setModel,
    clearFallbackNotice,
    applyDiff,
    rejectDiff,
    applyAllDiffs,
    rejectAllDiffs,
    applyDiffSelection,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
