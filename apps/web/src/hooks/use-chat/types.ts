// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
  /** #14 批量 Accept(2026-09-13 立):消息内全部待决 diff 卡逐文件顺序应用,失败不回滚已成功项 */
  applyAllDiffs: (messageId: string) => Promise<void>
  /** #14 批量 Reject(2026-09-13 立):消息内全部待决 diff 卡整体标记 rejected,纯前端 */
  rejectAllDiffs: (messageId: string) => void
  /**
   * W5 hunk 级部分应用(2026-09-18 立):`newContent` 由 `buildPartialContent` 以原文为基线
   * 重组(只含已接受 hunk)。全拒绝(与原文逐字节一致)时短路为纯前端 rejected,不写盘。
   */
  applyDiffSelection: (
    messageId: string,
    toolCallId: string,
    diffInfo: InlineDiffInfo,
    newContent: string,
  ) => Promise<void>
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
