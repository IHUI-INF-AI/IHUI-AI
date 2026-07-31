'use client'

import * as React from 'react'
import { File, Table, Code, Folder, Globe, X, type LucideIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { useContextMentionStore } from '@/stores/context-mention'
import type { MentionType } from '@ihui/types'

/** 类型 → 图标映射(chips 用) */
const TYPE_ICON: Record<MentionType, LucideIcon> = {
  file: File,
  database: Table,
  symbol: Code,
  folder: Folder,
  web: Globe,
}

/**
 * 已选提及 chips 面板(显示在输入框上方)。
 *
 * 由 message-input.tsx 集成到输入框上方区域。
 * 每个 chip:类型图标 + label + x 删除按钮,删除时调 store.removeMention。
 */
export function MentionChips() {
  const t = useTranslations('chat')
  const mentions = useContextMentionStore((s) => s.mentions)
  const removeMention = useContextMentionStore((s) => s.removeMention)
  if (mentions.length === 0) return null
  return (
    <div className="mb-2 flex flex-wrap gap-1">
      {mentions.map((m) => {
        const Icon = TYPE_ICON[m.type] ?? File
        return (
          <span
            key={m.id}
            className="inline-flex h-6 items-center gap-1 rounded bg-muted px-2 text-xs text-muted-foreground"
          >
            <Icon className="h-3 w-3 shrink-0" />
            <span className="max-w-[12rem] truncate">{m.label}</span>
            <button
              type="button"
              onClick={() => removeMention(m.id)}
              aria-label={t('mentionPopover.removeLabel', { label: m.label })}
              className="ml-0.5 inline-flex shrink-0 items-center text-muted-foreground/70 hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        )
      })}
    </div>
  )
}
