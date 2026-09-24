// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// D69 输入区文案族补齐 —— 输入区提示条(G-91/G-92 + D38/D43 规格补强)。
//
// **数据面纪律(同 D72 WorktreeCard)**:本组件**不取数** —— 不读 store、不 fetch、
// 不触碰任何队列状态(与 W27 预备消息优先规则不冲突,判定层只读不写)。
// 压缩不可用上下文与排队上下文全部由调用方注入;判定一律走
// `@ihui/shared/chat/input-notices`,端内不得另建第二套判定。
//
// 两个提示面:
//   · 压缩不可用 —— 因/果成对展示(原因 + 后果是两个键),不得拼成一句含糊话;
//   · 排队 —— 原因标签(为何这条消息在排队)+ 受限原因 + 重排 aria
//     (canReorder 时才挂"拖动调整…"读屏提示,锁定时不误导)。

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import {
  compactionBlockView,
  queueInteractionPerms,
  queueReasonView,
  queueReorderAria,
  resolveCompactionBlockReason,
  type CompactionBlockContext,
  type CompactionBlockReason,
  type QueueInteractionContext,
} from '@ihui/shared/chat/input-notices'

export interface InputNoticeBannerProps {
  /** 压缩不可用原始上下文;缺省 ⇒ 不渲染压缩提示面 */
  compactionCtx?: CompactionBlockContext
  /** 显式指定压缩不可用原因(跳过 resolve;供调用方已有结论时复用) */
  compactionReason?: CompactionBlockReason
  /** 排队原始上下文;缺省 ⇒ 不渲染排队提示面 */
  queueCtx?: QueueInteractionContext
  className?: string
  'data-testid'?: string
}

/**
 * InputNoticeBanner — 输入区上方的压缩/排队提示条(纯展示,2026-09-24 立)。
 */
export function InputNoticeBanner({
  compactionCtx,
  compactionReason,
  queueCtx,
  className,
  'data-testid': testId,
}: InputNoticeBannerProps) {
  const t = useTranslations('ai.pane.inputNotices')

  const blockReason =
    compactionReason ?? (compactionCtx ? resolveCompactionBlockReason(compactionCtx) : null)
  const blockView = blockReason && compactionCtx ? compactionBlockView(blockReason, compactionCtx) : null

  const perms = queueCtx ? queueInteractionPerms(queueCtx) : null
  const reasonView = queueCtx ? queueReasonView(queueCtx) : null

  if (!blockView && !reasonView) return null

  return (
    <div
      role="status"
      className={cn('flex flex-col gap-1 rounded-md bg-muted/30 px-3 py-2 text-xs', className)}
      data-testid={testId}
    >
      {blockView ? (
        <div
          className="flex flex-col gap-0.5"
          data-input-notice-compaction={blockView.reason}
        >
          <span className="font-medium text-amber-600 dark:text-amber-500" data-compaction-cause>
            {t(`compaction.block.${blockView.causeKey}`)}
          </span>
          <span className="text-muted-foreground" data-compaction-consequence>
            {t(`compaction.block.${blockView.consequenceKey}`)}
          </span>
        </div>
      ) : null}

      {reasonView && perms ? (
        <div className="flex flex-col gap-0.5" data-input-notice-queue={reasonView.reason}>
          <span className="font-medium text-muted-foreground" data-queue-reason-title>
            {t('queue.reasonTitle')}
          </span>
          <span className="text-muted-foreground" data-queue-reason={reasonView.reason}>
            {t(`queue.${reasonView.reasonKey}`)}
          </span>
          {/* 重排锁定时给拒绝提示,可重排时挂读屏操作提示(不误导) */}
          {perms.canReorder ? (
            <span
              className="text-[11px] text-muted-foreground/70"
              aria-label={t(`queue.${queueReorderAria()}`)}
              data-queue-reorder-aria={queueReorderAria()}
            >
              {t(`queue.${queueReorderAria()}`)}
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground/70" data-queue-reorder-locked>
              {t(`queue.denied.reorder`)}
            </span>
          )}
          {!perms.canInterject ? (
            <span className="text-[11px] text-muted-foreground/70" data-queue-interject-denied>
              {t('queue.denied.interject')}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default InputNoticeBanner
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
