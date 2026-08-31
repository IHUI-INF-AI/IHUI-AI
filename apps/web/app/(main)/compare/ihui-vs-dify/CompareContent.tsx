// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import Link from 'next/link'
import { Check, Sparkles, Rocket, Layers } from 'lucide-react'
import { Button } from '@ihui/ui-react'

import { COMPETITORS } from './compare-content/competitors'
import { Cell } from './compare-content/CompareCell'
import type { CompetitorConfig } from './compare-content/types'

export function CompareContent({
  competitor,
}: {
  competitor: CompetitorConfig['id']
}): React.JSX.Element {
  const config = COMPETITORS[competitor]

  if (!config) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-8 min-[768px]:px-8 min-[768px]:py-8">
        <section className="space-y-5 text-center">
          <h1 className="text-2xl min-[768px]:text-4xl min-[1024px]:text-5xl font-bold tracking-tight">
            对比页面开发中
          </h1>
          <p className="mx-auto max-w-3xl text-base text-muted-foreground min-[768px]:text-lg">
            {competitor} 的详细对比内容即将上线，敬请期待。
          </p>
        </section>
      </main>
    )
  }

  const yesCount = config.rows.filter((r) => r.ihui === true).length
  const competitorYesCount = config.rows.filter((r) => r.competitor === true).length
  const competitorLimitedCount = config.rows.filter(
    (r) =>
      r.competitor === '基础' ||
      r.competitor === '有限' ||
      r.competitor === '受限' ||
      r.competitor === '部分' ||
      (typeof r.competitor === 'string' && r.competitor.includes('only')),
  ).length

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 min-[768px]:px-8 min-[768px]:py-8">
      {/* Hero */}
      <section className="space-y-5 text-center">
        <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <Layers className="h-3.5 w-3.5 text-primary" />
          深度对比
        </div>
        <h1 className="text-2xl min-[768px]:text-4xl min-[1024px]:text-5xl font-bold tracking-tight">
          IHUI AI vs {config.name}
        </h1>
        <p className="mx-auto max-w-3xl text-base text-muted-foreground min-[768px]:text-lg">
          {config.tagline}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-6 pt-2 text-sm">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-primary" />
            <span>
              IHUI AI: {yesCount}/{config.rows.length} 项支持
            </span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>
              {config.name}: {competitorYesCount}/{config.rows.length} 项完全支持
              {competitorLimitedCount > 0 && ` + ${competitorLimitedCount} 项有限`}
            </span>
          </div>
        </div>
      </section>

      {/* 对比表格 */}
      <section className="mt-12 overflow-x-auto rounded-2xl border bg-card shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/30">
              <th className="px-4 py-4 text-left text-sm font-semibold min-[768px]:px-6">
                对比维度
              </th>
              <th className="px-4 py-4 text-center text-sm font-semibold text-primary min-[768px]:px-6">
                IHUI AI
              </th>
              <th className="px-4 py-4 text-center text-sm font-semibold min-[768px]:px-6">
                {config.name}
              </th>
            </tr>
          </thead>
          <tbody>
            {config.rows.map((row, idx) => (
              <tr key={row.dimension} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/10'}>
                <td className="px-4 py-4 min-[768px]:px-6">
                  <div className="text-sm font-medium">{row.dimension}</div>
                  {(row.ihuiDetail || row.competitorDetail) && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {row.ihuiDetail && (
                        <div>
                          <span className="text-primary">IHUI:</span> {row.ihuiDetail}
                        </div>
                      )}
                      {row.competitorDetail && (
                        <div className="mt-0.5">
                          <span>{config.name}:</span> {row.competitorDetail}
                        </div>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-4 text-center min-[768px]:px-6">
                  <Cell value={row.ihui} dimension={row.dimension} isIhui={true} />
                </td>
                <td className="px-4 py-4 text-center min-[768px]:px-6">
                  <Cell value={row.competitor} dimension={row.dimension} isIhui={false} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 总结 */}
      <section className="mt-12 rounded-2xl border bg-primary/5 p-8 min-[768px]:p-12">
        <div className="flex items-start gap-3">
          <Rocket className="h-6 w-6 shrink-0 text-primary" />
          <div>
            <h2 className="text-xl font-semibold">结论</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground min-[768px]:text-base">
              {config.verdict}
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mt-12 rounded-2xl border bg-card p-8 text-center min-[768px]:p-12">
        <Sparkles className="mx-auto h-10 w-10 text-primary" />
        <h2 className="mt-4 text-xl font-bold tracking-tight min-[768px]:text-2xl">
          30 分钟体验 IHUI AI
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground min-[768px]:text-base">
          注册即得 1000 积分,所有模型、所有 6 端免费试用。
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" asChild>
            <Link href="/sso/register">免费注册</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/compare">查看其他对比</Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
