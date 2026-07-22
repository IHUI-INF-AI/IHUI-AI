'use client'

import * as React from 'react'
import { Check, X, Loader2, Sparkles, AlertCircle } from 'lucide-react'
import { useInlineEditStore } from '@/stores/inline-edit'
import { useInlineEdit } from '@/hooks/use-inline-edit'

/**
 * Inline Edit 对话框(Cmd+K 触发)。
 *
 * UX 对标 VSCode Cmd+K:浮在编辑器顶部居中,输入修改指令 → AI 流式生成 → Accept/Reject。
 *
 * 视觉约束(AGENTS.md §4):
 * - compact 紧凑、elegant 优雅
 * - 禁止 rounded-full / divide-y / hr / 蓝色发光边框
 * - 中文字体垂直对齐自动应用(globals.css 全局规则,:where(button,a,...) > span 自动 translateY)
 */

const PREVIEW_MAX_CHARS = 200

export function InlineEditDialog() {
  const isOpen = useInlineEditStore((s) => s.isOpen)
  const selection = useInlineEditStore((s) => s.selection)
  const status = useInlineEditStore((s) => s.status)
  const instruction = useInlineEditStore((s) => s.instruction)
  const generatedPatch = useInlineEditStore((s) => s.generatedPatch)
  const error = useInlineEditStore((s) => s.error)
  const setInstruction = useInlineEditStore((s) => s.setInstruction)

  const { startEdit, acceptPatch, rejectPatch, closeInlineEdit } = useInlineEdit()
  const inputRef = React.useRef<HTMLInputElement>(null)

  // 打开时自动聚焦输入框
  React.useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 30)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  // ESC 关闭(Enter 提交,Cmd+Enter 兜底)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      closeInlineEdit()
      return
    }
    const isSubmit = e.key === 'Enter' && (e.metaKey || e.ctrlKey || !e.shiftKey)
    if (isSubmit && status !== 'loading' && instruction.trim()) {
      e.preventDefault()
      void startEdit(instruction)
    }
  }

  if (!isOpen || !selection) return null

  const preview =
    selection.selectedText.length > PREVIEW_MAX_CHARS
      ? selection.selectedText.slice(0, PREVIEW_MAX_CHARS) + '…'
      : selection.selectedText

  const isStreaming = status === 'loading'
  const isDone = status === 'done' && generatedPatch.length > 0
  const isError = status === 'error'

  return (
    <div
      aria-label="Inline Edit"
      className="absolute left-1/2 top-2 z-30 flex max-w-[640px] -translate-x-1/2 flex-col gap-2 rounded-md border border-border bg-card p-2 shadow-md"
    >
      {/* 顶部输入栏 */}
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="描述你想要的修改…"
          disabled={isStreaming}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 disabled:opacity-60"
        />
        {isStreaming ? (
          <button
            onClick={() => {
              closeInlineEdit()
            }}
            className="rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="停止生成"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          </button>
        ) : (
          <button
            onClick={() => closeInlineEdit()}
            className="rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="关闭"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* 选中代码预览(单行截断) */}
      {!isDone && !isError && (
        <div className="flex items-center gap-1.5 rounded-sm bg-muted/40 px-2 py-1">
          <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground/70">
            {selection.language}
          </span>
          <code className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
            {preview || '(空选区)'}
          </code>
        </div>
      )}

      {/* 流式生成的 patch 预览(可滚动,最多 4 行高) */}
      {(isStreaming || isDone) && generatedPatch && (
        <pre className="max-h-28 overflow-auto rounded-sm bg-muted/30 p-2 font-mono text-xs text-foreground">
          {generatedPatch}
        </pre>
      )}

      {/* 错误态 */}
      {isError && (
        <div className="flex items-center gap-1.5 rounded-sm bg-destructive/10 px-2 py-1 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{error || '生成失败'}</span>
        </div>
      )}

      {/* 底部操作栏:仅 done 态显示 Accept/Reject */}
      {isDone && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-muted-foreground/70">Enter 提交 · Esc 取消</span>
          <div className="flex items-center gap-1">
            <button
              onClick={rejectPatch}
              className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3 w-3" />
              <span>拒绝</span>
            </button>
            <button
              onClick={acceptPatch}
              className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90"
            >
              <Check className="h-3 w-3" />
              <span>接受</span>
            </button>
          </div>
        </div>
      )}

      {/* 空闲态:键盘提示 */}
      {!isStreaming && !isDone && !isError && (
        <div className="text-[10px] text-muted-foreground/70">
          <kbd className="rounded-sm border border-border bg-background px-1">Enter</kbd>
          <span> 提交 · </span>
          <kbd className="rounded-sm border border-border bg-background px-1">Esc</kbd>
          <span> 取消</span>
        </div>
      )}
    </div>
  )
}
