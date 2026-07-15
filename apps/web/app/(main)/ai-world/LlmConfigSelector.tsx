'use client'

import * as React from 'react'
import { Cpu, Loader2, Settings } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ihui/ui'
import { fetchConfigs } from '../settings/llm/helpers'
import type { UserLlmConfig } from '../settings/llm/types'
import { useAuthStore } from '@/stores/auth'

export interface SelectedLlmConfig {
  id: number
  name: string
  modelId: string
  providerCode: string
}

interface LlmConfigSelectorProps {
  value: string | null
  onChange: (config: SelectedLlmConfig | null) => void
  disabled?: boolean
}

const DEFAULT_VALUE = '__default__'

/**
 * /ai-world 页面的模型选择器:从用户 LLM 配置中挑选要使用的模型。
 * 未登录或无配置时,显示降级提示 + 配置入口。
 */
export function LlmConfigSelector({ value, onChange, disabled }: LlmConfigSelectorProps) {
  const t = useTranslations('common.aiWorld')
  const isAuthenticated = useAuthStore((s) => !!s.token)

  const { data, isLoading } = useQuery({
    queryKey: ['user-llm-configs', 'selector'],
    queryFn: () => fetchConfigs(),
    enabled: isAuthenticated,
    staleTime: 30_000,
  })

  const list: UserLlmConfig[] = data?.list ?? []
  const enabledList = list.filter((c: UserLlmConfig) => c.enabled)

  // 当 value 不在 list 中(配置被删)时,重置为默认
  React.useEffect(() => {
    if (!value || !enabledList.some((c: UserLlmConfig) => String(c.id) === value)) {
      if (enabledList.length > 0) {
        const first = enabledList[0]
        if (first) {
          const id = first.modelIdForTest ?? ''
          const fullModel = id && first.providerCode ? `${first.providerCode}/${id}` : id
          onChange({
            id: first.id,
            name: first.name,
            modelId: fullModel,
            providerCode: first.providerCode,
          })
        }
      } else {
        onChange(null)
      }
    }
  }, [enabledList, value, onChange])

  if (!isAuthenticated) return null

  if (isLoading) {
    return (
      <div className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-card px-2.5 text-sm text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span className="hidden sm:inline">{t('modelSelectorLoading')}</span>
      </div>
    )
  }

  if (enabledList.length === 0) {
    return (
      <Link
        href="/settings/llm"
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-dashed bg-card px-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Settings className="h-3.5 w-3.5" />
        <span>{t('modelSelectorEmpty')}</span>
      </Link>
    )
  }

  const current = enabledList.find((c: UserLlmConfig) => String(c.id) === value)
  const display = current
    ? `${current.name} · ${current.modelIdForTest ?? ''}`
    : t('modelSelectorPlaceholder')

  return (
    <Select
      value={value ?? DEFAULT_VALUE}
      onValueChange={(v) => {
        const c = enabledList.find((c: UserLlmConfig) => String(c.id) === v)
        if (!c) return
        onChange({
          id: c.id,
          name: c.name,
          modelId: c.modelIdForTest ?? '',
          providerCode: c.providerCode,
        })
      }}
      disabled={disabled}
    >
      <SelectTrigger
        aria-label={t('modelSelectorLabel')}
        className="h-9 w-auto min-w-[12rem] gap-1.5 border bg-card px-2.5 text-sm"
      >
        <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
        <SelectValue placeholder={t('modelSelectorPlaceholder')}>{display}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {enabledList.map((c: UserLlmConfig) => (
          <SelectItem key={c.id} value={String(c.id)} className="text-sm">
            <span className="flex flex-col">
              <span className="font-medium">{c.name}</span>
              <span className="text-xs text-muted-foreground">
                {c.providerCode} · {c.modelIdForTest ?? '—'}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
