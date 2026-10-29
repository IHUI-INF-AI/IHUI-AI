// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { RotateCcw, ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { computeFileChanges, describeToolCall, summarizeFileChanges } from '@ihui/shared/chat'
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button } from '@ihui/ui-react'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@ihui/ui-react'
import type { ChatMessage, ToolCall } from '@/stores/chat'
import { usePaneChatStore } from '@/stores/chat-pane-context'
import { listCheckpoints, restoreCheckpoint, type CheckpointMeta } from '@/api/checkpoint-api'
import { pickRevertCheckpoint, countAffectedTurns } from '@/components/ai/checkpoint-impact'
import {
  judgeCheckpointExpiry,
  retentionHours,
  type CheckpointProbeOutcome,
} from '@/lib/checkpoint-expiry-note'
import { toast } from '@/components/common'
import { cn } from '@/lib/utils'
import {
  STREAM_ROW_CLASS,
  StreamCode,
  StreamDelta,
  StreamDetail,
  StreamRow,
  StreamStatusIcon,
  StreamTag,
} from '@/components/chat/stream/stream-ui'

/** 路径比较统一成正斜杠(与 describeToolCall 的 subject 归一化口径一致) */
function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').trim()
}

/** 本轮变更卡的文件动作(键在 chat.turnChanges.* 下) */
type TurnFileAction = 'changedFile' | 'createdFile' | 'deletedFile'

/** 写类工具码名 → 动作;未列出的写类工具一律按"修改文件"表述 */
function turnFileAction(toolName: string): TurnFileAction {
  if (toolName === 'create_file') return 'createdFile'
  if (toolName === 'delete_file') return 'deletedFile'
  return 'changedFile'
}

/**
 * 文件路径 → 该文件的写类动作(chat.turnChanges.* 三键之一)。
 * ±行数一律由 computeFileChanges 给出(单一口径),这里只取"这个文件当时在做什么",
 * 同一文件多次写入保留首次命中的动作。
 */
function actionKeyByPath(toolCalls: readonly ToolCall[] | undefined): Map<string, TurnFileAction> {
  const map = new Map<string, TurnFileAction>()
  if (!toolCalls) return map
  for (const call of toolCalls) {
    if (call.status !== 'success' || call.error) continue
    const view = describeToolCall({
      toolName: call.toolName,
      args: call.args,
      result: call.result,
      status: call.status,
    })
    if (!view.writesFile || view.subject === '') continue
    const key = normalizePath(view.subject)
    if (!map.has(key)) map.set(key, turnFileAction(call.toolName))
  }
  return map
}

export interface TurnChangesCardProps {
  message: ChatMessage
  conversationId: string | null
}

export function TurnChangesCard({ message, conversationId }: TurnChangesCardProps) {
  const t = useTranslations('chat')
  const tStatus = useTranslations('taskStatus')
  // 消息面按窗格寻址:撤销涟漪的轮次数要数**这个窗格**里真正会消失的 assistant 轮次,
  // 读根单例会数到别的窗格/别的会话的消息上去。
  const chatStore = usePaneChatStore()
  // ±行数与文件清单的唯一口径来自 @ihui/shared/chat(不在端内重复数行)
  const changes = React.useMemo(() => computeFileChanges(message.toolCalls), [message.toolCalls])
  const summary = React.useMemo(() => summarizeFileChanges(changes), [changes])
  const actionKeys = React.useMemo(() => actionKeyByPath(message.toolCalls), [message.toolCalls])
  // 文件动作词单一口径:chat.turnChanges.{changedFile|createdFile|deletedFile}
  const actionText: Record<TurnFileAction, string> = {
    changedFile: t('turnChanges.changedFile'),
    createdFile: t('turnChanges.createdFile'),
    deletedFile: t('turnChanges.deletedFile'),
  }
  const [open, setOpen] = React.useState(true)
  const [expanded, setExpanded] = React.useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [restoring, setRestoring] = React.useState(false)
  const [hasCheckpoint, setHasCheckpoint] = React.useState<boolean | null>(null)
  // 2026-10-29:探测结局与"有没有"分开记 —— catch 分支把 hasCheckpoint 置 false 只是
  // 兜底渲染(入口置灰),不构成"确实没有检查点"的事实;据此判过期会撒谎。
  const [probeOutcome, setProbeOutcome] = React.useState<CheckpointProbeOutcome>('idle')
  // 撤销涟漪读数:目标 checkpoint 时点之后会一起消失的 round 数(null = 算不出来)
  const [turnCount, setTurnCount] = React.useState<number | null>(null)

  // 挂载即探查本消息 createdAt 之前是否存在 checkpoint,决定「恢复到本轮之前」可用性
  React.useEffect(() => {
    let cancelled = false
    if (!conversationId) {
      setHasCheckpoint(false)
      setProbeOutcome('skipped')
      return
    }
    listCheckpoints(conversationId)
      .then((res) => {
        if (cancelled) return
        const target = pickRevertCheckpoint(res.checkpoints, message.createdAt)
        setHasCheckpoint(target !== null)
        setProbeOutcome('done')
        setTurnCount(
          target ? countAffectedTurns(chatStore.getState().messages, target.created_at) : null,
        )
      })
      .catch(() => {
        if (!cancelled) {
          setHasCheckpoint(false)
          setProbeOutcome('failed')
        }
      })
    return () => {
      cancelled = true
    }
  }, [conversationId, message.createdAt, chatStore])

  // 2026-10-29:「无可用检查点」必须说清为什么 + 什么还留着。
  // 判据在 lib 层(纯函数,可单测):检查点 expires_at = created_at + TTL 且不续期 ⇒
  // 消息距今超过 TTL 时,它之前的检查点**必然**已被保留期清掉(可证,不是"可能")。
  // 判不准(探测中/探测失败/无会话/未超过 TTL)一律不显示说明,保持既有文案。
  const expiryVerdict = React.useMemo(
    () =>
      judgeCheckpointExpiry({
        hasCheckpoint,
        probeOutcome,
        messageCreatedAtMs: message.createdAt,
        nowMs: Date.now(),
      }),
    [hasCheckpoint, probeOutcome, message.createdAt],
  )

  const handleConfirmRevert = React.useCallback(async () => {
    if (!conversationId) return
    setRestoring(true)
    try {
      const list = await listCheckpoints(conversationId)
      const target: CheckpointMeta | null = pickRevertCheckpoint(
        list.checkpoints,
        message.createdAt,
      )
      if (!target) {
        toast.error(t('turnChanges.noCheckpoints'))
        setConfirmOpen(false)
        return
      }
      await restoreCheckpoint(target.checkpoint_id, conversationId, 'both')
      toast.success(t('turnChanges.revert'))
      setConfirmOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setRestoring(false)
    }
  }, [conversationId, message.createdAt, t])

  if (changes.length === 0) return null

  // 确认文案:文件数 + 连带撤销的轮次数 + 任务记录不删。
  // 三件事缺一就是"不可撤销操作只讲了一半":用户以为只回退 N 个文件,实际连后面
  // 若干轮对话的上下文一起没了。turnCount <= 1 = 没有涟漪,走单轮文案(不虚报轮数)。
  const confirmText =
    turnCount !== null && turnCount > 1
      ? t('turnChanges.revertConfirmWithTurns', { count: changes.length, turns: turnCount })
      : t('turnChanges.revertConfirm', { count: changes.length })

  return (
    <div className="min-w-0" data-testid={`turn-changes-${message.id}`}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger
          className={cn(
            STREAM_ROW_CLASS,
            'gap-1.5 rounded-sm px-1 text-left transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none',
          )}
          data-testid={`turn-changes-trigger-${message.id}`}
        >
          <StreamStatusIcon status="success" />
          <span className="min-w-0 flex-1 truncate text-foreground/80">
            {t('turnChanges.title')}
          </span>
          <StreamTag tone="neutral" strong testId="turn-changes-file-count">
            {tStatus('filesChanged', { n: summary.files })}
          </StreamTag>
          <StreamDelta
            added={summary.linesKnown ? summary.added : -1}
            removed={summary.linesKnown ? summary.removed : -1}
          />
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-transform',
              open && 'rotate-180',
            )}
            aria-hidden
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-0.5">
            {changes.map((c) => {
              const action = actionKeys.get(normalizePath(c.path)) ?? 'changedFile'
              const rowTitle = actionText[action]
              return (
                <div key={c.path}>
                  <StreamRow
                    status="success"
                    title={rowTitle}
                    subject={c.name}
                    subjectKind="path"
                    added={c.added}
                    removed={c.removed}
                    onClick={() => setExpanded((prev) => (prev === c.path ? null : c.path))}
                    expanded={expanded === c.path}
                    ariaLabel={c.path}
                    testId={`turn-change-row-${c.name}`}
                  />
                  {expanded === c.path && (
                    <StreamDetail
                      className="animate-in fade-in-0 slide-in-from-top-1 duration-150"
                      testId={`turn-change-path-${c.name}`}
                    >
                      <StreamCode text={c.path} />
                    </StreamDetail>
                  )}
                </div>
              )
            })}
            <div className="pt-1">
              <Button
                size="sm"
                variant="outline"
                disabled={hasCheckpoint === false || restoring}
                onClick={() => setConfirmOpen(true)}
                data-testid={`turn-revert-${message.id}`}
                className="w-full"
              >
                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                {hasCheckpoint === false ? t('turnChanges.noCheckpoints') : t('turnChanges.revert')}
              </Button>
              {/* 2026-10-29:检查点已按保留期清理时,补一句"为什么"+"什么还留着"。
                  只在判据可证(expiryVerdict === 'expired')时出现;未过期/判不准一律不渲染,
                  不允许这条说明常驻 —— 常驻等于把原因说给了没事发生的用户。 */}
              {expiryVerdict === 'expired' && (
                <p
                  className="mt-1 text-[11px] leading-snug text-muted-foreground"
                  data-testid={`turn-expired-note-${message.id}`}
                >
                  {t('turnChanges.expiredNote', { hours: retentionHours() })}
                </p>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('turnChanges.revert')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground" data-testid="turn-revert-confirm-text">
            {confirmText}
          </p>
          <div className="flex items-center justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setConfirmOpen(false)}>
              {t('cancel')}
            </Button>
            <Button size="sm" onClick={() => void handleConfirmRevert()} disabled={restoring}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              {t('turnChanges.revert')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default TurnChangesCard
