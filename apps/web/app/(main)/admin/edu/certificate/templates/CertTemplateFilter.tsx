// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ChevronLeft, Plus } from 'lucide-react'
import { Button } from '@ihui/ui-react'

interface Props {
  onCreate: () => void
}

export function CertTemplateFilter({ onCreate }: Props) {
  const t = useTranslations('admin.eduCertTemplate')
  return (
    <div className="flex items-center gap-2">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/edu/certificate">
          <ChevronLeft className="h-4 w-4" />
          {t('backToCertificate')}
        </Link>
      </Button>
      <Button onClick={onCreate} size="sm" className="ml-auto">
        <Plus className="h-4 w-4" />
        {t('createTemplate')}
      </Button>
    </div>
  )
}
