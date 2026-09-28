// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

'use client'

import { ToolHeader, NotAvailableAlert } from '../_components/shared'

export default function PdfConvertPage() {
  return (
    <div className="px-4 py-4 mx-auto w-full max-w-3xl space-y-4">
      <ToolHeader title="PDF 转换" description="PDF 与 Word / Excel / 图片 之间相互转换" />
      <NotAvailableAlert />
    </div>
  )
}
