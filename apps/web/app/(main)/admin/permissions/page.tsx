'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, Key, Lock, Search, Shield, Boxes, Zap, Copy, Check } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Input, Table, TableHeader, TableBody, TableHead, TableRow, TableCell, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface Permission {
  id: string
  name: string
  displayName: string
  resource: string
  action: string
  description: string | null
  createdAt: string
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const inputClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export default function AdminPermissionsPage() {
  const t = useTranslations('admin.permissions')
  const locale = useLocale()

  const [keyword, setKeyword] = React.useState('')
  const [resourceFilter, setResourceFilter] = React.useState('all')
  const [actionFilter, setActionFilter] = React.useState('all')
  const [copiedId, setCopiedId] = React.useState<string | null>(null)

  const permsQ = useQuery({
    queryKey: ['admin', 'permissions'],
    queryFn: () => api<{ list: Permission[] }>('/api/permissions').then((d) => d.list ?? []),
  })

  const perms = React.useMemo(() => permsQ.data ?? [], [permsQ.data])

  // 资源 / 操作去重列表(用于筛选下拉)
  const resources = React.useMemo(() => {
    const s = new Set<string>()
    perms.forEach((p) => s.add(p.resource))
    return Array.from(s).sort()
  }, [perms])

  const actions = React.useMemo(() => {
    const s = new Set<string>()
    perms.forEach((p) => s.add(p.action))
    return Array.from(s).sort()
  }, [perms])

  // 过滤后的权限列表
  const filtered = React.useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return perms.filter((p) => {
      if (resourceFilter !== 'all' && p.resource !== resourceFilter) return false
      if (actionFilter !== 'all' && p.action !== actionFilter) return false
      if (kw) {
        const hay = `${p.name} ${p.displayName} ${p.description ?? ''}`.toLowerCase()
        if (!hay.includes(kw)) return false
      }
      return true
    })
  }, [perms, keyword, resourceFilter, actionFilter])

  // 按资源分组
  const grouped = React.useMemo(() => {
    const m = new Map<string, Permission[]>()
    filtered.forEach((p) => {
      const arr = m.get(p.resource) ?? []
      arr.push(p)
      m.set(p.resource, arr)
    })
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtered])

  const dateFmt = new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit' })

  function copyCode(p: Permission) {
    navigator.clipboard?.writeText(p.name).then(() => {
      setCopiedId(p.id)
      setTimeout(() => setCopiedId((cur) => (cur === p.id ? null : cur)), 1500)
    })
  }

  const total = perms.length
  const resourceCount = resources.length
  const actionCount = actions.length
  const filteredCount = filtered.length

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Key className="h-6 w-6 text-primary" />
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* 统计面板 */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={Shield} label={t('statsTotal')} value={total} />
        <StatCard icon={Boxes} label={t('statsResources')} value={resourceCount} />
        <StatCard icon={Zap} label={t('statsActions')} value={actionCount} />
      </div>

      {/* 筛选条 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="h-9 pl-8"
          />
        </div>
        <Select value={resourceFilter} onValueChange={(v) => setResourceFilter(v)}>
  <SelectTrigger className={inputClass} aria-label={t('resource')}>
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">{t('allResources')}</SelectItem>
    {resources.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
  </SelectContent>
</Select>
        <Select value={actionFilter} onValueChange={(v) => setActionFilter(v)}>
  <SelectTrigger className={cn(inputClass, 'w-32')} aria-label={t('action')}>
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">{t('allActions')}</SelectItem>
    {actions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
  </SelectContent>
</Select>
        <span className="text-sm text-muted-foreground">{t('filteredCount', { count: filteredCount })}</span>
      </div>

      {/* 列表 */}
      {permsQ.isError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{t('noData')}</div>
      ) : permsQ.isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />{t('loading')}
        </div>
      ) : grouped.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          <Lock className="mx-auto mb-2 h-8 w-8 opacity-40" />
          {t('noData')}
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([resource, list]) => (
            <section key={resource} className="overflow-hidden rounded-lg border">
              <header className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">{resource}</span>
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {t('count', { count: list.length })}
                </span>
              </header>
              <div className="overflow-x-auto">
                <Table className="text-sm">
                  <TableHeader className="bg-muted/30 text-left text-xs uppercase text-muted-foreground">
                    <TableRow>
                      <TableHead className="px-4 py-2 font-medium">{t('name')}</TableHead>
                      <TableHead className="px-4 py-2 font-medium">{t('code')}</TableHead>
                      <TableHead className="px-4 py-2 font-medium">{t('action')}</TableHead>
                      <TableHead className="px-4 py-2 font-medium">{t('description')}</TableHead>
                      <TableHead className="px-4 py-2 font-medium">{t('createdAt')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y">
                    {list.map((p) => (
                      <TableRow key={p.id} className="transition-colors hover:bg-muted/20">
                        <TableCell className="px-4 py-2">
                          <span className="font-medium">{p.displayName}</span>
                        </TableCell>
                        <TableCell className="px-4 py-2">
                          <button
                            type="button"
                            onClick={() => copyCode(p)}
                            className="group inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-xs transition-colors hover:bg-muted/70"
                            title={t('copyCode')}
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
                        <TableCell className="max-w-[260px] truncate px-4 py-2 text-muted-foreground">
                          {p.description || '-'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">
                          {dateFmt.format(new Date(p.createdAt))}
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

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
}) {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  )
}
