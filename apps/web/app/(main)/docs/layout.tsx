// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CategoryShell, type CategoryNavGroup } from '@/components/layout'
import {
  BookOpen,
  BookMarked,
  Bot,
  Code,
  Cpu,
  Database,
  Rocket,
  Server,
  Users,
  Workflow,
  Wrench,
} from 'lucide-react'

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('docs')
  const pathname = usePathname()
  // 正文**没有**主题 hero H1 的 docs 路由:这些页继续把容器标题当作唯一 H1(保持原状,
  // 不制造「整页无 H1」的新缺陷)。其余页各自带 hero <h1>(= 该页主题),容器标题降级为
  // 非标题元素 ⇒ 每页只有一个 H1(a11y + SEO,2026-11-03 立;视觉零变化)。
  const shellTitledPaths = ['/docs', '/docs/mcp', '/docs/api', '/docs/agent']
  const cleanPath = pathname.replace(/\/+$/, '')
  const shellOwnsHeading = shellTitledPaths.some((p) => cleanPath === p || cleanPath.endsWith(p))
  const navGroups: CategoryNavGroup[] = [
    {
      label: t('navDocs'),
      items: [
        { href: '/docs', label: t('navOverview'), icon: BookOpen },
        { href: '/docs/manual', label: t('navManual'), icon: BookMarked },
        { href: '/docs/quickstart', label: t('navQuickstart'), icon: Rocket },
      ],
    },
    {
      label: t('navTools'),
      items: [
        { href: '/docs/self-host', label: t('navSelfHost'), icon: Server },
        { href: '/docs/agent', label: t('navAgent'), icon: Bot },
        { href: '/docs/rag', label: t('navRag'), icon: Database },
        { href: '/docs/models', label: t('navModels'), icon: Cpu },
        { href: '/docs/mcp', label: t('navMcp'), icon: Wrench },
        { href: '/docs/workflow', label: t('navWorkflow'), icon: Workflow },
      ],
    },
    {
      label: t('navDevelopers'),
      items: [
        { href: '/docs/api', label: t('navApi'), icon: Code },
        { href: '/docs/team', label: t('navTeam'), icon: Users },
      ],
    },
  ]
  return (
    <CategoryShell
      title={t('shellTitle')}
      description={t('shellSubtitle')}
      navGroups={navGroups}
      contentOwnsH1={!shellOwnsHeading}
    >
      {children}
    </CategoryShell>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
