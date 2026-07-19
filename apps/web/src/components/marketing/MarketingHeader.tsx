'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Menu, Sparkles, LogIn, LayoutDashboard } from 'lucide-react'
import { Button } from '@ihui/ui'
import { useAuthStore } from '@/stores/auth'
import { useMounted } from '@/hooks/use-mounted'

const NAV_LINKS = [
  { href: '/enterprise', labelKey: 'navEnterprise' },
  { href: '/learn', labelKey: 'navCourses' },
  { href: '/agents', labelKey: 'navAgents' },
  { href: '/news', labelKey: 'navNews' },
  { href: '/ai-world', labelKey: 'navAiWorld' },
]

/**
 * 营销页顶部 Header
 *
 * 与 (marketing) 路由组的 layout.tsx 配合使用:
 * - sticky 顶部,高度 h-14 (= 3.5rem),与首页全屏滚动 main 的 calc(100vh - 3.5rem) 对齐
 * - 登录态 hydration-safe:首屏按"未登录"渲染,挂载后才显示真实态
 * - 不含 sidebar(营销页不需要侧栏)
 *
 * 注:此组件为 client component(layout 是 Server Component,需拆分)
 */
export function MarketingHeader() {
  const t = useTranslations('marketing')
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const mounted = useMounted()
  const showAuth = mounted ? isAuthenticated : false

  const handleJoin = () => router.push('/support?source=landing')

  return (
    <header className="sticky top-0 z-sticky border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 md:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="text-base font-bold tracking-tight">{t('header.brand')}</span>
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {t(`header.${l.labelKey}`)}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {showAuth ? (
            <Button size="sm" asChild>
              <Link href="/dashboard">
                <LayoutDashboard className="mr-1 h-3.5 w-3.5" />
                {t('header.dashboard')}
              </Link>
            </Button>
          ) : (
            <Button size="sm" asChild>
              <Link href="/sso/login">
                <LogIn className="mr-1 h-3.5 w-3.5" />
                {t('header.login')}
              </Link>
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleJoin}
            className="md:hidden"
            aria-label={t('header.menu')}
          >
            <Menu className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  )
}
