// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

import { Suspense } from 'react'
import PurchasePageClient from './PageClient'

export const metadata = {
  title: '购买 API 订阅与额度',
  description: '一处完成 API 订阅购买与账户充值,查看当前订阅窗口额度与重置时间。',
}

export default function Page() {
  return (
    <Suspense>
      <PurchasePageClient />
    </Suspense>
  )
}
