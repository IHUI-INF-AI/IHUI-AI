import * as React from 'react'
import { getTranslations } from 'next-intl/server'
import { MainShell } from '@/components/layout/MainShell'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('common')
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-background focus:px-4 focus:py-2 focus:shadow"
      >
        {t('skipToMain')}
      </a>
      <MainShell>{children}</MainShell>
    </>
  )
}
