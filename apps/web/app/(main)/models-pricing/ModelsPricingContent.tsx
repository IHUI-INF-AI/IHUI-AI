'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Search } from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'

interface RegionPricing {
  cn?: number | null
  us?: number | null
  eu?: number | null
}

interface AiPricing {
  id: string
  modelId: string
  inputTokenPrice: number
  outputTokenPrice: number
  regionPricing: RegionPricing
  currency: 'CNY' | 'USD'
  effectiveAt?: string | null
}

interface AiPricingResponse {
  items: AiPricing[]
}

async function fetchAiPricing(): Promise<AiPricing[]> {
  const r = await fetchApi<AiPricingResponse>(`/api/ai-pricing`)
  if (!r.success || !r.data?.items) {
    throw new Error(r.error ?? '加载模型定价失败')
  }
  return r.data.items
}

const VENDOR_RULES: Array<{ prefixes: string[]; vendor: string }> = [
  { prefixes: ['gpt-', 'o1', 'o3'], vendor: 'OpenAI' },
  { prefixes: ['claude-'], vendor: 'Anthropic' },
  { prefixes: ['gemini-'], vendor: 'Gemini' },
  { prefixes: ['deepseek-'], vendor: 'DeepSeek' },
  { prefixes: ['qwen'], vendor: '阿里 Qwen' },
  { prefixes: ['doubao-'], vendor: '字节豆包' },
  { prefixes: ['moonshot-', 'kimi-'], vendor: '月之暗面 Kimi' },
  { prefixes: ['glm-'], vendor: '智谱' },
  { prefixes: ['abab'], vendor: 'MiniMax' },
]

function detectVendor(modelId: string): string {
  const lower = modelId.toLowerCase()
  for (const rule of VENDOR_RULES) {
    if (rule.prefixes.some((p) => lower.startsWith(p))) return rule.vendor
  }
  return '其他'
}

const CURRENCY_SYMBOL: Record<string, string> = {
  CNY: '¥',
  USD: '$',
}

// 分/千 token → 元/百万 token: 乘以 10
const formatPrice = (centsPerKToken: number): string => {
  const yuan = centsPerKToken * 10
  return yuan.toLocaleString('zh-CN', { maximumFractionDigits: 4 })
}

export function ModelsPricingContent(): React.JSX.Element {
  const [keyword, setKeyword] = React.useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['ai-pricing'],
    queryFn: fetchAiPricing,
  })

  const grouped = React.useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    const items = (data ?? []).filter((p) =>
      kw ? p.modelId.toLowerCase().includes(kw) : true,
    )
    const map = new Map<string, AiPricing[]>()
    for (const item of items) {
      const vendor = detectVendor(item.modelId)
      if (!map.has(vendor)) map.set(vendor, [])
      map.get(vendor)!.push(item)
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [data, keyword])

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 md:px-8 md:py-14">
      <header className="space-y-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">模型定价</h1>
        <p className="mx-auto max-w-2xl text-sm text-muted-foreground md:text-base">
          所有模型输入/输出 token 单价,单位:元 / 百万 token。按厂商分组,支持关键词搜索。
        </p>
      </header>

      <div className="relative mx-auto mt-6 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索模型 ID,如 gpt-4、claude-3、deepseek-chat"
          className="pl-9"
        />
      </div>

      <section className="mt-8 space-y-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            加载中...
          </div>
        ) : error ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {(error as Error).message}
          </div>
        ) : grouped.length === 0 ? (
          <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
            {keyword.trim() ? `未找到匹配 "${keyword.trim()}" 的模型` : '暂无定价数据'}
          </div>
        ) : (
          grouped.map(([vendor, items]) => (
            <Card key={vendor}>
              <CardHeader className="p-5 pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  <span>{vendor}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {items.length} 个模型
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>模型 ID</TableHead>
                      <TableHead className="text-right">输入价</TableHead>
                      <TableHead className="text-right">输出价</TableHead>
                      <TableHead>货币</TableHead>
                      <TableHead>区域系数</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((p) => {
                      const sym = CURRENCY_SYMBOL[p.currency] ?? p.currency
                      const regions = [
                        p.regionPricing?.cn != null && `CN ${p.regionPricing.cn}`,
                        p.regionPricing?.us != null && `US ${p.regionPricing.us}`,
                        p.regionPricing?.eu != null && `EU ${p.regionPricing.eu}`,
                      ]
                        .filter(Boolean)
                        .join(' / ')
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono text-xs">{p.modelId}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {sym}
                            {formatPrice(p.inputTokenPrice)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {sym}
                            {formatPrice(p.outputTokenPrice)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{p.currency}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {regions || '—'}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))
        )}
      </section>
    </main>
  )
}
