// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { MessageSquareText, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useChatStore } from '@/stores/chat'

/**
 * DiffCommentsBar — 待发送代码改动意见提示条(P3 #30,2026-09-16 立)。
 *
 * 位置:AI 对话框底部、输入框上方(与 CompactionStatusBar 同级)。
 *
 * 存在意义:diff 评审意见是「跨消息暂存」的隐藏状态 —— 用户在某个 diff 卡片上评论后,
 * 若卡片滚出视野就无从感知意见是否还在队列里。本提示条常驻显示队列规模并提供
 * 一键清空入口,确保「评论 → 下一条消息带给 AI」这一链路对用户可见、可控。
 */
export function DiffCommentsBar() {
  const t = useTranslations('ai.pane')
  // 订阅整体数组引用(仅 add/remove 时变更),计数在组件内派生
  const comments = useChatStore((s) => s.pendingDiffComments)
  const clearDiffComments = useChatStore((s) => s.clearDiffComments)
  if (comments.length === 0) return null

  return (
    <div className="mx-4 mb-2" data-testid="diff-comments-bar">
      <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
        <MessageSquareText className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">
          {t('diffComment.pendingBanner', { count: comments.length })}
        </span>
        <button
          type="button"
          onClick={clearDiffComments}
          aria-label={t('diffComment.remove')}
          className="shrink-0 rounded-sm p-0.5 transition-colors hover:bg-amber-500/15"
          data-testid="diff-comments-bar-clear"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

export default DiffCommentsBar
