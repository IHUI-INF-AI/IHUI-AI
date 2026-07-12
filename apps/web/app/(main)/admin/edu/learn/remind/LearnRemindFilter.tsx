'use client'

import Link from 'next/link'
import { Plus, ChevronLeft } from 'lucide-react'
import { Button } from '@ihui/ui'

interface Props {
  onCreate: () => void
}

export function LearnRemindFilter({ onCreate }: Props) {
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">学习提醒</h1>
        <p className="mt-1 text-sm text-muted-foreground">管理学员学习提醒与通知</p>
      </div>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/edu/learn">
            <ChevronLeft className="h-4 w-4" />
            返回学习管理
          </Link>
        </Button>
        <Button onClick={onCreate} size="sm" className="ml-auto">
          <Plus className="h-4 w-4" />
          新建提醒
        </Button>
      </div>
    </>
  )
}
