'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Loader2, GitCompare } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'

interface CompareEntry {
  key: string
  namespace: string
  left?: string
  right?: string
}

interface CompareData {
  entries: CompareEntry[]
  leftLocale: string
  rightLocale: string
}

const LOCALES = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'zh-TW', label: '繁體中文' },
]

export default function I18nComparePage() {
  const [left, setLeft] = React.useState('zh-CN')
  const [right, setRight] = React.useState('en')

  const { data, isLoading } = useQuery<CompareData>({
    queryKey: ['i18n', 'compare', left, right],
    queryFn: async () => {
      const qs = new URLSearchParams({ left, right })
      const r = await fetchApi<CompareData>(`/api/admin/i18n-dashboard/compare?${qs.toString()}`)
      if (r.success && r.data) return r.data
      // API 失败时返回空 entries,UI 显示"加载失败"空状态(不再降级到 mock 数据)
      return { entries: [], leftLocale: left, rightLocale: right }
    },
    staleTime: 60_000,
  })

  const entries = data?.entries ?? []

  const selectClass =
    'h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <Link
        href="/admin/i18n-dashboard"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回概览
      </Link>

      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <GitCompare className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">语言对比</h1>
        </div>
        <p className="text-sm text-muted-foreground">选择两种语言并排查看 Key-Value 翻译</p>
      </header>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">语言 A</span>
            <select value={left} onChange={(e) => setLeft(e.target.value)} className={selectClass}>
              {LOCALES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <GitCompare className="h-4 w-4 text-muted-foreground" />
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">语言 B</span>
            <select
              value={right}
              onChange={(e) => setRight(e.target.value)}
              className={selectClass}
            >
              {LOCALES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载中...
        </div>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">对比结果({entries.length} 条)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Key</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                      {LOCALES.find((l) => l.value === left)?.label ?? left}
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                      {LOCALES.find((l) => l.value === right)?.label ?? right}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entries.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                        暂无对比数据(可能是 API 调用失败或翻译文件为空)
                      </td>
                    </tr>
                  ) : (
                    entries.map((e) => {
                      const missing = !e.left || !e.right
                      return (
                        <tr
                          key={`${e.namespace}-${e.key}`}
                          className={cn(
                            'transition-colors hover:bg-muted/30',
                            missing && 'bg-amber-500/5',
                          )}
                        >
                          <td className="px-4 py-2">
                            <div className="font-mono text-xs text-muted-foreground">
                              {e.namespace}
                            </div>
                            <div className="font-mono text-sm">{e.key}</div>
                          </td>
                          <td className="px-4 py-2">
                            {e.left ? (
                              <span>{e.left}</span>
                            ) : (
                              <span className="text-xs text-amber-600">缺失</span>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            {e.right ? (
                              <span>{e.right}</span>
                            ) : (
                              <span className="text-xs text-amber-600">缺失</span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
