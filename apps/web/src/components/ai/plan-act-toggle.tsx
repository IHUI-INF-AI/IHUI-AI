'use client'

import * as React from 'react'

import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { useChatStore } from '@/stores/chat'

export type PlanActMode = 'plan' | 'act'

/** Plan/Act 模式切换器(对标 Trae Work plan/act toggle + Codex)。
 *
 * 受控用法:`<PlanActToggle mode={m} onChange={setM} />`
 * 非受控(默认):读写 useChatStore.planMode,兼容 `<PlanActToggle />` 旧调用方。
 * - Plan:LLM 只制定计划不调用工具
 * - Act:正常 tool loop 执行(默认)
 */
function safeT(t: (key: string) => string, key: string, fallback: string): string {
  try {
    const v = t(key)
    return v === key ? fallback : v
  } catch {
    return fallback
  }
}

export function PlanActToggle({
  mode,
  onChange,
  className,
}: {
  mode?: PlanActMode
  onChange?: (mode: PlanActMode) => void
  className?: string
}) {
  const storeMode = useChatStore((s) => s.planMode)
  const setStoreMode = useChatStore((s) => s.setPlanMode)
  const current = mode ?? storeMode
  const t = useTranslations('chat')
  const planLabel = safeT(t, 'modePlan', '规划')
  const actLabel = safeT(t, 'modeAct', '执行')

  const select = (m: PlanActMode) => {
    if (onChange) onChange(m)
    if (mode === undefined) setStoreMode(m)
  }

  const btn = (m: PlanActMode, label: string, title: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={current === m}
      onClick={() => select(m)}
      title={title}
      className={cn(
        'inline-flex h-6 items-center rounded-sm px-2 text-xs font-medium transition-all duration-150',
        current === m
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'bg-muted text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </button>
  )

  return (
    <div
      role="radiogroup"
      aria-label="Plan/Act mode"
      className={cn('inline-flex h-7 items-center gap-0.5 rounded-md bg-muted p-0.5', className)}
    >
      {btn('plan', planLabel, 'Plan: AI 只制定计划,不执行工具')}
      {btn('act', actLabel, 'Act: AI 正常执行工具')}
    </div>
  )
}
