'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Loader2, ChevronLeft, ChevronRight, Award, Search } from 'lucide-react'
import { eduApi, buildQs, selectClass, type PageData } from '@/lib/edu'
import { cn } from '@/lib/utils'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Button, Input, Select, SelectTrigger, SelectContent, SelectItem, SelectValue, Card, CardContent,
} from '@ihui/ui'

interface IssuedCert {
  id: string; certificateNo: string; title: string
  recipientName: string | null; nickname: string | null
  source: string | null; issuedAt: string | null; status: number
  templateName: string | null
}
const PAGE_SIZE = 10
const SOURCE_MAP: Record<string, string> = { manual: '手动', exam: '考试', learn: '学习' }

export default function EduCertificateIssuedPage() {
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [source, setSource] = React.useState('all')

  React.useEffect(() => { const tm = setTimeout(() => { setDebounced(search); setPage(1) }, 300); return () => clearTimeout(tm) }, [search])
  React.useEffect(() => { setPage(1) }, [source])

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'cert', 'issued', debounced, source, page],
    queryFn: () => eduApi<PageData<IssuedCert>>(`/api/admin/certificates${buildQs({ page, pageSize: PAGE_SIZE, search: debounced, status: '1', source: source === 'all' ? '' : source })}`),
  })

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rows = data?.list ?? []
  const bySource = { exam: rows.filter((r) => r.source === 'exam').length, learn: rows.filter((r) => r.source === 'learn').length, manual: rows.filter((r) => r.source === 'manual').length }

  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-bold tracking-tight">已发证书</h1><p className="mt-1 text-sm text-muted-foreground">查看所有已颁发的有效证书</p></div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">已发总数</div><div className="mt-1 text-2xl font-semibold">{total}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">考试来源</div><div className="mt-1 text-2xl font-semibold text-sky-600">{bySource.exam}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">学习来源</div><div className="mt-1 text-2xl font-semibold text-emerald-600">{bySource.learn}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">手动颁发</div><div className="mt-1 text-2xl font-semibold text-amber-600">{bySource.manual}</div></CardContent></Card>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm"><Link href="/admin/edu/certificate"><ChevronLeft className="h-4 w-4" />返回证书管理</Link></Button>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索..." className="h-9 pl-8" />
        </div>
        <div className="w-full max-w-[140px]">
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className={selectClass} aria-label="来源"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">全部来源</SelectItem><SelectItem value="exam">考试</SelectItem><SelectItem value="learn">学习</SelectItem><SelectItem value="manual">手动</SelectItem></SelectContent>
          </Select>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50"><TableRow>
            <TableHead className="px-4 py-2.5">证书编号</TableHead><TableHead className="px-4 py-2.5">标题</TableHead>
            <TableHead className="px-4 py-2.5">获得者</TableHead><TableHead className="px-4 py-2.5">来源</TableHead>
            <TableHead className="px-4 py-2.5">模板</TableHead><TableHead className="px-4 py-2.5">颁发时间</TableHead>
          </TableRow></TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (<TableRow><TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />加载中...</TableCell></TableRow>
            ) : error ? (<TableRow><TableCell colSpan={6} className="px-4 py-10 text-center text-destructive">{(error as Error).message}</TableCell></TableRow>
            ) : rows.length === 0 ? (<TableRow><TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground"><Award className="mx-auto mb-2 h-8 w-8 opacity-40" />暂无已发证书</TableCell></TableRow>
            ) : rows.map((c) => (
              <TableRow key={c.id} className="hover:bg-muted/30">
                <TableCell className="px-4 py-2.5 font-mono text-xs">{c.certificateNo}</TableCell>
                <TableCell className="px-4 py-2.5 font-medium">{c.title}</TableCell>
                <TableCell className="px-4 py-2.5">{c.recipientName ?? c.nickname ?? '-'}</TableCell>
                <TableCell className="px-4 py-2.5"><span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', c.source === 'exam' ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400' : c.source === 'learn' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400')}>{SOURCE_MAP[c.source ?? ''] ?? c.source ?? '-'}</span></TableCell>
                <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">{c.templateName ?? '-'}</TableCell>
                <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">{c.issuedAt ? new Date(c.issuedAt).toLocaleDateString() : '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">共 {total} 条</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft className="h-4 w-4" />上一页</Button>
          <span className="text-sm text-muted-foreground">第 {page} / {totalPages} 页</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>下一页<ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  )
}
