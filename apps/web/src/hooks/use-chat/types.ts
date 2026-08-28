import type * as React from 'react'
import type { useRouter } from 'next/navigation'
import type { useQueryClient } from '@tanstack/react-query'
import type { FallbackEvent } from '@ihui/api-client'
import type { useChatStore } from '@/stores/chat'
import type { InlineDiffInfo } from '@/components/ai/types'

/** 自媒体斜杠命令 API 返回数据 */
export interface SlashCommandData {
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
export interface SlashCommandResult {
  success: boolean
  error?: string
  data?: SlashCommandData
}

export interface UseChatReturn {
  messages: ReturnType<typeof useChatStore.getState>['messages']
  currentModel: string
  isStreaming: boolean
  error: string | null
  /** 当前挂起的 AI 提问;非 null 时弹窗阻塞输入 */
  pendingQuestion: ReturnType<typeof useChatStore.getState>['pendingQuestion']
  /** P4-2: fallback 通知(主模型失败切换到备用模型时非 null,UI 展示横幅) */
  fallbackNotice: FallbackEvent | null
  /** 发送消息(2026-07-24 立,返回 Promise<boolean>,true=已提交可清空输入框,false=未发送需保留输入内容) */
  sendMessage: (content: string) => Promise<boolean>
  /** 用户回答 AI 主动提问,触发 /chat/answer 续流 */
  sendAnswer: (answer: string) => Promise<void>
  /** 跳过当前挂起的提问(不续流,允许用户继续发新消息) */
  skipQuestion: () => void
  stop: () => void
  clearMessages: () => void
  setModel: (model: string) => void
  /** P4-2: 清除 fallback 通知(用户关闭横幅时调用) */
  clearFallbackNotice: () => void
  /** Accept:把 edit_file/write_file 的 diff 写入文件系统(2026-07-22 立,P3 Inline Diff) */
  applyDiff: (messageId: string, toolCallId: string, diffInfo: InlineDiffInfo) => Promise<void>
  /** Reject:纯前端标记为 rejected,无 API 调用 */
  rejectDiff: (messageId: string, toolCallId: string) => void
}

export interface ChatActionContext {
  t: (key: string, vars?: Record<string, string>) => string
  router: ReturnType<typeof useRouter>
  queryClient: ReturnType<typeof useQueryClient>
  setFallbackNotice: (e: FallbackEvent | null) => void
  abortRef: React.MutableRefObject<AbortController | null>
  lastSentContentRef: React.MutableRefObject<string>
  lastSentAnswerRef: React.MutableRefObject<{ answer: string; questionId: string } | null>
  sendInFlightRef: React.MutableRefObject<boolean>
  streamGenerationRef: React.MutableRefObject<number>
  streamConversationRef: React.MutableRefObject<string | null>
}
