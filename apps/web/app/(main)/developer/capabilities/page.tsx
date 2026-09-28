// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

import { Suspense } from 'react'
import type { Metadata } from 'next'
import CapabilitiesPageClient from './components/capabilities-page-client'

export const metadata: Metadata = {
  title: '能力目录',
  description: '对外开放能力清单:scope、数据类别、风险档、可申请性与 key 级限流窗口。',
}

export default function DeveloperCapabilitiesPage() {
  return (
    <Suspense fallback={null}>
      <CapabilitiesPageClient />
    </Suspense>
  )
}
