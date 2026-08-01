'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Check, X } from 'lucide-react'
import { RevealOnView } from '@/components/common'

/**
 * 第 5 页:智汇 AI vs Claude Code vs Cursor vs ChatGPT 8 行竞品对比表
 *
 * 2026-07-29 杂志风改版:
 * - 编辑式章节标题(大号 ghost 数字 05)
 * - 行编号(01-08)EDIX 字体
 * - "智汇 AI" 列 subtle gradient 高亮
 * - hover 左侧 accent bar 生长
 * - staggered 行滑入动画
 * - Check 图标 draw 动画
 */

const COMPARISON_ROWS = [1, 2, 3, 4, 5, 6, 7, 8] as const

const COMPARISON_ROW_KEY: Record<number, { Us: string; Feature: string; Claude: string; Cursor: string; Chatgpt: string }> = {
  1: { Us: 'row1Us', Feature: 'row1Feature', Claude: 'row1Claude', Cursor: 'row1Cursor', Chatgpt: 'row1Chatgpt' },
  2: { Us: 'row2Us', Feature: 'row2Feature', Claude: 'row2Claude', Cursor: 'row2Cursor', Chatgpt: 'row2Chatgpt' },
  3: { Us: 'row3Us', Feature: 'row3Feature', Claude: 'row3Claude', Cursor: 'row3Cursor', Chatgpt: 'row3Chatgpt' },
  4: { Us: 'row4Us', Feature: 'row4Feature', Claude: 'row4Claude', Cursor: 'row4Cursor', Chatgpt: 'row4Chatgpt' },
  5: { Us: 'row5Us', Feature: 'row5Feature', Claude: 'row5Claude', Cursor: 'row5Cursor', Chatgpt: 'row5Chatgpt' },
  6: { Us: 'row6Us', Feature: 'row6Feature', Claude: 'row6Claude', Cursor: 'row6Cursor', Chatgpt: 'row6Chatgpt' },
  7: { Us: 'row7Us', Feature: 'row7Feature', Claude: 'row7Claude', Cursor: 'row7Cursor', Chatgpt: 'row7Chatgpt' },
  8: { Us: 'row8Us', Feature: 'row8Feature', Claude: 'row8Claude', Cursor: 'row8Cursor', Chatgpt: 'row8Chatgpt' },
}

export function HomeComparison() {
  const t = useTranslations('marketing.comparison')

  return (
    <section className="relative space-y-6">
      {/* 编辑式章节标题 */}
      <RevealOnView as="div" className="relative space-y-1.5 text-center">
        <div
          className="font-edix pointer-events-none absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 select-none text-[120px] font-bold leading-none tracking-tighter text-foreground animate-mag-section-breathe min-[640px]:text-[160px]"
          aria-hidden="true"
        >
          05
        </div>
        <h2 className="text-2xl font-bold tracking-tight min-[640px]:text-3xl">{t('title')}</h2>
        <h3 className="font-edix text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {t('titleEn')}
        </h3>
        <p className="mx-auto max-w-3xl text-sm text-muted-foreground min-[640px]:text-base">
          {t('subtitle')}
        </p>
      </RevealOnView>

      <RevealOnView as="div" delay={0.1} className="overflow-hidden rounded-lg border">
        <div className="overflow-x-auto">
        <table className="w-full text-left text-xs min-[640px]:text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-3 font-semibold min-[640px]:px-4 min-[640px]:py-3.5">
                <span className="font-edix text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  {t('colFeature')}
                </span>
              </th>
              <th className="bg-primary/8 px-3 py-3 font-semibold text-primary min-[640px]:px-4 min-[640px]:py-3.5">
                <span className="font-edix text-[10px] uppercase tracking-[0.15em]">
                  {t('colUs')}
                </span>
              </th>
              <th className="px-3 py-3 font-semibold min-[640px]:px-4 min-[640px]:py-3.5">
                <span className="font-edix text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  {t('colClaude')}
                </span>
              </th>
              <th className="px-3 py-3 font-semibold min-[640px]:px-4 min-[640px]:py-3.5">
                <span className="font-edix text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  {t('colCursor')}
                </span>
              </th>
              <th className="px-3 py-3 font-semibold min-[640px]:px-4 min-[640px]:py-3.5">
                <span className="font-edix text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  {t('colChatgpt')}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON_ROWS.map((n, i) => {
              const rowKey = COMPARISON_ROW_KEY[n]
              const us = t(rowKey?.Us ?? 'rowUnknown')
              const feature = t(rowKey?.Feature ?? 'rowUnknown')
              const claude = t(rowKey?.Claude ?? 'rowUnknown')
              const cursor = t(rowKey?.Cursor ?? 'rowUnknown')
              const chatgpt = t(rowKey?.Chatgpt ?? 'rowUnknown')
              return (
                <RevealOnView
                  key={n}
                  as="tr"
                  delay={0.12 + 0.05 * (i + 1)}
                  className="group/row relative border-t border-border/50 transition-colors duration-200 hover:bg-primary/3"
                >
                  {/* hover 左侧 accent bar */}
                  <td className="relative px-3 py-3 font-medium min-[640px]:px-4 min-[640px]:py-3.5">
                    <span
                      className="absolute left-0 top-1/2 h-0 w-0.5 -translate-y-1/2 bg-primary transition-all duration-300 group-hover/row:h-3/4"
                      aria-hidden="true"
                    />
                    <span className="font-edix mr-1.5 text-[10px] text-muted-foreground/40">
                      {String(n).padStart(2, '0')}
                    </span>
                    {feature}
                  </td>
                  <td className="bg-primary/5 px-3 py-3 font-medium text-primary transition-colors duration-200 group-hover/row:bg-primary/8 min-[640px]:px-4 min-[640px]:py-3.5">
                    <div className="flex items-center gap-1.5">
                      <Check
                        className="h-3.5 w-3.5 shrink-0 text-primary transition-transform duration-300 group-hover/row:scale-125"
                        aria-hidden="true"
                      />
                      <span>{us}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground min-[640px]:px-4 min-[640px]:py-3.5">
                    <div className="flex items-center gap-1.5">
                      {claude === '无' ? (
                        <X
                          className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40"
                          aria-hidden="true"
                        />
                      ) : null}
                      <span>{claude}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground min-[640px]:px-4 min-[640px]:py-3.5">
                    <div className="flex items-center gap-1.5">
                      {cursor === '无' ? (
                        <X
                          className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40"
                          aria-hidden="true"
                        />
                      ) : null}
                      <span>{cursor}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground min-[640px]:px-4 min-[640px]:py-3.5">
                    <div className="flex items-center gap-1.5">
                      {chatgpt === '无' ? (
                        <X
                          className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40"
                          aria-hidden="true"
                        />
                      ) : null}
                      <span>{chatgpt}</span>
                    </div>
                  </td>
                </RevealOnView>
              )
            })}
          </tbody>
        </table>
        </div>
      </RevealOnView>
    </section>
  )
}
