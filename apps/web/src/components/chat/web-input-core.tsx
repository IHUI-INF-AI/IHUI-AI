'use client'

import * as React from 'react'

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
    error,
    onChange,
    onKeyDown,
    onPaste,
    // 2026-07-29 简化:以下 props 在 web 端不再使用(发送/停止/清除按钮已挪到外层 toolbar),
    // 保留在 props 契约里是为了和 packages/types SharedMessageInputProps 对齐(rn/taro 端仍用)。
    isStreaming: _isStreaming,
    onStop: _onStop,
    onClear: _onClear,
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
  // 发送/停止/清除按钮已挪到外层 MessageInput 底部 toolbar 与其他动作按钮同行(2026-07-29 用户规则),
  // 本组件只负责 textarea + 字符计数;onSend/onStop/onClear 仍由 props 透传供 Enter 触发等场景使用。
  return (
    <div className="relative px-3 pt-2 pb-2">
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
