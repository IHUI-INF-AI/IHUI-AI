// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

'use client'
import { useTranslations } from 'next-intl'
import { Plus } from 'lucide-react'
import { Button } from '@ihui/ui-react'

interface Props {
  onCreate: () => void
}

export function AgreementFilter({ onCreate }: Props) {
  const t = useTranslations('admin.agreements')
  const tc = useTranslations('common')
  return (
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
      <Button size="sm" onClick={onCreate}>
        <Plus className="h-4 w-4" />
        {tc('create')}
      </Button>
    </div>
  )
}
