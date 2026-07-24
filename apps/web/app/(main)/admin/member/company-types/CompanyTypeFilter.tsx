'use client'

import Link from 'next/link'
import { Plus, ChevronLeft } from 'lucide-react'
import { Button } from '@ihui/ui-react'

interface Props {
  onCreate: () => void
}

export function CompanyTypeFilter({ onCreate }: Props) {
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">公司类型管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">管理会员公司的分类类型</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/member/companies">
            <ChevronLeft className="h-4 w-4" />
            返回公司列表
          </Link>
        </Button>
        <Button onClick={onCreate} size="sm" className="ml-auto">
          <Plus className="h-4 w-4" />
          新建类型
        </Button>
      </div>
    </>
  )
}
