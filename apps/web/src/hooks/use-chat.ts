'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'
import type { FallbackEvent } from '@ihui/api-client'
import { useChatStore } from '@/stores/chat'
import { useApplyDiff } from '@/hooks/use-apply-diff'
import { createSendMessage } from './use-chat/send-message'
import { createSendAnswer } from './use-chat/send-answer'
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

  const stop = React.useCallback(() => {
    abortRef.current?.abort()
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
  // P4-2: 清除 fallback 通知(用户关闭横幅时调用)
  const clearFallbackNotice = React.useCallback(() => setFallbackNotice(null), [])

  // P3 Inline Diff Apply 工作流:Accept 调 API 写入文件,Reject 纯前端标记
  const { applyDiff, rejectDiff } = useApplyDiff()

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
  }
}
