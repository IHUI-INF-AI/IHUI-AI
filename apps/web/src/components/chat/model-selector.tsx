'use client'

import * as React from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check, ChevronDown, Cpu } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'

export interface ModelOption {
  value: string
  label: string
  descriptionKey?: string
}

export const MODEL_OPTIONS: ModelOption[] = [
  { value: 'gpt-4o-mini', label: 'GPT-4o mini', descriptionKey: 'modelDescGpt4oMini' },
  { value: 'gpt-4o', label: 'GPT-4o', descriptionKey: 'modelDescGpt4o' },
  {
    value: 'claude-3-5-sonnet',
    label: 'Claude 3.5 Sonnet',
    descriptionKey: 'modelDescClaude35Sonnet',
  },
  {
    value: 'claude-3-5-haiku',
    label: 'Claude 3.5 Haiku',
    descriptionKey: 'modelDescClaude35Haiku',
  },
]

interface ModelSelectorProps {
  value: string
  onChange: (model: string) => void
  disabled?: boolean
  label: string
}

export function ModelSelector({ value, onChange, disabled, label }: ModelSelectorProps) {
  const t = useTranslations('chat')
  const current = MODEL_OPTIONS.find((m) => m.value === value)

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={label}
          className={cn(
            'inline-flex h-9 items-center gap-1.5 rounded-lg border bg-card px-2.5 text-sm font-medium transition-colors',
            'hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-60',
          )}
        >
          <Cpu className="h-4 w-4 text-muted-foreground" />
          <span className="hidden sm:inline">{current?.label ?? value}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-[14rem] overflow-hidden rounded-lg border bg-card p-1 text-card-foreground shadow-md"
        >
          {MODEL_OPTIONS.map((opt) => {
            const active = opt.value === value
            return (
              <DropdownMenu.Item
                key={opt.value}
                onSelect={() => onChange(opt.value)}
                className="flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground"
              >
                <Check className={cn('h-4 w-4 shrink-0', active ? 'opacity-100' : 'opacity-0')} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">{opt.label}</span>
                  {opt.descriptionKey && (
                    <span className="text-xs text-muted-foreground">{t(opt.descriptionKey)}</span>
                  )}
                </div>
              </DropdownMenu.Item>
            )
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

export default ModelSelector
