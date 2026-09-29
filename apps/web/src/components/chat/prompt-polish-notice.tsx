// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// D82 保稿提示条(2026-09-30 自 message-input.tsx 抽出):InputStatusSlot 单状态槽
// 需要在槽内按优先级挂载本组件,而槽又被 message-input 引用 —— 不抽出会成环。

import * as React from 'react'
import { useTranslations } from 'next-intl'

import {
  canRetry,
  type PolishRejection,
  type PromptPolishState,
} from '@ihui/shared/chat/prompt-polish'

export interface PromptPolishNoticeProps {
  state: PromptPolishState
  onRetry: () => void
}

/** 「此刻有没有保稿提示可显示」的唯一判据:组件空态早退与 InputStatusSlot 激活判定共用。 */
export function isPromptPolishNoticeActive(state: PromptPolishState): boolean {
  return state.rejection !== null || state.phase === 'failed' || state.restartHint
}

/**
 * D82 保稿提示条(无内容时返回 null 零占位)。
 * - 失败:`failureDraftKept`(「暂时无法润色提示词，草稿已保留。」同族)+ 「重试」(`canRetry` 为真才渲染);
 * - 空草稿被拒:`rejection.emptyDraft`;
 * - 需重启生效:`restartHint`(同样强调草稿已保留)。
 */
export function PromptPolishNotice({ state, onRetry }: PromptPolishNoticeProps) {
  const t = useTranslations('ai.pane.promptPolish')
  const rejection: PolishRejection | null = state.rejection
  const failed = state.phase === 'failed'
  if (!isPromptPolishNoticeActive(state)) return null
  return (
    <div
      data-testid="prompt-polish-notice"
      data-polish-phase={state.phase}
      className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300"
    >
      {rejection ? (
        <span data-testid="prompt-polish-empty" data-polish-reject={rejection}>
          {t('rejection.emptyDraft')}
        </span>
      ) : null}
      {failed ? (
        <span data-testid="prompt-polish-failure" data-polish-error={state.error ?? 'none'}>
          {t('failureDraftKept')}
        </span>
      ) : null}
      {state.restartHint ? (
        <span data-testid="prompt-polish-restart">{t('restartHint')}</span>
      ) : null}
      {canRetry(state) ? (
        <button
          type="button"
          data-testid="prompt-polish-retry"
          onClick={onRetry}
          className="shrink-0 rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-[11px] text-amber-800 transition-colors hover:bg-amber-500/25 dark:text-amber-200"
        >
          {t('action.retry')}
        </button>
      ) : null}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
