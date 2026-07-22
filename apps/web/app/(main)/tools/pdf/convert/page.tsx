'use client'

import { ToolHeader, NotAvailableAlert } from '../_components/shared'

export default function PdfConvertPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <ToolHeader title="PDF 转换" description="PDF 与 Word / Excel / 图片 之间相互转换" />
      <NotAvailableAlert />
    </div>
  )
}
