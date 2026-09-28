// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import PageClient from './PageClient'

export function generateStaticParams() {
  return []
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('sso.mobileAuth')
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
