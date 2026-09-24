// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { CornerDownLeft, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useChatStore } from '@/stores/chat'

interface DiffCommentPanelProps {
  /** 被评论文件路径(与 diffInfo.file_path 一致) */
  filePath: string
  /** 目标行号(行级评论);undefined = 文件级评论 */
  line?: number
  /** 被评论行原文(截断后随评论注入,给 agent 定位上下文) */
  lineText?: string
  /** 来源工具调用 id */
  toolCallId?: string
  /** 提交成功回调(父组件用于收起输入态) */
  onSubmitted?: () => void
}

/**
 * DiffCommentPanel — diff 评审意见输入 + 本文件待发送意见列表(P3 #30,2026-09-16 立)。
 *
 * 交互约定(对标 Codex diff 评论):
 *  - Enter 提交 / Shift+Enter 换行(textarea 原生行为基础上补键盘拦截)
 *  - 空文本不可提交(提交按钮禁用)
 *  - 提交后清空输入框并回调 onSubmitted(父组件据此收起面板)
 *  - 下方列出本文件已暂存的意见,可逐条删除;意见在下一轮发送时统一注入 agent
 *
 * 性能注意:`pendingDiffComments` 订阅**整体数组引用**(仅 add/remove 时变更),
 * 过滤在本组件内用 useMemo 完成 —— 禁止在 selector 里直接 filter,
 * 那会每次返回新数组引用,zustand 判等失败导致无限重渲染。
 */
export function DiffCommentPanel({
  filePath,
  line,
  lineText,
  toolCallId,
  onSubmitted,
}: DiffCommentPanelProps) {
  const t = useTranslations('ai.pane')
  const [text, setText] = React.useState('')
  const addDiffComment = useChatStore((s) => s.addDiffComment)
  const removeDiffComment = useChatStore((s) => s.removeDiffComment)
  // 订阅整体数组(引用稳定),过滤在 useMemo 内完成
  const allComments = useChatStore((s) => s.pendingDiffComments)
  const fileComments = React.useMemo(
    () => allComments.filter((c) => c.filePath === filePath),
    [allComments, filePath],
  )

  const trimmed = text.trim()
  const canSubmit = trimmed.length > 0

  const handleSubmit = (): void => {
    if (!canSubmit) return
    addDiffComment({ filePath, line, lineText, comment: trimmed, toolCallId })
    setText('')
    onSubmitted?.()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    // Enter 提交,Shift+Enter 换行(与聊天输入框一致的手感)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="space-y-1.5" data-testid="diff-comment-panel">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          typeof line === 'number'
            ? t('diffComment.placeholderLine', { line })
            : t('diffComment.placeholderFile')
        }
        rows={2}
        className="w-full resize-none rounded-sm border border-border/60 bg-background px-2 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
        data-testid="diff-comment-input"
      />
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="inline-flex items-center gap-1 rounded-sm bg-cta px-2 py-1 text-[10px] font-medium text-cta-foreground transition-colors hover:bg-cta/90 disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="diff-comment-submit"
        >
          <CornerDownLeft className="h-2.5 w-2.5" />
          <span>{t('diffComment.submit')}</span>
        </button>
        <span className="text-[10px] text-muted-foreground/60">{t('diffComment.hint')}</span>
      </div>

      {fileComments.length > 0 && (
        <ul className="space-y-0.5 pt-0.5" data-testid="diff-comment-list">
          {fileComments.map((c) => (
            <li
              key={c.id}
              className="group flex items-start gap-1.5 rounded-sm bg-muted/40 px-1.5 py-1 text-[10px] text-muted-foreground"
              data-testid={`diff-comment-item-${c.id}`}
            >
              <span className="shrink-0 tabular-nums text-muted-foreground/70">
                {typeof c.line === 'number'
                  ? t('diffComment.lineLabel', { line: c.line })
                  : t('diffComment.fileLevel')}
              </span>
              <span className="min-w-0 flex-1 break-words text-foreground/80">{c.comment}</span>
              <button
                type="button"
                onClick={() => removeDiffComment(c.id)}
                aria-label={t('diffComment.remove')}
                className="shrink-0 rounded-sm p-0.5 text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
                data-testid={`diff-comment-remove-${c.id}`}
              >
                <Trash2 className="h-2.5 w-2.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default DiffCommentPanel
