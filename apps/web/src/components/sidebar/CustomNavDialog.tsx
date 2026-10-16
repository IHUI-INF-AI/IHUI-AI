// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Check, Plus, Search } from 'lucide-react'
import { Modal } from '@/components/feedback/Modal'
import { cn } from '@/lib/utils'
import { flattenNavItems } from './nav-data'
import type { NavItem } from './types'

interface CustomNavDialogProps {
  open: boolean
  onClose: () => void
  /** 已过滤、可显示的导航分组(来自 Sidebar 的 visibleGroups) */
  groups: { label: string; items: NavItem[] }[]
  /** 当前已收藏的 href 集合 */
  customHrefs: string[]
  onAdd: (href: string) => void
  onRemove: (href: string) => void
}

interface Candidate {
  href: string
  labelKey: string
  icon: NavItem['icon']
  dynamicLabel?: string
  groupLabel: string
}

/**
 * 自定义功能键添加面板(2026-10-16 立)
 *
 * 从当前用户可见的全部侧边栏导航项中搜索并勾选,添加为「自定义」栏的快捷入口。
 * 候选列表直接复用 Sidebar 已过滤的 visibleGroups(已按角色/RBAC 过滤),
 * 保证用户只能添加自己看得到的入口,且图标/文案与侧边栏一致。
 */
export function CustomNavDialog({
  open,
  onClose,
  groups,
  customHrefs,
  onAdd,
  onRemove,
}: CustomNavDialogProps) {
  const t = useTranslations('nav')
  const [query, setQuery] = React.useState('')

  // 退出时清空搜索词,避免下次打开残留
  React.useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  // 候选:把每个分组的项(含 children)拍平,附上所属分组名,按 href 去重
  const candidates = React.useMemo<Candidate[]>(() => {
    const map = new Map<string, Candidate>()
    for (const group of groups) {
      const groupLabel = group.label ? t(group.label) : t('home')
      for (const item of flattenNavItems(group.items)) {
        if (map.has(item.href)) continue
        map.set(item.href, {
          href: item.href,
          labelKey: item.labelKey,
          icon: item.icon,
          dynamicLabel: item.dynamicLabel,
          groupLabel,
        })
      }
    }
    return Array.from(map.values())
  }, [groups, t])

  const q = query.trim().toLowerCase()
  const filtered = React.useMemo(() => {
    if (!q) return candidates
    return candidates.filter(
      (c) =>
        (c.dynamicLabel ?? t(c.labelKey)).toLowerCase().includes(q) ||
        c.groupLabel.toLowerCase().includes(q),
    )
  }, [candidates, q, t])

  // 按分组归组,保持分组在原列表中的出现顺序
  const grouped = React.useMemo(() => {
    const order: string[] = []
    const buckets = new Map<string, Candidate[]>()
    for (const c of filtered) {
      if (!buckets.has(c.groupLabel)) {
        buckets.set(c.groupLabel, [])
        order.push(c.groupLabel)
      }
      buckets.get(c.groupLabel)!.push(c)
    }
    return order.map((g) => ({ groupLabel: g, items: buckets.get(g)! }))
  }, [filtered])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('customAddTitle')}
      description={t('customAddDesc')}
      size="lg"
    >
      <div className="flex flex-col gap-3">
        {/* 搜索框 */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('customSearchPlaceholder')}
            className="h-9 w-full rounded-sm border bg-background pl-8 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        {/* 候选列表 */}
        <div className="max-h-[60vh] min-h-[200px] overflow-y-auto pr-1">
          {grouped.length === 0 ? (
            <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground/60">
              {t('customEmptyHint')}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {grouped.map((bucket) => (
                <div key={bucket.groupLabel} className="flex flex-col gap-1">
                  <div className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                    {bucket.groupLabel}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {bucket.items.map((c) => {
                      const Icon = c.icon
                      const label = c.dynamicLabel ?? t(c.labelKey)
                      const added = customHrefs.includes(c.href)
                      return (
                        <button
                          key={c.href}
                          type="button"
                          onClick={() => (added ? onRemove(c.href) : onAdd(c.href))}
                          className={cn(
                            'flex h-9 w-full min-w-0 items-center gap-2.5 rounded-sm px-2.5 text-sm font-medium leading-none transition-colors',
                            'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            added ? 'text-foreground' : 'text-foreground/70',
                          )}
                        >
                          <Icon className="h-5 w-5 shrink-0" />
                          <span className="min-w-0 flex-1 truncate text-left">{label}</span>
                          <span
                            className={cn(
                              'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors',
                              added
                                ? 'bg-cta text-cta-foreground'
                                : 'bg-foreground/10 text-muted-foreground',
                            )}
                            aria-hidden="true"
                          >
                            {added ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                          </span>
                          <span className="sr-only">
                            {added ? t('customRemove') : t('customAdd')}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
