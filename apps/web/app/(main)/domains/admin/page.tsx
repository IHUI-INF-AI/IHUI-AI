// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 管理域入口页(2026-11-16 用户反馈「管理分类没有跟其他分类一样有统一管理落地页」)
 *
 * A 方案与其他五域完全一致:不改任何既有路由 —— admin 的 80+ 页面散在 /admin/*、/members 等,
 * 搬目录等于改 URL。故本页用 DomainHub 卡片网格承载管理域全部功能,侧边栏只留
 * 「管理」一枚入口(/domains/admin),与 /domains/ai、/domains/edu 等同形态。
 *
 * 条目来源 = ADMIN_HUB_ITEMS(侧边栏 adminGroupLabel 分组收敛前的同一份数据,§0.6 单一真相源),
 * 不另抄清单;admin 后端动态路由(useAdminRouters)在本页运行期追加 —— 收敛后
 * Sidebar 不再拉取动态菜单,这里是它唯一的渲染面。去重基准也取自这份清单,
 * 否则后端把同一 href 再下发一次会出现 React key 重复。
 *
 * 档位/角色过滤(adminOnly)由 DomainHub 内的 useNavVisibilityFilter 统一负责;
 * 各管理页与后端 requireAdmin 仍是最终硬闸。标题/副标题取本域自己的键
 * adminHub.title / adminHub.subtitle,与其他五域同族形态;禁止端内硬编码中文(AGENTS §19)。
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { LayoutDashboard, ShieldCheck } from 'lucide-react'
import { DomainHub } from '@/components/layout/DomainHub'
import { ADMIN_HUB_ITEMS, flattenNavItems } from '@/components/sidebar/nav-data'
import type { NavItem } from '@/components/sidebar/types'
import { useAdminRouters } from '@/hooks/use-admin-routers'

export default function AdminHubPage() {
  const t = useTranslations('adminHub')
  const { list: dynamicRouters } = useAdminRouters()

  const items = React.useMemo<NavItem[]>(() => {
    const known = new Set(flattenNavItems(ADMIN_HUB_ITEMS).map((i) => i.href))
    const extra: NavItem[] = dynamicRouters
      .filter((r) => r.visible !== 0 && r.path && !known.has(r.path))
      .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
      .map((r) => ({
        href: r.path,
        labelKey: 'adminDynamic',
        icon: LayoutDashboard,
        adminOnly: true,
        dynamicLabel: r.name,
      }))
    return [...ADMIN_HUB_ITEMS, ...extra]
  }, [dynamicRouters])

  return (
    <DomainHub
      title={t('title')}
      description={t('subtitle')}
      icon={ShieldCheck}
      sections={[{ items }]}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
