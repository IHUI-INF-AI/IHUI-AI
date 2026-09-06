// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ExternalLink, ShieldCheck, ShieldAlert } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { ResearchSourceRef } from '@ihui/api-client'

/** 来源分级 → 徽章样式(官方/媒体可信,社区/未知须标注) */
const TIER_STYLES: Record<string, string> = {
  authoritative: 'bg-emerald-500/10 text-emerald-600',
  media: 'bg-sky-500/10 text-sky-600',
  community: 'bg-amber-500/10 text-amber-600',
  unknown: 'bg-muted text-muted-foreground',
}

type TierKey = keyof typeof TIER_STYLES

export interface SourcesPanelProps {
  sources: ResearchSourceRef[]
}

/** 报告来源溯源面板(2026-09-07 工作线 B):SourceRef 分级 / 置信度 / 核验标注 + 原文链接 */
export function SourcesPanel({ sources }: SourcesPanelProps) {
  const t = useTranslations('deepResearch')
  const TIER_LABEL: Record<TierKey, string> = {
    authoritative: t('sourceTier.authoritative'),
    media: t('sourceTier.media'),
    community: t('sourceTier.community'),
    unknown: t('sourceTier.unknown'),
  }
  if (sources.length === 0) return null
  return (
    <div className="rounded-xl border p-4">
      <h2 className="mb-2 text-sm font-semibold">{t('sourcesTitle')}</h2>
      <ul className="space-y-2">
        {sources.map((s, i) => (
          <li key={s.url} className="text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="tabular-nums text-muted-foreground">[{i + 1}]</span>
              <span
                className={cn(
                  'rounded px-1.5 py-0.5 text-[10px] font-medium',
                  TIER_STYLES[s.tier] ?? TIER_STYLES.unknown,
                )}
              >
                {TIER_LABEL[(s.tier in TIER_STYLES ? s.tier : 'unknown') as TierKey]}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {t('confidenceLabel')} {Math.round((s.confidence || 0) * 100)}%
              </span>
              {s.verified ? (
                <span className="inline-flex items-center gap-0.5 text-emerald-600">
                  <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                  {t('verifiedLabel')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 text-amber-600">
                  <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                  {t('unverifiedLabel')}
                </span>
              )}
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="ml-auto inline-flex items-center gap-0.5 text-primary hover:underline"
              >
                {s.title || s.url}
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </div>
            {s.snippet && <p className="mt-0.5 line-clamp-2 text-muted-foreground">{s.snippet}</p>}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default SourcesPanel
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
