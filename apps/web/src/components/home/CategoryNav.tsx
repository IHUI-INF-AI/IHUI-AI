'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ChevronRight } from 'lucide-react'

interface NavItem {
  titleKey: string
  englishKey: string
  href: string
}

const NAV_ITEMS: NavItem[] = [
  { titleKey: 'courses', englishKey: 'coursesEn', href: '/learn' },
  { titleKey: 'live', englishKey: 'liveEn', href: '/live' },
  { titleKey: 'exam', englishKey: 'examEn', href: '/exam' },
  { titleKey: 'news', englishKey: 'newsEn', href: '/news' },
  { titleKey: 'article', englishKey: 'articleEn', href: '/articles' },
  { titleKey: 'ask', englishKey: 'askEn', href: '/asks' },
  { titleKey: 'community', englishKey: 'communityEn', href: '/circles' },
  { titleKey: 'knowledge', englishKey: 'knowledgeEn', href: '/resources' },
]

export function CategoryNav() {
  const t = useTranslations('home.modules')
  return (
    <nav className="w-full shrink-0 border-b border-r-0 md:w-[260px] md:border-r md:border-b-0">
      <ul className="py-2">
        {NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="group flex items-center px-5 py-2.5 transition-colors hover:bg-primary/5"
            >
              <span className="text-sm font-medium text-foreground group-hover:text-primary">
                {t(item.titleKey)}
              </span>
              <span className="ml-2 truncate text-xs text-muted-foreground/60">
                {t(item.englishKey)}
              </span>
              <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground/30 transition-colors group-hover:text-primary" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
