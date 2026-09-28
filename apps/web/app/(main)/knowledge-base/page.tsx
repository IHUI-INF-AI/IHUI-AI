// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getTranslations } from 'next-intl/server'
import PageClient from './PageClient'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('knowledgeBase')
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: { canonical: '/knowledge-base' },
    openGraph: {
      title: t('metaOgTitle'),
      description: t('metaOgDescription'),
      url: 'https://aizhs.top/knowledge-base',
      type: 'website',
    },
  }
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PageClient />
    </Suspense>
  )
}
