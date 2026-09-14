// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Copy, FolderOpen, Heart, Plus, ScrollText, StickyNote, Trash2 } from 'lucide-react'

import { toast } from '@/components/common'
import { cn } from '@/lib/utils'
import { memoryToYaml, useMemoryStore, type MemoryCategory } from '@/stores/memory'

/**
 * MemoryCards — Typed Memory 记忆卡片(W25,2026-09-14 立,对标 Qoder/CodeBuddy)。
 *
 * 四类记忆(rule/fact/preference/project)的本地管理面板:
 * - 类目 tab 切换 + 类目下条目列表
 * - 输入框添加条目(Enter 提交)
 * - 删除条目 / 复制该类目 YAML(供粘贴到外部规则文件)
 * - 发送链路:正文含 #Rule 时由 expandRuleToken 自动展开规则 YAML
 */

const CATEGORY_ICON: Record<MemoryCategory, React.ComponentType<{ className?: string }>> = {
  rule: ScrollText,
  fact: StickyNote,
  preference: Heart,
  project: FolderOpen,
}

export function MemoryCards() {
  const t = useTranslations('memoryCards')
  const entries = useMemoryStore((s) => s.entries)
  const add = useMemoryStore((s) => s.add)
  const remove = useMemoryStore((s) => s.remove)

  const [active, setActive] = React.useState<MemoryCategory>('rule')
  const [draft, setDraft] = React.useState('')

  const items = React.useMemo(() => entries.filter((e) => e.category === active), [entries, active])

  const handleAdd = () => {
    if (!draft.trim()) return
    add(active, draft)
    setDraft('')
  }

  const handleCopyYaml = async () => {
    const yaml = memoryToYaml(items)
    if (!yaml) return
    try {
      await navigator.clipboard.writeText(yaml)
      toast.success(t('copied'))
    } catch {
      toast.error(t('copyFailed'))
    }
  }

  return (
    <div data-testid="memory-cards" className="space-y-3 text-sm">
      {/* 类目 tab */}
      <div className="flex gap-1" role="tablist" aria-label={t('title')}>
        {(Object.keys(CATEGORY_ICON) as MemoryCategory[]).map((cat) => {
          const Icon = CATEGORY_ICON[cat]
          const count = entries.filter((e) => e.category === cat).length
          return (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={active === cat}
              data-testid={`memory-tab-${cat}`}
              onClick={() => setActive(cat)}
              className={cn(
                'flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors',
                active === cat
                  ? 'bg-accent font-medium text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground',
              )}
            >
              <Icon className="h-3 w-3" />
              {t(cat)}
              {count > 0 && (
                <span className="rounded-md bg-muted px-1 text-[10px] text-muted-foreground">
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* 条目列表 */}
      <div data-testid="memory-list" className="space-y-1.5">
        {items.length === 0 ? (
          <p
            data-testid="memory-empty"
            className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground"
          >
            {t('empty')}
          </p>
        ) : (
          items.map((e, i) => (
            <div
              key={e.id}
              data-testid={`memory-item-${i}`}
              className="flex items-start gap-1.5 rounded-md border px-2 py-1.5 text-xs"
            >
              <span className="min-w-0 flex-1 break-words whitespace-pre-wrap">{e.content}</span>
              <button
                type="button"
                data-testid={`memory-item-remove-${i}`}
                aria-label={t('remove')}
                onClick={() => remove(e.id)}
                className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* 添加输入 */}
      <div className="flex gap-1.5">
        <input
          data-testid="memory-input"
          value={draft}
          onChange={(ev) => setDraft(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter') {
              ev.preventDefault()
              handleAdd()
            }
          }}
          placeholder={t('placeholder')}
          className="min-w-0 flex-1 rounded-md border bg-transparent px-2 py-1 text-xs outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
        />
        <button
          type="button"
          data-testid="memory-add"
          onClick={handleAdd}
          className="flex shrink-0 items-center gap-0.5 rounded-md border px-2 py-1 text-xs transition-colors hover:bg-accent"
        >
          <Plus className="h-3 w-3" />
          {t('add')}
        </button>
      </div>

      {/* 复制该类目 YAML(发送链路 #Rule 展开即用同一序列化) */}
      <button
        type="button"
        data-testid="memory-copy-yaml"
        onClick={() => void handleCopyYaml()}
        disabled={items.length === 0}
        className="flex w-full items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Copy className="h-3 w-3" />
        {t('copyYaml')}
      </button>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
