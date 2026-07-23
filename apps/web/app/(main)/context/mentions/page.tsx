'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { fetchMentions, fetchSymbols, fetchTableSchema } from '@/lib/context-api'
import { MentionSearch } from '@/components/context/MentionSearch'
import { SymbolSearchResult } from '@/components/context/SymbolSearchResult'
import { cn } from '@/lib/utils'
import type { ContextType, Mention, SymbolResult, TableSchema } from '@ihui/shared/context/index'

export default function ContextMentionsPage() {
  const [activeType, setActiveType] = React.useState<ContextType>('file')
  const [query, setQuery] = React.useState('')
  const [selected, setSelected] = React.useState<Mention | null>(null)

  const debouncedQ = useDebounced(query, 300)

  const mentionsQ = useQuery({
    queryKey: ['context', 'mentions', activeType, debouncedQ],
    queryFn: () => fetchMentions(debouncedQ, activeType, 30),
    enabled: activeType !== 'symbol' && (debouncedQ.length > 0 || activeType !== 'file'),
  })

  const symbolsQ = useQuery({
    queryKey: ['context', 'symbols', debouncedQ],
    queryFn: () => fetchSymbols(debouncedQ, 30),
    enabled: activeType === 'symbol' && debouncedQ.length > 0,
  })

  const schemaQ = useQuery({
    queryKey: ['context', 'schema', selected?.id],
    queryFn: () => fetchTableSchema(selected!.label),
    enabled: activeType === 'database' && !!selected?.label,
  })

  const symbolDetail: SymbolResult | null = React.useMemo(() => {
    if (activeType !== 'symbol' || !selected) return null
    return symbolsQ.data?.symbols.find((s) => s.id === selected.id) ?? null
  }, [activeType, selected, symbolsQ.data])

  const results = mentionsQ.data?.mentions ?? []
  const symbols = symbolsQ.data?.symbols ?? []
  const total = activeType === 'symbol' ? symbols.length : (mentionsQ.data?.total ?? 0)
  const isLoading = mentionsQ.isLoading || symbolsQ.isLoading

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <div>
        <Link
          href="/context"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          返回上下文总览
        </Link>
        <h1 className="mt-1 text-xl font-bold tracking-tight">@ 提及检索</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          按类型搜索文件 / 目录 / 符号 / 数据库表 / 网页,并查看详情
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">检索</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <MentionSearch
              activeType={activeType}
              onTypeChange={(t) => {
                setActiveType(t)
                setSelected(null)
              }}
              query={query}
              onQueryChange={setQuery}
              results={activeType === 'symbol' ? [] : results}
              isLoading={isLoading}
              total={total}
              onSelect={setSelected}
              selectedId={selected?.id}
            />
            {activeType === 'symbol' && (
              <div className="mt-3 max-h-[420px] space-y-1.5 overflow-y-auto">
                {symbols.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    {isLoading ? '检索中…' : debouncedQ.length === 0 ? '请输入符号关键词' : '暂无结果'}
                  </div>
                ) : (
                  symbols.map((s) => (
                    <SymbolSearchResult
                      key={s.id}
                      symbol={s}
                      selected={selected?.id === s.id}
                      onSelect={(sym) => setSelected({ id: sym.id, type: 'symbol', label: sym.name, detail: sym.filePath, insertText: sym.name })}
                    />
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">详情</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {!selected ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                选择左侧结果查看详情
              </div>
            ) : (
              <DetailPanel
                mention={selected}
                schema={schemaQ.data}
                isLoadingSchema={schemaQ.isLoading}
                symbol={symbolDetail}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function DetailPanel({
  mention,
  schema,
  isLoadingSchema,
  symbol,
}: {
  mention: Mention
  schema?: TableSchema
  isLoadingSchema: boolean
  symbol: SymbolResult | null
}) {
  return (
    <div className="space-y-3">
      <div>
        <span
          className={cn(
            'inline-block rounded-sm px-1.5 py-0.5 text-[10px] font-medium',
            'bg-muted text-muted-foreground',
          )}
        >
          {mention.type}
        </span>
        <p className="mt-1.5 text-sm font-medium">{mention.label}</p>
        {mention.detail && (
          <p className="mt-0.5 text-xs text-muted-foreground break-all">{mention.detail}</p>
        )}
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground">insertText</p>
        <code className="mt-1 block w-full rounded-sm bg-muted px-2 py-1.5 text-xs break-all">
          {mention.insertText}
        </code>
      </div>

      {symbol && (
        <div className="rounded-md border p-2.5 text-xs">
          <p className="font-medium">{symbol.name}</p>
          <p className="mt-0.5 text-muted-foreground">
            {symbol.filePath}:{symbol.line}
          </p>
          {symbol.detail && (
            <p className="mt-1 text-muted-foreground">{symbol.detail}</p>
          )}
        </div>
      )}

      {mention.type === 'database' &&
        (isLoadingSchema ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            加载 schema…
          </div>
        ) : schema ? (
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              表结构({schema.columns.length} 列)
            </p>
            <div className="mt-1 max-h-[280px] overflow-y-auto rounded-md border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-2 py-1 text-left font-medium">列</th>
                    <th className="px-2 py-1 text-left font-medium">类型</th>
                    <th className="px-2 py-1 text-center font-medium">空</th>
                    <th className="px-2 py-1 text-center font-medium">主键</th>
                  </tr>
                </thead>
                <tbody>
                  {schema.columns.map((c) => (
                    <tr key={c.name} className="border-t border-border/60">
                      <td className="px-2 py-1 font-mono">{c.name}</td>
                      <td className="px-2 py-1 text-muted-foreground">{c.type}</td>
                      <td className="px-2 py-1 text-center">{c.nullable ? '✓' : '—'}</td>
                      <td className="px-2 py-1 text-center">
                        {c.primaryKey ? '✓' : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">无法加载 schema</p>
        ))}
    </div>
  )
}

function useDebounced<T>(value: T, delay = 300): T {
  const [v, setV] = React.useState(value)
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return v
}
