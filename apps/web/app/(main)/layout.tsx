import * as React from 'react'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { MainShell } from '@/components/layout/MainShell'

export const metadata: Metadata = {
  title: { default: '工作区', template: '%s | IHUI AI' },
  description: 'IHUI AI 工作区 — AI 对话、内容创作、教育学习与社区互动',
}

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('common')
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-popover focus:rounded focus:bg-background focus:px-4 focus:py-2 focus:shadow"
      >
        {t('skipToMain')}
      </a>
      <MainShell>{children}</MainShell>
    </>
  )
}
