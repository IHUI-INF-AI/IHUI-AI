// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).

'use client'

import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  Boxes,
  Search,
  Wrench,
  FileText,
  Sparkles,
  ShieldCheck,
  Globe,
  CheckCircle2,
  AlertTriangle,
  Power,
  PowerOff,
  Loader2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import {
  getCapabilities,
  enableCapability,
  disableCapability,
  type Capability,
  type CapabilityHealth,
  type CapabilityKind,
  type CapabilityListResponse,
} from '@ihui/api-client/endpoints/mcp'
import { BackButton } from '@/components/common'
import { Badge } from '@/components/data'
import { Button, Input } from '@ihui/ui-react'

/** 能力类型 → 图标 */
const KIND_ICON: Record<CapabilityKind, LucideIcon> = {
  tool: Wrench,
  resource: FileText,
  prompt: Sparkles,
}

/** 健康状态 → 徽章样式 */
function healthBadge(health: CapabilityHealth): { variant: 'success' | 'warning' | 'danger'; icon: LucideIcon } {
  if (health === 'healthy') return { variant: 'success', icon: CheckCircle2 }
  if (health === 'degraded') return { variant: 'warning', icon: Globe }
  return { variant: 'danger', icon: AlertTriangle }
}

/**
 * 能力市场页 — P2-8 供给侧(2026-09 立)
 *
 * 定位:把平台自研 MCP server 的能力(tool/resource/prompt)作为可浏览 / 可检索 /
 * 可启用的一站式市场暴露,agent 侧一键启用即加入对外暴露的能力集。
 * 接口:GET  /api/mcp/capabilities(分页 + 分类 + 关键词,一个接口渲染整页)
 *       POST /api/mcp/capabilities/{id}/enable | /disable(按权限模型校验 admin 专属)
 *       (均经 next rewrites → ai-service 8803)。
 */
export default function CapabilityMarketPageClient() {
  const t = useTranslations('capabilityMarket')
  const qc = useQueryClient()
  const [q, setQ] = React.useState('')
  const [category, setCategory] = React.useState('')
  const [actingId, setActingId] = React.useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['capability-market', 'list', { q, category }],
    queryFn: async (): Promise<CapabilityListResponse> => {
      const r = await getCapabilities({ page: 1, page_size: 100, category, q })
      if (!r.success || !r.data) throw new Error(r.error ?? 'load failed')
      return r.data
    },
  })

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['capability-market', 'list'] })
  }

  /** 启用 / 停用切换(幂等) */
  const handleToggle = async (c: Capability) => {
    if (actingId) return
    setActingId(c.id)
    const enable = !c.enabled
    try {
      const r = enable ? await enableCapability(c.id) : await disableCapability(c.id)
      if (r.success) {
        toast.success(enable ? t('enableSuccess', { name: c.name }) : t('disableSuccess', { name: c.name }))
        refresh()
      } else if (r.status === 403) {
        toast.error(t('adminOnly'))
      } else {
        toast.error(r.error ?? t('actionFailed'))
      }
    } catch {
      toast.error(t('actionFailed'))
    } finally {
      setActingId(null)
    }
  }

  const items = data?.items ?? []
  const categories = data?.categories ?? []
  const total = data?.total ?? 0

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4">
      <BackButton />
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Boxes className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          {!isLoading && !error && <Badge variant="primary">{t('count', { count: total })}</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
      </header>

      {/* 过滤栏:关键词搜索 + 分类下拉 */}
      <div className="flex flex-col gap-2 min-[640px]:flex-row min-[640px]:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="pl-9"
            autoComplete="off"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-md border bg-card px-3 py-2 text-sm text-foreground"
          aria-label={t('category')}
        >
          <option value="">{t('allCategories')}</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{t('loading')}</span>
        </div>
      )}
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {t('loadFailed')}
        </div>
      )}
      {!isLoading && !error && (
        <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3">
          {items.map((c) => (
            <CapabilityCard
              key={c.id}
              cap={c}
              acting={actingId === c.id}
              onToggle={() => void handleToggle(c)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** 单条能力卡片:类型图标 / 分类 / 健康 / 权限 / 描述 / 参数数 + 启用开关 */
function CapabilityCard({
  cap,
  acting,
  onToggle,
}: {
  cap: Capability
  acting: boolean
  onToggle: () => void
}) {
  const t = useTranslations('capabilityMarket')
  const Icon = KIND_ICON[cap.kind] ?? Wrench
  const hb = healthBadge(cap.health)

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border bg-card p-3 transition-colors hover:border-foreground/20">
      <div className="flex items-start gap-2.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-semibold leading-tight text-foreground">{cap.name}</span>
            <Badge variant={cap.kind === 'tool' ? 'primary' : 'default'}>
              {cap.kind === 'tool' ? t('kindTool') : cap.kind === 'resource' ? t('kindResource') : t('kindPrompt')}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>{t('category')}: {cap.category}</span>
            <Badge variant={hb.variant}>
              <hb.icon className="h-3 w-3" />
              {cap.health === 'healthy' ? t('healthy') : cap.health === 'degraded' ? t('degraded') : t('unhealthy')}
            </Badge>
            {cap.permission === 'admin' ? (
              <Badge variant="warning">
                <ShieldCheck className="h-3 w-3" />
                {t('adminOnly')}
              </Badge>
            ) : (
              <Badge variant="default">{t('allUsers')}</Badge>
            )}
            {cap.requires_network && (
              <span className="inline-flex items-center gap-0.5">
                <Globe className="h-3 w-3" />
                {t('networkRequired')}
              </span>
            )}
          </div>
        </div>
      </div>
      <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{cap.description}</p>
      <div className="text-[11px] text-muted-foreground">
        {cap.params.length > 0 ? t('paramCount', { count: cap.params.length }) : t('noParams')}
      </div>
      <Button
        variant={cap.enabled ? 'outline' : 'default'}
        onClick={onToggle}
        disabled={acting}
        className="mt-auto w-full"
      >
        {acting ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : cap.enabled ? (
          <>
            <PowerOff className="mr-1.5 h-3.5 w-3.5" />
            {t('disable')}
          </>
        ) : (
          <>
            <Power className="mr-1.5 h-3.5 w-3.5" />
            {t('enable')}
          </>
        )}
      </Button>
    </div>
  )
}
