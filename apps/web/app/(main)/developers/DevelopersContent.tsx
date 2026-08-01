'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Loader2,
  BookOpen,
  Key,
  Code2,
  Boxes,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import { BackButton } from '@/components/common'

interface RateLimit {
  qps: number
  dailyTokens: number
  concurrency: number
}

interface Sdk {
  language: string
  status: string
  npm?: string
  pypi?: string
}

interface DeveloperInfo {
  name: string
  version: string
  apiBase: string
  docsUrl: string
  pricingUrl: string
  modelsPricingUrl: string
  rateLimits: {
    free: RateLimit
    individual: RateLimit
    team: RateLimit
    enterprise: RateLimit
  }
  providers: string[]
  sdks: Sdk[]
  auth: { type: string; header: string; apiKeyUrl: string }
}

interface DevInfoResp {
  info: DeveloperInfo
}

async function fetchDevInfo(): Promise<DeveloperInfo> {
  const r = await fetchApi<DevInfoResp>('/api/developer/portal')
  if (!r.success || !r.data?.info) {
    throw new Error(r.error ?? '加载开发者信息失败')
  }
  return r.data.info
}

const TIER_LABELS: Array<{ key: keyof DeveloperInfo['rateLimits']; label: string }> = [
  { key: 'free', label: '免费' },
  { key: 'individual', label: '个人' },
  { key: 'team', label: '团队' },
  { key: 'enterprise', label: '企业' },
]

const numFmt = new Intl.NumberFormat('zh-CN')

export function DevelopersContent(): React.JSX.Element {
  const { data, isLoading, error } = useQuery({
    queryKey: ['developer-info'],
    queryFn: fetchDevInfo,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        加载中...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-2xl rounded-md border border-destructive/50 bg-destructive/10 p-6 text-sm text-destructive">
        {(error as Error)?.message ?? '加载开发者信息失败'}
      </div>
    )
  }

  const authExample = `curl ${data.apiBase}/v1/chat/completions \\
  -H "${data.auth.header}: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello"}]
  }'`

  return (
    <main className="mx-auto w-full max-w-6xl space-y-10 px-4 py-10 min-[768px]:px-8 min-[768px]:py-14">
      <BackButton />
      {/* Hero */}
      <section className="space-y-4 text-center">
        <div className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <Code2 className="h-3.5 w-3.5 text-primary" />
          开发者门户 · v{data.version}
        </div>
        <h1 className="text-3xl font-bold tracking-tight min-[768px]:text-5xl">
          {data.name} 开放平台
        </h1>
        <p className="mx-auto max-w-2xl text-sm text-muted-foreground min-[768px]:text-base">
          为开发者提供 OpenAI 兼容 API、9 大厂商模型、4 档配额,一行代码切换模型,统一鉴权。
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" asChild>
            <a href={data.docsUrl} target="_blank" rel="noopener noreferrer">
              <BookOpen className="mr-2 h-4 w-4" />
              查看 API 文档
            </a>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href={data.auth.apiKeyUrl}>
              <Key className="mr-2 h-4 w-4" />
              管理 API Key
            </a>
          </Button>
        </div>
      </section>

      {/* 限流策略 */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight min-[768px]:text-2xl">限流策略</h2>
        <Card>
          <CardContent className="p-0">
            <div className="grid grid-cols-2 gap-px bg-border/40 text-sm min-[640px]:grid-cols-4">
              <div className="bg-card p-3 text-xs font-medium text-muted-foreground">档位</div>
              <div className="bg-card p-3 text-xs font-medium text-muted-foreground">QPS</div>
              <div className="bg-card p-3 text-xs font-medium text-muted-foreground">日 Token</div>
              <div className="bg-card p-3 text-xs font-medium text-muted-foreground">并发</div>
              {TIER_LABELS.map(({ key, label }) => {
                const r = data.rateLimits[key]
                return (
                  <React.Fragment key={key}>
                    <div className="bg-card p-3 font-medium">{label}</div>
                    <div className="bg-card p-3 tabular-nums">{r.qps}</div>
                    <div className="bg-card p-3 tabular-nums">{numFmt.format(r.dailyTokens)}</div>
                    <div className="bg-card p-3 tabular-nums">{r.concurrency}</div>
                  </React.Fragment>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 支持厂商 */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight min-[768px]:text-2xl">支持的厂商</h2>
        <div className="grid grid-cols-2 gap-3 min-[640px]:grid-cols-3">
          {data.providers.map((p) => (
            <Card key={p} className="transition-colors hover:bg-accent">
              <CardContent className="flex items-center gap-2 p-4">
                <Boxes className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{p}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* SDK 计划 */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight min-[768px]:text-2xl">SDK 计划</h2>
        <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2">
          {data.sdks.map((sdk) => (
            <Card key={sdk.language}>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate">{sdk.language}</span>
                  </span>
                  <span className="shrink-0 whitespace-nowrap rounded bg-amber-500/10 px-2 py-0.5 text-xs font-normal text-amber-600 dark:text-amber-400">
                    规划中
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 p-4 pt-0 text-xs text-muted-foreground">
                {sdk.npm && (
                  <div>
                    npm: <code className="font-mono">{sdk.npm}</code>
                  </div>
                )}
                {sdk.pypi && (
                  <div>
                    pypi: <code className="font-mono">{sdk.pypi}</code>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* 鉴权说明 */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight min-[768px]:text-2xl">鉴权说明</h2>
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-primary" />
              {data.auth.type} Token
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-0">
            <p className="text-sm text-muted-foreground">
              在请求头{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                {data.auth.header}
              </code>{' '}
              中携带 API Key,格式为{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                Bearer &lt;your_api_key&gt;
              </code>
              。
            </p>
            <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs leading-relaxed">
              <code>{authExample}</code>
            </pre>
          </CardContent>
        </Card>
      </section>

      {/* 底部链接 */}
      <section className="flex flex-wrap items-center justify-center gap-3">
        <Button variant="outline" asChild>
          <a href={data.docsUrl} target="_blank" rel="noopener noreferrer">
            API 文档 <ArrowRight className="ml-2 h-3.5 w-3.5" />
          </a>
        </Button>
        <Button variant="outline" asChild>
          <a href={data.pricingUrl}>
            VIP 定价 <ArrowRight className="ml-2 h-3.5 w-3.5" />
          </a>
        </Button>
        <Button variant="outline" asChild>
          <a href={data.modelsPricingUrl}>
            模型价格 <ArrowRight className="ml-2 h-3.5 w-3.5" />
          </a>
        </Button>
        <Button variant="outline" asChild>
          <a href={data.auth.apiKeyUrl}>
            管理 API Key <ArrowRight className="ml-2 h-3.5 w-3.5" />
          </a>
        </Button>
      </section>
    </main>
  )
}
