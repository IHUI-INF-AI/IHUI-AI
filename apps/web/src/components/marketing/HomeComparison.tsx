'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Check, X } from 'lucide-react'
import { RevealOnView } from '@/components/common'

/**
 * 第 5 页:智汇 AI vs Claude Code vs Cursor vs ChatGPT 8 行竞品对比表
 *
 * 2026-07-21 拆分(从原 HomeScenarioGrid 抽出):
 * - 用户反馈"内容太拥挤了,再分个页面出来"
 * - 8 行对比表独立成页,字号 / 行高 / 单元格 padding 全部放大,可读性大幅提升
 * - 让决策者看完 ROI 后,再细看"行业唯一 8 端全覆盖 / 100+ LLM / 三栈合一"等核心壁垒
 *
 * 8 行对比维度:端覆盖 / 大模型数量 / AI 技术栈 / API 端点 / 教育模块 /
 *              决策者社群 / 中文优化 / 智能体广场
 *
 * 2026-07-23 改:表头 + 每行 staggered 入场。
 */

const COMPARISON_ROWS = [1, 2, 3, 4, 5, 6, 7, 8] as const

/** i18n 静态映射表 — 用于消除 `t(`row${n}Xxx`)` 动态拼接 */
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
    <section className="space-y-5">
      <RevealOnView as="div" className="space-y-2 text-center">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('title')}</h2>
        <h3 className="font-edix text-xs uppercase tracking-wider text-muted-foreground">
          {t('titleEn')}
        </h3>
        <p className="mx-auto max-w-3xl text-sm text-muted-foreground sm:text-base">
          {t('subtitle')}
        </p>
      </RevealOnView>

      <RevealOnView as="div" delay={0.1} className="overflow-hidden rounded-lg border">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead className="bg-muted/60">
            <tr>
              <th className="px-3 py-2.5 font-semibold sm:px-4 sm:py-3">{t('colFeature')}</th>
              <th className="bg-primary/10 px-3 py-2.5 font-semibold text-primary sm:px-4 sm:py-3">
                {t('colUs')}
              </th>
              <th className="px-3 py-2.5 font-semibold sm:px-4 sm:py-3">{t('colClaude')}</th>
              <th className="px-3 py-2.5 font-semibold sm:px-4 sm:py-3">{t('colCursor')}</th>
              <th className="px-3 py-2.5 font-semibold sm:px-4 sm:py-3">{t('colChatgpt')}</th>
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
                  delay={0.15 + 0.05 * (i + 1)}
                  className="border-t transition-colors hover:bg-primary/5"
                >
                  <td className="px-3 py-2.5 font-medium sm:px-4 sm:py-3">
                    {feature}
                  </td>
                  <td className="bg-primary/5 px-3 py-2.5 font-medium text-primary sm:px-4 sm:py-3">
                    <div className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                      <span>{us}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground sm:px-4 sm:py-3">
                    <div className="flex items-center gap-1.5">
                      {claude === '无' ? (
                        <X
                          className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60"
                          aria-hidden="true"
                        />
                      ) : null}
                      <span>{claude}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground sm:px-4 sm:py-3">
                    <div className="flex items-center gap-1.5">
                      {cursor === '无' ? (
                        <X
                          className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60"
                          aria-hidden="true"
                        />
                      ) : null}
                      <span>{cursor}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground sm:px-4 sm:py-3">
                    <div className="flex items-center gap-1.5">
                      {chatgpt === '无' ? (
                        <X
                          className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60"
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
      </RevealOnView>
    </section>
  )
}
