'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Key, Lock, Search, Copy, Check } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Input, Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@ihui/ui'

interface MemberPermission {
  id: string
  name: string
  displayName: string
  resource: string
  action: string
  description: string | null
  roles: string[]
  createdAt: string
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function AdminMemberPermissionsPage() {
  const [keyword, setKeyword] = React.useState('')
  const [copiedId, setCopiedId] = React.useState<string | null>(null)

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['admin', 'member', 'permissions'],
    queryFn: () =>
      api<{ list: MemberPermission[] }>('/api/admin/member/permissions').then((d) => d.list ?? []),
  })

  const filtered = React.useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    if (!kw) return list
    return list.filter((p) =>
      `${p.name} ${p.displayName} ${p.resource} ${p.action}`.toLowerCase().includes(kw),
    )
  }, [list, keyword])

  const grouped = React.useMemo(() => {
    const m = new Map<string, MemberPermission[]>()
    filtered.forEach((p) => {
      const arr = m.get(p.resource) ?? []
      arr.push(p)
      m.set(p.resource, arr)
    })
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtered])

  function copyCode(p: MemberPermission) {
    navigator.clipboard?.writeText(p.name).then(() => {
      setCopiedId(p.id)
      setTimeout(() => setCopiedId((cur) => (cur === p.id ? null : cur)), 1500)
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Key className="h-6 w-6 text-primary" />
          会员权限点
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">会员体系权限点管理</p>
      </div>

      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索权限"
          className="h-9 pl-8"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        </div>
      ) : grouped.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          <Lock className="mx-auto mb-2 h-8 w-8 opacity-40" />
          暂无权限
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([resource, items]) => (
            <section key={resource} className="overflow-hidden rounded-lg border">
              <header className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">{resource}</span>
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {items.length}
                </span>
              </header>
              <div className="overflow-x-auto">
                <Table className="text-sm">
                  <TableHeader className="bg-muted/30 text-left text-xs uppercase text-muted-foreground">
                    <TableRow>
                      <TableHead className="px-4 py-2 font-medium">名称</TableHead>
                      <TableHead className="px-4 py-2 font-medium">标识</TableHead>
                      <TableHead className="px-4 py-2 font-medium">操作</TableHead>
                      <TableHead className="px-4 py-2 font-medium">关联角色</TableHead>
                      <TableHead className="px-4 py-2 font-medium">描述</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y">
                    {items.map((p) => (
                      <TableRow key={p.id} className="transition-colors hover:bg-muted/20">
                        <TableCell className="px-4 py-2 font-medium">{p.displayName}</TableCell>
                        <TableCell className="px-4 py-2">
                          <button
                            type="button"
                            onClick={() => copyCode(p)}
                            className="group inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-xs hover:bg-muted/70"
                          >
                            <code>{p.name}</code>
                            {copiedId === p.id ? (
                              <Check className="h-3 w-3 text-emerald-500" />
                            ) : (
                              <Copy className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="px-4 py-2">
                          <span className="inline-flex rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                            {p.action}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-2">
                          <div className="flex flex-wrap gap-1">
                            {(p.roles ?? []).map((r) => (
                              <span key={r} className="rounded bg-muted px-1.5 py-0.5 text-xs">
                                {r}
                              </span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[220px] break-words px-4 py-2 text-muted-foreground">
                          {p.description || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
