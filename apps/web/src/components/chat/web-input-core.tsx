// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { Brush } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useTextareaAutoHeight } from '@/hooks/use-textarea-auto-height'
import { Tooltip } from '@/components/feedback'
import { shouldSubmitOnEnter } from './enter-submit-policy'

export const MAX_LENGTH = 10000
const MAX_HEIGHT_PX = 320 // 最大约 16 行,超出后滚动
const MIN_HEIGHT_PX = 96 // rows=3 基础高度,与 hook threeLinePx 阈值一致

/** WebInputCore 句柄 — 与原 textareaRef 等价(主组件通过 inputCoreRef.current 访问) */
export interface WebInputCoreHandle {
  focus: () => void
  setSelectionRange: (start: number, end: number) => void
  resize: () => void
  /** D36 翻历史多行首行判定:返回 textarea 当前光标位置(selectionStart) */
  getCaretPosition: () => number
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
  /** 原生 keydown 事件(用于 Shift+Tab 切换权限模式)。
   *  第二参是 G-844 的 IME 本地腿(compositionstart 已到、compositionend 未到),由组件内
   *  compositionstart/end 驱动 —— 该 state 住在本组件里,外部 handler 结构上取不到,
   *  这是它唯一可传的通道(上层要判组合期必须用它,不得单腿读 nativeEvent.isComposing)。 */
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>, localComposing: boolean) => void
  /** G-845:空输入框上按 Backspace 时删掉最后一个附件。返回 true = 确实消费了这一下(附件被摘掉);
   *  返回 false = 这一刻没有附件可摘,键原样交还。返回值语义与同族 contextSelector.handleKeyDown
   *  一致(消费方才短路),这样"没有附件"不会被 preventDefault 白白吃掉浏览器默认行为。
   *  附件清单与 remove 出口由上层持有(生产是 use-message-references),本组件只判前提。 */
  onRemoveLastAttachment?: () => boolean
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
export const WebInputCore = React.forwardRef<WebInputCoreHandle, WebInputCoreProps>(
  function WebInputCore(
    {
      text,
      placeholder,
      onTextChange,
      onSend,
      onClear,
      error,
      onChange,
      onKeyDown,
      onRemoveLastAttachment,
      onPaste,
      isStreaming,
      // 2026-07-29 简化:sendLabel/stopLabel 在 web 端不再使用(发送/停止按钮已挪到外层 toolbar),
      // 保留在 props 契约里是为了和 packages/types SharedMessageInputProps 对齐(rn/taro 端仍用)。
      t,
      sendLabel: _sendLabel,
      stopLabel: _stopLabel,
    },
    ref,
  ) {
    const innerRef = React.useRef<HTMLTextAreaElement>(null)
    // G-844 输入法组合态的本地一条腿(上游 prompt-input-textarea.tsx:31/:103-104/:122-123 同此双保险)。
    // 只靠 e.nativeEvent.isComposing 是单腿:组合收尾那一次 keydown 在部分引擎里 isComposing 已经是
    // false(它先于 compositionend 落地),于是"用拼音/假名打字时按 Enter"会把半成品发出去。
    // 两条腿取或 —— 本地标志由 compositionstart/end 驱动,与事件上的标志互补。
    const [isComposing, setIsComposing] = React.useState(false)
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
        getCaretPosition: () => innerRef.current?.selectionStart ?? 0,
      }),
      [resize],
    )
    // 清除按钮(2026-07-30 用户规则:挪回 textarea 右上角,用 Brush 清洁刷图标,
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
            // 判序(G-843):先透传外部,外部握有否决权 —— 该顺序本身是被测契约,见
            // __tests__/web-input-core-enter-key-ordering.test.tsx。"该不该吃这一下 Enter"
            // 的全部判据住在 shouldSubmitOnEnter(G-844 IME 双腿并在其中),组件只做装配。
            //
            // 第二参把 IME 本地腿交给外部(G-862):上层要在 contextSelector 之前判组合期,
            // 而该 state 住在这里,外部结构上取不到 —— 只透传事件腿会让上层单腿。
            onKeyDown?.(e, isComposing)
            if (
              shouldSubmitOnEnter({
                key: e.key,
                shiftKey: e.shiftKey,
                defaultPrevented: e.defaultPrevented,
                localComposing: isComposing,
                nativeComposing: e.nativeEvent.isComposing,
              })
            ) {
              e.preventDefault()
              onSend()
              return
            }
            // G-845:空输入框上按 Backspace 删最后一个附件(上游 prompt-input-textarea.tsx:65-71;
            // 同族先例 slash-command-palette.tsx:267「空 query + Backspace 退回上一模式」)。
            // 三条前提缺一不可,否则一律交还浏览器/文本编辑的默认语义:
            //  - 文本为空(非空时 Backspace 属于删字符,绝不能顺手删附件)
            //  - IME 两条腿都清(组合期的 Backspace 归输入法,部分引擎用它取消候选窗)
            //  - 外部未 preventDefault(外部握有否决权,与 Enter 同一判序)
            // 回调返回 false(这一刻没有附件可摘)⇒ 不消费,键原样交还。
            if (
              e.key === 'Backspace' &&
              text.length === 0 &&
              !(isComposing || e.nativeEvent.isComposing) &&
              !e.defaultPrevented &&
              onRemoveLastAttachment?.()
            ) {
              e.preventDefault()
            }
          }}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
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
          <Tooltip content={t('clearInputTitle')}>
            <button
              type="button"
              aria-label={t('clearInputAriaLabel')}
              onClick={onClear}
              disabled={isStreaming}
              className={cn(
                'absolute right-2 top-1 inline-flex h-6 w-6 items-center justify-center rounded-sm',
                'text-muted-foreground transition-opacity',
                'opacity-0 hover:bg-accent hover:text-accent-foreground',
                'group-hover:opacity-100 touch-reveal focus-visible:opacity-100',
                'disabled:pointer-events-none',
              )}
            >
              <Brush className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </Tooltip>
        )}
        {/* 字符计数(2026-09-30 立):空输入时不渲染 —— 对标 Trae/Cursor,空白输入框
            不应有任何常驻杂讯;有内容后才出现,90%+ 琥珀 / 100% 红的渐进警告不变 */}
        {text.length > 0 && (
          <div className="pointer-events-none absolute inset-x-3 bottom-2 flex items-center justify-end">
            <span
              aria-live="polite"
              className={cn(
                'whitespace-nowrap text-[10px] tabular-nums text-muted-foreground/60 transition-colors',
                // 渐进式字符计数警告(2026-07-31 对标 主流 AI IDE):
                // - 90%+ 橙色警告(接近上限,提醒用户精简输入)
                // - 100% 红色错误(已达上限,禁止继续输入)
                text.length >= MAX_LENGTH && 'text-destructive',
                text.length >= MAX_LENGTH * 0.9 && text.length < MAX_LENGTH && 'text-amber-500',
              )}
            >
              {text.length}/{MAX_LENGTH}
            </span>
          </div>
        )}
        {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
      </div>
    )
  },
)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
