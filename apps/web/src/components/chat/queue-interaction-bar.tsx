// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
// **D162 a)G-171:queueChanged 的真实来源**:编辑窗口打开时记下目标项正文,确认前比对
// 当前正文 —— 被外部改过 ⇒ 本地实测的 queueChanged 事实,经调用方注入的 blockCtx 取并后
// 交给 D69 `queueActionBlockView` 判定(原因只有那一处判,本组件不复制 reason→文案表)。
// G-171a 补:同一漂移实测另经 `onEditDriftChange` 上抛调用方,并入 queueInteractionPerms
// 的 queueChanged 输入 ⇒ 重排/撤回的许可门也吃到这一真实来源(perms 仍恒出自 D69 构造)。
// 其余条件(控制命令 / 来源匹配)在 web 侧仍无生产者,一律沿用调用方注入值,不臆造。
//
// **W27 纪律**:本条只发"重排/移除/编辑/打断计划"意图,不做任何队列状态写操作;
// 「打断并执行」只上抛 interruptPlan({stopFirst, thenRun}),停流走 W2 abort 通道、
// 跑队首由调用方按既有消费路径执行 —— 队首选择逻辑一行不动。
//
// 「插到队首」快捷钮(2026-10-28 立,Qoder sendNow 形态对标,纯增量零新判据):
// 门完全复用 undo 同门(`canUndo` = 队列非空 ∧ 无并发漂移,D69 现判据)——刻意**不走**
// reorder 拖拽门(那条流式锁定属 W27 出队顺序预期;插到队首恰恰要在运行中钦定"下一条")。
// 动作 = `onReorder(index, 0)`,store 走既有 `requeue(from→to)`;队首由 shift 消费读
// queue[0] 的逻辑一行不动 ⇒ W27 不变式天然成立。六格拒因 tooltip 亦复用 undo 现格。

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { GripVertical } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  INPUT_NOTICES_NAMESPACE,
  QUEUE_BLOCKABLE_ACTIONS,
  queueActionBlockView,
  type QueueActionBlockContext,
  type QueueActionBlockReason,
  type QueueActionBlockView,
  type QueueBlockableAction,
  type QueueInteractionPerms,
} from '@ihui/shared/chat/input-notices'
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
  /**
   * D162:队列动作「为什么现在不能按」六格拒因判定上下文(Runtime 能力 / 有无运行中 Turn /
   * 等待请求 / 控制命令 / 队列并发变更 / 来源匹配)。缺省 ⇒ 行为与 D38/D162① 完全一致
   * (拒绝提示走 perms 的 deniedKey + causeKey);注入后六格命中的动作**被进一步拦下**,
   * 按钮挂具体拒因 tooltip(`queue.blocked.<key>`),拒绝提示追加具体拒因串。
   */
  blockCtx?: QueueActionBlockContext
  /**
   * G-171a:编辑窗口正文漂移实测(本面 queueChanged 唯一真实来源)上抛给调用方,
   * 由调用方并入 `queueInteractionPerms` 输入 —— 许可判定对象必须恒出自 D69 那一份
   * 构造,本组件只供事实、不在本地改 perms。漂移每次变化都通知(编辑结束回落 false)。
   */
  onEditDriftChange?: (drifted: boolean) => void
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
  blockCtx,
  onEditDriftChange,
  className,
  'data-testid': testId,
}: QueueInteractionBarProps) {
  const t = useTranslations(QUEUE_OPS_NAMESPACE)
  // 单点消费(2026-09-24 收口):deniedNotice 三枚拒绝键的唯一文案本体在 D69
  // `ai.pane.inputNotices.queue.denied.*`;queueOps 命名空间下的同文副本已删除,不得再加回。
  const tn = useTranslations(INPUT_NOTICES_NAMESPACE)
  // G-171 词包缺键防护:三个新拒因(denied.cause.queueChanged / .controlCommand /
  // .awaitingApproval)的文案本体已落 shared 五语包(web 经 mergeMessages(shared ⊕ web)
  // 解析);web 包内的同族副本被他席在飞改动阻塞(packages/i18n/messages/web/*.json
  // 本席不得编辑)。取词异常(键缺失/加载竞态)按「宁缺一句不回显键名」纪律吞掉渲染
  // null(同 extDeniedNoticeKey 先例),界面上绝不出现 `ai.pane.…` 字面量。
  const tnSafe = React.useCallback(
    (key: string): string | null => {
      try {
        return tn(key)
      } catch {
        return null
      }
    },
    [tn],
  )

  const [dragIndex, setDragIndex] = React.useState<number | null>(null)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  // 进入编辑态后把光标交给输入框。不用 autoFocus:jsx-a11y/no-autofocus 判红(键盘导航用户
  // 会被抢走焦点),且同一时刻只有一行在编辑,ref + effect 等价且可测。
  const editInputRef = React.useRef<HTMLInputElement | null>(null)
  React.useEffect(() => {
    if (editingId) editInputRef.current?.focus()
  }, [editingId])
  const [editDraft, setEditDraft] = React.useState('')

  // D162 a)G-171:queueChanged 的**真实输入** —— 编辑窗口基线。
  //   进入编辑时记下目标项当时的正文(用户看到的旧队列);确认前若该项正文已被外部改动,
  //   说明队列在这次编辑期间发生了变化,写回去就是覆盖别人的新值 ⇒ queueChanged 命中,
  //   草稿保留、不写回过期队列(判定仍走 D69 `queueActionBlockView` 唯一本体,这里只供事实,
  //   不另判原因)。单次点击型动作(撤回/重排)没有"看到→操作"窗口,不在此列 —— 无生产者
  //   的条件一律不臆造。
  const editBaselineRef = React.useRef<{ id: string; text: string } | null>(null)
  const editBaseline = editBaselineRef.current
  const editDrift =
    editingId !== null &&
    editBaseline !== null &&
    editBaseline.id === editingId &&
    (items.find((item) => item.id === editingId)?.text ?? null) !== editBaseline.text

  // G-171a:漂移实测上抛 —— 调用方把它并入 queueInteractionPerms 的 queueChanged 输入,
  // 使重排/撤回的许可门(edit 的拦截仍走 blockCtx 取并,两路同一 D69/D162 判定本体)也能
  // 看到"编辑期间队列被并发改过"这一实测事实。只供事实,判定不在本组件复制。
  React.useEffect(() => {
    onEditDriftChange?.(editDrift)
  }, [editDrift, onEditDriftChange])

  // 许可门统一走 D69 复用判定(每渲染一次求值;动作触发时再校验一次,防状态漂移)
  const verdicts = React.useMemo(() => {
    const byKind = {} as Record<
      (typeof DENIED_HINT_KINDS)[number],
      ReturnType<typeof interactionAllowed>
    >
    for (const kind of DENIED_HINT_KINDS) byKind[kind] = interactionAllowed(kind, perms)
    return byKind
  }, [perms])

  // D162:六格拒因逐动作求值(仅调用方注入 blockCtx 时启用;缺省 = 零行为变更)。
  // 只读不写:这里只产出"哪个动作因哪个具体条件不能按",不触碰任何队列状态。
  // editDrift 是编辑窗口内实测到的 queueChanged:与调用方注入的并发标记取并后交给同一判定。
  const blockedByKey = React.useMemo(() => {
    if (!blockCtx) return null
    const byAction = {} as Record<QueueBlockableAction, QueueActionBlockView>
    for (const action of QUEUE_BLOCKABLE_ACTIONS) {
      const ctx = action === 'edit' && editDrift ? { ...blockCtx, queueChanged: true } : blockCtx
      byAction[action] = queueActionBlockView(action, ctx)
    }
    return byAction
  }, [blockCtx, editDrift])

  // 动作终局许可 = D69 perms 门 ∧ D162 六格门(队列并发变更时拦下对过期队列的操作)
  const actionAllowed = (kind: (typeof DENIED_HINT_KINDS)[number]): boolean => {
    if (!verdicts[kind].allowed) return false
    const view = blockedByKey ? blockedByKey[kind] : null
    return !(view && view.blocked)
  }

  // 六格命中的具体拒因 tooltip / data 属性(未注入或未命中 → undefined,不误导可用的按钮)
  const blockedTitleOf = (action: QueueBlockableAction): string | undefined => {
    const view = blockedByKey ? blockedByKey[action] : null
    return view && view.blocked && view.reasonKey ? tn(`queue.${view.reasonKey}`) : undefined
  }
  const blockedReasonOf = (action: QueueBlockableAction): QueueActionBlockReason | undefined => {
    const view = blockedByKey ? blockedByKey[action] : null
    return view && view.blocked ? (view.reason ?? undefined) : undefined
  }

  const modeResolution = React.useMemo(
    () => effectiveMode(mode, runtimeSupportsInterjection),
    [mode, runtimeSupportsInterjection],
  )

  if (items.length === 0) return null

  const tryReorder = (fromIndex: number, toIndex: number) => {
    if (!actionAllowed('reorder')) return
    onReorder?.(fromIndex, toIndex)
  }

  // 「插到队首」:undo 同门(canUndo ∧ 六格 undo 未拦),非队首项一键移到队首。
  // fromIndex<=0 防御 no-op(队首钮本就不渲染)。不新建判据、不写队列状态 —— 只上抛意图。
  const tryMoveToFront = (fromIndex: number) => {
    if (fromIndex <= 0) return
    if (!actionAllowed('undo')) return
    onReorder?.(fromIndex, 0)
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
    if (!actionAllowed('edit')) return
    // 编辑窗口基线:记下用户此刻看到的正文,确认时用它判定队列是否被并发改动
    editBaselineRef.current = { id: itemId, text: currentText }
    setEditingId(itemId)
    setEditDraft(currentText)
  }

  const cancelEdit = () => {
    editBaselineRef.current = null
    setEditingId(null)
    setEditDraft('')
  }

  const confirmEdit = () => {
    if (editingId === null) return
    // D162:队列并发变更(queueChanged 命中六格,含编辑窗口内实测到的正文漂移)时确认被拦 ——
    // 草稿保留在输入框,不清空不写回,不得让用户误以为编辑已落到过期队列上。
    if (!actionAllowed('edit')) return
    const text = editDraft.trim()
    editBaselineRef.current = null
    setEditingId(null)
    setEditDraft('')
    if (!text) return
    onEdit?.(editingId, text)
  }

  const handleInterrupt = () => {
    if (!actionAllowed('interruptAndRun')) return
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
              draggable={actionAllowed('reorder')}
              aria-label={t('reorderAria')}
              aria-disabled={!actionAllowed('reorder')}
              title={blockedTitleOf('reorder')}
              data-blocked-reason={blockedReasonOf('reorder')}
              className={cn(
                'cursor-grab select-none text-xs text-muted-foreground',
                !actionAllowed('reorder') && 'cursor-not-allowed opacity-40',
              )}
              data-queue-op="reorderHandle"
              data-item-id={item.id}
              data-index={index}
              onDragStart={() => actionAllowed('reorder') && setDragIndex(index)}
              onKeyDown={(event) => handleReorderKey(event, index)}
            >
              <GripVertical className="h-3.5 w-3.5" aria-hidden />
            </span>
            {editing ? (
              <>
                <input
                  className="min-w-0 flex-1 rounded-sm border bg-background px-1.5 py-0.5 text-xs"
                  value={editDraft}
                  ref={editInputRef}
                  data-queue-op="editInput"
                  data-item-id={item.id}
                  onChange={(event) => setEditDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') confirmEdit()
                    else if (event.key === 'Escape') cancelEdit()
                  }}
                />
                <button
                  type="button"
                  className="text-xs text-primary"
                  aria-disabled={!actionAllowed('edit')}
                  title={blockedTitleOf('edit')}
                  data-blocked-reason={blockedReasonOf('edit')}
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
                  onClick={cancelEdit}
                >
                  {t('editCancel')}
                </button>
              </>
            ) : (
              <>
                <span className="min-w-0 flex-1 truncate text-xs" data-queued-text={item.text}>
                  {item.text}
                </span>
                {index > 0 ? (
                  <button
                    type="button"
                    className="text-xs text-primary/80 hover:text-primary"
                    aria-label={t('sendNowAria')}
                    aria-disabled={!actionAllowed('undo')}
                    title={blockedTitleOf('undo')}
                    data-blocked-reason={blockedReasonOf('undo')}
                    data-queue-op="sendNow"
                    data-item-id={item.id}
                    onClick={() => tryMoveToFront(index)}
                  >
                    {t('sendNow')}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  aria-disabled={!actionAllowed('undo')}
                  title={blockedTitleOf('undo')}
                  data-blocked-reason={blockedReasonOf('undo')}
                  data-queue-op="undo"
                  data-item-id={item.id}
                  onClick={() => actionAllowed('undo') && onUndo?.(item.id)}
                >
                  {t('undo')}
                </button>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  aria-disabled={!actionAllowed('edit')}
                  title={blockedTitleOf('edit')}
                  data-blocked-reason={blockedReasonOf('edit')}
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
          aria-disabled={!actionAllowed('interruptAndRun')}
          title={blockedTitleOf('interruptAndRun')}
          data-blocked-reason={blockedReasonOf('interruptAndRun')}
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
        const specific = blockedByKey ? blockedByKey[kind] : null
        const sixGridBlocked = !!(
          specific &&
          specific.blocked &&
          specific.reasonKey &&
          specific.reason
        )
        if (verdict.allowed && !sixGridBlocked) return null
        // G-937950:cause 串独立渲染(不与 action 键合成一句"当前不可用")。
        // data-queue-denied-cause 携带**渲染出的文案串**,data-cause-key 携带键名 ——
        // 两条测试断言用:两个不同拒绝条件得到的文案必须互不相同。
        const causeKey = verdict.causeKey && !sixGridBlocked ? verdict.causeKey : null
        const causeText = causeKey ? tnSafe(`queue.${causeKey}`) : null
        const deniedText = verdict.deniedKey ? tn(`queue.${verdict.deniedKey}`) : null
        return (
          <span
            key={kind}
            className="text-[11px] text-muted-foreground"
            data-queue-denied={kind}
            data-denied-key={verdict.deniedKey ?? ''}
          >
            {/* 2026-10-21:标签段单独包 span 并带 data-queue-denied-label —— 三段
                (标签/条件/六格拒因)同在外层 span 顺排,textContent 是拼接串,
                对标签的逐字断言只能按该属性精确定位。纯加属性:文案与版式零变化。 */}
            {deniedText ? <span data-queue-denied-label={deniedText}>{deniedText}</span> : null}
            {/* D162 ①:动作名之外必须同时给出**具体条件**(流式中锁定重排 / 队列已空 /
                Runtime 不支持插话 …)。两串各自独立渲染并各带 data-*,用例才能断言
                "两个不同条件得到的文案互不相同" —— 合成一句"当前不可用"就等于没写。 */}
            {causeText ? (
              <span className="ml-1" data-queue-denied-cause={causeText} data-cause-key={causeKey}>
                {causeText}
              </span>
            ) : null}
            {/* D162:六格命中的更具体拒因(queueChanged / controlCommandNoInterject /
                waitingRequestFirst …)—— perms 模型判不出的条件从这里出词,
                命中时取代笼统 cause 串,避免同一处解释两遍。 */}
            {specific && specific.blocked && specific.reasonKey && specific.reason ? (
              <span
                className="ml-1"
                data-queue-blocked-reason={specific.reason}
                data-blocked-key={specific.reasonKey}
              >
                {tn(`queue.${specific.reasonKey}`)}
              </span>
            ) : null}
          </span>
        )
      })}
    </div>
  )
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
