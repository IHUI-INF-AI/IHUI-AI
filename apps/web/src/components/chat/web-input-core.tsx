'use client'

import * as React from 'react'
import { BrushCleaning } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useTextareaAutoHeight } from '@/hooks/use-textarea-auto-height'

export const MAX_LENGTH = 10000
const MAX_HEIGHT_PX = 320 // 最大约 16 行,超出后滚动
const MIN_HEIGHT_PX = 96 // rows=3 基础高度,与 hook threeLinePx 阈值一致

/** WebInputCore 句柄 — 与原 textareaRef 等价(主组件通过 inputCoreRef.current 访问) */
export interface WebInputCoreHandle {
  focus: () => void
  setSelectionRange: (start: number, end: number) => void
  resize: () => void
}

/** WebInputCore props(契约对齐 packages/types MessageInputProps 核心字段)
 * 共享层 `<MessageInput>`(rn/taro)用相同 props 名,本组件是 web 端实现(react-native-web 未配置,
 * 不能直接 import @ihui/app;详细论证见 2026-07-29 方案 A)。
 * 职责:渲染 textarea + 字符计数 + 清除按钮 + 发送/停止按钮
 * 不包含:slash 触发按钮、@ 文件提及、模型选择、语音输入(由主组件工具栏承担) */
export interface WebInputCoreProps {
  text: string
  placeholder: string
  isStreaming: boolean
  onTextChange: (v: string) => void
  onSend: () => void
  onStop: () => void
  onClear: () => void
  /** 错误提示(可选,空字符串/null/undefined 时不渲染) */
  error?: string
  /** 翻译函数(主组件已 useTranslations('chat'),传入 t 即可) */
  t: (key: string) => string
  /** 原生 change 事件(用于触发 slash/mention 面板) */
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  /** 原生 keydown 事件(用于 Shift+Tab 切换权限模式) */
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  /** 原生 paste 事件(用于图片粘贴) */
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void
  /** 发送按钮 tooltip(主组件传入对齐 aria-label) */
  sendLabel?: string
  /** 停止按钮 tooltip */
  stopLabel?: string
}

/** Web 端 MessageInput 实现(forwardRef,契约对齐 SharedMessageInputProps)
 * 渲染 textarea + 字符计数(2026-07-29 简化,清除/发送/停止按钮已挪到外层 toolbar)。
 * 内部托管 textarea ref + 自动高度,主组件通过 forwarded ref 调用 focus/setSelectionRange/resize。 */
export const WebInputCore = React.forwardRef<WebInputCoreHandle, WebInputCoreProps>(function WebInputCore(
  {
    text,
    placeholder,
    onTextChange,
    onSend,
    onClear,
    error,
    onChange,
    onKeyDown,
    onPaste,
    isStreaming,
    // 2026-07-29 简化:sendLabel/stopLabel 在 web 端不再使用(发送/停止按钮已挪到外层 toolbar),
    // 保留在 props 契约里是为了和 packages/types SharedMessageInputProps 对齐(rn/taro 端仍用)。
    t: _t,
    sendLabel: _sendLabel,
    stopLabel: _stopLabel,
  },
  ref,
) {
  const innerRef = React.useRef<HTMLTextAreaElement>(null)
  const { resize } = useTextareaAutoHeight<HTMLTextAreaElement>(text, {
    threeLinePx: MIN_HEIGHT_PX,
    maxHeightPx: MAX_HEIGHT_PX,
  })
  React.useImperativeHandle(
    ref,
    (): WebInputCoreHandle => ({
      focus: () => innerRef.current?.focus(),
      setSelectionRange: (s, e) => innerRef.current?.setSelectionRange(s, e),
      resize,
    }),
    [resize],
  )
  // 清除按钮(2026-07-30 用户规则:挪回 textarea 右上角,用 BrushCleaning 清洁刷图标,
  // 仅 hover textarea 容器时悬浮显示,避免占用 toolbar 槽位)
  return (
    <div className="group relative px-3 pt-2 pb-2">
      <textarea
        ref={innerRef}
        value={text}
        onChange={(e) => {
          const v = e.target.value.slice(0, MAX_LENGTH)
          onTextChange(v)
          onChange?.(e)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            onSend()
          } else {
            onKeyDown?.(e)
          }
        }}
        onPaste={onPaste}
        placeholder={placeholder}
        rows={3}
        aria-label={placeholder}
        style={{ maxHeight: MAX_HEIGHT_PX, minHeight: MIN_HEIGHT_PX }}
        className={cn(
          'thin-scroll block w-full resize-none bg-transparent text-sm leading-snug outline-none',
          'placeholder:text-muted-foreground/70',
          'pb-6',
        )}
      />
      {/* 清除按钮:仅 hover textarea 容器时显示,有内容时渲染,
          流式时禁用(不与 Stop 按钮冲突,流式时清空草稿语义模糊)。
          位置:textarea 右上角 absolute(2026-07-30 二次调整:再往上 4px 至 top-1,
          让按钮更贴近 textarea 顶边,视觉上像"挂在输入框角落")。
          不挡字符计数(字符计数在 bottom-2)。 */}
      {text.length > 0 && (
        <button
          type="button"
          aria-label="清除输入"
          title="清除输入"
          onClick={onClear}
          disabled={isStreaming}
          className={cn(
            'absolute right-2 top-1 inline-flex h-6 w-6 items-center justify-center rounded-md',
            'text-muted-foreground transition-opacity',
            'opacity-0 hover:bg-accent hover:text-accent-foreground',
            'group-hover:opacity-100 focus-visible:opacity-100',
            'disabled:pointer-events-none',
          )}
        >
          <BrushCleaning className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
      <div className="pointer-events-none absolute inset-x-3 bottom-2 flex items-center">
        <span
          aria-live="polite"
          className={cn(
            'text-[10px] tabular-nums text-muted-foreground/60',
            text.length >= MAX_LENGTH && 'text-destructive',
          )}
        >
          {text.length}/{MAX_LENGTH}
        </span>
      </div>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  )
})
