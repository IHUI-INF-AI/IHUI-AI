// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

'use client'

import { useTranslations } from 'next-intl'
import { DatePicker } from '@/components/form/DatePicker'

interface Props {
  searchBegin: string
  setSearchBegin: (v: string) => void
  searchEnd: string
  setSearchEnd: (v: string) => void
}

export function IdentityProportionFilter({
  searchBegin,
  setSearchBegin,
  searchEnd,
  setSearchEnd,
}: Props) {
  const t = useTranslations('admin.identityProportion')
  return (
    <div className="flex flex-wrap items-center gap-2">
      <DatePicker
        value={searchBegin}
        onChange={(v) => setSearchBegin(v as string)}
        placeholder={t('beginTime')}
      />
      <DatePicker
        value={searchEnd}
        onChange={(v) => setSearchEnd(v as string)}
        placeholder={t('endTime')}
      />
    </div>
  )
}
