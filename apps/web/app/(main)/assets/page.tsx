// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import Link from 'next/link'
import * as React from 'react'
import {
  ArrowUpRight,
  Brain,
  Download,
  FolderOpen,
  Image as ImageIcon,
  KeyRound,
  ListChecks,
  Wallet,
} from 'lucide-react'

import { getArtifacts, getBalance, listKnowledgeBases, type PublishAccount } from '@ihui/api-client'
import { Card, CardContent } from '@ihui/ui-react'

import { AuthGatePrompt } from '@/components/common'
import { useAuthGate } from '@/hooks/use-auth-gate'
import { fetchApi } from '@/lib/api'
import { buildAssetCards, type AssetCardId, type AssetSnapshot } from '@/lib/asset-summary'
import { fetchMemory } from '@/lib/memory-api'

const ICONS: Record<AssetCardId, React.ComponentType<{ className?: string }>> = {
  accounts: KeyRound,
  publish: ListChecks,
  artifacts: ImageIcon,
  knowledge: FolderOpen,
  memory: Brain,
  earnings: Wallet,
}

type AccountsPayload =
  PublishAccount[] | { items?: PublishAccount[]; list?: PublishAccount[]; total?: number }

type StatsPayload = {
  tasks?: { draft?: number; scheduled?: number; running?: number; failed?: number }
}

function accountList(data: AccountsPayload | undefined): PublishAccount[] {
  if (!data) return []
  if (Array.isArray(data)) return data
  return data.items ?? data.list ?? []
}

export default function AssetsPage() {
  const { allow } = useAuthGate()
  const [snapshot, setSnapshot] = React.useState<AssetSnapshot>({})
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!allow) return
    let cancelled = false
    setLoading(true)

    void Promise.allSettled([
      fetchApi<AccountsPayload>('/api/publish/accounts/me'),
      fetchApi<StatsPayload>('/api/publish/stats?days=30'),
      getArtifacts({ page: 1, pageSize: 1 }),
      listKnowledgeBases({ page: 1, pageSize: 1 }),
      fetchMemory(),
      getBalance(),
    ]).then(([accountsRes, statsRes, artifactsRes, knowledgeRes, memoryRes, walletRes]) => {
      if (cancelled) return
      const next: AssetSnapshot = {}

      if (accountsRes.status === 'fulfilled') {
        const r = accountsRes.value
        if (r.success) {
          const list = accountList(r.data)
          next.accounts = {
            total: list.length,
            active: list.filter((a) => a.status === 'active' || a.status === 'healthy').length,
          }
        } else {
          next.accounts = null
        }
      }

      if (statsRes.status === 'fulfilled' && statsRes.value.success && statsRes.value.data?.tasks) {
        const t = statsRes.value.data.tasks
        next.publish = {
          draft: t.draft ?? 0,
          scheduled: t.scheduled ?? 0,
          running: t.running ?? 0,
          failed: t.failed ?? 0,
        }
      } else if (statsRes.status === 'fulfilled') {
        next.publish = null
      }

      if (artifactsRes.status === 'fulfilled') {
        next.artifacts = artifactsRes.value.success ? artifactsRes.value.data.total : null
      }
      if (knowledgeRes.status === 'fulfilled') {
        next.knowledge = knowledgeRes.value.success ? knowledgeRes.value.data.total : null
      }
      if (memoryRes.status === 'fulfilled') next.memory = memoryRes.value.total
      if (walletRes.status === 'fulfilled') {
        next.earnings = walletRes.value.success
          ? {
              balance: walletRes.value.data.balance ?? 0,
              frozen: walletRes.value.data.frozenBalance ?? 0,
            }
          : null
      }

      setSnapshot(next)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [allow])

  const cards = React.useMemo(() => buildAssetCards(snapshot), [snapshot])

  const exportSummary = React.useCallback(() => {
    const payload = {
      generatedAt: new Date().toISOString(),
      cards: cards.map(({ id, title, value, hint, tone }) => ({ id, title, value, hint, tone })),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ihui-assets-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    window.URL.revokeObjectURL(url)
  }, [cards])

  if (!allow) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <AuthGatePrompt message="登录后查看你的账号、任务、素材与收益" />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">资产</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            账号、任务、素材、知识、记忆、收益 —— 你在这个平台攒下的东西,都在这。
            {loading ? ' 正在刷新…' : null}
          </p>
        </div>
        <button
          type="button"
          onClick={exportSummary}
          className="border-border text-muted-foreground hover:bg-muted inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm"
        >
          <Download className="h-4 w-4" />
          导出清单
        </button>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = ICONS[card.id]
          return (
            <Link key={card.id} href={card.href} className="group">
              <Card className="hover:border-border h-full transition-colors">
                <CardContent className="p-5 min-[640px]:p-5">
                  <div className="text-muted-foreground flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-sm">
                      <Icon className="h-4 w-4" />
                      {card.title}
                    </span>
                    <ArrowUpRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <div
                    className={
                      card.tone === 'unknown'
                        ? 'text-muted-foreground mt-3 text-3xl font-semibold tabular-nums'
                        : 'mt-3 text-3xl font-semibold tabular-nums'
                    }
                  >
                    {card.value}
                  </div>
                  <div className="text-muted-foreground mt-1.5 text-xs">{card.hint}</div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      <p className="text-muted-foreground mt-6 text-xs">
        数字来自各域接口的实时读数;显示「—」表示该接口本次没取到,不代表你没有。
        素材/知识/记忆的逐条导出在各自页面内完成。
      </p>
    </div>
  )
}
