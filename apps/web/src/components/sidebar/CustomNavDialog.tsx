// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Check, Plus, Search } from 'lucide-react'
import { Modal } from '@/components/feedback/Modal'
import { cn } from '@/lib/utils'
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
  /** 子功能(与侧边栏一致的第二层);仅父项携带 */
  children?: Candidate[]
}

/**
 * 自定义功能键添加面板(2026-10-16 立;同日二改:平铺改层级浏览)
 *
 * 候选列表直接复用 Sidebar 已过滤的 visibleGroups(已按角色/RBAC 过滤),
 * 保证用户只能添加自己看得到的入口,且图标/文案与侧边栏一致。
 *
 * 【为什么按层级渲染而不是拍平】第一版把所有项 flatten 后按顶级分组归桶,
 * 结果「AI 分组」一个桶下 30+ 项、「管理」一个桶下 80+ 项全平铺,李总实测
 * 反馈"没有分类分组,全都平铺下来很难找"。侧边栏本身是父子两级结构
 * (如 /models 下挂 18 个模型管理子项),弹窗必须保留同样的层级:
 * 浏览态 = 分组头 → 父项行 → 缩进子项行;搜索态才拍平(搜索本身已收窄,
 * 平铺 + 分组桶头足以定位)。
 *
 * 【去重与 children 补挂】同一 href 可能在多个分组出现(如 /models 同时在
 * 「热门」和「AI 分组」):首次出现作为候选;若先出现的是无 children 的
 * 平铺版、后出现带 children,把 children 补挂到已有候选上(渲染层级用),
 * 行本身不重复。子项同样全局去重,保证 React key 唯一。
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
  const tCommon = useTranslations('common')
  const [query, setQuery] = React.useState('')

  // 退出时清空搜索词,避免下次打开残留
  React.useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  // 层级候选:保持 visibleGroups 的分组顺序与父子结构
  const candidates = React.useMemo<Candidate[]>(() => {
    const seen = new Map<string, Candidate>()
    const result: Candidate[] = []
    for (const group of groups) {
      const groupLabel = group.label ? t(group.label) : t('home')
      const toCandidate = (item: NavItem): Candidate => ({
        href: item.href,
        labelKey: item.labelKey,
        icon: item.icon,
        dynamicLabel: item.dynamicLabel,
        groupLabel,
      })
      const walk = (items: NavItem[]) => {
        for (const item of items) {
          const existing = seen.get(item.href)
          if (existing) {
            // 已见过(比如「热门」里的平铺版):补挂 children 供层级渲染
            if (item.children?.length && !existing.children?.length) {
              existing.children = item.children
                .filter((c) => !seen.has(c.href))
                .map((c) => {
                  const cand = toCandidate(c)
                  seen.set(cand.href, cand)
                  return cand
                })
            }
            continue
          }
          const cand = toCandidate(item)
          if (item.children?.length) {
            cand.children = item.children
              .filter((c) => !seen.has(c.href))
              .map((c) => {
                const child = toCandidate(c)
                seen.set(child.href, child)
                return child
              })
          }
          seen.set(cand.href, cand)
          result.push(cand)
        }
      }
      walk(group.items)
    }
    return result
  }, [groups, t])

  // 浏览态:按顶级分组归桶(候选本就按分组顺序生成,同组项天然连续)
  //
  // 分组头不能省:只留父子两级的话,「热门/AI/管理/教育/内容/个人」这些大分组之间
  // 没有分隔,整页又变成一条长列表 —— 那正是上一版被判"平铺"的形状。
  const browseBuckets = React.useMemo(() => {
    const order: string[] = []
    const buckets = new Map<string, Candidate[]>()
    for (const c of candidates) {
      if (!buckets.has(c.groupLabel)) {
        buckets.set(c.groupLabel, [])
        order.push(c.groupLabel)
      }
      buckets.get(c.groupLabel)!.push(c)
    }
    return order.map((g) => ({ groupLabel: g, items: buckets.get(g)! }))
  }, [candidates])

  const q = query.trim().toLowerCase()

  // 搜索态:拍平(含子项),按分组归桶 —— 搜索本身已收窄,平铺够用
  const searchBuckets = React.useMemo(() => {
    const flat: Candidate[] = []
    for (const c of candidates) {
      flat.push(c)
      if (c.children) flat.push(...c.children)
    }
    const matched = flat.filter(
      (c) =>
        (c.dynamicLabel ?? t(c.labelKey)).toLowerCase().includes(q) ||
        c.groupLabel.toLowerCase().includes(q),
    )
    const order: string[] = []
    const buckets = new Map<string, Candidate[]>()
    for (const c of matched) {
      if (!buckets.has(c.groupLabel)) {
        buckets.set(c.groupLabel, [])
        order.push(c.groupLabel)
      }
      buckets.get(c.groupLabel)!.push(c)
    }
    return order.map((g) => ({ groupLabel: g, items: buckets.get(g)! }))
  }, [candidates, q, t])

  const renderItemRow = (c: Candidate, indented: boolean) => {
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
          indented && 'pl-7',
          added ? 'text-foreground' : 'text-foreground/70',
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        <span
          className={cn(
            'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm transition-colors',
            added ? 'bg-cta text-cta-foreground' : 'bg-foreground/10 text-muted-foreground',
          )}
          aria-hidden="true"
        >
          {added ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </span>
        <span className="sr-only">{added ? t('customRemove') : t('customAdd')}</span>
      </button>
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('customAddTitle')}
      size="lg"
      footer={
        // 选择即生效(勾选/取消实时写入,无需"应用"步骤),「确定」只负责收口关窗。
        // 样式对齐项目弹窗主按钮惯例(bg-foreground,见 environment-commit-dialog)。
        <button
          type="button"
          onClick={onClose}
          data-testid="nav-custom-done"
          className="inline-flex h-8 items-center justify-center rounded-md bg-foreground px-4 text-xs font-medium text-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {tCommon('ok')}
        </button>
      }
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
          {q ? (
            // 搜索态:拍平 + 分组桶头
            searchBuckets.length === 0 ? (
              <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground/60">
                {t('customNoResults')}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {searchBuckets.map((bucket) => (
                  <div key={bucket.groupLabel} className="flex flex-col gap-1">
                    <div
                      data-testid={`nav-custom-group-${bucket.groupLabel}`}
                      className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60"
                    >
                      {bucket.groupLabel}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {bucket.items.map((c) => renderItemRow(c, false))}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : // 浏览态:三级结构,与侧边栏心智一致 —— 顶级分组头 → 父项 → 缩进子项
          browseBuckets.length === 0 ? (
            <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground/60">
              {t('customNoResults')}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {browseBuckets.map((bucket) => (
                <div key={bucket.groupLabel} className="flex flex-col gap-1">
                  <div
                    data-testid={`nav-custom-group-${bucket.groupLabel}`}
                    className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60"
                  >
                    {bucket.groupLabel}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {bucket.items.map((c) => (
                      <div key={c.href} className="flex flex-col gap-0.5">
                        {renderItemRow(c, false)}
                        {c.children?.length ? (
                          <div className="flex flex-col gap-0.5">
                            {c.children.map((child) => renderItemRow(child, true))}
                          </div>
                        ) : null}
                      </div>
                    ))}
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
