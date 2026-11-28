// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 发布能力验收矩阵 — 把"有适配器 / 登录有效 / 真实发过"分开显示。
 * 数据源: GET /api/publish/acceptance(ai-service 只读矩阵)。
 */
import * as React from 'react'
import { RefreshCw, Loader2, ShieldCheck, ShieldAlert, KeyRound, ScanLine } from 'lucide-react'
import { apiOrThrow } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@ihui/ui-react'

export interface AcceptanceItem {
  platform: string
  platformName: string
  status: string
  publishReadiness: string
  nextAction: string
  adapter: { missingFields: string[]; needsBrowser: boolean; webFallback?: boolean; webProbeError?: string | null; lastFailure?: string | null }
  accounts: { active: number; verifyMessage: string | null }
  publishEvidence: {
    everPublished: boolean
    publishedUrl: string | null
    publicVerified?: boolean
    publicDetail?: string | null
  }
}

interface AcceptanceData {
  summary: Record<string, number>
  platforms: AcceptanceItem[]
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  verified: { label: '已验证', className: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  ready_unverified: { label: '可发·未验', className: 'text-sky-700 bg-sky-50 border-sky-200' },
  browser_likely: { label: '浏览器可发', className: 'text-sky-700 bg-sky-50 border-sky-200' },
  login_only: { label: '仅登录·不可发', className: 'text-amber-700 bg-amber-50 border-amber-200' },
  reauth_required: { label: '需重登', className: 'text-rose-700 bg-rose-50 border-rose-200' },
  untested: { label: '待验', className: 'text-muted-foreground bg-muted border-border' },
  disabled: { label: '已停用', className: 'text-muted-foreground bg-muted border-border' },
  no_account: { label: '无账号', className: 'text-muted-foreground bg-muted border-border' },
  no_adapter: { label: '无适配器', className: 'text-muted-foreground bg-muted border-border' },
}

function Chip({ label, value, icon: Icon, tone }: {
  label: string
  value: number
  icon: typeof ShieldCheck
  tone: string
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${tone}`}>
      <Icon className="h-3.5 w-3.5" />
      {label} <strong className="tabular-nums">{value}</strong>
    </span>
  )
}

export function AcceptancePanel() {
  const toast = useToast()
  const [data, setData] = React.useState<AcceptanceData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [showAll, setShowAll] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      setData(await apiOrThrow<AcceptanceData>('/api/publish/acceptance'))
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [toast])

  React.useEffect(() => { void load() }, [load])

  const summary = data?.summary ?? {}
  const rows = (data?.platforms ?? []).filter(
    (x) => showAll || !['no_account', 'no_adapter'].includes(x.status),
  )

  return (
    <section className="rounded-lg border bg-card p-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">发布能力验收</span>
          <Chip label="已验证" value={summary.verified ?? 0} icon={ShieldCheck} tone="text-emerald-700 bg-emerald-50 border-emerald-200" />
          <Chip label="可发未验" value={(summary.readyUnverified ?? 0) + (summary.browserLikely ?? 0)} icon={ShieldAlert} tone="text-sky-700 bg-sky-50 border-sky-200" />
          <Chip label="仅登录" value={summary.loginOnly ?? 0} icon={KeyRound} tone="text-amber-700 bg-amber-50 border-amber-200" />
          <Chip label="需重登" value={summary.reauthRequired ?? 0} icon={ScanLine} tone="text-rose-700 bg-rose-50 border-rose-200" />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
            {showAll ? '只看有账号' : `显示全部 ${summary.totalPlatforms ?? 37} 平台`}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            刷新
          </Button>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((x) => {
            const meta = STATUS_META[x.status] ?? STATUS_META.untested!
            return (
              <div key={x.platform} className="flex flex-wrap items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs">
                <span className={`rounded border px-1.5 py-0.5 ${meta.className}`}>{meta.label}</span>
                <strong className="min-w-24">{x.platformName}</strong>
                <span className="text-muted-foreground">{x.nextAction}</span>
                {x.adapter.webFallback && (
                  <span className="text-sky-700">网页兜底已接</span>
                )}
                {x.adapter.lastFailure && (
                  <span className="text-rose-700">最近失败: {x.adapter.lastFailure}</span>
                )}
                {x.adapter.webProbeError && (
                  <span className="text-rose-700">网页实测失败: {x.adapter.webProbeError.replace('[WEB_PROBE]', '').trim()}</span>
                )}
                {x.adapter.missingFields.length > 0 && (
                  <span className="text-amber-700">缺字段: {x.adapter.missingFields.join(' / ')}</span>
                )}
                {x.publishEvidence.publishedUrl && (
                  <a className="text-sky-700 underline" href={x.publishEvidence.publishedUrl} target="_blank" rel="noreferrer">
                    已发链接
                  </a>
                )}
                {x.publishEvidence.publicVerified ? (
                  <span className="text-emerald-700" title={x.publishEvidence.publicDetail ?? undefined}>
                    公开页已核验
                  </span>
                ) : x.status === 'verified' ? (
                  <span className="text-amber-700" title={x.publishEvidence.publicDetail ?? '只有平台成功记录，尚未做匿名公开页核验'}>
                    仅平台成功
                  </span>
                ) : null}
                {x.accounts.verifyMessage && (
                  <span className="w-full truncate text-muted-foreground/80" title={x.accounts.verifyMessage}>
                    {x.accounts.verifyMessage}
                  </span>
                )}
              </div>
            )
          })}
          {rows.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">暂无平台</p>}
        </div>
      )}
    </section>
  )
}
