'use client'

import * as React from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'

export type GenerationStatus = 'idle' | 'loading' | 'success' | 'error'

export interface GenerationResult<T = unknown> {
  status: GenerationStatus
  data?: T
  error?: string
}

/** 通用生成态 hook */
export function useGeneration<T = unknown>() {
  const [result, setResult] = React.useState<GenerationResult<T>>({ status: 'idle' })

  const start = React.useCallback(async (fn: () => Promise<T>) => {
    setResult({ status: 'loading' })
    try {
      const data = await fn()
      setResult({ status: 'success', data })
      return data
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      setResult({ status: 'error', error })
      // 2026-08-02 P2 修复：调用方均以 fire-and-forget 方式调用 start(无 await/catch)，
      // re-throw 会产生 UnhandledPromiseRejection；UI 状态已正确设置，无需抛出
      return undefined
    }
  }, [])

  const reset = React.useCallback(() => setResult({ status: 'idle' }), [])

  return { result, start, reset }
}

interface GenerationFrameProps {
  title: string
  icon?: React.ReactNode
  status: GenerationStatus
  error?: string
  onGenerate: () => void
  canGenerate?: boolean
  generateLabel?: string
  children?: React.ReactNode
  result?: React.ReactNode
  /** 额外的参数控件（渲染在生成按钮上方） */
  options?: React.ReactNode
}

/**
 * GenerationFrame - 生成器通用骨架
 * 统一标题/输入/生成按钮/结果区/错误提示
 */
export function GenerationFrame({
  title,
  icon,
  status,
  error,
  onGenerate,
  canGenerate = true,
  generateLabel,
  children,
  result,
  options,
}: GenerationFrameProps) {
  const t = useTranslations('aiGeneration')
  const isLoading = status === 'loading'
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          {icon ?? <Sparkles className="h-4 w-4 text-primary" />}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {children}
        {options}
        <Button
          onClick={onGenerate}
          disabled={isLoading || !canGenerate}
          size="sm"
          aria-busy={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {isLoading ? t('generating') : (generateLabel ?? t('generate'))}
        </Button>
        {status === 'error' && error && (
          <div
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive"
          >
            {error}
          </div>
        )}
        {result && <div className={cn('rounded-md border p-3')}>{result}</div>}
      </CardContent>
    </Card>
  )
}

/** 通用 prompt 输入 */
export function PromptInput({
  value,
  onChange,
  placeholder,
  rows = 3,
  'aria-label': ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  'aria-label'?: string
}) {
  const t = useTranslations('aiGeneration')
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? t('defaultPromptPlaceholder')}
      rows={rows}
      aria-label={ariaLabel ?? t('promptAriaLabel')}
      className="w-full resize-none rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
    />
  )
}

/** 通用选项选择器 */
export function OptionSelect<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (v: T) => void
  options: ReadonlyArray<{ value: T; label: string }>
}) {
  // 用 React.useId 生成稳定 id,关联 <span> label 与 <select>(a11y)
  const labelId = React.useId()
  return (
    <div className="flex items-center gap-2">
      <span id={labelId} className="text-xs text-muted-foreground">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        aria-labelledby={labelId}
        className="h-8 rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
