'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Code, Loader2, Search, Copy, Rocket, KeyRound, Zap, Coins } from 'lucide-react'
import { toast } from 'sonner'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, Input } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'
import { ErrorCodeTable } from '@/components/api-docs/ErrorCodeTable'
import { SdkExamples } from '@/components/api-docs/SdkExamples'
import { CurlPlayground } from '@/components/api-docs/CurlPlayground'
import { BackButton } from '@/components/common'

interface ApiParam {
  name: string
  type: string
  required?: boolean
  description?: string
}
interface ApiEndpoint {
  id: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  path: string
  summary: string
  category: string
  params?: ApiParam[]
  responseExample?: string
}
interface ApiDocGroup {
  category: string
  endpoints: ApiEndpoint[]
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}
const METHOD_CLASS: Record<string, string> = {
  GET: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  POST: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  PUT: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  DELETE: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  PATCH: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
}

const QUICK_ENDPOINTS: Array<{ method: 'POST' | 'GET'; path: string; desc: string }> = [
  { method: 'POST', path: '/v1/chat/completions', desc: 'OpenAI 兼容对话' },
  { method: 'POST', path: '/v1/anthropic/messages', desc: 'Anthropic 兼容对话' },
  { method: 'GET', path: '/v1/models', desc: '查询可用模型' },
  // P0 第二批次(2026-07-31 立):4 个新端点
  { method: 'POST', path: '/v1/rerank', desc: 'Cohere/Jina 兼容重排序' },
  { method: 'POST', path: '/v1/moderations', desc: 'OpenAI 兼容内容审核' },
  { method: 'GET', path: '/v1/realtime', desc: 'Realtime WebSocket 实时对话' },
  { method: 'POST', path: '/v1/midjourney/imagine', desc: 'Midjourney-Proxy 标准接口' },
  { method: 'POST', path: '/v1/mcp/tools/call', desc: 'MCP 网关工具调用' },
  // P0 第三批次(2026-08-01 立):OpenAI 协议补齐
  { method: 'POST', path: '/v1/responses', desc: 'OpenAI Responses API(Cursor/Codex 兼容)' },
  { method: 'POST', path: '/v1/batch', desc: 'OpenAI 批量异步 API(50% 折扣)' },
  { method: 'POST', path: '/v1/assistants', desc: 'Assistants API v2(第三方 SDK 直连)' },
  { method: 'POST', path: '/v1/audio/translations', desc: 'Whisper 语音翻译' },
  { method: 'POST', path: '/v1/fine_tuning/jobs', desc: '微调任务管理' },
  { method: 'GET', path: '/v1/files', desc: '文件管理 CRUD' },
  // P0 第四批次(2026-08-01 立):状态页 + 分享 + 导出 + 会话历史
  { method: 'GET', path: '/api/public/status/overview', desc: '公开状态页-系统总览' },
  { method: 'GET', path: '/api/public/status/models', desc: '公开状态页-模型可用性' },
  { method: 'GET', path: '/api/public/status/incidents', desc: '公开状态页-事件列表' },
  { method: 'POST', path: '/api/developer/api-keys/:id/shares', desc: 'API Key 临时分享(限时 token)' },
  { method: 'GET', path: '/api/admin/export/orders.csv', desc: '充值订单 CSV 导出' },
  { method: 'GET', path: '/api/admin/export/relay-logs.csv', desc: '调用日志 CSV 导出' },
  { method: 'GET', path: '/api/developer/conversations', desc: '中转站会话历史列表' },
]

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Code
  title: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">{title}</p>
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

export default function ApiDocsPage() {
  const t = useTranslations('developerApiDocsPage')
  const [keyword, setKeyword] = React.useState('')
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  const {
    data: groups = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['developer', 'api-docs'],
    queryFn: () => api<ApiDocGroup[]>('/api/developer/docs').catch(() => [] as ApiDocGroup[]),
  })

  const filtered = React.useMemo(() => {
    if (!keyword.trim()) return groups
    const kw = keyword.toLowerCase()
    return groups
      .map((g) => ({
        ...g,
        endpoints: g.endpoints.filter(
          (e) =>
            e.path.toLowerCase().includes(kw) ||
            e.summary.toLowerCase().includes(kw) ||
            e.category.toLowerCase().includes(kw),
        ),
      }))
      .filter((g) => g.endpoints.length > 0)
  }, [groups, keyword])

  const allEndpoints = filtered.flatMap((g) => g.endpoints)
  const selected = allEndpoints.find((e) => e.id === selectedId) ?? allEndpoints[0] ?? null

  React.useEffect(() => {
    if (!selectedId && allEndpoints.length > 0) setSelectedId(allEndpoints[0]?.id ?? null)
  }, [allEndpoints, selectedId])

  function copyPath(path: string) {
    navigator.clipboard?.writeText(path).then(
      () => toast.success(t('toastCopied')),
      () => toast.error(t('toastCopyFailed')),
    )
  }

  return (
    <div className="space-y-4">
      <BackButton />
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Code className="h-5 w-5 text-primary" />
          {t('title')}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {error && <Alert variant="danger" description={(error as Error).message} />}

      <Section icon={Rocket} title="快速开始(5 分钟接入)">
        <ol className="space-y-1 text-xs text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">1. 注册登录</span> — 完成账号注册并登录
          </li>
          <li>
            <span className="font-medium text-foreground">2. 生成 Key</span> — 开发者中心 → 密钥管理
            → 新建密钥
          </li>
          <li>
            <span className="font-medium text-foreground">3. 调用接口</span> — 替换下方 sk-xxx
            即可发起首次请求
          </li>
        </ol>
        <pre className="overflow-x-auto rounded-md bg-zinc-950 p-3 text-xs text-zinc-100 dark:bg-zinc-900">
          <code className="font-mono">{`curl https://api.ihui.ai/v1/chat/completions \\
  -H "Authorization: Bearer sk-xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hi"}]}'`}</code>
        </pre>
      </Section>

      <Section icon={KeyRound} title="认证方式">
        <p className="text-xs text-muted-foreground">
          请求需在 Header 携带
          <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono">
            Authorization: Bearer sk-xxx
          </code>
          (Anthropic 端点亦支持
          <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono">x-api-key</code>)。
        </p>
        <ul className="space-y-1 text-xs">
          {QUICK_ENDPOINTS.map((e) => (
            <li key={e.path} className="flex items-center gap-2">
              <span
                className={cn(
                  'rounded px-1.5 py-0.5 font-mono text-xs font-bold',
                  METHOD_CLASS[e.method],
                )}
              >
                {e.method}
              </span>
              <code className="font-mono">{e.path}</code>
              <span className="text-muted-foreground">— {e.desc}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section icon={Code} title="端点列表">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="pl-9"
          />
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('loading')}
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('noDocs')}</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 min-[1024px]:grid-cols-[240px_1fr]">
            <aside className="space-y-2 min-[1024px]:max-h-[60vh] min-[1024px]:overflow-y-auto min-[1024px]:pr-1">
              {filtered.map((g) => (
                <div key={g.category}>
                  <p className="mb-1 px-1 text-xs font-semibold uppercase text-muted-foreground">
                    {g.category}
                  </p>
                  <div className="space-y-0.5">
                    {g.endpoints.map((e) => (
                      <button
                        key={e.id}
                        onClick={() => setSelectedId(e.id)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                          selected?.id === e.id
                            ? 'bg-primary/10 text-primary'
                            : 'hover:bg-accent hover:text-accent-foreground',
                        )}
                      >
                        <span
                          className={cn(
                            'shrink-0 rounded px-1 py-0.5 text-xs font-bold',
                            METHOD_CLASS[e.method],
                          )}
                        >
                          {e.method}
                        </span>
                        <span className="truncate">{e.path}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </aside>
            {selected && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-xs font-bold',
                      METHOD_CLASS[selected.method],
                    )}
                  >
                    {selected.method}
                  </span>
                  <code className="flex-1 min-w-0 text-sm font-medium">{selected.path}</code>
                  <button
                    onClick={() => copyPath(selected.path)}
                    className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-sm text-muted-foreground">{selected.summary}</p>
                {selected.params && selected.params.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-sm font-semibold">{t('requestParams')}</p>
                    {selected.params.map((p) => (
                      <div
                        key={p.name}
                        className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs"
                      >
                        <code className="font-mono font-medium">{p.name}</code>
                        <span className="text-muted-foreground">{p.type}</span>
                        <span
                          className={
                            p.required
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-muted-foreground'
                          }
                        >
                          {p.required ? t('yes') : t('no')}
                        </span>
                        <span className="text-muted-foreground">{p.description ?? '-'}</span>
                      </div>
                    ))}
                  </div>
                )}
                {selected.responseExample && (
                  <div>
                    <p className="mb-1.5 text-sm font-semibold">{t('responseExample')}</p>
                    <pre className="overflow-x-auto rounded-md bg-muted/50 p-3 text-xs">
                      <code>{selected.responseExample}</code>
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Section>

      <ErrorCodeTable />
      <SdkExamples />
      <CurlPlayground />

      <Section icon={Zap} title="速率限制">
        <ul className="space-y-1 text-xs">
          <li>免费 20 QPM · 基础 60 QPM · 专业 200 QPM · 企业 1000 QPM</li>
          <li className="text-muted-foreground">
            超限返回错误码 <code className="font-mono">1004</code>(HTTP 429)。
          </li>
        </ul>
      </Section>

      <Section icon={Coins} title="计费说明">
        <ul className="space-y-1 text-xs text-muted-foreground">
          <li>
            · <span className="font-medium text-foreground">Prompt Cache 折扣</span>:命中缓存的输入
            token 按 0.1 倍计价。
          </li>
          <li>
            · <span className="font-medium text-foreground">响应缓存(Redis)</span>:非流式 chat
            completions 命中缓存时成本为 0(响应头 <code className="font-mono">X-Cache: HIT</code>
            ),用 <code className="font-mono">X-Cache-Bypass: true</code> 跳过缓存。
          </li>
          <li>
            · <span className="font-medium text-foreground">阶梯计价</span>:单次请求 token
            越多,单价越低(详见价格页)。
          </li>
          <li>
            · <span className="font-medium text-foreground">分组倍率</span>
            :不同模型分组按倍率计费(如 Claude 1.2x、GPT-4o 1.0x)。
          </li>
          <li>
            · <span className="font-medium text-foreground">rerank/moderations</span>:按 input
            tokens 计费,output tokens 为 0。
          </li>
          <li>
            · 计费单位为 Token,1 Token ≈ 0.75 字符(中文);余额不足返回{' '}
            <code className="font-mono">1005</code>。
          </li>
        </ul>
      </Section>
    </div>
  )
}
