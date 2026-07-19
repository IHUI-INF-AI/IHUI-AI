'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Loader2, GitCompare } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'

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

const MOCK_ENTRIES: CompareEntry[] = [
  { key: 'common.save', namespace: 'common', left: '保存', right: 'Save' },
  { key: 'common.cancel', namespace: 'common', left: '取消', right: 'Cancel' },
  { key: 'common.confirm', namespace: 'common', left: '确认', right: undefined },
  { key: 'common.delete', namespace: 'common', left: '删除', right: 'Delete' },
  { key: 'menu.dashboard', namespace: 'menu', left: '仪表盘', right: 'Dashboard' },
  { key: 'menu.settings', namespace: 'menu', left: '设置', right: undefined },
  { key: 'home.welcome', namespace: 'home', left: '欢迎', right: 'Welcome' },
  { key: 'user.profile', namespace: 'user', left: '个人资料', right: 'Profile' },
  { key: 'articles.title', namespace: 'articles', left: '文章', right: 'Articles' },
  { key: 'articles.empty', namespace: 'articles', left: '暂无文章', right: undefined },
]

export default function I18nComparePage() {
  const [left, setLeft] = React.useState('zh-CN')
  const [right, setRight] = React.useState('en')

  const { data, isLoading } = useQuery<CompareData>({
    queryKey: ['i18n', 'compare', left, right],
    queryFn: async () => {
      const qs = new URLSearchParams({ left, right })
      const r = await fetchApi<CompareData>(`/api/admin/i18n-dashboard/compare?${qs.toString()}`)
      return r.success && r.data
        ? r.data
        : { entries: MOCK_ENTRIES, leftLocale: left, rightLocale: right }
    },
    staleTime: 60_000,
  })

  const entries = data?.entries ?? MOCK_ENTRIES

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
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Key</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                      {LOCALES.find((l) => l.value === left)?.label ?? left}
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                      {LOCALES.find((l) => l.value === right)?.label ?? right}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {entries.map((e) => {
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
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
