// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

/** 接口说明的 i18n 键(模块级常量表不得调 hook,由渲染处 t() 取词);method/path 是协议字面量,不入语言包 */
type EndpointDescKey =
  | 'endpoints.chatCompletions'
  | 'endpoints.anthropicMessages'
  | 'endpoints.listModels'
  | 'endpoints.rerank'
  | 'endpoints.moderations'
  | 'endpoints.realtime'
  | 'endpoints.midjourneyImagine'
  | 'endpoints.mcpToolsCall'
  | 'endpoints.responses'
  | 'endpoints.batch'
  | 'endpoints.assistants'
  | 'endpoints.audioTranslations'
  | 'endpoints.fineTuningJobs'
  | 'endpoints.files'
  | 'endpoints.statusOverview'
  | 'endpoints.statusModels'
  | 'endpoints.statusIncidents'
  | 'endpoints.apiKeyShares'
  | 'endpoints.exportOrdersCsv'
  | 'endpoints.exportRelayLogsCsv'
  | 'endpoints.developerConversations'

const QUICK_ENDPOINTS: Array<{ method: 'POST' | 'GET'; path: string; descKey: EndpointDescKey }> = [
  { method: 'POST', path: '/v1/chat/completions', descKey: 'endpoints.chatCompletions' },
  { method: 'POST', path: '/v1/anthropic/messages', descKey: 'endpoints.anthropicMessages' },
  { method: 'GET', path: '/v1/models', descKey: 'endpoints.listModels' },
  // P0 第二批次(2026-07-31 立):4 个新端点
  { method: 'POST', path: '/v1/rerank', descKey: 'endpoints.rerank' },
  { method: 'POST', path: '/v1/moderations', descKey: 'endpoints.moderations' },
  { method: 'GET', path: '/v1/realtime', descKey: 'endpoints.realtime' },
  { method: 'POST', path: '/v1/midjourney/imagine', descKey: 'endpoints.midjourneyImagine' },
  { method: 'POST', path: '/v1/mcp/tools/call', descKey: 'endpoints.mcpToolsCall' },
  // P0 第三批次(2026-08-01 立):OpenAI 协议补齐
  { method: 'POST', path: '/v1/responses', descKey: 'endpoints.responses' },
  { method: 'POST', path: '/v1/batch', descKey: 'endpoints.batch' },
  { method: 'POST', path: '/v1/assistants', descKey: 'endpoints.assistants' },
  { method: 'POST', path: '/v1/audio/translations', descKey: 'endpoints.audioTranslations' },
  { method: 'POST', path: '/v1/fine_tuning/jobs', descKey: 'endpoints.fineTuningJobs' },
  { method: 'GET', path: '/v1/files', descKey: 'endpoints.files' },
  // P0 第四批次(2026-08-01 立):状态页 + 分享 + 导出 + 会话历史
  { method: 'GET', path: '/api/public/status/overview', descKey: 'endpoints.statusOverview' },
  { method: 'GET', path: '/api/public/status/models', descKey: 'endpoints.statusModels' },
  { method: 'GET', path: '/api/public/status/incidents', descKey: 'endpoints.statusIncidents' },
  {
    method: 'POST',
    path: '/api/developer/api-keys/:id/shares',
    descKey: 'endpoints.apiKeyShares',
  },
  { method: 'GET', path: '/api/admin/export/orders.csv', descKey: 'endpoints.exportOrdersCsv' },
  {
    method: 'GET',
    path: '/api/admin/export/relay-logs.csv',
    descKey: 'endpoints.exportRelayLogsCsv',
  },
  {
    method: 'GET',
    path: '/api/developer/conversations',
    descKey: 'endpoints.developerConversations',
  },
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
      <CardContent className="min-[640px]:p-3 space-y-3 p-3">
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
    <div className="px-4 py-4 space-y-4">
      <BackButton />
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Code className="h-5 w-5 text-primary" />
          {t('title')}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {error && <Alert variant="danger" description={(error as Error).message} />}

      <Section icon={Rocket} title={t('sections.quickStart')}>
        <ol className="space-y-1 text-xs text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">{t('steps.step1Title')}</span>{' '}
            {t('steps.step1Desc')}
          </li>
          <li>
            <span className="font-medium text-foreground">{t('steps.step2Title')}</span>{' '}
            {t('steps.step2Desc')}
          </li>
          <li>
            <span className="font-medium text-foreground">{t('steps.step3Title')}</span>{' '}
            {t('steps.step3Desc')}
          </li>
        </ol>
        {/* 2026-08-17 P3:dark 模式代码块用 zinc-950,light 用 zinc-100(原实现 light 比 dark 更深,已修正) */}
        <pre className="overflow-x-auto rounded-md bg-zinc-100 p-3 text-xs text-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
          <code className="font-mono">{`curl https://api.ihui.ai/v1/chat/completions \\
  -H "Authorization: Bearer ihui_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hi"}]}'`}</code>
        </pre>
      </Section>

      <Section icon={KeyRound} title={t('sections.auth')}>
        <p className="text-xs text-muted-foreground">
          {t('auth.descPrefix')}
          <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono">
            Authorization: Bearer ihui_xxx
          </code>
          {t('auth.descMid')}
          <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono">x-api-key</code>
          {t('auth.descSuffix')}
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
              <span className="text-muted-foreground">— {t(e.descKey)}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section icon={Code} title={t('sections.endpointList')}>
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

      <Section icon={Zap} title={t('sections.rateLimit')}>
        <ul className="space-y-1 text-xs">
          <li>{t('rateLimit.tiers')}</li>
          <li className="text-muted-foreground">
            {t('rateLimit.overLimitPrefix')} <code className="font-mono">1004</code>
            {t('rateLimit.overLimitSuffix')}
          </li>
        </ul>
      </Section>

      <Section icon={Coins} title={t('sections.billing')}>
        <ul className="space-y-1 text-xs text-muted-foreground">
          <li>
            · <span className="font-medium text-foreground">{t('billing.promptCacheTerm')}</span>
            {t('billing.promptCacheDesc')}
          </li>
          <li>
            · <span className="font-medium text-foreground">{t('billing.responseCacheTerm')}</span>
            {t('billing.responseCacheDesc1')} <code className="font-mono">X-Cache: HIT</code>
            {t('billing.responseCacheDesc2')}{' '}
            <code className="font-mono">X-Cache-Bypass: true</code>{' '}
            {t('billing.responseCacheDesc3')}
          </li>
          <li>
            · <span className="font-medium text-foreground">{t('billing.tieredTerm')}</span>
            {t('billing.tieredDesc')}
          </li>
          <li>
            · <span className="font-medium text-foreground">{t('billing.groupRateTerm')}</span>
            {t('billing.groupRateDesc')}
          </li>
          <li>
            · <span className="font-medium text-foreground">rerank/moderations</span>
            {t('billing.rerankDesc')}
          </li>
          <li>
            · {t('billing.unit')} <code className="font-mono">1005</code>
            {t('billing.unitSuffix')}
          </li>
        </ul>
      </Section>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
