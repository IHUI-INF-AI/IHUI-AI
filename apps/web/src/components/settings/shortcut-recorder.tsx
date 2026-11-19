// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { isTopOverlay, popOverlay, pushOverlay } from '@/lib/overlay-stack'
import { comboFromKeyEvent, type ShortcutSetResult } from '@/lib/shortcut-overrides'

/** 层栈 id(见 @/lib/overlay-stack):录制态是浮层,多层同开时 Esc 只退最上面那层 */
const SHORTCUT_RECORDER_OVERLAY_ID = 'shortcut-recorder'

export interface ShortcutRecorderLabels {
  recording: string
  invalid: string
  conflict: (key: string) => string
}

interface ShortcutRecorderProps {
  labels: ShortcutRecorderLabels
  /** 返回改键结果:成功由父组件收起录制态,冲突/非法由录制器就地显示。 */
  onCommit: (combo: string) => ShortcutSetResult
  onCancel: () => void
}

/**
 * 快捷键录制器(内联,不新开弹层):
 * - 捕获阶段监听 keydown 并 `stopImmediatePropagation`,否则按 Ctrl+P 录制会直接触发搜索;
 * - Esc 取消;只有修饰键时静默等待下一个键;裸键/仅 Shift 提示非法;
 * - 冲突信息来自 setShortcutOverride 的返回值,不在这里猜。
 */
export function ShortcutRecorder({ labels, onCommit, onCancel }: ShortcutRecorderProps) {
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    // 层栈:录制态挂载即入栈,卸载出栈。Esc 分支只在栈顶时消费 ——
    // 否则「设置页录制中 + 上层还有别的浮层」时一次 Esc 会把两层一起关掉。
    pushOverlay(SHORTCUT_RECORDER_OVERLAY_ID)
    const onKeyDown = (event: KeyboardEvent) => {
      // 非栈顶的 Esc 直接放给真正的栈顶消费(这里连 preventDefault 都不做)
      if (event.key === 'Escape' && !isTopOverlay(SHORTCUT_RECORDER_OVERLAY_ID)) return
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      if (event.key === 'Escape') {
        onCancel()
        return
      }
      const combo = comboFromKeyEvent(event)
      if (!combo) {
        // 修饰键本身不报错,等用户按完整组合;其他键给"需要修饰键"提示
        if (event.key.length === 1) setError(labels.invalid)
        return
      }
      const result = onCommit(combo)
      if (!result.ok) {
        setError(
          result.reason === 'conflict' ? labels.conflict(result.conflictKey ?? '') : labels.invalid,
        )
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      popOverlay(SHORTCUT_RECORDER_OVERLAY_ID)
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [labels, onCommit, onCancel])

  return (
    <span
      role="status"
      aria-live="polite"
      data-testid="shortcut-recorder"
      style={{
        fontSize: 12,
        color: error ? 'var(--color-danger, #d33)' : 'var(--color-primary, #0a7)',
      }}
    >
      {error ?? labels.recording}
    </span>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
