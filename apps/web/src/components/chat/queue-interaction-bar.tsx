// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// D38 队列语义完整交互 —— 队列项交互条(G-42,2026-09-24 立,对标 Codex follow-up messages)。
//
// **数据面纪律(同 D72 WorktreeCard)**:本条**不取数**。队列项 / 许可 / 模式全部由调用方
// (message-input 排队区)注入;动作一律经 props 回调上抛,由调用方接到 store 的
// requeue/removeQueued/editQueued/interruptAndRun(useChatStore)与 W2 abort 通道。
//
// **许可门复用 D69**:全部交互先过 `@ihui/shared/chat/queue-interactions` 的
// `interactionAllowed(kind, perms)`(perms 必须来自 D69 `queueInteractionPerms`),端内
// 不另立第二套判定。被拒动作**必须显式渲染 deniedKey**(静默禁用 = 把"为什么不行"藏起来)。
//
// **W27 纪律**:本条只发"重排/移除/编辑/打断计划"意图,不做任何队列状态写操作;
// 「打断并执行」只上抛 interruptPlan({stopFirst, thenRun}),停流走 W2 abort 通道、
// 跑队首由调用方按既有消费路径执行 —— 队首选择逻辑一行不动。

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { GripVertical } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { QueueInteractionPerms } from '@ihui/shared/chat/input-notices'
import {
  QUEUE_OPS_NAMESPACE,
  effectiveMode,
  interactionAllowed,
  interruptPlan,
  type FollowUpMode,
} from '@ihui/shared/chat/queue-interactions'

/** 队列项展示视图(调用方从 sideQueueByConversation 桶映射;不携带元数据以外职责) */
export interface QueuedItemView {
  readonly id: string
  readonly text: string
}

export interface QueueInteractionBarProps {
  /** 待渲染的队列项(顺序即当前队列顺序;空 ⇒ 本条不渲染任何内容) */
  items: readonly QueuedItemView[]
  /** D69 排队交互许可判定结果(queueInteractionPerms 产出) */
  perms: QueueInteractionPerms
  /** 当前队列模式偏好(steer / queue) */
  mode: FollowUpMode
  /** 当前 Runtime 是否支持插话(能力协商结果) */
  runtimeSupportsInterjection: boolean
  /** 是否流式生成中(「打断并执行」计划的 stopFirst 依据) */
  streaming?: boolean
  /** 重排回调(fromIndex → toIndex,先摘后插);被拒时不回调 */
  onReorder?: (fromIndex: number, toIndex: number) => void
  /** 撤回回调;被拒时不回调 */
  onUndo?: (itemId: string) => void
  /** 编辑回调(已 trim);被拒/空文本不回调 */
  onEdit?: (itemId: string, text: string) => void
  /** 「打断并执行」回调:上抛 interruptPlan,停流与执行由调用方负责 */
  onInterruptAndRun?: (plan: {
    readonly stopFirst: boolean
    readonly thenRun: string | null
  }) => void
  /** 模式切换回调(setMode 恒可切) */
  onModeChange?: (mode: FollowUpMode) => void
  className?: string
  'data-testid'?: string
}

/** 三条被拒提示的展示顺序(D69 动作序) */
const DENIED_HINT_KINDS = ['reorder', 'undo', 'edit', 'interruptAndRun'] as const

/**
 * QueueInteractionBar — 队列项交互条。
 * 每项一行:重排把手(拖拽 + ↑↓ 键盘)/ 正文 / 撤回 / 编辑(行内输入);
 * 尾部:「打断并执行」入口 + 模式切换(插话优先 / 排队优先)。
 */
export function QueueInteractionBar({
  items,
  perms,
  mode,
  runtimeSupportsInterjection,
  streaming = false,
  onReorder,
  onUndo,
  onEdit,
  onInterruptAndRun,
  onModeChange,
  className,
  'data-testid': testId,
}: QueueInteractionBarProps) {
  const t = useTranslations(QUEUE_OPS_NAMESPACE)

  const [dragIndex, setDragIndex] = React.useState<number | null>(null)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editDraft, setEditDraft] = React.useState('')

  // 许可门统一走 D69 复用判定(每渲染一次求值;动作触发时再校验一次,防状态漂移)
  const verdicts = React.useMemo(() => {
    const byKind = {} as Record<
      (typeof DENIED_HINT_KINDS)[number],
      ReturnType<typeof interactionAllowed>
    >
    for (const kind of DENIED_HINT_KINDS) byKind[kind] = interactionAllowed(kind, perms)
    return byKind
  }, [perms])

  const modeResolution = React.useMemo(
    () => effectiveMode(mode, runtimeSupportsInterjection),
    [mode, runtimeSupportsInterjection],
  )

  if (items.length === 0) return null

  const tryReorder = (fromIndex: number, toIndex: number) => {
    if (!verdicts.reorder.allowed) return
    onReorder?.(fromIndex, toIndex)
  }

  const handleReorderKey = (event: React.KeyboardEvent, index: number) => {
    if (event.key === 'ArrowUp' && index > 0) {
      event.preventDefault()
      tryReorder(index, index - 1)
    } else if (event.key === 'ArrowDown' && index < items.length - 1) {
      event.preventDefault()
      tryReorder(index, index + 1)
    }
  }

  const handleDrop = (event: React.DragEvent, index: number) => {
    event.preventDefault()
    if (dragIndex === null) return
    const from = dragIndex
    setDragIndex(null)
    tryReorder(from, index)
  }

  const startEdit = (itemId: string, currentText: string) => {
    if (!verdicts.edit.allowed) return
    setEditingId(itemId)
    setEditDraft(currentText)
  }

  const confirmEdit = () => {
    if (editingId === null) return
    const text = editDraft.trim()
    setEditingId(null)
    setEditDraft('')
    if (!text) return
    onEdit?.(editingId, text)
  }

  const handleInterrupt = () => {
    if (!verdicts.interruptAndRun.allowed) return
    // 队首只读不改:items[0] 由调用方按既有队列顺序传入(W27:选择逻辑不在此)
    const plan = interruptPlan({ streaming, streamingMessageId: null }, items[0] ?? null)
    onInterruptAndRun?.(plan)
  }

  return (
    <div
      role="group"
      aria-label={t('ariaLabel')}
      className={cn('flex flex-col gap-1 rounded-md bg-muted/30 p-2', className)}
      data-testid={testId}
      data-queue-ops=""
      data-queue-ops-mode={modeResolution.mode}
    >
      {items.map((item, index) => {
        const editing = editingId === item.id
        return (
          <div
            key={item.id}
            className="flex items-center gap-1.5"
            data-queued-item={item.id}
            data-queued-index={index}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => handleDrop(event, index)}
          >
            <span
              role="button"
              tabIndex={0}
              draggable={verdicts.reorder.allowed}
              aria-label={t('reorderAria')}
              aria-disabled={!verdicts.reorder.allowed}
              className={cn(
                'cursor-grab select-none text-xs text-muted-foreground',
                !verdicts.reorder.allowed && 'cursor-not-allowed opacity-40',
              )}
              data-queue-op="reorderHandle"
              data-item-id={item.id}
              data-index={index}
              onDragStart={() => verdicts.reorder.allowed && setDragIndex(index)}
              onKeyDown={(event) => handleReorderKey(event, index)}
            >
              <GripVertical className="h-3.5 w-3.5" aria-hidden />
            </span>
            {editing ? (
              <>
                <input
                  className="min-w-0 flex-1 rounded border bg-background px-1.5 py-0.5 text-xs"
                  value={editDraft}
                  autoFocus
                  data-queue-op="editInput"
                  data-item-id={item.id}
                  onChange={(event) => setEditDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') confirmEdit()
                    else if (event.key === 'Escape') {
                      setEditingId(null)
                      setEditDraft('')
                    }
                  }}
                />
                <button
                  type="button"
                  className="text-xs text-primary"
                  data-queue-op="editConfirm"
                  data-item-id={item.id}
                  onClick={confirmEdit}
                >
                  {t('editConfirm')}
                </button>
                <button
                  type="button"
                  className="text-xs text-muted-foreground"
                  data-queue-op="editCancel"
                  data-item-id={item.id}
                  onClick={() => {
                    setEditingId(null)
                    setEditDraft('')
                  }}
                >
                  {t('editCancel')}
                </button>
              </>
            ) : (
              <>
                <span className="min-w-0 flex-1 truncate text-xs" data-queued-text={item.text}>
                  {item.text}
                </span>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  aria-disabled={!verdicts.undo.allowed}
                  data-queue-op="undo"
                  data-item-id={item.id}
                  onClick={() => verdicts.undo.allowed && onUndo?.(item.id)}
                >
                  {t('undo')}
                </button>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  aria-disabled={!verdicts.edit.allowed}
                  data-queue-op="edit"
                  data-item-id={item.id}
                  onClick={() => startEdit(item.id, item.text)}
                >
                  {t('edit')}
                </button>
              </>
            )}
          </div>
        )
      })}

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          className="text-xs text-primary"
          aria-disabled={!verdicts.interruptAndRun.allowed}
          data-queue-op="interruptAndRun"
          onClick={handleInterrupt}
        >
          {t('interruptAndRun')}
        </button>
        <span className="text-[11px] text-muted-foreground" data-queue-mode-label>
          {t('mode.label')}
        </span>
        {(['steer', 'queue'] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={cn(
              'text-xs',
              mode === m ? 'font-medium text-foreground' : 'text-muted-foreground',
            )}
            data-queue-op="mode"
            data-mode={m}
            aria-pressed={mode === m}
            onClick={() => onModeChange?.(m)}
          >
            {t(`mode.${m}`)}
          </button>
        ))}
      </div>

      {/* 降级句:steer 偏好遇到不支持插话的 Runtime —— 必须显式渲染,不得静默降级 */}
      {modeResolution.degraded && modeResolution.degradedKey ? (
        <span
          className="text-[11px] text-amber-600 dark:text-amber-500"
          data-mode-degraded={modeResolution.degradedKey}
        >
          {t(modeResolution.degradedKey)}
        </span>
      ) : null}

      {/* 被拒动作显式渲染 deniedKey(D69 同键;静默 = 把"为什么不行"藏起来) */}
      {DENIED_HINT_KINDS.map((kind) => {
        const verdict = verdicts[kind]
        if (verdict.allowed || !verdict.deniedKey) return null
        return (
          <span
            key={kind}
            className="text-[11px] text-muted-foreground"
            data-queue-denied={kind}
            data-denied-key={verdict.deniedKey}
          >
            {t(verdict.deniedKey)}
          </span>
        )
      })}
    </div>
  )
}

export default QueueInteractionBar
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
