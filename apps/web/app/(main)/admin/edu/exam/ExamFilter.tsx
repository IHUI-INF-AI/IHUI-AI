'use client'
import Link from 'next/link'
import { Plus, Search } from 'lucide-react'
import { Button, Input } from '@ihui/ui'

interface Props {
  search: string
  onSearchChange: (v: string) => void
  onCreate: () => void
}

export function ExamFilter({ search, onSearchChange, onCreate }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="搜索试卷标题..."
          className="h-9 pl-8"
        />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/edu/exam/questions">题库管理</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/edu/exam/grades">成绩批阅</Link>
        </Button>
        <Button onClick={onCreate} size="sm">
          <Plus className="h-4 w-4" />
          新建试卷
        </Button>
      </div>
    </div>
  )
}
