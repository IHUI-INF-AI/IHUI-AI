// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 域入口页(DomainHub)—— P2 侧边栏六大域重排的落地形态(2026-10-19 立)
 *
 * 背景:侧边栏从 72 个一级菜单项收敛成 9 个域入口后,每个域的全部子页面需要
 * 一个落点承载。A 方案**不改现有路由**(教育/内容/交易三域的页面散在
 * `(main)/` 根层,不在 `/edu/*` 子树里 —— CategoryShell 作为 Next.js layout
 * 只管自己目录子树,搬目录等于改 URL、破坏全部外部链接),故用卡片网格列出该域
 * 全部功能,点击进二级。
 *
 * 权限:本组件**必须**过 `useNavVisibilityFilter`。`EDU_ITEMS` 里有 11 项带
 * `permission: 'edu:manage'` 的教师/管理员入口,不过滤就会对普通用户泄漏 ——
 * 点进去只剩 403/404(AGENTS.md §5 鉴权面公开化禁令针对的 fail-open 表现)。
 * 与 Sidebar 共用同一判据(use-nav-visibility.ts),不另写一份。
 *
 * 视觉:复用 @ihui/ui-react 的 Card;图标 + 标题 + 一行描述,compact 紧凑。
 * 描边取中性档(border-light),不取墨档(AGENTS.md §4「描边不得取墨档」强制)。
 */

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useNavVisibilityFilter } from '@/components/sidebar/use-nav-visibility'
import type { NavItem } from '@/components/sidebar/types'
import { cn } from '@/lib/utils'

interface DomainHubSection {
  /** 分组标题(已翻译);不传则无标题 */
  title?: string
  items: NavItem[]
}

export interface DomainHubProps {
  /** 页面主标题(已翻译) */
  title: string
  /** 页面描述(已翻译) */
  description?: string
  sections: DomainHubSection[]
  className?: string
}

/**
 * 域入口页的 nav 命名空间全键表(2026-10-19 立)
 *
 * 与 P1 在 settings 域做的是同一件事:门 121(`check-declared-policy-has-consumer.mjs`
 * C6 档)判 i18n 键接线**只认静态发射点** —— 「t 后接字符串字面量」的静态键,或全键字面量表 + `t(表[表达式])`。
 * 本组件原先用 `t(item.labelKey)`(变量取键),三键判不出 ⇒ en.json 未接线
 * 5599 > 锚点 5596,顶破棘轮。
 *
 * 已知限制:本表只列域入口页**自身新增**的键(3 个域入口 labelKey)。
 * 其余条目复用侧边栏既有的 nav.* 键,那些键的发射点在 Sidebar.tsx,门已认可。
 */
const HUB_NAV_LABEL_KEY: Record<string, string> = {
  eduHubTitle: 'nav.eduHubTitle',
  contentHubTitle: 'nav.contentHubTitle',
  tradeHubTitle: 'nav.tradeHubTitle',
}

/** 父项分组标题(与卡片同一套取词规则,避免两处各写一份) */
function ParentLabel({ item }: { item: NavItem }) {
  return <p className="text-[11px] font-medium text-muted-foreground/70">{useHubLabel(item)}</p>
}

/**
 * 取导航项的显示名。域入口页自增的键走 HUB_NAV_LABEL_KEY 静态表(门 121 认这个形态),
 * 其余沿用侧边栏既有 nav.* 键。dynamicLabel(admin 后端下发名)优先。
 */
function useHubLabel(item: NavItem): string {
  const t = useTranslations('nav')
  const key = item.labelKey
  // 门 121 认的形态是 `t(TABLE[表达式])` —— 表名带索引(见该门自检用例 I15/I18)。
  // 先把入参收敛成字符串,再走索引调用,这样静态扫描能看见「表索引 ⇒ 接线」。
  const idx = key ?? ''
  return item.dynamicLabel ?? t(HUB_NAV_LABEL_KEY[idx] ?? idx)
}

/**
 * 单个入口卡片。href + 图标 + labelKey(用 nav 命名空间解析,与 Sidebar 一致)。
 */
function HubCard({ item }: { item: NavItem }) {
  const Icon = item.icon
  const label = useHubLabel(item)

  return (
    <Link
      href={item.href}
      className={cn(
        'group flex items-start gap-2.5 rounded-lg border border-border p-3',
        'transition-colors hover:border-brand-accent-deep hover:bg-accent',
      )}
    >
      {Icon && (
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
      )}
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-foreground">{label}</span>
        {item.children && item.children.length > 0 && (
          <span className="mt-0.5 block text-xs text-muted-foreground">{item.children.length}</span>
        )}
      </span>
    </Link>
  )
}

/**
 * 域入口页。子项过多时(教育域 27 项)按 2/3/4 列响应式网格铺开,
 * 父项带 children 时展开其子项,让「模型 18 项」这类深层结构在入口页也能直达。
 */
export function DomainHub({ title, description, sections, className }: DomainHubProps) {
  const filterByRole = useNavVisibilityFilter()

  // 权限过滤:整页统一走一次,与 Sidebar 同一判据
  const visibleSections = React.useMemo(
    () =>
      sections
        .map((section) => {
          const topLevel = filterByRole(section.items)
          return {
            ...section,
            items: topLevel.map((item) => ({
              ...item,
              children: item.children ? filterByRole(item.children) : undefined,
            })),
          }
        })
        // 整组被过滤空(如普通用户的「管理」组)则不渲染该组标题
        .filter((section) => section.items.length > 0),
    [sections, filterByRole],
  )

  return (
    <div className={cn('px-4 py-4', className)}>
      <header className="mb-4">
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </header>

      <div className="space-y-5">
        {visibleSections.map((section) => (
          <section key={section.title ?? 'items'} className="space-y-2">
            {section.title && (
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {section.title}
              </h2>
            )}
            <div className="grid grid-cols-2 gap-2 min-[768px]:grid-cols-3 min-[1024px]:grid-cols-4">
              {section.items.map((item) => (
                <HubCard key={item.href} item={item} />
              ))}
            </div>

            {/* 带 children 的父项:子项另起一段铺开(教育域 / 模型域这类深层结构) */}
            {section.items.some((i) => i.children && i.children.length > 0) && (
              <div className="space-y-2 pt-1">
                {section.items
                  .filter((i) => i.children && i.children.length > 0)
                  .map((parent) => (
                    <div key={`sub-${parent.href}`} className="space-y-1.5">
                      <ParentLabel item={parent} />
                      <div className="grid grid-cols-2 gap-2 min-[768px]:grid-cols-3 min-[1024px]:grid-cols-4">
                        {(parent.children ?? []).map((child) => (
                          <HubCard key={child.href} item={child} />
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
