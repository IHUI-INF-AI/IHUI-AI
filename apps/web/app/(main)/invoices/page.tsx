// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

import type { Metadata } from 'next'
import { Suspense } from 'react'
import PageClient from './PageClient'

// 发票独立路由页:server 壳(Suspense 边界 + metadata)
export const metadata: Metadata = {
  title: '发票管理',
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PageClient />
    </Suspense>
  )
}
