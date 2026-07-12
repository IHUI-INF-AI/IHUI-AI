'use client'

import Link from 'next/link'
import { ChevronLeft, Plus } from 'lucide-react'
import { Button } from '@ihui/ui'

interface Props {
  onCreate: () => void
}

export function CertTemplateFilter({ onCreate }: Props) {
  return (
    <div className="flex items-center gap-2">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/edu/certificate">
          <ChevronLeft className="h-4 w-4" />
          返回证书管理
        </Link>
      </Button>
      <Button onClick={onCreate} size="sm" className="ml-auto">
        <Plus className="h-4 w-4" />
        新建模板
      </Button>
    </div>
  )
}
