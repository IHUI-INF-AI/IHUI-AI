import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import PageClient from './PageClient'

export function generateStaticParams() {
  return []
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('sso.redirect')
  return {
    title: t('title'),
    robots: { index: false, follow: false },
  }
}

export default function Page() {
  return (
    <Suspense>
      <PageClient />
    </Suspense>
  )
}
