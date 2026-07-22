'use client'

import * as React from 'react'
import { toast } from 'sonner'

import { useChatStore } from '@/stores/chat'
import { useAiPanelStore } from '@/stores/ai-panel'
import { fetchApi } from '@/lib/api'
import type { InlineDiffInfo } from '@/components/ai/types'

/**
 * Apply Diff 工作流 hook(2026-07-22 立,P3 Inline Diff 卡片)。
 *
 * 职责:
 *  - 调 POST /api/v1/ai/apply-diff 把 newContent 写入文件系统
 *  - 通过 chat store 的 setToolCallApplyStatus 同步 UI 状态
 *  - 暴露 applyDiff(messageId, toolCallId, diffInfo) 给 InlineDiffCard 的 Accept 按钮
 *
 * 设计:
 *  - Reject 不走 API(纯前端标记),仅 applyDiff 走 API
 *  - workspacePath 从 useAiPanelStore.activeWorkspace.path 取,缺失时 toast 提示
 *  - 失败时 applyStatus 置 'error' + applyError 填充,UI 显示重试
 */

interface ApplyDiffResponseBody {
  applied: boolean
  path: string
}

/** 调 /api/v1/ai/apply-diff 把 newContent 写入文件系统 */
async function callApplyDiffApi(payload: {
  path: string
  oldContent: string
  newContent: string
  workspacePath?: string
}): Promise<{ ok: boolean; error?: string }> {
  const r = await fetchApi<ApplyDiffResponseBody>('/api/v1/ai/apply-diff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!r.success) return { ok: false, error: r.error }
  if (!r.data?.applied) return { ok: false, error: '服务端未应用改动' }
  return { ok: true }
}

export interface UseApplyDiffReturn {
  /** Accept:调 API 写入文件,更新 applyStatus */
  applyDiff: (messageId: string, toolCallId: string, diffInfo: InlineDiffInfo) => Promise<void>
  /** Reject:纯前端标记为 rejected,无 API 调用 */
  rejectDiff: (messageId: string, toolCallId: string) => void
}

export function useApplyDiff(): UseApplyDiffReturn {
  const applyDiff = React.useCallback(
    async (messageId: string, toolCallId: string, diffInfo: InlineDiffInfo) => {
      const store = useChatStore.getState()
      // 防止重复点击(已应用/已拒绝/应用中 不再触发)
      const tc = store.messages
        .find((m) => m.id === messageId)
        ?.toolCalls?.find((t) => t.id === toolCallId)
      if (!tc) return
      if (tc.applyStatus === 'applied' || tc.applyStatus === 'applying') return

      const workspacePath = useAiPanelStore.getState().activeWorkspace?.path
      if (!workspacePath) {
        toast.error('未绑定工作区', {
          description: '请先在 AI 面板选择本地工作区,Apply 才能写入文件',
        })
        store.setToolCallApplyStatus(messageId, toolCallId, 'error', '未绑定工作区')
        return
      }

      store.setToolCallApplyStatus(messageId, toolCallId, 'applying')

      try {
        const result = await callApplyDiffApi({
          path: diffInfo.file_path,
          oldContent: diffInfo.old_content,
          newContent: diffInfo.new_content,
          workspacePath,
        })
        if (result.ok) {
          store.setToolCallApplyStatus(messageId, toolCallId, 'applied')
          toast.success('改动已应用', {
            description: diffInfo.file_path,
          })
        } else {
          store.setToolCallApplyStatus(messageId, toolCallId, 'error', result.error)
          toast.error('应用失败', { description: result.error })
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        store.setToolCallApplyStatus(messageId, toolCallId, 'error', msg)
        toast.error('应用失败', { description: msg })
      }
    },
    [],
  )

  const rejectDiff = React.useCallback((messageId: string, toolCallId: string) => {
    useChatStore.getState().setToolCallApplyStatus(messageId, toolCallId, 'rejected')
  }, [])

  return { applyDiff, rejectDiff }
}

export default useApplyDiff
