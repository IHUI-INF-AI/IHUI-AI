'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Layers } from 'lucide-react'
import { BackButton } from '@/components/common'
import { BatchOperations } from './BatchOperations'

export default function AdminSkillBatchPage() {
  const t = useTranslations('admin.skillBatch')

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <BackButton fallbackHref="/admin" />
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Layers className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight">{t('title')}</h1>
        </div>
      </div>
      <BatchOperations />
    </div>
  )
}