// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D38 队列语义完整交互 — extension 端排队交互条(G-42 / H18)
//
// 纯展示 + 动词派发:许可判定**全部**经 lib/ext-queue-ops(共享层
// queueInteractionPerms + interactionAllowed 的唯一端内投影),本文件不立第二套判定。
// 被拒动作显式渲染拒绝行(键可解析时),不静默禁用;文案键取 shared 词包
// ai.pane.queueOps.*(五语言已在仓),端内零硬编码中文(守门 70)。
// 范式参照 web 宿主 queue-interaction-bar,但按本端消息面(shared ⊕ extension)
// 只渲染可解析的拒绝键,缺口由 extDeniedNoticeKey 如实返回 null,绝不回显原始键名。

import { useState } from 'react'
import { ArrowDown, ArrowUp, Pencil, Zap } from 'lucide-react'
import { Button, Input } from '@ihui/ui-react'
import { useI18n } from '../../../src/i18n'
import {
  extDeniedNoticeKey,
  extFollowUpDegradeKey,
  extQueueInteractionAllowed,
  extResolveFollowUpMode,
  type ExtQueueFacts,
  type ExtQueueItem,
} from '../../../lib/ext-queue-ops'
import type { FollowUpMode, QueueInteractionKind } from '@ihui/shared/chat/queue-interactions'

interface QueueBarProps {
  readonly items: readonly ExtQueueItem[]
  readonly streaming: boolean
  /** Runtime 插话能力协商位;宿主当前如实传 false(见 ext-queue-ops 文件头) */
  readonly runtimeSupportsInterjection: boolean
  readonly mode: FollowUpMode
  readonly onModeChange: (mode: FollowUpMode) => void
  readonly onReorder: (fromIndex: number, toIndex: number) => void
  readonly onUndo: (id: string) => void
  readonly onEdit: (id: string, text: string) => void
  readonly onInterruptAndRun: () => void
}

const OPS_NS = 'ai.pane.queueOps'

export default function QueueBar({
  items,
  streaming,
  runtimeSupportsInterjection,
  mode,
  onModeChange,
  onReorder,
  onUndo,
  onEdit,
  onInterruptAndRun,
}: QueueBarProps) {
  const { t } = useI18n()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const facts: ExtQueueFacts = {
    hasQueuedMessages: items.length > 0,
    streaming,
    runtimeSupportsInterjection,
  }
  const verdictOf = (kind: QueueInteractionKind) => extQueueInteractionAllowed(kind, facts)
  const verdicts = {
    reorder: verdictOf('reorder'),
    undo: verdictOf('undo'),
    edit: verdictOf('edit'),
    interruptAndRun: verdictOf('interruptAndRun'),
  }
  const modeResolution = extResolveFollowUpMode(mode, runtimeSupportsInterjection)
  const degradeTextKey =
    modeResolution.ok === true ? extFollowUpDegradeKey(modeResolution.resolution) : null

  /** 动词派发:许可门在共享层;被拒时不触发动作,拒绝行由本组件显式渲染 */
  const dispatch = (kind: QueueInteractionKind, action: () => void) => {
    if (!verdictOf(kind).allowed) return
    action()
  }

  const startEdit = (item: ExtQueueItem) => {
    if (!verdicts.edit.allowed) return
    setEditingId(item.id)
    setDraft(item.text)
  }

  const commitEdit = (id: string) => {
    dispatch('edit', () => {
      onEdit(id, draft)
      setEditingId(null)
      setDraft('')
    })
  }

  return (
    <div
      className="rounded-md border border-border bg-card px-2 py-1.5 text-xs"
      data-testid="ext-queue-bar"
      aria-label={t(`${OPS_NS}.ariaLabel`)}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">{t(`${OPS_NS}.mode.label`)}</span>
        <select
          className="rounded-md border border-border bg-card px-1 py-px text-xs text-foreground focus:outline-none focus:border-muted-foreground"
          value={mode}
          onChange={(e) => {
            const resolved = extResolveFollowUpMode(e.target.value, runtimeSupportsInterjection)
            if (resolved.ok === true) onModeChange(resolved.resolution.mode)
          }}
          aria-label={t(`${OPS_NS}.mode.label`)}
          data-testid="ext-queue-mode"
        >
          <option value="steer">{t(`${OPS_NS}.mode.steer`)}</option>
          <option value="queue">{t(`${OPS_NS}.mode.queue`)}</option>
        </select>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="ml-auto px-1.5"
          aria-disabled={!verdicts.interruptAndRun.allowed}
          data-testid="ext-queue-interrupt"
          onClick={() => dispatch('interruptAndRun', onInterruptAndRun)}
        >
          <Zap className="h-3 w-3" aria-hidden />
          <span>{t(`${OPS_NS}.interruptAndRun`)}</span>
        </Button>
      </div>

      {degradeTextKey ? (
        <p className="mt-1 text-muted-foreground" data-testid="ext-queue-degraded">
          {t(degradeTextKey)}
        </p>
      ) : null}

      {verdicts.reorder.allowed ? (
        <p className="mt-1 text-muted-foreground" data-testid="ext-queue-reorder-aria">
          {t(`${OPS_NS}.reorderAria`)}
        </p>
      ) : null}

      <ul className="mt-1 flex flex-col gap-1">
        {items.map((item, idx) => (
          <li
            key={item.id}
            className="flex items-center gap-1"
            data-testid={`ext-queue-item-${idx}`}
          >
            {editingId === item.id ? (
              <>
                <Input
                  type="text"
                  className="flex-1"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  aria-label={t(`${OPS_NS}.edit`)}
                  data-testid={`ext-queue-edit-input-${item.id}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="px-1.5"
                  onClick={() => commitEdit(item.id)}
                  data-testid={`ext-queue-edit-confirm-${item.id}`}
                >
                  <span>{t(`${OPS_NS}.editConfirm`)}</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="px-1.5"
                  onClick={() => {
                    setEditingId(null)
                    setDraft('')
                  }}
                  data-testid={`ext-queue-edit-cancel-${item.id}`}
                >
                  <span>{t(`${OPS_NS}.editCancel`)}</span>
                </Button>
              </>
            ) : (
              <>
                <span className="min-w-0 flex-1 truncate text-foreground">{item.text}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="px-1"
                  aria-disabled={!verdicts.reorder.allowed || idx === 0}
                  data-testid={`ext-queue-up-${item.id}`}
                  onClick={() => dispatch('reorder', () => onReorder(idx, idx - 1))}
                >
                  <ArrowUp className="h-3 w-3" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="px-1"
                  aria-disabled={!verdicts.reorder.allowed || idx === items.length - 1}
                  data-testid={`ext-queue-down-${item.id}`}
                  onClick={() => dispatch('reorder', () => onReorder(idx, idx + 1))}
                >
                  <ArrowDown className="h-3 w-3" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="px-1"
                  aria-disabled={!verdicts.undo.allowed}
                  data-testid={`ext-queue-undo-${item.id}`}
                  onClick={() => dispatch('undo', () => onUndo(item.id))}
                >
                  <span>{t(`${OPS_NS}.undo`)}</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="px-1"
                  aria-disabled={!verdicts.edit.allowed}
                  data-testid={`ext-queue-edit-${item.id}`}
                  onClick={() => startEdit(item)}
                >
                  <Pencil className="h-3 w-3" aria-hidden />
                  <span>{t(`${OPS_NS}.edit`)}</span>
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>

      {/* 被拒动作显式渲染(静默禁用 = 把"为什么不行"藏起来)。三枚 denied 键现在本端
          都能解析:denied.interject 走 shared 既有同句键,denied.reorder / denied.undo 走
          后补进 packages/i18n/messages/extension/* 的 D69 完整键(取值 = web 定稿译文逐字,
          五语言对称)。null 分支保留为**防御**:判定层将来新增 denied.<action> 而本端词包
          没跟上时,表现必须是"不显示这一行",绝不是把 ai.pane.… 键名甩到界面上。 */}
      {(['reorder', 'undo', 'interruptAndRun'] as const).map((kind) => {
        const verdict = verdictOf(kind)
        if (verdict.allowed || !verdict.deniedKey) return null
        const noticeKey = extDeniedNoticeKey(verdict.deniedKey)
        if (noticeKey === null) return null
        return (
          <p
            key={kind}
            className="mt-1 text-muted-foreground"
            data-queue-denied={kind}
            data-denied-key={verdict.deniedKey}
            data-testid={`ext-queue-denied-${kind}`}
          >
            {t(noticeKey)}
          </p>
        )
      })}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
