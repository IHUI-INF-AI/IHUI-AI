// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// D96 对话内写作块(G-129) —— 对话流内渲染件。
//
// **数据面纪律**:本卡**不取数**。`state` 由调用方从既有的流内文本块通道传入;
// 状态迁移一律走 `@ihui/shared/chat/writing-block` 的 `applyWritingBlockAction` /
// `acceptAllRejection` / `canAccept` / `canRevert` —— 与 extension / miniapp-taro /
// mobile-rn / cli **同源**,不得各建一套判定。
//
// **编辑栈纪律(D96 明文)**:版本能力**复用既有 canvas 栈**
// (`apps/web/src/stores/canvas-store.ts` 的 `versions`,与 `ArtifactCanvas` 的
// 「应用并刷新预览」是同一个 `pushVersion`)—— 本组件**不新造编辑器状态机**,
// 也不持有版本历史。刻意**不调用 `setContent`**:写作块不是当前画布内容,
// 写进去会覆盖用户在画布中打开的其它产物。
//
// 三动作语义(逐条对齐判定层):
//   accept      逐块接受(定稿文本记入 canvas 版本栈)
//   acceptAll   整批接受 —— 存在 `failed` 块时**按钮直接禁用**(判定层另有硬拒绝兜底)
//   revert      逐块撤销 —— 回到 accepted 前的原文(原文由判定层的 `original` 保留)
//
// 「打开方式」应用选择器取 `OPEN_IN_APPS`(文案形态「使用默认电子邮箱应用打开电子邮件」)。

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { useCanvasStore } from '@/stores/canvas-store'
import {
  OPEN_IN_APPS,
  WRITING_BLOCK_ACTIONS,
  acceptAllRejection,
  canAccept,
  canAcceptAll,
  canRevert,
  writingBlockPhaseOf,
  type OpenInApp,
  type WritingBlockAction,
  type WritingBlockPhase,
  type WritingBlockState,
  type WritingBlockStatus,
} from '@ihui/shared/chat/writing-block'

export interface WritingBlockCardProps {
  /** 对话流内的一批写作块(「全部接受」的作用域);空批渲染空态 */
  state: WritingBlockState
  /** 动作回调。**状态数据面在调用方**,本卡只负责触发;不传则不渲染动作按钮 */
  onAction?: (action: WritingBlockAction, blockId?: string) => void
  /** 文本编辑回调。不传则文本只读展示(受控:草稿由调用方持有) */
  onDraftChange?: (blockId: string, draft: string) => void
  /** 各动作最新相位(由调用方按异步结果写入);缺省不渲染相位行 */
  actionPhase?: Partial<Record<WritingBlockAction, WritingBlockPhase>>
  /** 打开方式候选应用;缺省取判定层的 OPEN_IN_APPS */
  openInApps?: readonly OpenInApp[]
  /** 选中打开方式;数据面(真的去调用外部应用)在调用方 */
  onOpenIn?: (appId: OpenInApp) => void
  className?: string
  'data-testid'?: string
}

const actionButtonClass =
  'rounded-sm bg-muted/50 px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40'

export function WritingBlockCard({
  state,
  onAction,
  onDraftChange,
  actionPhase,
  openInApps = OPEN_IN_APPS,
  onOpenIn,
  className,
  'data-testid': testId,
}: WritingBlockCardProps) {
  const t = useTranslations('ai.pane.writingBlock')
  const pushVersion = useCanvasStore((s) => s.pushVersion)

  const [openIn, setOpenIn] = React.useState<OpenInApp>(openInApps[0] ?? OPEN_IN_APPS[0])
  const blocks = state.blocks

  // 键一律写成**静态字面量**(next-intl 类型检查可过),只此一处映射;
  // 键名与 @ihui/shared/chat/writing-block 的 statusKey / actionKey / phaseKey / openInLabel 一致。
  const statusLabel: Record<WritingBlockStatus, string> = {
    idle: t('status.idle'),
    editing: t('status.editing'),
    accepted: t('status.accepted'),
    reverted: t('status.reverted'),
    failed: t('status.failed'),
  }
  const actionLabel: Record<WritingBlockAction, string> = {
    accept: t('action.accept'),
    acceptAll: t('action.acceptAll'),
    revert: t('action.revert'),
  }
  const phaseLabel: Record<WritingBlockAction, Record<WritingBlockPhase, string>> = {
    accept: {
      inProgress: t('phase.accept.inProgress'),
      completed: t('phase.accept.completed'),
      failed: t('phase.accept.failed'),
    },
    acceptAll: {
      inProgress: t('phase.acceptAll.inProgress'),
      completed: t('phase.acceptAll.completed'),
      failed: t('phase.acceptAll.failed'),
    },
    revert: {
      inProgress: t('phase.revert.inProgress'),
      completed: t('phase.revert.completed'),
      failed: t('phase.revert.failed'),
    },
  }
  const openInText: Record<OpenInApp, string> = {
    email: t('openIn.email'),
    browser: t('openIn.browser'),
  }

  const rejection = acceptAllRejection(state)
  const acceptAllEnabled = onAction !== undefined && canAcceptAll(state)

  // 三动作统一出口:先把结果文本记入**既有 canvas 版本栈**,再交给调用方改块状态
  // (与 ArtifactCanvas 的 pushVersion 同栈;不调 setContent,见文件头「编辑栈纪律」)
  const fire = React.useCallback(
    (action: WritingBlockAction, blockId?: string) => {
      if (action === 'acceptAll') {
        if (!canAcceptAll(state)) return
        for (const block of state.blocks) pushVersion(block.draft, actionLabel.acceptAll)
      } else {
        const target = blockId === undefined ? blocks[0] : blocks.find((b) => b.id === blockId)
        if (!target) return
        if (action === 'accept') {
          if (!canAccept(target)) return
          pushVersion(target.draft, actionLabel.accept)
        } else {
          if (!canRevert(target)) return
          pushVersion(target.original, actionLabel.revert)
        }
      }
      onAction?.(action, blockId)
    },
    [actionLabel.accept, actionLabel.acceptAll, actionLabel.revert, blocks, onAction, pushVersion, state],
  )

  const handleOpenInChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const app = e.target.value as OpenInApp
    setOpenIn(app)
    onOpenIn?.(app)
  }

  return (
    <div
      className={cn('flex flex-col gap-2 rounded-md bg-muted/30 p-3', className)}
      data-testid={testId}
      data-writing-block-root=""
      data-block-count={blocks.length}
      aria-label={t('ariaLabel')}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-foreground" data-writing-block-title="">
          {t('title')}
        </span>
        {onAction ? (
          <button
            type="button"
            onClick={() => fire('acceptAll')}
            disabled={!acceptAllEnabled}
            data-block-action="acceptAll"
            data-accept-all-reject={rejection ?? 'none'}
            className={actionButtonClass}
          >
            {actionLabel.acceptAll}
          </button>
        ) : null}
      </div>

      {blocks.length === 0 ? (
        <div className="text-[11px] text-muted-foreground" data-writing-block-empty="">
          {t('empty')}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {blocks.map((block) => (
            <li
              key={block.id}
              className="flex flex-col gap-1 rounded-sm border border-border/30 bg-card/50 p-2"
              data-writing-block={block.id}
              data-block-status={block.status}
              data-block-phase={writingBlockPhaseOf(block.status) ?? 'none'}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="text-[11px] text-muted-foreground"
                  data-block-status-label={block.status}
                >
                  {statusLabel[block.status]}
                </span>
                {block.status === 'failed' ? (
                  <span className="text-[11px] text-destructive" data-block-error="failed">
                    {statusLabel.failed}
                  </span>
                ) : null}
              </div>

              <textarea
                value={block.draft}
                onChange={(e) => onDraftChange?.(block.id, e.target.value)}
                readOnly={onDraftChange === undefined}
                spellCheck={false}
                aria-label={statusLabel[block.status]}
                data-block-draft={block.id}
                className="min-h-[48px] w-full resize-none rounded-sm bg-muted/40 p-1.5 text-[11px] leading-4 outline-none"
              />

              {onAction ? (
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onClick={() => fire('accept', block.id)}
                    disabled={!canAccept(block)}
                    data-block-action="accept"
                    data-block-action-for={block.id}
                    className={actionButtonClass}
                  >
                    {actionLabel.accept}
                  </button>
                  <button
                    type="button"
                    onClick={() => fire('revert', block.id)}
                    disabled={!canRevert(block)}
                    data-block-action="revert"
                    data-block-action-for={block.id}
                    className={actionButtonClass}
                  >
                    {actionLabel.revert}
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {WRITING_BLOCK_ACTIONS.map((action) => {
        const phase = actionPhase?.[action]
        if (!phase) return null
        return (
          <span
            key={action}
            className="text-[11px] text-muted-foreground"
            data-action-phase={`${action}:${phase}`}
          >
            {phaseLabel[action][phase]}
          </span>
        )
      })}

      <div className="flex items-center gap-1.5">
        <span className="text-[11px] text-muted-foreground" data-open-in-label="">
          {t('openIn.label')}
        </span>
        <select
          value={openIn}
          onChange={handleOpenInChange}
          aria-label={t('openIn.label')}
          data-open-in-select=""
          className="rounded-sm bg-muted/40 px-1 py-0.5 text-[11px] text-foreground outline-none"
        >
          {openInApps.map((app) => (
            <option key={app} value={app} data-open-in={app}>
              {openInText[app]}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
