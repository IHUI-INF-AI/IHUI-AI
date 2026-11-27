// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import Link from 'next/link'
import * as React from 'react'
import { Search } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { DOMAIN_HUB_GROUPS, flattenNavItems, NAV_GROUPS } from '@/components/sidebar/nav-data'
import { useNavVisibilityFilter } from '@/components/sidebar/use-nav-visibility'
import type { NavItem } from '@/components/sidebar/types'

/**
 * 全部功能(2026-11-28 立,入口收敛第二批)
 *
 * 五项主导航之外的旧页都从这里进:按 nav 分组平铺 + 关键词过滤。
 * 可见性完全复用 useNavVisibilityFilter —— 与 Sidebar 同一判据(role + tier),
 * 不另写一套,避免"目录里看得见、点进去 403"的 fail-open 观感。
 */
export default function AllFeaturesPage() {
  const t = useTranslations('nav')
  const filterNav = useNavVisibilityFilter()
  const [q, setQ] = React.useState('')

  const groups = React.useMemo(() => {
    // 域收敛后 NAV_GROUPS 顶层只剩 13 枚域入口,真正的 175 个页面在各域清单里
    // (DOMAIN_HUB_GROUPS)。只列前者,「全部功能」就退化成"域入口目录" ——
    // 用户还得再点一层。这里把两份都展开,并按 href 全局去重(先到先得:
    // 域入口那一份优先,明细里同 href 不再重复出现)。
    const seen = new Set<string>()
    const source: { label: string; items: NavItem[]; suffixKey?: string }[] = [
      ...NAV_GROUPS.map((g) => ({ label: g.label, items: g.items })),
      ...DOMAIN_HUB_GROUPS.map((g) => ({
        label: g.labelKey,
        items: g.items,
        suffixKey: 'domainDetail',
      })),
    ]
    const out: { label: string; items: NavItem[]; suffixKey?: string }[] = []
    for (const g of source) {
      const items = filterNav(g.items).filter((i) => {
        if (seen.has(i.href)) return false
        seen.add(i.href)
        return true
      })
      if (items.length > 0) out.push(g.suffixKey ? { ...g, items } : { label: g.label, items })
    }
    return out
  }, [filterNav])

  const query = q.trim().toLowerCase()

  const filtered = React.useMemo(() => {
    if (!query) return groups
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((i) =>
          `${t(i.labelKey)} ${i.dynamicLabel ?? ''} ${i.href}`.toLowerCase().includes(query),
        ),
      }))
      .filter((g) => g.items.length > 0)
  }, [groups, query, t])

  const total = React.useMemo(
    () => groups.reduce((n, g) => n + flattenNavItems(g.items).length, 0),
    [groups],
  )

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">全部功能</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          共 {total} 个入口。常用的五个在侧栏,其余按分类放这;搜不到就直接回开始页说一句话。
        </p>
        <div className="relative mt-4 max-w-md">
          <Search className="text-muted-foreground pointer-events-none absolute top-2.5 left-3 h-4 w-4" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜功能名或路径,如 素材 / image-gen"
            className="border-border bg-background focus:border-foreground w-full rounded-md border py-2 pr-3 pl-9 text-sm outline-none"
          />
        </div>
      </header>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground py-10 text-sm">
          没有匹配的入口。换个词,或回 /start 直接说你要做什么。
        </p>
      ) : (
        <div className="space-y-8">
          {filtered.map((group) => (
            <section key={group.label}>
              <h2 className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
                {t(group.label)}
                {group.suffixKey ? ` · ${t(group.suffixKey)}` : ''}
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <div key={item.href} className="border-border rounded-lg border p-3">
                      <Link href={item.href} className="group flex items-start gap-2.5">
                        <Icon className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {item.dynamicLabel ?? t(item.labelKey)}
                          </span>
                          <span className="text-muted-foreground block truncate text-xs">
                            {item.href}
                          </span>
                        </span>
                      </Link>
                      {item.children && item.children.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5 pl-7">
                          {item.children.map((child) => (
                            <Link
                              key={child.href}
                              href={child.href}
                              className="bg-muted text-muted-foreground hover:text-foreground rounded px-2 py-0.5 text-xs"
                            >
                              {child.dynamicLabel ?? t(child.labelKey)}
                            </Link>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
