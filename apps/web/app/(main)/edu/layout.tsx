'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  BookOpen,
  FileCheck,
  Award,
  CalendarDays,
  NotebookPen,
  HelpCircle,
  BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/edu/dashboard', label: '学习概览', icon: LayoutDashboard },
  { href: '/edu/courses', label: '我的课程', icon: BookOpen },
  { href: '/edu/exam', label: '在线考试', icon: FileCheck },
  { href: '/edu/certificates', label: '我的证书', icon: Award },
  { href: '/edu/schedule', label: '课程表', icon: CalendarDays },
  { href: '/edu/notes', label: '学习笔记', icon: NotebookPen },
  { href: '/edu/qa', label: '问答中心', icon: HelpCircle },
  { href: '/edu/progress', label: '学习进度', icon: BarChart3 },
]

export default function EduLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <div className="mx-auto flex w-full max-w-7xl gap-6 px-4 py-6">
      <aside className="hidden w-56 shrink-0 lg:block">
        <div className="sticky top-4 space-y-1">
          <div className="mb-4 flex items-center gap-2 px-3">
            <Image
              src="/images/Dlogoedu.svg"
              alt="学习中心"
              width={28}
              height={28}
              className="h-7 w-7 shrink-0"
              loading="eager"
              unoptimized
            />
            <span className="text-lg font-semibold">学习中心</span>
          </div>
          <nav className="space-y-0.5">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive(href)
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="mb-4 flex items-center gap-2 overflow-x-auto lg:hidden">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                isActive(href)
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Link>
          ))}
        </div>
        {children}
      </div>
    </div>
  )
}
